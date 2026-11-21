// Rennspiel – Slotcar: das Auto fährt in einem Schlitz der Bahn (ohne three.js, auch in node testbar).
//
// Ein Slotcar kann man nicht lenken. Man gibt nur Gas – wie mit dem Handregler einer Rennbahn.
// In der Kurve will das Auto geradeaus weiter. Der Schlitz hält es fest, aber nur bis zu einer Grenze:
// Die Kraft zur Seite wächst mit Tempo mal Tempo, geteilt durch den Kurvenhalbmesser.
// Ist man zu schnell, schwenkt erst das Heck aus, dann fliegt das Auto aus der Bahn.
// Also: vor der Kurve vom Gas gehen!
//
// Die Bahn hat zwei Spuren. An den Weichen kann man die Spur wechseln:
// Lenkrad nach links oder rechts halten, während das Auto über die Weiche fährt.

import { boxRel, boxLage, reifenHalt, ort } from './box.js';

export const WEICHE_LANG = 0.4;   // so lang ist eine Weiche (m)
const AUTO_LANG = 0.2;             // Platz, den ein Auto in seiner Spur braucht (m)
const RAUS_ZEIT = 2.2;             // so lange dauert es, bis das Auto wieder eingesetzt ist (s)

const klemme = (v, a, b) => Math.max(a, Math.min(b, v));
const weich = t => t * t * (3 - 2 * t);

// Wo die Weichen wirklich liegen (m ab Startlinie). Sie werden auf ein gerades Stück geschoben.
export function weichen(T) {
  if (T.weichenS) return T.weichenS;
  const n = T.n, ds = T.laenge / n, lang = Math.ceil(WEICHE_LANG / ds);
  const liste = [];
  for (const anteil of T.def.weichen || []) {
    let i = Math.floor(anteil * n);
    for (let versuch = 0; versuch < n; versuch++, i = (i + 1) % n) {
      let gerade = true;
      for (let k = 0; k <= lang; k++) if (Math.abs(T.k[(i + k + n) % n]) > 0.12) { gerade = false; break; }
      if (gerade) break;
    }
    const s = i * ds;
    if (!liste.some(w => Math.abs(w - s) < WEICHE_LANG * 2)) liste.push(s);
  }
  return (T.weichenS = liste.sort((a, b) => a - b));
}

// Auto in eine Spur setzen (spur: +1 = links, −1 = rechts)
export function slotStellen(c, T, s, spur) {
  const a = c.a, d = spur * T.def.spur, o = ort(T, s, d);
  c.slot = { spur, d, w: null, box: false, wunsch: 0, raus: 0, schwenk: 0, ueber: 0, vx: 0, vz: 0, dreh: 0, zahl: c.slot ? c.slot.zahl : 0 };
  a.s = ((s % T.laenge) + T.laenge) % T.laenge; a.d = d; a.idx = o.i;
  a.x = o.x; a.z = o.z; a.y = 0; a.h = Math.atan2(o.tx, o.tz);
  a.u = a.v = a.r = 0; a.lenk = 0; a.kippen = 0; a.neigung = 0; a.grund = 0; a.stoss = 0;
}

// Höchsttempo an jeder Stelle für beide Spuren (für die Computerfahrer): [rechte Spur, linke Spur]
export function slotPlan(T, p, sicher = 0.86) {
  const n = T.n, ds = T.laenge / n;
  return [-1, 1].map(spur => {
    const d = spur * T.def.spur, v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = Math.abs(T.k[i] / (1 - T.k[i] * d));
      v[i] = k > 1e-6 ? Math.min(p.vMax, Math.sqrt(p.haft * sicher / k)) : p.vMax;
    }
    // rückwärts: rechtzeitig vom Gas gehen und bremsen
    for (let k = 2 * n; k > 0; k--) { const i = k % n, j = (k + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * p.bremse * 0.6 * ds)); }
    return v;
  });
}

