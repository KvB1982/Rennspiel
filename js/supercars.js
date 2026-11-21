// Rennspiel – die Supercars (ohne three.js, auch in node testbar).
//
// Jedes Auto ist einem bekannten Sportwagen nachempfunden ("Vorbild"), hat aber einen ausgedachten Namen,
// kein Logo und keine echte Lackierung. Die Zahlen sind ungefähr wie beim Vorbild (Gewicht, Leistung,
// Höchsttempo) und sonst geschätzt, damit es sich gut fahren lässt.
//
// Fahrphysik: dieselbe wie beim Rennwagen (physik.js), nur mit Werten für ein Straßenauto:
// schwerer, weniger Abtrieb, Reifen für die Straße, größerer Lenkeinschlag.

const KMH = 1 / 3.6;

// Gemeinsame Werte aller Supercars
const BASIS = {
  super: true,
  a: 1.25, b: 1.45,                 // Abstand Schwerpunkt → Vorderachse / Hinterachse (m), Radstand 2,7 m
  hoehe: 0.45,
  haft: 1.16, hinten: 1.08,         // Straßenreifen haften weniger als Rennreifen
  B: 8, C: 1.5,
  abtrieb: 0.5, abtriebVorn: 0.45,
  widerstand: 0.75,                 // Luftwiderstand (Fläche mal Beiwert, m²)
  rollen: 0.013,
  bremse: 1.0, bremseVorn: 0.68,
  zugGriff: 1.7, schub: 1.35,       // kräftiger Antritt: Reifen halten längs mehr aus, Motor zieht 1,35-mal so stark (Spiel-Werte)
  bremsGriff: 1.9,                 // kräftige Spiel-Bremse: längs halten die Reifen mehr aus als zur Seite
  esp: { beta: 0.14, dreh: 9, quer: 0.5 },   // Schleuderschutz: bis etwa 8° Driften ist erlaubt, dann fängt er das Auto
  lenkMax: 0.5, lenkTempo: 22,
  lenkGriff: 1.35, lenkDazu: 0.05,   // Schutz vor zu starkem Einlenken (siehe lenkSchutz in physik.js)
  gaenge: 7, drehzahlMax: 8500, rueck: 8, abregeln: true,
  schritte: 8, unten: 3,
  tcRest: 0.82,                     // Traktionskontrolle lässt mehr Haftung für die Kurve übrig als beim Rennwagen
  allrad: 0,                        // Anteil der Antriebskraft auf den Vorderrädern (0 = nur hinten)
  auge: [0.36, 1.06, -0.25],        // wo die Augen des Fahrers sind (links, hoch, vor) – für die Cockpit-Kamera
};

