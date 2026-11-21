# Rennspiel – Hinweise für Claude

3D-Rennspiel für den Browser mit Formel-Rennwagen, Supercars im Straßenverkehr, ferngesteuertem Auto und Slotcar-Bahn. Das zentrale Element: das Handy als Lenkrad.
Vater-Sohn-Lernprojekt wie die Geschwister-Spiele Powershot (`KvB1982/Powershot`), Frontline (`KvB1982/Frontline`) und Reitturnier.
Repository: https://github.com/KvB1982/rennspiel · läuft auf GitHub Pages unter https://kvb1982.github.io/rennspiel/ (Pages muss im Repository eingeschaltet sein).

## Arbeitsweise

- Antworten, Code-Kommentare und Texte im Spiel auf **Deutsch**. Kommentare so schreiben, dass ein Kind mitlesen kann.
- Kein Build-Schritt: reines HTML/CSS/JavaScript (ES-Module), three.js r160 über eine Import-Map von jsDelivr (wie Powershot).
- Commits als `KvB1982 <KvB1982@users.noreply.github.com>`.
- Nach Änderungen im Browser prüfen, nicht nur mit den Testwerkzeugen. Ehrlich sagen, was nur als Standbild geprüft wurde.
- Nur ausgedachte Designs: keine echten Teams, Lackierungen, Logos, Fahrer oder lizenzierten Strecken.

## Starten und testen

```bash
python3 tools/server.py         # http://localhost:8765, ohne Zwischenspeicher
node tools/sim.mjs              # Computer gegen Computer auf allen Strecken, ohne Grafik (Rundenzeiten, Wandkontakte)
node tools/sim.mjs kueste 5 9 schwer
node tools/karte.mjs            # alle Strecken von oben als tools/karten.svg, prüft ob sich eine Strecke selbst berührt
```

Im Browser: `window.__rennspiel` enthält `E` (Einstellungen), `rennen`, `buehne`, `kamera`, `eingabe`, `empfang`, `starten()`, `step(n)`.
`__rennspiel.angehalten = true` hält die eigene Schleife an, `step(n)` spult n Bilder vor (für Tests mit gedrosseltem `requestAnimationFrame`).
`node tools/sim.mjs slot_oval 5 3 leicht` lässt Slotcars fahren und zählt Abflüge.
Lenkrad ohne echtes Handy testen: zweites Fenster im selben Browser mit `?lenkrad=CODE&lokal` öffnen (Verbindung über BroadcastChannel),
dort `__lenkrad.sensor(beta, gamma)` aufrufen, um Neigen nachzumachen.

## Aufbau

Koordinaten: Meter, x seitlich, y hoch, z längs. Auto schaut in Richtung (sin h, cos h), links vom Auto ist (cos h, −sin h).
Lenken, Drehen, seitlicher Abstand: plus = links.

