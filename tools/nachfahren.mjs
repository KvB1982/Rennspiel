// Rennspiel – eine aufgenommene Fahrt („Fahrt sichern“ im Spiel) ansehen und am Rechner nachfahren.
//   node tools/nachfahren.mjs fahrt_kueste_f1_….json             Bericht + Bild tools/nachfahren.svg
//   node tools/nachfahren.mjs fahrt_….json --fahrer              dazu: einen künstlichen Fahrer bauen, der so fährt wie in der Aufnahme
//   node tools/nachfahren.mjs fahrt_….json --bild pfad.svg       Bild woanders hinschreiben
//
// Der Bericht hat vier Teile:
//   1. Was wirklich passiert ist (steht in der Datei): Zeiten, Wandkontakte, neben der Fahrbahn, wie flüssig das Bild lief
//   2. Wie der Mensch gefahren ist: Lenkung, Gas, Bremse
//   3. Nachfahren: Die Fahrphysik von HEUTE bekommt genau dieselben Eingaben. Kommt dasselbe heraus?
//      (Haargenau geht das nur im Zeitfahren ohne Gegner und Verkehr – dort gibt es keinen Zufall.)
//   4. --fahrer: Schrecksekunde, Lenk-Stärke und Brems-Stil aus der Aufnahme schätzen und damit eine Runde fahren
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { aufStrecke } from '../js/physik.js';
import { baueRennen } from '../js/rennbau.js';
import { auspacken } from '../js/rekorder.js';

const args = process.argv.slice(2);
const datei = args.find(a => !a.startsWith('--'));
const mitFahrer = args.includes('--fahrer');
const bildPfad = args.includes('--bild') ? args[args.indexOf('--bild') + 1] : join(dirname(fileURLToPath(import.meta.url)), 'nachfahren.svg');
if (!datei || (args.includes('--bild') && datei === bildPfad)) { console.log('Aufruf: node tools/nachfahren.mjs <fahrt.json> [--fahrer] [--bild pfad.svg]'); process.exit(1); }

