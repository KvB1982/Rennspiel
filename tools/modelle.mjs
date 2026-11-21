// Rennspiel – holt freie 3D-Modelle (CC0) und macht sie klein und einfach für das Spiel.
//
//   node tools/modelle.mjs laden      lädt die Vorlagen in den Ordner quellen_modelle/ (kommt nicht ins Repository)
//   node tools/modelle.mjs bauen      macht daraus die Dateien in modelle/
//   node tools/modelle.mjs            beides
//
// Braucht ein paar Hilfsprogramme, die nicht im Repository liegen. Einmal in einem eigenen Ordner installieren:
//   mkdir ~/modell-werkzeug && cd ~/modell-werkzeug && npm i @gltf-transform/core@4 @gltf-transform/functions@4 meshoptimizer pngjs
// und dann so starten:  PAKETE=~/modell-werkzeug node tools/modelle.mjs
//
// Was passiert mit jedem Modell?
//   1. Die Farben kommen aus Materialien oder aus einem kleinen Farbbild (Kenney malt mit einer Farbpalette).
//      Wir lesen für jede Ecke die Farbe aus und schreiben sie direkt an die Ecke ("Eckfarbe"). Danach braucht
//      das Modell kein Bild mehr.
//   2. Die Teile werden nach Aufgabe sortiert: zum Beispiel "lack" (bekommt im Spiel die Lackfarbe) und "rest",
//      oder "krone" und "stamm" beim Baum. So kann das Spiel jedes Auto anders anmalen.
//   3. Gleiche Ecken werden zusammengelegt und das Modell wird vereinfacht (weniger Dreiecke = schneller auf dem iPad).
//   4. Normalen und Bild-Koordinaten fallen weg: das Spiel malt die Modelle "kantig" (flatShading), wie bei Kenney gedacht.
//
// Alle Vorlagen sind von Kenney (www.kenney.nl), Lizenz CC0. Geladen über die Sammlung "jam-ready-assets"
// auf GitHub, die jedes Paket mit seiner Lizenzdatei aufbewahrt (die Seiten kenney.nl und itch.io sind im
// Test-Rechner gesperrt). Quellen stehen in LIZENZEN.md.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const req = createRequire(process.env.PAKETE ? path.resolve(process.env.PAKETE, 'x.js') : import.meta.url);
const HIER = path.dirname(new URL(import.meta.url).pathname);
const QUELLE = path.resolve(HIER, '../quellen_modelle');
const ZIEL = path.resolve(HIER, '../modelle');

const SAMMLUNG = 'https://media.githubusercontent.com/media/series-ai/jam-ready-assets/main/';
const SAMMLUNG_TEXT = 'https://raw.githubusercontent.com/series-ai/jam-ready-assets/main/';

// Die Pakete: Ordner in der Sammlung, Unterordner der Modelle, Lizenzdatei
const PAKETE = {
  auto: { ordner: 'kenney-car-kit/3D/vehicles-racing', modelle: 'Models/GLB format', bild: 'Models/GLB format/Textures/colormap.png' },
  moebel: { ordner: 'kenney-furniture-kit/3D/interior-furniture', modelle: 'Models/GLTF format' },
  natur: { ordner: 'kenney-nature-kit/3D/nature', modelle: 'Models/GLTF format' },
  rennen: { ordner: 'kenney-racing-kit/3D/vehicles-racing', modelle: 'Models/GLTF format' },
  dorf: { ordner: 'kenney-city-kit-suburban/3D/city', modelle: 'Models/GLB format', bild: 'Models/GLB format/Textures/colormap.png' },
};

