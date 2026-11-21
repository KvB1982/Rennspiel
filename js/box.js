// Rennspiel – Boxengasse für die kleinen Autos: Tanken und Reifen wechseln (ohne three.js, auch in node testbar).
//
// Der Tank wird beim Fahren leer, die Reifen nutzen sich ab (dann haften sie schlechter).
// Die Boxengasse liegt rechts neben der Start-Ziel-Geraden. Wer dort im Halte-Bereich stehen bleibt,
// bekommt in ein paar Sekunden Sprit und neue Reifen.
// Alle Zahlen sind geschätzt.

export const TANK_RUNDEN = 6;      // so viele Runden reicht ein voller Tank bei Vollgas
export const REIFEN_RUNDEN = 9;    // so viele Runden halten die Reifen
export const DIENST_DAUER = 2.5;   // so lange dauert der Boxenstopp im Stand (s)

const weich = t => t * t * (3 - 2 * Math.max(0, Math.min(1, t))) * (t < 0 ? 0 : 1);
const glatt = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// Legt die Boxengasse an: sucht das gerade Stück um die Startlinie und merkt sich Anfang, Länge und Lage.
export function boxAnlegen(T) {
  const n = T.n, ds = T.laenge / n, def = T.def, slot = !!def.slot;
  let a = 0; while (a > -n / 2 && Math.abs(T.k[((a - 1) % n + n) % n]) < 0.03) a--;
  let b = 0; while (b < n / 2 && Math.abs(T.k[(b + 1) % n]) < 0.03) b++;
  const rand = slot ? 0.1 : 0.25;
  const lang = (b - a) * ds - 2 * rand;
  if (lang < 2.2) return (T.box = null);
  const breite = slot ? 0.18 : 0.34, rampe = slot ? 0.5 : 0.6;
  T.box = {
    ab: ((a * ds + rand) % T.laenge + T.laenge) % T.laenge,   // hier beginnt die Boxengasse (m ab Startlinie)
    lang, rampe, breite,
    d: -(T.hb[0] + breite / 2),                                // Mitte der Boxengasse (minus = rechts von der Strecke)
    halt: [rampe + 0.1, lang - rampe - 0.1],                   // in diesem Stück darf man halten
  };
  if (!slot) {
    // ferngesteuertes Auto: rechts ist die Bande weiter weg, dazwischen liegt die Boxengasse (glatter Boden)
    for (let i = a + Math.round(rand / ds); i <= b - Math.round(rand / ds); i++) {
      const m = ((i % n) + n) % n;
      T.ausR[m] = breite + 0.02; T.artR[m] = 0; T.kerbR[m] = 0;
    }
  }
  return T.box;
}

// Wie weit ist man in der Boxengasse? 0 = Einfahrt, box.lang = Ausfahrt. Größer als box.lang = nicht daneben.
export function boxRel(T, s) { const L = T.laenge; return (((s - T.box.ab) % L) + L) % L; }

// Seitliche Lage in der Boxengasse an der Stelle rel, wenn man von der Lage "von" hinein- und zur Lage "nach" hinausfährt
export function boxLage(T, rel, von, nach = von) {
  const B = T.box;
  if (rel < B.rampe) return von + (B.d - von) * glatt(rel / B.rampe);
  if (rel > B.lang - B.rampe) return B.d + (nach - B.d) * glatt((rel - (B.lang - B.rampe)) / B.rampe);
  return B.d;
}

// Steht das Auto im Halte-Bereich der Boxengasse?
export function imHalteBereich(T, a) {
  const B = T.box; if (!B) return false;
  const rel = boxRel(T, a.s);
  return rel >= B.halt[0] && rel <= B.halt[1] && a.d < -(T.hb[Math.max(0, a.idx)] + 0.015);
}

// Neues Auto: voller Tank, frische Reifen
export function boxNeu(c) { c.sprit = 1; c.reifen = 1; c.dienst = 0; c.boxWill = false; c.stopps = 0; }

