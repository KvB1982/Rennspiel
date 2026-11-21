// Rennspiel – zeichnet die Ideallinie einer Strecke von oben (zum Ansehen beim Einstellen).
//   node tools/linie.mjs kueste          schreibt tools/linie.svg (Strecke grau, Linie: rot = langsam, grün = schnell)
//   node tools/linie.mjs kueste 1200 600 nur der Ausschnitt ab Meter 1200, 600 m lang (groß gezeichnet)
// Dazu die Plan-Rundenzeit: so lange braucht ein Auto, das genau auf der Linie und immer am Limit fährt.
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { ideallinie } from '../js/ki.js';
import { AUTOS } from '../js/physik.js';
import '../js/supercars.js';
import { writeFileSync } from 'node:fs';

const [id = 'kueste', ab = null, lang = null] = process.argv.slice(2);
const def = STRECKEN.find(s => s.id === id);
if (!def) { console.log('Strecken:', STRECKEN.map(s => s.id).join(', ')); process.exit(1); }
const T = baueStrecke(def);
const p = def.strasse ? AUTOS.falkner || Object.values(AUTOS).find(a => a.super) : def.modell ? AUTOS.modell : AUTOS.f1;
const L = ideallinie(T, p, { rechts: false });
let zeit = 0; for (let i = 0; i < T.n; i++) zeit += T.ds / Math.max(L.tempo[i], 0.01);
const i0 = ab === null ? 0 : T.index(+ab), i1 = ab === null ? T.n : i0 + Math.round(+lang / T.ds);
let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
for (let k = i0; k < i1; k++) { const i = k % T.n; minx = Math.min(minx, T.x[i]); maxx = Math.max(maxx, T.x[i]); minz = Math.min(minz, T.z[i]); maxz = Math.max(maxz, T.z[i]); }
const rand = T.hb[0] * 3, W = 1500, sc = (W - 40) / Math.max(maxx - minx + 2 * rand, (maxz - minz + 2 * rand) * 1.6);
const H = Math.round((maxz - minz + 2 * rand) * sc + 40);
const X = x => (20 + (x - minx + rand) * sc).toFixed(1), Z = z => (20 + (z - minz + rand) * sc).toFixed(1);
let links = '', rechts = '', svg = '';
for (let k = i0; k <= i1; k++) {
  const i = k % T.n;
  links += (k === i0 ? 'M' : 'L') + X(T.x[i] + T.tz[i] * T.hb[i]) + ',' + Z(T.z[i] - T.tx[i] * T.hb[i]);
  rechts = 'L' + X(T.x[i] - T.tz[i] * T.hb[i]) + ',' + Z(T.z[i] + T.tx[i] * T.hb[i]) + rechts;
}
svg += `<path d="${links}${rechts}Z" fill="#555"/>`;
const vMax = Math.max(...L.tempo), vMin = Math.min(...L.tempo);
for (let k = i0; k < i1; k++) {
  const i = k % T.n, j = (i + 1) % T.n, f = (L.tempo[i] - vMin) / Math.max(1e-6, vMax - vMin);
  svg += `<line x1="${X(L.lx[i])}" y1="${Z(L.lz[i])}" x2="${X(L.lx[j])}" y2="${Z(L.lz[j])}" stroke="hsl(${Math.round(f * 120)},95%,55%)" stroke-width="${Math.max(1.5, 1.2 * sc)}" stroke-linecap="round"/>`;
}
svg += `<circle cx="${X(T.x[i0 % T.n])}" cy="${Z(T.z[i0 % T.n])}" r="6" fill="#fff"/>`;
writeFileSync(new URL('./linie.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#2c6b2f">${svg}</svg>`);
const min = Math.floor(zeit / 60);
console.log(`${def.name}: Plan-Runde ${min}:${(zeit - min * 60).toFixed(3).padStart(6, '0')}, langsamste Stelle ${(vMin * 3.6 * (def.modell ? 30 : 1)).toFixed(0)} km/h`);
