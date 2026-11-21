// Rennspiel – die Mittellinie einer Rennstrecke ausrechnen (ohne three.js, auch in node testbar).
//
// Eine Strecke wird wie mit einer Schildkröte beschrieben, die über den Boden läuft:
//   { g: 600 }              = 600 Meter geradeaus
//   { r: 25, w: 100 }       = Kurve mit 25 Metern Halbmesser, 100 Grad nach links (minus = nach rechts)
// Damit die Schildkröte wieder genau am Start ankommt, dürfen Geraden mit "frei: true" länger oder kürzer werden.
// Das rechnet das Programm selbst aus.
//
// Danach liegt alle paar Meter ein Messpunkt auf der Mittellinie. Jeder Punkt weiß:
// wo er liegt (x, z), wie hoch (y), wohin die Strecke zeigt, wie stark sie sich dort biegt,
// wie breit sie ist und was neben der Strecke kommt (Gras, Kies, Mauer).

export const BELAG = { asphalt: 0, kerb: 1, gras: 2, kies: 3, mauer: 4 };
const AUS_CODE = { gras: 2, kies: 3, mauer: 4, asphalt: 0 };

// Ein Stück der Strecke ablaufen: liefert Punkte im Abstand ds
function ablaufen(teile, ds, freiLaengen) {
  const pts = [];
  let x = 0, z = 0, th = 0;   // th = Richtung (0 = nach +z, größer = nach links gedreht)
  let fi = 0;
  for (const t of teile) {
    if (t.g !== undefined) {
      const L = t.frei ? freiLaengen[fi++] : t.g;
      const n = Math.max(1, Math.round(L / ds));
      for (let k = 0; k < n; k++) {
        pts.push({ x, z, th, teil: t, kurve: 0 });
        x += Math.sin(th) * L / n; z += Math.cos(th) * L / n;
      }
    } else {
      const w = t.w * Math.PI / 180, L = Math.abs(w) * t.r;
      const n = Math.max(1, Math.round(L / ds));
      for (let k = 0; k < n; k++) {
        pts.push({ x, z, th, teil: t, kurve: Math.sign(w) / t.r });
        // kleines Stück auf dem Kreisbogen: erst halb drehen, laufen, dann wieder halb drehen (sehr genau)
        const dth = w / n, dl = L / n;
        th += dth / 2; x += Math.sin(th) * dl; z += Math.cos(th) * dl; th += dth / 2;
      }
    }
  }
  return { pts, x, z, th };
}

// Die Geraden mit frei: true so lang machen, dass die Strecke sich schließt
function schliessen(teile) {
  // Die letzte Kurve wird so gedreht, dass am Ende genau eine ganze Runde (360 Grad) herauskommt.
  let summe = 0, letzte = null;
  for (const t of teile) if (t.w !== undefined) { summe += t.w; letzte = t; }
  const ziel = summe >= 0 ? 360 : -360;
  if (letzte) letzte.w += ziel - summe;
  const frei = teile.filter(t => t.frei);
  const basis = frei.map(t => t.g);
  // Richtung jeder freien Geraden (hängt nicht von den Längen ab, weil Geraden nicht drehen)
  const richt = [];
  {
    let th = 0;
    for (const t of teile) {
      if (t.frei) richt.push([Math.sin(th), Math.cos(th)]);
      if (t.w !== undefined) th += t.w * Math.PI / 180;
    }
  }
  const e = ablaufen(teile, 4, basis);
  // Kleinste Änderung der Längen, damit der Endpunkt auf den Start fällt: Δ = Dᵀ (D Dᵀ)⁻¹ (−E)
  let a = 0, b = 0, c = 0;
  for (const [dx, dz] of richt) { a += dx * dx; b += dx * dz; c += dz * dz; }
  const det = a * c - b * b;
  if (frei.length < 2 || Math.abs(det) < 1e-6) throw new Error('Strecke lässt sich nicht schließen: zwei freie Geraden in verschiedene Richtungen nötig');
  const ex = -e.x, ez = -e.z;
  const l1 = (c * ex - b * ez) / det, l2 = (-b * ex + a * ez) / det;
  return basis.map((L, k) => L + richt[k][0] * l1 + richt[k][1] * l2);
}

