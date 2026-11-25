# Tempo auf iPad und iPhone

Hier steht, wie flüssig das Spiel auf den echten Geräten läuft. Gemessen wird nicht geschätzt:
Im Spiel eine Strecke mindestens 30 Sekunden fahren, in der Pause „💾 Fahrt sichern“ tippen und die Datei schicken.
`node tools/nachfahren.mjs <datei>` druckt dann die fertige Zeile für diese Tabelle.

Wer nur schauen will: Menü → „Messwerte anzeigen: an“. Dann stehen die Zahlen während der Fahrt rechts im Bild.

Ziel für Grafik „mittel“: 60 Bilder pro Sekunde bei voller Bildschärfe. Strecken, die das nicht schaffen,
bekommen einen eigenen kleinen Thread (weniger Häuser in Sichtweite, gröbere Modelle in der Ferne).

| Tag | Gerät | Strecke | Auto | Grafik | Bilder/s (von–bis) | Bildschärfe | Dreiecke bis | Zeichenaufrufe bis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-25 | iPad 1366×1024 (App) | Metropole Valmera, Verkehr normal | taurino | hoch | 60 (57–60) | 2–2 | 827.040 | 406 |
| 2026-11-25 | iPad 1366×1024 (App) | Metropole Valmera, ohne Verkehr | taurino | hoch | 59 (55–60) | 2–2 | 679.571 | 397 |
| 2026-11-25 | iPad 1366×1024 (App) | Bergwald-Ring | f1 | hoch | 55 (48–60) | 1.75–2 | 525.696 | 411 |
| 2026-11-25 | iPad 1366×1024 (App) | Bergwald-Ring | f1 | hoch | 60 (60–60) | 1–1 (siehe unten) | 523.256 | 411 |
| 2026-11-25 | iPad 1366×1024 (App) | WP 1 · Seenland-Sprünge | sturmfalke | hoch | 60 (60–60) | 1–1 (siehe unten) | 659.745 | 73 |
| 2026-11-25 | iPad 1366×1024 (App) | WP 1 · Seenland-Sprünge | sturmfalke | hoch | 60 (59–60) | 1–1 (siehe unten) | 638.092 | 257 |

Zu den Zeilen mit Bildschärfe 1: In der ersten Formel-Fahrt ruckelte es kurz (52 bis 58 Bilder/s), die Bildschärfe
sank und kam an dem Abend nicht mehr hoch, obwohl das iPad danach glatte 60 Bilder schaffte. Seit 26.11.2026 fängt
jede Strecke wieder mit voller Bildschärfe an (`laden` in `js/szene.js`). Diese drei Zeilen sagen deshalb nichts
darüber, ob die Strecken bei voller Schärfe 60 Bilder schaffen – bitte noch einmal messen.
Alle sechs Fahrten: Handy als Lenkrad, Kamera Cockpit (Rallye: hinten).

Hinweis: Im Stromsparmodus drosselt iOS auf 30 Bilder pro Sekunde. Dann senkt das Spiel die Bildschärfe unnötig.
Solche Fahrten nicht eintragen.
