# Rennspiel – kleiner Webserver zum Spielen und Entwickeln am eigenen PC.
#
#   python tools/server.py          dann im Browser http://localhost:8765 öffnen
#
# Anders als "python -m http.server" sagt dieser Server dem Browser, dass er nichts zwischenspeichern soll.
# So sieht man nach einer Änderung am Code immer sofort die neue Version (auch auf dem iPad im WLAN).

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keine Zeile pro Datei ausgeben


if __name__ == '__main__':
    print(f'Rennspiel läuft: http://localhost:{PORT}  (Strg+C beendet)')
    ThreadingHTTPServer(('', PORT), Handler).serve_forever()
