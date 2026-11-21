# Rennspiel

Ein 3D-Rennspiel für den Browser: Formel-Rennwagen auf drei ausgedachten Strecken, ein ferngesteuertes Auto im Wohnzimmer und eine Slotcar-Bahn mit zwei Spuren.
Das Besondere: **Das Handy ist das Lenkrad.** Das Spiel läuft auf dem großen Bildschirm (Rechner, Fernseher, iPad), das Handy wird quer gehalten und gedreht.

**Spielen:** https://kvb1982.github.io/rennspiel/ (dafür muss GitHub Pages für dieses Repository eingeschaltet sein: Settings → Pages → Branch `main`, Ordner `/`).

## So geht's

1. Spiel auf dem großen Bildschirm öffnen.
2. Mit der Handy-Kamera den QR-Code im Menü scannen (oder die Adresse eintippen). Auf dem Handy „Los geht's“ tippen und den Bewegungssensor erlauben.
3. Handy quer halten wie ein Lenkrad: drehen = lenken, rechter Daumen = Gas, linker Daumen = Bremse. Oben auf dem Handy: Kamera wechseln, Pause, zurück auf die Strecke, Mitte neu setzen, Empfindlichkeit.

**Als App auf iPad und iPhone:** siehe [APP-ANLEITUNG.md](APP-ANLEITUNG.md). Dort wird das iPhone ohne Internet und ohne QR-Code zum Lenkrad für das iPad.

Ohne Handy: Pfeiltasten oder W A S D, ein Controller, oder auf einem Tablet „dieses Gerät als Lenkrad“ (Pedale auf dem Bildschirm).

## Was es gibt

- **Zeitfahren** gegen die Uhr, mit Geist-Auto der eigenen Bestrunde. Wer mit allen vier Rädern neben die Strecke fährt, bekommt die Runde nicht gezählt.
- **Rennen** gegen 3–9 Computerfahrer mit Startampel, in drei Stärken.
- **Kameras:** hinter dem Auto, weiter weg, im Cockpit am Lenkrad.
- **Ferngesteuertes Auto:** Strecke im Wohnzimmer (Maßstab 1:30, das Tempo ist mit heruntergerechnet und einstellbar). Du stehst an einer festen Stelle neben der Bahn und lenkst das kleine Auto aus der Ferne (mit 🎥 wechselst du die Stelle).
- **Slotcar-Bahn:** Zwei Spuren mit Schlitz. Du gibst nur Gas. Wer zu schnell in die Kurve fährt, fliegt raus – also rechtzeitig vom Gas gehen. An den gelben Weichen wechselst du die Spur: dabei nach links oder rechts lenken.
- **Rückwärts:** Im Stand die Bremse halten.
- **Fahrhilfen im Rennwagen:** Auf der Fahrbahn liegt zart die Ideallinie, rote Stücke zeigen, wo du bremsen musst. Über dem Tacho steht der Gang für die nächste Kurve. Im Zeitfahren fährt deine beste Runde als durchsichtiges Geist-Auto mit.
- **Boxengasse (kleine Autos, im Rennen):** Tank und Reifen werden weniger. Rechts neben der Startgeraden liegt die Boxengasse: im blauen Feld anhalten, nach gut 2 Sekunden ist alles frisch.
- **Fahrhilfen:** Bremshilfe, Lenkhilfe, Traktionskontrolle, Gas von allein.

Alle Teams, Fahrer, Werbung und Strecken sind ausgedacht.

## Selbst starten

```bash
python3 tools/server.py     # dann http://localhost:8765 öffnen
node tools/sim.mjs          # Computerfahrer auf allen Strecken testen
```

Die 3D-Grafik nutzt [three.js](https://threejs.org) (MIT), die Handy-Verbindung [PeerJS](https://peerjs.com) (MIT), der QR-Code [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT). Alle drei werden von jsDelivr geladen, in der App liegen sie auf dem Gerät.