const P = JSON.parse(readFileSync(datei, 'utf8'));
const F = auspacken(P);
const E = P.E;
const def = STRECKEN.find(s => s.id === P.strecke);
if (!def) { console.log('Die Strecke „' + P.strecke + '“ gibt es nicht (mehr).'); process.exit(1); }
const T = baueStrecke(def);
const sc = T.sc;
const zeit = t => t == null ? '–' : typeof t === 'object' ? zeit(t.t) + (t.gueltig === false ? ' (ungültig)' : '') : Math.floor(t / 60) + ':' + (t % 60).toFixed(2).padStart(5, '0');
const proz = (a, b) => b ? (100 * a / b).toFixed(0) + ' %' : '–';
const kmh = u => (Math.abs(u) * 3.6 / sc).toFixed(0);
const mitte = l => { const s = [...l].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

// Zeit seit Aufnahme-Beginn für jedes Bild
const tBei = new Float64Array(F.n + 1);
for (let i = 0; i < F.n; i++) tBei[i + 1] = tBei[i] + F.dt[i];
const dauer = tBei[F.n];
const spurBei = i => F.spur[Math.min(F.spur.length - 1, Math.round(i / P.spurAlle))];

// ---------------------------------------------------------------- 1. Was wirklich passiert ist
const auto = E.fahrzeug === 'super' ? E.supercar : E.fahrzeug === 'rallye' ? E.rallyeauto : E.fahrzeug;
const quellen = {}; for (let i = 0; i < F.n; i++) quellen[F.quelle(i)] = (quellen[F.quelle(i)] || 0) + 1;
const quelle = Object.entries(quellen).sort((a, b) => b[1] - a[1]).map(([q, n]) => q + (n < F.n ? ' ' + proz(n, F.n) : '')).join(', ');
console.log(`\n=== Fahrt vom ${String(P.wann).replace('T', ' ').slice(0, 16)} (Weltzeit) ===`);
console.log(`Strecke ${def.name} (${P.strecke}), Auto ${auto}, ${E.fahrzeug === 'rallye' ? 'Rallye' : E.modus === 'zeit' ? 'Zeitfahren' : 'Rennen mit ' + (E.fahrzeug === 'super' ? E.gegner_super : E.gegner) + ' Gegnern'}`);
console.log(`Fahrgefühl ${E.arcade !== false ? 'Arcade' : 'echter'}, Bremshilfe ${E.bremshilfe ? 'an' : 'aus'}, Lenkhilfe ${E.lenkhilfe ? 'an' : 'aus'}, Traktion ${E.traktion ? 'an' : 'aus'}, Gas von allein ${E.autogas ? 'an' : 'aus'}`);
console.log(`Steuerung: ${quelle}${F.neig ? ' (Neige-Stufe ' + E.neigStufe + ')' : ''} · Grafik ${E.grafik} · Kamera ${E.fahrzeug === 'rallye' ? E.kamera_rallye : T.def.modell ? E.kamera_klein : E.kamera}`);
if (P.geraet) console.log(`Gerät: ${P.geraet.app ? 'App' : 'Browser'}, ${P.geraet.breite} × ${P.geraet.hoehe} Punkte (mal ${P.geraet.punkte}) · ${String(P.geraet.ua).slice(0, 90)}`);
console.log(`Aufnahme: ${zeit(dauer)} lang, ${F.n} ${F.schritt ? "Rechenschritte von 1/120 s" : "Bilder"}${P.abgeschnitten ? ' (nach 20 Minuten abgeschnitten)' : ''}`);

console.log('\n--- 1. Was wirklich passiert ist ---');
if (P.ende) {
  const e = P.ende;
  if (E.fahrzeug === 'rallye') console.log(`Prüfung: ${e.ziel != null ? 'im Ziel nach ' + zeit(e.ziel) : 'nicht im Ziel (Stand ' + e.phase + ' nach ' + zeit(e.zeit) + ')'}`);
  else console.log(`Runden: ${e.zeiten && e.zeiten.length ? e.zeiten.map(zeit).join('  ') : '(keine ganze Runde)'} · beste ${zeit(e.beste)}${e.ziel != null ? ' · im Ziel nach ' + zeit(e.ziel) + ' auf Platz ' + e.platz : ''}`);
}
// Wandkontakte und Ausflüge neben die Fahrbahn zählen (ein Ausflug = von „drauf“ zu „daneben“)
const wand = [], ausfluege = [];
let nebenZeit = 0, luftZeit = 0, fahrZeit = 0, war = false, wandWar = -99;
for (let i = 0; i < F.n; i++) {
  if (!F.laeuft(i)) continue;
  fahrZeit += F.dt[i];
  if (F.wand(i)) { if (i - wandWar > 30) wand.push(i); wandWar = i; }
  const nb = F.neben(i);
  if (nb) { nebenZeit += F.dt[i]; if (!war) ausfluege.push({ ab: i, dauer: 0 }); ausfluege[ausfluege.length - 1].dauer += F.dt[i]; }
  war = nb;
  if (F.luft(i)) luftZeit += F.dt[i];
}
const zurueck = P.ereignisse.filter(e => e[1] === 'zurueck').length;
console.log(`Wandkontakte: ${wand.length} · neben der Fahrbahn: ${ausfluege.length}-mal, zusammen ${nebenZeit.toFixed(1)} s von ${fahrZeit.toFixed(0)} s (${proz(nebenZeit, fahrZeit)})${luftZeit > 0.3 ? ' · in der Luft ' + luftZeit.toFixed(1) + ' s' : ''}${zurueck ? ' · ' + zurueck + '-mal „zurück auf die Strecke“' : ''}`);
const stelle = i => { const s = spurBei(i); return `bei ${(s.s / sc).toFixed(0).padStart(5)} m mit ${kmh(s.u).padStart(3)} km/h, Lenkrad ${F.lenk[i].toFixed(2).padStart(5)}, Gas ${F.gas[i].toFixed(1)}, Bremse ${F.brems[i].toFixed(1)}`; };
for (const i of wand.slice(0, 12)) console.log(`   Wand   nach ${zeit(tBei[i])} ${stelle(i)}`);
for (const a of ausfluege.filter(a => a.dauer > 0.25).slice(0, 20)) console.log(`   neben  nach ${zeit(tBei[a.ab])} ${stelle(a.ab)}, ${a.dauer.toFixed(1)} s lang`);
// Wie flüssig lief das Bild?
// Neue Aufnahmen (fester Rechenschritt) merken sich, mit welchem Schritt ein neues Bild anfing; alte haben ein Bild je Eintrag
const bildZeiten = [];
if (F.schritt) { let z = 0, offen = false; for (let i = 0; i < F.n; i++) { if (F.neu(i)) { if (offen) bildZeiten.push(z); z = 0; offen = true; } z += F.dt[i]; } if (offen) bildZeiten.push(z); }
else for (let i = 0; i < F.n; i++) bildZeiten.push(F.dt[i]);
const BN = bildZeiten.length;
const je = F.schritt ? 2 : 1;   // so viele Einträge der Datei sind 1/60 Sekunde (neue Aufnahmen: 2 Rechenschritte)
// Mit festem Schritt sind Bildzeiten Vielfache von 1/120 s: 2 Schritte = 60 Bilder/s, 3 = 40, 4 = 30
let langsam = 0, sehrLangsam = 0; for (const z of bildZeiten) { if (z > 1 / 48) langsam++; if (z > 1 / 31) sehrLangsam++; }
const bps = BN / dauer;
let tech = '';
if (P.technik && P.technik.length) {
  const sp = k => P.technik.map(t => t[k]);
  tech = ` · Bilder/s ${Math.min(...sp(1))}–${Math.max(...sp(1))} · Bildschärfe ${Math.min(...sp(2))}–${Math.max(...sp(2))} · Dreiecke bis ${Math.max(...sp(3)).toLocaleString('de-DE')} · Zeichenaufrufe bis ${Math.max(...sp(4))}`;
}
console.log(`Tempo des Bildes: im Schnitt ${bps.toFixed(0)} Bilder/s, ${proz(langsam, BN)} der Bilder langsamer als 48/s, ${proz(sehrLangsam, BN)} langsamer als 31/s${tech}`);
if (P.technik && P.technik.length && P.geraet) {
  const sp = k => P.technik.map(t => t[k]);
  console.log(`Zeile für docs/tempo_ipad.md:\n| ${String(P.wann).slice(0, 10)} | ${P.geraet.app ? 'App' : 'Browser'} ${P.geraet.breite}×${P.geraet.hoehe} | ${def.name} | ${auto} | ${E.grafik} | ${(sp(1).reduce((x, y) => x + y, 0) / sp(1).length).toFixed(0)} (${Math.min(...sp(1))}–${Math.max(...sp(1))}) | ${Math.min(...sp(2))}–${Math.max(...sp(2))} | ${Math.max(...sp(3)).toLocaleString('de-DE')} | ${Math.max(...sp(4))} |`);
}

// ---------------------------------------------------------------- 2. Wie der Mensch gefahren ist
console.log('\n--- 2. Wie gefahren wurde ---');
const teile = (feld) => { let null_ = 0, voll = 0, da = 0; for (let i = 0; i < F.n; i++) { if (!F.laeuft(i)) continue; da++; if (feld[i] < 0.04) null_++; else if (feld[i] > 0.96) voll++; } return { null_, voll, da, mitte: da - null_ - voll }; };
const g = teile(F.gas), b = teile(F.brems);
console.log(`Gas:    ${proz(g.voll, g.da)} voll, ${proz(g.null_, g.da)} gar nicht, ${proz(g.mitte, g.da)} dazwischen${g.mitte < g.da * 0.03 ? '  (nur an oder aus)' : ''}`);
console.log(`Bremse: ${proz(b.voll, b.da)} voll, ${proz(b.null_, b.da)} gar nicht, ${proz(b.mitte, b.da)} dazwischen${b.mitte < b.da * 0.03 ? '  (nur an oder aus)' : ''}`);
let lenkSumme = 0, anschlag = 0, wechsel = 0, vz = 0, lenkTempo = [];
for (let i = 1; i < F.n; i++) {
  if (!F.laeuft(i)) continue;
  lenkSumme += Math.abs(F.lenk[i]); if (Math.abs(F.lenk[i]) > 0.97) anschlag++;
  const d = F.lenk[i] - F.lenk[i - 1];
  if (Math.abs(d) > 0.004) { const v = Math.sign(d); if (vz && v !== vz) wechsel++; vz = v; }
  lenkTempo.push(Math.abs(d) / Math.max(F.dt[i], 0.004));
}
console.log(`Lenkung: im Schnitt ${(lenkSumme / g.da).toFixed(2)} vom vollen Einschlag, ${proz(anschlag, g.da)} der Zeit am Anschlag, ${(wechsel / fahrZeit).toFixed(1)} Richtungswechsel je Sekunde`);
if (F.neig) { let mx = 0; for (let i = 0; i < F.n; i++) mx = Math.max(mx, Math.abs(F.neig[i])); console.log(`Gerät: höchstens ${mx.toFixed(0)}° gedreht`); }

// ---------------------------------------------------------------- 3. Nachfahren mit der Fahrphysik von heute
console.log('\n--- 3. Nachfahren mit der Fahrphysik von heute ---');
const zufall = E.fahrzeug !== 'rallye' && E.modus === 'rennen';
if (zufall) console.log('Achtung: Das war ein Rennen. Gegner' + (def.strasse ? ' und Verkehr' : '') + ' fahren mit Zufall, deshalb passt das Nachfahren hier nur ungefähr.');
const R = baueRennen(E, T, P.rallyeNr || 0);
if (P.ampelAus != null) R.ampelAus = P.ampelAus;
const L = R.LS || R.L;
const a = R.ich.a, slot = !!R.slot;
const ereignisBei = new Map(); for (const [n, art] of P.ereignisse) ereignisBei.set(n, art);
// Für jedes Bild merken wir uns, was der Fahrer „gesehen“ hat (für Teil 4 und fürs Bild)
const W = new Float32Array(F.n), U = new Float32Array(F.n), PLAN = new Float32Array(F.n), S = new Float32Array(F.n);
let groesste = 0, ersteAb = -1, geholt = 0, sumAb = 0, nAb = 0;
const GRENZE = 0.5 * sc;   // ab einem halben Meter Abstand zur Wirklichkeit wird das Auto zurück auf die echte Spur gesetzt
for (let i = 0; i < F.n; i++) {
  if (ereignisBei.get(i) === 'zurueck' && !slot) {
    if (R.rallye) R.zuruecksetzen();
    else { const d = Math.max(-T.hb[a.idx] * 0.5, Math.min(T.hb[a.idx] * 0.5, a.d)); aufStrecke(a, T, a.s, d); a.y = T.y[a.idx]; }
  }
  if (L && !slot) {
    const sh = Math.sin(a.h), ch = Math.cos(a.h), j = T.index(a.s + 0.5 * Math.abs(a.u) + 6 * sc);
    const dx = L.lx[j] - a.x, dz = L.lz[j] - a.z;
    W[i] = Math.atan2(dx * ch - dz * sh, Math.max(sc, dx * sh + dz * ch));
    PLAN[i] = L.tempo[Math.max(0, a.idx)];
  }
  U[i] = a.u; S[i] = a.s;
  R.update(F.dt[i], { lenk: F.lenk[i], gas: F.gas[i], brems: F.brems[i], hand: F.hand(i) });
  if (i % P.spurAlle === 0) {
    const w = F.spur[i / P.spurAlle];
    if (!w) continue;
    const ab = Math.hypot(a.x - w.x, a.z - w.z);
    sumAb += ab; nAb++;
    if (ab > groesste) groesste = ab;
    if (ab > GRENZE) {
      if (ersteAb < 0) ersteAb = i;
      geholt++;
      if (!slot) { a.x = w.x; a.z = w.z; a.h = w.h; a.u = w.u; a.v = w.v; a.r = w.r; a.s = w.s; a.idx = T.index(w.s); }
    }
  }
}
const cm = m => (m / sc * 100).toFixed(m / sc < 0.1 ? 1 : 0) + ' cm';
if (ersteAb < 0) console.log(`Haargenau: Die ganze Fahrt kommt wieder so heraus wie auf dem Gerät (größter Abstand ${cm(groesste)}, im Schnitt ${cm(sumAb / Math.max(1, nAb))}).`);
else {
  console.log(`Genau nachgefahren bis ${zeit(tBei[ersteAb])} von ${zeit(dauer)}. Danach lief das Auto am Rechner anders als auf dem Gerät`);
  console.log(`(mehr als ${cm(GRENZE)} Abstand) und wurde ${geholt}-mal auf die echte Spur zurückgesetzt (${proz(geholt, nAb)} der Messpunkte).`);
  console.log(zufall ? 'Das ist bei einem Rennen normal (Zufall bei Gegnern und Stößen).' : 'Mögliche Gründe: Die Fahrphysik wurde seit der Aufnahme geändert, ein Stoß mit Zufall (Bande, Fels), oder das Gerät rechnet in der letzten Stelle anders.');
}
if (R.ich.zeiten && R.ich.zeiten.length && ersteAb < 0) console.log(`Runden beim Nachfahren: ${R.ich.zeiten.map(zeit).join('  ')}`);
// Tempo im Vergleich zum Plan (nur wo ein Plan da ist): in den Kurven = an den langsamsten Stellen des Plans
if (L && !slot) {
  const kurven = [];
  for (let i = 30 * je; i < F.n - 30 * je; i++) {
    if (!F.laeuft(i) || PLAN[i] > a.p.vMax * 0.85 || PLAN[i] <= 0) continue;
    let tief = true; for (let k = 1; k <= 30 && tief; k++) if (PLAN[i + k * je] < PLAN[i] || PLAN[i - k * je] <= PLAN[i]) tief = false;
    if (tief && U[i] > PLAN[i] * 0.3) kurven.push(U[i] / PLAN[i]);   // (fast stehende Autos nach „zurück auf die Strecke“ zählen nicht)
  }
  if (kurven.length) console.log(`Tempo in den Kurven: im Mittel ${mitte(kurven).toFixed(2)}-mal Plan-Tempo (${kurven.length} Kurven, langsamste ${Math.min(...kurven).toFixed(2)}, schnellste ${Math.max(...kurven).toFixed(2)})`);
}

// ---------------------------------------------------------------- 4. Einen künstlichen Fahrer aus der Aufnahme bauen
if (mitFahrer) {
  console.log('\n--- 4. Künstlicher Fahrer nach dieser Aufnahme ---');
  if (!L || slot) console.log('Geht nur bei Autos, die man lenkt (nicht beim Slotcar).');
  else {
    // Der Fahrer aus tools/echt.mjs lenkt so: Lenkrad = Stärke mal Winkel zum Zielpunkt auf der Linie – aber erst nach einer Schrecksekunde.
    // Wir probieren alle Schrecksekunden und Stärken durch und nehmen, was am besten zur Aufnahme passt.
    const gut = []; for (let i = 60 * je; i < F.n; i++) if (F.laeuft(i) && Math.abs(U[i]) > 5 * sc && !F.neben(i)) gut.push(i);
    let best = { fehler: Infinity };
    for (let tau = 0; tau <= 42; tau += 1) for (const K of [1.5, 2, 2.5, 3.3, 4, 5, 6.5, 8, 10, 13]) {
      let f = 0; for (const i of gut) { const m = Math.max(-1, Math.min(1, K * W[i - tau * je])) - F.lenk[i]; f += m * m; }
      f = Math.sqrt(f / Math.max(1, gut.length));
      if (f < best.fehler) best = { tau, K, fehler: f };
    }
    let ohne = 0; for (const i of gut) ohne += F.lenk[i] * F.lenk[i]; ohne = Math.sqrt(ohne / Math.max(1, gut.length));
    // Brems-Stil: Wie schnell (im Vergleich zum Plan 0,6 s voraus) ist das Auto, wenn der Mensch auf die Bremse geht?
    const bremsAb = [];
    for (let i = 1; i < F.n; i++) if (F.laeuft(i) && F.brems[i] > 0.5 && F.brems[i - 1] <= 0.5 && U[i] > 8 * sc) { const pl = L.tempo[T.index(S[i] + Math.abs(U[i]) * 0.6)]; if (pl > 0) bremsAb.push(U[i] / pl); }
    const bremsMal = bremsAb.length >= 3 ? mitte(bremsAb) : null;
    console.log(`Schrecksekunde: ${(best.tau / 60).toFixed(2)} s (${best.tau} Sechzigstel) · Lenk-Stärke ${best.K} (echt.mjs rechnet mit 3,3; „Spät“ mit 8,3)`);
    console.log(`Das Modell erklärt die Lenkung zu ${Math.max(0, 100 * (1 - (best.fehler / ohne) ** 2)).toFixed(0)} % (Rest ${best.fehler.toFixed(2)} vom vollen Einschlag = Zittern, Korrekturen, eigene Linie)`);
    if (best.fehler / ohne > 0.8) console.log('Vorsicht: Das passt schlecht. Der Mensch lenkt hier anders als ein Fahrer, der einem Punkt auf der Ideallinie folgt.');
    console.log(bremsMal ? `Bremst selbst: ${bremsAb.length}-mal, im Mittel bei ${bremsMal.toFixed(2)}-mal Plan-Tempo (unter 1 = früh, über 1 = spät)` : `Bremst kaum selbst (${bremsAb.length}-mal)${E.bremshilfe ? ' – die Bremshilfe macht das' : ''}`);
    console.log(`Passender Aufruf: VERZUG=${best.tau} node tools/echt.mjs${E.arcade !== false ? ' arcade' : ''}`);
    // Mit diesem Fahrer eine Runde auf der Fahrphysik von heute (Zeitfahren, dieselben Hilfen)
    const E2 = { ...E, modus: 'zeit' };
    const R2 = baueRennen(E2, T, 0), L2 = R2.LS || R2.L, a2 = R2.ich.a, alt = [];
    let t = 0, weg = 0, wand2 = 0, neben2 = 0, raus2 = 0, draussen = false, schreck = 0, wWar = -99, n = 0;
    const ziel = R2.rallye ? T.laenge * 0.9 : T.laenge * 1.05, dt = 1 / 60;
    while (t < 1500 && weg < ziel) {
      const sh = Math.sin(a2.h), ch = Math.cos(a2.h), j = T.index(a2.s + 0.5 * Math.abs(a2.u) + 6 * sc);
      const dx = L2.lx[j] - a2.x, dz = L2.lz[j] - a2.z;
      alt.push(Math.max(-1, Math.min(1, best.K * Math.atan2(dx * ch - dz * sh, Math.max(sc, dx * sh + dz * ch)))));
      const lenk = alt.length > best.tau ? alt.shift() : 0;
      let gas = 1, brems = 0;
      if (bremsMal && !E.bremshilfe) { const pl = L2.tempo[T.index(a2.s + Math.abs(a2.u) * 0.6)] * bremsMal; if (a2.u > pl * 1.03) { gas = 0; brems = 1; } else if (a2.u > pl * 0.97) gas = 0.3; }
      if (schreck > 0) { schreck -= dt; gas = Math.min(gas, 0.2); }
      const sAlt = a2.s;
      R2.update(dt, { lenk, gas, brems, hand: 0 }); t += dt; n++;
      if (R2.phase !== 'los') continue;
      let ds = a2.s - sAlt; if (ds < -T.laenge / 2) ds += T.laenge; if (ds > T.laenge / 2) ds -= T.laenge;
      weg += ds;
      if (a2.stoss > (T.def.modell ? 0.1 : 2)) { if (n - wWar > 30) wand2++; wWar = n; schreck = 1.5; }
      const off = Math.abs(a2.d) > T.hb[a2.idx] + 0.5 * sc;
      if (off) { neben2 += dt; schreck = 1.5; if (!draussen) raus2++; }
      draussen = off;
    }
    const jeKm = (zahl, m) => (zahl / Math.max(0.001, m / sc / 1000)).toFixed(1);
    let wegEcht = 0; for (let i = 0; i < F.n; i++) if (F.laeuft(i)) wegEcht += Math.abs(U[i]) * F.dt[i];
    console.log(`\n                 Wand je km   neben je km   Sekunden neben je km`);
    console.log(`Mensch (echt)      ${jeKm(wand.length, wegEcht).padStart(6)}      ${jeKm(ausfluege.length, wegEcht).padStart(6)}         ${jeKm(nebenZeit, wegEcht).padStart(6)}`);
    console.log(`Künstlicher Fahrer ${jeKm(wand2, weg).padStart(6)}      ${jeKm(raus2, weg).padStart(6)}         ${jeKm(neben2, weg).padStart(6)}     (${weg >= ziel ? 'Runde in ' + zeit(R2.ich.beste ?? R2.ich.ziel ?? t) : 'nicht angekommen'})`);
    console.log('Liegen die Zeilen nah beieinander, taugt der künstliche Fahrer als Ersatz für diesen Menschen beim Abstimmen.');
  }
}

// ---------------------------------------------------------------- Bild: Strecke von oben mit der gefahrenen Spur, darunter Lenkung, Gas, Bremse, Tempo
{
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (let i = 0; i < T.n; i++) { minx = Math.min(minx, T.x[i]); maxx = Math.max(maxx, T.x[i]); minz = Math.min(minz, T.z[i]); maxz = Math.max(maxz, T.z[i]); }
  const rand = T.hb[0] * 4, B = 1500, m = (B - 40) / Math.max(maxx - minx + 2 * rand, (maxz - minz + 2 * rand) * 1.5);
  const H = Math.round((maxz - minz + 2 * rand) * m + 40), X = x => (20 + (x - minx + rand) * m).toFixed(1), Z = z => (20 + (z - minz + rand) * m).toFixed(1);
  let li = '', re = '';
  for (let k = 0; k <= T.n; k++) { const i = k % T.n; li += (k ? 'L' : 'M') + X(T.x[i] + T.tz[i] * T.hb[i]) + ',' + Z(T.z[i] - T.tx[i] * T.hb[i]); re = 'L' + X(T.x[i] - T.tz[i] * T.hb[i]) + ',' + Z(T.z[i] + T.tx[i] * T.hb[i]) + re; }
  let svg = `<path d="${li}${re}Z" fill="#3a4250"/>`;
  if (L) { let d = ''; for (let k = 0; k <= T.n; k += 2) { const i = k % T.n; d += (k ? 'L' : 'M') + X(L.lx[i]) + ',' + Z(L.lz[i]); } svg += `<path d="${d}" fill="none" stroke="#7d8796" stroke-width="1" stroke-dasharray="6 5"/>`; }
  // Die echte Spur: grün auf der Fahrbahn, rot daneben
  for (let k = 1; k < F.spur.length; k++) {
    const p0 = F.spur[k - 1], p1 = F.spur[k];
    if (Math.hypot(p1.x - p0.x, p1.z - p0.z) > 30 * sc) continue;   // Sprung (zurück auf die Strecke)
    svg += `<path d="M${X(p0.x)},${Z(p0.z)}L${X(p1.x)},${Z(p1.z)}" stroke="${F.neben(p1.bild) ? '#ff5a4d' : '#4be07f'}" stroke-width="${F.neben(p1.bild) ? 3 : 1.6}" fill="none"/>`;
  }
  for (const i of wand) { const w = spurBei(i); svg += `<circle cx="${X(w.x)}" cy="${Z(w.z)}" r="7" fill="none" stroke="#ffb020" stroke-width="3"/>`; }
  const st = F.spur[0]; if (st) svg += `<circle cx="${X(st.x)}" cy="${Z(st.z)}" r="5" fill="#fff"/><text x="${+X(st.x) + 9}" y="${+Z(st.z) + 4}" fill="#fff" font-size="13">Start</text>`;
  // Streifen über die Zeit
  const sy = H + 10, sh = 60, sx = t => (20 + t / dauer * (B - 40)).toFixed(1), stufe = Math.max(1, Math.floor(F.n / 3000));
  const streifen = (nr, name, farbe, wert, mitteLinie) => {
    const y0 = sy + nr * (sh + 22);
    let d = ''; for (let i = 0; i < F.n; i += stufe) d += (i ? 'L' : 'M') + sx(tBei[i]) + ',' + (y0 + sh - wert(i) * sh).toFixed(1);
    return `<rect x="20" y="${y0}" width="${B - 40}" height="${sh}" fill="#1a2130"/>${mitteLinie ? `<path d="M20,${y0 + sh / 2}H${B - 20}" stroke="#48566b"/>` : ''}<path d="${d}" fill="none" stroke="${farbe}" stroke-width="1.3"/><text x="24" y="${y0 - 5}" fill="#c9d3e0" font-size="13">${name}</text>`;
  };
  const vMax = Math.max(...U, 1e-6);
  svg += streifen(0, 'Lenkung (oben = links)', '#ffffff', i => 0.5 + F.lenk[i] / 2, true);
  svg += streifen(1, 'Gas', '#4be07f', i => F.gas[i]);
  svg += streifen(2, 'Bremse', '#ff5a4d', i => F.brems[i]);
  svg += streifen(3, `Tempo (weiß, bis ${kmh(vMax)} km/h) und Tempo-Plan (grau)`, '#7d8796', i => Math.min(1, PLAN[i] / vMax));
  { const y0 = sy + 3 * (sh + 22); let d = ''; for (let i = 0; i < F.n; i += stufe) d += (i ? 'L' : 'M') + sx(tBei[i]) + ',' + (y0 + sh - Math.max(0, U[i]) / vMax * sh).toFixed(1); svg += `<path d="${d}" fill="none" stroke="#fff" stroke-width="1.3"/>`; }
  for (const a0 of ausfluege) svg += `<rect x="${sx(tBei[a0.ab])}" y="${sy}" width="${Math.max(1.5, a0.dauer / dauer * (B - 40)).toFixed(1)}" height="${4 * (sh + 22) - 22}" fill="#ff5a4d" opacity=".22"/>`;
  for (const i of wand) svg += `<path d="M${sx(tBei[i])},${sy}v${4 * (sh + 22) - 22}" stroke="#ffb020" stroke-width="2"/>`;
  const HG = sy + 4 * (sh + 22) + 10;
  const kopf = `${def.name} · ${auto} · ${E.arcade !== false ? 'Arcade' : 'echter'} · ${String(P.wann).slice(0, 10)} · grün = auf der Fahrbahn, rot = daneben, gelber Ring = Wand, gestrichelt = Ideallinie`;
  writeFileSync(bildPfad, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${HG}" width="${B}" height="${HG}" font-family="sans-serif"><rect width="100%" height="100%" fill="#0f141d"/><text x="20" y="16" fill="#c9d3e0" font-size="13">${kopf}</text>${svg}</svg>`);
  console.log('\nBild: ' + bildPfad);
}
