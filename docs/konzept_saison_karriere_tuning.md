# Konzept: Saison, Karriere und Tuning (Stand 22.11.2026)

Für **Formel-Rennwagen, Supercars und Rallye**. Die kleinen Autos (ferngesteuert, Slotcar, Drift-Rallye) bleiben
freies Spiel für zwischendurch und kommen hier nicht vor.

Das ist ein Plan, noch kein Code. Alle Zahlen sind Vorschläge zum Ausprobieren und nicht erspielt.
Alle Namen (Teams, Fahrer, Serien, Orte, Sponsoren) bleiben ausgedacht.

## 1. Worum es geht

Heute wählt man im Menü Auto, Strecke und Stärke und fährt ein einzelnes Rennen. Das Fahren macht Spaß,
aber nach dem Rennen bleibt nichts übrig, außer einer Bestzeit. Die drei Bausteine geben dem Fahren einen Grund:

| Baustein | Frage, die er beantwortet | Dauer |
| --- | --- | --- |
| **Tuning** | „Wie mache ich *mein* Auto besser und passend für diese Strecke?“ | 1 Minute vor dem Rennen |
| **Saison** | „Wer ist am Ende Meister?“ | 6 bis 8 Rennen, etwa eine Stunde |
| **Karriere** | „Wie komme ich vom Anfänger ganz nach oben?“ | viele Abende |

### Leitsätze

1. **Das Fahrgefühl ist heilig.** Die jetzigen Werte für Physik, Lenkung und Hilfen sind die „Werkseinstellung“.
   Tuning verschiebt Werte nur in engen Grenzen und fasst die Lenk-Eingabe und die Hilfen nie an (siehe 2.4).
2. **In 20 Sekunden wieder im Auto.** Zwischen zwei Rennen höchstens ein Bildschirm mit einem großen Knopf „Weiter“.
   Alles andere (Werkstatt, Tabelle, Zeitung) ist freiwillig.
3. **Ein Kind kommt allein durch.** Jede Entscheidung hat einen Knopf „Mechaniker macht das“ bzw. „Empfehlung nehmen“.
   Wer nie in die Werkstatt geht, kann die Karriere trotzdem schaffen, nur langsamer.
4. **Verlieren kostet nichts.** Es gibt nie weniger Geld als vorher, kein Game Over, keine Reparatur-Schulden.
   Ein schlechtes Rennen bringt nur weniger ein.
5. **Kein echtes Geld, keine Wartezeiten, keine Zufalls-Kisten.**
6. **Jede Disziplin fühlt sich anders an**, auch außerhalb des Autos:
   Formel = Team und Meisterschaft, Supercar = Garage und Sammeln, Rallye = Abenteuer und Durchkommen.

## 2. Tuning

Zwei Ebenen, die man nicht verwechseln darf:

- **Teile** kauft man einmal mit Preisgeld. Sie machen das Auto dauerhaft besser. Das ist der Fortschritt.
- **Abstimmung** kostet nichts und wird vor jedem Rennen gewählt. Sie macht das Auto nicht besser, sondern
  *anders*: mehr Kurve oder mehr Gerade. Das ist die Entscheidung.

### 2.1 Teile (dauerhaft, je Auto)

Sechs Bereiche, je vier Stufen (Serie → Sport → Rennen → Werk). Jede Stufe ist ein Schritt, den man beim Fahren
merken soll, aber keiner, der das Auto zu einem anderen macht.

| Bereich | Wirkt auf (Werte in `physik.js`) | Stufe 4 gegenüber Serie | Merkt man an |
| --- | --- | --- | --- |
| Motor | `leistung`, `schubMax` | +12 % | Antritt aus der Kurve, Endtempo |
| Getriebe | Schaltzeit (neu), `gaenge` +1 | kürzere Schaltpause | Beschleunigung ohne „Loch“ |
| Reifen | `haft` | +6 % | Kurventempo |
| Bremsen | `bremse`, `bremsGriff` | +10 % | späterer Bremspunkt |
| Leichtbau | `masse`, `traeg` | −8 % | alles ein wenig, vor allem Richtungswechsel |
| Aerodynamik (Formel, Supercar) / Fahrwerk (Rallye) | `abtrieb` bei gleichem `widerstand` / Landung nach Sprüngen, Halt auf losem Boden (`arcade.belag`) | +10 % | schnelle Kurven / Sprünge und Matsch |

