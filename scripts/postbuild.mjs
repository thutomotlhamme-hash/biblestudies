// Writes the list of every exported file into out/sw.js so the whole journey works offline,
// and (for RELATIVE_ASSETS builds) makes CSS font URLs relative.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const OUT = 'out';
import { createHash } from 'node:crypto';
/** Data cache version: changes only when a data file changes, so kept books survive app updates. */
function dataVersion() {
  const h = createHash('sha256');
  for (const f of walk(join(OUT, 'data')).sort()) h.update(f + statSync(f).size + readFileSync(f).subarray(0, 4096).toString('base64'));
  return h.digest('hex').slice(0, 12);
}
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(OUT)
  .map((f) => relative(OUT, f).split('\\').join('/'))
  // The app shell is precached; Scripture and study data (data/) are cached as they are read,
  // or all at once when the reader chooses "Keep the whole Bible offline".
  .filter((f) => f !== 'sw.js' && !f.endsWith('.txt') && !f.startsWith('404') && !f.includes('_not-found') && !f.startsWith('data/'))
  .map((f) => './' + f.replace(/(^|\/)index\.html$/, '$1'));
const sw = readFileSync(join(OUT, 'sw.js'), 'utf8')
  .replace(/\/\*__PRECACHE__\*\/ \[[^\]]*\]/, JSON.stringify(['./', ...files.filter((f) => f !== './')]))
  .replace('__BUILD__', String(Date.now()))
  .replace('__DATA__', dataVersion());
writeFileSync(join(OUT, 'sw.js'), sw);
if (process.env.RELATIVE_ASSETS) {
  const css = join(OUT, '_next/static/css');
  for (const f of readdirSync(css)) {
    const p = join(css, f);
    writeFileSync(p, readFileSync(p, 'utf8').replace(/url\((?:\.\/)?_next\/static\/media\//g, 'url(../media/'));
  }
}
console.log(`postbuild: ${files.length} files precached`);
