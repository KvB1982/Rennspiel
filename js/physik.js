// Rennspiel – wie ein Auto fährt (ohne three.js, auch in node testbar).
//
// Das Auto wird wie ein Fahrrad gerechnet: ein Vorderrad (lenkt) und ein Hinterrad (treibt an).
// Die Reifen halten das Auto in der Kurve. Je schräger ein Reifen über den Boden rutscht ("Schräglauf"),
// desto stärker drückt er zurück – bis zu einer Grenze. Darüber rutscht das Auto.
// Bei hohem Tempo drücken die Flügel das Auto auf den Boden ("Abtrieb"), dann haftet es noch besser.
//
// Richtungen: x seitlich, z längs, y hoch. Blickrichtung des Autos: (sin h, cos h). Links vom Auto: (cos h, −sin h).
// u = Tempo nach vorn, v = Tempo nach links (beides im Auto gemessen), r = Drehtempo (plus = nach links drehen).

import { BELAG } from './strecke.js';

const G = 9.81, LUFT = 1.2;
const MASSSTAB_G = 0.25;   // kleine Autos: Kurvenkräfte sind kleiner, die Neigung soll trotzdem zu sehen sein

// Werte für die Autos. Alle Zahlen sind geschätzt, damit es sich gut fahren lässt.
export const AUTOS = {
  f1: {
    name: 'Formel-Rennwagen',
    masse: 800, traeg: 1100,          // kg, Trägheit beim Drehen
    a: 1.6, b: 2.0,                   // Abstand Schwerpunkt → Vorderachse / Hinterachse (m)
    hoehe: 0.3,                       // Höhe des Schwerpunkts
    haft: 1.65, hinten: 1.1,          // wie gut die Reifen haften (ohne Flügel); hinten etwas besser
    B: 9, C: 1.45,                    // Form der Reifenkurve
    abtrieb: 3.6, abtriebVorn: 0.44,  // Flügel: Abtrieb (Fläche mal Beiwert), Anteil vorn
    widerstand: 1.35,                 // Luftwiderstand (Fläche mal Beiwert)
    rollen: 0.015,
    leistung: 610000, schubMax: 10000, // Watt, größte Zugkraft
    bremse: 1.1, bremseVorn: 0.6,     // Bremse (Anteil der Haftung), Anteil vorn
    lenkMax: 0.42, lenkTempo: 32,     // größter Lenkeinschlag (rad); ab diesem Tempo (m/s) lenkt man weniger
    gaenge: 8, drehzahlMax: 12500, vMax: 92, rueck: 14,
    schritte: 8, unten: 3,
  },
  // Ferngesteuertes Auto im Maßstab 1:30. Das Tempo ist mit heruntergerechnet:
  // 3 m/s beim kleinen Auto sehen so schnell aus wie 325 km/h beim großen.
  modell: {
    name: 'Ferngesteuertes Auto 1:30',
    masse: 0.32, traeg: 0.00075,
    a: 0.055, b: 0.065, hoehe: 0.02,
    haft: 1.0, hinten: 1.12, B: 8, C: 1.4,
    abtrieb: 0, abtriebVorn: 0.45, widerstand: 0.0015,
    rollen: 0.008, motorBremse: 0.22,   // rollt ohne Gas weich aus (Motorbremse wächst mit dem Tempo)
    leistung: 2.2, schubMax: 0.9,
    bremse: 0.55, bremseVorn: 0.55,
    lenkMax: 0.4, lenkTempo: 2.6,
    gaenge: 1, drehzahlMax: 30000, vMax: 2.3, abregeln: true, rueck: 0.7,
    prall: 0.55,                        // so stark springt es von der Bande zurück (0 = gar nicht, 1 = wie ein Flummi)
    schritte: 16, unten: 0.35,
  },
  // Slotcar: fährt im Schlitz der Bahn, gerechnet in slot.js. Hier stehen nur die Werte.
  slot: {
    name: 'Slotcar',
    a: 0.055, b: 0.065, vMax: 3.5,
    zug: 7,            // Beschleunigung bei Vollgas aus dem Stand (m/s²)
    rollen: 1.6,       // so stark bremst das Auto von selbst, wenn man das Gas loslässt (m/s²)
    bremse: 9,         // Bremse (m/s²)
    // So viel Kurvenkraft hält das Auto im Schlitz (m/s²). Slotcars haben unten Magnete, die sie auf die
    // Metallstreifen der Bahn ziehen – deshalb halten sie deutlich mehr aus als ein Auto nur mit Reifen (etwa 10 m/s²).
    haft: 15,
    gaenge: 1, drehzahlMax: 30000,
  },
};