// Welche Modelle wir nehmen: Name im Spiel ← Paket und Datei; art sagt, wie die Teile sortiert werden;
// anteil = so viel der Dreiecke bleibt übrig (1 = alle)
export const LISTE = [
  // Verkehr (Car Kit)
  { name: 'auto_kompakt', paket: 'auto', datei: 'hatchback-sports', art: 'auto' },
  { name: 'auto_limousine', paket: 'auto', datei: 'sedan', art: 'auto' },
  { name: 'auto_gelaende', paket: 'auto', datei: 'suv', art: 'auto' },
  { name: 'auto_transporter', paket: 'auto', datei: 'van', art: 'auto' },
  { name: 'auto_lkw', paket: 'auto', datei: 'delivery', art: 'auto' },
  // Wohnzimmer (Furniture Kit)
  { name: 'sofa', paket: 'moebel', datei: 'loungeSofa', art: 'moebel' },
  { name: 'sessel', paket: 'moebel', datei: 'loungeChair', art: 'moebel' },
  { name: 'fernsehschrank', paket: 'moebel', datei: 'cabinetTelevisionDoors', art: 'moebel' },
  { name: 'fernseher', paket: 'moebel', datei: 'televisionModern', art: 'moebel' },
  { name: 'pflanze', paket: 'moebel', datei: 'pottedPlant', art: 'moebel' },
  { name: 'pflanze_klein', paket: 'moebel', datei: 'plantSmall2', art: 'moebel' },
  { name: 'regal', paket: 'moebel', datei: 'bookcaseOpen', art: 'moebel' },
  { name: 'stehlampe', paket: 'moebel', datei: 'lampRoundFloor', art: 'moebel' },
  { name: 'lautsprecher', paket: 'moebel', datei: 'speaker', art: 'moebel' },
  { name: 'radio', paket: 'moebel', datei: 'radio', art: 'moebel' },
  // Bäume (Nature Kit)
  { name: 'baum_tanne', paket: 'natur', datei: 'tree_pineTallA', art: 'baum' },
  { name: 'baum_laub', paket: 'natur', datei: 'tree_default', art: 'baum' },
  { name: 'baum_zypresse', paket: 'natur', datei: 'tree_tall', art: 'baum' },
  // Rennstrecke (Racing Kit)
  { name: 'zelt', paket: 'rennen', datei: 'tent', art: 'zelt' },
  { name: 'zelt_lang', paket: 'rennen', datei: 'tentLong', art: 'zelt' },
  { name: 'flutlicht', paket: 'rennen', datei: 'lightPostLarge', art: 'deko' },
  { name: 'fahne_ziel', paket: 'rennen', datei: 'flagCheckers', art: 'deko' },
  { name: 'tv_kamera', paket: 'rennen', datei: 'camera_exclusive', art: 'deko' },
  { name: 'fahnenturm', paket: 'rennen', datei: 'bannerTowerRed', art: 'zelt' },
  // Dorfhäuser (City Kit Suburban)
  ...['a', 'g', 'h', 'i', 'm', 'q'].map(b => ({ name: 'haus_' + b, paket: 'dorf', datei: 'building-type-' + b, art: 'haus' })),
];

// ---------------------------------------------------------------- laden

async function holen(url, datei) {
  if (fs.existsSync(datei)) return;
  const a = await fetch(url);
  if (!a.ok) throw new Error(url + ' → ' + a.status);
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.writeFileSync(datei, Buffer.from(await a.arrayBuffer()));
  console.log('geladen', path.relative(QUELLE, datei));
}
async function laden() {
  for (const [p, P] of Object.entries(PAKETE)) {
    await holen(SAMMLUNG_TEXT + encodeURI(P.ordner + '/License.txt'), path.join(QUELLE, p, 'License.txt'));
    if (P.bild) await holen(SAMMLUNG + encodeURI(P.ordner + '/' + P.bild), path.join(QUELLE, p, 'Textures/colormap.png'));
  }
  for (const m of LISTE) {
    const P = PAKETE[m.paket];
    await holen(SAMMLUNG + encodeURI(`${P.ordner}/${P.modelle}/${m.datei}.glb`), path.join(QUELLE, m.paket, m.datei + '.glb'));
  }
}

// ---------------------------------------------------------------- bauen

const linear = c => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

// Matrizen (4×4, Spalten zuerst wie in glTF)
function mal(a, b) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return o;
}