Aus allen Teilen rechnet das Spiel eine **Leistungszahl** (LZ, etwa 100 bis 999), die groß am Auto steht.
Sie ist das Maß für alles: Klassen haben eine LZ-Obergrenze, Gegner haben eine LZ, der Kaufpreis folgt ihr.

Preise steigen je Stufe etwa auf das Doppelte. Faustregel fürs Abstimmen: Ein Podestplatz bezahlt ungefähr eine
Stufe 1 oder 2, ein Saisonsieg eine Stufe 4.

### 2.2 Abstimmung (kostenlos, vor jedem Rennen)

Schieber mit **fünf Rasten**, Mitte = Werkseinstellung. Neben jedem Schieber steht in einem Satz, was er tut.
Oben zeigt eine kleine Vorschau drei Balken: Höchsttempo, Beschleunigung, Kurve.

| Schieber | Gilt für | Links … rechts | Technisch |
| --- | --- | --- | --- |
| Flügel | Formel, Supercar | flach (schnell auf der Geraden) … steil (schnell in der Kurve) | `abtrieb` ±15 %, `widerstand` gegenläufig ±10 % |
| Übersetzung | alle | kurz (reißt an, weniger Endtempo) … lang | `schubMax` ±8 %, `vMax` gegenläufig ±6 % |
| Bremsbalance | alle | mehr hinten (dreht beim Anbremsen ein) … mehr vorn (stabil) | `bremseVorn` ±0,05 |
| Balance | alle | Heck lebendig … Heck ruhig | `hinten` ±0,02 |
| Reifen | Rallye (Pflicht), Formel (nur bei Regen, später) | Asphalt / Schotter / Matsch bzw. weich / hart | Faktor auf Haftung je Untergrund (`GRUND`); Formel: `haft` gegen Abnutzung aus `box.js` |
| Bodenfreiheit | Rallye | tief (Asphalt) … hoch (Sprünge, Furten) | Haftung auf Asphalt gegen Tempoverlust bei Landung und Wasser |
| Differenzial | Rallye, Allrad-Supercars | mehr hinten (Heck kommt) … mehr vorn (zieht gerade) | `allrad` ±0,1 |

Der Mechaniker schlägt je Strecke eine Abstimmung vor (aus dem Streckenprofil: Anteil Geraden, engste Kurve,
Untergrund). Ein Tipp auf „Empfehlung nehmen“ genügt. Je Auto und Strecke merkt sich das Spiel die letzte Abstimmung.

**Probefahrt:** In der Werkstatt gibt es „Eine Runde testen“ (das vorhandene Zeitfahren mit Geist). So sieht man
sofort, ob die neue Abstimmung schneller ist. Das ist die eigentliche Tuning-Schleife: ändern, fahren, vergleichen.

### 2.3 Aussehen (kein Einfluss aufs Fahren)

Lackfarbe (gibt es schon bei den Supercars), Startnummer, Felgenfarbe, Streifen. Seltene Lackierungen sind
Belohnungen für Erfolge und nicht käuflich. Damit hat auch ein jüngeres Kind in der Werkstatt etwas zu tun.

### 2.4 Schutz des Fahrgefühls

- Tuning ändert **nie**: Lenk-Eingabe, `arcade`-Hilfen (Lenk-, Reifen-, Strecken-, Spur-Helfer), Schleuderschutz,
  gespielten Drift der Rallyeautos. Die bleiben, wie sie sind.
- Jeder Wert hat eine feste Ober- und Untergrenze um die Werkseinstellung. Voll getunt und extrem abgestimmt
  muss das Auto noch durch die Prüfwerkzeuge kommen: `tools/fahrgefuehl.mjs` (keine Wandkontakte beim „Profi“),
  `tools/bremshilfe.mjs`, `MENSCH=1 node tools/rallye.mjs` (kein Zurücksetzen).
- Mehr Motor ohne mehr Haftung führt zu Untersteuern am Kurveneingang (das kennen wir vom 21.11.). Deshalb hebt
  die Motor-Stufe immer ein kleines Stück Haftung und Bremse mit, und die Bremshilfe rechnet mit dem getunten Auto.
- Die Computerfahrer bekommen dieselben Teile-Regeln. Sie werden **nicht** heimlich stärker, wenn man selbst tunt.
  Sonst wäre Tuning wertlos. Stattdessen steigt man in eine höhere Klasse auf, in der die Gegner stärker sind.

