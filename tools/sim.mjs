// Rennspiel – Computer gegen Computer, ohne Grafik. Prüft, ob die Computerfahrer sauber um jede Strecke kommen.
//   node tools/sim.mjs                 alle Strecken, 3 Runden, 7 Gegner, mittel
//   node tools/sim.mjs kueste 5 9 schwer
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { Rennen, zeitText } from '../js/rennen.js';

const [nur, runden = 3, gegner = 7, staerke = 'mittel'] = process.argv.slice(2);
let fehler = 0;
for (const def of STRECKEN) {
  if (nur && def.id !== nur) continue;
  const T = baueStrecke(def);
  const art = def.slot ? 'slot' : def.modell ? 'modell' : 'f1';
  const R = new Rennen(T, { modus: 'rennen', runden: +runden, gegner: def.modell ? Math.min(3, +gegner) : +gegner, staerke, art, mitSpieler: false });
  const dt = 1 / 60;
  let wand = 0, neben = 0, maxV = 0, schritte = 0;
  const grenze = 60 * 60 * 15;
  while (R.phase !== 'fertig' && schritte < grenze) {
    R.update(dt, { lenk: 0, gas: 0, brems: 0 });
    for (const c of R.autos) {
      if (c.a.stoss > 2 * R.sc) wand++;
      if (Math.abs(c.a.d) > T.hb[c.a.idx] + 1.5 * R.sc) neben++;
      maxV = Math.max(maxV, c.a.u);
    }
    schritte++;
  }
  const raus = R.autos.reduce((s, c) => s + (c.slot ? c.slot.zahl : 0), 0);
  const ideal = (R.L ? R.L.tempo : R.plan[0]).reduce((s, v) => s + T.ds / Math.max(v, 0.1), 0);
  console.log(`\n${def.name} (${Math.round(T.laenge * 100) / 100} m) – Plan-Runde ${zeitText(ideal)}, Spitze ${Math.round(maxV * 3.6)} km/h, Wandkontakte ${wand}, Bilder neben der Strecke ${neben}, Zeit ${Math.round(schritte / 60)} s${def.slot ? ', rausgeflogen ' + raus + '-mal' : ''}`);
  for (const c of R.reihenfolge) console.log(`  ${String(c.platz).padStart(2)}. ${c.name.padEnd(16)} Stärke ${c.fahrer.staerke.toFixed(3)}  Ziel ${zeitText(c.ziel)}  beste ${zeitText(c.beste)}  Runden ${c.zeiten.map(z => z.t.toFixed(2)).join(' ')}`);
  if (R.phase !== 'fertig') { console.log('  !! Rennen nicht fertig geworden'); fehler++; }
}
process.exit(fehler ? 1 : 0);