// Weniger Dreiecke: erst nur nach der Lage zusammenlegen (die Farbe stört dabei nicht), dann vereinfachen,
// danach bekommt jedes neue Dreieck die Farbe des alten Dreiecks, das ihm am nächsten liegt.
function vereinfache(liste, anteil, fehler, S) {
  const ecken = new Map(), pos = [], idx = [];
  for (const d of liste) for (let e = 0; e < 3; e++) {
    const p = d.p.slice(e * 3, e * 3 + 3), k = p.map(v => Math.round(v * 1e4)).join(',');
    if (!ecken.has(k)) { ecken.set(k, pos.length / 3); pos.push(...p); }
    idx.push(ecken.get(k));
  }
  const [neu] = S.simplify(new Uint32Array(idx), new Float32Array(pos), 3, Math.floor(idx.length * anteil / 3) * 3, fehler, []);
  const mitte = d => [0, 1, 2].map(a => (d.p[a] + d.p[a + 3] + d.p[a + 6]) / 3);
  const alt = liste.map(mitte);
  const aus = [];
  for (let k = 0; k < neu.length; k += 3) {
    const d = { p: [] };
    for (let e = 0; e < 3; e++) d.p.push(pos[neu[k + e] * 3], pos[neu[k + e] * 3 + 1], pos[neu[k + e] * 3 + 2]);
    const c = mitte(d);
    let best = 0, bd = Infinity;
    alt.forEach((a, j) => { const q = (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2 + (a[2] - c[2]) ** 2; if (q < bd) { bd = q; best = j; } });
    const o = liste[best];
    d.c = o.c; d.ec = [];
    // jede Ecke nimmt die Farbe der nächsten Ecke des alten Dreiecks
    for (let e = 0; e < 3; e++) {
      let be = 0, bq = Infinity;
      for (let f = 0; f < 3; f++) { const q = (o.p[f * 3] - d.p[e * 3]) ** 2 + (o.p[f * 3 + 1] - d.p[e * 3 + 1]) ** 2 + (o.p[f * 3 + 2] - d.p[e * 3 + 2]) ** 2; if (q < bq) { bq = q; be = f; } }
      d.ec.push(...o.ec.slice(be * 3, be * 3 + 3));
    }
    aus.push(d);
  }
  return aus;
}

async function bauen() {
  const { NodeIO, Document } = req('@gltf-transform/core');
  const { weld, dedup, prune } = req('@gltf-transform/functions');
  const { MeshoptSimplifier } = req('meshoptimizer');
  const { PNG } = req('pngjs');
  await MeshoptSimplifier.ready;
  const io = new NodeIO();
  fs.mkdirSync(ZIEL, { recursive: true });
  const bilder = {};
  const bildVon = p => {
    if (!(p in bilder)) { const f = path.join(QUELLE, p, 'Textures/colormap.png'); bilder[p] = fs.existsSync(f) ? PNG.sync.read(fs.readFileSync(f)) : null; }
    return bilder[p];
  };
  const bericht = [];
  for (const m of LISTE) {
    const doc = await io.read(path.join(QUELLE, m.paket, m.datei + '.glb'));
    const bild = bildVon(m.paket);
    // alle Dreiecke mit Farbe und Material-Namen einsammeln
    const dreiecke = [];   // { p: [9 Zahlen], c: [3 Zahlen], mat }
    const besuche = (node, M) => {
      const W = mal(M, node.getMatrix());
      const mesh = node.getMesh();
      if (mesh) for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
        const mat = prim.getMaterial();
        const grund = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
        const mitBild = mat && mat.getBaseColorTexture() && bild && uv;
        const n = idx ? idx.getCount() : pos.getCount();
        const p = [0, 0, 0], t = [0, 0];
        for (let k = 0; k < n; k += 3) {
          // ec = Farbe an jeder der drei Ecken (Kenney-Farbbilder haben leichte Verläufe), c = Mittel davon
          const d = { p: [], ec: [], c: [0, 0, 0], mat: mat ? mat.getName() : '', knoten: node.getName() };
          for (let e = 0; e < 3; e++) {
            const v = idx ? idx.getScalar(k + e) : k + e;
            pos.getElement(v, p);
            d.p.push(W[0] * p[0] + W[4] * p[1] + W[8] * p[2] + W[12], W[1] * p[0] + W[5] * p[1] + W[9] * p[2] + W[13], W[2] * p[0] + W[6] * p[1] + W[10] * p[2] + W[14]);
            let c = [grund[0], grund[1], grund[2]];
            if (mitBild) {
              uv.getElement(v, t);
              const x = Math.min(bild.width - 1, Math.max(0, Math.floor((t[0] - Math.floor(t[0])) * bild.width)));
              const y = Math.min(bild.height - 1, Math.max(0, Math.floor((t[1] - Math.floor(t[1])) * bild.height)));
              const o = (y * bild.width + x) * 4;
              c = [linear(bild.data[o]), linear(bild.data[o + 1]), linear(bild.data[o + 2])];
            }
            d.ec.push(...c);
            for (let a = 0; a < 3; a++) d.c[a] += c[a] / 3;
          }
          dreiecke.push(d);
        }
      }
      for (const kind of node.listChildren()) besuche(kind, W);
    };
    const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    for (const node of doc.getRoot().getDefaultScene().listChildren()) besuche(node, I);

    // Farbe → Schlüssel; Fläche je Farbe (um Lack, Dach, Wand zu finden)
    const schl = c => c.map(v => Math.round(v * 40)).join(',');
    const flaeche = d => { const [a, b, c] = [0, 3, 6].map(o => d.p.slice(o, o + 3)); const u = b.map((v, i) => v - a[i]), w = c.map((v, i) => v - a[i]); return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2; };
    const satt = c => { const mx = Math.max(...c), mn = Math.min(...c); return mx > 0 ? (mx - mn) / mx : 0; };
    const ton = c => { const [r, g, b] = c, mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); return ((h / 6) % 1 + 1) % 1; };
    const nahTon = (a, b) => { const d = Math.abs(ton(a) - ton(b)); return Math.min(d, 1 - d) < 0.05; };
    const vonSchl = k => k.split(',').map(v => v / 40);
    const meiste = filter => {
      const f = new Map();
      for (const d of dreiecke) if (filter(d)) f.set(schl(d.c), (f.get(schl(d.c)) || 0) + flaeche(d));
      return [...f.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    let teilVon;
    if (m.art === 'auto') {
      // Lack = die häufigste kräftige Farbe am Körper
      const lack = meiste(d => d.knoten === 'body' && satt(d.c) > 0.35 && Math.max(...d.c) > 0.08);
      if (process.env.ZEIGEN) console.log(m.name, 'Lack', lack);
      const L = vonSchl(lack);
      teilVon = d => d.knoten === 'body' && satt(d.c) > 0.35 && nahTon(d.c, L) ? 'lack' : 'rest';
    } else if (m.art === 'baum') teilVon = d => /leaf/i.test(d.mat) ? 'krone' : 'stamm';
    else if (m.art === 'moebel') teilVon = d => /carpet/i.test(d.mat) ? 'stoff' : 'rest';
    else if (m.art === 'zelt') teilVon = d => /red|grass/i.test(d.mat) ? 'stoff' : 'rest';
    else if (m.art === 'haus') {
      const dach = meiste(d => d.c[1] > d.c[0] * 1.5 && d.c[1] > d.c[2] * 1.2);
      const wand = meiste(d => satt(d.c) < 0.12 && Math.min(...d.c) > 0.45);
      const D = vonSchl(dach);
      teilVon = d => satt(d.c) > 0.35 && nahTon(d.c, D) ? 'dach' : satt(d.c) < 0.12 && Math.min(...d.c) > 0.35 ? 'wand' : 'rest';
    } else teilVon = () => 'rest';
    // Teile, die das Spiel anmalt, bekommen weiße Eckfarben (die Farbe kommt im Spiel dazu), die Helligkeit bleibt
    const weiss = { lack: 1, stoff: 1, krone: 1, dach: 1, wand: 1 };

    // neues, schlankes Modell schreiben
    const neu = new Document();
    const puffer = neu.createBuffer();
    const szene = neu.createScene();
    const teile = {};
    for (const d of dreiecke) (teile[teilVon(d)] ||= []).push(d);
    if (m.anteil && m.anteil < 1) for (const t in teile) teile[t] = vereinfache(teile[t], m.anteil, m.fehler || 0.02, MeshoptSimplifier);
    let summe = 0;
    for (const [teil, liste] of Object.entries(teile)) {
      const pos = new Float32Array(liste.length * 9), col = new Uint8Array(liste.length * 9);   // Farben als Zahlen 0…255 (spart Platz)
      // Teile, die im Spiel angemalt werden: nur die Helligkeit behalten (hellste Stelle = weiß)
      const hell = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      let ref = 0;
      if (weiss[teil]) for (const d of liste) for (let e = 0; e < 3; e++) ref = Math.max(ref, hell(d.ec.slice(e * 3, e * 3 + 3)));
      liste.forEach((d, k) => {
        pos.set(d.p, k * 9);
        for (let e = 0; e < 3; e++) {
          let c = d.ec.slice(e * 3, e * 3 + 3);
          if (weiss[teil]) { const h = Math.min(1, 0.5 + 0.5 * hell(c) / (ref || 1)); c = [h, h, h]; }
          col.set(c.map(v => Math.round(Math.min(1, v) * 255)), k * 9 + e * 3);
        }
      });
      const prim = neu.createPrimitive()
        .setAttribute('POSITION', neu.createAccessor().setType('VEC3').setArray(pos).setBuffer(puffer))
        .setAttribute('COLOR_0', neu.createAccessor().setType('VEC3').setArray(col).setNormalized(true).setBuffer(puffer))
        .setMaterial(neu.createMaterial(teil));
      const mesh = neu.createMesh(teil).addPrimitive(prim);
      szene.addChild(neu.createNode(teil).setMesh(mesh));
    }
    await neu.transform(weld(), dedup(), prune());
    for (const mesh of neu.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) summe += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
    const datei = path.join(ZIEL, m.name + '.glb');
    await io.write(datei, neu);
    bericht.push(`${m.name.padEnd(18)} ${String(dreiecke.length).padStart(5)} → ${String(summe).padStart(5)} Dreiecke  ${(fs.statSync(datei).size / 1024).toFixed(0).padStart(4)} KB  Teile: ${Object.keys(teile).join(', ')}`);
  }
  console.log(bericht.join('\n'));
  const gesamt = fs.readdirSync(ZIEL).filter(f => f.endsWith('.glb')).reduce((s, f) => s + fs.statSync(path.join(ZIEL, f)).size, 0);
  console.log(`zusammen ${(gesamt / 1024).toFixed(0)} KB in ${path.relative(process.cwd(), ZIEL)}/`);
}

const was = process.argv[2];
if (!was || was === 'laden') await laden();
if (!was || was === 'bauen') await bauen();