## 3. Saison

Eine Saison ist eine Folge von Veranstaltungen mit Punkten und Tabelle. Sie ist auch **ohne Karriere** spielbar:
Menü → „Saison“ → Auto und Stärke wählen → los. Tuning ist dabei offen (alle Teile frei) oder aus.

(Nachtrag 22.11.2026: Formel und Supercar haben jetzt je sieben Strecken, Rallye vier WPs. Die Varianten bleiben trotzdem sinnvoll.) Wir hatten beim Schreiben je Disziplin nur drei Strecken. Damit eine Saison nicht nach drei Rennen wiederholt, gibt es **Varianten**:

| Variante | Aufwand | Wirkung |
| --- | --- | --- |
| Gegenrichtung | klein (Mittellinie umdrehen, Ideallinie neu rechnen, Start versetzen) | fühlt sich wie eine neue Strecke an |
| Tageszeit (Mittag, Abendrot, Nacht mit Flutlicht) | klein bis mittel (`welt.zeit` gibt es schon) | andere Stimmung, Nacht: man sieht Kurven später |
| Regen | groß (Haftung, Gischt, nasse Fahrbahn, Reifenwahl) | eigener Ausbauschritt, siehe 7 |
| Kurzfassung einer Strecke | mittel (Abkürzung als eigene `ecken`-Liste) | Sprintrennen |

Mit Gegenrichtung und Tageszeit werden aus 3 Strecken 6 bis 8 Läufe, die sich unterscheiden. Neue Strecken
(Wunsch: je Disziplin zwei) bringen am meisten, sind aber der teuerste Posten.

### 3.1 Formel: Weltmeisterschaft

- **Kalender:** 8 Große Preise (Küstenring, Bergwald-Ring, Hafenkurs, je einmal gegenläufig, dazu Hafenkurs bei
  Nacht und Küstenring als Finale mit doppelten Punkten).
- **Wochenende:** Qualifikation (eine fliegende Runde im vorhandenen Zeitfahren, bestimmt den Startplatz;
  überspringbar: dann startet man aus der Mitte) → Rennen (5, 8 oder 12 Runden, wählbar als Länge „kurz, mittel, lang“).
- **Punkte:** 25 – 18 – 15 – 12 – 10 – 8 – 6 – 4 – 2 – 1, dazu 1 Punkt für die schnellste Rennrunde.
- **Feld:** 10 Teams aus `TEAMS` mit je 2 Fahrern = 20 Autos (heute fahren 8; wegen Tempo auf dem iPad zuerst 12).
  Jedes Team hat eine Auto-Stärke, jeder Fahrer ein Können. Daraus ergibt sich eine feste Rangordnung mit
  Tagesform, damit nicht immer derselbe gewinnt.
- **Zwei Tabellen:** Fahrer und Teams. Der **Teamkollege** fährt dasselbe Auto: Er ist der ehrlichste Gegner.
- **Boxenstopp (ab „mittel“):** ein Pflichtstopp mit Reifenwechsel. Dafür fehlt dem Rennwagen noch die Boxengasse
  (für die kleinen Autos gibt es sie in `box.js`). Zuerst ohne Stopp bauen.
- **Schaden:** keiner. Ein Abflug kostet Zeit, das reicht.

### 3.2 Supercar: Straßen-Trophäe

Supercars sind kein Formel-Rennen mit Dach. Hier wechseln die **Aufgaben**:

| Lauf | Was man tut | Gibt es schon? |
| --- | --- | --- |
| Rennen | gegen 5 Gegner im Verkehr | ja |
| Zeitjagd | allein gegen die Uhr, Verkehr als Hindernis | ja (Zeitfahren) |
| Duell | ein Gegner mit gleich starkem Auto, 1 Runde | fast (Rennen mit 1 Gegner) |
| Überholjagd | in 3 Minuten so viele Verkehrsautos wie möglich sauber überholen, Berührung bricht die Serie | neu, klein |
| Blitzer | drei Messstellen, es zählt die Summe der Tempi | neu, klein |
| Etappe | Städtetour von Valmera nach Bergheim, einmal durch, kein Rundkurs | neu, mittel |

