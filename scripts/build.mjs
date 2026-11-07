/*
  Vercel build for the Miche site.
  1. Copies the site files into dist/.
  2. Pulls the shoot photos from the public Dropbox folder in DROPBOX_FOLDER_URL
     (a Vercel environment variable, so the link isn't in the code),
     shrinks each one to web size, and writes dist/photos.json.
  If the photo step fails for any reason, the site still deploys with placeholders.
*/
import { mkdir, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import sharp from 'sharp';
import yauzl from 'yauzl';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dist');
const SITE_FILES = ['index.html', 'product.html', 'photos.html', 'styles.css', 'config.js', 'app.js', 'popup.js', 'favicon.svg'];
// Kept between builds by Vercel's build cache, so the folder is only downloaded again when the link or VERSION changes
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'miche-photos');
const VERSION = '1';
const FULL_PX = 1600;
const THUMB_PX = 480;

async function copySite() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const f of SITE_FILES) await cp(path.join(ROOT, f), path.join(OUT, f));
  if (existsSync(path.join(ROOT, 'images'))) await cp(path.join(ROOT, 'images'), path.join(OUT, 'images'), { recursive: true });
}

function zipUrl(url) {
  const u = new URL(url);
  u.searchParams.set('dl', '1');
  return u.toString();
}

