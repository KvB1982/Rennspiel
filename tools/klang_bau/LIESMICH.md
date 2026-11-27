# Geräusche und Stimmen neu bauen

Alle Dateien in `sounds/` sind mit 3D AI Studio erzeugt. Die Roh-Dateien liegen nicht im Repository
(Projektdateien `rennspiel/klang_roh/`, dort steht in `urls.txt`, woher jede kam).

1. **Motoren und andere Schleifen:** Je Auto zwei Geräusche erzeugen (`generate_sound_effect`, etwa 5 Sekunden,
   gleichmäßig laufender Motor bei niedriger und bei hoher Drehzahl, ohne Gasstöße) und als `<name>_tief.wav` und
   `<name>_hoch.wav` in einen Ordner legen. Dann `python3 tools/klang_bau/schleife.py <Ordner>`.
   Das Werkzeug sucht das gleichmäßigste Stück, macht eine Schleife daraus und sagt, wie gleichmäßig sie ist.
   Neues Auto: Zeile in `MOTOREN` in `js/klang.js`.
2. **Einzelne Geräusche:** `python3 tools/klang_bau/einzeln.py <Ordner>` schneidet Stille weg und speichert MP3.
3. **Stimmen:** `stimmen.json` nennt je Stapel den Text (viele Ansagen in einem Auftrag, getrennt durch `[long pause]`)
   und die Namen der Stücke. `generate_speech` mit `language_code: de` (Beifahrer „Roger“, Sprecher „Daniel“),
   die Datei als `<stapel>.mp3` ablegen, dann `python3 tools/klang_bau/stimmen.py <Ordner>`. Es zerschneidet an den Pausen
   und bricht ab, wenn die Zahl der Stücke nicht stimmt.
4. **Prüfen:** `node tools/stimmen.mjs`.

Braucht `ffmpeg` und `numpy`. Angehört hat die Dateien noch niemand.