// Weiche Werte rundherum: Mittelwert mit den Nachbarn, mehrmals (die Liste ist ein Ring)
function glaetten(arr, mal, staerke = 0.5) {
  const n = arr.length;
  let a = Float64Array.from(arr), b = new Float64Array(n);
  for (let m = 0; m < mal; m++) {
    for (let i = 0; i < n; i++) b[i] = a[i] * (1 - staerke) + (a[(i + n - 1) % n] + a[(i + 1) % n]) * staerke / 2;
    [a, b] = [b, a];
  }
  return a;
}

// Strecke aus Eckpunkten: [x, z, Kurvenhalbmesser, { Angaben für diese Kurve }].
// Zwischen den Ecken liegen Geraden, jede Ecke wird mit einem Kreisbogen abgerundet. So geht die Runde immer auf.
// Die Startlinie liegt auf der Geraden von der letzten zur ersten Ecke (start = Anteil dieser Geraden, Standard 0,6).
export function eckenZuTeilen(ecken, start = 0.6) {
  const n = ecken.length, th = [], L = [];
  for (let i = 0; i < n; i++) {
    const a = ecken[i], b = ecken[(i + 1) % n];
    th.push(Math.atan2(b[0] - a[0], b[1] - a[1])); L.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  // Ecke i liegt zwischen Gerade i-1 und Gerade i
  const phi = [], tl = [];
  for (let i = 0; i < n; i++) {
    let d = th[i] - th[(i + n - 1) % n];
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    phi.push(d); tl.push(ecken[i][2] * Math.tan(Math.abs(d) / 2));
  }
  const teile = [];
  const gerade = i => {
    const g = L[i] - tl[i] - tl[(i + 1) % n];
    if (g < -1e-6) throw new Error(`Ecken ${i} und ${(i + 1) % n} liegen zu nah für ihre Kurven (${g.toFixed(1)} m)`);
    return Math.max(0, g);
  };
  const letzte = n - 1, gl = gerade(letzte);
  teile.push({ g: gl * (1 - start), ...(ecken[letzte][3] || {}), start: true });
  for (let i = 0; i < n; i++) {
    const info = ecken[i][3] || {};
    teile.push({ r: ecken[i][2], w: phi[i] * 180 / Math.PI, ...info });
    if (i < n - 1) teile.push({ g: gerade(i), ...(ecken[i][4] || {}) });
  }
  teile.push({ g: gl * start, ...(ecken[letzte][4] || {}) });
  // Wo die Startlinie in der Welt liegt und wohin sie zeigt (damit die Strecke dort liegt, wo die Ecken sind)
  const a = ecken[letzte], t = th[letzte], weg = tl[letzte] + gl * (1 - start);
  const lage = { x: a[0] + Math.sin(t) * weg, z: a[1] + Math.cos(t) * weg, th: t };
  return { teile: teile.filter(t => t.g === undefined || t.g > 1e-6), lage };
}

// Maßstab der kleinen Autos (ferngesteuertes Auto und Slotcar): 1:30. Ein 5,6 m langer Rennwagen ist dann knapp 19 cm lang.
export const MASSSTAB = 1 / 30;

export function baueStrecke(def) {
  const ek = def.ecken ? eckenZuTeilen(def.ecken, def.start ?? 0.4) : null;
  const teile = (ek ? ek.teile : def.teile).map(t => ({ ...t }));
  const ds = def.ds || 2;
  const freiL = ek ? [] : schliessen(teile);
  const roh = ablaufen(teile, ds, freiL).pts;
  if (ek) {
    // aus der Sicht der Schildkröte in die Welt drehen und schieben
    const { x: ox, z: oz, th } = ek.lage, c = Math.cos(th), sn = Math.sin(th);
    for (const p of roh) { const x = p.x, z = p.z; p.x = ox + x * c + z * sn; p.z = oz - x * sn + z * c; }
  }
  const n = roh.length;

  // Mittellinie glätten, damit Kurven weich ein- und auslaufen (wie bei echten Strecken)
  const gl = def.glatt ?? 25;
  const X = glaetten(roh.map(p => p.x), gl), Z = glaetten(roh.map(p => p.z), gl);

  const T = {
    def, n, ds, name: def.name,
    x: new Float32Array(n), z: new Float32Array(n), y: new Float32Array(n),
    tx: new Float32Array(n), tz: new Float32Array(n),     // Richtung der Strecke
    k: new Float32Array(n),                                // Krümmung (+ = Linkskurve), 1 / Halbmesser
    s: new Float32Array(n),                                // Meter seit der Startlinie
    hb: new Float32Array(n),                               // halbe Breite der Fahrbahn
    ausL: new Float32Array(n), ausR: new Float32Array(n),  // Breite des Auslaufs links/rechts bis zur Begrenzung
    artL: new Uint8Array(n), artR: new Uint8Array(n),      // was im Auslauf liegt (BELAG)
    kerbL: new Uint8Array(n), kerbR: new Uint8Array(n),    // liegt hier ein rot-weißer Randstein?
    laenge: 0, freiL,
  };
  let s = 0;
  for (let i = 0; i < n; i++) {
    T.x[i] = X[i]; T.z[i] = Z[i];
    if (i > 0) s += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
    T.s[i] = s;
  }
  T.laenge = s + Math.hypot(X[0] - X[n - 1], Z[0] - Z[n - 1]);

  // Richtung und Krümmung
  const th = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    let dx = X[b] - X[a], dz = Z[b] - Z[a];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    T.tx[i] = dx; T.tz[i] = dz; th[i] = Math.atan2(dx, dz);
  }
  for (let i = 0; i < n; i++) {
    let d = th[(i + 1) % n] - th[(i + n - 1) % n];
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    T.k[i] = d / (2 * ds);
  }
  const kGlatt = glaetten(T.k, 4);
  for (let i = 0; i < n; i++) T.k[i] = kGlatt[i];

  // Höhe: Stützwerte [Anteil der Runde 0…1, Höhe in m], weich verbunden
  const hp = (def.hoehe || [[0, 0]]).slice().sort((p, q) => p[0] - q[0]);
  const hoeheBei = f => {
    if (hp.length === 1) return hp[0][1];
    for (let j = 0; j < hp.length; j++) {
      const p = hp[j], q = hp[(j + 1) % hp.length];
      const f0 = p[0], f1 = j + 1 < hp.length ? q[0] : q[0] + 1;
      let ff = f; if (ff < f0) ff += 1;
      if (ff >= f0 && ff <= f1) { const u = (ff - f0) / (f1 - f0 || 1); const w = (1 - Math.cos(u * Math.PI)) / 2; return p[1] + (q[1] - p[1]) * w; }
    }
    return hp[0][1];
  };
  const Y = glaetten(Array.from({ length: n }, (_, i) => hoeheBei(T.s[i] / T.laenge)), 10);
  for (let i = 0; i < n; i++) T.y[i] = Y[i];

  // Breite und Auslauf je Streckenteil, weich ineinander übergehend
  const hbRoh = [], aL = [], aR = [];
  for (let i = 0; i < n; i++) {
    const t = roh[i].teil;
    hbRoh.push((t.breite || def.breite || 12) / 2);
    let l = t.aus || def.aus || null, r = l;
    if (typeof l === 'object' && l) { r = l.r; l = l.l; }
    // ohne Angabe: in Kurven Kies außen, Gras innen; auf Geraden Gras
    if (!l) {
      const kv = roh[i].kurve;
      l = kv < 0 ? 'kies' : 'gras'; r = kv > 0 ? 'kies' : 'gras';
    }
    T.artL[i] = AUS_CODE[l] ?? 2; T.artR[i] = AUS_CODE[r] ?? 2;
    const breit = art => art === 'mauer' ? (def.mauerAbstand ?? 1.2) : art === 'kies' ? (t.kiesBreite || def.kiesBreite || 26) : (t.grasBreite || def.grasBreite || 16);
    aL.push(breit(l)); aR.push(breit(r));
  }
  // Auf der Innenseite enger Kurven darf der Auslauf nicht über den Kurvenmittelpunkt hinausreichen
  for (let i = 0; i < n; i++) {
    const k = Math.max(Math.abs(T.k[(i + n - 3) % n]), Math.abs(T.k[i]), Math.abs(T.k[(i + 3) % n]));
    if (k < 1e-6) continue;
    const platz = Math.max(0.5 * hbRoh[i], 0.85 / k - hbRoh[i]);
    if (T.k[i] > 0) aL[i] = Math.min(aL[i], platz); else aR[i] = Math.min(aR[i], platz);
  }
  const HB = glaetten(hbRoh, 20), AL = glaetten(aL, 15), AR = glaetten(aR, 15);
  for (let i = 0; i < n; i++) { T.hb[i] = HB[i]; T.ausL[i] = Math.min(AL[i], aL[i] + 2 * HB[i]); T.ausR[i] = Math.min(AR[i], aR[i] + 2 * HB[i]); }

  // Randsteine: dort, wo die Kurve eng genug ist (innen und außen), etwas verlängert
  const kerbAb = def.kerbAb || 1 / 220;
  const vor = Math.round(14 / ds);
  for (let i = 0; i < n; i++) {
    if (Math.abs(T.k[i]) < kerbAb) continue;
    for (let j = -vor; j <= vor; j++) {
      const m = (i + j + n) % n;
      if (T.artL[m] !== 4) T.kerbL[m] = 1;
      if (T.artR[m] !== 4) T.kerbR[m] = 1;
    }
  }

  // ---------------------------------------------------------------- Nachschlagen: Wo auf der Strecke ist ein Punkt?
  // Sucht in der Nähe des letzten bekannten Messpunkts (hint). Ohne hint wird die ganze Strecke durchsucht.
  T.finde = (px, pz, hint = -1, fenster = 40) => {
    let best = -1, bd = Infinity;
    if (hint < 0) {
      for (let i = 0; i < n; i += 2) { const d = (T.x[i] - px) ** 2 + (T.z[i] - pz) ** 2; if (d < bd) { bd = d; best = i; } }
      fenster = 4;
      hint = best;
    }
    bd = Infinity;
    for (let j = -fenster; j <= fenster; j++) {
      const i = (hint + j + n) % n;
      const d = (T.x[i] - px) ** 2 + (T.z[i] - pz) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    // genauer: auf dem Stück zum nächsten Punkt zurechtrücken
    const i = best, j = (i + 1) % n, h = (i + n - 1) % n;
    let a = i, b = j;
    const proj = (a, b) => {
      const ex = T.x[b] - T.x[a], ez = T.z[b] - T.z[a], l2 = ex * ex + ez * ez || 1;
      return ((px - T.x[a]) * ex + (pz - T.z[a]) * ez) / l2;
    };
    let t = proj(i, j);
    if (t < 0) { a = h; b = i; t = proj(h, i); }
    t = Math.max(0, Math.min(1, t));
    const cx = T.x[a] + (T.x[b] - T.x[a]) * t, cz = T.z[a] + (T.z[b] - T.z[a]) * t;
    const tx = T.tx[a] + (T.tx[b] - T.tx[a]) * t, tz = T.tz[a] + (T.tz[b] - T.tz[a]) * t;
    // links von der Fahrtrichtung ist (tz, -tx)
    const d = (px - cx) * tz - (pz - cz) * tx;
    let sa = T.s[a], sb = b === 0 ? T.laenge : T.s[b];
    return { i: best, a, b, t, d, s: sa + (sb - sa) * t, y: T.y[a] + (T.y[b] - T.y[a]) * t, tx, tz };
  };

  // Wert an einer Stelle s (Meter seit dem Start) – für weiche Übergänge
  T.index = s => { s = ((s % T.laenge) + T.laenge) % T.laenge; return Math.min(n - 1, Math.floor(s / T.laenge * n)); };
  return T;
}

// Prüft, ob sich die Strecke irgendwo selbst berührt (für das Testwerkzeug)
export function selbstBeruehrung(T) {
  const n = T.n, stufe = Math.max(1, Math.round(T.hb[0] / T.ds / 2));
  let min = Infinity, wo = -1;
  for (let i = 0; i < n; i += stufe) for (let j = i + stufe; j < n; j += stufe) {
    let ab = Math.abs(T.s[i] - T.s[j]); ab = Math.min(ab, T.laenge - ab);
    const platz = T.hb[i] + T.hb[j] + Math.min(T.ausL[i], T.ausR[i], 8) + 4;
    if (ab < platz * 3) continue;
    const d = Math.hypot(T.x[i] - T.x[j], T.z[i] - T.z[j]) - (T.hb[i] + T.hb[j]);
    if (d < min) { min = d; wo = i; }
  }
  return { abstand: min, wo };
}
