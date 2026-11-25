# Konzept für die Weiterentwicklung (Stand 25.11.2026)

Dieses Konzept sagt, **was als Nächstes gebaut werden sollte, in welcher Reihenfolge und wie**. Es stützt sich auf zwei
andere Dateien und wiederholt sie nicht:

- `docs/review_2026-11-25.md`: was heute gut ist und was nicht (mit Belegen).
- `docs/konzept_saison_karriere_tuning.md` (22.11.2026): der ausgearbeitete Plan für Tuning, Saison und Karriere.
  Er bleibt gültig. Abschnitt 6 hier sagt, was daran ergänzt oder umgestellt werden sollte.

Das ist ein Plan, kein Code. Alle Zahlen sind Vorschläge. Alle Namen bleiben ausgedacht.

## 1. Wohin das Spiel soll

Heute: ein sehr breites Fahr-Spielzeug. Man wählt Auto und Strecke, fährt, und danach bleibt eine Bestzeit.
Ziel: ein Rennspiel für die Familie, das man **wochenlang** spielt, allein und zusammen, und das auf iPad und iPhone
so verlässlich läuft wie ein gekauftes Spiel.

Drei Sätze, an denen jede neue Idee gemessen wird:

1. **Erst fahrbar, dann mehr.** Kein neuer Spielmodus, solange ein Fahrmodus nicht mit echten Händen geprüft ist.
2. **Jede Fahrt zählt für etwas.** Nach jedem Rennen hat man etwas bekommen oder ist einem Ziel näher.
3. **Zusammen ist besser.** Das Handy-Lenkrad ist das Besondere an diesem Spiel. Was zwei Leute vor einem Bildschirm
   zusammenbringt, hat Vorrang vor allem, was nur allein geht.

Die Leitsätze aus dem Plan vom 22.11. gelten weiter (Fahrgefühl ist heilig, in 20 Sekunden wieder im Auto, ein Kind
kommt allein durch, Verlieren kostet nichts, kein echtes Geld).

## 2. Stufe 0: Fundament

Ohne diese Stufe wird alles Weitere auf Sand gebaut. Sie bringt wenig Neues zum Anfassen, aber danach stimmen
Messung und Spiel überein, und der Spielstand ist sicher.

### 2.1 Messen mit echten Eingaben (das Wichtigste)

**Eingabe-Rekorder.** Bei jeder Fahrt schreibt das Spiel mit: 60-mal pro Sekunde Lenkung, Gas, Bremse, Handbremse,
dazu einmal Auto, Strecke, Einstellungen und Spielstand-Version. Beim Neigen zusätzlich die Lage des Geräts.

- Größe: etwa 4 Zahlen mal 60 mal 90 Sekunden, als Ganzzahlen gepackt rund 20 KB pro Runde.
- Nach dem Rennen im Ergebnis ein Knopf „Fahrt sichern“. In der App geht die Datei über „Teilen“ (AirDrop, Dateien),
  im Browser als Download. Kein Server, nichts geht von allein irgendwohin.
- Neues Werkzeug `tools/nachfahren.mjs <datei>`: fährt die Aufnahme mit der heutigen Physik nach und zeigt Wandkontakte,
  Zeit neben der Strecke, Lenk-Verlauf als Bild (`tools/nachfahren.svg`). Mit `--fahrer` benutzt es die Aufnahme als
  Vorbild für einen künstlichen Fahrer: gleiche Verzögerung, gleiches Zittern, gleiche Art zu bremsen.

Damit ändert sich der Ablauf: Kristian fährt drei Runden, schickt die Datei, und der nächste Thread stimmt an **seinen**
Eingaben ab statt an einem erfundenen Fahrer. Das allein hätte die Rallye-Schleife vom 22.11. (vier Anläufe) verkürzt.

**Anzeige zum Einschalten** (Menü, Zahnrad, „Messwerte“): Bilder pro Sekunde, Dreiecke, Zeichenaufrufe, Stufe der
Bildschärfe, dazu ein Balken für Lenkung, Gas und Bremse. Damit sieht man auf dem iPad sofort, ob es am Tempo liegt
oder an der Steuerung.

### 2.2 Fester Zeitschritt