// Was der Untergrund mit dem Auto macht: Haftung (mal) und Bremswirkung (in g)
const GRUND = {
  [BELAG.asphalt]: { haft: 1, zieh: 0 },
  [BELAG.kerb]: { haft: 0.94, zieh: 0.01 },
  [BELAG.gras]: { haft: 0.5, zieh: 0.12 },
  [BELAG.kies]: { haft: 0.42, zieh: 0.55 },
};

// tempo: eigenes Höchsttempo (m/s) für die kleinen Autos (im Menü einstellbar)
export function neuesAuto(art = 'f1', tempo = 0) {
  const p = { ...AUTOS[art] };
  if (tempo > 0) { if (p.leistung) p.leistung *= tempo / p.vMax; p.vMax = tempo; }
  return {
    p, art,
    x: 0, z: 0, y: 0, h: 0,      // Ort und Blickrichtung
    u: 0, v: 0, r: 0,             // Tempo vorwärts, seitwärts, Drehen
    lenk: 0,                       // Lenkeinschlag der Vorderräder (rad)
    gas: 0, brems: 0, lenkWunsch: 0,
    gang: 1, drehzahl: 4000,
    rutschVorn: 0, rutschHinten: 0, // 0 … 1: wie sehr die Reifen an der Grenze sind (für Quietschen und Rauch)
    grund: BELAG.asphalt, d: 0, idx: -1, s: 0,
    radDreh: 0, stoss: 0,          // wie weit die Räder gedreht sind; wie hart der letzte Aufprall war
    neigung: 0, kippen: 0,         // Nicken und Rollen der Karosserie (nur fürs Bild)
  };
}

// Pacejka-ähnliche Reifenkurve: Kraft bei Schräglauf al, Grenze D
const reifen = (al, D, B, C) => D * Math.sin(C * Math.atan(B * al));

// Größter Lenkeinschlag bei diesem Tempo (bei hohem Tempo lenkt man feiner)
export const lenkGrenze = (p, u) => p.lenkMax / (1 + (Math.abs(u) / p.lenkTempo) ** 2);