- **Saison:** 8 Läufe quer über Metropole, Hügelland-Runde und Städtetour. Punkte wie in der Formel.
- **Klassen nach Leistungszahl** statt Einheitsautos: Klasse C (bis LZ 450), B (bis 600), A (bis 800), S (offen).
  So kann man mit dem Lieblingsauto antreten und es bis zur Klassengrenze tunen. Wer darüber liegt, muss abrüsten
  oder aufsteigen.
- **Saisonziel der Garage:** Sieger bekommen ein Auto oder eine seltene Lackierung, nicht nur Geld.

### 3.3 Rallye: Meisterschaft

- **Aufbau:** 5 Rallyes. Jede Rallye hat 3 bis 4 Wertungsprüfungen. Es zählt die **Summe der Zeiten** (das kann
  „Ganze Rallye“ heute schon). Aus Seenland, Nebelwald und Bergpass werden mit Gegenrichtung, Tageszeit und Wetter
  eigene Rallyes mit Charakter: Schotter-Rallye, Matsch-Rallye, Asphalt-Rallye, Nacht-Rallye, Finale gemischt.
- **Punkte je Rallye:** 25 – 18 – 15 – … wie oben, dazu 5 – 4 – 3 – 2 – 1 für die letzte Prüfung („Power-Stage“).
- **Service-Park** zwischen den Prüfungen, und das ist der Kern des Rallye-Gefühls: Man hat **45 Minuten
  Service-Zeit** und verteilt sie. Reifen wählen (kostet nichts), Schäden richten (je Schaden 10 bis 30 Minuten).
  Nicht alles geht. Was man nicht richtet, fährt man mit.
- **Schaden (nur Rallye, mild):** harte Landungen, Felsen und Abflüge sammeln Schaden in drei Bereichen:
  Fahrwerk (weniger Halt nach Sprüngen), Kühler (weniger Motorkraft), Reifenschaden (ein Rad mit weniger Haftung
  bis zum Ziel der Prüfung). Höchstens −10 % je Bereich, das Auto bleibt immer fahrbar. Abschaltbar.
- **Reifenwahl** vor jeder Schleife: Schotter, Matsch oder Asphalt. Der Beifahrer sagt, wie viel Prozent
  welcher Untergrund kommt. Falsche Wahl = etwa 3 bis 5 % langsamer, nicht unfahrbar.
- **Gegner** bleiben Zeiten (wie heute). Neu: Sie haben Namen, eine Gesamtwertung über die Saison und Stärken
  („Asphalt-Spezialist“, „schnell im Matsch“), damit sich die Rangfolge von Rallye zu Rallye verschiebt.

### 3.4 Was alle Saisons teilen

- **Zwischenbildschirm nach jedem Lauf:** Ergebnis → Tabelle (mit Pfeilen: wer ist gestiegen) → „Nächster Lauf“.
- **Spannung bis zum Schluss:** Der Abstand zum Führenden steht immer oben. Vor dem Finale sagt das Spiel in
  einem Satz, was man braucht („Platz 2 reicht für den Titel“).
- **Rivale:** Der Fahrer, der in der Tabelle am nächsten ist, wird zum Rivalen (Kennzeichnung im Rennen, eigene
  Zeile im Ergebnis). Das kostet fast nichts und macht jedes Mittelfeld-Rennen wichtig.
- **Speichern** nach jedem Lauf. Abbrechen mitten im Rennen = Lauf noch einmal von vorn, ohne Strafe.

## 4. Karriere

Eine Fahrerin oder ein Fahrer, ein Name, eine Garage, ein Konto, **drei Laufbahnen**. Man darf jederzeit
zwischen den Disziplinen wechseln. Niemand muss Formel fahren, um Rallye freizuschalten.

### 4.1 Die drei Leitern

| Stufe | Formel | Supercar | Rallye |
| --- | --- | --- | --- |
| 1 Einstieg | **Formel Junior**: Rennwagen mit etwa 55 % Leistung und wenig Flügel, 4 Rennen | **Klasse C**: Falkner 9 S Allrad geschenkt, 5 Läufe | **Clubrallye**: Serien-Allradler (Sturmfalke mit 60 % Leistung), 3 kurze Rallyes |
| 2 Aufstieg | **Formel 2**: 80 % Leistung, 6 Rennen, Qualifikation | **Klasse B**: Falkner Turbo, Vento | **Landesmeisterschaft**: volles Auto, Reifenwahl und Service |
| 3 Spitze | **Königsklasse**: volles Auto, 8 Rennen, Boxenstopp, Teams | **Klasse A**: Taurino, Stallone | **Weltmeisterschaft**: 5 Rallyes, Schaden, Power-Stage |
| 4 Legende | **Titelverteidigung** mit Wunschteam und härteren Gegnern | **Klasse S**: Aurelion, Nordvind, Einladungsrennen | **Gruppe-B-Pokal**: Quadra S1, kaum Hilfen-Aufschlag, nur für Mutige |

