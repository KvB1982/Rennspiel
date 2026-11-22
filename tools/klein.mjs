// Rennspiel – die kleinen Autos nachmessen (ferngesteuertes Auto und Drift-Rallye), ohne Grafik und ohne echten Menschen.
//   node tools/klein.mjs                 alle kleinen Strecken, Tempo mittel
//   node tools/klein.mjs schnell         Tempo: langsam, mittel oder schnell
//   node tools/klein.mjs aus             ohne Arcade-Hilfe (zum Vergleichen)
//   VERZUG=21 node tools/klein.mjs       Schrecksekunde des Fahrers in Bildern (Standard 15 = 0,25 s)
//
// Der künstliche Fahrer macht einen Menschen nach: Er lenkt zur Ideallinie, aber erst nach einer Schrecksekunde,
// und grob (schon kleine Fehler = viel Lenken). Er gibt immer Vollgas, die Bremshilfe ist an.
//   „Mensch“  wie oben      „Tasten“  kennt nur voll links, voll rechts oder geradeaus
// Gezählt wird: Rundenzeit, Bandenkontakte, Sekunden neben der Bahn, Dreher, Turbos, größter Drift-Winkel, höchster Gang.
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { Rennen } from '../js/rennen.js';
import { lenkZurLinie } from '../js/ki.js';
import { driftWinkel } from '../js/turbo.js';

const args = process.argv.slice(2);
const ohne = args.includes('aus');
const tempoName = args.find(x => ['langsam', 'mittel', 'schnell'].includes(x)) || 'mittel';
const TEMPO = { modell: { langsam: 1.2, mittel: 1.8, schnell: 2.4 }, drift: { langsam: 0.7, mittel: 0.9, schnell: 1.15 } };
const VERZUG = +(process.env.VERZUG || 15), dt = 1 / 60, RUNDEN = 4;

for (const def of STRECKEN) {
  if (!def.modell || def.slot) continue;
  const art = def.drift ? 'drift' : 'modell';
  for (const fahrer of ['Mensch', 'Tasten']) {
    const T = baueStrecke(def);
    const R = new Rennen(T, { modus: 'zeit', art, tempo: TEMPO[art][tempoName] });
    R.hilfe.bremsen = true;
    const c = R.ich, a = c.a; a.tc = true; a.arcade = !ohne;
    const alt = [];
    let wand = 0, neben = 0, dreher = 0, maxW = 0, maxGang = 0, maxV = 0, t = 0, drift = 0, fahrt = 0, quer = false;
    while (c.zeiten.length < RUNDEN && t < 240) {
      let w = lenkZurLinie(a, T, R.L) * 1.6;
      w = fahrer === 'Tasten' ? (Math.abs(w) < 0.25 ? 0 : Math.sign(w)) : Math.max(-1, Math.min(1, w));
      alt.push(w);
      const lenk = alt.length > VERZUG ? alt.shift() : 0;
      R.update(dt, { lenk, gas: 1, brems: 0, hand: 0 });
      t += dt;
      if (a.stoss > 0.05) wand++;
      if (Math.abs(a.d) > T.hb[a.idx] + 0.02) neben += dt;
      const dw = driftWinkel(a);
      maxW = Math.max(maxW, dw); maxGang = Math.max(maxGang, a.gang); maxV = Math.max(maxV, a.u);
      if (a.u > 0.2) { fahrt += dt; if (dw > 0.2) drift += dt; }
      // Dreher: Die Nase zeigt mehr als 100 Grad weg von der Bahn
      let d = Math.atan2(T.tx[a.idx], T.tz[a.idx]) - a.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const q = Math.abs(d) > 1.75; if (q && !quer) dreher++; quer = q;
    }
    const zeiten = c.zeiten.map(z => z.t.toFixed(2) + (z.gueltig ? '' : '*')).join(' ');
    console.log(`${def.id.padEnd(13)} ${fahrer.padEnd(7)} Runden ${zeiten || '– (nicht geschafft)'} | Bande ${wand}, neben ${neben.toFixed(1)} s, Dreher ${dreher}, Turbos ${c.tb ? c.tb.zahl : 0}, Drift bis ${Math.round(maxW * 57.3)}° (${Math.round(drift / Math.max(fahrt, 1) * 100)} % der Zeit), Gang bis ${maxGang}, Spitze ${(maxV).toFixed(2)} m/s = ${Math.round(maxV * 3.6 / T.sc)} km/h im Maßstab${R.drift && c.drift ? ', Drift-Punkte ' + c.drift.gesamt : ''}`);
  }
}