Die Physik rechnet immer in Schritten von 1/120 Sekunde, egal wie schnell der Bildschirm ist. Die Schleife sammelt die
vergangene Zeit und rechnet so viele Schritte, wie hineinpassen. Das Bild zeigt die Lage zwischen zwei Schritten.

- Voraussetzung für: gleiche Ergebnisse in Werkzeug und Spiel, genaue Geister, Wiederholungen aus dem Rekorder,
  Mehrspieler.
- Dazu ein Zufall mit Startwert für alles, was im Rennen würfelt (Fehler der Computerfahrer, Verkehr, Stöße).
- Abnahme: Dieselbe Aufnahme aus 2.1 ergibt bei 30, 60 und 120 Bildern pro Sekunde dieselbe Rundenzeit.
  `tools/fahrstand.mjs`, `fahrgefuehl.mjs` und `MENSCH=1 tools/rallye.mjs` zeigen vorher und nachher dieselben Zahlen
  (oder die Abweichung wird im PR genannt und von Kristian gefahren).

### 2.3 Stufenlose Pedale

- Handy-Lenkrad und Pedale auf dem Bildschirm: Der Daumen bestimmt mit seiner Höhe auf dem Pedal, wie viel Gas oder
  Bremse (unten wenig, oben voll). Wer nur tippt, bekommt wie heute volles Pedal. Eine Füllung im Pedal zeigt den Stand.
- Tastatur: Bremse baut sich in 0,15 Sekunden auf statt sofort.
- Die Nachricht vom Handy trägt `g` und `b` schon als Zahl, das Format bleibt.

### 2.4 Sauberer Lebenslauf der App

- Pause von selbst, wenn die App in den Hintergrund geht oder der Tab verdeckt wird. Ton aus. Beim Zurückkommen bleibt
  die Pause stehen, bis man „Weiterfahren“ tippt.
- Grafik-Kontext verloren: Pause, Meldung, Strecke neu laden.
- Bildschirm wach halten auch im Browser.
- Fehler beim Laden einer Strecke: Meldung und zurück ins Menü statt Dauer-Ladebild.

### 2.5 Spielstand als eigenes Modul

Neue Datei `js/stand.js` (ohne three.js, in node prüfbar), Vorbild `js/profile.js` in Powershot:

```js
{ v: 1,                                   // Version, bei jeder Änderung des Aufbaus hochzählen
  profile: [{ id, name, farbe }], aktiv: id,
  je: { [id]: { einst: {…}, best: { 'kueste|f1': { zeit, medaille } }, drift: {…}, karriere: null } } }
```

- Ein Schlüssel `rennspiel.stand.v1`. Alte Einzel-Schlüssel werden beim ersten Start übernommen.
- Bestzeiten liegen hier, **Geister getrennt** (ein Schlüssel je Geist, gepackt, mit Löschen der ältesten bei vollem Speicher).
- „Wer fährt?“ mit mehreren Profilen. Das braucht schon der Mehrspieler-Modus „Abwechselnd“ (Abschnitt 5.1).
- In der App zusätzlich eine Kopie als Datei über Capacitor (`Filesystem`), später iCloud (Abschnitt 7).
- Sichern und Laden als Datei.

### 2.6 Aufräumen vor dem Ausbau

- `spiel.js` teilen: `ablauf.js` (welcher Bildschirm ist dran, als kleiner Automat mit den Zuständen Menü, Laden,
  Rennen, Pause, Ergebnis, später Zentrale und Werkstatt), `menue.js`, `anzeige.js`, `schleife.js`.
- Die kleinen Fehler aus dem Review, Abschnitt 5.1.
- GitHub-Aktion, die bei jedem Pull Request die Prüfwerkzeuge laufen lässt und die Zahlen als Kommentar anhängt.
- `CLAUDE.md` kürzen: Die langen Absätze unter „Bekannte Grenzen“ sind ein Tagebuch. Sie gehören nach
  `docs/verlauf.md`. In `CLAUDE.md` bleibt je Thema der heutige Stand in drei Zeilen und die „Merke“-Sätze.

### 2.7 Tempo auf dem iPad messen