Aufstieg: unter den **ersten drei** der Saison. Wer es nicht schafft, fährt die Saison noch einmal, behält aber
Geld, Teile und Ruf. So wird jeder irgendwann stark genug.

Die Einstiegsklassen sind langsamer und damit leichter. Das ist zugleich die Fahrschule: Stufe 1 der Formel
ist das Auto, mit dem man Bremspunkte lernt.

### 4.2 Was man verdient

- **Preisgeld** (ausgedachte Währung „Taler“ oder schlicht Euro): für Platzierung, schnellste Runde, saubere
  Rennen (keine Wandberührung), erfüllte Sponsoren-Ziele. Ausgegeben wird es für Teile und Autos.
- **Ruf** (Sterne, 0 bis 5 je Disziplin): steigt mit Erfolgen, fällt nie. Schaltet Klassen, Team-Angebote,
  Einladungsrennen und Lackierungen frei. Ruf kann man nicht kaufen.

Zwei Währungen mit klarer Rolle: Geld macht das Auto besser, Ruf öffnet Türen.

### 4.3 Formel: Teams und Verträge

- Start bei einem kleinen Team (Auto-Stärke im hinteren Drittel). Das Team gibt ein **Saisonziel**
  („Platz 8 in der Teamwertung“), das zur Stärke des Autos passt. Ziel erreicht = Bonus und bessere Angebote.
- Am Saisonende kommen **bis zu drei Angebote**, je nach Ruf und Ergebnis gegen den Teamkollegen. Besseres Team =
  besseres Auto, aber höheres Ziel. Bei einem kleinen Team zu bleiben und es groß zu machen, geht auch:
  Preisgeld fließt dort in die **Entwicklung** (dieselben sechs Bereiche wie beim Tuning, aber fürs Team-Auto).
- In der Formel gehört das Auto dem Team. Deshalb heißt Tuning hier „Entwicklung“ und wirkt auch auf den Teamkollegen.

### 4.4 Supercar: Garage

- Autos kauft man mit Preisgeld oder gewinnt sie. Jedes Auto hat seine eigenen Teile und Abstimmungen.
- **Autohaus** mit allen sieben Supercars, gesperrte mit Ruf-Stern. **Probefahrt** vor dem Kauf (eine Runde Zeitjagd).
- Verkaufen bringt 60 % des Kaufpreises und der Teile zurück. Kein Fehlkauf ist endgültig.
- Sammel-Ziel: alle sieben Autos, jedes mit einem Sieg. Dafür gibt es die goldene Lackierung.

### 4.5 Rallye: Auto und Mannschaft

- Ein Auto je Stufe, das man behält und ausbaut. Die **Mannschaft** wächst mit dem Ruf in drei Schritten:
  Mechaniker (mehr Service-Zeit: 45 → 60 → 75 Minuten), Beifahrer (genauerer Aufschrieb: Stufe 1 sagt nur
  Richtung und Schärfe, Stufe 3 auch „wird enger“, „nicht schneiden“ und Untergrund), Wetterdienst (Vorhersage
  für die Reifenwahl).
- Das macht aus Dingen, die es schon gibt (voller Aufschrieb), eine Belohnung, ohne Neues bauen zu müssen.

### 4.6 Sponsoren, Zeitung, Erfolge (wie in Powershot)

- **Sponsoren-Ziele:** je Saison drei kleine Aufgaben nach Wahl („zwei Podestplätze“, „eine Prüfung ohne
  Zurücksetzen“, „300 km/h am Blitzer“). Erfüllt = Geld, sonst nichts. Vorbild: `zieleFuer` in Powershot.
- **Zeitung:** eine Schlagzeile nach jedem Lauf, aus Bausteinen („Kessler schlägt zurück“, „Überraschung im
  Nebelwald“). Kostet wenig und macht die Welt lebendig.