export const SUPERCARS = [
  {
    id: 'falkner', name: 'Falkner 9 Turbo', vorbild: 'Porsche 911 Turbo',
    text: 'Motor hinten, runde Scheinwerfer, sehr gutmütig. Gut für den Anfang.',
    p: { allrad: 0.4, masse: 1640, leistung: 478000, schubMax: 15500, vMax: 330 * KMH, haft: 1.2, hinten: 1.12, widerstand: 0.72, drehzahlMax: 7200 },
    farbe: 0xf2f2ee, zweit: 0x1a1a1a,
  },
  {
    id: 'taurino', name: 'Taurino Furia V12', vorbild: 'Lamborghini',
    text: 'Flach wie ein Keil, scharfe Kanten, laut. Zwölf Zylinder hinter dir.',
    p: { allrad: 0.3, masse: 1770, leistung: 746000, schubMax: 17000, vMax: 350 * KMH, haft: 1.18, widerstand: 0.78, abtrieb: 0.8, drehzahlMax: 9500 },
    farbe: 0x9be22d, zweit: 0x111111,
  },
  {
    id: 'stallone', name: 'Stallone Rosso 8', vorbild: 'Ferrari',
    text: 'Lange Haube, rund und schnell. Dreht willig in die Kurve.',
    p: { allrad: 0.2, masse: 1570, leistung: 735000, schubMax: 16000, vMax: 340 * KMH, haft: 1.18, lenkMax: 0.52, widerstand: 0.74, drehzahlMax: 9000 },
    farbe: 0xd01818, zweit: 0xf4d23c,
  },
  {
    id: 'aurelion', name: 'Aurelion Royale W16', vorbild: 'Bugatti Chiron',
    text: 'Schwer, riesig stark, über 400 km/h. Bremst früh – es schiebt mächtig.',
    p: { allrad: 0.4, masse: 1995, leistung: 1100000, schubMax: 20000, vMax: 420 * KMH, haft: 1.17, widerstand: 0.7, abtrieb: 0.9, drehzahlMax: 6800, gaenge: 7, bremse: 1.05 },
    farbe: 0x1d3f8a, zweit: 0x101418,
  },
  {
    id: 'nordvind', name: 'Nordvind Spöke', vorbild: 'Koenigsegg Jesko',
    text: 'Leicht, mit großem Flügel und der meisten Kraft. Für Profis.',
    p: { masse: 1420, leistung: 1200000, schubMax: 16000, vMax: 470 * KMH, haft: 1.2, widerstand: 0.68, abtrieb: 1.5, drehzahlMax: 8500, gaenge: 9 },
    farbe: 0xf4f4f6, zweit: 0xf07a12,
  },
  {
    id: 'vento', name: 'Vento Argento', vorbild: 'Pagani Huayra',
    text: 'Rund wie ein Flugzeug, vier Auspuffrohre in der Mitte, Flügelklappen.',
    p: { masse: 1350, leistung: 600000, schubMax: 14500, vMax: 380 * KMH, haft: 1.19, widerstand: 0.7, abtrieb: 1.0, drehzahlMax: 7000 },
    farbe: 0x8a96a4, zweit: 0x2a2a2e,
  },
  {
    // Das einzige Supercar, das nicht aus 3D AI Studio kommt: freies Modell von Karol Miklas (CC-BY-SA 4.0, siehe LIZENZEN.md),
    // Wappen, Schriftzug und Nummernschilder entfernt
    id: 'falkner_s', name: 'Falkner 9 S Allrad', vorbild: 'Porsche 911 Carrera 4S',
    text: 'Der kleine Bruder des Turbo: weniger Kraft, aber Allrad und sehr genau zu lenken.',
    p: { allrad: 0.35, masse: 1565, leistung: 331000, schubMax: 13500, vMax: 306 * KMH, haft: 1.21, hinten: 1.13, widerstand: 0.7, drehzahlMax: 7500, lenkMax: 0.52 },
    farbe: 0x2a8fe0, zweit: 0x1a1a1a,
  },
];

// Lackfarben zum Aussuchen (die erste ist die Lieblingsfarbe des Autos)
export const LACKE = [
  { name: 'Werksfarbe', farbe: null },
  { name: 'Rennrot', farbe: 0xd01818 }, { name: 'Giftgrün', farbe: 0x7fd61f }, { name: 'Gelb', farbe: 0xf4c519 },
  { name: 'Orange', farbe: 0xf07a12 }, { name: 'Himmelblau', farbe: 0x2a8fe0 }, { name: 'Nachtblau', farbe: 0x18264a },
  { name: 'Schwarz', farbe: 0x141416 }, { name: 'Weiß', farbe: 0xf4f4f2 }, { name: 'Silber', farbe: 0xb5bcc4 }, { name: 'Lila', farbe: 0x6a3bb0 },
];

export const supercar = id => SUPERCARS.find(s => s.id === id) || SUPERCARS[0];

// Werte für die Fahrphysik (werden in physik.js zu AUTOS hinzugefügt)
export const SUPER_AUTOS = Object.fromEntries(SUPERCARS.map(s => [s.id, {
  ...BASIS, ...s.p, name: s.name, traeg: s.p.masse * 1.55,
}]));