Einmal mit der Anzeige aus 2.1 jede Strecke 30 Sekunden auf Kristians iPad fahren und die Zahlen in
`docs/tempo_ipad.md` eintragen. Ziel für Grafik „mittel“: 60 Bilder pro Sekunde bei voller Bildschärfe. Strecken, die
das nicht schaffen, bekommen einen eigenen kleinen Thread (weniger Häuser in Sichtweite, gröbere Modelle in der Ferne).

## 3. Fahrmodi neu ordnen

Heute gibt es fünf einzelne Schalter und den Gegensatz „Arcade“ gegen „echter“. Vorschlag: drei fertige Stufen.
Die einzelnen Schalter bleiben hinter „Anpassen“ erreichbar.

| Stufe | Für wen | Was an ist |
| --- | --- | --- |
| **Einsteiger** | jüngere Kinder, erste Runden | alle Arcade-Hilfen, Bremshilfe, Lenkhilfe, Gas von allein |
| **Arcade** (Standard) | so wie es Kristian heute gern fährt | Arcade-Hilfen, Bremshilfe, Traktionskontrolle |
| **Sport** (heute „echter“) | wer es selbst können will | keine unsichtbare Führung, aber ABS, Traktionskontrolle, Schleuderschutz, Lenkung passend zum Reifen |

Für „Sport“ gilt ein hartes Ziel, an dem der Modus abgenommen wird:

- Der „Profi“ aus `tools/fahrgefuehl.mjs aus` fährt jede Strecke mit 0 Wandkontakten und unter 1 Sekunde neben der Strecke.
- Ein Fahrer aus Kristians eigener Aufnahme (Abschnitt 2.1) schafft das auf drei Strecken.
- Kristian fährt mit etwas Übung eine saubere Runde in normalem Tempo.

Was dafür nötig ist, steht im Review, Abschnitt 4 (Tempo-Plan je Modus, Haftung zum Lenken beim Bremsen, Lenkung an
die Haftung anpassen, stufenlose Pedale, Gegner ohne Arcade-Hilfe). Das bearbeitet der Fahrphysik-Thread.

Wer in „Sport“ fährt, bekommt später in Saison und Karriere mehr Preisgeld (so steht es schon im Plan vom 22.11.)
und eigene Medaillen-Zeiten. So lohnt sich der schwerere Modus, ohne dass jemand ihn fahren muss.

## 4. Stufe 1: Spannung im einzelnen Rennen

Lauter kleine Bausteine. Jeder ist für sich fertig, keiner braucht Saison oder Karriere.

### 4.1 Medaillen

Für jede Strecke und jede Fahrzeugart drei Zeiten: Bronze, Silber, Gold. Gerechnet aus der Plan-Runde, die es schon
gibt (zum Beispiel Bronze 1,25-mal, Silber 1,12-mal, Gold 1,03-mal Plan-Zeit, Rallye aus den Gegnerzeiten).
Die Medaille steht auf der Strecken-Karte im Menü, im Ergebnis und zählt in einer Leiste „17 von 72 Gold“.
Bei den kleinen Autos: Drift-Punkte statt Zeit. Wer alle Bronze-Medaillen einer Fahrzeugart hat, schaltet eine
Lackierung frei. Das ist der billigste Baustein mit der größten Wirkung und zugleich der Probelauf für die
Belohnungen der Karriere. Die Faktoren werden mit `tools/sim.mjs` und Kristians Aufnahmen geeicht.

### 4.2 Windschatten

Hinter einem anderen Auto (bis 40 Meter, in einem schmalen Keil) sinkt der Luftwiderstand um bis zu 30 %.
Ein Eintrag in `rennen.js`, der `a.sog` setzt, und eine Zeile in `physik.js` beim Luftwiderstand. Im Bild: feine
Linien am Bildrand und ein Rauschen im Ton. Die Computerfahrer bekommen ihn auch. Wirkung: Man holt auf der Geraden
auf, kann am Ende ausscheren und überholen. Das fehlt heute völlig und ist der Kern jedes Rad-an-Rad-Rennens.
Geändert wird ein Wert der Physik, also vorher und nachher `tools/fahrstand.mjs` (ohne Gegner ändert sich nichts).

### 4.3 Gegner mit Gesicht

Heute: acht Namen, Stärke gleichmäßig verteilt, jeder fährt dieselbe Linie.

