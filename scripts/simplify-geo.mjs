#!/usr/bin/env node
/**
 * Simplifies every GeoJSON file under public/geo in place, using mapshaper.
 *
 * The map draws every service area, so trimming vertices (weighted method,
 * 85% removed) and rounding coordinates to five decimals cuts download size,
 * parse time and paint cost to about a tenth of the original.
 *
 * This is lossy and meant to run on full-resolution sources: running it a
 * second time simplifies the already-simplified file again. Keep pristine
 * originals outside public/geo if you may need them later; small islets
 * (roughly under a square kilometre) can disappear.
 *
 * Feature ids and properties are preserved, so geometry_refs that select a
 * feature by "#fragment" keep working. Extra top-level keys in the source
 * file (for example "metadata") are copied onto the output.
 *
 * Usage:
 *   node scripts/simplify-geo.mjs [dir] [--percent=15] [--precision=0.00001]
 */
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const options = {
  dir: join(projectRoot, 'public', 'geo'),
  percent: 15,
  precision: 0.00001,
};

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--percent=')) options.percent = Number(arg.slice('--percent='.length));
  else if (arg.startsWith('--precision=')) options.precision = Number(arg.slice('--precision='.length));
  else options.dir = isAbsolute(arg) ? arg : join(projectRoot, arg);
}

const collect = async (dir) => {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(path)));
    else if (entry.name.endsWith('.geojson') && !entry.name.endsWith('.tmp.geojson')) {
      files.push(path);
    }
  }
  return files;
};

const toCommandPath = (path) => path.replaceAll('\\', '/');

const simplifyFile = async (file) => {
  const source = JSON.parse(await readFile(file, 'utf8'));
  const sizeBefore = (await stat(file)).size;
  const target = `${file}.tmp.geojson`;

  await mapshaper.runCommands(
    `-i "${toCommandPath(file)}" -simplify weighted ${options.percent}% -o "${toCommandPath(target)}" ` +
      `geojson-type=FeatureCollection precision=${options.precision}`,
  );

  const output = JSON.parse(await readFile(target, 'utf8'));
  for (const key of Object.keys(source)) {
    if (key !== 'type' && key !== 'features') output[key] = source[key];
  }
  await writeFile(file, `${JSON.stringify(output)}\n`);
  await rm(target);

  return { sizeBefore, sizeAfter: (await stat(file)).size };
};

const files = (await collect(options.dir)).sort();
console.log(
  `Simplifying ${files.length} file(s) in ${relative(projectRoot, options.dir) || '.'} ` +
    `(percent=${options.percent}, precision=${options.precision})`,
);

let totalBefore = 0;
let totalAfter = 0;
let failures = 0;

for (const file of files) {
  try {
    const { sizeBefore, sizeAfter } = await simplifyFile(file);
    totalBefore += sizeBefore;
    totalAfter += sizeAfter;
    const saved = sizeBefore ? Math.round((1 - sizeAfter / sizeBefore) * 100) : 0;
    console.log(
      `  ${relative(projectRoot, file).padEnd(64)} ` +
        `${(sizeBefore / 1024).toFixed(1)} KB -> ${(sizeAfter / 1024).toFixed(1)} KB (-${saved}%)`,
    );
  } catch (error) {
    failures += 1;
    console.error(`  ${relative(projectRoot, file)} FAILED: ${error.message}`);
  }
}

console.log(
  `Total: ${(totalBefore / 1024).toFixed(1)} KB -> ${(totalAfter / 1024).toFixed(1)} KB ` +
    `(-${totalBefore ? Math.round((1 - totalAfter / totalBefore) * 100) : 0}%)`,
);
if (failures) process.exitCode = 1;
