// Rennspiel – Fahrgefühl „echter“ (ohne Arcade-Hilfe) nachmessen, ohne Grafik und ohne echten Menschen.
//   node tools/echt.mjs              alle großen Autos auf ihren Strecken
//   node tools/echt.mjs f1 kueste    nur ein Auto auf einer Strecke
//   node tools/echt.mjs arcade       dasselbe mit Arcade-Hilfe (zum Vergleichen)
//   VERZUG=21 node tools/echt.mjs    Schrecksekunde des Fahrers in Bildern (Standard 15 = 0,25 s)
//   SPUR=1 node tools/echt.mjs f1 kueste   zeigt jede Stelle, an der das Auto die Fahrbahn verlässt
//
// Die künstlichen Fahrer machen nach, wie ein Mensch fährt, der ein bisschen geübt hat:
//   „Hilfe“    gibt Vollgas, die Bremshilfe bremst für ihn (so ist das Spiel am Anfang eingestellt)
//   „Selbst“   bremst selbst: rechtzeitig, aber nicht perfekt (Bremshilfe aus)
//   „Spät“     bremst selbst und zu spät, dazu lenkt er hektisch
// Alle lenken erst nach einer Schrecksekunde – ein Fahrer ohne Verzug merkt Pendeln und Rutschen nicht.
// Gezählt wird: Wandkontakte, Sekunden neben der Fahrbahn, Dreher (Auto steht mehr als 60° quer), Rundenzeit.
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { neuesAuto, schritt, aufStrecke } from '../js/physik.js';
import { ideallinie, bremsHilfe, linieFuer } from '../js/ki.js';

const args = process.argv.slice(2);
const arcade = args.includes('arcade');
const rest = args.filter(x => x !== 'arcade');
const VERZUG = +(process.env.VERZUG || 15), SPUR = !!process.env.SPUR, STUR = !!process.env.STUR;
const PROBE = process.env.ECHT ? JSON.parse(process.env.ECHT) : null;
const dt = 1 / 60;