- **Eigenart** je Fahrer: Spätbremser (schnell am Kurveneingang, macht dort Fehler), Starter (gewinnt beim Start
  zwei Plätze), Verteidiger (fährt innen, wenn jemand neben ihm ist), Regelmäßiger (keine Fehler, nicht der Schnellste).
  Technisch sind das drei Zahlen in `neuerFahrer` (Bremspunkt, Fehlerrate, Versatz zur Linie bei Gefahr).
- **Fehler unter Druck:** Wer einen Verfolger dicht hinter sich hat, verbremst sich öfter. So lohnt sich Dranbleiben.
- **Rivale:** der Fahrer, der am Ende des letzten Rennens direkt vor einem lag. Er ist im Rennen markiert und bekommt
  eine eigene Zeile im Ergebnis („Du hast Kessler geschlagen“).
- **Faire Gegner:** Sie fahren mit denselben Hilfen wie man selbst.
- **Kein heimliches Gummiband.** Wer möchte, schaltet auf „leicht“ ein sichtbares „Feld bleibt zusammen“ ein.

### 4.4 Start und Qualifikation

- Heute startet man immer auf einem festen Platz im hinteren Mittelfeld. Neu: eine fliegende Runde vorweg bestimmt
  den Startplatz (überspringbar, dann Startplatz wie heute). Das Zeitfahren dafür gibt es schon.
- Startampel mit Wertung: Wer in den ersten 0,25 Sekunden nach dem Erlöschen Gas gibt, bekommt einen besseren Antritt
  („Blitzstart!“). Wer vorher Gas gibt, steht kurz („Frühstart“). Ein kleines Spiel im Spiel, das Kinder lieben.

### 4.5 Rennen des Tages

Jeden Tag eine feste Aufgabe, gewürfelt aus dem Datum (dafür der Zufall mit Startwert aus 2.2): Auto, Strecke,
Bedingung („Nordvind auf der Riviera, viel Verkehr, 2 Runden“). Jedes Profil hat einen gewerteten Versuch, danach
freies Üben. Die Familien-Tabelle zeigt, wer heute vorn liegt. Mit Game Center (Abschnitt 7) wird daraus eine
Bestenliste unter Freunden. Wirkung: ein Grund, jeden Tag fünf Minuten zu spielen, und man fährt auch Autos und
Strecken, die man sonst nie wählt.

### 4.6 Fahrschule und Lizenzen

Kurze Aufgaben von 20 bis 60 Sekunden mit Bronze, Silber, Gold:
Bremsen bis in ein Feld, Slalom, eine Kurve auf der Ideallinie, eine saubere Runde, Überholen im Verkehr,
Rallye-Kehre mit Handbremse, Slotcar ohne Abflug.

- Sie ersetzen eine Einführung: Die erste Aufgabe ist „Handy halten, Mitte setzen, geradeaus fahren“.
- Sie bringen den „Sport“-Modus bei, Schritt für Schritt.
- In der Karriere sind sie die Eintrittskarte in die nächste Klasse (Lizenz C, B, A, S).

Technisch: eine Liste `AUFGABEN` in `js/schule.js` mit Strecken-Abschnitt, Start-Tempo, Regel und Zeiten. Jede Aufgabe
ist ein kleines `Rennen` mit eigenem Ziel. Mit dem festen Zeitschritt lässt sich jede Aufgabe im Werkzeug nachfahren.

### 4.7 Wiederholung und Foto

Nach dem Ziel „Wiederholung ansehen“: Die Fahrt läuft aus der Aufnahme noch einmal, gefilmt von festen Stellen an der
Strecke (wie die Stand-Kamera der kleinen Autos). Dazu der Fotomodus aus Reitturnier und Powershot (Bild anhalten,
Kamera drehen, speichern). Kinder zeigen ihre beste Kurve gern her. Braucht 2.1 und 2.2.

## 5. Stufe 2: Zusammen spielen

Vom Billigen zum Teuren. Jede Stufe ist für sich ein fertiges Angebot, und jede prüft, ob die nächste sich lohnt.

### 5.1 Abwechselnd (ein Gerät, kein Netz)

