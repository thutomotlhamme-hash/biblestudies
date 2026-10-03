// Generates public/data/study/atlas.json — the cartographic base of the Bible-wide Atlas.
// Land: Natural Earth 1:50m (public domain) via world-atlas. Lakes and rivers: approximate, drawn for
// this edition. Every place with a location and every journey line is projected here, so the app
// ships no projection code. Places whose location is UNKNOWN are never projected.
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const OUT = process.env.OUT ?? 'public/data';
const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-50m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const { places } = JSON.parse(readFileSync(`${OUT}/study/places.json`, 'utf8'));
const { journeys } = JSON.parse(readFileSync(`${OUT}/study/journeys.json`, 'utf8'));

const W = 3400;
const bbox = { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[-9.5, 12.0], [56.0, 46.5]] } };
const proj = geoMercator().fitWidth(W, bbox);
const [[, y0], [, y1]] = geoPath(proj).bounds(bbox);
const H = Math.round(y1 - y0);
proj.translate([proj.translate()[0], proj.translate()[1] - y0]);
proj.clipExtent([[-50, -50], [W + 50, H + 50]]);
const path = geoPath(proj);
const r = (n) => Math.round(n * 10) / 10;
const pt = ([lon, lat]) => proj([lon, lat]).map(r);
const line = (coords) => coords.map(pt).map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
const poly = (coords) => line(coords) + 'Z';
const round = (d) => d.replace(/(\d+\.\d{2,})/g, (m) => String(r(+m)));

const lakes = {
  galilee: [[35.52, 32.83], [35.55, 32.88], [35.6, 32.9], [35.64, 32.86], [35.65, 32.8], [35.63, 32.74], [35.58, 32.7], [35.55, 32.73], [35.51, 32.78]],
  dead: [[35.47, 31.76], [35.55, 31.77], [35.58, 31.7], [35.59, 31.5], [35.58, 31.3], [35.55, 31.1], [35.45, 31.05], [35.4, 31.15], [35.41, 31.35], [35.44, 31.55], [35.46, 31.7]],
};
const rivers = {
  jordan: [[35.6, 33.25], [35.62, 33.05], [35.61, 32.9]],
  jordanLower: [[35.57, 32.7], [35.575, 32.55], [35.55, 32.4], [35.555, 32.2], [35.53, 32.0], [35.55, 31.85], [35.54, 31.77]],
  nile: [[32.9, 12.0], [32.5, 15.6], [33.9, 17.6], [33.0, 19.5], [30.6, 19.7], [31.2, 21.8], [32.9, 24.1], [32.6, 25.7], [31.8, 26.6], [31.3, 27.4], [30.9, 28.3], [31.0, 29.0], [31.22, 29.8], [31.23, 30.1]],
  rosetta: [[31.23, 30.1], [31.0, 30.4], [30.75, 30.8], [30.55, 31.1], [30.41, 31.45]],
  damietta: [[31.23, 30.1], [31.3, 30.5], [31.4, 30.9], [31.6, 31.2], [31.82, 31.5]],
  euphrates: [[38.3, 37.9], [38.0, 37.2], [38.1, 36.6], [38.3, 36.3], [39.0, 35.95], [39.9, 35.6], [40.5, 35.1], [41.3, 34.4], [42.0, 34.2], [42.8, 33.8], [43.5, 33.3], [44.2, 32.6], [44.9, 31.9], [45.6, 31.4], [46.4, 31.0], [47.0, 30.95], [47.6, 30.5]],
  tigris: [[40.2, 37.95], [42.2, 37.3], [42.7, 36.6], [43.2, 36.3], [43.5, 35.5], [43.8, 34.6], [44.4, 33.4], [45.3, 32.6], [46.1, 31.7], [47.0, 31.0], [47.6, 30.5]],
  orontes: [[36.4, 34.3], [36.6, 34.9], [36.5, 35.4], [36.4, 35.8], [36.3, 36.1], [36.0, 36.2]],
  tiber: [[12.9, 42.6], [12.6, 42.2], [12.47, 41.9], [12.25, 41.74]],
};
// Region labels use names found in the KJV text.
const labels = [
  { text: 'THE GREAT SEA', at: [19.5, 34.3], kind: 'sea' },
  { text: 'Red sea', at: [37.6, 21.0], kind: 'water' },
  { text: 'CANAAN', at: [34.62, 31.95], kind: 'region-minor' },
  { text: 'EGYPT', at: [29.6, 26.6], kind: 'region' },
  { text: 'ETHIOPIA', at: [32.5, 17.0], kind: 'region' },
  { text: 'MESOPOTAMIA', at: [41.6, 35.3], kind: 'region' },
  { text: 'CHALDEA', at: [45.3, 30.6], kind: 'region-minor' },
  { text: 'ARABIA', at: [42.0, 26.5], kind: 'region' },
  { text: 'SINAI', at: [33.6, 29.5], kind: 'region-minor' },
  { text: 'PERSIA', at: [52.0, 31.0], kind: 'region' },
  { text: 'MEDIA', at: [49.5, 35.8], kind: 'region-minor' },
  { text: 'ASSYRIA', at: [43.6, 37.2], kind: 'region-minor' },
  { text: 'SYRIA', at: [37.6, 34.3], kind: 'region-minor' },
  { text: 'CILICIA', at: [34.6, 37.4], kind: 'region-minor' },
  { text: 'GALATIA', at: [32.6, 39.6], kind: 'region-minor' },
  { text: 'CAPPADOCIA', at: [35.5, 38.8], kind: 'region-minor' },
  { text: 'ASIA', at: [28.4, 38.9], kind: 'region' },
  { text: 'MACEDONIA', at: [22.2, 40.9], kind: 'region-minor' },
  { text: 'ACHAIA', at: [22.0, 37.8], kind: 'region-minor' },
  { text: 'ITALY', at: [14.5, 41.8], kind: 'region' },
  { text: 'CRETE', at: [24.8, 35.55], kind: 'region-minor' },
  { text: 'CYPRUS', at: [33.1, 35.4], kind: 'region-minor' },
  { text: 'MOAB', at: [35.95, 31.25], kind: 'region-minor' },
  { text: 'GALILEE', at: [35.25, 33.0], kind: 'region-minor' },
  { text: 'JUDÆA', at: [34.85, 31.35], kind: 'region-minor' },
  { text: 'Salt Sea', at: [35.75, 31.45], kind: 'water' },
  { text: 'Sea of Galilee', at: [35.95, 32.82], kind: 'water' },
  { text: 'Jordan', at: [35.72, 32.25], kind: 'water' },
  { text: 'Nile', at: [31.6, 27.9], kind: 'water' },
  { text: 'Euphrates', at: [40.1, 35.25], kind: 'water' },
  { text: 'Tigris', at: [43.9, 35.0], kind: 'water' },
];
const grat = [];
for (let lon = -8; lon <= 56; lon += 2) grat.push(line([[lon, 11.5], [lon, 47.0]]));
for (let lat = 12; lat <= 46; lat += 2) grat.push(line([[-10, lat], [57, lat]]));

