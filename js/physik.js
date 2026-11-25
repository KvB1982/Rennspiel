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
    arcade: { lenk: 1.3, folgen: 24, griff: 1.12, ein: 10, fang: 5, frei: 0.06, halt: 1.8, rand: 3.5, zug: 0.6, kurve: 1.2 },   // Arcade-Hilfe (siehe ARCADE unten)
    // Fahrgefühl „echter“ (siehe ECHT in schritt): Aktiv-Lenkung (schraeg, regler, folgen, gMitte), Kurven-ABS, strafferer
    // Schleuderschutz (esp), dazu ein vorsichtigerer Tempo-Plan für Bremszonen und Bremshilfe (sicher, bremsen, voraus, kurve; siehe ki.js)
    echt: { schraeg: 0.12, regler: 0.3, folgen: 24, gMitte: 3, kurvenAbs: 0.8, sicher: 0.72, bremsen: 0.6, voraus: 0.5, kurve: 0.98, neben: 0.7, esp: { beta: 0.1, dreh: 14, heck: 3, quer: 0.3 } },
    lenkMax: 0.42, lenkTempo: 32,     // größter Lenkeinschlag (rad); ab diesem Tempo (m/s) lenkt man weniger
    gaenge: 8, drehzahlMax: 12500, vMax: 96, rueck: 14,
    schritte: 8, unten: 3,
  },
  // Ferngesteuertes Auto im Maßstab 1:30. Es fährt wie ein kleiner Rennwagen: Auf der Geraden zieht es kräftig an
  // (2 m/s sehen im Maßstab aus wie gut 210 km/h), vor den Kurven muss es bremsen (die Bremshilfe macht das für dich),
  // und die Arcade-Hilfe hält es auf der Bahn – so wie bei den großen Autos.
  modell: {
    name: 'Ferngesteuertes Auto 1:30',
    masse: 0.32, traeg: 0.00075,
    a: 0.055, b: 0.065, hoehe: 0.02,
    haft: 0.26, hinten: 1.12, B: 8, C: 1.4,   // wenig Haftung, passend zum Maßstab: Vor den Kurven muss das Auto bremsen, auf der Geraden zieht es davon
    abtrieb: 0, abtriebVorn: 0.45, widerstand: 0.0015,
    rollen: 0.008, motorBremse: 0.22,   // rollt ohne Gas weich aus (Motorbremse wächst mit dem Tempo)
    leistung: 3.0, schubMax: 0.8,
    zugGriff: 2.4,                      // kräftiger Antritt (Spiel-Wert wie bei den großen Autos)
    bremse: 0.8, bremseVorn: 0.55, bremsGriff: 2,
    lenkMax: 0.42, lenkTempo: 1.9,      // voller Einschlag = ein Kreis von knapp 30 cm: Das Auto lenkt sofort und kräftig ein
    esp: { beta: 0.1, dreh: 8, quer: 0.3, ab: 0.3 },   // Schleuderschutz: Das kleine Auto dreht sich nicht mehr um die eigene Achse
    // Arcade-Hilfe wie bei Rennwagen und Supercars (siehe ARCADE unten): direkte Lenkung, und der Computer hilft
    // unsichtbar, auf der Bahn zu bleiben. Dazu der Drift zum Selber-Steuern wie im Rallye-Modus (nur Bild):
    // Wer hart durch die Kurve fährt, stellt das Auto quer – und lädt damit den Turbo auf (siehe turbo unten).
    arcade: { lenk: 1.5, folgen: 26, griff: 1.15, ein: 10, fang: 6, frei: 0.08, halt: 2, rand: 9, zug: 0.6, kurve: 0.92,
      drift: { winkel: 0.5, hand: 0.85, ab: 0.55, abTempo: 0.3, lose: 0.5, feder: 55, ruhe: 9, lang: 4 } },
    turbo: { mal: 1.4, schub: 2.2 },    // Turbo: so viel mal das Höchsttempo, so viel mal die Zugkraft
    gaenge: 6, drehzahlMax: 30000, vMax: 1.1, abregeln: true, rueck: 0.5,
    prall: 0.55,                        // so stark springt es von der Bande zurück (0 = gar nicht, 1 = wie ein Flummi)
    schritte: 16, unten: 0.35,
  },
  // Drift-Rallyeauto im Maßstab 1:43 (wie die kleinen Drift-Autos, die man mit dem Handy steuert: etwa 10,7 cm lang).
  // Langsam genug zum Kontrollieren: 0,9 m/s sieht bei 1:43 aus wie knapp 140 km/h.
  // Maßstabsgetreu heißt auch: Die Kräfte sind mit verkleinert. Deshalb haften die Reifen viel weniger als bei einem
  // normalen Spielzeugauto (haft 0,14 statt etwa 1): Das Auto rutscht so, wie ein großes Auto rutschen würde.
  //
  // Für dich fährt das Auto mit der Drift-Hilfe „leicht“ (siehe driftLeicht unten): Du lenkst, wohin es fährt –
  // und je mehr du einlenkst und Gas gibst, desto schräger stellt sich das Auto. Der Drift gehört also dir,
  // aber das Auto dreht sich nie von allein weg. Ohne Drift-Hilfe (Menü) rechnet das Spiel die Reifen wie bei den
  // anderen Autos: Dann muss man selbst gegenlenken – das ist schwer.
  drift: {
    name: 'Drift-Rallyeauto 1:43',
    masse: 0.065, traeg: 0.00004,
    a: 0.028, b: 0.031, hoehe: 0.012,
    haft: 0.14, hinten: 0.92, B: 6.5, C: 1.5,     // weiche Reifenkurve: das Rutschen kommt sanft, nicht plötzlich
    abtrieb: 0, abtriebVorn: 0.45, widerstand: 0.0002,
    rollen: 0.004, motorBremse: 0.12,
    leistung: 0.07, schubMax: 0.085, allrad: 0.3, // mehr Kraft, als die Reifen halten: Vollgas in der Kurve = Heck kommt
    durchdrehen: 0.8,                             // keine Traktionskontrolle: Die Räder dürfen durchdrehen (sonst kein Drift), bis 80 % der Haftung
    bremse: 0.8, bremseVorn: 0.6,
    lenkMax: 0.6, lenkTempo: 1.8,                 // viel Lenkeinschlag, damit man gut gegenlenken kann
    // Ohne „leicht“: Wird der Drift-Winkel größer als beta (knapp 30 Grad), dreht das Auto sanft zurück.
    esp: { beta: 0.5, dreh: 5, quer: 0.02, ab: 0.25, nurWinkel: true },
    // Drift-Hilfe „leicht“ (alles Spiel-Werte, geschätzt):
    leicht: {
      eng: 5.5,          // engster Kreis bei wenig Tempo: 1 / eng Meter (etwa 18 cm)
      winkel: 0.62,      // so schräg steht das Auto bei vollem Lenken und Vollgas (rad, etwa 35 Grad)
      ab: 0.22,          // erst ab so viel Lenken stellt es sich quer (darunter fährt es sauber)
      ohneGas: 0.4,      // ohne Gas bleibt nur dieser Teil des Winkels: Gas weg = Auto wird gerade
      ein: 4.5, aus: 3.2, // so schnell stellt es sich quer / wieder gerade (pro Sekunde)
      hand: 1.05,        // Winkel mit Handbremse (etwa 60 Grad)
      handEng: 1.7,      // mit Handbremse dreht es so viel mal enger (für Haarnadeln)
      handBremst: 0.55,  // und wird dabei langsamer (m/s²)
      zug: 1.25, bremse: 1.5,   // Beschleunigen und Bremsen (m/s²)
      rollen: 0.06, motor: 0.5, // Ausrollen ohne Gas
      reibt: 0.5,        // quer rutschen kostet Tempo (m/s² bei 90 Grad)
      rand: 2.5,         // Strecken-Helfer wie bei den großen Autos: kurz vor dem Rand dreht die Fahrtrichtung etwas zurück zur Matte
    },
    turbo: { mal: 1.3, schub: 2 },                // Turbo (siehe turbo.js): etwas sanfter als beim ferngesteuerten Auto, die Matte ist klein
    gaenge: 5, drehzahlMax: 30000, vMax: 0.9, abregeln: true, rueck: 0.35,
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
const au0 = a => Math.abs(a.u);
// Kommt gleich eine Kurve in die Richtung, in die du lenkst (0 = nein … 1 = ja, und zwar eine, für die du zu schnell bist)?
// Die Untersteuer-Bremse fragt das: Wer nur auf der Geraden am Lenkrad wackelt, soll nicht gebremst werden.
// seite = +1 links, −1 rechts; ayMax = so viel Kurvenkraft geben die Reifen her
function kurveKommt(a, T, seite, ayMax) {
  const u = Math.abs(a.u); let k = 0;
  for (let t = 0; t <= 0.8; t += 0.2) k = Math.max(k, T.k[T.index(a.s + u * t)] * seite);
  return Math.max(0, Math.min(1, (k * u * u / ayMax - 0.5) / 0.3));
}

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
  const p = a.p, leichtAn = !!p.leicht && a.tc === true, n = leichtAn ? 0 : p.schritte, h = dt / p.schritte;
  // kl: Bei den kleinen Autos sind alle Längen und Tempo-Grenzen der Hilfen mit verkleinert (große Autos: 1)
  const kl = T.def.modell ? T.sc : 1;
  // Turbo (kleine Autos): eine kurze Zeit lang mehr Höchsttempo und mehr Zugkraft (a.turbo = Sekunden, die er noch brennt)
  const TB = a.turbo > 0 && p.turbo ? p.turbo : null;
  if (a.turbo > 0) a.turbo = Math.max(0, a.turbo - dt);
  const vMax = p.vMax * (TB ? TB.mal : 1);
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
  let gr = a.luft ? IN_DER_LUFT : GRUND[a.grund] || GRUND[BELAG.asphalt];
  // „echter“: Auf Gras und Kies rutscht das Auto nicht ganz so schlimm weg, damit man nach einem Ausrutscher wieder zurückfindet
  if (!a.arcade && p.echt && p.echt.neben && gr.haft < p.echt.neben) gr = { haft: p.echt.neben, zieh: gr.zieh };

  // Rallye (neben): Neben dem Weg liegen Gras, Wurzeln und Gräben. Dort wird das Auto kräftig gebremst und zieht kaum noch –
  // bis es nur noch "ab" schnell ist (dann kommt man gut zurück auf den Weg). Sonst wäre Abkürzen durch den Wald schneller als der Weg.
  let nebenZug = 1;
  if (p.neben && !a.luft && ad > hb + p.neben.rand && au0(a) > p.neben.ab) {
    const m = Math.min(1, (au0(a) - p.neben.ab) / (p.neben.ab * 0.5));
    gr = { haft: gr.haft, zieh: gr.zieh + p.neben.zieh * m }; nebenZug = 1 - (1 - p.neben.zug) * m;
    a.fangen = p.neben.pause;
  } else if (p.neben && a.fangen > 0) {
    // zurück auf dem Weg: Das Auto muss sich erst fangen ("pause" Sekunden lang kommt die Kraft nur langsam wieder)
    a.fangen = Math.max(0, a.fangen - dt);
    nebenZug = 1 - (1 - p.neben.pauseZug) * Math.min(1, a.fangen / (p.neben.pause * 0.5));
  }

  // Lenkrad dreht nicht sofort: die Vorderräder folgen dem Wunsch schnell, aber weich
  // Arcade-Hilfe: Bei Tempo darf man weiter einlenken als sonst (lenk) und die Räder folgen schneller (folgen)
  const A = a.arcade && p.arcade && !a.luft ? p.arcade : null;
  a.helfer = 0;                  // wie stark der Strecken-Helfer gerade hilft (0 … 2, nur zum Anzeigen und Prüfen)
  let lenkGr = A ? p.lenkMax / (1 + (Math.abs(a.u) / (p.lenkTempo * A.lenk)) ** 2) : lenkGrenze(p, a.u);
  // Rallye: Bei Tempo darf man normal nur wenig einlenken (sonst wäre das Auto zu zappelig). Rutscht das Heck aber weg,
  // darf man zum Gegenlenken bis zum vollen Einschlag drehen – so wie ein echter Rallyefahrer, der den Drift fängt.
  if (p.rallye && a.u > 3 && Math.sign(a.lenkWunsch) === Math.sign(a.v)) lenkGr += (p.lenkMax - lenkGr) * Math.min(1, Math.abs(Math.atan2(a.v, a.u)) / 0.35);
  // Arcade (sauber): Mehr Einschlag, als die Reifen in eine Kurve umsetzen können, bremst nur (die Vorderräder schieben
  // quer über den Boden). Deshalb drehen die Räder bei Tempo höchstens ein Stück ("sauber") weiter als nötig für die
  // engste Kurve, die die Haftung hergibt. Voll einlenken bleibt die engste Kurve – nur ohne Festbremsen. Gegenlenken ist frei.
  let unterM = 0;   // Untersteuer-Bremse (0 … 1), siehe „unter“ weiter unten
  if (A && A.sauber && a.u > 2 * kl) {
    const lose = A.belag && gr.haft < 1 ? 1 + (1 / gr.haft - 1) * A.belag : 1;
    const rMax = p.haft * gr.haft * G * A.griff * lose / a.u;
    let eng = Math.min(lenkGr, Math.atan((p.a + p.b) * rMax / a.u) + A.sauber);
    // kreis: Der engste Kreis beim Fahren ist "kreis" Meter groß – das reicht für jede Kehre. Noch enger würde das Auto
    // bei wenig Tempo nur hin und her zappeln. Fast im Stand (zum Wenden) gilt wieder der volle Einschlag.
    if (A.kreis) { const k = Math.atan((p.a + p.b) / A.kreis); if (eng > k) eng = k + (eng - k) * Math.max(0, 1 - (a.u - 2 * kl) / (3 * kl)); }
    // beim Gegenlenken geht es weich über zum vollen Einschlag (je weiter das Heck weg ist, desto mehr)
    const gegen = Math.sign(a.lenkWunsch) === Math.sign(a.v) ? Math.min(1, Math.abs(Math.atan2(a.v, a.u)) / 0.35) : 0;
    lenkGr = eng + (lenkGr - eng) * gegen;
    // Rallye (unter): Lenkrad weit eingeschlagen und zu schnell für die Kurve → das Auto wirft sich quer und wird dabei langsamer
    // (so wie ein echtes Rallyeauto im Drift Tempo abbaut). Ohne das fährt man mit Vollgas einfach geradeaus in den Wald.
    if (A.unter && a.tc !== false && a.u > A.unter.tempo && !a.handbremse && !gegen && Math.atan((p.a + p.b) * rMax / a.u) < p.lenkMax)
      unterM = Math.max(0, Math.min(1, (Math.abs(a.lenkWunsch) - A.unter.ab) / (1 - A.unter.ab))) * kurveKommt(a, T, Math.sign(a.lenkWunsch), rMax * a.u);
  }
  a.unter = unterM;
  // ECHT – Fahrgefühl „echter“ (X): Hier schiebt keine unsichtbare Hand, alle Kräfte kommen aus den Reifen. Damit man das
  // Auto trotzdem fahren kann, bekommt es, was moderne echte Autos auch haben: eine Lenkung, die zum Tempo passt,
  // ein Kurven-ABS und einen kräftigen Schleuderschutz.
  const X = !a.arcade && p.echt && !a.luft ? p.echt : null;
  let ziel = a.lenkWunsch * lenkGr;
  if (X && a.u > 2) {
    // LENKUNG: Voll eingeschlagen heißt immer „so eng, wie die Reifen es bei diesem Tempo schaffen“. Früher war der
    // Einschlag bei hohem Tempo so klein, dass die Vorderreifen nur halb so stark zogen, wie sie konnten – das Auto
    // fuhr geradeaus von der Strecke, obwohl noch Haftung da war.
    const w = a.lenkWunsch, L0 = p.a + p.b;
    const ayMax = p.haft * gr.haft * (G + 0.5 * LUFT * p.abtrieb * a.u * a.u / p.masse);
    // gMitte (Rennwagen): Bei hohem Tempo drücken die Flügel so stark, dass das Auto mit 8-facher Erdanziehung um die
    // Kurve könnte. Dann wäre schon ein kleiner Dreh am Lenkrad ein Haken. Um die Mitte herum lenkt das Auto deshalb
    // höchstens mit "gMitte" g pro vollem Lenkrad – ganz eingeschlagen bleibt trotzdem die engste Kurve.
    const k = X.gMitte ? Math.min(1, X.gMitte * G / ayMax) : 1;
    // steil (Straßenautos): Schon das halbe Lenkrad holt den größten Teil der Haftung (wie bei einem echten Auto bei Tempo –
    // dort braucht niemand den vollen Einschlag). 1 = gleichmäßig, 2 = halbes Lenkrad sind schon drei Viertel.
    const f = X.steil ? Math.sign(w) * (1 - (1 - Math.abs(w)) ** X.steil) : w * (k + (1 - k) * w * w);
    // so schnell soll sich das Auto drehen (langsam gefahren: so wie die Räder bei vollem Einschlag rollen würden)
    const rVoll = Math.min(ayMax / a.u, a.u * Math.tan(p.lenkMax) / L0);
    const rSoll = f * rVoll, grund = Math.atan(L0 * rSoll / a.u);
    // mehr als "schraeg" über die engste Kurve hinaus schlägt die Lenkung nie ein – sonst rutschen die Vorderreifen nur
    const voll = Math.min(p.lenkMax, Math.atan(L0 * rVoll / a.u) + X.schraeg);
    // regler (Rennwagen): Aktiv-Lenkung. Sie vergleicht, wie schnell sich das Auto dreht, und stellt die Räder nach:
    //   etwas mehr Einschlag, wenn es zu träge einlenkt, weniger (oder gegenlenken), wenn das Heck kommt.
    // lin (Straßenautos): Der Einschlag wächst einfach mit dem Lenkrad, bis die Vorderreifen ganz zupacken.
    ziel = X.regler ? grund + X.regler * (rSoll - a.r) : grund + w * X.schraeg * (X.lin + (1 - X.lin) * w * w);
    ziel = Math.max(-voll, Math.min(voll, ziel));
    // UNTERSTEUER-BREMSE (unter): Wer das Lenkrad (fast) am Anschlag hat und trotzdem zu schnell für die Kurve ist, dem hilft
    // nur eins: langsamer werden. Echte Autos machen das selbst (der Schleuderschutz nimmt Gas weg und bremst). "ab" = ab so
    // viel Lenkrad, "brems"/"bremsH" = so stark bremsen Vorder- und Hinterräder dann mit, auch wenn du auf dem Gas stehst.
    if (X.unter && a.tc !== false && a.u > X.unter.tempo && ayMax / a.u < a.u * Math.tan(p.lenkMax) / L0)
      unterM = Math.max(0, Math.min(1, (Math.abs(w) - X.unter.ab) / (1 - X.unter.ab))) * kurveKommt(a, T, Math.sign(w), ayMax);
  }
  a.lenk += (ziel - a.lenk) * Math.min(1, dt * (A ? A.folgen : X ? X.folgen : 14));

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
    if (p.super) { const um = Math.max(-0.15, Math.min(0.2, (a.ax || 0) * p.hoehe / (L * G))) * p.masse * G * (X && X.last !== undefined ? X.last : 1); Fzf -= um; Fzr += um; }   // („echter“: last – das Gewicht wandert nur zum Teil, sonst wird das Heck beim Bremsen so leicht, dass das Auto pendelt)
    const mu = p.haft * gr.haft;
    // Die Hinterreifen sind breiter und haften etwas besser (das macht das Auto gutmütiger)
    const muH = mu * (p.hinten || 1);

    // Antrieb und Bremse
    let Fx = 0, Fbf = 0, Fbr = 0;
    if (a.gas > 0 && u > -0.5) {
      Fx = a.gas * Math.min(p.schubMax, p.leistung / Math.max(au, 1)) * (p.schub || 1) * (TB ? TB.schub : 1);
      Fx *= nebenZug;
      // Drift-Hilfe: Steht das Auto schon zu quer, nimmt sie etwas Gas weg (dann greifen die Hinterräder wieder)
      if (p.esp && p.esp.nurWinkel && a.tc !== false && au > p.esp.ab) {
        const zuquer = Math.abs(Math.atan2(v, au)) - p.esp.beta;
        if (zuquer > 0) Fx *= Math.max(0.25, 1 - zuquer * 3);
      }
      // kleine Autos: Der Motor dreht nicht höher, kurz vor dem Höchsttempo lässt der Schub nach
      if (p.abregeln) Fx *= Math.max(0, Math.min(1, (vMax * 1.03 - u) / (vMax * 0.12)));
    }
    const muF = mu * Fzf, muR = muH * Fzr;
    // Handbremse: Die Hinterräder blockieren, der Antrieb ist ausgekuppelt. Blockierte Räder halten zur Seite kaum noch: Das Heck rutscht weg.
    const hand = a.handbremse && u > 0.05;
    // Rallye mit Arcade-Hilfe (hand): Die Handbremse wirft nur das Heck herum – sie bremst das Auto kaum ("brems"),
    // und ein Teil der Zugkraft bleibt ("zug"). So kommt man mit Schwung um die Kehre, statt fast stehen zu bleiben.
    const AH = hand && A && A.hand;
    if (hand) Fx = AH ? Fx * AH.zug : 0;
    // Beim Bremsen halten die Reifen längs mehr aus (bremsGriff). Das macht die Bremse kräftiger,
    // ohne dass die Reifen in der Kurve mehr halten.
    const bg = p.bremsGriff || 1;
    if (a.brems > 0) {
      if (u > 0.3) {
        const Fb = a.brems * p.bremse * (muF + muR) * bg;
        // Straßenautos haben ein Antiblockiersystem: Die Hinterräder bremsen nie bis an die Grenze (sonst bricht das Heck aus)
        Fbf = Math.min(Fb * p.bremseVorn, muF * 0.98 * bg); Fbr = Math.min(Fb * (1 - p.bremseVorn), muR * (p.super ? 0.6 : 0.98) * bg);
        // „echter“: Kurven-ABS (das haben echte Autos auch). Wer beim Bremsen lenkt, bekommt etwas weniger Bremse –
        // dafür bleibt Haftung zum Lenken übrig. Ohne das rutscht ein Auto, das voll bremst, einfach geradeaus weiter.
        if (X && X.kurvenAbs && a.tc !== false) {
          const q = Math.min(1, Math.abs(a.lenkWunsch) * 1.5) * X.kurvenAbs;       // so viel Haftung bleibt vorn fürs Lenken
          // Hinten bleibt doppelt so viel übrig: Bremsen die Hinterräder in der Kurve kräftig mit, überholt das Heck die Nase.
          const qH = Math.min(0.98, q * 2);
          Fbf = Math.min(Fbf, muF * Math.sqrt(1 - q * q) * bg); Fbr = Math.min(Fbr, muR * Math.sqrt(1 - qH * qH) * bg);
        }
      } else if (a.gas <= 0) {
        // steht das Auto, heißt Bremse: Rückwärtsgang (bis zum Rückwärts-Tempo "rueck")
        Fx = -a.brems * p.schubMax * 0.7 * Math.max(0, Math.min(1, (p.rueck + u) / (p.rueck * 0.25)));
      }
    }
    if (unterM > 0 && u > 0.3) { const UN = X ? X.unter : A.unter; Fx *= 1 - unterM * (UN.gasWeg ?? 1); Fbf = Math.max(Fbf, unterM * UN.brems * muF * bg); Fbr = Math.max(Fbr, unterM * UN.bremsH * muR * bg); }   // Untersteuer-Bremse
    if (hand) Fbr = Math.max(Fbr, muR * 0.92 * bg * (AH ? AH.brems : 1));
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
    // Arcade-Hilfe: Auch mitten in der Kurve (und im Drift) bleibt ein Teil der Zugkraft übrig (zug). Sonst nimmt die
    // Traktionskontrolle dort fast alles Gas weg und das Auto wird im Drift immer langsamer.
    const zugMin = A && A.zug && tcAn ? muR * zg * A.zug : 0;
    const zugG = Math.max(zugGrenze, zugMin);
    if (Math.abs(Fx) > zugG) Fx = Math.sign(Fx) * zugG;
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
    // (Die geschenkte Zugkraft der Arcade-Hilfe kostet die Hinterreifen keine Haftung zur Seite.)
    // (Handbremse mit Arcade-Hilfe: Die Hinterräder rutschen zur Seite weiter so, als wären sie ganz blockiert.)
    const lfx = Fbf / bg + Math.abs(Fxf) / zg, lrx = AH ? Math.max(muR * 0.92, Fbr / bg) : Math.min(Math.abs(Fx), zugGrenze) / zg + Fbr / bg;
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
      + (p.motorBremse || 0) * p.masse * u * (a.gas > 0 ? 0 : 1)
      + (p.turbo && u > vMax * 1.03 ? (u - vMax) * p.masse * 2.5 : 0);   // nach dem Turbo: zurück aufs normale Höchsttempo
    const Fb = (Fbf + Fbr) * Math.sign(u) * Math.min(1, au / 0.3);
    const cs = Math.cos(a.lenk), sn = Math.sin(a.lenk);
    let du = (Fx + Fxf * cs - Fb - Fd - Fyf * sn) / p.masse + v * r;
    let dv = (Fyf * cs + Fxf * sn + Fyr) / p.masse - u * r;
    let dr = (p.a * (Fyf * cs + Fxf * sn) - p.b * Fyr) / p.traeg;
    // Schleuderschutz (wie ESP im echten Auto): Dreht sich das Auto schneller, als die Räder lenken,
    // oder rutscht das Heck zu weit zur Seite, dreht ein Gegen-Moment es zurück und es bremst ein wenig.
    // Ein bisschen Driften (bis "beta") bleibt erlaubt. Ausgeschaltet zusammen mit der Traktionskontrolle.
    if (p.esp && a.tc !== false && au > (p.esp.ab ?? 4)) {
      const E = X && X.esp || p.esp;   // („echter“: eigener, strafferer Schleuderschutz)
      const rLenk = u * Math.tan(a.lenk) / L;                            // so schnell wollen die Räder drehen
      const rGrip = (muF + muR) / p.masse / au * 1.08;                    // so schnell geht es höchstens mit der Haftung
      const rZiel = Math.max(-rGrip, Math.min(rGrip, rLenk));
      const beta = Math.atan2(v, au);                                     // wie schräg das Auto rutscht (plus = Heck nach rechts)
      let korr = 0;
      // dreht zu schnell in dieselbe Richtung (Heck kommt)
      // (Drift-Hilfe "nurWinkel": Das Drehen bleibt frei, sonst könnte man gar nicht driften – nur der Winkel wird begrenzt.)
      if (E.nurWinkel) { /* nichts */ }
      else if (r * rZiel >= 0 && Math.abs(r) > Math.abs(rZiel)) korr -= (r - rZiel) * E.dreh * (E.heck || 1);   // heck: Kommt das Heck, greift er kräftiger ein
      else if (r * rZiel < 0) korr -= r * E.dreh;                         // dreht gegen die Lenkung
      // rutscht zu schräg: Nase in Fahrtrichtung drehen
      const zuviel = Math.abs(beta) - E.beta;
      if (zuviel > 0) korr += Math.sign(beta) * zuviel * E.dreh * 6;
      const grenze = E.dreh * (E.nurWinkel ? 4 : 1.2);
      korr = Math.max(-grenze, Math.min(grenze, korr));
      dr += korr;
      du -= Math.abs(korr) * E.quer;                                      // ESP bremst dabei einzelne Räder
    }
    if (A && au > 3 * kl) {
      // ARCADE-HILFE (nur für dich, nur Rennwagen und Supercars; so machen es viele Arcade-Rennspiele):
      // 1. Lenk-Helfer: Das Auto soll sich so schnell drehen, wie die Räder zeigen – höchstens so schnell, wie es die
      //    Haftung (mal "griff") hergibt. Dreht es langsamer (es schiebt geradeaus = Untersteuern), hilft ein Dreh-Moment
      //    mit (ein). Dreht es zu schnell (Heck kommt) oder gegen die Lenkung, fängt es sanft ab (fang).
      //    Die Lenkung wird dabei nie schwächer gemacht: Es gibt nur Hilfe dazu.
      const rRad = u * Math.tan(a.lenk) / L;
      // Rallye (belag): Auf losem Grund (Schotter, Matsch, Wasser) fehlt Haftung – die Hilfe gleicht einen Teil davon aus
      const lose = A.belag && gr.haft < 1 ? 1 + (1 / gr.haft - 1) * A.belag : 1;
      const rMax = (muF + muR) / p.masse / au * A.griff * lose;
      const rZiel = Math.max(-rMax, Math.min(rMax, rRad));
      const fehlt = rZiel - r;
      // Mit Handbremse darf sich das Auto in die Kurve drehen (sonst käme man nicht um die Kehren): dann nur wenig fangen
      const fang = hand && A.freiHand ? A.fang * 0.25 : A.fang;
      dr += fehlt * (r * rZiel >= 0 && Math.abs(rZiel) > Math.abs(r) ? A.ein : fang);
      // 2. Reifen-Helfer: Rutscht das Auto mehr als "frei" (Winkel) zur Seite, zieht die Hilfe das Rutschen zurück,
      //    ohne Tempo zu kosten (das Tempo wird nur in Fahrtrichtung gedreht). Ein kleiner Drift bleibt erlaubt.
      const freiV = au * Math.tan(hand && A.freiHand ? A.freiHand : A.frei);
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
  if (leichtAn) driftLeicht(a, gr, dt, vMax, TB);

  // 3. Strecken-Helfer (Arcade-Hilfe): Fährt das Auto auf den Rand der Fahrbahn zu, lenkt die Straße es unsichtbar
  //    etwas zurück: Fahrtrichtung und Auto drehen sich gemeinsam ein Stück in Richtung der Straße. Je näher am Rand
  //    und je schneller, desto mehr. Mitten auf der Straße merkt man nichts davon.
  if (A && A.rand && Math.abs(a.u) > 5 * kl) streckenHelfer(a, T, f, A, dt, kl);
  // (Drift-Rallye mit Drift-Hilfe: derselbe Helfer, nur sanfter – quer rutschen soll man ja)
  else if (leichtAn && p.leicht.rand && a.u > 5 * kl) streckenHelfer(a, T, f, p.leicht, dt, kl);
  // 4. Spur-Helfer (Rallye): Zeigt die Nase schräg zum Weg, dreht die Hilfe Auto und Fahrtrichtung langsam wieder in
  //    Richtung des Wegs. Das nimmt dem Auto das Pendeln von links nach rechts, wenn man zu spät gegenlenkt.
  //    Wer lenkt, ist immer stärker als diese Hilfe.
  if (A && A.spur && Math.abs(a.u) > 4 * kl && !a.handbremse) {
    let d = Math.atan2(T.tx[f.i], T.tz[f.i]) - a.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < 1.2) { const w = d * Math.min(1, dt * A.spur); a.h += w; a.r -= a.r * Math.min(1, dt * A.spur * (A.ruhe || 0)) * (1 - Math.abs(a.lenkWunsch)); }
  }
  // In der Luft (Rallye-Sprung) kann man nicht lenken. Die Arcade-Hilfe dreht das Auto im Flug sanft in Richtung Straße,
  // damit es nach der Landung nicht quer in den Wald schießt (so machen es viele Arcade-Rallyespiele).
  else if (a.luft && a.arcade && p.arcade && p.arcade.rand && Math.abs(a.u) > 5) luftHelfer(a, T, f, dt);

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

  // DRIFT ZUM SELBER-STEUERN (Rallye, nur mit Arcade-Hilfe): Die Reifen halten das Auto sicher auf dem Weg – aber im Bild
  // stellt es sich quer wie ein Rallyeauto im Drift. Wie weit, bestimmst du:
  //   - je härter du durch die Kurve fährst (Tempo und Lenken), desto weiter kommt das Heck heraus
  //   - auf Schotter und Matsch mehr als auf Asphalt, mit Gas mehr als ohne
  //   - Handbremse: das Heck fliegt sofort ganz herum (für Kehren)
  //   - gegenlenken oder gerade stellen: das Auto richtet sich wieder aus (mit einem kleinen Nachschwingen)
  // a.drift ist der Winkel (plus = Nase nach links), a.driftV sein Tempo. Gefahren wird weiter dort, wo die Räder hinrollen.
  const DR = a.arcade && p.arcade && p.arcade.drift;
  if (DR) {
    const tempo = Math.abs(a.u);
    let ziel = 0;
    if (!a.luft && tempo > DR.abTempo) {
      const halt = DR.halt ? DR.halt * gr.haft : p.haft * gr.haft * G;   // so viel Kurvenkraft hält der Boden (kleine Autos: eigener Wert, sie fahren nie an der Grenze)
      const quer = a.u * a.r / halt;                                      // wie hart geht es gerade um die Kurve? (1 = Grenze)
      // Nur eine richtige Kurve zählt: Kurzes Hin- und Herlenken auf der Geraden mittelt sich weg (a.driftQ)
      a.driftQ = (a.driftQ || 0) + (Math.max(-1.2, Math.min(1.2, quer)) - (a.driftQ || 0)) * Math.min(1, dt * DR.lang);
      const hart = Math.min(1, Math.max((a.unter || 0) * (Math.sign(a.lenkWunsch) === Math.sign(a.driftQ) ? 1 : 0), (Math.abs(a.driftQ) - DR.ab) / (1 - DR.ab)));
      const lose = 1 + (1 - Math.min(1, gr.haft)) * DR.lose;             // loser Boden: mehr Drift
      const schnell = Math.min(1, (tempo - DR.abTempo) / DR.abTempo);
      // Enge Kurve (Haarnadel): Das Auto dreht sich dort schnell – dann kommt das Heck noch weiter herum (eng)
      const eng = DR.eng ? 1 + DR.eng * Math.min(1, Math.abs(a.r) / DR.engAb) : 1;
      ziel = Math.sign(a.driftQ) * DR.winkel * hart * lose * eng * (0.65 + 0.35 * a.gas) * schnell;
      if ((a.handbremse || a.driftHand) && Math.abs(a.lenkWunsch) > 0.1) ziel = Math.sign(a.lenkWunsch) * DR.hand * schnell;
      ziel = Math.max(-DR.hand, Math.min(DR.hand, ziel));
    }
    // Gegenlenken holt das Heck schneller zurück
    const gegen = a.drift * a.lenkWunsch < 0 && Math.abs(a.lenkWunsch) > 0.15;
    const feder = DR.feder * (gegen ? 2.2 : 1);
    a.driftV = (a.driftV || 0) + ((ziel * (gegen ? 0.3 : 1) - (a.drift || 0)) * feder - (a.driftV || 0) * DR.ruhe) * dt;
    a.drift = (a.drift || 0) + a.driftV * dt;
    // Staub, Steine und Reifengeräusch gehören dazu
    a.rutschHinten = Math.max(a.rutschHinten, Math.min(1, Math.abs(a.drift) / 0.3));
  } else if (a.drift) { a.drift = 0; a.driftV = 0; }

  // Gang und Drehzahl (nur für den Klang und die Anzeige)
  const au = Math.abs(a.u);
  if (p.gaenge > 1) {
    // (kleine Autos: Der höchste Gang kommt schon bei gut drei Vierteln des Höchsttempos – so schaltet das Auto auf der
    //  Geraden bis ganz nach oben durch, wie ein schneller Rennwagen)
    const stufe = p.vMax / p.gaenge / (kl < 1 ? 1.28 : 1);
    let g = Math.min(p.gaenge, Math.max(1, Math.floor(au / stufe * 0.95) + 1));
    a.gang = g;
    const lo = (g - 1) * stufe * 0.82, hi = g === p.gaenge && kl < 1 ? p.vMax * 1.1 : g * stufe * 1.02;
    a.drehzahl = 4500 + (p.drehzahlMax - 4500) * Math.min(1, Math.max(0, (au - lo) / (hi - lo)));
    if (a.gas > 0.1 && au < 3 * kl) a.drehzahl = Math.max(a.drehzahl, 6000 + a.gas * 5000);
  } else {
    a.gang = 1; a.drehzahl = 2000 + (p.drehzahlMax - 2000) * Math.min(1, au / p.vMax);
  }
  a.radDreh += a.u * dt / (T.def.modell ? 0.36 * T.sc : 0.33);
  // Karosserie nickt beim Bremsen und neigt sich in der Kurve (nur Bild)
  const quer = a.u * a.r;
  // In der Kurve drückt die Fliehkraft das Auto nach außen: Es neigt sich sichtbar von der Kurve weg.
  // Straßenautos sind weich gefedert (bis etwa 2 Grad), der Rennwagen ist hart (bis gut 1 Grad).
  // Vorher war es doppelt so viel – das hat beim Fahren gestört (Kristian, 25.11.2026).
  const querG = quer / (T.def.modell ? G * MASSSTAB_G : G);
  const [jeG, hoechstens] = p.super ? [0.022, 0.035] : [0.008, 0.02]   // seit 25.11.2026 halb so viel: höchstens 2 Grad (Supercar) und gut 1 Grad (Rennwagen);
  a.kippen += (Math.max(-hoechstens, Math.min(hoechstens, querG * jeG)) - a.kippen) * Math.min(1, dt * 6);
  a.neigung += (((a.brems > 0 && a.u > 1 ? 1 : 0) * 0.012 - a.gas * 0.006) - a.neigung) * Math.min(1, dt * 5);
}