Zwei bis vier Profile fahren nacheinander dieselbe Rallye-Prüfung, dasselbe Zeitfahren oder das Rennen des Tages.
Zwischen den Fahrten: „Jetzt fährt Papa“ und die Tabelle. Der Geist des bisher Besten fährt mit.
Für die Rallye ist das sogar echt: Dort fährt jeder allein gegen die Uhr.
Braucht nur Profile (2.5) und einen Zwischenbildschirm. **Aufwand klein, sofort Familien-tauglich.**

### 5.2 Geist-Duell (zwei Geräte, kein gleichzeitiges Spielen)

Eine Geist-Runde als Datei verschicken (AirDrop, Nachricht). Der andere lädt sie und fährt dagegen.
Mit Game Center später ohne Datei: „Geist von Kristian laden“. Braucht den gepackten Geist aus 2.5.

### 5.3 Zwei bis vier Fahrer an einem Bildschirm

Das Besondere dieses Spiels: Jeder nimmt sein Handy als Lenkrad, alle schauen auf das iPad oder den Fernseher.

- **Zuerst ohne geteilten Bildschirm:** Slotcar, ferngesteuertes Auto und Drift-Rallye haben die Kamera „neben der
  Bahn“. Eine Kamera, alle Autos im Bild. Slotcar zu viert braucht nur Gas und ist damit das einfachste gemeinsame
  Rennen überhaupt. Das ist der Einstieg.
- **Dann geteilter Bildschirm** für Rennwagen, Supercars: zwei Hälften nebeneinander, je eine Kamera und eine kleine
  Anzeige. Das Bild wird zweimal gemalt, deshalb Grafik eine Stufe niedriger und halber Verkehr.

Technik:

- `LenkradEmpfang` gibt jedem verbundenen Handy einen Platz (Spieler 1 bis 4, mit Farbe). Das Handy zeigt die Farbe.
  Die Lobby im Menü zeigt, wer da ist. Heute lenken zwei Handys dasselbe Auto.
- `Rennen` bekommt eine Liste von Menschen statt eines `ich`. Die Stellen, die `c.ich` fragen (Hilfen, Meldungen,
  Geist, Turbo, Drift-Punkte), gelten dann je Mensch.
- `Buehne.malen` bekommt einen Ausschnitt. Die Autos werden einmal bewegt und je Hälfte einmal gemalt.
- Multipeer in der App nimmt heute nur ein iPhone an. Für zwei braucht das Plugin eine Liste statt eines Partners.

### 5.4 Zwei Geräte im selben Raum

Jeder hat sein eigenes iPad oder iPhone und sieht sein eigenes Bild. Verbindung über Multipeer (App) oder PeerJS.

Bewährtes Muster für Rennspiele: **Jedes Gerät rechnet sein eigenes Auto selbst** und schickt 20-mal pro Sekunde Ort,
Richtung und Tempo. Die fremden Autos werden zwischen den Meldungen weich weitergeführt. Berührungen rechnet jedes
Gerät für sein eigenes Auto, mit weichem Wegdrücken statt hartem Stoß. Das eigene Auto fühlt sich dadurch immer direkt
an, auch wenn das Netz hakt. Der Gastgeber führt Ampel, Runden und Ergebnis.
Nachrichten: `{ t: 'p', n, x, z, h, u, v, r, runde }` und vom Gastgeber `{ t: 'r', phase, ampel, plaetze }`.
Braucht den festen Zeitschritt und den Zufall mit Startwert. Verkehr gibt es in diesem Modus zuerst nicht.

### 5.5 Über das Internet

Dasselbe wie 5.4, nur mit Raum-Code über PeerJS oder mit Game Center. Erst bauen, wenn 5.4 Spaß macht und gewünscht
wird. Es kommen Fragen dazu, die es bisher nicht gibt (wer darf beitreten, was passiert bei Abbruch, Verzögerung
von 50 bis 150 ms). Für ein Familienprojekt ist das die teuerste Stufe mit dem kleinsten Zugewinn.

## 6. Stufe 3: Saison, Tuning, Karriere

Der Plan vom 22.11. ist gut und bleibt die Grundlage. Ergänzungen aus dem Review:

### 6.1 Reihenfolge umstellen: erst Saison, dann Tuning

Der alte Plan beginnt mit dem Tuning. Empfehlung: **Saison zuerst.**

