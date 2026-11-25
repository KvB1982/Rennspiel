# Fahrphysik: der bisher beste Stand

Kristian am 22.11.2026: „Das Spiel macht nun so schon ziemlich viel Spaß. Bitte die Einstellungen zur Fahrphysik und
Steuerungslogik als bisher besten Modus merken für Formel 1, Supercar und Rallye.“

## Was festgehalten ist

- **Name:** `bester_2026-11-22` · Datei `docs/fahrstand/bester_2026-11-22.json`
- **Commit:** `caa6519` (Stand von `main` nach PR 29, TestFlight-Build vom 22.11.2026)
- **Inhalt der Datei:** alle Zahlen des Formel-Rennwagens, der sieben Supercars und der drei Rallyeautos
  (`AUTOS` in `js/physik.js`, `js/supercars.js`, `js/rallyeautos.js`), die Stufen fürs Neigen (`VOLL` in `js/neigung.js`)
  und ein Fingerabdruck der Dateien, in denen die Rechnung steht (Physik, Computerfahrer und Hilfen, Neigung, Eingabe, Strecke).
- **Einstellungen im Menü, mit denen das gilt** (Standard): Fahrgefühl „Arcade“, Bremshilfe an, Traktionskontrolle an,
  Lenkhilfe aus, Gas von allein aus, Lenken beim Neigen Stufe 3 (70°).

Die kleinen Autos (ferngesteuertes Auto, Drift-Rallye, Slotcar) gehören nicht dazu – an denen wird noch gearbeitet.

## Vergleichen

```bash
node tools/fahrstand.mjs          # Was ist heute anders als beim besten Stand?
```

Das Werkzeug nennt jede geänderte Zahl („falkner.arcade.frei: 0.14 → 0.2“) und jede Datei, deren Rechnung sich geändert hat.
Hinweis: `js/physik.js` und `js/strecke.js` enthalten auch die kleinen Autos. Ändert sich dort etwas, meldet das Werkzeug
die Datei, auch wenn die großen Autos gleich fahren – dann zählen die Zahlen und die Prüfwerkzeuge unten.

## Zurückholen

```bash
git checkout caa6519 -- js/physik.js js/supercars.js js/rallyeautos.js js/ki.js js/neigung.js js/eingabe.js
node tools/fahrstand.mjs          # muss wieder „genau der festgehaltene Stand“ melden (bis auf js/strecke.js, falls Strecken dazukamen)
```

Wer nur einzelne Zahlen zurückdrehen will, schreibt sie aus der JSON-Datei ab.

## Einen neuen besten Stand festhalten

```bash
node tools/fahrstand.mjs sichern bester_JJJJ-MM-TT
```

Dann `BESTER` oben in `tools/fahrstand.mjs` und diese Datei anpassen. Ein festgehaltener Stand wird nie überschrieben.

## Regeln für spätere Änderungen

- Vor und nach jeder Änderung an der Fahrphysik der großen Autos `node tools/fahrstand.mjs` laufen lassen und im PR sagen, was sich geändert hat.
- Neue Ideen möglichst als eigene, abschaltbare Werte einbauen, damit der beste Stand erreichbar bleibt.
- Die Messwerte dieses Standes stehen in `CLAUDE.md` unter „Bekannte Grenzen“ (`tools/fahrgefuehl.mjs`, `tools/bremshilfe.mjs`,
  `MENSCH=1 node tools/rallye.mjs`).

## Fahrgefühl „echter“ (seit 25.11.2026)

Der beste Stand oben gilt für das Fahrgefühl „Arcade“. Für „echter“ gibt es seit 25.11.2026 eigene Werte `echt` (Rennwagen und Supercars),
die nur ohne Arcade-Hilfe wirken. Nachmessen: `node tools/echt.mjs`. Einzelheiten stehen in `CLAUDE.md` unter „Bekannte Grenzen“.
Die Neigung der Karosserie und des Kopfes in der Kurve ist seit demselben Tag etwa halb so groß (nur Bild, keine Zahl in `AUTOS`).
