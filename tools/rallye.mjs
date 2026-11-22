// Rennspiel – prüft die Rallye-Prüfungen ohne Grafik: Tempo-Plan, Zeiten der anderen Fahrer, Ansagen des Beifahrers,
// Zuschauer, Felsen, und lässt einen einfachen Testfahrer jede Prüfung fahren (Zeit, Sprünge, Anstöße).
//   node tools/rallye.mjs                     alle Prüfungen mit dem Sturmfalke
//   node tools/rallye.mjs quadra              mit einem anderen Auto
//   node tools/rallye.mjs kaiten wp_nebel 1   eine Prüfung, dazu die ersten Ansagen
//   TEMPO=0.8 node tools/rallye.mjs           Testfahrer langsamer (Anteil vom Tempo-Plan)
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { Etappe, zeitText } from '../js/rallye.js';
import { lenkGrenze } from '../js/physik.js';

const [auto = 'sturmfalke', nur, ansagen] = process.argv.slice(2);
const tempo = +(process.env.TEMPO || 0.9);
// WILD=1: ein hektischer Fahrer wie ein Mensch mit Handy (schon kleine Fehler = voller Einschlag, meist Vollgas, kein Gegenlenken)
// AUS=1: ohne Arcade-Hilfe (zum Vergleichen)
const wild = !!process.env.WILD, ohneHilfe = !!process.env.AUS;

// MENSCH=1: fährt wie ein Mensch mit dem Handy-Lenkrad: sieht alles erst 0,22 s später (Schrecksekunde), schaut etwa
// eine Sekunde voraus auf die Mitte des Wegs (kennt keine Ideallinie), lenkt kräftig und bremst spät.
const mensch = !!process.env.MENSCH, VERZUG = +(process.env.VERZUG || 13), puffer = [];
function menschFahrer(a, T, L) {
  const sh = Math.sin(a.h), ch = Math.cos(a.h), i = T.index(a.s + Math.max(12, Math.abs(a.u) * 0.9));
  const dx = T.x[i] - a.x, dz = T.z[i] - a.z;
  const fw = Math.atan2(dx * ch - dz * sh, Math.max(1, dx * sh + dz * ch));
  const plan = L.tempo[T.index(a.s + Math.abs(a.u) * 0.5)];
  puffer.push({ lenk: Math.max(-1, Math.min(1, fw / 0.18)), gas: a.u < plan * 1.02 ? 1 : 0, brems: a.u > plan * 1.2 ? 1 : 0 });
  // VOLLGAS=1: wie ein Spieler mit Bremshilfe – immer Vollgas, gebremst wird nur von der Bremshilfe
  if (vollgas) { const e = puffer[puffer.length - 1]; e.gas = 1; e.brems = 0; }
  // HAND=1: zieht in jeder Haarnadelkurve die Handbremse
  if (process.env.HAND) puffer[puffer.length - 1].hand = Math.abs(T.k[a.idx]) > KEHRE;
  return puffer.length > VERZUG ? puffer.shift() : { lenk: 0, gas: 1, brems: 0 };
}
const vollgas = !!process.env.VOLLGAS;
// Kehren messen: Wie schnell geht es durch die Haarnadelkurven (Halbmesser unter 22 m), wie weit und wie schnell stellt sich das Auto quer?
const KEHRE = 1 / 22;

function wilderFahrer(a, T, L) {
  const sh = Math.sin(a.h), ch = Math.cos(a.h), i = T.index(a.s + 0.5 * Math.abs(a.u) + 6);
  const dx = L.lx[i] - a.x, dz = L.lz[i] - a.z;
  const fw = Math.atan2(dx * ch - dz * sh, Math.max(1, dx * sh + dz * ch));
  const plan = L.tempo[T.index(a.s + Math.abs(a.u) * 0.3)];
  return { lenk: Math.max(-1, Math.min(1, fw / 0.1)), gas: a.u < plan * 1.1 ? 1 : 0, brems: a.u > plan * 1.3 ? 1 : 0 };
}

// Testfahrer: schaut weit voraus auf die Ideallinie und regelt das Drehtempo (sonst pendelt er auf Schotter).
// Er lenkt nach der Richtung, in die das Auto wirklich fährt – so fängt er einen Drift ab.
function testFahrer(a, T, L) {
  const p = a.p, u = Math.max(5, Math.abs(a.u)), i = T.index(a.s + 10 + 0.75 * u);
  const dx = L.lx[i] - a.x, dz = L.lz[i] - a.z, sh = Math.sin(a.h), ch = Math.cos(a.h);
  const vh = Math.abs(a.u) < 6 ? a.h : Math.atan2(sh * a.u + ch * a.v, ch * a.u - sh * a.v);   // langsam: nach der Nase
  let al = Math.atan2(dx, dz) - vh; while (al > Math.PI) al -= 2 * Math.PI; while (al < -Math.PI) al += 2 * Math.PI;
  const rSoll = 2 * u * Math.sin(al) / Math.hypot(dx, dz), beta = Math.atan2(a.v, u);
  const delta = Math.atan((p.a + p.b) * rSoll / u) + 0.6 * (rSoll - a.r) / Math.max(4, u) * 6 + beta * 0.9;
  const ziel = L.tempo[T.index(a.s + u * 0.4)] * tempo, d = ziel - a.u;
  // Ganz langsam: einfach zur Linie drehen. Steht das Auto quer: kräftig gegenlenken (wie ein Mensch)
  let gr = lenkGrenze(p, a.u); if (a.u > 3) gr += (p.lenkMax - gr) * Math.min(1, Math.abs(beta) / 0.35);
  const lenk = Math.abs(a.u) < 8 ? al * 1.5 : delta / gr + Math.max(0, Math.abs(beta) - 0.15) * Math.sign(beta) * 2;
  return { lenk: Math.max(-1, Math.min(1, lenk)), gas: d > 0 ? Math.min(1, 0.3 + d / 3) : 0, brems: d < -1.5 ? Math.min(1, -d / 6) : 0 };
}