// DRIFT-HILFE „leicht“ (Drift-Rallye, nur für dich): ein gespielter Drift, den du selbst steuerst.
// Statt die Reifen genau zu rechnen, gilt hier:
//   1. Das Lenkrad bestimmt, wohin das Auto FÄHRT (die Fahrtrichtung dreht sich so schnell, wie du lenkst –
//      höchstens so schnell, wie es die Haftung bei diesem Tempo hergibt).
//   2. Das Lenkrad und das Gas bestimmen, wie SCHRÄG das Auto dabei steht: wenig lenken = sauber,
//      viel lenken und Gas = quer. Gas weg oder Lenkrad gerade = Auto wird wieder gerade.
//   3. Quer rutschen kostet etwas Tempo, die Handbremse stellt das Auto ganz quer und dreht es um die Haarnadel.
// So dreht sich das Auto nie von allein um die eigene Achse – aber der Drift fühlt sich an wie selbst gemacht.
function driftLeicht(a, gr, dt, vMax = a.p.vMax, TB = null) {
  const p = a.p, D = p.leicht, w = a.lenkWunsch || 0;
  const cl = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  let s = Math.hypot(a.u, a.v);
  a.Fyr = a.Fyf = 0;
  if (a.u < 0 || (s < 0.03 && a.gas <= 0)) {
    // rückwärts oder im Stand: ganz einfach rollen, wohin die Räder zeigen
    let u = a.u;
    if (a.gas > 0) u = Math.min(0.031, u + D.bremse * a.gas * dt);
    else if (a.brems > 0) u = Math.max(-p.rueck, u - D.zug * 0.7 * a.brems * dt);
    else u *= Math.exp(-dt * 3);
    a.v *= Math.exp(-dt * 12);
    a.r = u * w * D.eng; a.h += a.r * dt; a.u = u; a.ax = 0;
    a.x += (Math.sin(a.h) * a.u + Math.cos(a.h) * a.v) * dt; a.z += (Math.cos(a.h) * a.u - Math.sin(a.h) * a.v) * dt;
    a.lenk = w * p.lenkMax; a.rutschVorn = a.rutschHinten = 0;
    return;
  }
  const hand = !!a.handbremse;
  const beta = Math.atan2(a.v, a.u);           // so schräg steht das Auto zur Fahrtrichtung (plus = Nase zeigt nach rechts davon)
  let kurs = a.h + beta;                       // Fahrtrichtung
  // Tempo: Gas, Bremse, Ausrollen, Untergrund – und das Rutschen selbst bremst
  let acc = 0;
  if (a.gas > 0 && !hand) acc += a.gas * D.zug * (TB ? TB.schub : 1) * cl((vMax * 1.03 - s) / (vMax * 0.15), 0, 1) * Math.min(1, gr.haft * 1.4);
  if (s > vMax * 1.03) acc -= (s - vMax) * 2.5;   // nach dem Turbo: zurück aufs normale Höchsttempo
  acc -= a.brems * D.bremse * gr.haft;
  if (hand) acc -= D.handBremst;
  acc -= D.rollen + (a.gas > 0 ? 0 : D.motor * s) + gr.zieh * G * Math.min(1, s / 0.3);
  acc -= D.reibt * Math.abs(Math.sin(beta));
  s = Math.max(0, s + acc * dt);
  // Fahrtrichtung: volles Lenken = die engste Kurve, die bei diesem Tempo geht
  const quer = p.haft * G * gr.haft * (hand ? D.handEng : 1);
  const dreh = w * Math.min(s * D.eng, quer / Math.max(s, 0.05));
  kurs += dreh * dt;
  // Drift-Winkel: Lenken und Gas stellen das Auto quer (Nase zeigt in die Kurve hinein)
  const tempoK = cl((s - 0.22 * p.vMax) / (0.3 * p.vMax), 0, 1);
  let ziel;
  if (hand) { const seite = Math.abs(w) > 0.08 ? Math.sign(w) : -Math.sign(beta); ziel = -seite * D.hand * cl(s / (0.3 * p.vMax), 0, 1); }
  else ziel = -Math.sign(w) * cl((Math.abs(w) - D.ab) / (1 - D.ab), 0, 1) * D.winkel * (D.ohneGas + (1 - D.ohneGas) * a.gas) * tempoK;
  const mehr = ziel * beta < 0 || Math.abs(ziel) > Math.abs(beta);
  const b2 = beta + (ziel - beta) * Math.min(1, dt * (mehr ? D.ein : D.aus));
  const hNeu = kurs - b2;
  a.r = (hNeu - a.h) / dt; a.h = hNeu;
  a.u = s * Math.cos(b2); a.v = s * Math.sin(b2); a.ax = acc;
  a.x += Math.sin(kurs) * s * dt; a.z += Math.cos(kurs) * s * dt;
  // Vorderräder zeigen dorthin, wohin das Auto fährt (im Drift sieht das wie Gegenlenken aus)
  a.lenk = cl(b2 * 0.9 + w * 0.2, -p.lenkMax, p.lenkMax);
  a.rutschHinten = cl((Math.abs(b2) - 0.12) / 0.3, 0, 1); a.rutschVorn = a.rutschHinten * 0.4;
}