// Ein Bild weiter für ein Slotcar. alle = alle Autos im Rennen. Gibt 'raus' zurück, wenn es gerade rausfliegt.
export function slotSchritt(c, T, dt, alle) {
  const a = c.a, sl = c.slot, p = a.p, Lg = T.laenge;
  a.stoss = 0;

  // ---- neben der Bahn: rutschen, drehen, liegen bleiben – dann setzt eine Hand das Auto wieder ein
  if (sl.raus > 0) {
    sl.raus -= dt;
    const v = Math.hypot(sl.vx, sl.vz), neu = Math.max(0, v - 4.5 * dt);
    if (v > 1e-6) { sl.vx *= neu / v; sl.vz *= neu / v; }
    a.x += sl.vx * dt; a.z += sl.vz * dt; a.h += sl.dreh * dt;
    sl.dreh *= Math.exp(-dt * 2.4);
    a.u = 0; a.radDreh += neu * dt / 0.012;
    a.rutschHinten = Math.min(1, neu); a.drehzahl = 2000;
    if (sl.raus <= 0) {
      // Platz frei? Sonst noch kurz warten
      const besetzt = alle.some(o => o !== c && o.slot.raus <= 0 && Math.abs(o.slot.d - sl.spur * T.def.spur) < 0.06 && Math.abs(abstand(o.a.s, sl.rausS, Lg)) < AUTO_LANG * 1.6);
      if (besetzt) sl.raus = 0.15; else { const z = sl.zahl; slotStellen(c, T, sl.rausS, sl.spur); c.slot.zahl = z; }
    }
    return null;
  }

  // ---- Gas: Der Regler gibt dem Motor Spannung. Viel Gas = hohes Tempo, wenig Gas = der Motor bremst mit.
  // Leerer Tank: nur noch Schleichfahrt. Abgefahrene Reifen: weniger Halt in der Kurve.
  const vTop = p.vMax * (c.sprit === 0 ? 0.3 : 1), haft = p.haft * (c.reifen !== undefined ? reifenHalt(c) : 1);
  let v = Math.max(0, a.u);
  if (a.brems > 0.02) v = Math.max(0, v - p.bremse * a.brems * dt);
  else {
    const f = a.gas - v / vTop;
    v = Math.max(0, v + (f > 0 ? p.zug * f : Math.max(p.zug * f, -p.rollen * (0.45 + v / vTop))) * dt);
  }

  // ---- weiter im Schlitz
  const d0 = sl.d;
  const o0 = ort(T, a.s, d0);
  const vorher = a.s;
  let s = a.s + v * dt / (1 - o0.k * d0);     // innen ist der Weg kürzer, außen länger
  // Spurwechsel: Lenkrad links/rechts = Wunsch-Spur. Gewechselt wird nur an einer Weiche.
  const wunsch = sl.wunsch || (a.lenkWunsch > 0.3 ? 1 : a.lenkWunsch < -0.3 ? -1 : 0);
  // Boxengasse: rechts neben der Startgeraden zweigt ein dritter Schlitz ab.
  // Hinein kommt, wer auf der rechten Spur fährt und an der Einfahrt nach rechts lenkt.
  const B = T.box;
  if (B && !sl.box && !sl.w && sl.spur < 0) {
    const bisher = boxRel(T, vorher), jetzt = boxRel(T, s);
    if (bisher > B.lang && jetzt < 0.5 && (c.boxWill || a.lenkWunsch < -0.3)) sl.box = true;
  }
  if (!sl.box && !sl.w && wunsch && wunsch !== sl.spur) {
    for (const w of weichen(T)) {
      const bisher = abstand(vorher, w, Lg), jetzt = abstand(s, w, Lg);
      if (bisher < 0 && jetzt >= 0 && jetzt < WEICHE_LANG) {
        // nur wenn drüben kein Auto direkt daneben ist
        const frei = !alle.some(o => o !== c && o.slot.raus <= 0 && Math.sign(o.slot.d) === wunsch && Math.abs(abstand(o.a.s, s + WEICHE_LANG * 0.6, Lg)) < AUTO_LANG);
        if (frei) sl.w = { ab: w, von: sl.spur, nach: wunsch };
        break;
      }
    }
  }
  let schraeg = 0;
  if (sl.w) {
    const t = abstand(s, sl.w.ab, Lg) / WEICHE_LANG;
    if (t >= 1 || t < 0) { sl.spur = sl.w.nach; sl.d = sl.spur * T.def.spur; sl.w = null; }
    else {
      sl.d = T.def.spur * (sl.w.von + (sl.w.nach - sl.w.von) * weich(t));
      schraeg = Math.atan(T.def.spur * (sl.w.nach - sl.w.von) * 6 * t * (1 - t) / WEICHE_LANG);
    }
  }
  s = ((s % Lg) + Lg) % Lg;
  if (sl.box) {
    const rel = boxRel(T, s);
    if (rel >= B.lang) { sl.box = false; sl.d = -T.def.spur; }
    else { const neu = boxLage(T, rel, -T.def.spur); schraeg = v > 0.05 ? -Math.atan((neu - sl.d) / (v * dt)) : 0; sl.d = neu; }
  }
  const o = ort(T, s, sl.d);
  const kSpur = o.k / (1 - o.k * sl.d);
  const quer = v * v * Math.abs(kSpur);        // Kraft zur Seite (als Beschleunigung in m/s²)

  // ---- Heck schwenkt aus, wenn man nah an der Grenze ist
  const zielSchwenk = (klemme((quer / haft - 0.6) / 0.4, 0, 1) * 0.4 + klemme((quer / haft - 1) / 0.25, 0, 1) * 0.35) * Math.sign(kSpur);
  sl.schwenk += (zielSchwenk - sl.schwenk) * Math.min(1, dt * 14);
  a.s = s; a.d = sl.d; a.idx = o.i; a.u = v; a.v = 0; a.r = v * kSpur;
  a.x = o.x; a.z = o.z; a.y = 0;
  a.h = Math.atan2(o.tx, o.tz) + sl.schwenk - schraeg;
  a.lenk = Math.atan((p.a + p.b) * kSpur) - schraeg;
  a.radDreh += v * dt / 0.012;
  a.rutschVorn = 0; a.rutschHinten = klemme((quer / haft - 0.65) / 0.35, 0, 1);
  a.drehzahl = 2000 + (p.drehzahlMax - 2000) * Math.min(1, v / 4);
  a.kippen += (-sl.schwenk * 0.15 - a.kippen) * Math.min(1, dt * 8);

  // ---- zu schnell: raus!
  // Knapp über der Grenze driftet das Auto erst (Heck weit draußen, es wird langsamer) – das kann man noch retten.
  // Deutlich darüber oder zu lange gedriftet: Abflug.
  if (quer > haft * 1.25) sl.ueber += dt * 6;
  else if (quer > haft) { sl.ueber += dt; a.u = v = Math.max(0, v - 3 * dt); }
  else sl.ueber = Math.max(0, sl.ueber - dt * 2);
  if (sl.ueber > 0.45) {
    sl.raus = RAUS_ZEIT; sl.ueber = 0; sl.zahl++;
    sl.rausS = s; sl.w = null; sl.box = false; sl.d = sl.spur * T.def.spur;
    sl.vx = o.tx * v * 0.8; sl.vz = o.tz * v * 0.8;          // fliegt geradeaus weiter
    sl.dreh = Math.sign(kSpur) * (5 + v * 3);                 // und dreht sich dabei
    a.stoss = v; a.u = 0;
    return 'raus';
  }
  return null;
}