| Datei | Inhalt |
|---|---|
| `js/strecken.js` | Die Strecken (`STRECKEN`): Eckpunkte mit Kurvenhalbmesser (`ecken`), Breite, Höhenverlauf (`hoehe`), was neben der Strecke liegt (`aus`), Landschaft (`welt`). Alle ausgedacht |
| `js/strecke.js` | Mittellinie ausrechnen (ohne three.js): Ecken → Geraden und Kreisbögen (`eckenZuTeilen`) → Messpunkte alle `ds` Meter mit Richtung, Krümmung, Höhe, Breite, Auslauf, Randsteinen. `T.finde(x, z, hint)` = wo auf der Strecke ist ein Punkt |
| `js/slot.js` | Slotcar (ohne three.js): Auto fährt im Schlitz einer von zwei Spuren (`def.spur`), nur Gas und Bremse. Kurvenkraft über `AUTOS.slot.haft` = Heck schwenkt aus, dann Abflug (`slotSchritt` gibt `'raus'` zurück, nach `RAUS_ZEIT` wird das Auto wieder eingesetzt). Knapp über der Grenze driftet es erst und wird langsamer (bis 1,25-mal `haft`). Dritter Schlitz = Boxengasse (`sl.box`, Einfahrt: rechte Spur und nach rechts lenken). Spurwechsel an den Weichen (`def.weichen`, von `weichen(T)` auf gerade Stücke geschoben): Lenkrad links/rechts halten. `slotPlan`, `slotFahren` = Computerfahrer, `slotStoesse` = Auffahren in derselben Spur |
| `js/box.js` | Boxengasse der kleinen Autos (ohne three.js): `boxAnlegen(T)` legt sie rechts neben die Start-Ziel-Gerade (`T.box`: `ab`, `lang`, `rampe`, `d`, `halt`). Tank und Reifen (`c.sprit`, `c.reifen`, `verbrauch`, `TANK_RUNDEN`, `REIFEN_RUNDEN`), Stopp im blauen Halte-Bereich (`boxDienst`, `DIENST_DAUER`), abgefahrene Reifen = weniger Halt (`reifenHalt`). Computerfahrer mit ferngesteuertem Auto fahren wie auf einer Schiene durch die Box (`boxFahrt`). Nur im Rennen und wenn im Menü „Tanken und Reifen“ an ist (`rennen.boxen`) |
| `js/physik.js` | Fahrphysik (ohne three.js): Einspurmodell mit Reifenkurve, Abtrieb, Luftwiderstand, Haftkreis, Traktionskontrolle, Untergrund, Abprallen an der Begrenzung. Werte in `AUTOS` (`f1`, `modell`, `slot`) – alle geschätzt. Kleine Autos: Maßstab 1:30 (`MASSSTAB` in `strecke.js`), Höchsttempo einstellbar (`neuesAuto(art, tempo)`, `TEMPO` in `spiel.js`), Motor regelt bei `vMax` ab, rollt ohne Gas aus (`rollen`, `motorBremse`). Bremse im Stand = rückwärts (bis `rueck`) |
| `js/ki.js` | Ideallinie (`ideallinie`), Tempo-Plan mit Bremszonen (`tempoPlan`), Computerfahrer mit Überholen (`fahren`), Bremshilfe und Lenkhilfe für den Spieler |
| `js/rennen.js` | Rennen/Zeitfahren (ohne three.js): Startampel, Runden, Zeiten, Plätze, Zusammenstöße, Strecke verlassen = Runde ungültig, Geist-Auto der Bestrunde. Ausgedachte Teams (`TEAMS`) und Fahrer (`FAHRER`) |
| `js/verbindung.js` | Handy ↔ Spiel: WebRTC über PeerJS (Vermittler im Internet, Code mit 4 Zeichen), zum Testen BroadcastChannel. `LenkradEmpfang` (Spiel), `LenkradSender` (Handy) |
| `js/neigung.js` | Drehwinkel des Geräts aus dem Bewegungssensor, Rechnung aus Frontline (`js/touch.js`), aber mit vollem Drehwinkel (atan2). Empfindlichkeit `VOLL` |
| `js/lenkradseite.js` | Die Seite auf dem Handy (`?lenkrad=CODE`): Lenkrad-Bild, Pedale für die Daumen, Knöpfe Kamera/Pause/Zurück/Mitte, Anzeige von Tempo, Gang, Platz; Rütteln (nur Android) |
| `js/eingabe.js` | Fasst alle Steuerungen zusammen: Handy (Vorrang), Gamepad, Neigen dieses Geräts mit Pedalen auf dem Bildschirm, Tastatur |
| `js/texturen.js` | Selbst gemalte Oberflächen (Asphalt, Gras, Kies, Randstein, Werbung mit ausgedachten Marken, Zuschauer, Fassaden, Parkett, Wellen) |
| `js/streckebau.js` | Strecke und Landschaft in 3D: Bänder entlang der Mittellinie, Leitplanken/Mauern/Reifenstapel, Fangzaun, Startampel, Gelände mit Hügeln, Meer, Bäume, Tribünen, Boxengebäude, Stadt am Hafen, Wohnzimmer |
| `js/autobau.js` | Das Formel-Auto aus Formen (Rumpf aus Querschnitten, Flügel, Halo, Räder, Fahrer). Das Modellauto ist dasselbe Auto verkleinert |
| `js/szene.js` | Renderer, Himmel (Sky), Sonne mit Schatten, Spiegelungen, Autos und Geist im Bild |
| `js/kamera.js` | Kameras: `hinten`, `weit`, `cockpit`, `stand` (Modellauto: man steht an einer festen Stelle und dreht nur den Kopf; Stellen in `welt.standorte`) |
| `js/klang.js`, `sounds/` | Motor, Reifen, Aufprall, Boxenstopp aus Aufnahmen (`DATEIEN` oben in der Datei; CC0 von Freesound, Quellen in `LIZENZEN.md`): Rennwagen = zwei Schleifen (Leerlauf, hohe Drehzahl), Tonhöhe über `playbackRate` aus der Drehzahl (`DZ_LEER`, `DZ_HOCH`, `UEBERGANG`), kleine Autos = Elektromotor-Schleife. Solange die Aufnahmen laden oder wenn sie fehlen, erzeugt WebAudio die Töne selbst (Rückfall). Wind, Rumpeln und Piepen sind immer selbst erzeugt |
| `js/spiel.js` | Menü, Spiel-Schleife, Anzeige, Ergebnis, QR-Code. Rennwagen: Gang für die nächste Kurve (`kurvenFinden`: Scheitelpunkte = Tiefpunkte des Tempo-Plans), Ideallinie und rote Bremszonen auf der Fahrbahn (`linieZeigen` in `streckebau.js`, Einstellung `E.linie`) |
| `js/main.js` | Start: Lenkrad-Seite oder Spiel |
| `js/supercars.js` | Supercar-Modus (ohne three.js): sechs Sportwagen mit ausgedachten Namen, je einem bekannten Vorbild nachempfunden (`SUPERCARS`: Falkner/Porsche 911 Turbo, Taurino/Lamborghini, Stallone/Ferrari, Aurelion/Bugatti Chiron, Nordvind/Koenigsegg Jesko, Vento/Pagani Huayra), Lackfarben (`LACKE`), Physik-Werte (`SUPER_AUTOS`, kommen in `AUTOS`). Physik dazu in `physik.js`: Allrad-Anteil (`allrad`), Gewicht wandert beim Bremsen/Beschleunigen (`super`), Traktionskontrolle lässt Haftung für die Kurve übrig (`tcRest`). Für alle Autos mit Physik (auch Formel): `bremsGriff` = Spiel-Bremse (längs halten die Reifen beim Bremsen mehr aus), `esp` = Schleuderschutz (fängt das Auto ab `beta` Rutschwinkel, aus zusammen mit „Traktion aus“) |
| `js/supercarbau.js` | Die Supercars aus Formen (`FORMEN` je Auto: Nase, Haube, Hüften, Heck, Kabine, Lichter, Flügel …), mit Cockpit innen (`innen`, nur in der Cockpit-Kamera sichtbar). Kein Logo |
| `js/strecke.js` → `ZONEN` | Straßen-Strecken (`strasse: true` in `strecken.js`): jedes Stück hat eine Zone `stadt`, `dorf`, `land`, `autobahn` (Breite, Rand, Spuren, Tempo und Dichte des Verkehrs). Gesetzt mit `{ zone: '…' }` an einer Ecke oder `def.zone`; `T.zone`, `T.strasse`. Strecken: `metropole` (Stadt), `landstrasse` (Land und Dörfer), `staedtetour` (Valmera → Land → Dorf → Bergheim → Autobahn zurück, 19 km) |
| `js/verkehr.js` | Verkehr (ohne three.js): Autos, Transporter, Lastwagen, Busse (`ARTEN`) fahren auf ihrer Spur, Gegenverkehr links, halten Abstand, bremsen für Rennfahrer. `stoesse` = Zusammenstöße mit Rennfahrern: Das Rennauto zählt `RENNER_MASSE`-mal schwerer und bleibt fast auf Kurs, ab `WEG_AB` fliegt das Verkehrsauto weg (`t.frei`, `fliegen`: rutschen, drehen, hüpfen, kippen, Warnblinker, nach `WARTEN` zurück in die Spur). Menge im Menü (`VERKEHR` in `spiel.js`) |
| `js/verkehrbau.js` | Verkehr in 3D: eine Form je Fahrzeugart, alle als `InstancedMesh` |
| `js/stadtbau.js` | Straßen-Welt: Fahrbahnmarkierungen, Zebrastreifen, zweite Autobahn-Fahrbahn mit Mittelwand, Leitplanken, Laternen, Häuserzeilen, Großstadt mit Hochhäusern (Blöcke rund um `welt.staedte`), Dörfer, Bauernhöfe, Ortsschilder, Ampeln, Gelände mit Feldern und Wald, Berge am Horizont. Städte- und Dorfnamen ausgedacht |

