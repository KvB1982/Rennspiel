# Quellen und Lizenzen

## Geräusche

Motor, Elektromotor, Reifenquietschen, Aufprall und Schlagschrauber sind Aufnahmen von [Freesound](https://freesound.org)
unter **CC0** (Creative Commons Zero: gemeinfrei, frei nutzbar, auch ohne Namensnennung). Wir nennen die Urheber trotzdem gern.
Für das Spiel wurden sie gekürzt, auf Mono umgerechnet, in der Lautstärke angeglichen und die Motor- und Quietsch-Stücke
zu Schleifen geschnitten (Ende weich in den Anfang überblendet). Sie liegen im Ordner `sounds/`.

| Datei | Wofür | Aufnahme | Urheber | Lizenz |
| --- | --- | --- | --- | --- |
| `f1_leerlauf.wav` | Rennwagen, niedrige Drehzahl (ganze Aufnahme, tiefes Brummen weggefiltert, schneller abgespielt) | [SFX_Car_Engine_Outside_RPMLow.wav](https://freesound.org/s/401556/) | GiocoSound | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) |
| `f1_hoch.wav` | Rennwagen, hohe Drehzahl (ganze Aufnahme, tiefes Brummen weggefiltert, schneller abgespielt) | [SFX_Car_Engine_Outside_RPMHigh.wav](https://freesound.org/s/401551/) | GiocoSound | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) |
| `elektromotor.wav` | Modellauto und Slotcar (Sekunde 15,5–17,2) | [ElectricMotor.wav](https://freesound.org/s/824119/) | derjuli | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) |
| `reifen_quietschen.wav` | rutschende Reifen (Sekunde 27,7–29,1) | [screeching tyres / tires](https://freesound.org/s/614627/) | johnnydekk | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) |
| `aufprall_gross.wav` | harter Einschlag des Rennwagens | [Car Crash](https://freesound.org/s/237375/) | squareal | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) |
| `aufprall_klein.wav` | leichter Stoß des Rennwagens | [metal_collision.wav](https://freesound.org/s/386798/) | RichieMcMullen | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) |
| `aufprall_plastik.wav` | kleine Autos stoßen an oder fliegen raus | [Plastic Toy Car Crash / Impact](https://freesound.org/s/566117/) | SpeedyVelcro | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) |
| `schlagschrauber.wav` | Boxenstopp | [Air Impact Wrench](https://freesound.org/s/349398/) | sevenbsb | [CC0](http://creativecommons.org/publicdomain/zero/1.0/) |

Wind, Rumpeln auf Gras und Kies, die Piep-Töne der Startampel und alle Rückfall-Töne (solange die Aufnahmen laden oder wenn sie fehlen)
erzeugt das Spiel selbst (`js/klang.js`).

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

## Programme

- [three.js](https://threejs.org) r160, MIT-Lizenz, geladen von jsDelivr.
- [PeerJS](https://peerjs.com), MIT-Lizenz, geladen von jsDelivr.
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT-Lizenz, geladen von jsDelivr.
