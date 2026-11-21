// Rennspiel – die Rennstrecken. Alle sind ausgedacht (keine echten Strecken nachgebaut).
//
// ecken: die Eckpunkte der Strecke in Fahrtrichtung [x, z, Kurvenhalbmesser] in Metern (z zeigt auf der Karte nach unten).
//        Zwischen zwei Ecken liegt eine Gerade, jede Ecke wird zu einer Kurve abgerundet. Start: Gerade von der letzten zur ersten Ecke.
// hoehe: [Anteil der Runde, Höhe in Metern] – dazwischen geht es weich bergauf und bergab.
// aus:   was neben der Strecke liegt: 'gras', 'kies', 'mauer' (oder { l: …, r: … } für links und rechts).
// welt:  wie die Landschaft aussieht (streckebau.js).

export const STRECKEN = [
  {
    id: 'kueste', name: 'Küstenring Bellamar', ort: 'Am Meer, mittags',
    text: 'Schnelle Strecke an der Steilküste: lange Gerade, enge Haarnadel, schnelle Wechselkurven und eine Schikane.',
    breite: 14, glatt: 30,
    ecken: [
      [500, 0, 20], [520, 160, 40], [380, 260, 90], [420, 420, 60], [700, 520, 150],
      [900, 900, 15], [600, 820, 30], [500, 950, 25, { aus: 'kies' }], [420, 830, 25, { aus: 'kies' }],
      [100, 700, 120], [-300, 750, 40], [-500, 500, 200], [-900, 350, 35], [-950, 0, 70],
    ],
    hoehe: [[0, 4], [0.18, 2], [0.32, 9], [0.45, 16], [0.6, 12], [0.75, 6], [0.9, 3]],
    welt: { art: 'kueste', zeit: 'mittag' },
  },
  {
    id: 'wald', name: 'Bergwald-Ring', ort: 'In den Hügeln, Nachmittag',
    text: 'Alte Strecke im Wald mit viel Auf und Ab: eine Kuppe nach dem Start, Schlangenlinien und eine schnelle Senke.',
    breite: 12, glatt: 30,
    ecken: [
      [300, 0, 50], [450, 150, 120], [420, 400, 35], [250, 450, 60], [150, 600, 60], [250, 750, 60],
      [150, 900, 25], [-100, 880, 200], [-350, 700, 100], [-300, 450, 40], [-450, 300, 18], [-250, 200, 70], [-200, 0, 80],
    ],
    hoehe: [[0, 20], [0.08, 34], [0.2, 26], [0.35, 10], [0.5, 4], [0.62, 18], [0.78, 30], [0.9, 24]],
    welt: { art: 'wald', zeit: 'nachmittag' },
  },
  {
    id: 'hafen', name: 'Hafenkurs Porto Lumen', ort: 'Stadt am Hafen, Abendrot',
    text: 'Straßenkurs zwischen Häusern und Mauern: eng, mit vielen rechten Winkeln. Ein Fehler, und man steht in der Mauer.',
    breite: 11, glatt: 18, aus: 'mauer', mauerAbstand: 1.4,
    ecken: [
      [400, 0, 14], [400, 200, 12], [250, 200, 14], [250, 330, 25], [300, 420, 25], [300, 600, 13],
      [-100, 600, 40], [-150, 520, 40], [-350, 520, 12], [-350, 300, 15], [-200, 250, 15], [-250, 120, 13], [-400, 120, 14], [-400, 0, 14],
    ],
    hoehe: [[0, 2], [0.3, 2], [0.45, 7], [0.6, 7], [0.8, 3]],
    welt: { art: 'hafen', zeit: 'abend' },
  },
  {
    id: 'wohnzimmer', name: 'Wohnzimmer-Ring', ort: 'Ferngesteuertes Auto auf dem Teppich',
    text: 'Eine Rennstrecke aus Matten quer durchs Wohnzimmer. Du stehst daneben und lenkst das kleine Auto aus der Ferne.',
    modell: true, ds: 0.03, breite: 0.46, glatt: 10, kerbAb: 1 / 1.4,
    aus: 'asphalt', grasBreite: 0.12,
    ecken: [
      [3.5, 0, 0.75], [3.5, 2.12, 0.69], [1.94, 2.5, 0.56], [1.44, 1.31, 0.5], [0.19, 1.31, 0.5], [-0.31, 2.81, 0.62], [-2, 2.94, 0.62], [-2.5, 1.56, 0.53], [-3.62, 1.44, 0.56], [-3.62, 0, 0.75],
    ],
    hoehe: [[0, 0]],
    welt: { art: 'zimmer', zeit: 'drinnen' },
  },
  // Slotcar-Bahnen: zwei Spuren mit Schlitz. spur = Abstand einer Spur von der Mitte.
  // weichen = Stellen (Anteil der Runde), an denen man die Spur wechseln kann.
  {
    id: 'slot_oval', name: 'Kinderzimmer-Kurs', ort: 'Slotcar-Bahn, 2 Spuren',
    text: 'Zwei lange Geraden, eine enge Kehre und eine Schikane. Fünf Weichen zum Spurwechseln.',
    modell: true, slot: true, spur: 0.05, ds: 0.02, breite: 0.2, glatt: 8, kerbAb: 1 / 1.2,
    aus: 'asphalt', grasBreite: 0.02,
    ecken: [
      [2.5, 0, 0.42], [2.5, 1.3, 0.36], [1.2, 1.3, 0.3], [0.8, 0.6, 0.3], [-0.3, 0.6, 0.3], [-0.7, 1.5, 0.34], [-2.5, 1.5, 0.4], [-2.5, 0, 0.42],
    ],
    weichen: [0.05, 0.34, 0.485, 0.65, 0.89],
    hoehe: [[0, 0]],
    welt: { art: 'zimmer', zeit: 'drinnen' },
  },
  {
    id: 'slot_gross', name: 'Großer Preis vom Teppich', ort: 'Slotcar-Bahn, 2 Spuren',
    text: 'Lange Bahn mit schneller Geraden, weiten Bögen und drei engen Kurven. Acht Weichen.',
    modell: true, slot: true, spur: 0.05, ds: 0.02, breite: 0.2, glatt: 8, kerbAb: 1 / 1.2,
    aus: 'asphalt', grasBreite: 0.02,
    ecken: [
      [3.3, 0, 0.5], [3.3, 1.2, 0.34], [2.0, 1.2, 0.3], [2.0, 2.5, 0.38], [0.4, 2.5, 0.6], [-0.1, 1.0, 0.32],
      [-1.2, 1.0, 0.3], [-1.5, 2.5, 0.4], [-3.3, 2.5, 0.55], [-3.3, 0, 0.5],
    ],
    weichen: [0.04, 0.272, 0.4, 0.48, 0.6, 0.68, 0.78, 0.9],
    hoehe: [[0, 0]],
    welt: { art: 'zimmer', zeit: 'drinnen' },
  },
];

export const strecke = id => STRECKEN.find(s => s.id === id) || STRECKEN[0];