// Einen Zeitschritt rechnen. T = Strecke (für Untergrund, Höhe, Begrenzung).
export function schritt(a, T, dt) {
  const p = a.p, n = p.schritte, h = dt / n;
  // Wo auf der Strecke? (einmal pro Bild reicht)
  const f = T.finde(a.x, a.z, a.idx);
  a.idx = f.i; a.d = f.d; a.s = f.s;
  const hb = T.hb[f.i];
  const ad = Math.abs(f.d);
  const aus = f.d > 0 ? T.artL[f.i] : T.artR[f.i];
  const kerb = f.d > 0 ? T.kerbL[f.i] : T.kerbR[f.i];
  const kerbB = T.def.modell ? hb * 0.12 : 1.4;
  a.grund = ad < hb ? BELAG.asphalt : (ad < hb + kerbB && kerb) ? BELAG.kerb : (aus === BELAG.mauer || aus === BELAG.asphalt) ? BELAG.asphalt : aus;
  const gr = GRUND[a.grund] || GRUND[BELAG.asphalt];

  // Lenkrad dreht nicht sofort: die Vorderräder folgen dem Wunsch schnell, aber weich
  const ziel = a.lenkWunsch * lenkGrenze(p, a.u);
  a.lenk += (ziel - a.lenk) * Math.min(1, dt * 14);

  let maxRutschV = 0, maxRutschH = 0;
  for (let k = 0; k < n; k++) {
    const u = a.u, v = a.v, r = a.r;
    const au = Math.abs(u);
    const L = p.a + p.b;
    // Gewicht auf den Achsen: Masse + Abtrieb der Flügel
    const down = 0.5 * LUFT * p.abtrieb * u * u;
    let Fzf = p.masse * G * p.b / L + down * p.abtriebVorn;
    let Fzr = p.masse * G * p.a / L + down * (1 - p.abtriebVorn);
    const mu = p.haft * gr.haft;
    // Die Hinterreifen sind breiter und haften etwas besser (das macht das Auto gutmütiger)
    const muH = mu * (p.hinten || 1);

    // Antrieb und Bremse
    let Fx = 0, Fbf = 0, Fbr = 0;
    if (a.gas > 0 && u > -0.5) {
      Fx = a.gas * Math.min(p.schubMax, p.leistung / Math.max(au, 1));
      // kleine Autos: Der Motor dreht nicht höher, kurz vor dem Höchsttempo lässt der Schub nach
      if (p.abregeln) Fx *= Math.max(0, Math.min(1, (p.vMax * 1.03 - u) / (p.vMax * 0.12)));
    }
    const muF = mu * Fzf, muR = muH * Fzr;
    if (a.brems > 0) {
      if (u > 0.3) {
        const Fb = a.brems * p.bremse * (muF + muR);
        Fbf = Math.min(Fb * p.bremseVorn, muF * 0.98); Fbr = Math.min(Fb * (1 - p.bremseVorn), muR * 0.98);
      } else if (a.gas <= 0) {
        // steht das Auto, heißt Bremse: Rückwärtsgang (bis zum Rückwärts-Tempo "rueck")
        Fx = -a.brems * p.schubMax * 0.7 * Math.max(0, Math.min(1, (p.rueck + u) / (p.rueck * 0.25)));
      }
    }
    if (u < -0.3 && a.gas > 0) { Fbf = Math.min(a.gas * muF * 0.5, muF); Fbr = Math.min(a.gas * muR * 0.5, muR); }
    // Hinterrad kann nicht mehr ziehen, als es Haftung hat. Die Traktionskontrolle (tc) lässt dazu noch Haftung
    // für die Kurve übrig: 0,7 = sicher, 0,95 = fast alles fürs Beschleunigen (dann bricht das Heck leicht aus)
    // Mit Traktionskontrolle (a.tc = true) zieht das Hinterrad nur so stark, wie neben der Kurvenkraft noch Haftung übrig ist.
    const zugGrenze = a.tc === false ? muR * 0.97 : Math.sqrt(Math.max(0, (muR * 0.93) ** 2 - (a.Fyr || 0) ** 2));
    if (Math.abs(Fx) > zugGrenze) Fx = Math.sign(Fx) * zugGrenze;

    // Schräglauf (bei sehr langsamer Fahrt wird es wackelig, deshalb mindestens "unten")
    const us = Math.max(au, p.unten);
    const sgn = u >= 0 ? 1 : -1;
    const alF = a.lenk * sgn - Math.atan2(v + p.a * r, us);
    const alR = -Math.atan2(v - p.b * r, us);
    // Haftkreis: was zum Bremsen/Ziehen gebraucht wird, fehlt für die Kurve
    const lfx = Fbf, lrx = Math.abs(Fx) + Fbr;
    const DF = Math.sqrt(Math.max(0, muF * muF - lfx * lfx));
    const DR = Math.sqrt(Math.max(0, muR * muR - lrx * lrx));
    // Ganz langsam rollt das Auto einfach dorthin, wohin die Räder zeigen (siehe unten "leicht").
    // Die Reifenkräfte zur Seite zählen dann nicht – sonst würden eingeschlagene Vorderräder das Auto festhalten.
    const kriech = Math.min(1, Math.max(0, (au - p.unten * 0.3) / p.unten));
    let Fyf = reifen(alF, DF, p.B, p.C) * kriech, Fyr = reifen(alR, DR, p.B, p.C) * kriech;
    a.Fyr = Fyr;
    maxRutschV = Math.max(maxRutschV, Math.abs(alF) * p.B / 1.6, lfx / (muF + 1e-9));
    maxRutschH = Math.max(maxRutschH, Math.abs(alR) * p.B / 1.6, lrx / (muR + 1e-9));

    // Luftwiderstand, Rollwiderstand, Untergrund
    const Fd = 0.5 * LUFT * p.widerstand * u * au + p.rollen * p.masse * G * Math.sign(u) + gr.zieh * p.masse * G * Math.sign(u) * Math.min(1, au / 6)
      + (p.motorBremse || 0) * p.masse * u * (a.gas > 0 ? 0 : 1);
    const Fb = (Fbf + Fbr) * Math.sign(u) * Math.min(1, au / 0.3);
    const cs = Math.cos(a.lenk), sn = Math.sin(a.lenk);
    let du = (Fx - Fb - Fd - Fyf * sn) / p.masse + v * r;
    let dv = (Fyf * cs + Fyr) / p.masse - u * r;
    let dr = (p.a * Fyf * cs - p.b * Fyr) / p.traeg;

    a.u += du * h; a.v += dv * h; a.r += dr * h;
    // ganz langsam: wie ein Spielzeug auf Schienen rollen (kein Zittern im Stand)
    const leicht = Math.min(1, Math.max(0, (Math.abs(a.u) - p.unten * 0.3) / p.unten));
    if (leicht < 1) {
      const rk = a.u * Math.tan(a.lenk) / L;
      a.r = a.r * leicht + rk * (1 - leicht);
      a.v *= leicht;
    }
    if (Math.abs(a.u) < 0.05 && a.gas <= 0 && a.brems <= 0) a.u *= 0.9;

    // Bewegen
    const ch = Math.cos(a.h), sh = Math.sin(a.h);
    // vorn = (sh, ch), links = (ch, −sh)
    a.x += (sh * a.u + ch * a.v) * h;
    a.z += (ch * a.u - sh * a.v) * h;
    a.h += a.r * h;
  }
  a.rutschVorn = Math.min(1, Math.max(0, maxRutschV - 0.75) * 2.5);
  a.rutschHinten = Math.min(1, Math.max(0, maxRutschH - 0.75) * 2.5);

  // Begrenzung (Leitplanke, Reifenstapel, Mauer): abprallen
  a.stoss = 0;
  const f2 = T.finde(a.x, a.z, f.i, 6);
  const rand = f2.d > 0 ? hb + T.ausL[f2.i] : -(hb + T.ausR[f2.i]);
  const breiteAuto = T.def.modell ? 0.04 : 1.0;
  const grenze = Math.abs(rand) - breiteAuto;
  if (Math.abs(f2.d) > grenze) {
    const seite = Math.sign(f2.d);
    const nx = f2.tz * seite, nz = -f2.tx * seite;    // zeigt von der Strecke weg zur Wand
    const zu = Math.abs(f2.d) - grenze;
    a.x -= nx * zu; a.z -= nz * zu;
    // Tempo in der Welt
    const ch = Math.cos(a.h), sh = Math.sin(a.h);
    let wx = sh * a.u + ch * a.v, wz = ch * a.u - sh * a.v;
    const gegen = wx * nx + wz * nz;
    if (gegen > 0) {
      a.stoss = gegen;
      const tw = Math.atan2(f2.tx, f2.tz);
      let dh = tw - a.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      if (p.prall) {
        // Kleines, leichtes Auto: springt wie ein Gummiball von der Bande zurück und bleibt nicht hängen.
        // Mindestens ein kleiner Schubs weg von der Wand, auch wenn man nur langsam dagegen fährt.
        const weg = gegen * (1 + p.prall) + 0.12;
        wx -= nx * weg; wz -= nz * weg;
        // Die Nase dreht sich dabei in die Richtung, in die das Auto jetzt weiterrollt (an der Bande entlang)
        if (Math.abs(dh) > Math.PI / 2) dh -= Math.sign(dh) * Math.PI;     // rückwärts zur Strecke: andere Richtung ist näher
        const weit = Math.min(1, 0.35 + gegen * 0.5);
        a.h += dh * weit + seite * 0.12 * weit * (Math.abs(dh) < 1.2 ? 1 : 0);   // und noch ein wenig von der Wand weg
        a.u = Math.sin(a.h) * wx + Math.cos(a.h) * wz; a.v = (Math.cos(a.h) * wx - Math.sin(a.h) * wz) * 0.4;
        a.r = 0;
      } else {
        wx -= nx * gegen * 1.35; wz -= nz * gegen * 1.35;     // abprallen (ein wenig zurück)
        const reib = Math.max(0, 1 - gegen * 0.06);            // an der Wand entlang schleifen bremst
        wx *= reib; wz *= reib;
        a.u = sh * wx + ch * wz; a.v = ch * wx - sh * wz;
        a.r *= 0.5;
        // Auto dreht sich ein wenig parallel zur Wand
        if (Math.abs(dh) < Math.PI / 2) a.h += dh * Math.min(0.5, gegen * 0.05);
      }
    }
  }
  a.y = f2.y;

  // Gang und Drehzahl (nur für den Klang und die Anzeige)
  const au = Math.abs(a.u);
  if (p.gaenge > 1) {
    const stufe = p.vMax / p.gaenge;
    let g = Math.min(p.gaenge, Math.max(1, Math.floor(au / stufe * 0.95) + 1));
    a.gang = g;
    const lo = (g - 1) * stufe * 0.82, hi = g * stufe * 1.02;
    a.drehzahl = 4500 + (p.drehzahlMax - 4500) * Math.min(1, Math.max(0, (au - lo) / (hi - lo)));
    if (a.gas > 0.1 && au < 3) a.drehzahl = Math.max(a.drehzahl, 6000 + a.gas * 5000);
  } else {
    a.gang = 1; a.drehzahl = 2000 + (p.drehzahlMax - 2000) * Math.min(1, au / p.vMax);
  }
  a.radDreh += a.u * dt / (T.def.modell ? 0.012 : 0.33);
  // Karosserie nickt beim Bremsen und neigt sich in der Kurve (nur Bild)
  const quer = a.u * a.r;
  // In der Kurve drückt die Fliehkraft das Auto nach außen: Es neigt sich ganz leicht von der Kurve weg
  // (ein Rennwagen ist hart gefedert: höchstens gut 1 Grad).
  const querG = quer / (T.def.modell ? G * MASSSTAB_G : G);
  a.kippen += (Math.max(-0.022, Math.min(0.022, querG * 0.0055)) - a.kippen) * Math.min(1, dt * 6);
  a.neigung += (((a.brems > 0 && a.u > 1 ? 1 : 0) * 0.012 - a.gas * 0.006) - a.neigung) * Math.min(1, dt * 5);
}

// Auto an eine Stelle der Strecke setzen (s = Meter seit der Startlinie, d = seitlich, plus = links)
export function aufStrecke(a, T, s, d = 0) {
  const i = T.index(s);
  a.x = T.x[i] + T.tz[i] * d; a.z = T.z[i] - T.tx[i] * d; a.y = T.y[i];
  a.h = Math.atan2(T.tx[i], T.tz[i]);
  a.u = a.v = a.r = 0; a.lenk = 0; a.idx = i;
}

export const kmh = a => Math.abs(a.u) * 3.6;
