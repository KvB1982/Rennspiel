# Rennspiel – Hinweise für Claude

3D-Rennspiel für den Browser mit Formel-Rennwagen, ferngesteuertem Auto und Slotcar-Bahn. Das zentrale Element: das Handy als Lenkrad.
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
| `js/slot.js` | Slotcar (ohne three.js): Auto fährt im Schlitz einer von zwei Spuren (`def.spur`), nur Gas und Bremse. Kurvenkraft über `AUTOS.slot.haft` = Heck schwenkt aus, dann Abflug (`slotSchritt` gibt `'raus'` zurück, nach `RAUS_ZEIT` wird das Auto wieder eingesetzt). Spurwechsel an den Weichen (`def.weichen`, von `weichen(T)` auf gerade Stücke geschoben): Lenkrad links/rechts halten. `slotPlan`, `slotFahren` = Computerfahrer, `slotStoesse` = Auffahren in derselben Spur |
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
| `js/klang.js` | Motor, Reifen, Wind, Aufprall, Piepen – alles mit WebAudio erzeugt |
| `js/spiel.js` | Menü, Spiel-Schleife, Anzeige, Ergebnis, QR-Code |
| `js/main.js` | Start: Lenkrad-Seite oder Spiel |

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
- Im Cockpit ist der Halo-Bügel des eigenen Autos ausgeblendet (`m.halo` in `szene.js`), weil er genau vor den Augen läge.

- Nur in einem Test-Browser ohne Grafikkarte und ohne Internet geprüft (three.js, PeerJS und QR-Bibliothek dort von einer lokalen Kopie). Nicht mit einem echten Handy, nicht auf dem iPad, nicht auf einem Fernseher. Die Verbindung über PeerJS ist nicht erprobt, nur die Test-Verbindung über BroadcastChannel.
- Alle Zahlen der Fahrphysik, Lenkung, Empfindlichkeit und Computerfahrer sind geschätzt und nicht von Hand erspielt.
- Die Strecken sind flach gekippt (keine Querneigung), Autos springen nicht. Gelände und Strecke berühren sich nur ungefähr.