for (const def of STRECKEN.filter(s => s.rallye && (!nur || s.id === nur))) {
  const T = baueStrecke(def), E = new Etappe(T, { auto });
  const R0 = E.rivalen[0];
  console.log(`${def.id}: ${(T.laenge / 1000).toFixed(2)} km, Plan ${zeitText(R0.zeit / R0.faktor)}, Schnellste ${zeitText(R0.zeit)}, Langsamste ${zeitText(E.rivalen[E.rivalen.length - 1].zeit)}`);
  console.log(`  ${E.ansagen.length} Ansagen in ${E.gruppen.length} Gruppen, ${E.zuschauer.length} Zuschauer-Stellen, ${E.felsen.length} Felsen, ${T.pfuetzen.length} Pfützen, ${(T.furten || []).length} Furt`);
  if (ansagen) console.log(E.gruppen.slice(0, 16).map(g => `    ${String(Math.round(g.s)).padStart(5)} m: ${g.sprache}`).join('\n'));
  E.countdown = 0;
  const a = E.ich.a; a.tc = true; a.arcade = !ohneHilfe;
  let zurueck = 0;
  if (vollgas) E.hilfe.bremsen = true;
  const kehren = []; let keh = null;
  let flug = 0, maxFlug = 0, stoesse = 0, neben = 0, maxQuer = 0, querZeit = 0; puffer.length = 0;
  for (let k = 0; k < 400 * 60 && E.phase !== 'fertig' && E.ich.ziel === null; k++) {
    E.update(1 / 60, (mensch ? menschFahrer : wild ? wilderFahrer : testFahrer)(a, T, E.L));
    while (E.ereignisse.length) if (E.ereignisse.shift().art === 'warn') zurueck++;
    if (a.luft) flug++;
    maxFlug = Math.max(maxFlug, a.flug || 0);
    if (a.stoss > 2) stoesse++;
    if (Math.abs(a.d) > T.hb[a.idx] + 0.3) neben++;
    const quer = Math.abs(Math.atan2(a.v, Math.abs(a.u) + 0.1)); if (quer > maxQuer) maxQuer = quer; if (quer > 0.5) querZeit++;
    if (Math.abs(T.k[a.idx]) > KEHRE) {
      if (!keh) kehren.push(keh = { t: 0, min: 999, plan: 0, drift: 0, bis20: null, rein: a.u });
      keh.t += 1 / 60; keh.drift = Math.max(keh.drift, Math.abs(a.drift || 0));
      if (a.u < keh.min) { keh.min = a.u; keh.plan = E.L.tempo[a.idx]; }
      if (keh.bis20 === null && Math.abs(a.drift || 0) > 0.35) keh.bis20 = keh.t;
      keh.raus = a.u;
    } else keh = null;
    if (process.env.SPUR && neben % 30 === 1 && Math.abs(a.d) > T.hb[a.idx] + 0.3) console.log(`    neben bei ${Math.round(E.weg)} m, ${Math.round(a.u * 3.6)} km/h, Luft ${a.luft}, Kurve ${T.k[a.idx].toFixed(3)}, Kuppe ${T.kv[a.idx].toFixed(4)}`);
  }
  console.log(`  ${mensch ? 'Mensch (0,22 s Verzug)' : wild ? 'Wilder Fahrer' : 'Testfahrer (' + Math.round(tempo * 100) + ' % vom Plan)'}${ohneHilfe ? ' ohne Hilfe' : ''}: ${zurueck}-mal zurückgesetzt, ${E.ich.ziel !== null ? zeitText(E.ich.ziel) + ', Platz ' + E.ich.platz : 'nicht im Ziel (' + Math.round(E.weg) + ' m)'}, ${(flug / 60).toFixed(1)} s in der Luft, längster Sprung ${maxFlug.toFixed(2)} s, ${stoesse} Bilder mit Anstoß, ${(neben / 60).toFixed(1)} s neben dem Weg, ${(querZeit / 60).toFixed(1)} s mehr als 29° quer`);
  if (kehren.length) {
    const m = f => (kehren.reduce((s, k) => s + f(k), 0) / kehren.length);
    console.log(`  ${kehren.length} Kehren: langsamste Stelle im Schnitt ${(m(k => k.min) * 3.6).toFixed(0)} km/h (${Math.round(m(k => k.min / k.plan) * 100)} % vom Plan, kleinste ${(Math.min(...kehren.map(k => k.min)) * 3.6).toFixed(0)} km/h), ${m(k => k.t).toFixed(2)} s je Kehre, Drift im Bild bis ${(m(k => k.drift) * 57.3).toFixed(0)}° (über 20° nach ${m(k => k.bis20 ?? k.t).toFixed(2)} s, in ${kehren.filter(k => k.bis20 !== null).length} Kehren)`);
  }
}