function runde(art, id, wie) {
  const def = STRECKEN.find(s => s.id === id);
  const T = baueStrecke(def);
  const a = neuesAuto(art); a.tc = true; a.arcade = arcade;
  if (PROBE && a.p.echt) a.p.echt = { ...a.p.echt, ...PROBE };   // zum Ausprobieren: ECHT='{"schraeg":0.08}' node tools/echt.mjs
  const L = linieFuer(T, ideallinie(T, a.p, def.strasse ? { rechts: true } : undefined), a.p, !arcade);   // „echter“: der vorsichtigere Plan für dich
  aufStrecke(a, T, 0, 0);
  const lenkAlt = [];
  let schreck = 0;   // nach einem Wandkontakt oder neben der Fahrbahn geht ein Mensch erst einmal vom Gas (STUR=1: er bleibt stur auf dem Gas)
  let t = 0, wand = 0, neben = 0, dreher = 0, quer = false, weg = 0, draussen = false, raus = 0;
  while (t < 900 && weg < T.laenge) {
    const sh = Math.sin(a.h), ch = Math.cos(a.h);
    const i = T.index(a.s + 0.5 * Math.abs(a.u) + 6);
    const dx = L.lx[i] - a.x, dz = L.lz[i] - a.z;
    const w = Math.atan2(dx * ch - dz * sh, Math.max(1, dx * sh + dz * ch));
    lenkAlt.push(Math.max(-1, Math.min(1, w * (wie === 'spaet' ? 1 / 0.12 : 1 / 0.3))));
    a.lenkWunsch = lenkAlt.length > VERZUG ? lenkAlt.shift() : 0;
    a.gas = 1; a.brems = 0;
    if (wie === 'hilfe') bremsHilfe(a, T, L);
    else {
      // selbst bremsen: Der Fahrer schaut voraus und bremst, wenn er für die Kurve zu schnell ist
      const vor = wie === 'spaet' ? 0.15 : 0.6, mal = wie === 'spaet' ? 1.08 : 0.95;
      const plan = L.tempo[T.index(a.s + Math.abs(a.u) * vor)] * mal;
      if (a.u > plan * 1.03) { a.gas = 0; a.brems = wie === 'spaet' ? 1 : 0.85; }
      else if (a.u > plan * 0.97) a.gas = 0.3;
    }
    if (schreck > 0 && !STUR) { schreck -= dt; a.gas = Math.min(a.gas, 0.2); }
    const sAlt = a.s;
    schritt(a, T, dt); t += dt;
    let ds = a.s - sAlt; if (ds < -T.laenge / 2) ds += T.laenge; if (ds > T.laenge / 2) ds -= T.laenge;
    weg += ds;
    if (a.stoss > 2) { wand++; if (SPUR) console.log(`      Wand bei ${a.s.toFixed(0)} m, ${(a.u * 3.6).toFixed(0)} km/h (Plan ${(L.tempo[a.idx] * 3.6).toFixed(0)}), Lenkrad ${a.lenkWunsch.toFixed(2)}, Bremse ${a.brems.toFixed(2)}`); }
    const off = Math.abs(a.d) > T.hb[a.idx] + 0.5;
    if (off) neben += dt;
    if (off || a.stoss > 2) schreck = 1.5;
    if (off && !draussen) { raus++; if (SPUR) console.log(`      raus bei ${(a.s).toFixed(0)} m, ${(a.u * 3.6).toFixed(0)} km/h (Plan ${(L.tempo[a.idx] * 3.6).toFixed(0)}), Lenkrad ${a.lenkWunsch.toFixed(2)}, Bremse ${a.brems.toFixed(2)}, Gas ${a.gas.toFixed(2)}, Rutschwinkel ${(Math.atan2(a.v, a.u) * 57.3).toFixed(1)}°, vorn ${a.rutschVorn.toFixed(2)} hinten ${a.rutschHinten.toFixed(2)}`); }
    draussen = off;
    const b = Math.abs(Math.atan2(a.v, Math.abs(a.u) + 0.1)) > 1.05;
    if (b && !quer) dreher++;
    quer = b;
  }
  const plan = L.tempo.reduce((s, v) => s + T.ds / Math.max(v, 0.1), 0);
  return { t, wand, neben, dreher, raus, fertig: weg >= T.laenge, plan };
}

const PAARE = [['f1', 'kueste'], ['f1', 'wald'], ['f1', 'hafen'], ['f1', 'alpen'], ['falkner', 'metropole'], ['falkner', 'landstrasse'],
  ['stallone', 'landstrasse'], ['stallone', 'riviera'], ['aurelion', 'staedtetour'], ['nordvind', 'metropole'], ['falkner_s', 'alpenpass']];
const liste = rest.length >= 2 ? [[rest[0], rest[1]]] : rest.length === 1 ? PAARE.filter(p => p[0] === rest[0]) : PAARE;
console.log(arcade ? 'MIT Arcade-Hilfe' : 'Fahrgefühl „echter“ (ohne Arcade-Hilfe)', `· Schrecksekunde ${(VERZUG / 60).toFixed(2)} s`);
let summe = 0, raus = 0;
for (const [art, id] of liste) for (const wie of ['hilfe', 'selbst', 'spaet']) {
  const r = runde(art, id, wie);
  summe += r.neben; raus += r.raus;
  console.log(`${art.padEnd(10)} ${id.padEnd(12)} ${({ hilfe: 'Hilfe ', selbst: 'Selbst', spaet: 'Spät  ' })[wie]} ${r.fertig ? 'Runde ' + r.t.toFixed(1).padStart(6) + ' s' : 'NICHT im Ziel  '} (Plan ${r.plan.toFixed(1)}), Wand ${String(r.wand).padStart(3)}, von der Fahrbahn ${String(r.raus).padStart(2)}-mal, daneben ${r.neben.toFixed(1).padStart(5)} s, Dreher ${r.dreher}`);
}
console.log(`\nZusammen: ${raus}-mal von der Fahrbahn, ${summe.toFixed(1)} s daneben`);