const P = {};
const alts = {};
for (const p of places) {
  if (p.lon == null || p.certainty === 'UNKNOWN') continue;
  P[p.id] = pt([p.lon, p.lat]);
  if (p.certainty === 'DISPUTED' && p.alternatives?.length) alts[p.id] = p.alternatives.map((a) => pt([a.lon, a.lat]));
}
const segments = {};
const problems = [];
for (const j of journeys) for (const s of j.segments) {
  const ll = (id) => { const p = places.find((x) => x.id === id); return p && p.lon != null && p.certainty !== 'UNKNOWN' ? [p.lon, p.lat] : null; };
  const coords = s.path ?? [ll(s.from), ll(s.to)];
  if (coords.some((c) => !c)) { problems.push(`${j.id}/${s.id}: ${s.from}→${s.to} has an unplaced end`); continue; }
  segments[s.id] = { d: line(coords), start: pt(coords[0]), end: pt(coords.at(-1)) };
}

const out = {
  width: W, height: H,
  attribution: 'Coastlines: Natural Earth 1:50m (public domain). Place locations: OpenBible.info (CC BY 4.0). Lakes, rivers and routes: approximate, drawn for this edition.',
  land: round(path(land)),
  lakes: Object.fromEntries(Object.entries(lakes).map(([k, v]) => [k, poly(v)])),
  rivers: Object.fromEntries(Object.entries(rivers).map(([k, v]) => [k, line(v)])),
  graticule: grat,
  labels: labels.map((l) => ({ ...l, xy: pt(l.at) })),
  places: P,
  alternatives: alts,
  segments,
};
writeFileSync(`${OUT}/study/atlas.json`, JSON.stringify(out));
console.log('atlas.json', (JSON.stringify(out).length / 1024).toFixed(1), 'KB', W, 'x', H, Object.keys(P).length, 'places', Object.keys(segments).length, 'segments');
if (problems.length) console.log('Segments not drawn (an end has no location):\n  ' + problems.join('\n  '));
