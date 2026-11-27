// Rennspiel – prüft Stimmen und Geräusche ohne Browser:
//  - Jede Ansage, die der Beifahrer auf irgendeiner Wertungsprüfung sagen kann, hat ihre Aufnahme.
//  - Jede Ansage des Streckensprechers hat ihre Aufnahme.
//  - Jedes Auto hat seine Motor-Schleifen, jedes Geräusch aus js/klang.js seine Datei.
//   node tools/stimmen.mjs          prüfen
//   node tools/stimmen.mjs laut     dazu die ersten Ansagen jeder Prüfung zeigen
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { Etappe, BEIFAHRER_WORTE } from '../js/rallye.js';
import { SPRECHER_WORTE } from '../js/klang.js';
import { SUPERCARS } from '../js/supercars.js';
import { RALLYEAUTOS } from '../js/rallyeautos.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const laut = process.argv.includes('laut');
let fehler = 0;
const fehlt = (was) => { console.log('  FEHLT:', was); fehler++; };
const da = pfad => existsSync(join(root, pfad));

// Beifahrer: alle Prüfungen durchgehen und jedes Wort sammeln
const gebraucht = new Set(['z5', 'z4', 'z3', 'z2', 'z1', 'los', 'zwischenzeit_gut', 'zwischenzeit_schlecht', 'strafe', 'im_ziel']);
for (const def of STRECKEN.filter(s => s.rallye)) {
  const R = new Etappe(baueStrecke(def), { auto: 'sturmfalke', staerke: 'mittel', nr: 0 });
  let n = 0;
  for (const g of R.gruppen) { n += g.worte.length; for (const w of g.worte) gebraucht.add(w); if (!g.worte.length) fehlt(def.id + ': Ansage ohne Aufnahme „' + g.sprache + '“'); }
  console.log(`${def.id}: ${R.gruppen.length} Ansagen, ${n} Aufnahmen hintereinander`);
  if (laut) for (const g of R.gruppen.slice(0, 6)) console.log('   ', g.sprache, '→', g.worte.join(' + '));
}
for (const w of gebraucht) { if (!BEIFAHRER_WORTE.includes(w)) fehlt('„' + w + '“ steht nicht in BEIFAHRER_WORTE'); }
for (const w of BEIFAHRER_WORTE) if (!da(`sounds/stimme/beifahrer/${w}.mp3`)) fehlt(`sounds/stimme/beifahrer/${w}.mp3`);
for (const w of SPRECHER_WORTE) if (!da(`sounds/stimme/sprecher/${w}.mp3`)) fehlt(`sounds/stimme/sprecher/${w}.mp3`);
console.log(`Beifahrer: ${BEIFAHRER_WORTE.length} Aufnahmen (${gebraucht.size} davon kommen auf den Prüfungen vor), Streckensprecher: ${SPRECHER_WORTE.length}`);

// Ansagen im Rennen: Jeder Name, der in rennen.js oder rallye.js bei melden(…) steht, muss in einer der Listen sein
for (const [datei, liste] of [['js/rennen.js', SPRECHER_WORTE], ['js/rallye.js', BEIFAHRER_WORTE]]) {
  const text = readFileSync(join(root, datei), 'utf8');
  for (const zeile of text.split('\n').filter(z => z.includes('this.melden('))) {
    for (const m of zeile.matchAll(/'([a-z_0-9]+)'\]/g)) if (!liste.includes(m[1])) fehlt(`${datei}: „${m[1]}“ ist nicht in der Liste`);
  }
}

// Motoren und Geräusche: die Tabellen aus klang.js lesen (als Text, weil sie nicht nach außen gegeben werden)
const klang = readFileSync(join(root, 'js/klang.js'), 'utf8');
const autos = ['f1', 'modell', 'drift', 'slot', ...SUPERCARS.map(s => s.id), ...RALLYEAUTOS.map(s => s.id)];
for (const a of autos) {
  if (!new RegExp(`\\n  ${a}: `).test(klang)) { fehlt('Auto ohne Motor in MOTOREN: ' + a); continue; }
  const m = klang.match(new RegExp(`\\n  ${a}: (M\\('(\\w+)'\\)|\\['([^']+)'\\])`));
  const dateien = m[2] ? [`sounds/motor/${m[2]}_tief.wav`, `sounds/motor/${m[2]}_hoch.wav`] : [m[3]];
  for (const d of dateien) if (!da(d)) fehlt(d);
}
const dateien = [...klang.matchAll(/'(sounds\/[a-z_]+\.(?:wav|mp3))'/g)].map(m => m[1]);
for (const d of dateien) if (!da(d)) fehlt(d);
const groesse = ordner => readdirSync(join(root, ordner), { recursive: true, withFileTypes: true }).filter(f => f.isFile()).reduce((s, f) => s + readFileSync(join(f.parentPath ?? f.path, f.name)).length, 0);
console.log(`Motoren: ${autos.length} Autos, Geräusche: ${dateien.length} Dateien, Ordner sounds/ zusammen ${(groesse('sounds') / 1e6).toFixed(1)} MB`);
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles da.');
process.exit(fehler ? 1 : 0);
