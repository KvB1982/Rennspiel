# Macht aus den erzeugten Aufnahmen (3D AI Studio, generate_sound_effect) saubere Endlos-Schleifen für das Spiel.
# Aufruf: python3 tools/klang_bau/schleife.py <Ordner mit den Roh-Dateien> [name …]        (braucht ffmpeg und numpy)
#
# Motoren: Aus <name>_tief.wav, <name>_hoch.wav, elektro.wav, slot.wav wird sounds/motor/<name>.wav.
# Andere Schleifen (SONST: Reifen, Wind, Gras, Schotter, Wasser) landen in sounds/<name>.wav.
# Alle: Mono, 32.000 Messungen pro Sekunde. Mit jeder Datei passiert:
#  1. das gleichmäßigste Stück heraussuchen (Lautstärke und Klangfarbe schwanken dort am wenigsten),
#  2. langsames Lauter- und Leiserwerden ausgleichen,
#  3. das Ende weich in den Anfang überblenden, damit man die Nahtstelle nicht hört,
#  4. alle gleich laut machen.
# Am Ende steht je Datei, wie gleichmäßig sie ist – so kann man ohne Hören sehen, ob eine Aufnahme taugt.
import os, subprocess, sys, wave
import numpy as np

SR = 32000
LANG = 2.4         # Sekunden: so lang wird eine Schleife
BLENDE = 0.35      # Sekunden: so lang wird das Ende in den Anfang überblendet
PEGEL = 0.17       # so laut (Mittelwert) ist jede Motor-Schleife
OBEN = 0.25        # mindestens so viel vom Klang soll über 300 Hz liegen (sonst hört man ihn auf kleinen Lautsprechern nicht)
ROH = sys.argv[1]
SOUNDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'sounds')
# Schleifen, die kein Motor sind: Name → Lautstärke (Mittelwert)
SONST = { 'reifen_quietschen': 0.12, 'wind': 0.1, 'gras': 0.1, 'schotter': 0.1, 'wasser': 0.1 }

def lade(datei):
    roh = subprocess.run(['ffmpeg', '-v', 'error', '-i', datei, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(roh, dtype=np.int16).astype(np.float32) / 32768

def fenster(x, n):
    # Lautstärke und Klang-Schwerpunkt in Fenstern von n Messungen
    k = len(x) // n; f = x[:k * n].reshape(k, n)
    laut = np.sqrt((f ** 2).mean(axis=1))
    sp = np.abs(np.fft.rfft(f * np.hanning(n), axis=1)); fr = np.fft.rfftfreq(n, 1 / SR)
    return laut, (sp * fr).sum(axis=1) / (sp.sum(axis=1) + 1e-9)

def oben(s):
    # Anteil des Klangs über 300 Hz
    f = np.abs(np.fft.rfft(s)) ** 2; fr = np.fft.rfftfreq(len(s), 1 / SR)
    return f[fr >= 300].sum() / f.sum()

def bauen(name):
    motor = name not in SONST
    PEGEL = 0.17 if motor else SONST[name]
    ZIEL = os.path.join(SOUNDS, 'motor') if motor else SOUNDS
    x = lade(os.path.join(ROH, name + '.wav'))
    x = x - x.mean()
    n = SR // 20                                   # 50 ms
    laut, farbe = fenster(x, n)
    brauch = int((LANG + BLENDE) * 20)             # so viele Fenster braucht die Schleife samt Überblendung
    if len(laut) < brauch: raise SystemExit(name + ': Aufnahme zu kurz')
    best, wo = 1e9, 0
    for i in range(0, len(laut) - brauch + 1):
        l, f = laut[i:i + brauch], farbe[i:i + brauch]
        unruhe = l.std() / (l.mean() + 1e-9) + f.std() / (f.mean() + 1e-9) + (1 if l.min() < 0.3 * laut.max() * 0.5 else 0)
        if unruhe < best: best, wo = unruhe, i
    s = x[wo * n:(wo * n) + int((LANG + BLENDE) * SR)].copy()
    # langsames An- und Abschwellen ausgleichen (höchstens Faktor 2)
    m = SR // 4
    huelle = np.sqrt(np.convolve(s ** 2, np.ones(m) / m, mode='same')) + 1e-6
    s *= np.clip(huelle.mean() / huelle, 0.5, 2.0)
    # Ende in den Anfang überblenden (gleich laut bleibt es mit Sinus und Kosinus)
    b = int(BLENDE * SR); t = np.linspace(0, np.pi / 2, b)
    kopf = s[:b] * np.sin(t) + s[-b:] * np.cos(t)
    s = np.concatenate([kopf, s[b:-b]])
    s *= PEGEL / np.sqrt((s ** 2).mean())
    # Tiefes Brummen (fast alles unter 300 Hz) hört man auf den kleinen Lautsprechern von iPad und iPhone kaum.
    # Dann wird die Welle "eckig" gemacht (Verzerrung): Aus dem tiefen Ton entstehen zusätzliche höhere Töne (Obertöne),
    # so wie ein echter Motor nicht summt, sondern knattert. Höchstens drei Stufen, sonst klingt es nur noch kratzig.
    roh, staerke = s.copy(), 0
    while motor and name not in ('elektro', 'slot') and oben(s) < OBEN and staerke < 3:
        staerke += 1
        z = roh / PEGEL * 0.6 * 2 ** staerke
        s = 0.3 * roh + PEGEL * (np.tanh(z) + 0.35 * (np.abs(np.tanh(z * 0.7)) - 0.5))
        s -= s.mean(); s *= PEGEL / np.sqrt((s ** 2).mean())
    s = np.tanh(s * 1.2) / 1.2                     # Spitzen sanft abrunden statt abschneiden
    os.makedirs(ZIEL, exist_ok=True)
    with wave.open(os.path.join(ZIEL, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((s * 32767).astype(np.int16).tobytes())
    l2, f2 = fenster(s, n)
    # Naht prüfen: Sprung zwischen letzter und erster Messung im Vergleich zu einem normalen Schritt
    naht = abs(s[0] - s[-1]) / (np.abs(np.diff(s)).mean() + 1e-9)
    print(f'{name:18s} ab {wo * n / SR:4.2f} s  {len(s) / SR:.2f} s  Pegel ±{100 * l2.std() / l2.mean():3.0f} %  Klangfarbe {f2.mean():5.0f} Hz ±{100 * f2.std() / f2.mean():3.0f} %  Naht {naht:4.1f}  Spitze {np.abs(s).max():.2f}  über 300 Hz {100 * oben(s):3.0f} %' + (f'  (Obertöne dazu, Stufe {staerke})' if staerke else ''))

namen = sys.argv[2:] or sorted(f[:-4] for f in os.listdir(ROH) if f.endswith('.wav') and (f.endswith('_tief.wav') or f.endswith('_hoch.wav') or f[:-4] in ('elektro', 'slot') or f[:-4] in SONST))
for name in namen: bauen(name)
