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
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      const out = [];
      zip.on('entry', (entry) => {
        const base = path.basename(entry.fileName);
        const isImage = /\.(jpe?g|png|webp|heic)$/i.test(base);
        if (entry.fileName.endsWith('/') || base.startsWith('._') || entry.fileName.includes('__MACOSX') || !isImage) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, async (err2, stream) => {
          if (err2) return reject(err2);
          try {
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buf = Buffer.concat(chunks);
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

await copySite();
let photos = [];
try {
  photos = await pullPhotos();
} catch (e) {
  console.warn(`Photos skipped: ${e.message}`);
}
await writeFile(path.join(OUT, 'photos.json'), JSON.stringify({ photos }));
console.log(`Built the site with ${photos.length} shoot photos.`);
