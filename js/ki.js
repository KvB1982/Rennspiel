// Rennspiel – die Computerfahrer und die Ideallinie (ohne three.js, auch in node testbar).
//
// Ideallinie: Rennfahrer fahren Kurven außen an, innen am Scheitelpunkt vorbei und wieder nach außen.
// So wird die Kurve weniger eng und man ist schneller. Das Programm findet diese Linie, indem es jeden Punkt
// immer wieder ein Stück in die Mitte seiner Nachbarn schiebt (dann wird die Linie so gerade wie möglich).
//
// Tempo-Plan: Für jede Stelle der Linie wird ausgerechnet, wie schnell man dort höchstens sein kann
// und wo man vorher bremsen muss. Danach richten sich die Computerfahrer – und die Bremshilfe für dich.

import { lenkGrenze } from './physik.js';
import { MASSSTAB } from './strecke.js';

const G = 9.81, LUFT = 1.2;

// rechts = true: auf Straßen mit Gegenverkehr bleibt die Linie auf der rechten Straßenhälfte
export function ideallinie(T, p, { rechts = false } = {}) {
  const n = T.n;
  const schritt = Math.max(1, Math.round((T.def.modell ? 0.25 : 10) / T.ds));
  const m = Math.floor(n / schritt);
  const rand = T.def.modell ? 0.06 : 1.6;
  const cx = [], cz = [], nx = [], nz = [], lim = [], oben = [];
  for (let j = 0; j < m; j++) {
    const i = j * schritt;
    cx.push(T.x[i]); cz.push(T.z[i]); nx.push(T.tz[i]); nz.push(-T.tx[i]);
    lim.push(Math.max(0, T.hb[i] - rand));
    // Gegenverkehr links: höchstens bis kurz über die Mittellinie (nicht auf der Autobahn, dort ist die ganze Breite deine)
    oben.push(rechts && T.zone && T.zone[i] !== 3 ? Math.min(lim[j], T.hb[i] * 0.06) : lim[j]);
  }
  const o = new Float64Array(m);
  for (let it = 0; it < 900; it++) {
    for (let j = 0; j < m; j++) {
      const a = (j + m - 1) % m, b = (j + 1) % m;
      const px = (cx[a] + nx[a] * o[a] + cx[b] + nx[b] * o[b]) / 2;
      const pz = (cz[a] + nz[a] * o[a] + cz[b] + nz[b] * o[b]) / 2;
      let w = (px - cx[j]) * nx[j] + (pz - cz[j]) * nz[j];
      o[j] = Math.max(-lim[j], Math.min(oben[j], o[j] + (w - o[j]) * 0.8));
    }
  }
  // zurück auf alle Messpunkte verteilen
  const off = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = Math.floor(i / schritt) % m, f = (i % schritt) / schritt, j2 = (j + 1) % m;
    off[i] = o[j] * (1 - f) + o[j2] * f;
  }
  // Punkte der Linie und ihre Krümmung
  const lx = new Float32Array(n), lz = new Float32Array(n), kr = new Float32Array(n);
  for (let i = 0; i < n; i++) { lx[i] = T.x[i] + T.tz[i] * off[i]; lz[i] = T.z[i] - T.tx[i] * off[i]; }
  const w = schritt;
  for (let i = 0; i < n; i++) {
    const a = (i + n - w) % n, b = (i + w) % n;
    const ax = lx[i] - lx[a], az = lz[i] - lz[a], bx = lx[b] - lx[i], bz = lz[b] - lz[i];
    const kreuz = ax * bz - az * bx, la = Math.hypot(ax, az), lb = Math.hypot(bx, bz), lc = Math.hypot(lx[b] - lx[a], lz[b] - lz[a]);
    kr[i] = la * lb * lc > 1e-9 ? Math.abs(2 * kreuz / (la * lb * lc)) : 0;
  }
  return { off, lx, lz, kr, tempo: tempoPlan(T, kr, p) };
}

