# Rennspiel als iPad- und iPhone-App

Das Spiel bleibt, wie es ist. [Capacitor](https://capacitorjs.com) packt die vorhandenen Dateien in eine echte App, genau wie bei Frontlinie 3 und Reitturnier. Das Xcode-Projekt liegt fertig im Ordner `ios`.

## Was die App anders macht als der Browser

- Echtes Vollbild ohne Statusleiste, fest im Querformat.
- **iPhone als Lenkrad ohne Internet:** iPad und iPhone finden sich direkt über WLAN oder Bluetooth (Apples „Multipeer“, wie der Steuerknüppel in Frontlinie 3). Kein QR-Code, kein Code eintippen.
- Das iPhone rüttelt kurz, wenn das Auto über Gras oder Kies fährt oder anstößt, und bei jedem Tipp auf Gas, Bremse und Knöpfe.
- Die Bewegungssensoren fragen nicht nach Erlaubnis.
- three.js, PeerJS und der QR-Code liegen in der App. Alles läuft ohne Internet (nur das Handy-Lenkrad über den QR-Code braucht weiter Internet).
- Auf iPad und iPhone steht die Grafik zuerst auf „mittel“. Ruckelt es trotzdem, malt das Spiel von selbst mit weniger Bildpunkten (etwas unschärfer, aber flüssig). Das gilt auch im Browser.
- Der Spielstand (Bestzeiten, Einstellungen) der App ist getrennt vom Browser.

## Einmal einrichten (auf dem Mac)

Du brauchst **Xcode** (Version 26 oder neuer) und **Node.js** (https://nodejs.org, Version „LTS“). Beides ist von Frontlinie 3 schon da.

Im Programm **Terminal**:

```bash
cd ~/Documents
git clone https://github.com/KvB1982/rennspiel.git
cd rennspiel
npm install
npm run ios
```

Wer den Ordner schon hat: `cd` dorthin, dann `git pull`, `npm install`, `npm run ios`.

`npm run ios` kopiert das Spiel (mit three.js, PeerJS und QR-Code aus `node_modules`) nach `www`, packt es in die App und öffnet Xcode. Beim ersten Öffnen lädt Xcode ein paar Pakete nach. Das dauert ein bis zwei Minuten und braucht Internet.

## Signieren

Das Team (`AX2SZQVU9L`, dasselbe wie bei Frontlinie 3, Powershot und Reitturnier) und die Kennung `de.kvb1982.rennspiel` sind schon eingetragen. Falls Xcode trotzdem fragt:

1. Links oben auf das blaue Symbol **App** klicken, dann unter „Targets“ wieder **App** wählen.
2. Reiter **Signing & Capabilities**: Haken bei **Automatically manage signing**, bei **Team** dein Team wählen.
3. Meldet Xcode, die Kennung sei vergeben: bei **Bundle Identifier** hinten etwas anhängen.

## Auf iPad oder iPhone starten

1. Gerät per Kabel anschließen, entsperren und „Diesem Computer vertrauen“ antippen.
2. In Xcode oben in der Mitte das Gerät als Ziel auswählen.
3. Auf den Pfeil **▶** klicken oder `⌘R` drücken.

Ohne Gerät geht auch ein Simulator (zum Beispiel „iPad Pro“). Neigen, Rütteln und das iPhone-Lenkrad gibt es dort nicht.

## iPhone als Lenkrad

Das iPad zeigt das Rennen, das iPhone ist das Lenkrad.

1. Die App aus Xcode auf **beide** Geräte spielen (erst das iPad als Ziel wählen und ▶, dann das iPhone und ▶) – oder beide über TestFlight installieren.
2. Auf beiden Geräten WLAN oder Bluetooth einschalten. Internet ist nicht nötig.
3. Auf dem **iPad** die App öffnen. Das Menü reicht, es wartet schon auf ein iPhone.
4. Auf dem **iPhone** die App öffnen und rechts im Kasten „Handy als Lenkrad“ auf **📱 Dieses Gerät ist das Lenkrad** tippen, dann **Los geht's**.
5. Beim ersten Mal fragen beide Geräte, ob die App Geräte im lokalen Netzwerk finden darf. Bitte **erlauben**.
6. Sobald oben links auf dem iPhone „✅ (Name des iPads)“ steht, auf dem iPad das Rennen starten.

Das iPhone quer halten wie ein Lenkrad und drehen. Rechter Daumen = Gas, linker Daumen = Bremse. Oben: Kamera, Pause, zurück auf die Strecke, „Mitte“ (jetzige Haltung = geradeaus), Empfindlichkeit (in Grad für vollen Einschlag) und **✕ Spiel** (dieses iPhone spielt wieder selbst).

Das iPhone merkt sich, dass es das Lenkrad ist, und startet beim nächsten Mal gleich so. Geht die Verbindung mitten im Rennen verloren, hält das Spiel an.

Ein Handy **ohne** App (zum Beispiel ein Android-Handy) geht weiter über den QR-Code im Menü – das braucht Internet, auch in der App.

## Ohne iPhone: das Gerät selbst neigen

Ist kein Handy-Lenkrad verbunden, steuerst du mit dem iPad oder iPhone selbst: Gerät wie ein Lenkrad drehen, rechts unten Gas, links unten Bremse. Das ist auf iPad und iPhone von Anfang an eingeschaltet (Einstellung „Dieses Gerät neigen“ im Menü). So wie du das Gerät beim Start hältst, ist geradeaus; neu setzen geht in der Pause mit „Lenkrad: Mitte neu setzen“. Verbindet sich ein iPhone als Lenkrad, verschwinden die Pedale.

## TestFlight

1. Einmalig auf https://appstoreconnect.apple.com unter **Apps → „+“ → Neue App** anlegen: Plattform iOS, Name „Rennspiel“ (falls vergeben, etwas anhängen), Bundle-ID `de.kvb1982.rennspiel`.
2. In Xcode oben als Gerät **Any iOS Device (arm64)** wählen, dann **Product → Archive**.
3. Im Fenster „Organizer“: **Distribute App → TestFlight & App Store → Upload**.
4. In App Store Connect unter **TestFlight** die Tester eintragen.

Bei jedem neuen Upload muss die Build-Nummer steigen: Ziel **App → General → Build** (im Projekt `CURRENT_PROJECT_VERSION`, im Moment 4).

## Nach Änderungen am Spiel

```bash
git pull
npm install
npm run sync
```

Danach in Xcode wieder auf ▶ oder neu archivieren. `npm run sync` kopiert die aktuellen Spieldateien in die App.

## Ohne Mac: als Web-App auf den Home-Bildschirm

Auf iPad oder iPhone in **Safari** https://kvb1982.github.io/rennspiel/ öffnen, auf **Teilen** tippen und **Zum Home-Bildschirm** wählen. Das Spiel startet dann mit eigenem Symbol im Vollbild, braucht aber Internet. Das Handy-Lenkrad geht dort nur über den QR-Code.

## Vor dem App Store

- **Lizenzen:** Kenney- und Poly-Haven-Modelle, Fotos und Geräusche sind CC0 (`LIZENZEN.md`). Für die Modelle aus 3D AI Studio (Supercars, Formel-Rennwagen, Verkehr) vor einer Veröffentlichung die Nutzungsbedingungen prüfen. Die Supercars sehen echten Autos sehr ähnlich – für den App Store besser vorher klären.
- **Version:** Für jedes Update „Version“ und „Build“ hochzählen.

## Was wo liegt

| Datei oder Ordner | Zweck |
| --- | --- |
| `index.html`, `css`, `js`, `bilder`, `modelle`, `sounds` | Das Spiel. Dieselben Dateien laufen weiter auf der Webseite. |
| `js/native.js` | Kleine Brücke für die App (Rütteln, Lenkrad-Plugin). Im Browser macht sie nichts. |
| `js/verbindung.js` | `NahLink`: Verbindung iPad ↔ iPhone in der App; daneben weiter PeerJS (QR-Code) und BroadcastChannel (Test). |
| `capacitor.config.json` | Name, Kennung und Einstellungen der App. |
| `scripts/copy-web.mjs` | Kopiert das Spiel nach `www`, legt three.js, PeerJS und QR-Code nach `www/lib` und biegt die Import-Map dorthin um. Neue Ordner mit Spieldateien müssen dort in die Liste. |
| `www` | Kopie des Spiels für die App. Wird automatisch erzeugt, nicht von Hand ändern. |
| `ios` | Das Xcode-Projekt. `ios/App/App/AppDelegate.swift` enthält das Plugin `LenkradLink` (Multipeer, Dienstname `rennspiel`, muss zu `NSBonjourServices` in `Info.plist` passen). Symbol und Startbild in `ios/App/App/Assets.xcassets`. |