- **Pokalschrank:** Pokale, Meistertitel, Bestzeiten je Strecke und Auto, Fotos vom Zieleinlauf.
- **Erfolge** quer über alle Disziplinen („100 saubere Überholmanöver“, „alle Kehren am Pass im Drift“).

### 4.7 Schwierigkeit

- Die Stärke (leicht, mittel, schwer) wählt man zu Beginn und kann sie **zwischen zwei Saisons** ändern.
- Stille Hilfe für Kinder, nur auf „leicht“: Wer drei Läufe hintereinander Letzter wird, bekommt vom Team ein
  kostenloses Teil („Der Chef hat ein neues Getriebe besorgt“). Das ist sichtbar und ehrlich, kein heimliches
  Langsamer-Machen der Gegner.
- Die Fahrhilfen (Bremshilfe, Lenkhilfe, Arcade, Traktion) bleiben frei wählbar. Wer mit wenig Hilfe gewinnt,
  bekommt einen Preisgeld-Aufschlag von 10 bis 30 %.

## 5. Menü und Bildschirme

```
Hauptmenü
├── Schnelles Rennen      (das heutige Menü, bleibt wie es ist)
├── Saison                (Disziplin → Auto → Länge → los)
└── Karriere              (Wer fährt? → Zentrale)
        Zentrale: [ Nächster Lauf ▶ ]   Werkstatt · Garage/Team · Tabelle · Zeitung · Pokale
```

- **Zentrale:** ein großer Knopf „Nächster Lauf“ mit Strecke, Variante und Empfehlung des Mechanikers.
  Darunter fünf Kacheln. Auf dem iPhone untereinander, auf iPad und Fernseher nebeneinander.
- **Werkstatt:** links das Auto in 3D zum Drehen (wie die Anprobe in Powershot), rechts Reiter „Teile“,
  „Abstimmung“, „Aussehen“. Oben Leistungszahl und die drei Balken.
- Alles muss mit Fingern, Tastatur und Controller gehen. Das Handy-Lenkrad kann im Menü blättern
  (Neigen = links/rechts, Gas = auswählen), damit man zwischen den Rennen nicht zum iPad laufen muss.

## 6. Technik

Alles ohne three.js und in node prüfbar, wie `rennen.js`, `rallye.js`, `physik.js`.

| Datei (neu) | Inhalt |
| --- | --- |
| `js/tuning.js` | `TEILE`, `SCHIEBER`, Grenzen; `mitTuning(basis, teile, abstimmung)` gibt ein neues Werte-Objekt für `neuesAuto` zurück; `leistungszahl(werte)`; `empfehlung(T, art)` |
| `js/saison.js` | `KALENDER` je Disziplin (Strecke, Variante, Art des Laufs), Punkte, Tabellen, Feld mit Stärken, `naechsterLauf`, `eintragen(ergebnis)`, `istEntschieden` |
| `js/karriere.js` | Profil, Leitern, Geld und Ruf, Garage, Teams und Angebote, Mannschaft, Sponsoren-Ziele, Zeitung, Erfolge; Speichern und Laden |
| `js/karriereansicht.js` | HTML für Zentrale, Werkstatt, Tabellen (Aussehen in `css/`) |
| `tools/karriere.mjs` | spielt ganze Karrieren mit künstlichen Fahrern verschiedener Stärke durch und prüft die Wirtschaft: Wie viele Rennen bis zum Aufstieg? Bleibt jemand stecken? Kann man sich „kaputt kaufen“? |
| `tools/tuning.mjs` | fährt jedes Auto in jeder Teile-Stufe und den Extrem-Abstimmungen durch die vorhandenen Prüfungen (Wandkontakte, Zeit neben der Straße, Rundenzeit je LZ) |

Einhängen in Vorhandenes:

- `neuesAuto(art, tempo)` bekommt die getunten Werte; `AUTOS` bleibt unangetastet (= Werkseinstellung).
- `Rennen` und `Rallye` nehmen ein fertiges Feld entgegen (Namen, Team, Stärke je Fahrer) statt es selbst zu würfeln,
  und liefern ein Ergebnis-Objekt zurück. `STAERKE` und `STAERKE_RALLYE` bleiben für das schnelle Rennen.
