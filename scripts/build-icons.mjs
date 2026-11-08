#!/usr/bin/env node
/**
 * Builds the map marker images in public/markers and shrinks the source icons
 * in public/icons.
 *
 * The map draws app markers as one MapLibre symbol layer instead of a DOM
 * element per app, so each marker is a single PNG: the app artwork inside its
 * accent tile on the same light rounded chip the page used to render as a
 * Material FAB. The 512 px source icons are far too large for a 32 px slot, so
 * the copies under public/icons are resized as well (the panel keeps using
 * them).
 *
 * Artwork comes from the icon record: either a PNG referenced as
 * `<image href="/icons/<file>.png">` or inline SVG markup, which is rasterised.
 * The accent colour is the app's coverage style accent (or fill), the same
 * value the panel uses.
 *
 * This is lossy and meant to run on full-resolution sources: running it twice
 * re-encodes the already-shrunk icons. Keep pristine originals outside
 * public/icons if you may need them later.
 *
 * Usage:
 *   node scripts/build-icons.mjs [--icon-size=128] [--marker-size=128]
 */
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';
import markerGeometry from './marker-geometry.json' with { type: 'json' };

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const contentRoot = join(projectRoot, 'src', 'content');
const markersDir = join(projectRoot, 'public', 'markers');

const options = { iconSize: 128 };
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--icon-size=')) options.iconSize = Number(arg.slice('--icon-size='.length));
}

/*
 * Marker geometry, in CSS pixels. The same file is read by the runtime label
 * drawing (src/scripts/map/markers.ts), so the two never drift apart.
 */
const geometry = markerGeometry;
const scale = 2;
const pad = geometry.margin * scale;
const chip = geometry.height * scale;
const chipRadius = geometry.radius * scale;
const tile = geometry.tile * scale;
const tileRadius = geometry.tileRadius * scale;
const artwork = geometry.artwork * scale;
const markerSize = geometry.height * scale + pad * 2;
const shadowOffset = geometry.shadowOffsetY * scale;
const centred = (size) => Math.round((markerSize - size) / 2);

const pngOptions = { compressionLevel: 9, palette: true, colours: 256 };
const chipColor = '#ECE6F0';

const collect = async (dir, suffix) => {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(path, suffix)));
    else if (entry.name.endsWith(suffix)) files.push(path);
  }
  return files;
};

const readRecords = async (collection) => {
  const records = [];
  for (const file of await collect(join(contentRoot, collection), '.yaml')) {
    records.push({ file, data: parseYaml(await readFile(file, 'utf8')) });
  }
  return records;
};

const roundedRect = (size, radius, fill, yOffset = 0) =>
  `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
     <rect x="${centred(chip)}" y="${centred(chip) + yOffset}" width="${chip}" height="${chip}"
       rx="${radius}" ry="${radius}" fill="${fill}" />
   </svg>`;

/** Icon artwork as a PNG buffer: a referenced file or rasterised inline SVG. */
const artworkBuffer = async (icon) => {
  if (icon.png && existsSync(icon.png)) {
    return sharp(await readFile(icon.png))
      .resize(artwork, artwork, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }
  const document = `<svg width="${artwork}" height="${artwork}" viewBox="${icon.viewBox}"
    xmlns="http://www.w3.org/2000/svg">${icon.svg}</svg>`;
  return sharp(Buffer.from(document)).png().toBuffer();
};

const buildMarker = async (icon, accent) => {
  const shadow = await sharp(Buffer.from(roundedRect(markerSize, chipRadius, 'rgba(0, 0, 0, 0.30)', shadowOffset)))
    .blur(geometry.shadowBlur)
    .png()
    .toBuffer();
  const chipLayer = await sharp(Buffer.from(roundedRect(markerSize, chipRadius, chipColor))).png().toBuffer();
  const tileLayer = await sharp(
    Buffer.from(
      `<svg width="${markerSize}" height="${markerSize}" xmlns="http://www.w3.org/2000/svg">
         <rect x="${centred(tile)}" y="${centred(tile)}" width="${tile}" height="${tile}"
           rx="${tileRadius}" ry="${tileRadius}" fill="${accent}" />
       </svg>`,
    ),
  )
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: markerSize,
      height: markerSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadow, top: 0, left: 0 },
      { input: chipLayer, top: 0, left: 0 },
      { input: tileLayer, top: 0, left: 0 },
      { input: await artworkBuffer(icon), top: centred(artwork), left: centred(artwork) },
    ])
    .png(pngOptions)
    .toBuffer();
};

const icons = new Map();
for (const { data } of await readRecords('icons')) {
  const href = /<image[^>]*href="([^"]+)"/.exec(data.svg ?? '');
  icons.set(String(data.id), {
    viewBox: data.view_box ?? '0 0 48 48',
    svg: data.svg ?? '',
    png: href ? join(projectRoot, 'public', href[1].replace(/^\//, '')) : null,
  });
}

const maps = await readRecords('maps');
const fallbackAccent = maps.find(({ data }) => data.id === 'all-countries')?.data.theme?.accent ?? '#6750A4';

const accents = new Map();
const coverages = (await readRecords('coverage'))
  .map(({ data }) => data)
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
for (const coverage of coverages) {
  if (!accents.has(coverage.app_id)) {
    accents.set(coverage.app_id, coverage.style?.accent ?? coverage.style?.fill_color ?? fallbackAccent);
  }
}

await rm(markersDir, { recursive: true, force: true });
await mkdir(markersDir, { recursive: true });

let markers = 0;
let markerBytes = 0;
let failures = 0;

for (const { file, data } of await readRecords('apps')) {
  if (!data.marker) continue;
  const icon = icons.get(String(data.icon_id ?? 'pin')) ?? icons.get('pin');
  if (!icon) {
    failures += 1;
    console.error(`  ${relative(projectRoot, file)} FAILED: no icon record for "${data.icon_id}"`);
    continue;
  }
  try {
    const marker = await buildMarker(icon, accents.get(data.id) ?? fallbackAccent);
    await writeFile(join(markersDir, `${data.id}.png`), marker);
    markers += 1;
    markerBytes += marker.length;
  } catch (error) {
    failures += 1;
    console.error(`  ${relative(projectRoot, file)} FAILED: ${error.message}`);
  }
}

let iconsBefore = 0;
let iconsAfter = 0;
const shrunk = new Set();
for (const icon of icons.values()) {
  if (!icon.png || shrunk.has(icon.png) || !existsSync(icon.png)) continue;
  shrunk.add(icon.png);
  const before = (await stat(icon.png)).size;
  const shrunkIcon = await sharp(await readFile(icon.png))
    .resize(options.iconSize, options.iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png(pngOptions)
    .toBuffer();
  await writeFile(icon.png, shrunkIcon);
  iconsBefore += before;
  iconsAfter += shrunkIcon.length;
}

const kb = (bytes) => (bytes / 1024).toFixed(0).padStart(6);
console.log(`markers: ${markers} files      ${kb(markerBytes)} KB (new)`);
console.log(`icons  : ${shrunk.size} files  ${kb(iconsBefore)} KB -> ${kb(iconsAfter)} KB`);
if (failures) process.exitCode = 1;