- Tuning ohne Ziel hat wenig Zugkraft. Erst wenn es eine Tabelle gibt, will man das Auto besser machen.
- Tuning greift in die Fahrwerte ein. Die sind gerade in Arbeit (Sport-Modus, Neigung). Tuning kommt besser,
  wenn sie sich gesetzt haben und der Rekorder aus 2.1 da ist.
- Die Saison braucht fast nur vorhandene Teile: Strecken gibt es inzwischen genug (8 Rennstrecken, 7 Straßen, 4 Prüfungen),
  die Gegenrichtung als Variante ist damit nicht mehr dringend.

### 6.2 Was die Saison zusätzlich bekommt

- Qualifikation, Blitzstart, Windschatten, Gegner mit Eigenart und Rivale aus Stufe 1.
- Der Stand der Saison liegt im Spielstand (2.5). Auch die „Ganze Rallye“ merkt sich heute nichts, wenn man die App schließt.
- Saison zu zweit: Zwei Profile fahren dieselbe Meisterschaft, abwechselnd (5.1) oder am geteilten Bildschirm (5.3).
  Beide stehen in derselben Tabelle. Das ist die Art, wie eine Familie eine Saison spielt.

### 6.3 Was das Tuning zusätzlich bekommt

- Jede Abstimmung wird mit Kristians Aufnahmen nachgefahren (2.1), nicht nur mit künstlichen Fahrern.
- Die Leistungszahl wird aus der Plan-Runde auf einer festen Prüfstrecke gerechnet, nicht aus einer Formel über die
  Teile. Dann stimmt sie auch, wenn sich die Physik ändert.
- Die Grenzen der Schieber gelten für Arcade und Sport getrennt geprüft.

### 6.4 Was die Karriere zusätzlich bekommt

- Lizenzen aus der Fahrschule (4.6) als Eintrittskarte in die Klassen. So lernt man, bevor es schwer wird.
- Medaillen (4.1) zählen als Ruf.
- Rennen des Tages (4.5) bringt Preisgeld. So greifen freies Spiel und Karriere ineinander.
- Wirtschaft erst mit `tools/karriere.mjs` durchspielen, dann von Kristian eine Stunde spielen lassen, dann Zahlen festlegen.

### 6.5 Zu den fünf offenen Entscheidungen aus dem Plan vom 22.11.

| Frage | Empfehlung |
| --- | --- |
| Eine Karriere oder drei? | Eine, mit gemeinsamem Konto (wie vorgeschlagen). Je Profil eine |
| Rallye-Schaden? | Ja, mild und abschaltbar, aber erst in Stufe „Würze“. Die erste Rallye-Saison kommt ohne aus |
| Formel-Tuning als Team-Entwicklung? | Ja. Gleiche Werkstatt-Ansicht, anderer Name |
| Rennlänge in der Karriere? | Kurz, mittel, lang zur Wahl, gleiches Preisgeld. Standard „kurz“ (3 bis 5 Minuten) |
| Vorbilder nennen? | Jetzt schon herausnehmen. Es kostet nichts und macht eine spätere Veröffentlichung leichter |

Neue Entscheidungen aus diesem Konzept stehen in Abschnitt 10.

## 7. iPad und iPhone

| Baustein | Nutzen | Wie |
| --- | --- | --- |
| Pause, Kontext-Verlust, Tempo-Messung | Verlässlichkeit | Abschnitt 2.4 und 2.7 |
| Spielstand als Datei, dann iCloud | Stand überlebt Löschen und wandert vom iPhone aufs iPad | Capacitor `Filesystem`, später ein kleines Swift-Plugin für `NSUbiquitousKeyValueStore` (Platz für 1 MB: reicht für den Stand ohne Geister) |
| Game Center | Bestenlisten je Strecke unter Freunden, Erfolge, Rennen des Tages | Swift-Plugin nach dem Muster von `LenkradLink`: anmelden, Zeit melden, Liste holen, Erfolg melden |
| Controller | stufenlose Pedale, der beste Weg für „Sport“ | geht über die Gamepad-Schnittstelle schon, auf dem Gerät prüfen und im Menü anbieten |
| Haptik | Randstein, Rutschen, Schalten im iPhone-Lenkrad | gibt es für Stöße schon, um Rutschen und Schaltruck ergänzen |
| Fernseher | iPad oder iPhone per AirPlay oder Kabel, Handys als Lenkräder | einmal prüfen (Verzögerung über AirPlay kann stören, Kabel ist besser), in `APP-ANLEITUNG.md` beschreiben |
| TestFlight ohne Mac-Sitzung | Build nach jedem Merge von selbst | GitHub-Aktion mit macOS-Runner und App-Store-Connect-Schlüssel als Geheimnis. Das Skript `scripts/testflight.sh` kann den Schlüssel schon |

