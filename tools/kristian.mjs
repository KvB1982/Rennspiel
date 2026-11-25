// Rennspiel – künstlicher Fahrer „wie Kristian“ (aus seinen echten Fahrten vom 25.11.2026 abgeschaut):
// ohne Bremshilfe, Gas und Bremse nur an oder aus, bremst spät, bleibt in der Kurve auf dem Gas, lenkt viel am Anschlag.
//   node tools/kristian.mjs                 alle Paare, Arcade und „echter“
//   node tools/kristian.mjs super echt      nur Supercars im Fahrgefühl „echter“   (f1 | super | rallye, arcade | echt)
//   SPAET=1.3 VERZUG=9 STAERKE=1.5 node tools/kristian.mjs     so spät bremst er (mal Tempo-Plan der Computerfahrer), Schrecksekunde in Bildern, Lenk-Stärke
//   VOLLGAS=1    er bremst gar nicht (so fuhr er die Rallye im Arcade)       SPUR=1   jede Stelle neben der Fahrbahn zeigen
//   ECHT='{"sicher":0.8}' / ARCADE='{"rand":2}'    andere Werte ausprobieren (werden über echt / arcade des Autos gelegt)
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { AUTOS } from '../js/physik.js';
import { baueRennen } from '../js/rennbau.js';

const args = process.argv.slice(2);
const SPAET = +(process.env.SPAET || 1.3), VERZUG = +(process.env.VERZUG || 9), K = +(process.env.STAERKE || 1.5);
const VOLLGAS = !!process.env.VOLLGAS, SPUR = !!process.env.SPUR;
const BREMSHILFE = !!process.env.BREMSHILFE;   // Vollgas, die Bremshilfe bremst
const RENNEN = !!process.env.RENNEN;           // Rennen gegen die Computerfahrer statt Zeitfahren (GEGNER=leicht|mittel|schwer)
const lege = (name, feld) => { if (!process.env[name]) return; const neu = JSON.parse(process.env[name]); for (const p of Object.values(AUTOS)) if (p[feld]) p[feld] = { ...p[feld], ...neu }; };
lege('ECHT', 'echt'); lege('ARCADE', 'arcade'); lege('NEBEN', 'neben'); lege('HILFE', 'echtHilfe');
const dt = 1 / 60;

const PAARE = [['f1', 'wald'], ['f1', 'kueste'], ['super', 'metropole', 'taurino'], ['super', 'landstrasse', 'falkner'], ['super', 'riviera', 'stallone'], ['super', 'alpenpass', 'falkner_s'],
  ['rallye', 'wp_seen', 'sturmfalke'], ['rallye', 'wp_pass', 'quadra'], ['rallye', 'wp_alm', 'kaiten']];

