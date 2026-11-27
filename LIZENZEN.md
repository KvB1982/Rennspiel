# Quellen und Lizenzen

## Geräusche und Stimmen

Seit dem 27.11.2026 sind alle Geräusche und Stimmen im Ordner `sounds/` **selbst erzeugt** mit [3D AI Studio](https://www.3daistudio.com)
(`generate_sound_effect` und `generate_speech`), also keine Aufnahmen von anderen Leuten mehr. Die früheren CC0-Aufnahmen von Freesound sind entfernt.

| Ordner oder Datei | Wofür | Wie erzeugt |
| --- | --- | --- |
| `sounds/motor/<auto>_tief.wav`, `_hoch.wav` | Motor je Auto bei niedriger und hoher Drehzahl (Rennwagen, sieben Supercars, drei Rallyeautos), `elektro.wav` (ferngesteuertes Auto, Drift-Rallye), `slot.wav` (Slotcar) | Geräusch-Erzeuger, mit `tools/klang_bau/schleife.py` zu Schleifen geschnitten |
| `sounds/reifen_quietschen.wav`, `wind.wav`, `gras.wav`, `schotter.wav`, `wasser.wav` | Schleifen für Reifen, Fahrtwind und Untergrund | wie oben |
| `sounds/aufprall_*.mp3`, `landung.mp3`, `schlagschrauber.mp3`, `turbo.mp3`, `ampel.mp3`, `start.mp3`, `bestzeit.mp3`, `jubel.mp3` | einzelne Geräusche | Geräusch-Erzeuger, mit `tools/klang_bau/einzeln.py` zugeschnitten |
| `sounds/stimme/beifahrer/*.mp3` | Beifahrer in der Rallye (45 Ansagen, Stimme „Roger“, Deutsch) | Sprach-Erzeuger, mit `tools/klang_bau/stimmen.py` an den Pausen zerschnitten |
| `sounds/stimme/sprecher/*.mp3` | Streckensprecher (21 Ansagen, Stimme „Daniel“, Deutsch) | wie oben |

Die Stimmen sind eingebaute Stimmen des Erzeugers, keine echte Person wird nachgemacht. Die Motoren sind nach Beschreibung erzeugt
(zum Beispiel „Zwölfzylinder-Saugmotor, hohe Drehzahl“), keine Aufnahme eines echten Autos.
Solange die Aufnahmen laden oder wenn sie fehlen, erzeugt das Spiel die Töne selbst (`js/klang.js`).

## 3D-Modelle

Die Modelle im Ordner `modelle/` stammen von **Kenney** ([kenney.nl](https://kenney.nl)) und stehen unter **CC0**
(gemeinfrei, frei nutzbar, auch ohne Namensnennung – Lizenztext in `modelle/Kenney-Lizenz.txt`). Danke, Kenney!
Geladen am 21.11.2026 aus der Sammlung [jam-ready-assets](https://github.com/series-ai/jam-ready-assets), die jedes
Kenney-Paket mit seiner Lizenzdatei aufbewahrt (kenney.nl selbst ist im Test-Rechner gesperrt).
`tools/modelle.mjs` hat sie umgerechnet: Farben aus dem Farbbild an die Ecken geschrieben, nach Teilen sortiert
(z. B. Lack, Krone, Dach – die färbt das Spiel selbst), Bilder, Normalen und Bild-Koordinaten entfernt. Keine Logos.

| Datei | Wofür | Kenney-Paket | Vorlage |
| --- | --- | --- | --- |
| `auto_kompakt`, `auto_limousine`, `auto_gelaende`, `auto_transporter`, `auto_lkw` | Verkehr (nahe Autos) | [Car Kit 3.1](https://kenney.nl/assets/car-kit) | `hatchback-sports`, `sedan`, `suv`, `van`, `delivery` |
| `sofa`, `sessel`, `fernsehschrank`, `fernseher`, `pflanze`, `pflanze_klein`, `regal`, `stehlampe`, `lautsprecher`, `radio` | Wohnzimmer | [Furniture Kit 2.1](https://kenney.nl/assets/furniture-kit) | `loungeSofa`, `loungeChair`, `cabinetTelevisionDoors`, `televisionModern`, `pottedPlant`, `plantSmall2`, `bookcaseOpen`, `lampRoundFloor`, `speaker`, `radio` |
| `baum_tanne`, `baum_laub`, `baum_zypresse` | Bäume | [Nature Kit 2.1](https://kenney.nl/assets/nature-kit) | `tree_pineTallA`, `tree_default`, `tree_tall` |
| `zelt`, `zelt_lang`, `flutlicht`, `fahne_ziel`, `tv_kamera`, `fahnenturm` | Rennstrecke | [Racing Kit 2.0](https://kenney.nl/assets/racing-kit) | `tent`, `tentLong`, `lightPostLarge`, `flagCheckers`, `camera_exclusive`, `bannerTowerRed` |
| `haus_a`, `haus_g`, `haus_h`, `haus_i`, `haus_m`, `haus_q` | Dorfhäuser | [City Kit Suburban 2.0](https://kenney.nl/assets/city-kit-suburban) | `building-type-a`, `-g`, `-h`, `-i`, `-m`, `-q` |

### Echt aussehende Modelle von Poly Haven

Die Modelle im Ordner `modelle/echt/` stammen von **Poly Haven** ([polyhaven.com](https://polyhaven.com)) und stehen
unter **CC0** (gemeinfrei, frei nutzbar, auch ohne Namensnennung – [Lizenz](https://polyhaven.com/license)). Danke, Poly Haven!
Geladen am 21.11.2026 als glTF mit 1k-Bildern. `tools/polyhaven.mjs` hat nur das Farbbild behalten (auf 512 × 512 verkleinert)
und Modelle mit vielen Dreiecken vereinfacht.

| Datei | Wofür | Vorlage |
| --- | --- | --- |
| `sofa` | Wohnzimmer | [Sofa 01](https://polyhaven.com/a/Sofa_01) |
| `sessel` | Wohnzimmer | [Arm Chair 01](https://polyhaven.com/a/ArmChair_01) |
| `beistelltisch` | Wohnzimmer | [Side Table 01](https://polyhaven.com/a/side_table_01) |
| `fernsehschrank` | Wohnzimmer (Tisch unter dem Fernseher) | [Classic Console 01](https://polyhaven.com/a/ClassicConsole_01) |
| `regal` | Wohnzimmer | [Wooden Bookshelf Worn](https://polyhaven.com/a/wooden_bookshelf_worn) |
| `pflanze_klein` | Wohnzimmer (auf dem Schrank) | [Potted Plant 04](https://polyhaven.com/a/potted_plant_04) |

### Supercars aus 3D AI Studio

Sechs der sieben Supercars in `modelle/supercars/` (alle außer `falkner_s`) hat Kristian am 21.11.2026 mit [3D AI Studio](https://www.3daistudio.com) erzeugt
(erst ein Bild mit Nano Banana 2.1, daraus das Modell mit Prism 3.1). `tools/supercars.mjs` hat sie verkleinert, die Räder
herausgeschnitten und den Lack umfärbbar gemacht. Die Formen sind an bekannte Sportwagen angelehnt, tragen aber kein Logo und
keinen echten Namen. Vor einer bezahlten Veröffentlichung die Nutzungsbedingungen von 3D AI Studio und die Ähnlichkeit zu den
Vorbildern prüfen – das Spiel ist für den Privatgebrauch.

### Falkner 9 S Allrad (freies Modell, CC-BY-SA 4.0)

`modelle/supercars/falkner_s.glb` beruht auf dem Modell **„(FREE) Porsche 911 Carrera 4S“** von
**[Karol Miklas](https://sketchfab.com/karolmiklas)**, Quelle: [Sketchfab](https://sketchfab.com/3d-models/free-porsche-911-carrera-4s-d01b254483794de3819786d93e0e1ebf),
Lizenz **[CC-BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/)** (Namensnennung, Weitergabe unter gleichen Bedingungen). Danke, Karol!
Kristian hat es am 21.11.2026 heruntergeladen. Geändert mit `tools/sketchfab.mjs`: Wappen, Schriftzug, Nummernschilder und die
Glanzschicht über dem Lack entfernt, Materialien durch Farbfelder ersetzt (Lack blau zum Umfärben), eingelenkte Vorderräder
gerade gestellt, Räder einzeln, von etwa 650.000 auf 21.600 Dreiecke vereinfacht. Die geänderte Datei `falkner_s.glb` steht
ebenfalls unter CC-BY-SA 4.0 (für den Rest des Spiels gilt das nicht). Der Name im Spiel ist ausgedacht; die Form ist die des
echten Autos, das Spiel ist für den Privatgebrauch.

Die anderen Modelle aus Kristians Ordner „Models Free“ (Audi R8 LMS, McLaren P1, Bugatti Chiron, Corvette C8, Huracán,
„modified“ 911) stehen unter der Sketchfab-Standard-Lizenz, die keine Weitergabe der Datei erlaubt – sie sind deshalb
nicht im Spiel.

### Formel-Rennwagen und Verkehr aus 3D AI Studio

Ebenfalls am 21.11.2026 mit 3D AI Studio erzeugt (Bild mit Nano Banana 2.1, Modell mit Prism 3.1) und mit `tools/supercars.mjs`
verkleinert: der Formel-Rennwagen `modelle/formel/formel.glb` (Räder einzeln, auch für das ferngesteuerte Auto und das Slotcar)
und sechs Autos für den Verkehr in `modelle/verkehr/` (Kleinwagen, Limousine, Geländewagen, Transporter, Lastwagen, Bus).
Alle ohne Logo und ohne Schrift. Die Bilder waren als „ausgedachtes Auto“ bestellt; die Limousine hat trotzdem eine Front,
die an eine bekannte Marke erinnert. Es gilt dasselbe wie bei den Supercars: vor einer Veröffentlichung prüfen.

### Rallyeautos aus 3D AI Studio

Am 21.11.2026 mit 3D AI Studio erzeugt (Bild mit Nano Banana 2.1, Modell mit Prism 3.1) und mit `tools/supercars.mjs rallye`
verkleinert: `modelle/rallye/sturmfalke.glb`, `quadra.glb`, `kaiten.glb` (Räder einzeln). Bestellt als ausgedachte Rallyeautos
ohne Logo, ohne Schrift und ohne echte Lackierung; die Formen erinnern mit Absicht an bekannte Rallyeautos (Vorbilder stehen im Menü).
Es gilt dasselbe wie bei den Supercars: vor einer Veröffentlichung prüfen. Die Startnummern-Flächen sind leer.

Alles andere im Rallye-Modus (Wege, Wald, Zuschauer, Staub, Spritzer, Schilder, Knirschen auf Schotter) malt oder erzeugt das Spiel selbst.

### Bilder für das Menü

`bilder/menue/` (zusammen etwa 300 KB) sind Bilder aus dem Spiel selbst: `strecke_<id>.webp` und `fahrzeug_<art>.webp` sind
Bildschirmfotos, `auto_<id>.webp` zeigt die Auto-Modelle mit blauem Lack (gemalt mit `tools/autobilder.html`; das Menü tauscht
das Blau gegen die gewählte Lackfarbe).

### Bilder für Boden und Bäume

| Datei | Wofür | Quelle | Lizenz |
| --- | --- | --- | --- |
| `bilder/gras.jpg` | Wiesen und Rasen | [Leafy Grass](https://polyhaven.com/a/leafy_grass) von Poly Haven, verkleinert und grüner gefärbt | CC0 |
| `bilder/asphalt.jpg` | Fahrbahn | [Asphalt 04](https://polyhaven.com/a/asphalt_04) von Poly Haven, verkleinert und abgedunkelt | CC0 |
| `bilder/baum_fichte.webp`, `baum_laub.webp`, `baum_pinie.webp`, `baum_zypresse.webp`, `baum_palme.webp` | Bäume als flache Bilder | Fotos der Baum-Modelle aus Powershot (`assets/gelaende/baum_*.glb`, dort mit 3D AI Studio erzeugt), gemacht mit `tools/baumbilder.html` | eigene Modelle |

## Programme

- [three.js](https://threejs.org) r160, MIT-Lizenz, geladen von jsDelivr.
- [PeerJS](https://peerjs.com), MIT-Lizenz, geladen von jsDelivr.
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT-Lizenz, geladen von jsDelivr.
