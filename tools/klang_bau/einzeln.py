# Macht aus den erzeugten einzelnen Geräuschen (3D AI Studio, generate_sound_effect) kleine MP3-Dateien für das Spiel.
# Aufruf: python3 tools/klang_bau/einzeln.py <Ordner mit den Roh-Dateien>        (braucht ffmpeg und numpy)
#
# Jede Datei <name>.wav wird: vorn und hinten an der Stille abgeschnitten, gleich laut gemacht,
# weich ein- und ausgeblendet und als sounds/<name>.mp3 gespeichert (Mono).
# "erstes": Manchmal erzeugt die KI zwei Schläge hintereinander – dann bleibt nur der erste.
import os, subprocess, sys
import numpy as np

SR = 44100
ROH = sys.argv[1]
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'sounds')
# Name → (nur das erste Ereignis?, höchstens so viele Sekunden, Sekunden Ausblenden)
LISTE = {
    'aufprall_gross': (True, 1.8, 0.25), 'aufprall_klein': (True, 0.9, 0.15), 'aufprall_plastik': (True, 0.6, 0.1),
    'landung': (True, 0.8, 0.15), 'schlagschrauber': (False, 1.0, 0.08), 'turbo': (True, 1.4, 0.3),
    'ampel': (True, 0.35, 0.05), 'start': (True, 1.0, 0.15), 'bestzeit': (False, 1.6, 0.3), 'jubel': (False, 4.0, 1.0),
}

def lade(datei):
    roh = subprocess.run(['ffmpeg', '-v', 'error', '-i', datei, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(roh, dtype=np.int16).astype(np.float32) / 32768

for name, (erstes, lang, aus) in LISTE.items():
    quelle = os.path.join(ROH, name + '.wav')
    if not os.path.exists(quelle): print(f'{name:18s} fehlt'); continue
    x = lade(quelle)
    n = SR // 100                                         # Fenster von 10 ms
    laut = np.abs(x[:len(x) // n * n]).reshape(-1, n).max(axis=1)
    da = np.where(laut > 0.04 * laut.max())[0]
    a, b = da[0], da[-1] + 1
    if erstes:
        # Ende des ersten Ereignisses: die erste Stelle, an der es 0,2 s lang fast still ist
        still = 0
        for i in range(a, b):
            still = still + 1 if laut[i] < 0.04 * laut.max() else 0
            if still >= 20: b = i - still + 1; break
    s = x[max(0, a * n - int(0.005 * SR)):min(len(x), b * n + int(0.05 * SR))][:int(lang * SR)].copy()
    s *= 0.9 / np.abs(s).max()
    ein, ausN = int(0.004 * SR), min(len(s) // 2, int(aus * SR))
    s[:ein] *= np.linspace(0, 1, ein); s[-ausN:] *= np.linspace(1, 0, ausN) ** 2
    ziel = os.path.join(ZIEL, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', '-write_xing', '0', ziel],
                   input=(s * 32767).astype(np.int16).tobytes(), check=True)
    print(f'{name:18s} {len(s) / SR:4.2f} s (von {len(x) / SR:.1f} s)  Pegel {np.sqrt((s ** 2).mean()):.3f}  {os.path.getsize(ziel) / 1024:5.1f} KB')