function fahrt([fz, id, auto], arcade) {
  const T = baueStrecke(STRECKEN.find(s => s.id === id));
  const E = { fahrzeug: fz, modus: RENNEN ? 'rennen' : 'zeit', supercar: auto, rallyeauto: auto, runden: 2, runden_super: 1, gegner: RENNEN ? 3 : 0, gegner_super: RENNEN ? 5 : 0, staerke: process.env.GEGNER || 'mittel', verkehr: 'aus', bremshilfe: BREMSHILFE, lenkhilfe: false, traktion: true, arcade, lack: 0, lack_rallye: 0, farbe: 0 };
  const R = baueRennen(E, T, 0), L = R.L, a = R.ich.a, alt = [];
  let t = 0, weg = 0, wand = 0, neben = 0, raus = 0, draussen = false, schreck = 0, wWar = -99, n = 0, driftZeit = 0, fahrZeit = 0, zurueck = 0, kurven = [], uSum = 0;
  const ziel = R.rallye ? T.laenge * 0.9 : T.laenge * (RENNEN ? E.fahrzeug === 'super' ? 1 : 2 : 1) + (RENNEN ? 60 : T.laenge * 0.02);
  while (t < 900 && weg < ziel) {
    const sh = Math.sin(a.h), ch = Math.cos(a.h), j = T.index(a.s + 0.5 * Math.abs(a.u) + 6);
    const dx = L.lx[j] - a.x, dz = L.lz[j] - a.z;
    alt.push(Math.max(-1, Math.min(1, K * Math.atan2(dx * ch - dz * sh, Math.max(1, dx * sh + dz * ch)))));
    const lenk = alt.length > VERZUG ? alt.shift() : 0;
    let gas = 1, brems = 0;
    if (!VOLLGAS && !BREMSHILFE) { const pl = L.tempo[T.index(a.s + Math.abs(a.u) * 0.6)] * SPAET; if (a.u > pl) { gas = 0; brems = 1; } }
    if (schreck > 0) { schreck -= dt; if (!VOLLGAS) gas = 0; }
    const sAlt = a.s, zAlt = R.zurueck || 0;
    R.update(dt, { lenk, gas, brems, hand: 0 }); t += dt; n++;
    if (R.phase !== 'los') continue;
    let ds = a.s - sAlt; if (ds < -T.laenge / 2) ds += T.laenge; if (ds > T.laenge / 2) ds -= T.laenge;
    if (Math.abs(ds) > 30) { zurueck++; ds = 0; }
    weg += ds; fahrZeit += dt; uSum += a.u * dt;
    if (Math.abs(a.drift || 0) > 0.2 || Math.abs(Math.atan2(a.v, Math.abs(a.u) + 1)) > 0.2) driftZeit += dt;
    if (a.stoss > 2) { if (n - wWar > 30) { wand++; if (SPUR) console.log(`      Wand  bei ${a.s.toFixed(0)} m, ${(a.u * 3.6).toFixed(0)} km/h (Plan ${(L.tempo[a.idx] * 3.6).toFixed(0)})`); } wWar = n; schreck = 1; }
    const off = Math.abs(a.d) > T.hb[a.idx] + 0.5;
    if (off) { neben += dt; if (!draussen) { raus++; schreck = 0.5; if (SPUR) console.log(`      neben bei ${a.s.toFixed(0)} m, ${(a.u * 3.6).toFixed(0)} km/h (Plan ${(L.tempo[a.idx] * 3.6).toFixed(0)}), Lenkrad ${lenk.toFixed(2)}, Gas ${gas}, Bremse ${brems}, vorn ${a.rutschVorn.toFixed(2)}, hinten ${a.rutschHinten.toFixed(2)}`); } }
    if (!off && draussen && SPUR) console.log(`        zurück bei ${a.s.toFixed(0)} m mit ${(a.u * 3.6).toFixed(0)} km/h, in der Luft ${a.luft ? 'ja' : 'nein'}`);
    draussen = off;
  }
  const gegner = R.rivalen ? R.rivalen.map(c => c.zeit * 0.9).sort((x, y) => x - y) : RENNEN ? R.autos.filter(c => !c.ich).map(c => c.beste).filter(Boolean).sort((x, y) => x - y) : [];
  return { gegner, ich: R.ich.beste, platz: R.rivalen ? 1 + gegner.filter(x => x < fahrZeit).length : RENNEN ? R.ich.platz : 0, von: R.rivalen ? gegner.length + 1 : R.autos ? R.autos.length : 1, ok: weg >= ziel, t: fahrZeit, wand, raus, neben, drift: driftZeit / Math.max(1, fahrZeit), zurueck, km: weg / 1000, schnitt: uSum / Math.max(1, fahrZeit) * 3.6 };
}

console.log(`Fahrer „wie Kristian“: ${BREMSHILFE ? 'Vollgas mit Bremshilfe' : 'ohne Bremshilfe'}, ${BREMSHILFE ? '' : VOLLGAS ? 'immer Vollgas' : 'bremst bei ' + SPAET + '-mal Plan-Tempo'}, Schrecksekunde ${(VERZUG / 60).toFixed(2)} s, Lenk-Stärke ${K}`);
for (const arcade of [true, false]) {
  if (args.includes('echt') && arcade || args.includes('arcade') && !arcade) continue;
  let sW = 0, sR = 0, sN = 0, sT = 0;
  for (const p of PAARE) {
    if (['f1', 'super', 'rallye'].some(x => args.includes(x)) && !args.includes(p[0])) continue;
    const r = fahrt(p, arcade);
    sW += r.wand; sR += r.raus; sN += r.neben; sT += r.t;
    console.log(`${arcade ? 'Arcade' : 'echter'} ${(p[2] || p[0]).padEnd(10)} ${p[1].padEnd(12)} ${r.ok ? (r.t.toFixed(1) + ' s').padStart(8) : '  NICHT '} ${r.schnitt.toFixed(0).padStart(4)} km/h, Wand ${String(r.wand).padStart(2)}, neben ${String(r.raus).padStart(2)}-mal ${r.neben.toFixed(1).padStart(5)} s (${(100 * r.neben / r.t).toFixed(0).padStart(2)} %), quer ${(100 * r.drift).toFixed(0).padStart(2)} % der Zeit${r.zurueck ? ', zurückgesetzt ' + r.zurueck : ''}`);
    if (r.platz) console.log(`        Platz ${r.platz} von ${r.von}${r.ich ? ', deine beste Runde ' + r.ich.toFixed(1) + ' s' : ''}${r.gegner.length ? ' · Gegner (Rallye: auf 90 % der Prüfung): ' + r.gegner.map(x => x.toFixed(1)).join(' / ') + ' s' : ''}`);
  }
  console.log(`  ${arcade ? 'Arcade' : 'echter'} zusammen: Wand ${sW}, neben ${sR}-mal, ${sN.toFixed(1)} s von ${sT.toFixed(0)} s (${(100 * sN / sT).toFixed(0)} %)`);
}
