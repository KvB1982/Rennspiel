// Rennspiel – den Stand der Fahrphysik festhalten und später damit vergleichen.
//
// Kristian hat am 22.11.2026 gesagt: So wie Formel-Rennwagen, Supercars und Rallyeautos jetzt fahren, macht es Spaß –
// das ist der bisher beste Stand. Damit man ihn nie verliert, schreibt dieses Werkzeug alle Zahlen der Fahrphysik
// in eine Datei (docs/fahrstand/<name>.json) und merkt sich einen Fingerabdruck der Dateien mit der Rechnung.
//
//   node tools/fahrstand.mjs                  vergleicht den Code von jetzt mit dem besten Stand (BESTER unten)
//   node tools/fahrstand.mjs <name>           vergleicht mit docs/fahrstand/<name>.json
//   node tools/fahrstand.mjs sichern <name>   hält den Stand von jetzt unter einem neuen Namen fest
//
// Wie man einen alten Stand zurückholt, steht in docs/fahrphysik.md.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { AUTOS } from '../js/physik.js';
import { VOLL } from '../js/neigung.js';

export const BESTER = 'bester_2026-11-22';   // der bisher beste Stand (bei einem neuen besten Stand hier den Namen ändern)

// In diesen Dateien steckt, wie gelenkt und gefahren wird (Rechnung und Zahlen)
const DATEIEN = ['js/physik.js', 'js/supercars.js', 'js/rallyeautos.js', 'js/ki.js', 'js/neigung.js', 'js/eingabe.js', 'js/strecke.js'];
const wurzel = new URL('..', import.meta.url);
const pfad = name => new URL(`docs/fahrstand/${name}.json`, wurzel);

// Der Stand von jetzt: alle Zahlen der großen Autos (Rennwagen, Supercars, Rallyeautos) und die Fingerabdrücke
function jetzt() {
  const autos = {};
  for (const [id, p] of Object.entries(AUTOS)) if (id === 'f1' || p.super) autos[id] = JSON.parse(JSON.stringify(p));
  const dateien = {};
  for (const d of DATEIEN) dateien[d] = createHash('sha256').update(readFileSync(new URL(d, wurzel))).digest('hex').slice(0, 16);
  let commit = '';
  try { commit = execSync('git rev-parse HEAD', { cwd: wurzel, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* ohne git geht es auch */ }
  return { datum: new Date().toISOString().slice(0, 10), commit, neigenVoll: VOLL, autos, dateien };
}

// Zwei Stände vergleichen: liefert Zeilen wie "falkner.arcade.frei: 0.14 → 0.2"
function unterschiede(alt, neu, wo = '') {
  const zeilen = [];
  const schluessel = new Set([...Object.keys(alt || {}), ...Object.keys(neu || {})]);
  for (const k of schluessel) {
    const a = alt?.[k], n = neu?.[k], name = wo ? wo + '.' + k : k;
    if (a && n && typeof a === 'object' && typeof n === 'object') zeilen.push(...unterschiede(a, n, name));
    else if (JSON.stringify(a) !== JSON.stringify(n)) zeilen.push(`  ${name}: ${JSON.stringify(a)} → ${JSON.stringify(n)}`);
  }
  return zeilen;
}

const [befehl, name] = process.argv.slice(2);
if (befehl === 'sichern') {
  if (!name) { console.log('Bitte einen Namen angeben: node tools/fahrstand.mjs sichern <name>'); process.exit(1); }
  if (existsSync(pfad(name))) { console.log(`docs/fahrstand/${name}.json gibt es schon – bitte einen anderen Namen nehmen (ein festgehaltener Stand wird nie überschrieben).`); process.exit(1); }
  writeFileSync(pfad(name), JSON.stringify(jetzt(), null, 1) + '\n');
  console.log(`Festgehalten: docs/fahrstand/${name}.json`);
} else {
  const wen = befehl || BESTER;
  if (!existsSync(pfad(wen))) { console.log(`docs/fahrstand/${wen}.json gibt es nicht.`); process.exit(1); }
  const alt = JSON.parse(readFileSync(pfad(wen))), neu = jetzt();
  console.log(`Vergleich mit „${wen}“ (festgehalten am ${alt.datum}, Commit ${alt.commit.slice(0, 7)})`);
  const zahlen = [...unterschiede(alt.autos, neu.autos), ...unterschiede({ neigenVoll: alt.neigenVoll }, { neigenVoll: neu.neigenVoll })];
  console.log(zahlen.length ? `\nGeänderte Zahlen (${zahlen.length}):\n` + zahlen.join('\n') : '\nAlle Zahlen der Autos sind gleich.');
  const anders = DATEIEN.filter(d => alt.dateien[d] !== neu.dateien[d]);
  console.log(anders.length ? `\nDiese Dateien mit der Rechnung sind nicht mehr dieselben:\n  ${anders.join('\n  ')}\n  Ansehen: git diff ${alt.commit.slice(0, 7)} -- ${anders.join(' ')}`
    : '\nAlle Dateien mit der Rechnung sind unverändert.');
  if (!zahlen.length && !anders.length) console.log('\n✔ Die Fahrphysik ist genau der festgehaltene Stand.');
}
