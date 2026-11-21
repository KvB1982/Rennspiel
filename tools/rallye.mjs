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
  const a = E.ich.a;
  let flug = 0, maxFlug = 0, stoesse = 0;
  for (let k = 0; k < 400 * 60 && E.phase !== 'fertig' && E.ich.ziel === null; k++) {
    E.update(1 / 60, testFahrer(a, T, E.L));
    if (a.luft) flug++;
    maxFlug = Math.max(maxFlug, a.flug || 0);
    if (a.stoss > 2) stoesse++;
  }
  console.log(`  Testfahrer (${Math.round(tempo * 100)} % vom Plan): ${E.ich.ziel !== null ? zeitText(E.ich.ziel) + ', Platz ' + E.ich.platz : 'nicht im Ziel (' + Math.round(E.weg) + ' m)'}, ${(flug / 60).toFixed(1)} s in der Luft, längster Sprung ${maxFlug.toFixed(2)} s, ${stoesse} Bilder mit Anstoß`);
}