// Abstand entlang der Bahn von b nach a (plus = a ist weiter vorn), über die Startlinie hinweg richtig gerechnet
function abstand(a, b, Lg) { let d = a - b; if (d > Lg / 2) d -= Lg; if (d < -Lg / 2) d += Lg; return d; }

// In derselben Spur kann man nicht überholen: wer auffährt, wird gebremst und schubst den Vordermann ein wenig an
export function slotStoesse(alle, T) {
  const Lg = T.laenge;
  let stoss = 0;
  for (const h of alle) for (const vo of alle) {
    if (h === vo || h.slot.raus > 0 || vo.slot.raus > 0) continue;
    const ab = abstand(vo.a.s, h.a.s, Lg);
    if (ab <= 0 || ab > AUTO_LANG || Math.abs(h.slot.d - vo.slot.d) > 0.062) continue;
    if (h.a.u > vo.a.u) {
      const mehr = h.a.u - vo.a.u;
      vo.a.u += mehr * 0.35; h.a.u = Math.max(0, vo.a.u - 0.15);
      if (h.ich || vo.ich) stoss = Math.max(stoss, mehr);
    }
  }
  return stoss;
}

// Computerfahrer am Handregler: Gas nach Plan, Spur wechseln, wenn vorn jemand im Weg ist
export function slotFahren(c, T, plan, alle, dt) {
  const a = c.a, sl = c.slot, f = c.fahrer || c.auslauf, p = a.p, Lg = T.laenge;
  if (sl.raus > 0) { a.gas = 0; a.brems = 0; return; }
  const n = T.n, i = Math.floor((a.s + a.u * 0.1) / (Lg / n)) % n;
  let ziel = (sl.w ? Math.min(plan[0][i], plan[1][i]) : plan[sl.spur > 0 ? 1 : 0][i]) * Math.sqrt(c.reifen !== undefined ? reifenHalt(c) : 1);
  // Fehler: ab und zu fährt ein Fahrer eine Kurve zu mutig an (schwächere Fahrer öfter)
  f.fehlerZeit -= dt;
  if (f.fehlerZeit <= 0) { f.fehlerZeit = 3 + Math.random() * 6; f.mutig = Math.random() < (1 - f.staerke) * 1.6 ? 0.9 : 0; }
  if (f.mutig > 0) { f.mutig -= dt; ziel *= 1.14; } else ziel *= 0.88 + f.staerke * 0.1;
  sl.wunsch = 0;
  // Boxenstopp: auf die rechte Spur, in die Boxengasse, in der Mitte anhalten, warten, weiter
  if (c.boxWill && sl.spur > 0 && !sl.w) sl.wunsch = -1;
  if (sl.box && c.boxWill) {
    const halt = T.box.lang / 2, rel = boxRel(T, a.s);
    ziel = rel >= halt - 0.03 ? 0 : Math.min(ziel, 0.25 + Math.sqrt(2 * 3 * (halt - rel)));
  }
  for (const o of alle) {
    if (o === c || o.slot.raus > 0) continue;
    const ab = abstand(o.a.s, a.s, Lg);
    if (ab > 0 && ab < 0.7 && Math.abs(o.slot.d - sl.d) < 0.06) {
      if (o.a.u < a.u + 0.3 && !c.boxWill) sl.wunsch = -sl.spur;             // an der nächsten Weiche vorbei
      if (ab < 0.32) ziel = Math.min(ziel, o.a.u);
    }
  }
  const v = a.u;
  if (ziel <= 0) { a.gas = 0; a.brems = 1; }
  else if (v > ziel + 0.02) { a.gas = 0; a.brems = klemme((v - ziel) / 0.25, 0.3, 1); }
  else { a.brems = 0; a.gas = klemme(ziel / p.vMax + (ziel - v) * 1.2, 0, 1); }
}