function luftHelfer(a, T, f, dt) {
  const i = f.i, rw = Math.atan2(T.tx[i], T.tz[i]);
  let d = rw - a.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  a.r *= Math.exp(-dt * 4);                                     // Drehen in der Luft hört schnell auf
  a.v *= Math.exp(-dt * 3);                                     // seitliches Rutschen auch: Man landet gerade
  if (Math.abs(d) > 1.2) return;                                // fährt das Auto quer oder rückwärts: nicht eingreifen
  // Nase und Fahrtrichtung drehen zusammen: zur Straße hin, und du kannst auch im Flug noch etwas lenken
  a.h += d * Math.min(1, dt * 3) + a.lenkWunsch * 0.45 * dt;
  // zur Mitte des Wegs: Je weiter außen, desto mehr schiebt die Hilfe den Flug zurück (sonst landet man im Wald)
  const hb = T.hb[i], aussen = Math.max(0, Math.abs(f.d) - hb * 0.35) / hb;
  if (aussen > 0) { const schub = -Math.sign(f.d) * Math.min(1, aussen) * 5 * dt; a.x += T.tz[i] * schub; a.z -= T.tx[i] * schub; }
}

function streckenHelfer(a, T, f, A, dt, kl = 1) {
  const i = f.i, tx = T.tx[i], tz = T.tz[i];
  const sh = Math.sin(a.h), ch = Math.cos(a.h);
  const wx = sh * a.u + ch * a.v, wz = ch * a.u - sh * a.v;   // Tempo in der Welt
  const tempo = Math.hypot(wx, wz);
  const seite = f.d >= 0 ? 1 : -1;
  const raus = (wx * tz - wz * tx) * seite;                     // wie schnell es zum nächsten Rand hin geht
  if (raus <= 0) return;
  const abstand = T.hb[i] - 1.0 * kl - Math.abs(f.d);                // so viel Platz ist noch bis zum Rand (Auto ist 2 m breit)
  const zone = 3 * kl + 0.3 * tempo;                                 // ab hier hilft die Straße (bei 200 km/h ab gut 19 m vor dem Rand)
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
    // Arcade: Das Auto fällt schneller, als es in echt würde (fall) – so sind die Sprünge kurz und knackig,
    // und man hat schnell wieder Räder am Boden zum Lenken
    const fall = a.arcade && a.p.arcade && a.p.arcade.fall || 1;
    a.vy -= G * fall * dt; a.y += a.vy * dt; a.flug += dt;
    // In der Luft dreht sich das Auto weiter, wie es abgesprungen ist – aber gebremst (Spiel-Wert: sonst landet man zu oft quer)
    a.r *= Math.exp(-dt * 2.5);
    if (a.y <= boden) {
      // aufsetzen: je steiler das Auto im Vergleich zur Straße fällt, desto härter
      const hart = Math.max(0, steig * vLang - a.vy);
      a.landung = hart; a.luft = false; a.y = boden; a.vy = steig * vLang;
      const weich = a.arcade && a.p.arcade && a.p.arcade.fall;     // Arcade: Landen kostet kaum Tempo und das Auto steht sofort gerade
      if (hart > 5) { a.u *= 1 - Math.min(weich ? 0.04 : 0.12, (hart - 5) * 0.015); a.stoss = Math.max(a.stoss, (hart - 5) * 1.5); }
      if (weich) { a.v *= 0.3; a.r *= 0.3; }
    }
  } else {
    a.vy = steig * vLang; a.y = boden;
    // (Arcade: erst bei einer deutlichen Kuppe abheben, nicht schon auf jeder Bodenwelle)
    const ab = a.arcade && a.p.arcade && a.p.arcade.abheben || 1;
    if (-kv * vLang * vLang > G * ab && Math.abs(vLang) > 8) { a.luft = true; a.flug = 0; }
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
