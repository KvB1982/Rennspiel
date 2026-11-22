// Rennspiel – Bremshilfe nachmessen: Ein künstlicher Fahrer gibt immer Vollgas, die Bremshilfe bremst für ihn.
//   node tools/bremshilfe.mjs      zeigt je Strecke: Rundenzeit, Wand, Zeit neben der Straße und wie schnell es durch die Kurven geht
//   (v/Plan = Tempo am langsamsten Punkt der Kurve geteilt durch das Plan-Tempo dort; 1.00 = genau wie der Tempo-Plan)
import { STRECKEN } from '../js/strecken.js';
import { baueStrecke } from '../js/strecke.js';
import { neuesAuto, schritt, aufStrecke } from '../js/physik.js';
import { ideallinie, bremsHilfe } from '../js/ki.js';
const dt = 1/60;
for (const [art, id] of [['stallone','landstrasse'],['stallone','metropole'],['falkner','landstrasse'],['nordvind','staedtetour'],['f1','kueste'],['f1','hafen']]) for (const k of [1/0.35, 1/0.1]) {
  const def = STRECKEN.find(s => s.id === id); const T = baueStrecke(def);
  const a = neuesAuto(art); a.tc = true; a.arcade = true;
  const L = ideallinie(T, a.p, { rechts: !!def.strasse });
  aufStrecke(a, T, 0, 0);
  let t = 0, weg = 0, wand = 0, neben = 0, minV = 999, sumRatio = 0, nKurve = 0, bremsZeit = 0, maxBeta = 0, langsam = 0;
  const vmins = [];
  let inK = false, kMin = 999, kPlan = 0;
  while (t < 500 && weg < T.laenge) {
    const sh = Math.sin(a.h), ch = Math.cos(a.h);
    const i = T.index(a.s + 0.5 * Math.abs(a.u) + 6);
    const dx = L.lx[i] - a.x, dz = L.lz[i] - a.z;
    const w = Math.atan2(dx * ch - dz * sh, Math.max(1, dx * sh + dz * ch));
    a.lenkWunsch = Math.max(-1, Math.min(1, w * k));
    a.gas = 1; a.brems = 0;
    if (bremsHilfe(a, T, L)) bremsZeit += dt;
    const sAlt = a.s; schritt(a, T, dt); t += dt;
    let ds = a.s - sAlt; if (ds < -T.laenge/2) ds += T.laenge; if (ds > T.laenge/2) ds -= T.laenge; weg += ds;
    if (a.stoss > 2) wand++;
    if (Math.abs(a.d) > T.hb[a.idx] + 0.5) neben += dt;
    if (t > 5) { maxBeta = Math.max(maxBeta, Math.abs(Math.atan2(a.v, a.u))*57.3); }
    const plan = L.tempo[a.idx];
    const kurve = plan < a.p.vMax * 0.6;
    if (kurve) { inK = true; if (a.u/plan < kMin) { kMin = a.u/plan; kPlan = plan; } }
    else if (inK) { vmins.push(kMin); inK = false; kMin = 999; }
    if (t > 5 && a.u < 15) langsam += dt;
  }
  vmins.sort((p,q)=>p-q);
  const mid = vmins[Math.floor(vmins.length/2)] || 0;
  console.log(art.padEnd(9), id.padEnd(12), k > 5 ? 'wild ' : 'ruhig', weg >= T.laenge ? 'Runde ' + t.toFixed(1) : 'NICHT', 'Plan', (L.tempo.reduce((s,v)=>s+T.ds/Math.max(v,0.1),0)).toFixed(1), 'Wand', wand, 'neben', neben.toFixed(1), 'Kurven', vmins.length, 'v/Plan min', (vmins[0]||0).toFixed(2), 'median', mid.toFixed(2), 'unter 54 km/h', langsam.toFixed(1)+'s', 'maxDrift', maxBeta.toFixed(0));
}
