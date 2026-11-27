# Schneidet die Stapel-Aufnahmen der Stimmen (3D AI Studio, generate_speech) in einzelne kleine MP3-Dateien.
# Aufruf: python3 tools/klang_bau/stimmen.py <Ordner mit den Roh-Dateien>        (braucht ffmpeg und numpy)
#
# Viele kurze Ansagen stehen in EINER Aufnahme, getrennt durch lange Pausen (im Text: [long pause]) – das ist viel billiger
# als eine Aufnahme je Wort (so macht es auch Powershot). Das Programm sucht die Pausen, schneidet dort, macht alle Stücke
# gleich laut und speichert sie nach sounds/stimme/<ordner>/<name>.mp3 (Mono, 24 kHz).
# Es bricht ab, wenn die Zahl der Stücke nicht zur Liste passt. Die Texte stehen in stimmen.json.
import json, os, subprocess, sys
import numpy as np

SR = 44100
ROH = sys.argv[1]
HIER = os.path.dirname(os.path.abspath(__file__))
ZIEL = os.path.join(HIER, '..', '..', 'sounds', 'stimme')

def lade(datei):
    roh = subprocess.run(['ffmpeg', '-v', 'error', '-i', datei, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(roh, dtype=np.int16).astype(np.float32) / 32768

def stuecke(x, pause=0.6, schwelle=0.012):
    # Lautstärke in Fenstern von 10 ms; ein Stück endet, wenn es länger als "pause" Sekunden still ist
    n = SR // 100
    laut = np.abs(x[:len(x) // n * n]).reshape(-1, n).max(axis=1) > schwelle
    out, start, still = [], None, 0
    for i, l in enumerate(laut):
        if l:
            if start is None: start = i
            still = 0
        elif start is not None:
            still += 1
            if still >= pause * 100: out.append((start, i - still + 1)); start = None; still = 0
    if start is not None: out.append((start, len(laut) - still))
    return [(a / 100, b / 100) for a, b in out if b - a >= 6]

def kuerzen(x, schwelle=0.012, ab=0.16, auf=0.07):
    # Pausen mitten in einer Ansage kürzen ("Ziel! … Voll durch!" → "Ziel! Voll durch!")
    n = SR // 100
    laut = np.abs(x[:len(x) // n * n]).reshape(-1, n).max(axis=1) > schwelle
    teile, i = [], 0
    while i < len(laut):
        j = i
        while j < len(laut) and laut[j] == laut[i]: j += 1
        if not laut[i] and 0 < i and j < len(laut) and (j - i) / 100 > ab:
            m = max(1, int(auf * 100) // 2)
            teile.append(x[i * n:(i + m) * n]); teile.append(x[(j - m) * n:j * n])
        else: teile.append(x[i * n:j * n])
        i = j
    return np.concatenate(teile)

plan = json.load(open(os.path.join(HIER, 'stimmen.json')))
gesamt, bericht = 0, []
for stapel in plan['stapel']:
    datei = os.path.join(ROH, stapel['datei'])
    if not os.path.exists(datei): print(stapel['datei'], 'fehlt'); continue
    x = lade(datei); s = stuecke(x, stapel.get('pause', 0.6)); namen = [n for n, _ in stapel['ansagen']]
    if len(s) != len(namen): raise SystemExit(f"{stapel['datei']}: {len(s)} Stücke gefunden, {len(namen)} Ansagen bestellt: " + ' '.join(f'{b - a:.2f}' for a, b in s))
    os.makedirs(os.path.join(ZIEL, stapel['ordner']), exist_ok=True)
    for (a, b), name in zip(s, namen):
        seg = kuerzen(x[max(0, int((a - 0.02) * SR)):int((b + 0.06) * SR)].copy())
        aktiv = seg[np.abs(seg) > 0.02]
        rms = float(np.sqrt(np.mean(aktiv ** 2))) if len(aktiv) else 0.1
        seg *= min(0.2 / rms, 0.95 / float(np.abs(seg).max()))
        f1, f2 = int(0.006 * SR), int(0.04 * SR)
        seg[:f1] *= np.linspace(0, 1, f1); seg[-f2:] *= np.linspace(1, 0, f2)
        aus = os.path.join(ZIEL, stapel['ordner'], name + '.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', '-map_metadata', '-1', '-write_xing', '0', aus],
                       input=(seg * 32767).astype(np.int16).tobytes(), check=True)
        gesamt += os.path.getsize(aus); bericht.append(f'{name} {len(seg) / SR:.2f}')
    print(stapel['datei'], '→', stapel['ordner'] + ':', '  '.join(bericht[-len(namen):]))
print(len(bericht), 'Dateien,', round(gesamt / 1024), 'KB')