// Verbrauch in einem Bild. Lg = Länge der Runde.
export function verbrauch(c, dt, Lg) {
  const a = c.a, v = Math.abs(a.u);
  c.sprit = Math.max(0, c.sprit - (0.25 + 0.75 * (a.gas || 0)) * v * dt / (TANK_RUNDEN * Lg));
  c.reifen = Math.max(0, c.reifen - v * dt * (1 + 2 * (a.rutschHinten || 0)) / (REIFEN_RUNDEN * Lg));
}

// Abgefahrene Reifen haften schlechter (1 = neu, 0,7 = ganz abgefahren)
export const reifenHalt = c => 0.7 + 0.3 * (c.reifen ?? 1);

// Boxenstopp: steht das Auto im Halte-Bereich, wird getankt und gewechselt. Gibt 'fertig' zurück, wenn alles erledigt ist.
export function boxDienst(c, T, dt) {
  if (!imHalteBereich(T, c.a) || Math.abs(c.a.u) > 0.08) { c.dienst = 0; return null; }
  if (c.sprit >= 1 && c.reifen >= 1) return null;
  c.dienst += dt;
  c.sprit = Math.min(1, c.sprit + dt / DIENST_DAUER);
  if (c.dienst >= DIENST_DAUER) { c.sprit = 1; c.reifen = 1; c.dienst = 0; c.boxWill = false; c.stopps++; return 'fertig'; }
  return 'laeuft';
}

// Ort neben/auf der Strecke: s Meter nach der Startlinie, d Meter links von der Mitte
export function ort(T, s, d) {
  const n = T.n, ds = T.laenge / n;
  const f = ((s % T.laenge) + T.laenge) % T.laenge / ds, i = Math.floor(f) % n, j = (i + 1) % n, t = f - Math.floor(f);
  const tx = T.tx[i] + (T.tx[j] - T.tx[i]) * t, tz = T.tz[i] + (T.tz[j] - T.tz[i]) * t;
  return {
    i, tx, tz, k: T.k[i] + (T.k[j] - T.k[i]) * t,
    x: T.x[i] + (T.x[j] - T.x[i]) * t + tz * d, z: T.z[i] + (T.z[j] - T.z[i]) * t - tx * d,
  };
}

// Computerfahrer mit ferngesteuertem Auto: fährt wie auf einer Schiene durch die Boxengasse
// (rein, anhalten, tanken, raus). Gibt false zurück, wenn er wieder selbst fährt.
export function boxFahrt(c, T, dt, nr = 0) {
  const a = c.a, B = T.box;
  if (!c.bf) c.bf = { von: a.d, fertig: false, halt: B.lang / 2 + ((nr % 3) - 1) * 0.3 };
  const bf = c.bf;
  let rel = boxRel(T, a.s);
  if (rel > B.lang + 1) rel = 0;   // kurz vor der Einfahrt
  let ziel;
  if (!bf.fertig) {
    ziel = Math.min(1.1, Math.sqrt(2 * 2.2 * Math.max(0, bf.halt - rel)));
    if (rel >= bf.halt - 0.015) ziel = 0;
  } else ziel = 1.3;
  a.u += Math.max(-4 * dt, Math.min(2.5 * dt, ziel - a.u));
  if (ziel === 0 && a.u < 0.1) a.u = 0;
  const dVor = boxLage(T, rel, bf.von, -T.hb[0] * 0.35);
  a.s = (a.s + a.u * dt) % T.laenge;
  rel = boxRel(T, a.s);
  const raus = rel >= B.lang && rel < B.lang + 1;
  const d = raus ? -T.hb[0] * 0.35 : boxLage(T, rel, bf.von, -T.hb[0] * 0.35);
  const o = ort(T, a.s, d);
  a.x = o.x; a.z = o.z; a.y = T.y[o.i]; a.d = d; a.idx = o.i;
  a.h = Math.atan2(o.tx, o.tz) - (a.u > 0.05 ? Math.atan((d - dVor) / (a.u * dt)) : 0);
  a.v = 0; a.r = 0; a.lenk = 0; a.gas = a.u < ziel ? 0.5 : 0; a.brems = 0; a.stoss = 0;
  a.radDreh += a.u * dt / 0.012;
  if (!bf.fertig && boxDienst(c, T, dt) === 'fertig') bf.fertig = true;
  if (raus) { c.bf = null; return false; }
  return true;
}