function processZip(zipPath) {
  return new Promise((resolve, reject) => {
    // decodeStrings: false skips yauzl's strict name check; Dropbox zips include a bare "/" entry
    yauzl.open(zipPath, { lazyEntries: true, decodeStrings: false }, (err, zip) => {
      if (err) return reject(err);
      const out = [];
      zip.on('entry', (entry) => {
        const fileName = Buffer.isBuffer(entry.fileName) ? entry.fileName.toString('utf8') : String(entry.fileName);
        const base = path.basename(fileName);
        const isImage = /\.(jpe?g|png|webp|heic)$/i.test(base);
        if (fileName.endsWith('/') || base.startsWith('._') || fileName.includes('__MACOSX') || !isImage) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, async (err2, stream) => {
          if (err2) return reject(err2);
          try {
            // Plain events: async iteration stalls on stored (uncompressed) entries, which Dropbox zips use
            const buf = await new Promise((done, fail) => {
              const chunks = [];
              stream.on('data', (c) => chunks.push(c));
              stream.on('end', () => done(Buffer.concat(chunks)));
              stream.on('error', fail);
            });
            const name = base.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '-');
            const full = await sharp(buf).rotate()
              .resize({ width: FULL_PX, height: FULL_PX, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80, mozjpeg: true })
              .toFile(path.join(CACHE, 'full', name + '.jpg'));
            await sharp(buf).rotate()
              .resize({ width: THUMB_PX, height: THUMB_PX, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 72, mozjpeg: true })
              .toFile(path.join(CACHE, 'thumb', name + '.jpg'));
            out.push({ name, w: full.width, h: full.height });
            console.log(`  ${name}  ${full.width}x${full.height}  ${Math.round(full.size / 1024)} KB`);
          } catch (e) {
            console.warn(`  skipped ${base}: ${e.message}`);
          }
          zip.readEntry();
        });
      });
      zip.on('end', () => resolve(out.sort((a, b) => a.name.localeCompare(b.name))));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

async function pullPhotos() {
  const url = process.env.DROPBOX_FOLDER_URL;
  if (!url) throw new Error('DROPBOX_FOLDER_URL is not set');
  const key = VERSION + '|' + url;
  const manifestPath = path.join(CACHE, 'manifest.json');
  let cached = null;
  try { cached = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { cached = null; }

  if (cached && cached.key === key && cached.photos.length) {
    console.log(`Using ${cached.photos.length} cached photos`);
  } else {
    await rm(CACHE, { recursive: true, force: true });
    await mkdir(path.join(CACHE, 'full'), { recursive: true });
    await mkdir(path.join(CACHE, 'thumb'), { recursive: true });
    console.log('Downloading the Dropbox folder…');
    const res = await fetch(zipUrl(url), { redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`Dropbox download failed (${res.status})`);
    const zipPath = path.join(CACHE, 'folder.zip');
    await pipeline(Readable.fromWeb(res.body), createWriteStream(zipPath));
    console.log('Resizing photos…');
    const photos = await processZip(zipPath);
    await rm(zipPath, { force: true });
    cached = { key, photos };
    await writeFile(manifestPath, JSON.stringify(cached));
  }

  await mkdir(path.join(OUT, 'images', 'shoot'), { recursive: true });
  await cp(path.join(CACHE, 'full'), path.join(OUT, 'images', 'shoot'), { recursive: true });
  await cp(path.join(CACHE, 'thumb'), path.join(OUT, 'images', 'shoot', 'thumb'), { recursive: true });
  return cached.photos;
}

/*
  Colorway detection. Looks at the middle of each photo (where the outfit is) and counts
  neon yellow-green pixels and pink pixels. A photo is tagged with a color when that color
  clearly dominates; otherwise it's left untagged. Fixes go in config.js (colorOverrides).
*/
const COLOR_RULES = {
  neon: (h, s, v) => h >= 55 && h <= 95 && s >= 0.45 && v >= 0.45,
  pink: (h, s, v) => h >= 285 && h <= 350 && s >= 0.2 && v >= 0.3
};

function toHsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [h, max ? d / max : 0, max];
}

async function colorStats(file) {
  const meta = await sharp(file).metadata();
  const width = Math.round(meta.width * 0.7), height = Math.round(meta.height * 0.8);
  const { data, info } = await sharp(file)
    .extract({ left: Math.round((meta.width - width) / 2), top: Math.round((meta.height - height) / 2), width, height })
    .resize(90, 120, { fit: 'fill' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const counts = {}, sums = {};
  for (const c of Object.keys(COLOR_RULES)) { counts[c] = 0; sums[c] = [0, 0, 0, 0]; }
  let total = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [h, s, v] = toHsv(r / 255, g / 255, b / 255);
    total++;
    for (const c of Object.keys(COLOR_RULES)) {
      if (COLOR_RULES[c](h, s, v)) {
        counts[c]++;
        sums[c][0] += r; sums[c][1] += g; sums[c][2] += b; sums[c][3]++;
        break;
      }
    }
  }
  const share = {};
  for (const c of Object.keys(counts)) share[c] = total ? counts[c] / total : 0;
  return { share, sums };
}

function classify(share) {
  const [a, b] = Object.keys(share).sort((x, y) => share[y] - share[x]);
  if (share[a] >= 0.02 && share[a] >= 3 * share[b]) return a;
  return '';
}

const hex = (n) => Math.round(n).toString(16).padStart(2, '0');

async function tagColors(photos) {
  const swatchSums = {};
  for (const p of photos) {
    try {
      const { share, sums } = await colorStats(path.join(OUT, 'images', 'shoot', 'thumb', p.name + '.jpg'));
      p.color = classify(share);
      for (const c of Object.keys(share)) p[c] = Math.round(share[c] * 1000) / 1000;
      if (p.color) {
        const acc = swatchSums[p.color] || (swatchSums[p.color] = [0, 0, 0, 0]);
        const s = sums[p.color];
        for (let k = 0; k < 4; k++) acc[k] += s[k];
      }
    } catch (e) {
      p.color = '';
      console.warn(`  color check skipped for ${p.name}: ${e.message}`);
    }
  }
  const swatches = {};
  for (const c of Object.keys(swatchSums)) {
    const [r, g, b, n] = swatchSums[c];
    if (n) swatches[c] = '#' + hex(r / n) + hex(g / n) + hex(b / n);
  }
  const tally = {};
  for (const p of photos) tally[p.color || 'untagged'] = (tally[p.color || 'untagged'] || 0) + 1;
  console.log('Colorways found:', JSON.stringify(tally), 'swatches:', JSON.stringify(swatches));
  return swatches;
}

await copySite();
let photos = [];
let swatches = {};
try {
  photos = await pullPhotos();
  swatches = await tagColors(photos);
} catch (e) {
  console.warn(`Photos skipped: ${e.message}`);
}
const photoData = { photos, swatches };
await writeFile(path.join(OUT, 'photos.json'), JSON.stringify(photoData));
// Same data as a script, so pages can use it right away without waiting on a fetch
await writeFile(path.join(OUT, 'photos.js'), 'window.MICHE_PHOTOS = ' + JSON.stringify(photoData) + ';\n');
console.log(`Built the site with ${photos.length} shoot photos.`);
