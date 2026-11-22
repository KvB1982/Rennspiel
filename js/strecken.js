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
  // ---------------------------------------------------------------- mehr Rennstrecken in anderen Landschaften
  // Wüste, Hochgebirge, Großstadt bei Nacht und ein alter Schlosspark im Herbst. Wie die Landschaft aussieht,
  // steht in streckebau.js (LAND). stimmung = Angaben, die für diese Strecke anders sind als sonst zu dieser Tageszeit.
  {
    id: 'wueste', name: 'Dünenring Al-Qamar', ort: 'In der Wüste, Mittagshitze',
    text: 'Schnelle Strecke zwischen Sanddünen und roten Tafelbergen: eine Gerade von über einem Kilometer, weite Bögen und eine enge Kehre an der Oase.',
    breite: 15, glatt: 30,
    ecken: [
      [800, 0, 30], [860, 260, 70], [600, 420, 130], [680, 760, 90], [300, 940, 180], [-120, 820, 70], [-260, 1080, 50],
      [-620, 1040, 110], [-760, 660, 220], [-420, 420, 80], [-640, 200, 55], [-900, 280, 45], [-1000, 0, 90],
    ],
    hoehe: [[0, 6], [0.2, 10], [0.35, 22], [0.5, 12], [0.65, 26], [0.8, 14], [0.92, 6]],
    welt: { art: 'wueste', zeit: 'mittag', stimmung: { nebel: 0xe6d3b0, nebelWeit: 5200, truebe: 5 } },
  },
  {
    id: 'alpen', name: 'Alpenring Silbersee', ort: 'Hochtal in den Bergen, Mittag',
    text: 'Bergauf und bergab durch ein Hochtal: steil hinauf zur Almkurve, in schnellen Bögen wieder hinunter zum See. Ringsum Gipfel mit Schnee.',
    breite: 12.5, glatt: 28,
    ecken: [
      [520, 0, 28], [640, 260, 50], [420, 380, 45], [520, 620, 90], [260, 820, 140], [-60, 700, 40], [-140, 440, 60],
      [-420, 520, 35], [-560, 300, 110], [-360, 140, 30], [-640, 60, 45], [-560, -20, 20],
    ],
    hoehe: [[0, 30], [0.12, 34], [0.25, 62], [0.38, 86], [0.5, 70], [0.62, 46], [0.75, 58], [0.88, 36]],
    welt: { art: 'alpen', zeit: 'mittag', stimmung: { nebelWeit: 7000 } },
  },
  {
    id: 'nacht', name: 'Nachtrennen Lumina City', ort: 'Großstadt bei Nacht, Flutlicht',
    text: 'Straßenkurs unter Flutlicht zwischen leuchtenden Hochhäusern: ein langer Boulevard, rechte Winkel, eine schnelle Schlange – und überall Mauern.',
    breite: 13, glatt: 16, aus: 'mauer', mauerAbstand: 1.6,
    ecken: [
      [700, 0, 16], [700, 260, 18], [480, 260, 14], [480, 520, 60], [760, 760, 22], [560, 940, 25], [180, 800, 150],
      [-200, 900, 20], [-200, 620, 18], [-520, 620, 16], [-520, 380, 40], [-360, 220, 35], [-600, 120, 16], [-600, 0, 16],
    ],
    hoehe: [[0, 2], [0.3, 2], [0.5, 8], [0.7, 3]],
    welt: { art: 'nacht', zeit: 'nacht' },
  },
  {
    id: 'park', name: 'Königspark-Ring', ort: 'Alter Schlosspark im Herbst, Nachmittag',
    text: 'Die schnellste Strecke: lange Geraden unter bunten Herbstbäumen, drei Schikanen zum Abbremsen und zwei endlos lange Kurven. Hier zählt Höchsttempo.',
    breite: 13, glatt: 32,
    ecken: [
      [900, 0, 60], [960, 60, 25, { aus: 'kies' }], [1040, 20, 25, { aus: 'kies' }], [1300, 120, 180], [1380, 520, 240], [1040, 800, 120],
      [700, 760, 30, { aus: 'kies' }], [640, 850, 30, { aus: 'kies' }], [200, 900, 300], [-300, 760, 60], [-400, 820, 40], [-700, 760, 160], [-900, 400, 130], [-760, 0, 150],
    ],
    hoehe: [[0, 8], [0.25, 14], [0.5, 6], [0.75, 12]],
    welt: { art: 'park', zeit: 'nachmittag' },
  },
  {
    id: 'wohnzimmer', name: 'Wohnzimmer-Ring', ort: 'Ferngesteuertes Auto auf dem Teppich',
    text: 'Eine Rennstrecke aus Matten quer durchs Wohnzimmer. Du stehst daneben und lenkst das kleine Auto aus der Ferne.',
    modell: true, ds: 0.03, breite: 0.46, glatt: 10, kerbAb: 1 / 1.4,
    kiesBreite: 0.38, grasBreite: 0.14,   // außen in den Kurven ein Kiesbett als Auslauf, sonst ein schmaler Filzstreifen
    // Turbo-Felder: [Anteil der Runde, Seite (−1 = rechts … 1 = links)] – leuchtende Pfeile, die einen Schub geben
    turbo: [[0.95, 0.5], [0.247, 0], [0.535, 0]],
    ecken: [
      [3.5, 0, 0.75], [3.5, 2.12, 0.69], [1.94, 2.5, 0.56], [1.44, 1.31, 0.5], [0.19, 1.31, 0.5], [-0.31, 2.81, 0.62], [-2, 2.94, 0.62], [-2.5, 1.56, 0.53], [-3.62, 1.44, 0.56], [-3.62, 0, 0.75],
    ],
    hoehe: [[0, 0]],
    welt: { art: 'zimmer', zeit: 'drinnen' },
  },
  // Slotcar-Bahnen: zwei Spuren mit Schlitz. spur = Abstand einer Spur von der Mitte.
  // weichen = Stellen (Anteil der Runde), an denen man die Spur wechseln kann.
  // Die Bahn ist breiter als eine echte Kunststoffbahn (dort: 20 cm breit, Spuren 10 cm auseinander),
  // damit die Autos mehr Platz haben. Außen in den Kurven liegen Randstreifen als Auslauf.
  {
    id: 'slot_oval', name: 'Kinderzimmer-Kurs', ort: 'Slotcar-Bahn, 2 Spuren',
    text: 'Zwei lange Geraden, eine enge Kehre und eine Schikane. Fünf Weichen zum Spurwechseln, Boxengasse an der Startgeraden.',
    modell: true, slot: true, spur: 0.075, ds: 0.03, breite: 0.3, glatt: 8, kerbAb: 1 / 1.9,
    kiesBreite: 0.16, grasBreite: 0.03,
    ecken: [
      [4, 0, 0.67], [4, 2.08, 0.58], [1.92, 2.08, 0.48], [1.28, 0.96, 0.48], [-0.48, 0.96, 0.48], [-1.12, 2.4, 0.54], [-4, 2.4, 0.64], [-4, 0, 0.67],
    ],
    weichen: [0.26, 0.34, 0.485, 0.65, 0.8],
    hoehe: [[0, 0]],
    welt: { art: 'zimmer', zeit: 'drinnen' },
  },
  {
    id: 'slot_gross', name: 'Großer Preis vom Teppich', ort: 'Slotcar-Bahn, 2 Spuren',
    text: 'Lange Bahn mit schneller Geraden, weiten Bögen und drei engen Kurven. Sechs Weichen, Boxengasse an der Startgeraden.',
    modell: true, slot: true, spur: 0.075, ds: 0.03, breite: 0.3, glatt: 8, kerbAb: 1 / 1.9,
    kiesBreite: 0.16, grasBreite: 0.03,
    ecken: [
      [5.28, 0, 0.8], [5.28, 1.92, 0.54], [3.2, 1.92, 0.48], [3.2, 4, 0.61], [0.64, 4, 0.96], [-0.16, 1.6, 0.51], [-1.92, 1.6, 0.48], [-2.4, 4, 0.64], [-5.28, 4, 0.88], [-5.28, 0, 0.8],
    ],
    weichen: [0.272, 0.4, 0.48, 0.6, 0.68, 0.79],
    hoehe: [[0, 0]],
    welt: { art: 'zimmer', zeit: 'drinnen' },
  },
  // Drift-Matten für die kleinen Rallyeautos (Maßstab 1:43). Vorbild: Driftautos, die man mit dem Handy steuert und die
  // auf jedem glatten Boden fahren – oft auf einer großen bedruckten Matte. Die Strecken sind mit Absicht breit und offen
  // (60 bzw. 54 cm, das sind im Maßstab 26 bzw. 23 Meter), damit man quer durch die Kurven rutschen kann.
  // Außen herum liegt ein Streifen Matte als Auslauf, dahinter eine weiche Schaumstoff-Bande.
  {
    id: 'drift_matte', name: 'Gymkhana-Matte', ort: 'Drift-Matte im Wohnzimmer, 1:43',
    text: 'Kurze, breite Matte mit zwei Kehren und einem Haken in der Mitte. Hier lernst du driften: Gas in der Kurve, gegenlenken!',
    modell: true, drift: true, massstab: 1 / 43, ds: 0.02, breite: 0.6, glatt: 8, kerbAb: 1 / 0.6,
    aus: 'gras', grasBreite: 0.12,
    turbo: [[0.93, 0], [0.24, 0.5], [0.612, -0.5]],
    ecken: [
      [1.9, 0, 0.5], [1.9, 1.9, 0.5], [0.75, 1.9, 0.38], [0.25, 1.05, 0.36], [-0.35, 1.9, 0.38], [-1.9, 1.9, 0.5], [-1.9, 0, 0.5],
    ],
    hoehe: [[0, 0]],
    welt: { art: 'zimmer', zeit: 'drinnen' },
  },
  {
    id: 'drift_rallye', name: 'Rallye-Teppich', ort: 'Große Drift-Strecke, 1:43',
    text: 'Lange, offene Strecke mit schnellen Bögen, einer Wechselkurven-Schlange und zwei engen Kehren zum Querstellen.',
    modell: true, drift: true, massstab: 1 / 43, ds: 0.02, breite: 0.54, glatt: 8, kerbAb: 1 / 0.6,
    aus: 'gras', grasBreite: 0.12,
    turbo: [[0.91, 0], [0.225, 0.4], [0.75, -0.4]],
    ecken: [
      [3.1, 0, 0.55], [3.1, 2.2, 0.6], [1.7, 2.9, 0.5], [0.9, 2.0, 0.42], [0.1, 2.9, 0.42], [-0.7, 2.0, 0.42], [-1.6, 3.0, 0.5],
      [-3.1, 2.6, 0.45], [-2.3, 1.2, 0.4], [-3.1, 0, 0.5],
    ],
    hoehe: [[0, 0]],
    welt: { art: 'zimmer', zeit: 'drinnen' },
  },
  // ---------------------------------------------------------------- Straßen-Strecken für die Supercars
  // Hier fährt man auf normalen Straßen: durch die Stadt, über Land, auf der Autobahn – mit Verkehr.
  // Die Zone (stadt, dorf, land, autobahn) steht an der Geraden nach einer Ecke ({ zone: … } als 5. Angabe)
  // und gilt bis zur nächsten Angabe. Was eine Zone bedeutet, steht in strecke.js (ZONEN).
  {
    id: 'metropole', name: 'Metropole Valmera', ort: 'Großstadt, Abendrot',
    text: 'Quer durch die Innenstadt: breite Boulevards zwischen Hochhäusern, enge Kreuzungen, eine lange Allee am Fluss.',
    strasse: true, zone: 'stadt', glatt: 12, kerbAb: 1,
    ecken: [
      [600, 0, 30], [600, 500, 25], [300, 500, 22], [300, 800, 40], [900, 1100, 60], [1250, 1100, 28],
      [1250, 1550, 32], [400, 1550, 60], [-250, 1300, 120], [-500, 900, 28], [-200, 700, 26], [-500, 400, 30], [-500, 0, 30],
    ],
    hoehe: [[0, 0]],
    welt: { art: 'stadt', zeit: 'abend', staedte: [{ x: 350, z: 750, r: 1300, name: 'Valmera' }] },
  },
  {
    id: 'landstrasse', name: 'Hügelland-Runde', ort: 'Landstraße, Nachmittag',
    text: 'Kurvige Landstraße über Hügel, an Feldern und Wäldern vorbei, mitten durch zwei kleine Dörfer.',
    strasse: true, zone: 'land', glatt: 25, kerbAb: 1,
    ecken: [
      [700, 0, 120, {}, { zone: 'land' }], [1300, 300, 200], [1500, 900, 90], [1200, 1300, 60], [1500, 1700, 150],
      [1300, 2300, 70, {}, { zone: 'dorf' }], [900, 2350, 40, {}, { zone: 'land' }], [400, 2100, 180], [-200, 2400, 110],
      [-700, 2000, 60], [-600, 1500, 140], [-1100, 1100, 90], [-900, 500, 70], [-500, 0, 60, {}, { zone: 'dorf' }],
    ],
    hoehe: [[0, 5], [0.1, 30], [0.2, 62], [0.3, 40], [0.42, 15], [0.55, 48], [0.66, 80], [0.78, 44], [0.9, 20]],
    welt: { art: 'land', zeit: 'nachmittag', staedte: [] },
  },
  {
    id: 'staedtetour', name: 'Städtetour Valmera – Bergheim', ort: 'Stadt, Land, Stadt, Autobahn – Mittag',
    text: 'Von Stadt zu Stadt: aus Valmera hinaus über die Landstraße und durch ein Dorf nach Bergheim, auf der Autobahn zurück.',
    strasse: true, zone: 'stadt', glatt: 16, kerbAb: 1,
    ecken: [
      [400, -400, 28], [400, -900, 32, {}, { zone: 'land' }],
      [1200, -1300, 160], [2000, -1100, 130], [2800, -1600, 110], [3600, -1400, 200],
      [4250, -1750, 60, {}, { zone: 'dorf' }], [4750, -1750, 60, {}, { zone: 'land' }], [5400, -1250, 160], [6200, -1450, 130, {}, { zone: 'stadt' }],
      [6800, -900, 30], [7400, -900, 26], [7400, -300, 26], [6850, -300, 26], [6850, 350, 40, {}, { zone: 'autobahn' }],
      [6300, 800, 500], [4500, 1000, 900], [2500, 650, 900], [1100, 750, 450, {}, { zone: 'stadt' }],
      [300, 400, 32], [-400, 400, 26], [-400, -400, 28],
    ],
    hoehe: [[0, 0], [0.06, 0], [0.12, 12], [0.2, 35], [0.28, 22], [0.36, 40], [0.42, 18], [0.47, 4], [0.5, 4], [0.58, 4], [0.66, 14], [0.78, 24], [0.9, 2], [0.95, 0]],
    welt: { art: 'reise', zeit: 'mittag', staedte: [{ x: 0, z: 0, r: 1100, name: 'Valmera' }, { x: 7100, z: -600, r: 900, name: 'Bergheim' }] },
  },
  // ---------------------------------------------------------------- mehr Straßen in anderen Landschaften
  // welt.land sagt, durch welche Landschaft die Straße führt: 'kueste' (Meer im Süden), 'alpen', 'wueste' – sonst Felder und Wälder.
  {
    id: 'riviera', name: 'Riviera-Küstenstraße', ort: 'Am Meer entlang, Nachmittag',
    text: 'Aus der Hafenstadt Porto Lumen hinaus auf die Küstenstraße: Kurve um Kurve über den Klippen, durch ein Fischerdorf und über die Pinienhügel im Hinterland zurück.',
    strasse: true, zone: 'stadt', glatt: 18, kerbAb: 1,
    ecken: [
      [2600, 0, 30], [2600, 420, 28, {}, { zone: 'land' }],
      [2200, 640, 120], [1800, 520, 90], [1450, 700, 80], [1050, 560, 110], [700, 760, 70], [300, 620, 100, {}, { zone: 'dorf' }],
      [-150, 700, 60, {}, { zone: 'land' }], [-600, 560, 90], [-1000, 720, 70], [-1400, 520, 60],
      [-1500, 100, 120], [-1100, -300, 160], [-500, -200, 140], [100, -500, 200], [800, -300, 180], [1500, -550, 150, {}, { zone: 'stadt' }],
      [2000, -300, 40], [2000, 0, 26],
    ],
    hoehe: [[0, 4], [0.08, 4], [0.14, 20], [0.2, 34], [0.27, 18], [0.34, 28], [0.4, 12], [0.47, 24], [0.55, 52], [0.65, 92], [0.75, 70], [0.85, 84], [0.93, 30], [0.97, 6]],
    welt: { art: 'reise', land: 'kueste', zeit: 'nachmittag', staedte: [{ x: 2300, z: 0, r: 620, name: 'Porto Lumen' }], doerfer: ['Santa Marea'] },
  },
  {
    id: 'alpenpass', name: 'Alpenpass Silberjoch', ort: 'Passstraße im Hochgebirge, Mittag',
    text: 'Aus dem Bergdorf in fünf Haarnadelkurven hinauf zur Passhöhe auf 320 Metern über dem Tal, drüben in Kehren wieder hinunter und am Hang entlang zurück.',
    strasse: true, zone: 'dorf', glatt: 14, kerbAb: 1,
    ecken: [
      [300, 0, 60, {}, { zone: 'land' }], [900, 150, 120], [1300, 0, 90],
      [1750, 150, 24], [1300, 330, 24], [1800, 500, 24], [1300, 680, 24], [1800, 860, 24], [1350, 1060, 60],
      [1500, 1500, 140], [1100, 1850, 110],
      [500, 1800, 90], [200, 2100, 24], [-200, 1750, 24], [-500, 2050, 24], [-900, 1700, 80],
      [-1100, 1200, 160], [-800, 700, 120], [-1050, 300, 90], [-700, 0, 70, {}, { zone: 'dorf' }],
    ],
    hoehe: [[0, 20], [0.1, 40], [0.16, 76], [0.24, 150], [0.32, 225], [0.4, 295], [0.47, 340], [0.55, 300], [0.63, 230], [0.7, 170], [0.8, 100], [0.9, 40], [0.96, 20]],
    welt: { art: 'reise', land: 'alpen', zeit: 'mittag', staedte: [], doerfer: ['Almbach'] },
  },
  {
    id: 'dorado', name: 'Wüsten-Highway Dorado', ort: 'Wüste und Canyon, Abendrot',
    text: 'Aus der Wüstenstadt Dorado auf den Highway: fünf Kilometer fast geradeaus – Vollgas! Zurück geht es kurvig durch den Canyon und an einer Oase vorbei.',
    strasse: true, zone: 'stadt', glatt: 16, kerbAb: 1,
    ecken: [
      [500, 0, 30], [500, 500, 40, {}, { zone: 'autobahn' }],
      [1500, 1300, 600], [4200, 1500, 900], [6000, 900, 500, {}, { zone: 'land' }],
      [6600, 200, 120], [6200, -300, 80], [5600, -100, 90], [5100, -600, 70], [4500, -350, 110, {}, { zone: 'dorf' }],
      [4000, -700, 60, {}, { zone: 'land' }], [3300, -500, 150], [2700, -900, 120], [2000, -600, 200], [1200, -900, 160, {}, { zone: 'stadt' }],
      [500, -500, 40], [-200, -500, 28], [-200, 0, 28],
    ],
    hoehe: [[0, 0], [0.1, 0], [0.2, 10], [0.35, 4], [0.45, 30], [0.52, 70], [0.6, 45], [0.68, 85], [0.76, 50], [0.86, 25], [0.93, 4]],
    welt: { art: 'reise', land: 'wueste', zeit: 'abend', staedte: [{ x: 150, z: -250, r: 950, name: 'Dorado' }], doerfer: ['Oase Tamira'] },
  },
  {
    id: 'neonstadt', name: 'Nachtfahrt Neonstadt', ort: 'Großstadt bei Nacht, Stadtautobahn',
    text: 'Nachts durch die leuchtende Großstadt: breite Boulevards mit rechten Winkeln, dann auf die Stadtautobahn und im weiten Bogen um die Hochhäuser.',
    strasse: true, zone: 'stadt', glatt: 14, kerbAb: 1,
    ecken: [
      [700, 0, 30], [700, 600, 28], [1300, 600, 30], [1300, 1300, 34, {}, { zone: 'autobahn' }],
      [600, 1900, 420], [-700, 1900, 380], [-1500, 1100, 420, {}, { zone: 'stadt' }],
      [-1500, 300, 40], [-900, 300, 28], [-900, -300, 28], [-300, -300, 26], [-300, 0, 26],
    ],
    hoehe: [[0, 0], [0.3, 0], [0.45, 12], [0.6, 12], [0.75, 0]],
    welt: { art: 'stadt', zeit: 'nacht', staedte: [{ x: -100, z: 700, r: 1700, name: 'Neonstadt' }] },
  },
  // ---------------------------------------------------------------- Rallye: Wertungsprüfungen (WP)
  // Rallyestrecken sind Wege durchs Gelände: schmal, ohne Leitplanken, mit Wald direkt am Rand.
  // belag = was auf der Fahrbahn liegt ('schotter' oder 'asphalt'), wellen = kleines Auf und Ab,
  // spruenge = Kuppen, über die man fliegt, wasser / pfuetzen siehe strecke.js (rallyeBelag).
  // Matsch (matsch: [[von, bis]]) gibt es auf keiner Prüfung mehr: Er hat das Auto zu sehr gebremst (Kristian, 22.11.2026).
  // Gefahren wird eine Runde: Start an der Startlinie, Ziel ("fliegendes Ziel") 300 m davor, dahinter das Stopp-Schild.
  {
    id: 'wp_seen', name: 'WP 1 · Seenland-Sprünge', ort: 'Schnelle Schotterwege im Kiefernwald, Nachmittag',
    text: 'Breite, schnelle Schotterwege mit vielen Kuppen und Sprüngen – wie in Finnland. Voll auf dem Gas bleiben und dem Beifahrer glauben!',
    rallye: true, belag: 'schotter', breite: 10.5, glatt: 16, kerbAb: 99, aus: 'gras', grasBreite: 6,
    ecken: [
      [0, 0, 70], [300, -150, 140], [700, -100, 200], [1000, -300, 90], [1250, -200, 55], [1400, 100, 160], [1300, 330, 40], [1530, 430, 16], [1300, 530, 16], [1530, 630, 16], [1500, 790, 50],
      [1350, 1000, 70], [1000, 1050, 180], [650, 900, 50], [450, 1100, 80], [100, 1150, 140], [-200, 950, 60], [-350, 600, 120], [-250, 300, 38], [-400, 100, 90],
    ],
    hoehe: [[0, 10], [0.15, 30], [0.3, 16], [0.38, 28], [0.47, 48], [0.6, 25], [0.75, 38], [0.9, 15]],
    wellen: [[420, 2.2], [190, 1.0]], schlaengeln: [[260, 14], [130, 4]],
    spruenge: [[0.07, 2.0, 60], [0.16, 1.6, 50], [0.27, 2.4, 58], [0.33, 1.7, 48], [0.52, 2.6, 62], [0.63, 1.9, 52], [0.77, 2.2, 56], [0.87, 1.6, 46]],
    pfuetzen: 10, wasser: [[0.71, 14]],
    welt: { art: 'rallye', zeit: 'nachmittag', wald: 'kiefer' },
  },
  {
    id: 'wp_nebel', name: 'WP 2 · Nebelwald', ort: 'Enger, nasser Schotterpfad im Laubwald, trüber Morgen',
    text: 'Schmal, kurvig und nass – wie in Wales. Pfützen, eine Wasserdurchfahrt und Haarnadelkurven den Hang hinauf. Hier gewinnt, wer sauber fährt.',
    rallye: true, belag: 'schotter', breite: 9, glatt: 10, kerbAb: 99, aus: 'gras', grasBreite: 4.5,
    ecken: [
      [0, 0, 25], [150, -80, 40], [300, -60, 15], [320, 120, 30], [480, 200, 60], [600, 100, 18], [750, 150, 35], [800, 350, 12], [650, 420, 25],
      [700, 600, 50], [550, 750, 20], [350, 700, 35], [250, 850, 14], [50, 800, 45], [-100, 650, 22], [60, 570, 13], [-140, 490, 13], [40, 410, 13], [-150, 330, 16], [-250, 200, 40], [-150, 80, 25],
    ],
    hoehe: [[0, 20], [0.2, 32], [0.4, 22], [0.6, 36], [0.74, 24], [0.86, 40], [0.95, 24]],
    wellen: [[260, 1.4], [120, 0.6]], schlaengeln: [[150, 7], [70, 2]],
    spruenge: [[0.33, 1.6, 30], [0.62, 1.8, 32]],
    pfuetzen: 18, wasser: [[0.53, 16]],
    welt: { art: 'rallye', zeit: 'trueb', wald: 'laub' },
  },
  {
    id: 'wp_pass', name: 'WP 3 · Bergpass', ort: 'Asphalt mit Kehren am Berg, Abendsonne',
    text: 'Auf Asphalt in Haarnadelkurven den Berg hinauf, über den Kamm und in Haarnadelkurven wieder hinunter – wie bei der Rallye in den Seealpen. Links Fels, rechts der Abgrund.',
    rallye: true, belag: 'asphalt', breite: 9.5, glatt: 10, kerbAb: 99, aus: 'gras', grasBreite: 4,
    ecken: [
      [0, 0, 40], [220, 60, 14], [40, 150, 14], [260, 240, 14], [60, 330, 14], [280, 420, 30], [520, 470, 90], [760, 380, 60],
      [800, 310, 40], [600, 230, 14], [820, 150, 14], [600, 70, 14], [820, -10, 14], [720, -130, 40], [450, -180, 80], [200, -150, 45], [-100, -160, 60],
    ],
    hoehe: [[0, 30], [0.07, 50], [0.13, 74], [0.2, 100], [0.27, 124], [0.36, 140], [0.45, 134], [0.52, 116], [0.58, 98], [0.64, 80], [0.7, 64], [0.85, 45]],
    wellen: [[300, 0.8]], schlaengeln: [[180, 5]],
    spruenge: [[0.4, 1.2, 34]],
    pfuetzen: 4,
    welt: { art: 'rallye', zeit: 'abend', wald: 'berg' },
  },
  {
    // Enger Weg: nur 6,5 m breit, die Bäume stehen dicht am Rand – so wirkt das Tempo viel höher.
    // "felder" = Stücke der Strecke (Anteil von … bis), die über offene Wiesen und Felder führen statt durch Wald.
    id: 'wp_alm', name: 'WP 4 · Almweg', ort: 'Enger Schotterweg über Felder, durch Wald und in Serpentinen auf die Alm, Mittag',
    text: 'Schmal und schnell: erst über die Felder im Tal, dann durch dichten Wald und in fünf Serpentinen steil den Berg hinauf. Oben über den Kamm – und in einer langen Abfahrt durch den Wald zurück ins Tal.',
    rallye: true, belag: 'schotter', breite: 6.5, glatt: 10, kerbAb: 99, aus: 'gras', grasBreite: 1.8,
    ecken: [
      [0, 0, 50], [350, -60, 90], [650, 60, 60], [800, 330, 45],
      [600, 420, 13], [860, 500, 13], [600, 580, 13], [860, 660, 13], [600, 740, 13], [820, 870, 35],
      [600, 1010, 70], [250, 960, 50], [0, 1090, 60], [-300, 980, 40],
      [-430, 700, 80], [-300, 450, 30], [-480, 290, 25], [-350, 110, 40], [-200, -70, 45],
    ],
    hoehe: [[0, 20], [0.14, 26], [0.2, 48], [0.27, 76], [0.33, 104], [0.39, 132], [0.45, 158], [0.52, 172], [0.6, 166], [0.68, 134], [0.76, 98], [0.84, 62], [0.92, 32]],
    wellen: [[240, 1.0], [110, 0.5]], schlaengeln: [[170, 6], [80, 2]],
    spruenge: [[0.08, 1.5, 36], [0.56, 1.6, 34]],
    pfuetzen: 8,
    felder: [[0.96, 1], [0, 0.15], [0.5, 0.6]],
    welt: { art: 'rallye', zeit: 'nachmittag', wald: 'berg' },
  },
];

export const strecke = id => STRECKEN.find(s => s.id === id) || STRECKEN[0];
