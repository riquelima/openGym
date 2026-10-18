#!/usr/bin/env node
/**
 * Build a single SVG sprite from bryllim/workout-guide exercise SVGs.
 *
 * Input : src/components/fitness-icons/src-assets/<slug>/frame-1.svg
 * Output: src/components/fitness-icons/fitness-icons.svg
 *         src/components/fitness-icons/fitness-icons.json (metadata)
 *         public/fitness-icons.svg (copy served at BASE_URL)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { optimize } = require('svgo');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/components/fitness-icons/src-assets');
const OUT_SVG = path.join(ROOT, 'src/components/fitness-icons/fitness-icons.svg');
const OUT_JSON = path.join(ROOT, 'src/components/fitness-icons/fitness-icons.json');
const OUT_PUBLIC = path.join(ROOT, 'public/fitness-icons.svg');

// svgo defaults except: keep symbol ids (we look them up via <use href="#ex-…">)
// and keep the host <svg> wrapper (we patch it to add a placeholder viewBox so
// svgo's "empty container" heuristics don't drop it).
const SVGO_CFG = {
  multipass: true,
  floatsPrecision: 1,
  plugins: [
    'removeXMLNS',
    'cleanupNumericValues',
    'convertPathData',
    'convertColors',
    'removeDimensions',
    'removeComments',
  ],
  js2svg: { indent: 0, pretty: false },
};

function extractPaths(svg) {
  // Workout-guide SVGs may use a single <path> or multiple. We want them all.
  const re = /<path\b[^>]*\bd="([^"]+)"[^>]*>/g;
  const out = [];
  let m;
  while ((m = re.exec(svg)) !== null) out.push(m[1]);
  return out;
}

function buildSymbol(slug, paths) {
  const body = paths
    .map(d => `<path d="${d.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>`)
    .join('');
  return `<symbol id="ex-${slug}" viewBox="0 0 512 512" fill="currentColor" fill-rule="evenodd">${body}</symbol>`;
}

async function main() {
  const dirs = (await fs.readdir(SRC, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const symbols = [];
  const meta = [];
  let skipped = 0;

  for (const slug of dirs) {
    const file = path.join(SRC, slug, 'frame-1.svg');
    let raw;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch {
      skipped += 1;
      continue;
    }
    try {
      const ds = extractPaths(raw);
      if (!ds.length) throw new Error('no <path d=…> found');
      symbols.push(buildSymbol(slug, ds));
      meta.push(slug);
    } catch (err) {
      console.warn(`skip ${slug}: ${err.message}`);
      skipped += 1;
    }
  }

  const rawSprite =
    `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">` +
    `<defs>${symbols.join('')}</defs>` +
    `</svg>`;

  const optimized = optimize(rawSprite, { ...SVGO_CFG, path: 'sprite.svg' }).data;

  await fs.writeFile(OUT_SVG, optimized, 'utf8');
  await fs.copyFile(OUT_SVG, OUT_PUBLIC);
  await fs.writeFile(OUT_JSON, JSON.stringify({ slugs: meta }, null, 2) + '\n', 'utf8');

  const sizeSvg = (await fs.stat(OUT_SVG)).size;
  console.log(`Generated ${symbols.length} symbols (skipped ${skipped})`);
  console.log(`Sprite: ${OUT_SVG} (${(sizeSvg / 1024).toFixed(1)} KB)`);
  console.log(`Public : ${OUT_PUBLIC}`);
  console.log(`Meta  : ${OUT_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});