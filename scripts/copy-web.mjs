// Kopiert das Spiel nach www/. Capacitor packt den Ordner www/ danach in die App.
//
// Auf der Webseite kommen three.js, PeerJS und der QR-Code aus dem Internet (jsDelivr).
// Die App soll aber auch ohne Internet laufen. Deshalb legt dieses Skript eine Kopie davon
// nach www/lib/ (aus node_modules, nach "npm install") und schreibt die Import-Map in
// www/index.html so um, dass sie dorthin zeigt.
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
// Kein sw.js nötig: in der App liegt sowieso alles auf dem Gerät.
const FILES = ['index.html', 'manifest.webmanifest', 'css', 'js', 'bilder', 'modelle', 'sounds', 'icons', 'LIZENZEN.md'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of FILES) {
  if (!existsSync(join(root, f))) throw new Error('Datei fehlt: ' + f);
  cpSync(join(root, f), join(out, f), { recursive: true });
}

// ---------------------------------------------------------------- three.js mit allen Zusätzen, die das Spiel braucht
const nm = join(root, 'node_modules');
if (!existsSync(join(nm, 'three'))) throw new Error('three.js fehlt: bitte zuerst "npm install" ausführen');
const three = join(nm, 'three');
const lib = join(out, 'lib');
mkdirSync(join(lib, 'three'), { recursive: true });
cpSync(join(three, 'build', 'three.module.js'), join(lib, 'three', 'three.module.js'));
cpSync(join(three, 'LICENSE'), join(lib, 'three', 'LICENSE'));

// Welche Dateien aus "three/addons/..." holt das Spiel? Die suchen wir in js/ und kopieren sie –
// und alles, was diese Dateien selbst wieder laden (z. B. GLTFLoader → BufferGeometryUtils).
const gesucht = new Set();
const js = join(root, 'js');
for (const f of readdirSync(js)) {
  if (!f.endsWith('.js')) continue;
  for (const m of readFileSync(join(js, f), 'utf8').matchAll(/from\s+'three\/addons\/([^']+)'/g)) gesucht.add(m[1]);
}
const jsm = join(three, 'examples', 'jsm');
const erledigt = new Set();
const zusatz = rel => {
  if (erledigt.has(rel)) return;
  erledigt.add(rel);
  const quelle = join(jsm, rel);
  const text = readFileSync(quelle, 'utf8');
  mkdirSync(dirname(join(lib, 'addons', rel)), { recursive: true });
  writeFileSync(join(lib, 'addons', rel), text);
  for (const m of text.matchAll(/(?:from|import)\s+'(\.{1,2}\/[^']+)'/g)) zusatz(relative(jsm, join(dirname(quelle), m[1])));
};
for (const g of gesucht) zusatz(g);

// PeerJS (Handy-Lenkrad über das Internet) und der QR-Code
cpSync(join(nm, 'peerjs', 'dist', 'peerjs.min.js'), join(lib, 'peerjs.min.js'));
cpSync(join(nm, 'qrcode-generator', 'qrcode.js'), join(lib, 'qrcode.js'));

// ---------------------------------------------------------------- Import-Map umschreiben
const seite = join(out, 'index.html');
let html = readFileSync(seite, 'utf8');
const vorher = html;
html = html.replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', './lib/three/three.module.js')
           .replace('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/', './lib/addons/')
           // sagt verbindung.js und spiel.js, wo PeerJS und der QR-Code liegen
           .replace('<script type="importmap">', '<script>window.RENNSPIEL_LIB = "lib/";</script>\n  <script type="importmap">');
if (html === vorher || html.includes('cdn.jsdelivr.net/npm/three')) throw new Error('Import-Map in index.html nicht gefunden – hat sich die three.js-Version geändert?');
writeFileSync(seite, html);

console.log('Spiel nach www/ kopiert: ' + FILES.length + ' Einträge, three.js mit ' + erledigt.size + ' Zusätzen, PeerJS, QR-Code.');
