/*
  Makes "the film": two short, silent MP4 loops built from the shoot photos.
  - film-tall.mp4  720x1280 (phones, and ready to post on TikTok / Reels)
  - film-wide.mp4 1280x720  (desktop: three photos side by side, each swapping in turn)

  How it's made to feel smooth:
  - Every photo gets one slow, steady push-in that keeps going through its crossfades,
    so the motion never stops or jumps between photos.
  - Photos dissolve into each other (eased crossfade) instead of cutting.
  - Frames are sampled at sub-pixel positions, so the zoom glides instead of stepping a pixel at a time.
  - The last photo dissolves back into the first, so the loop has no visible restart.
  Frames are drawn in memory and piped straight into ffmpeg, so nothing big is written to disk.
*/
import { spawn, execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const FPS = 30;
const BG = [11, 11, 11]; // #0B0B0B, shows in the gaps between the wide film's panels

function ffmpegPath() {
  try {
    const p = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
    if (existsSync(p)) {
      try { chmodSync(p, 0o755); } catch { /* already executable */ }
      return p;
    }
  } catch { /* package missing: try the system one */ }
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return 'ffmpeg';
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const mod = (a, n) => ((a % n) + n) % n;

// The widest crop of a w x h photo that has the given aspect ratio
function baseCrop(w, h, aspect) {
  let cw = w, ch = w / aspect;
  if (ch > h) { ch = h; cw = h * aspect; }
  return { cw, ch };
}

/*
  Load a photo already scaled (with a high-quality filter) so that its most zoomed-in crop
  maps 1:1 onto the output. Every other frame is then a slight downscale, which bilinear
  sampling handles cleanly.
*/
async function loadScaled(file, outW, aspect, zoomMax) {
  const meta = await sharp(file).metadata();
  const w0 = meta.autoOrient ? meta.autoOrient.width : meta.width;
  const h0 = meta.autoOrient ? meta.autoOrient.height : meta.height;
  const { cw } = baseCrop(w0, h0, aspect);
  const r = Math.min(1, (outW * zoomMax) / cw);
  const { data, info } = await sharp(file).rotate()
    .resize(Math.round(w0 * r), Math.round(h0 * r), { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Where to crop at progress p (0..1): zooms in steadily, drifts sideways, stays toward the top so heads stay in frame
function cropAt(src, aspect, zoomMax, p, dir) {
  const { cw, ch } = baseCrop(src.width, src.height, aspect);
  const zoom = 1 + (zoomMax - 1) * p;
  const w = cw / zoom, h = ch / zoom;
  const slackX = src.width - w;
  const x = Math.max(0, Math.min(slackX, slackX / 2 + dir * 0.35 * (slackX / 2) * (p * 2 - 1)));
  const y = Math.max(0, (src.height - h) * 0.3);
  return { x, y, w, h };
}

/*
  Bilinear sample of a sub-pixel crop into an RGB frame buffer.
  alpha 1 writes the pixels; alpha < 1 blends them over what's already there (the crossfade).
*/
function sampleInto(src, crop, outW, outH, dst, dstW, dstX, alpha) {
  const s = src.data, sw = src.width, sh = src.height, row = sw * 3;
  const kx = crop.w / outW, ky = crop.h / outH;
  const xi = new Int32Array(outW), xf = new Float32Array(outW);
  for (let x = 0; x < outW; x++) {
    let sx = crop.x + (x + 0.5) * kx - 0.5;
    if (sx < 0) sx = 0; else if (sx > sw - 1.0001) sx = sw - 1.0001;
    const x0 = Math.floor(sx);
    xi[x] = x0 * 3; xf[x] = sx - x0;
  }
  const a = alpha, ia = 1 - alpha, blend = alpha < 1;
  for (let y = 0; y < outH; y++) {
    let sy = crop.y + (y + 0.5) * ky - 0.5;
    if (sy < 0) sy = 0; else if (sy > sh - 1.0001) sy = sh - 1.0001;
    const y0 = Math.floor(sy), fy = sy - y0;
    const r0 = y0 * row, r1 = r0 + row;
    let o = (y * dstW + dstX) * 3;
    for (let x = 0; x < outW; x++) {
      const i0 = r0 + xi[x], i1 = r1 + xi[x], fx = xf[x];
      for (let c = 0; c < 3; c++) {
        const t = s[i0 + c] + (s[i0 + 3 + c] - s[i0 + c]) * fx;
        const b = s[i1 + c] + (s[i1 + 3 + c] - s[i1 + c]) * fx;
        const v = t + (b - t) * fy;
        dst[o] = blend ? dst[o] * ia + v * a : v;
        o++;
      }
    }
  }
}

function encoder(bin, w, h, out) {
  const proc = spawn(bin, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', out
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  proc.stderr.on('data', (d) => { err += d; });
  const done = new Promise((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg failed: ' + err.slice(-400)))));
  });
  let pipeErr = null;
  proc.stdin.on('error', (e) => { pipeErr = e; });
  const write = (buf) => new Promise((resolve, reject) => {
    if (pipeErr) return reject(pipeErr);
    if (proc.stdin.write(buf)) resolve();
    else proc.stdin.once('drain', resolve);
  });
  return { write, end: () => { proc.stdin.end(); return done; } };
}

function poster(frame, w, h, file) {
  return sharp(Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength), { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 80, mozjpeg: true }).toFile(file);
}

/*
  One "lane" of photos that dissolve into each other on a loop.
  Each photo is on screen for `step` frames, the last `fade` of which overlap the next photo.
  Returns, for any frame, the photo(s) to draw with their progress and opacity.
*/
function lane(count, step, fade) {
  const life = step + fade;
  return (f) => {
    const local = mod(f, count * step);
    const i = Math.floor(local / step), l = local - i * step;
    const layers = [{ i, p: (l + fade) / life, alpha: 1 }];
    const into = l - (step - fade);
    if (into >= 0) layers.push({ i: (i + 1) % count, p: into / life, alpha: smooth((into + 0.5) / fade) });
    return layers;
  };
}

async function tallFilm(bin, files, out, posterFile) {
  const W = 720, H = 1280, ZOOM = 1.08;
  const STEP = Math.round(2.2 * FPS), FADE = Math.round(0.75 * FPS);
  const srcs = [];
  for (const f of files) srcs.push(await loadScaled(f, W, W / H, ZOOM));
  const at = lane(srcs.length, STEP, FADE);
  const total = srcs.length * STEP;
  const frame = new Uint8ClampedArray(W * H * 3);
  const enc = encoder(bin, W, H, out);
  for (let f = 0; f < total; f++) {
    for (const L of at(f)) {
      const dir = L.i % 2 ? 1 : -1;
      sampleInto(srcs[L.i], cropAt(srcs[L.i], W / H, ZOOM, L.p, dir), W, H, frame, W, 0, L.alpha);
    }
    if (f === 0) await poster(frame, W, H, posterFile);
    await enc.write(Buffer.from(frame));
  }
  await enc.end();
  return total / FPS;
}

async function wideFilm(bin, files, out, posterFile) {
  const W = 1280, H = 720, GAP = 6, PANELS = 3, ZOOM = 1.06;
  const HOLD = Math.round(3.6 * FPS), FADE = Math.round(0.8 * FPS), OFFSET = Math.round(HOLD / PANELS);
  // Use a multiple of 3 photos so each panel gets its own set and no photo shows twice at once
  const use = files.slice(0, Math.max(PANELS, Math.floor(files.length / PANELS) * PANELS));
  const panels = [];
  for (let k = 0; k < PANELS; k++) {
    const left = Math.round((k * (W + GAP)) / PANELS);
    const right = Math.round(((k + 1) * (W + GAP)) / PANELS) - GAP;
    panels.push({ left, width: right - left });
  }
  const pw = Math.max(...panels.map((p) => p.width));
  const srcs = [];
  for (const f of use) srcs.push(await loadScaled(f, pw, pw / H, ZOOM));
  const slots = srcs.length / PANELS;
  const at = lane(slots, HOLD, FADE);
  const total = slots * HOLD;
  const frame = new Uint8ClampedArray(W * H * 3);
  for (let i = 0; i < frame.length; i += 3) { frame[i] = BG[0]; frame[i + 1] = BG[1]; frame[i + 2] = BG[2]; }
  const enc = encoder(bin, W, H, out);
  for (let f = 0; f < total; f++) {
    panels.forEach((P, k) => {
      for (const L of at(f - k * OFFSET)) {
        const idx = L.i * PANELS + k;
        const dir = (L.i + k) % 2 ? 1 : -1;
        sampleInto(srcs[idx], cropAt(srcs[idx], P.width / H, ZOOM, L.p, dir), P.width, H, frame, W, P.left, L.alpha);
      }
    });
    if (f === 0) await poster(frame, W, H, posterFile);
    await enc.write(Buffer.from(frame));
  }
  await enc.end();
  return total / FPS;
}

/*
  files: full-size photo paths in the order they should appear.
  outDir: where film-tall.mp4, film-wide.mp4 and their posters go.
*/
export async function makeFilm(files, outDir) {
  const bin = ffmpegPath();
  const tall = await tallFilm(bin, files, `${outDir}/film-tall.mp4`, `${outDir}/film-tall.jpg`);
  const wide = await wideFilm(bin, files, `${outDir}/film-wide.mp4`, `${outDir}/film-wide.jpg`);
  return { tallSeconds: Math.round(tall * 10) / 10, wideSeconds: Math.round(wide * 10) / 10 };
}
