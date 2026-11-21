// Rennspiel – wie ein Auto fährt (ohne three.js, auch in node testbar).
//
// Das Auto wird wie ein Fahrrad gerechnet: ein Vorderrad (lenkt) und ein Hinterrad (treibt an).
// Die Reifen halten das Auto in der Kurve. Je schräger ein Reifen über den Boden rutscht ("Schräglauf"),
// desto stärker drückt er zurück – bis zu einer Grenze. Darüber rutscht das Auto.
// Bei hohem Tempo drücken die Flügel das Auto auf den Boden ("Abtrieb"), dann haftet es noch besser.
//
// Richtungen: x seitlich, z längs, y hoch. Blickrichtung des Autos: (sin h, cos h). Links vom Auto: (cos h, −sin h).
// u = Tempo nach vorn, v = Tempo nach links (beides im Auto gemessen), r = Drehtempo (plus = nach links drehen).

import { BELAG, inPfuetze } from './strecke.js';
import { SUPER_AUTOS } from './supercars.js';
import { RALLYE_AUTOS } from './rallyeautos.js';

const G = 9.81, LUFT = 1.2;
const MASSSTAB_G = 0.25;   // kleine Autos: Kurvenkräfte sind kleiner, die Neigung soll trotzdem zu sehen sein

// Werte für die Autos. Alle Zahlen sind geschätzt, damit es sich gut fahren lässt.
export const AUTOS = {
  f1: {
    name: 'Formel-Rennwagen',
    masse: 800, traeg: 1100,          // kg, Trägheit beim Drehen
    a: 1.6, b: 2.0,                   // Abstand Schwerpunkt → Vorderachse / Hinterachse (m)
    hoehe: 0.3,                       // Höhe des Schwerpunkts
    haft: 2.1, hinten: 1.05,          // wie gut die Reifen haften (ohne Flügel); hinten etwas besser. Mit Absicht mehr als echt: Das Auto soll in die Kurve beißen
    B: 9, C: 1.45,                    // Form der Reifenkurve
    abtrieb: 5.2, abtriebVorn: 0.44,  // Flügel: Abtrieb (Fläche mal Beiwert), Anteil vorn
    widerstand: 1.35,                 // Luftwiderstand (Fläche mal Beiwert)
    rollen: 0.015,
    leistung: 950000, schubMax: 18500, // Watt, größte Zugkraft (viel kräftiger als echt: soll nach vorn reißen)
    zugGriff: 2.3,                    // beim Beschleunigen halten die Reifen längs mehr aus (Spiel-Wert: kräftiger Antritt)
    bremse: 1.1, bremseVorn: 0.6,     // Bremse (Anteil der Haftung), Anteil vorn
    bremsGriff: 1.25,                 // beim Bremsen halten die Reifen längs mehr aus als zur Seite (Spiel-Wert: kräftigere Bremse)
    esp: { beta: 0.1, dreh: 6, quer: 0.4 },   // Schleuderschutz (siehe unten)
    arcade: { lenk: 1.3, folgen: 24, griff: 1.12, ein: 10, fang: 5, frei: 0.06, halt: 1.8, rand: 3.5 },   // Arcade-Hilfe (siehe ARCADE unten)
    lenkMax: 0.42, lenkTempo: 32,     // größter Lenkeinschlag (rad); ab diesem Tempo (m/s) lenkt man weniger
    gaenge: 8, drehzahlMax: 12500, vMax: 96, rueck: 14,
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
  // Drift-Rallyeauto im Maßstab 1:43 (wie die kleinen Drift-Autos, die man mit dem Handy steuert: etwa 10,7 cm lang).
  // Vorbild ist ein Rallyeauto mit Allrad, das meiste der Kraft geht nach hinten. Die Hinterreifen haften etwas schlechter
  // als die vorderen: Gibt man in der Kurve Gas, bricht das Heck aus und das Auto driftet. Mit der Handbremse geht es noch leichter.
  // Langsam genug zum Kontrollieren: 1,2 m/s sieht bei 1:43 aus wie gut 180 km/h.
  // Maßstabsgetreu heißt auch: Die Kräfte sind mit verkleinert. Ein echtes Auto schafft in einer Kehre mit 20 m Halbmesser
  // etwa 50 km/h – im Maßstab 1:43 sind das 0,47 m Halbmesser und gut 0,3 m/s. Deshalb haften die Reifen hier viel weniger
  // als bei einem normalen Spielzeugauto (haft 0,075 statt etwa 1): Das Auto rutscht so, wie ein großes Auto rutschen würde.
  drift: {
    name: 'Drift-Rallyeauto 1:43',
    masse: 0.065, traeg: 0.00004,
    a: 0.028, b: 0.031, hoehe: 0.012,
    haft: 0.075, hinten: 0.92, B: 6.5, C: 1.5,    // weiche Reifenkurve: das Rutschen kommt sanft, nicht plötzlich
    abtrieb: 0, abtriebVorn: 0.45, widerstand: 0.0002,
    rollen: 0.004, motorBremse: 0.12,
    leistung: 0.07, schubMax: 0.07, allrad: 0.3,  // mehr Kraft, als die Reifen halten: Vollgas in der Kurve = Heck kommt
    durchdrehen: 0.8,                             // keine Traktionskontrolle: Die Räder dürfen durchdrehen (sonst kein Drift), bis 80 % der Haftung
    bremse: 0.6, bremseVorn: 0.6,
    lenkMax: 0.6, lenkTempo: 1.8,                 // viel Lenkeinschlag, damit man gut gegenlenken kann
    // Drift-Hilfe (an, solange im Menü „Drift-Hilfe“ an ist): Wird der Drift-Winkel größer als beta (knapp 30 Grad),
    // dreht das Auto sanft zurück. So dreht man sich nicht so leicht um die eigene Achse.
    esp: { beta: 0.5, dreh: 5, quer: 0.02, ab: 0.25, nurWinkel: true },
    gaenge: 1, drehzahlMax: 30000, vMax: 1.2, abregeln: true, rueck: 0.4,
    prall: 0.5,
    schritte: 24, unten: 0.15,
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

// Die Supercars (Werte in supercars.js)
Object.assign(AUTOS, SUPER_AUTOS, RALLYE_AUTOS);

// Was der Untergrund mit dem Auto macht: Haftung (mal) und Bremswirkung (in g)
const GRUND = {
  [BELAG.asphalt]: { haft: 1, zieh: 0 },
  [BELAG.kerb]: { haft: 0.94, zieh: 0.01 },
  [BELAG.gras]: { haft: 0.5, zieh: 0.12 },
  [BELAG.kies]: { haft: 0.42, zieh: 0.55 },
  // Rallye: loser Schotter rutscht (das Auto driftet schon bei mittlerem Tempo), Matsch noch mehr und bremst,
  // Wasser bremst stark (Pfütze, Wasserdurchfahrt). Alles geschätzt.
  [BELAG.schotter]: { haft: 0.74, zieh: 0.015 },
  [BELAG.matsch]: { haft: 0.56, zieh: 0.06 },
  [BELAG.wasser]: { haft: 0.6, zieh: 0.32 },
};
const IN_DER_LUFT = { haft: 0, zieh: 0 };

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
    arcade: true,                  // Arcade-Hilfe (gilt nur für Autos, die Werte dafür haben: Rennwagen und Supercars)
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
  a.grund = ad < hb ? (T.belag ? T.belag[f.i] : BELAG.asphalt) : (ad < hb + kerbB && kerb) ? BELAG.kerb : (aus === BELAG.mauer || aus === BELAG.asphalt) ? BELAG.asphalt : aus;
  if (T.pfuetzen && T.pfuetzen.length && ad < hb + 1 && inPfuetze(T, f.s, f.d)) a.grund = BELAG.wasser;
  // In der Luft (nach einer Kuppe) haben die Reifen keinen Halt: kein Lenken, kein Gas, keine Bremse
  const gr = a.luft ? IN_DER_LUFT : GRUND[a.grund] || GRUND[BELAG.asphalt];

  // Lenkrad dreht nicht sofort: die Vorderräder folgen dem Wunsch schnell, aber weich
  // Arcade-Hilfe: Bei Tempo darf man weiter einlenken als sonst (lenk) und die Räder folgen schneller (folgen)
  const A = a.arcade && p.arcade && !a.luft ? p.arcade : null;
  a.helfer = 0;                  // wie stark der Strecken-Helfer gerade hilft (0 … 2, nur zum Anzeigen und Prüfen)
  let lenkGr = A ? p.lenkMax / (1 + (Math.abs(a.u) / (p.lenkTempo * A.lenk)) ** 2) : lenkGrenze(p, a.u);
  // Rallye: Bei Tempo darf man normal nur wenig einlenken (sonst wäre das Auto zu zappelig). Rutscht das Heck aber weg,
  // darf man zum Gegenlenken bis zum vollen Einschlag drehen – so wie ein echter Rallyefahrer, der den Drift fängt.
  if (p.rallye && a.u > 3 && Math.sign(a.lenkWunsch) === Math.sign(a.v)) lenkGr += (p.lenkMax - lenkGr) * Math.min(1, Math.abs(Math.atan2(a.v, a.u)) / 0.35);
  const ziel = a.lenkWunsch * lenkGr;
  a.lenk += (ziel - a.lenk) * Math.min(1, dt * (A ? A.folgen : 14));

  let maxRutschV = 0, maxRutschH = 0;
  for (let k = 0; k < n; k++) {
    const u = a.u, v = a.v, r = a.r;
    const au = Math.abs(u);
    const L = p.a + p.b;
    // Gewicht auf den Achsen: Masse + Abtrieb der Flügel
    const down = 0.5 * LUFT * p.abtrieb * u * u;
    let Fzf = p.masse * G * p.b / L + down * p.abtriebVorn;
    let Fzr = p.masse * G * p.a / L + down * (1 - p.abtriebVorn);
    // Straßenautos: Beim Beschleunigen drückt das Gewicht auf die Hinterräder, beim Bremsen auf die Vorderräder
    if (p.super) { const um = Math.max(-0.15, Math.min(0.2, (a.ax || 0) * p.hoehe / (L * G))) * p.masse * G; Fzf -= um; Fzr += um; }
    const mu = p.haft * gr.haft;
    // Die Hinterreifen sind breiter und haften etwas besser (das macht das Auto gutmütiger)
    const muH = mu * (p.hinten || 1);

    // Antrieb und Bremse
    let Fx = 0, Fbf = 0, Fbr = 0;
    if (a.gas > 0 && u > -0.5) {
      Fx = a.gas * Math.min(p.schubMax, p.leistung / Math.max(au, 1)) * (p.schub || 1);
      // Drift-Hilfe: Steht das Auto schon zu quer, nimmt sie etwas Gas weg (dann greifen die Hinterräder wieder)
      if (p.esp && p.esp.nurWinkel && a.tc !== false && au > p.esp.ab) {
        const zuquer = Math.abs(Math.atan2(v, au)) - p.esp.beta;
        if (zuquer > 0) Fx *= Math.max(0.25, 1 - zuquer * 3);
      }
      // kleine Autos: Der Motor dreht nicht höher, kurz vor dem Höchsttempo lässt der Schub nach
      if (p.abregeln) Fx *= Math.max(0, Math.min(1, (p.vMax * 1.03 - u) / (p.vMax * 0.12)));
    }
    const muF = mu * Fzf, muR = muH * Fzr;
    // Handbremse: Die Hinterräder blockieren, der Antrieb ist ausgekuppelt. Blockierte Räder halten zur Seite kaum noch: Das Heck rutscht weg.
    const hand = a.handbremse && u > 0.05;
    if (hand) Fx = 0;
    // Beim Bremsen halten die Reifen längs mehr aus (bremsGriff). Das macht die Bremse kräftiger,
    // ohne dass die Reifen in der Kurve mehr halten.
    const bg = p.bremsGriff || 1;
    if (a.brems > 0) {
      if (u > 0.3) {
        const Fb = a.brems * p.bremse * (muF + muR) * bg;
        // Straßenautos haben ein Antiblockiersystem: Die Hinterräder bremsen nie bis an die Grenze (sonst bricht das Heck aus)
        Fbf = Math.min(Fb * p.bremseVorn, muF * 0.98 * bg); Fbr = Math.min(Fb * (1 - p.bremseVorn), muR * (p.super ? 0.6 : 0.98) * bg);
      } else if (a.gas <= 0) {
        // steht das Auto, heißt Bremse: Rückwärtsgang (bis zum Rückwärts-Tempo "rueck")
        Fx = -a.brems * p.schubMax * 0.7 * Math.max(0, Math.min(1, (p.rueck + u) / (p.rueck * 0.25)));
      }
    }
    if (hand) Fbr = Math.max(Fbr, muR * 0.92 * bg);
    if (u < -0.3 && a.gas > 0) { Fbf = Math.min(a.gas * muF * 0.5, muF); Fbr = Math.min(a.gas * muR * 0.5, muR); }
    // Hinterrad kann nicht mehr ziehen, als es Haftung hat. Die Traktionskontrolle (tc) lässt dazu noch Haftung
    // für die Kurve übrig: 0,7 = sicher, 0,95 = fast alles fürs Beschleunigen (dann bricht das Heck leicht aus)
    // Mit Traktionskontrolle (a.tc = true) zieht das Hinterrad nur so stark, wie neben der Kurvenkraft noch Haftung übrig ist.
    // Allradantrieb (p.allrad = Anteil der Kraft vorn): Dann ziehen auch die Vorderräder.
    const rest = p.tcRest || 0.93;
    const vz = p.allrad || 0;
    let Fxf = Fx * vz; Fx *= 1 - vz;
    // zugGriff: Beim Beschleunigen halten die Reifen längs mehr aus als zur Seite (Spiel-Wert wie bremsGriff: kräftigerer Antritt)
    const zg = p.zugGriff || 1;
    // Computerfahrer (a.tc nicht gesetzt) fahren immer mit Traktionskontrolle; beim Drift-Auto dreht sie für dich nie ab (durchdrehen)
    const tcAn = a.tc === undefined || (a.tc !== false && !p.durchdrehen);
    const zugGrenze = (!tcAn ? muR * (p.durchdrehen || 0.97) : Math.sqrt(Math.max(0, (muR * rest) ** 2 - (a.Fyr || 0) ** 2))) * zg;
    if (Math.abs(Fx) > zugGrenze) Fx = Math.sign(Fx) * zugGrenze;
    if (vz) {
      const zugVorn = (!tcAn ? muF * 0.97 : Math.sqrt(Math.max(0, (muF * rest) ** 2 - (a.Fyf || 0) ** 2))) * zg;
      if (Math.abs(Fxf) > zugVorn) Fxf = Math.sign(Fxf) * zugVorn;
    }

    // Schräglauf (bei sehr langsamer Fahrt wird es wackelig, deshalb mindestens "unten")
    const us = Math.max(au, p.unten);
    const sgn = u >= 0 ? 1 : -1;
    const alF = a.lenk * sgn - Math.atan2(v + p.a * r, us);
    const alR = -Math.atan2(v - p.b * r, us);
    // Haftkreis: was zum Bremsen/Ziehen gebraucht wird, fehlt für die Kurve
    const lfx = Fbf / bg + Math.abs(Fxf) / zg, lrx = Math.abs(Fx) / zg + Fbr / bg;
    const DF = Math.sqrt(Math.max(0, muF * muF - lfx * lfx));
    const DR = Math.sqrt(Math.max(0, muR * muR - lrx * lrx));
    // Ganz langsam rollt das Auto einfach dorthin, wohin die Räder zeigen (siehe unten "leicht").
    // Die Reifenkräfte zur Seite zählen dann nicht – sonst würden eingeschlagene Vorderräder das Auto festhalten.
    const kriech = Math.min(1, Math.max(0, (au - p.unten * 0.3) / p.unten));
    let Fyf = reifen(alF, DF, p.B, p.C) * kriech, Fyr = reifen(alR, DR, p.B, p.C) * kriech;
    a.Fyr = Fyr; a.Fyf = Fyf;
    maxRutschV = Math.max(maxRutschV, Math.abs(alF) * p.B / 1.6, lfx / (muF + 1e-9));
    maxRutschH = Math.max(maxRutschH, Math.abs(alR) * p.B / 1.6, lrx / (muR + 1e-9));

    // Luftwiderstand, Rollwiderstand, Untergrund
    const Fd = 0.5 * LUFT * p.widerstand * u * au + p.rollen * p.masse * G * Math.sign(u) + gr.zieh * p.masse * G * Math.sign(u) * Math.min(1, au / 6)
      + (p.motorBremse || 0) * p.masse * u * (a.gas > 0 ? 0 : 1);
    const Fb = (Fbf + Fbr) * Math.sign(u) * Math.min(1, au / 0.3);
    const cs = Math.cos(a.lenk), sn = Math.sin(a.lenk);
    let du = (Fx + Fxf * cs - Fb - Fd - Fyf * sn) / p.masse + v * r;
    let dv = (Fyf * cs + Fxf * sn + Fyr) / p.masse - u * r;
    let dr = (p.a * (Fyf * cs + Fxf * sn) - p.b * Fyr) / p.traeg;
    // Schleuderschutz (wie ESP im echten Auto): Dreht sich das Auto schneller, als die Räder lenken,
    // oder rutscht das Heck zu weit zur Seite, dreht ein Gegen-Moment es zurück und es bremst ein wenig.
    // Ein bisschen Driften (bis "beta") bleibt erlaubt. Ausgeschaltet zusammen mit der Traktionskontrolle.
    if (p.esp && a.tc !== false && au > (p.esp.ab ?? 4)) {
      const E = p.esp;
      const rLenk = u * Math.tan(a.lenk) / L;                            // so schnell wollen die Räder drehen
      const rGrip = (muF + muR) / p.masse / au * 1.08;                    // so schnell geht es höchstens mit der Haftung
      const rZiel = Math.max(-rGrip, Math.min(rGrip, rLenk));
      const beta = Math.atan2(v, au);                                     // wie schräg das Auto rutscht (plus = Heck nach rechts)
      let korr = 0;
      // dreht zu schnell in dieselbe Richtung (Heck kommt)
      // (Drift-Hilfe "nurWinkel": Das Drehen bleibt frei, sonst könnte man gar nicht driften – nur der Winkel wird begrenzt.)
      if (E.nurWinkel) { /* nichts */ }
      else if (r * rZiel >= 0 && Math.abs(r) > Math.abs(rZiel)) korr -= (r - rZiel) * E.dreh;
      else if (r * rZiel < 0) korr -= r * E.dreh;                         // dreht gegen die Lenkung
      // rutscht zu schräg: Nase in Fahrtrichtung drehen
      const zuviel = Math.abs(beta) - E.beta;
      if (zuviel > 0) korr += Math.sign(beta) * zuviel * E.dreh * 6;
      const grenze = E.dreh * (E.nurWinkel ? 4 : 1.2);
      korr = Math.max(-grenze, Math.min(grenze, korr));
      dr += korr;
      du -= Math.abs(korr) * E.quer;                                      // ESP bremst dabei einzelne Räder
    }
    if (A && au > 3) {
      // ARCADE-HILFE (nur für dich, nur Rennwagen und Supercars; so machen es viele Arcade-Rennspiele):
      // 1. Lenk-Helfer: Das Auto soll sich so schnell drehen, wie die Räder zeigen – höchstens so schnell, wie es die
      //    Haftung (mal "griff") hergibt. Dreht es langsamer (es schiebt geradeaus = Untersteuern), hilft ein Dreh-Moment
      //    mit (ein). Dreht es zu schnell (Heck kommt) oder gegen die Lenkung, fängt es sanft ab (fang).
      //    Die Lenkung wird dabei nie schwächer gemacht: Es gibt nur Hilfe dazu.
      const rRad = u * Math.tan(a.lenk) / L;
      const rMax = (muF + muR) / p.masse / au * A.griff;
      const rZiel = Math.max(-rMax, Math.min(rMax, rRad));
      const fehlt = rZiel - r;
      dr += fehlt * (r * rZiel >= 0 && Math.abs(rZiel) > Math.abs(r) ? A.ein : A.fang);
      // 2. Reifen-Helfer: Rutscht das Auto mehr als "frei" (Winkel) zur Seite, zieht die Hilfe das Rutschen zurück,
      //    ohne Tempo zu kosten (das Tempo wird nur in Fahrtrichtung gedreht). Ein kleiner Drift bleibt erlaubt.
      const freiV = au * Math.tan(A.frei);
      const zuviel = Math.sign(v) * Math.max(0, Math.abs(v) - freiV);
      const dvH = -zuviel * A.halt;
      dv += dvH; du -= v * dvH / au;
    }
    a.ax = du - v * r;

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

  // 3. Strecken-Helfer (Arcade-Hilfe): Fährt das Auto auf den Rand der Fahrbahn zu, lenkt die Straße es unsichtbar
  //    etwas zurück: Fahrtrichtung und Auto drehen sich gemeinsam ein Stück in Richtung der Straße. Je näher am Rand
  //    und je schneller, desto mehr. Mitten auf der Straße merkt man nichts davon.
  if (A && A.rand && Math.abs(a.u) > 5) streckenHelfer(a, T, f, A, dt);

  // Begrenzung (Leitplanke, Reifenstapel, Mauer): abprallen
  a.stoss = 0;
  const f2 = T.finde(a.x, a.z, f.i, 6);
  const rand = f2.d > 0 ? hb + T.ausL[f2.i] : -(hb + T.ausR[f2.i]);
  const breiteAuto = T.def.modell ? 1.2 * T.sc : 1.0;   // halbe Breite des Autos (etwas mehr, damit die Räder nicht in der Wand stecken)
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
        a.h += dh * weit - seite * 0.12 * weit * (Math.abs(dh) < 1.2 ? 1 : 0);   // und noch ein wenig von der Wand weg (links von der Strecke = nach rechts drehen)
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
  if (T.def.rallye) huepfen(a, T, f2, dt); else a.y = f2.y;

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
  a.radDreh += a.u * dt / (T.def.modell ? 0.36 * T.sc : 0.33);
  // Karosserie nickt beim Bremsen und neigt sich in der Kurve (nur Bild)
  const quer = a.u * a.r;
  // In der Kurve drückt die Fliehkraft das Auto nach außen: Es neigt sich sichtbar von der Kurve weg.
  // Straßenautos sind weich gefedert (bis etwa 4 Grad), der Rennwagen ist hart (bis etwa 2 Grad).
  // Das ist etwas mehr als in echt, damit man es im Spiel auch sieht.
  const querG = quer / (T.def.modell ? G * MASSSTAB_G : G);
  const [jeG, hoechstens] = p.super ? [0.045, 0.07] : [0.014, 0.038];
  a.kippen += (Math.max(-hoechstens, Math.min(hoechstens, querG * jeG)) - a.kippen) * Math.min(1, dt * 6);
  a.neigung += (((a.brems > 0 && a.u > 1 ? 1 : 0) * 0.012 - a.gas * 0.006) - a.neigung) * Math.min(1, dt * 5);
}

function streckenHelfer(a, T, f, A, dt) {
  const i = f.i, tx = T.tx[i], tz = T.tz[i];
  const sh = Math.sin(a.h), ch = Math.cos(a.h);
  const wx = sh * a.u + ch * a.v, wz = ch * a.u - sh * a.v;   // Tempo in der Welt
  const tempo = Math.hypot(wx, wz);
  const seite = f.d >= 0 ? 1 : -1;
  const raus = (wx * tz - wz * tx) * seite;                     // wie schnell es zum nächsten Rand hin geht
  if (raus <= 0) return;
  const abstand = T.hb[i] - 1.0 - Math.abs(f.d);                // so viel Platz ist noch bis zum Rand (Auto ist 2 m breit)
  const zone = 3 + 0.3 * tempo;                                 // ab hier hilft die Straße (bei 200 km/h ab gut 19 m vor dem Rand)
  if (abstand > zone) return;
  let k = Math.min(1.4, 1 - abstand / zone); k *= k;
  // Winkel zwischen Fahrtrichtung und Straße, ein Stück davon zurückdrehen
  const winkel = Math.asin(Math.min(1, raus / tempo));
  const dreh = winkel * Math.min(0.6, A.rand * k * dt) * seite;
  a.h -= dreh;                                                  // dreht Auto und Fahrtrichtung gleich: kein Rutschen dazu
  a.helfer = Math.max(a.helfer || 0, k);
}

// Auf und ab (Rallye): Das Auto folgt der Straße, bis eine Kuppe so rund ist, dass die Straße schneller
// wegfällt, als die Erdanziehung das Auto nach unten ziehen kann. Dann fliegt es – bis es wieder aufsetzt.
// (Abheben, wenn Tempo² · Krümmung > g. Bei einer Kuppe mit 50 m Halbmesser ab etwa 80 km/h.)
function huepfen(a, T, f, dt) {
  const i = f.i, boden = f.y;
  const sh = Math.sin(a.h), ch = Math.cos(a.h);
  const vLang = (sh * a.u + ch * a.v) * f.tx + (ch * a.u - sh * a.v) * f.tz;   // Tempo entlang der Straße
  const steig = T.steig[i], kv = T.kv[i];
  a.landung = 0;
  if (a.vy === undefined) { a.vy = 0; a.y = boden; a.luft = false; a.nick = 0; a.flug = 0; }
  if (a.luft) {
    a.vy -= G * dt; a.y += a.vy * dt; a.flug += dt;
    // In der Luft dreht sich das Auto weiter, wie es abgesprungen ist – aber gebremst (Spiel-Wert: sonst landet man zu oft quer)
    a.r *= Math.exp(-dt * 2.5);
    if (a.y <= boden) {
      // aufsetzen: je steiler das Auto im Vergleich zur Straße fällt, desto härter
      const hart = Math.max(0, steig * vLang - a.vy);
      a.landung = hart; a.luft = false; a.y = boden; a.vy = steig * vLang;
      if (hart > 5) { a.u *= 1 - Math.min(0.12, (hart - 5) * 0.015); a.stoss = Math.max(a.stoss, (hart - 5) * 1.5); }
    }
  } else {
    a.vy = steig * vLang; a.y = boden;
    if (-kv * vLang * vLang > G && Math.abs(vLang) > 8) { a.luft = true; a.flug = 0; }
  }
  // Das Auto neigt sich mit der Straße (bergauf: Nase hoch); im Flug folgt es der Flugbahn, die Nase sinkt langsam
  const ziel = a.luft ? Math.max(-0.5, Math.min(0.5, a.vy / Math.max(6, Math.abs(vLang)))) * 0.8 : steig;
  a.nick += (ziel - a.nick) * Math.min(1, dt * (a.luft ? 3 : 12));
}

// Auto an eine Stelle der Strecke setzen (s = Meter seit der Startlinie, d = seitlich, plus = links)
export function aufStrecke(a, T, s, d = 0) {
  const i = T.index(s);
  a.x = T.x[i] + T.tz[i] * d; a.z = T.z[i] - T.tx[i] * d; a.y = T.y[i];
  a.h = Math.atan2(T.tx[i], T.tz[i]);
  a.u = a.v = a.r = 0; a.lenk = 0; a.idx = i;
  a.vy = 0; a.luft = false; a.nick = T.steig ? T.steig[i] : 0;
}

export const kmh = a => Math.abs(a.u) * 3.6;