// Höchsttempo an jeder Stelle (m/s), mit Bremszonen davor
export function tempoPlan(T, kr, p, sicher = 0.9) {
  const n = T.n, ds = T.ds;
  const q = 0.5 * LUFT * p.abtrieb / p.masse;   // Abtrieb pro Tempo² und kg
  const mu = p.haft * sicher;
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = kr[i], nenner = k - mu * q;
    v[i] = nenner <= 0 ? p.vMax : Math.min(p.vMax, Math.sqrt(mu * G / nenner));
  }
  const wid = 0.5 * LUFT * p.widerstand / p.masse;
  for (let runde = 0; runde < 2; runde++) {
    // rückwärts: rechtzeitig bremsen
    for (let k = 2 * n; k > 0; k--) {
      const i = k % n, j = (k + 1) % n;
      const vj = v[j];
      const brems = mu * (G + q * vj * vj) * p.bremse * (p.bremsGriff || 1) * 0.8 + wid * vj * vj;
      v[i] = Math.min(v[i], Math.sqrt(vj * vj + 2 * brems * ds));
    }
    // vorwärts: beschleunigen braucht Zeit
    for (let k = 0; k < 2 * n; k++) {
      const i = k % n, j = (k + 1) % n;
      const vi = Math.max(v[i], 1);
      const zug = Math.min(p.leistung / (p.masse * vi), p.schubMax / p.masse, mu * (G + q * vi * vi) * 0.55) - wid * vi * vi;
      v[j] = Math.min(v[j], Math.sqrt(Math.max(0, v[i] * v[i] + 2 * Math.max(0, zug) * ds)));
    }
  }
  return v;
}

// Ein Computerfahrer. staerke 0.8 … 1.0 = wie nah am Höchsttempo er fährt.
export function neuerFahrer(staerke = 0.95, mut = 0.5) {
  return { staerke, mut, extra: 0, extraZiel: 0, fehlerZeit: 0, fehler: 0 };
}

// Lenkung zu einer Stelle auf der Ideallinie (auch für die Lenkhilfe des Spielers)
export function lenkZurLinie(a, T, L, extra = 0, vorausMal = 1) {
  const p = a.p, sc = T.def.modell ? MASSSTAB : 1;
  // kleine Autos fahren (für ihre Größe) viel engere Kurven: sie schauen weniger weit voraus
  const voraus = Math.max(7 * sc, ((T.def.modell ? 0.2 : 0.45) * Math.abs(a.u) + 4 * sc) * vorausMal);
  const i = T.index(a.s + voraus);
  const tx = L.lx[i] + T.tz[i] * extra, tz = L.lz[i] - T.tx[i] * extra;
  const dx = tx - a.x, dz = tz - a.z;
  const sh = Math.sin(a.h), ch = Math.cos(a.h);
  const vor = dx * sh + dz * ch, links = dx * ch - dz * sh;
  const al = Math.atan2(links, Math.max(vor, 0.1 * sc));
  const ld = Math.hypot(dx, dz);
  const delta = Math.atan(2 * (p.a + p.b) * Math.sin(al) / Math.max(ld, 1e-3));
  return Math.max(-1, Math.min(1, delta / lenkGrenze(p, a.u)));
}

