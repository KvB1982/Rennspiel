// Rennspiel – Fahrgefühl nachmessen, ohne Grafik und ohne echten Menschen.
//   node tools/fahrgefuehl.mjs            alle Autos: Beschleunigung, Spurwechsel, künstliche Fahrer auf den Strecken
//   node tools/fahrgefuehl.mjs aus        dasselbe ohne Arcade-Hilfe (zum Vergleichen)
//
// Die künstlichen Fahrer machen nach, wie ein Mensch mit Handy oder Tasten fährt:
//   „Profi“   lenkt ruhig zur Ideallinie und bremst rechtzeitig
//   „Wild“    lenkt hektisch (schon kleine Fehler = voller Einschlag), gibt fast immer Vollgas und bremst spät
// Gezählt wird: Wandkontakte, Sekunden neben der Straße, Dreher (Auto steht mehr als 60° quer), Rundenzeit.
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { neuesAuto, schritt, aufStrecke, lenkGrenze } from '../js/physik.js';
import { ideallinie } from '../js/ki.js';
import { RALLYEAUTOS } from '../js/rallyeautos.js';

const ohne = process.argv.includes('aus');
const nurRallye = process.argv.includes('rallye');   // node tools/fahrgefuehl.mjs rallye [aus]: nur die Rallyeautos
const dt = 1 / 60;
const fein = x => (Math.round(x * 100) / 100).toFixed(2);

function auto(art) {
  const a = neuesAuto(art);
  a.tc = true;                  // so wie der Spieler mit „Traktionskontrolle an“
  a.arcade = !ohne;             // Arcade-Hilfe des Spielers
  return a;
}

// 1. Beschleunigung auf einer langen Geraden
function beschleunigung(art) {
  const T = baueStrecke(STRECKEN.find(s => s.id === 'staedtetour'));
  const a = auto(art);
  aufStrecke(a, T, 0, 0);
  let t = 0, t100 = 0, t200 = 0;
  while (t < 15 && !t200) {
    a.gas = 1; a.lenkWunsch = 0;
    schritt(a, T, dt); t += dt;
    if (!t100 && a.u * 3.6 >= 100) t100 = t;
    if (!t200 && a.u * 3.6 >= 200) t200 = t;
  }
  return { t100, t200 };
}

// 2. Spurwechsel bei Tempo (auf einer gedachten, endlos breiten Geraden): voll links, voll rechts, loslassen
function spurwechsel(art, kmh, halten = 0.35) {
  const T = baueStrecke(STRECKEN.find(s => s.id === 'staedtetour'));
  T.hb = T.hb.map(() => 200); T.ausL = T.ausL.map(() => 50); T.ausR = T.ausR.map(() => 50);
  const a = auto(art);
  aufStrecke(a, T, 0, 0);
  a.u = kmh / 3.6;
  const h0 = a.h, x0 = a.x, z0 = a.z;
  let t = 0, maxSeit = 0, maxBeta = 0, ruhig = null, maxDreh = 0;
  while (t < 4) {
    a.lenkWunsch = t < halten ? 1 : t < 2 * halten ? -1 : 0;
    a.gas = 0.6;
    schritt(a, T, dt); t += dt;
    const seit = (a.x - x0) * Math.cos(h0) - (a.z - z0) * Math.sin(h0);
    maxSeit = Math.max(maxSeit, Math.abs(seit));
    maxBeta = Math.max(maxBeta, Math.abs(Math.atan2(a.v, a.u)) * 57.3);
    maxDreh = Math.max(maxDreh, Math.abs(a.h - h0) * 57.3);
    if (t > 2 * halten && ruhig === null && Math.abs(a.r) < 0.04 && Math.abs(a.v) < 0.5) ruhig = t - 2 * halten;
  }
  return { seit: maxSeit, beta: maxBeta, ruhig: ruhig ?? 9, dreh: maxDreh };
}

