/*
  Makes "the film": two short, silent MP4 loops built from the shoot photos.
  - film-tall.mp4  720x1280 (phones, and ready to post on TikTok / Reels)
  - film-wide.mp4 1280x720  (desktop: three photos side by side, swapping in turn)
  Each photo gets a slow push-in so the stills feel like motion. Neon and pink alternate.
  Frames are drawn with sharp and piped straight into ffmpeg, so nothing big is written to disk.
*/
import { spawn, execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const FPS = 24;

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

const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

// Decode each photo once into raw pixels; every frame is then a cheap crop + resize
async function loadRaw(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Crop a frame out of a photo: target aspect, zoom (1 = widest), kept toward the top so heads stay in frame
function kenBurns(src, aspect, zoom, drift) {
  let w = src.width, h = Math.round(w / aspect);
  if (h > src.height) { h = src.height; w = Math.round(h * aspect); }
  w = Math.round(w / zoom); h = Math.round(h / zoom);
  const left = Math.max(0, Math.min(src.width - w, Math.round((src.width - w) / 2 + drift * (src.width - w) / 2)));
  const top = Math.max(0, Math.min(src.height - h, Math.round((src.height - h) * 0.3)));
  return { left, top, width: w, height: h };
}

function crop(src, region, outW, outH) {
  return sharp(src.data, { raw: { width: src.width, height: src.height, channels: 3 } })
    .extract(region)
    .resize(outW, outH, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer();
}

function encoder(bin, w, h, out) {
  const proc = spawn(bin, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p',
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

async function tallFilm(bin, srcs, out, poster) {
  const W = 720, H = 1280, PER = 22;
  const enc = encoder(bin, W, H, out);
  for (let i = 0; i < srcs.length; i++) {
    const drift = i % 2 ? 0.35 : -0.35;
    for (let f = 0; f < PER; f++) {
      const t = ease(f / (PER - 1));
      const frame = await crop(srcs[i], kenBurns(srcs[i], W / H, 1 + 0.09 * t, drift * t), W, H);
      if (i === 0 && f === 0) await sharp(frame, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 78, mozjpeg: true }).toFile(poster);
      await enc.write(frame);
    }
  }
  await enc.end();
  return (srcs.length * PER) / FPS;
}

async function wideFilm(bin, srcs, out, poster) {
  const W = 1280, H = 720, GAP = 6, PANELS = 3, STEP = 12, HOLD = 36;
  const pw = Math.floor((W - GAP * (PANELS - 1)) / PANELS);
  const enc = encoder(bin, W, H, out);
  // Panel k shows a new photo every HOLD frames, offset by k*STEP, so the three swap one after another
  const total = Math.ceil(srcs.length / PANELS) * HOLD + STEP * (PANELS - 1);
  for (let f = 0; f < total; f++) {
    const layers = [];
    for (let k = 0; k < PANELS; k++) {
      const local = f - k * STEP;
      const slot = Math.max(0, Math.floor(local / HOLD));
      const idx = (slot * PANELS + k) % srcs.length;
      const t = ease(Math.min(1, Math.max(0, (local - slot * HOLD) / (HOLD - 1))));
      const buf = await crop(srcs[idx], kenBurns(srcs[idx], pw / H, 1 + 0.07 * t, (k - 1) * 0.3 * t), pw, H);
      layers.push({ input: buf, raw: { width: pw, height: H, channels: 3 }, left: k * (pw + GAP), top: 0 });
    }
    const frame = await sharp({ create: { width: W, height: H, channels: 3, background: '#0B0B0B' } })
      .composite(layers).removeAlpha().raw().toBuffer();
    if (f === 0) await sharp(frame, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 78, mozjpeg: true }).toFile(poster);
    await enc.write(frame);
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
  const srcs = [];
  for (const f of files) srcs.push(await loadRaw(f));
  const tall = await tallFilm(bin, srcs, `${outDir}/film-tall.mp4`, `${outDir}/film-tall.jpg`);
  const wide = await wideFilm(bin, srcs, `${outDir}/film-wide.mp4`, `${outDir}/film-wide.jpg`);
  return { tallSeconds: Math.round(tall * 10) / 10, wideSeconds: Math.round(wide * 10) / 10 };
}