// Fahrer entscheidet: lenken, Gas, Bremse. andere = alle Autos im Rennen (für Überholen)
export function fahren(f, a, T, L, andere, dt) {
  const p = a.p, sc = T.def.modell ? MASSSTAB : 1;
  const hbRand = T.hb[Math.max(0, a.idx)] - (T.def.modell ? 0.06 : 2);
  // Überholen und Ausweichen: Ist vorn jemand langsamer auf meiner Linie (ein Rennauto, ein Auto im Verkehr,
  // Gegenverkehr)? Dann auf der Seite vorbei, auf der Platz ist – und nur bremsen, wenn es nicht anders geht.
  let bremsWegen = Infinity;
  f.extraZiel = 0;
  const hind = [];
  for (const b of andere) {
    if (b === a) continue;
    let ab = b.s - a.s;
    if (ab < -T.laenge / 2) ab += T.laenge; if (ab > T.laenge / 2) ab -= T.laenge;
    // Wer viel schneller ist (oder wem Gegenverkehr entgegenkommt), muss weiter vorausschauen
    const rel = a.u - b.u;
    // auch wer gerade neben mir ist, zählt noch (sonst lenkt man beim Vorbeifahren zu früh zurück)
    const neben = -((b.lang || 5) / 2 + 3) * sc;
    if (ab <= neben || ab > Math.max(30 * sc, rel * 2.6 + 10 * sc) || (a.u <= b.u - 0.5 * sc && ab > 0)) continue;
    const breit = (b.breit ? b.breit / 2 + 1.5 : 2.6) * sc;
    const linie = L.off[T.index(b.s)] || 0;   // wo meine Linie an seiner Stelle verläuft
    hind.push({ b, ab, rel, breit, plan: linie + f.extra, linie });
  }
  hind.sort((p, q) => p.ab - q.ab);
  const vorn = hind.find(h => Math.abs(a.d - h.b.d) < h.breit || Math.abs(h.linie - h.b.d) < h.breit);
  if (vorn) {
    const { b, ab, rel, breit } = vorn;
    const linB = L.off[T.index(b.s)] || 0;
    // Ist an dieser Stelle (seitlich d) frei? Andere Hindernisse kurz dahinter zählen mit.
    const frei = d => Math.abs(d) <= hbRand + 0.3 * sc && !hind.some(h => h !== vorn && h.ab < ab + 45 * sc && Math.abs(h.b.d - d) < h.breit);
    const dL = b.d + breit + 0.4 * sc, dR = b.d - breit - 0.4 * sc;
    const seiten = [dL, dR].filter(frei).sort((p, q) => Math.abs(p - vorn.plan) - Math.abs(q - vorn.plan));
    if (seiten.length) f.extraZiel = seiten[0] - linB;
    // so spät wie möglich bremsen: erst wenn der Bremsweg knapp wird und ich noch nicht daneben bin
    if (ab > 0 && (!seiten.length || Math.abs(a.d - b.d) < breit)) {
      const halt = 6 * sc + (b.lang ? b.lang / 2 + 2.4 : 0) * sc;
      if (ab < halt + rel * rel / 16 + 6 * sc) bremsWegen = Math.min(bremsWegen, Math.max(0, b.u) + Math.sqrt(Math.max(0, 16 * (ab - halt))));
    }
  }
  f.extra += (f.extraZiel - f.extra) * Math.min(1, dt * (vorn && vorn.b.breit ? 2.5 : 1.5));
  const lin = L.off[a.idx] || 0;
  f.extra = Math.max(-hbRand - lin, Math.min(hbRand - lin, f.extra));

  // kleine Fehler: manchmal zu spät bremsen oder etwas neben der Linie
  f.fehlerZeit -= dt;
  if (f.fehlerZeit <= 0) { f.fehlerZeit = 4 + Math.random() * 8; f.fehler = (Math.random() - 0.5) * (1 - f.staerke) * 6; }

  a.lenkWunsch = lenkZurLinie(a, T, L, f.extra + f.fehler * sc);
  const i = T.index(a.s + Math.abs(a.u) * 0.25);
  let ziel = L.tempo[i] * f.staerke;
  if (f.mal) ziel *= f.mal;   // abgefahrene Reifen: langsamer durch die Kurven
  if (Math.abs(f.extra) > 1 * sc) ziel *= 0.98;
  ziel = Math.min(ziel, bremsWegen);
  const diff = ziel - a.u, ein = p.vMax / 90;
  if (diff > 0) { a.gas = Math.min(1, 0.4 + diff / (3 * ein)); a.brems = 0; }
  else if (diff > -1.2 * ein) { a.gas = 0.25; a.brems = 0; }
  else { a.gas = 0; a.brems = Math.min(1, -diff / (5 * ein)); }
  // neben der Strecke: vorsichtig zurück
  if (a.grund >= 2) a.gas = Math.min(a.gas, 0.6);
}

// Bremshilfe für den Spieler: bremst selbst, wenn man zu schnell auf eine Kurve zufährt
export function bremsHilfe(a, T, L) {
  const i = T.index(a.s + Math.abs(a.u) * 0.2);
  const ziel = L.tempo[i] * 1.02, ein = a.p.vMax / 90;
  if (a.u > ziel + 0.8 * ein) {
    a.brems = Math.max(a.brems, Math.min(1, (a.u - ziel) / (4 * ein)));
    a.gas = Math.min(a.gas, 0.1);
    return true;
  }
  return false;
}