// 3. Künstlicher Fahrer auf einer Strecke
function fahrer(art, id, wild) {
  const def = STRECKEN.find(s => s.id === id);
  const T = baueStrecke(def);
  const a = auto(art);
  const L = ideallinie(T, a.p, def.strasse ? { rechts: true } : undefined);
  aufStrecke(a, T, 0, 0);
  let t = 0, wand = 0, neben = 0, dreher = 0, quer = false, s0 = 0, weg = 0;
  while (t < 400 && weg < T.laenge) {
    const sh = Math.sin(a.h), ch = Math.cos(a.h);
    // wohin? ein Punkt auf der Ideallinie voraus
    const voraus = 0.5 * Math.abs(a.u) + 6;
    const i = T.index(a.s + voraus);
    const dx = L.lx[i] - a.x, dz = L.lz[i] - a.z;
    const fehlerWinkel = Math.atan2(dx * ch - dz * sh, Math.max(1, dx * sh + dz * ch));
    // Ein Mensch lenkt nach dem Winkel, nicht nach der Physik: der Wilde reißt schon bei 6° Fehler voll ein
    const k = wild ? 1 / 0.1 : 1 / 0.35;
    a.lenkWunsch = Math.max(-1, Math.min(1, fehlerWinkel * k));
    const plan = L.tempo[T.index(a.s + Math.abs(a.u) * 0.3)];
    if (wild) { a.gas = a.u < plan * 1.12 ? 1 : 0; a.brems = a.u > plan * 1.3 ? 1 : 0; }
    else { a.gas = a.u < plan * 0.97 ? 1 : 0.2; a.brems = a.u > plan * 1.06 ? 0.8 : 0; }
    const sAlt = a.s;
    schritt(a, T, dt); t += dt;
    let ds = a.s - sAlt; if (ds < -T.laenge / 2) ds += T.laenge; if (ds > T.laenge / 2) ds -= T.laenge;
    weg += ds;
    if (a.stoss > 2) wand++;
    if (Math.abs(a.d) > T.hb[a.idx] + 0.5) neben += dt;
    const b = Math.abs(Math.atan2(a.v, Math.abs(a.u) + 0.1)) > 1.05;
    if (b && !quer) dreher++;
    quer = b;
  }
  return { t, wand, neben, dreher, fertig: weg >= T.laenge };
}

console.log(ohne ? 'OHNE Arcade-Hilfe' : 'MIT Arcade-Hilfe');
const RALLYE = RALLYEAUTOS.map(r => r.id);
for (const art of nurRallye ? RALLYE : ['f1', 'falkner', 'stallone', 'aurelion', 'nordvind', ...RALLYE]) {
  const b = beschleunigung(art);
  const s1 = spurwechsel(art, 120), s2 = spurwechsel(art, 220), s3 = spurwechsel(art, 220, 0.7);
  console.log(`\n${art}: 0–100 ${fein(b.t100)} s, 0–200 ${fein(b.t200)} s`);
  for (const [n, s] of [['Spurwechsel 120 km/h', s1], ['Spurwechsel 220 km/h', s2], ['Haken lang 220 km/h', s3]])
    console.log(`  ${n.padEnd(22)} seitlich ${fein(s.seit)} m, Rutschwinkel höchstens ${s.beta.toFixed(1)}°, gedreht höchstens ${s.dreh.toFixed(1)}°, ruhig nach ${fein(s.ruhig)} s`);
  const strecken = art === 'f1' ? ['kueste', 'wald', 'hafen'] : RALLYE.includes(art) ? ['wp_seen', 'wp_nebel', 'wp_pass'] : ['metropole', 'landstrasse', 'staedtetour'];
  for (const id of strecken) for (const wild of [false, true]) {
    const r = fahrer(art, id, wild);
    console.log(`  ${(wild ? 'Wild ' : 'Profi') + ' ' + id.padEnd(12)} ${r.fertig ? 'Runde ' + r.t.toFixed(1) + ' s' : 'NICHT fertig'}, Wand ${r.wand}, neben der Straße ${r.neben.toFixed(1)} s, Dreher ${r.dreher}`);
  }
}