Für eine Veröffentlichung im App Store kommen dazu: Namen und Formen ohne echte Vorbilder, Lizenz des einen
CC-BY-SA-Modells klären oder das Modell ersetzen, Datenschutz-Angaben, Texte auf Englisch.

## 8. Technik im Überblick

Neue oder geänderte Dateien, alle Rechen-Dateien ohne three.js:

| Datei | Inhalt | Stufe |
| --- | --- | --- |
| `js/aufnahme.js` | Eingabe-Rekorder: schreiben, packen, lesen, abspielen | 0 |
| `tools/nachfahren.mjs` | Aufnahme mit heutiger Physik nachfahren, Fahrer aus Aufnahme | 0 |
| `js/schleife.js` | fester Zeitschritt, Zufall mit Startwert | 0 |
| `js/stand.js` | Spielstand mit Version, Profilen, Umrechnen, Sichern und Laden | 0 |
| `js/ablauf.js`, `menue.js`, `anzeige.js` | aus `spiel.js` herausgelöst | 0 |
| `.github/workflows/pruefen.yml` | Prüfwerkzeuge bei jedem Pull Request | 0 |
| `js/medaillen.js` | Zeiten je Strecke und Auto, Vergabe, Zählung | 1 |
| `js/gegner.js` | Eigenarten, Rivale, Fehler unter Druck (ergänzt `ki.js`) | 1 |
| `js/schule.js` | Aufgaben der Fahrschule, Lizenzen | 1 |
| `js/tagesrennen.js` | Aufgabe aus dem Datum, Wertung je Profil | 1 |
| `js/spieler.js` | mehrere Menschen: Plätze, Farben, Zuordnung der Lenkräder | 2 |
| `js/netz.js` | Nachrichten für zwei Geräte, Weiterführen fremder Autos | 2 |
| `js/saison.js`, `tuning.js`, `karriere.js`, `karriereansicht.js` | wie im Plan vom 22.11. | 3 |

Grundsätze:

- **Rennlogik kennt keine Anzeige.** `Rennen`, `Etappe`, Saison und Karriere liefern Ereignisse und Ergebnis-Objekte,
  die Anzeige malt sie. So lassen sich ganze Saisons im Werkzeug durchspielen.
- **Jede neue Zahl hat ein Werkzeug**, das sie prüft, und einen Satz, wie man sie verstellt, wenn es sich falsch anfühlt.
- **Neues an der Physik ist abschaltbar** und wird gegen den besten Stand verglichen (wie schon vereinbart).
- **Kein Build-Schritt** für den Browser, wie bisher.

## 9. Fahrplan

Aufwand in Pull Requests, so wie hier gearbeitet wird (ein PR ist etwa ein Thread von einigen Stunden).
„Abnahme“ ist das, was Kristian am Ende selbst in der Hand prüft.

