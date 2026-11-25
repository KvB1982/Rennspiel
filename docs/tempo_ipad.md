# Tempo auf iPad und iPhone

Hier steht, wie flüssig das Spiel auf den echten Geräten läuft. Gemessen wird nicht geschätzt:
Im Spiel eine Strecke mindestens 30 Sekunden fahren, in der Pause „💾 Fahrt sichern“ tippen und die Datei schicken.
`node tools/nachfahren.mjs <datei>` druckt dann die fertige Zeile für diese Tabelle.

Wer nur schauen will: Menü → „Messwerte anzeigen: an“. Dann stehen die Zahlen während der Fahrt rechts im Bild.

Ziel für Grafik „mittel“: 60 Bilder pro Sekunde bei voller Bildschärfe. Strecken, die das nicht schaffen,
bekommen einen eigenen kleinen Thread (weniger Häuser in Sichtweite, gröbere Modelle in der Ferne).

| Tag | Gerät | Strecke | Auto | Grafik | Bilder/s (von–bis) | Bildschärfe | Dreiecke bis | Zeichenaufrufe bis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| (noch keine Fahrt von einem echten Gerät) | | | | | | | | |

Hinweis: Im Stromsparmodus drosselt iOS auf 30 Bilder pro Sekunde. Dann senkt das Spiel die Bildschärfe unnötig.
Solche Fahrten nicht eintragen.
