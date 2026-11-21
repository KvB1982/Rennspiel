// Rennspiel – zeichnet alle Strecken von oben als SVG (zum Ansehen beim Bauen) und prüft, ob sie sich selbst berühren.
//   node tools/karte.mjs            schreibt tools/karten.svg
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke, selbstBeruehrung } from '../js/strecke.js';
import { writeFileSync } from 'node:fs';

let svg = '', ox = 0;
for (const def of STRECKEN) {
  const T = baueStrecke(def);
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (let i = 0; i < T.n; i++) { minx = Math.min(minx, T.x[i]); maxx = Math.max(maxx, T.x[i]); minz = Math.min(minz, T.z[i]); maxz = Math.max(maxz, T.z[i]); }
  const w = maxx - minx, h = maxz - minz, sc = 380 / Math.max(w, h);
  const P = i => `${(ox + 10 + (T.x[i] - minx) * sc).toFixed(1)},${(10 + (T.z[i] - minz) * sc).toFixed(1)}`;
  let d = 'M' + P(0); for (let i = 1; i < T.n; i++) d += 'L' + P(i); d += 'Z';
  svg += `<path d="${d}" fill="none" stroke="#333" stroke-width="${Math.max(1, T.hb[0] * 2 * sc)}"/>`;
  svg += `<circle cx="${P(0).split(',')[0]}" cy="${P(0).split(',')[1]}" r="5" fill="red"/>`;
  const q = Math.round(T.n * 0.03);
  svg += `<circle cx="${P(q).split(',')[0]}" cy="${P(q).split(',')[1]}" r="3" fill="blue"/>`;
  svg += `<text x="${ox + 10}" y="415" font-size="13">${def.name}: ${Math.round(T.laenge)} m</text>`;
  const sb = selbstBeruehrung(T);
  let ymin = Infinity, ymax = -Infinity; for (let i = 0; i < T.n; i++) { ymin = Math.min(ymin, T.y[i]); ymax = Math.max(ymax, T.y[i]); }
  console.log(def.name.padEnd(24), 'Länge', Math.round(T.laenge * 100) / 100, 'm  freie Geraden', T.freiL.map(v => Math.round(v * 100) / 100).join(', '),
    ' kleinster Abstand zu sich selbst', sb.abstand.toFixed(2), 'm bei', Math.round(T.s[sb.wo] || 0), ' Höhe', ymin.toFixed(1), '…', ymax.toFixed(1));
  ox += 410;
}
writeFileSync(new URL('./karten.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" width="${ox}" height="430" style="background:#fff">${svg}</svg>`);