| Stufe | Inhalt | PRs | Abnahme |
| --- | --- | --- | --- |
| **0a Sofort** | Pause beim Verlassen, kleine Fehler (Review 5.1), Bestzeit getrennt vom Geist, Vorbilder aus dem Menü, Neigung in drei Stufen | 1 bis 2 | Anruf während des Rennens: Spiel steht |
| **0b Messen** | Eingabe-Rekorder, `nachfahren.mjs`, Messwerte-Anzeige, iPad-Tabelle | 2 | Kristian schickt drei Fahrten, das Werkzeug fährt sie nach |
| **0c Sport-Modus** | läuft im Fahrphysik-Thread: stufenlose Pedale, Befunde aus Review 4.1 bis 4.5 | 2 bis 3 | saubere Runde ohne Arcade-Hilfe |
| **0d Unterbau** | fester Zeitschritt, `stand.js` mit Profilen, `spiel.js` teilen, GitHub-Aktion, `CLAUDE.md` kürzen | 3 bis 4 | alles fühlt sich an wie vorher, Stand übersteht ein Update |
| **1 Spannung** | Medaillen, Windschatten, Gegner mit Eigenart und Rivale, Qualifikation und Blitzstart, Fahrschule, Rennen des Tages | 5 bis 6 | „noch eine Runde für Gold“ |
| **2a Zusammen I** | Abwechselnd mit Tabelle, Geist-Duell, Slotcar und Modellautos zu zweit bis viert an einem Bildschirm | 3 | Familien-Abend mit zwei Handys |
| **3a Saison** | Meisterschaft je Disziplin, Tabellen, Zwischenbildschirm, auch zu zweit | 4 bis 5 | eine Saison in einer Stunde durchgespielt |
| **2b Zusammen II** | geteilter Bildschirm für Rennwagen und Supercars | 2 bis 3 | Rennen Vater gegen Sohn auf dem Fernseher |
| **3b Tuning** | Werkstatt, Abstimmung, Probefahrt, Prüfwerkzeug | 3 | Abstimmung für eine Strecke gefunden, die schneller ist |
| **3c Karriere** | Profil, Geld und Ruf, Leitern, Garage, Teams, Lizenzen | 6 bis 8 | erste Klasse geschafft |
| **4 Ausbau** | Wiederholung und Foto, Game Center, iCloud, zwei Geräte im Raum, Service-Park und Schaden, Regen, Boxengasse Rennwagen | je 1 bis 3 | nach Wunsch |

Stufe 0a bis 0d sind zusammen etwa 8 bis 11 PRs. Danach ist jede Stufe für sich spielbar, und nach jeder kann man
aufhören oder die Reihenfolge ändern. Die kleinste Fassung, die das Spiel deutlich länger trägt, ist **0 plus 1 plus 2a**.

## 10. Risiken und Entscheidungen

### Risiken

| Risiko | Gegenmittel |
| --- | --- |
| Der feste Zeitschritt verändert das Fahrgefühl, das Kristian gut findet | Erst der Rekorder, dann der Zeitschritt. Aufnahmen vorher und nachher vergleichen, abschaltbar einbauen, bis er es gefahren hat |
| Zu viel auf einmal, nichts wird fertig | Stufen in dieser Reihenfolge, jede mit Abnahme. Keine neue Fahrzeugart und keine neue Strecke bis Stufe 1 fertig ist |
| Geteilter Bildschirm ist auf dem iPad zu langsam | Zuerst die Modi mit einer Kamera (5.3). Vor dem Bauen mit der Messwerte-Anzeige das doppelte Malen ausprobieren |
| Wirtschaft der Karriere macht keinen Spaß | Medaillen und Rennen des Tages sind der Probelauf für Belohnungen. `tools/karriere.mjs` vor dem ersten Bildschirm |
| Tuning verdirbt das Fahrgefühl | Enge Grenzen, Prüfung mit echten Aufnahmen, Tuning erst nach der Saison |
| Dokumentation wächst schneller als der Code | `CLAUDE.md` auf den heutigen Stand kürzen, Verlauf auslagern |

### Was Kristian entscheiden sollte

1. **Reihenfolge:** Fundament und Spannung vor Saison, Saison vor Tuning (Empfehlung), oder gleich die Saison?
2. **„echter“ wird „Sport“** mit ABS und Lenkung passend zum Reifen (Empfehlung), oder soll es einen Modus ganz ohne
   Hilfen geben, auch wenn er nur mit Controller gut fahrbar ist?
3. **Eingabe-Rekorder:** Einverstanden, nach Testfahrten eine Datei zu schicken? Sie enthält nur Lenkung, Gas, Bremse
   und die Lage des Geräts.
4. **Mehrspieler:** Was zuerst? Empfehlung: Abwechselnd und Slotcar zu viert, dann geteilter Bildschirm. Online nur auf Wunsch.
5. **Wie öffentlich soll das Spiel werden?** Bleibt es bei TestFlight in der Familie, sind Vorbild-Namen und das
   CC-BY-SA-Modell kein Problem. Für den App Store müssen sie vorher raus.
6. Die fünf Fragen aus dem Plan vom 22.11. (Empfehlungen in Abschnitt 6.5).