- Ideallinie und Tempo-Plan (`ki.js`) rechnen je Auto-Werten. Für getunte Autos müssen sie pro Lauf neu gerechnet
  werden (dauert im Moment einen Augenblick beim Laden, das passt).
- Gegenrichtung: `strecke.js` bekommt `def.rueck`, das die Eckenliste umdreht. Aufschrieb und Ideallinie
  entstehen dann von selbst neu, Schilder, Startbogen und Zuschauer-Stellen müssen geprüft werden.

Spielstand: `localStorage` unter `rennspiel.karriere.v1`, mehrere Profile („Wer fährt?“ wie in Powershot),
Sichern und Laden als Datei.

```js
{ name, staerke, geld, ruf: { formel, super, rallye },
  formel: { stufe, team, entwicklung: { motor: 2, … }, saison: { lauf, punkte, feld } },
  super:  { stufe, garage: [{ id, teile, abstimmung: { metropole: {…} }, lack }], saison },
  rallye: { stufe, auto: { id, teile, schaden }, mannschaft: { mechaniker, beifahrer, wetter }, saison },
  ziele: […], zeitung: […], pokale: […], erfolge: […] }
```

## 7. Reihenfolge

| Schritt | Inhalt | Was man danach spielen kann |
| --- | --- | --- |
| **1 Tuning** | `tuning.js`, Werkstatt mit Abstimmung und Probefahrt, alle Teile frei, Prüfwerkzeug | Abstimmen und im Zeitfahren vergleichen |
| **2 Saison** | `saison.js`, Gegenrichtung, Tabellen, Zwischenbildschirm, Rivale; Formel und Rallye zuerst (dort ist fast alles da), Supercar mit Rennen, Zeitjagd, Duell | eine Meisterschaft je Disziplin |
| **3 Karriere** | Profil, Geld und Ruf, Teile kaufen, Leitern, Garage, Team-Angebote | der lange Weg nach oben |
| **4 Würze** | Service-Park und Schaden, Überholjagd, Blitzer, Etappe, Sponsoren, Zeitung, Pokale | jede Disziplin mit eigenem Gesicht |
| **5 Ausbau** | Regen, Nacht, Boxengasse für den Rennwagen, neue Strecken, 20 Autos im Formel-Feld | |

Jeder Schritt ist für sich fertig und spielbar. Schritt 1 und 2 zusammen sind die kleinste Fassung, die sich lohnt.

## 8. Was offen ist

Kristian hat am 25.11.2026 entschieden:

1. **Eine Karriere je Profil**, mit gemeinsamem Konto für alle drei Disziplinen.
   Dann kann Rallye-Preisgeld das Supercar bezahlen, und man probiert eher alles aus.
2. **Rallye-Schaden: ja**, mild und abschaltbar (kommt erst nach der ersten Rallye-Saison).
3. **Formel-Tuning als Team-Entwicklung**, mit derselben Werkstatt-Ansicht.
4. **Rennlänge in der Karriere:** einstellbar kurz, mittel, lang; Preisgeld gleich; Standard kurz.
5. **Vorbilder im Autohaus bleiben vorerst genannt.** Das Spiel bleibt in der Familie und in TestFlight.

Geändert hat sich außerdem die Reihenfolge zum Bauen: erst Saison, dann Tuning, dann Karriere, und davor Fundament
und Spannung. Das steht in `docs/konzept_weiterentwicklung.md` (Abschnitte 6.1, 9 und 10).

Risiken:

- **Nur drei Strecken je Disziplin.** Varianten strecken das, ersetzen aber keine neuen Strecken. Die Saison
  wird sich ohne Nachschub nach zwei Durchgängen wiederholen.
- **Alle Zahlen sind geschätzt und nichts ist von Hand gefahren.** Die Wirtschaft (Preise, Preisgeld, Aufstieg)
  lässt sich mit `tools/karriere.mjs` grob einstellen, ob es *Spaß* macht, zeigt nur Spielen.
- **Tuning kann das gute Fahrgefühl verderben.** Deshalb enge Grenzen und das Prüfwerkzeug in Schritt 1,
  bevor irgendetwas davon in eine Saison kommt.
- **Größeres Formel-Feld** kostet Tempo auf dem iPad; die Zahl der Autos muss dort erst gemessen werden.
- **Menüs auf dem iPhone:** Werkstatt und Tabellen sind breit. Jede Ansicht muss hochkant mit einer Spalte gehen.