## Handy als Lenkrad

- Im Spiel zeigt das Menü einen QR-Code. Er führt immer zur Seite auf GitHub Pages (https), weil Bewegungssensoren nur über https gehen und das Handy `localhost` nicht findet.
  Das Handy verbindet sich über den Code, auch wenn das Spiel selbst auf `localhost` läuft.
- PeerJS braucht Internet (für den ersten Kontakt). Danach gehen die Daten direkt, im selben WLAN meist ohne Umweg.
- Frontline und Powershot verbinden zwei Geräte über Apples Multipeer Connectivity – das geht nur in einer echten App.
  Eine App-Hülle (Capacitor wie Frontline) könnte später dazukommen.
- Nachrichten: Handy → Spiel `{ t: 's', l, g, b }` 60-mal pro Sekunde, `{ t: 'k', k: 'kamera' | 'pause' | 'zurueck' }`, `{ t: 'hallo' }`.
  Spiel → Handy `{ t: 'i', v, gang, dz, platz, von, runde, runden, r }` 10-mal pro Sekunde, `{ t: 'mitte' }`.

## Bekannte Grenzen

- Ferngesteuertes Auto und Slotcar (Stand 21.11.2026): Tempo, Haftung, Abflug-Grenze und Ausrollen sind geschätzt. Geprüft mit `tools/sim.mjs` und als Standbilder im Test-Browser, nicht von Hand gefahren. Das Slotcar fliegt immer geradeaus von der Bahn und wird nach gut 2 Sekunden wieder eingesetzt; es überschlägt sich nicht. Die Tacho-Zahl der kleinen Autos ist mal 30 hochgerechnet.
- Boxengasse, Tank, Reifen, Auslauf-Streifen, größere Slotcar-Bahn (30 cm breit statt 20 cm wie bei einer echten Kunststoffbahn), Ideallinie, Bremszonen und Kurven-Gang (Stand 21.11.2026): mit `tools/sim.mjs`, kleinen Rechen-Tests und als Standbilder geprüft, nicht von Hand gefahren. Verbrauch, Reifenabnutzung und Slotcar-Haftung (`haft: 15`, wie mit Haftmagnet) sind geschätzt. Die Boxengasse des Rennwagens fehlt. Im Zeitfahren gibt es keinen Verbrauch.
- Supercar-Modus (Stand 21.11.2026): geprüft mit `tools/sim.mjs` (alle Rennen kommen ins Ziel, mit Verkehr gibt es viele Stöße) und als Standbilder im Test-Browser (Stadt, Städtetour, Übersicht von oben); nicht von Hand gefahren, nicht auf dem iPad. Je Straßen-Strecke etwa 1,5 Millionen Dreiecke und 550–800 Zeichenaufrufe – auf dem iPad kann das ruckeln. Fahrwerte nur ungefähr wie beim Vorbild, der Rest geschätzt. Verkehr fährt nicht über Kreuzungen und Ampeln (die sind nur Schmuck), Computerfahrer weichen aus, stoßen aber trotzdem oft an. Strecken sind geschlossene Runden; Querstraßen in der Stadt sind nur Bild.
- Bremse und Schleuderschutz (Stand 21.11.2026, nach Kristians Rückmeldung): Supercars bremsen von 200 km/h jetzt in etwa 75 m statt 130 m (gut 2 g, mehr als ein echtes Auto), der Formel-Rennwagen in 54 m statt 66 m. Bremsen und Lenken, Vollgas und voll Lenken, Zickzack: kein Dreher mehr, solange „Traktion“ an ist (Rechen-Test). Geprüft mit Rechen-Tests, `tools/sim.mjs` und als Standbild (Verkehrsauto fliegt nach Frontal-Zusammenstoß hoch); nicht von Hand gefahren.
- Geräusche (Stand 21.11.2026): nur im Test-Browser geprüft (alle Aufnahmen laden, Lautstärke und Tonhöhe folgen Drehzahl und Gas, Hörprobe als Spektrum angesehen), nicht von Menschen angehört und nicht auf iPad oder Handy. Die Rennwagen-Aufnahme ist vom Streckenrand aufgenommen und hat deshalb leichte Doppler-Schwankungen. Pixabay sperrt Programme (Cloudflare), deshalb kommen die Aufnahmen von Freesound, nur CC0. Neue Aufnahmen: WAV (Mono, 32 kHz) statt MP3, weil MP3 am Anfang eine kleine Stille einbaut und Schleifen dann hörbar springen.
- Im Cockpit ist der Halo-Bügel des eigenen Autos ausgeblendet (`m.halo` in `szene.js`), weil er genau vor den Augen läge.

- Nur in einem Test-Browser ohne Grafikkarte und ohne Internet geprüft (three.js, PeerJS und QR-Bibliothek dort von einer lokalen Kopie). Nicht mit einem echten Handy, nicht auf dem iPad, nicht auf einem Fernseher. Die Verbindung über PeerJS ist nicht erprobt, nur die Test-Verbindung über BroadcastChannel.
- Alle Zahlen der Fahrphysik, Lenkung, Empfindlichkeit und Computerfahrer sind geschätzt und nicht von Hand erspielt.
- Die Strecken sind flach gekippt (keine Querneigung), Autos springen nicht. Gelände und Strecke berühren sich nur ungefähr.
