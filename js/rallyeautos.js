// Rennspiel – die Rallyeautos (ohne three.js, auch in node testbar).
//
// Drei ausgedachte Rallyeautos, jedes einem bekannten Vorbild nachempfunden ("Vorbild"),
// aber ohne Logo, ohne echte Lackierung und mit ausgedachtem Namen.
//
// Was ist anders als bei den Supercars?
//   - Allradantrieb: Die Kraft geht auf alle vier Räder. So kann man mit Gas aus dem Drift herausziehen.
//   - Kein Schleuderschutz (ESP): Auf Schotter soll das Heck herumkommen, du fängst es mit Gegenlenken.
//   - Großer Lenkeinschlag, damit man auch quer stehend noch gegenlenken kann.
//   - Weiche Reifenkurve (kleines B): Das Auto rutscht nicht plötzlich weg, sondern gleitet langsam in den Drift.
//   - Kurze Gänge und nur gut 200 km/h Höchsttempo, dafür reißt es aus jeder Kurve heraus.
// Alle Zahlen sind geschätzt und so gewählt, dass es sich gut fahren lässt (mit Absicht etwas kräftiger als echt).

const KMH = 1 / 3.6;

const BASIS = {
  super: true, rallye: true,
  a: 1.18, b: 1.32,                  // Radstand 2,5 m (kurz und wendig)
  hoehe: 0.5,
  haft: 1.18, hinten: 0.99,          // hinten ein klein wenig weniger Halt als vorn: Das Heck kommt gern herum
  B: 6.2, C: 1.55,                   // weiche Reifenkurve: gutmütiges, langsames Wegrutschen
  abtrieb: 0.9, abtriebVorn: 0.45,
  widerstand: 0.85,
  rollen: 0.016,
  bremse: 1.0, bremseVorn: 0.62,
  bremsGriff: 1.7, zugGriff: 2.0, schub: 1.85,   // kräftige Spiel-Bremse und viel Schub (mit Absicht stärker als echt)
  // Schleuderschutz erst ab knapp 30° Rutschwinkel: Driften ist erwünscht, Drehen nicht (aus mit „Traktion aus“)
  esp: { beta: 0.5, dreh: 5, quer: 0.25 },
  // Arcade-Hilfe wie bei den Supercars (siehe physik.js), aber mit mehr Drift: bis "frei" (gut 15°) darf das Auto
  // quer stehen, mit Handbremse bis "freiHand" (gut 35°). Was darüber hinaus rutscht, holt die Hilfe zurück, ohne Tempo
  // zu kosten. "fang" fängt das Heck ab, wenn es sich schneller dreht, als die Räder zeigen – so kommt man aus jedem
  // Schleudern wieder heraus, auch ohne perfektes Gegenlenken. "belag": Auf Schotter und Matsch hilft sie etwas mehr.
  // "sauber": Die Räder drehen bei Tempo nur so weit, wie es etwas bringt (sonst bremst voller Einschlag das Auto fast bis zum Stand).
  // "fall": In der Luft fällt das Auto 2,2-mal so schnell (kurze Sprünge), "abheben": erst an deutlichen Kuppen abheben.
  arcade: { lenk: 1.3, folgen: 20, griff: 1.35, ein: 8, fang: 8, frei: 0.06, freiHand: 0.62, halt: 8, rand: 3.2, belag: 0.6, sauber: 0.1, kreis: 7, spur: 1.5, ruhe: 1, fall: 2.2, abheben: 1.5 },
  tcRest: 0.9,                       // Traktionskontrolle (wenn an) lässt nur wenig Haftung für die Kurve übrig
  lenkMax: 0.62, lenkTempo: 24,
  gaenge: 6, drehzahlMax: 8200, rueck: 7, abregeln: true,
  schritte: 8, unten: 3,
  allrad: 0.45,
  auge: [0.36, 1.12, -0.35],
};

export const RALLYEAUTOS = [
  {
    id: 'sturmfalke', name: 'Sturmfalke RX1', vorbild: 'moderner WRC-Kleinwagen (Ford Fiesta WRC)',
    text: 'Das moderne Werksauto: kurz, leicht, riesiger Flügel. Dreht blitzschnell ein und ist leicht zu fangen.',
    p: { masse: 1260, leistung: 400000, schubMax: 14500, vMax: 205 * KMH, haft: 1.2, lenkMax: 0.64 },
    farbe: 0x1e5bd8, zweit: 0xf2f2f2, jahr: 2026,
  },
  {
    id: 'quadra', name: 'Quadra S1 Gruppe B', vorbild: 'Gruppe-B-Coupé der 80er (Audi Sport quattro S1)',
    text: 'Das Monster aus den Achtzigern: enorm viel Kraft, wenig Halt. Für Mutige – das Heck will immer nach außen.',
    p: { masse: 1100, leistung: 440000, schubMax: 14000, vMax: 215 * KMH, haft: 1.1, hinten: 0.97, allrad: 0.4, traeg: 1350, a: 1.3, b: 1.2, drehzahlMax: 7800, gaenge: 5 },
    farbe: 0xd8d8d2, zweit: 0xd01818, jahr: 1985,
  },
  {
    id: 'kaiten', name: 'Kaiten 98 WRC', vorbild: 'Rallye-Limousine der 90er (Subaru Impreza WRC)',
    text: 'Die Limousine aus den Neunzigern: satt, ruhig und sicher. Verzeiht viel – gut für den Anfang.',
    p: { masse: 1230, leistung: 340000, schubMax: 13800, vMax: 200 * KMH, haft: 1.22, hinten: 1.0, allrad: 0.5, a: 1.22, b: 1.3 },
    farbe: 0x1d3f9a, zweit: 0xf4c519, jahr: 1998,
  },
];

export const rallyeauto = id => RALLYEAUTOS.find(s => s.id === id) || RALLYEAUTOS[0];

// Werte für die Fahrphysik (kommen in physik.js zu AUTOS dazu)
export const RALLYE_AUTOS = Object.fromEntries(RALLYEAUTOS.map(s => [s.id, {
  ...BASIS, traeg: s.p.masse * 1.3, ...s.p, name: s.name,
}]));
