// Rennspiel – holt echt aussehende 3D-Modelle von Poly Haven (Lizenz CC0) und macht sie klein für das iPad.
//
//   node tools/polyhaven.mjs laden    lädt die Vorlagen (glTF mit 1k-Bildern) nach quellen_modelle/polyhaven/ (kommt nicht ins Repository)
//   node tools/polyhaven.mjs bauen    macht daraus modelle/echt/<name>.glb
//   node tools/polyhaven.mjs          beides
//
// Braucht dieselben Hilfsprogramme wie tools/modelle.mjs, dazu "sharp" (verkleinert die Bilder):
//   cd ~/modell-werkzeug && npm i @gltf-transform/core@4 @gltf-transform/functions@4 meshoptimizer sharp
//   PAKETE=~/modell-werkzeug node tools/polyhaven.mjs
//
// Was passiert mit jedem Modell?
//   1. Von den Bildern bleibt nur das Farbbild ("diffuse"). Das Relief-Bild (normal) und das Bild für Glanz
//      und Schatten (arm) fallen weg – das spart viel Speicher, und aus der Entfernung sieht man den Unterschied kaum.
//   2. Das Farbbild wird auf 512 × 512 Punkte verkleinert und als JPG gespeichert.
//   3. Hat das Modell mehr Dreiecke als `hoechstens`, wird es vereinfacht.
//
// Die Modelle kommen von https://polyhaven.com (alle CC0). Quellen stehen in LIZENZEN.md.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const req = createRequire(process.env.PAKETE ? path.resolve(process.env.PAKETE, 'x.js') : import.meta.url);
const HIER = path.dirname(new URL(import.meta.url).pathname);
const QUELLE = path.resolve(HIER, '../quellen_modelle/polyhaven');
const ZIEL = path.resolve(HIER, '../modelle/echt');

// Name im Spiel ← Poly-Haven-Name; hoechstens = so viele Dreiecke darf das Modell im Spiel haben
export const LISTE = [
  { name: 'sofa', id: 'Sofa_01', hoechstens: 4200 },
  { name: 'sessel', id: 'ArmChair_01', hoechstens: 4000 },
  { name: 'beistelltisch', id: 'side_table_01', hoechstens: 2000 },
  { name: 'fernsehschrank', id: 'ClassicConsole_01', hoechstens: 4000 },
  { name: 'regal', id: 'wooden_bookshelf_worn', hoechstens: 5000 },
  { name: 'pflanze_klein', id: 'potted_plant_04', hoechstens: 3000 },
];

async function holen(url, datei) {
  if (fs.existsSync(datei)) return;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.writeFileSync(datei, Buffer.from(await r.arrayBuffer()));
}

async function laden() {
  for (const m of LISTE) {
    const info = await (await fetch(`https://api.polyhaven.com/files/${m.id}`)).json();
    const g = info.gltf['1k'].gltf;
    const ordner = path.join(QUELLE, m.id);
    await holen(g.url, path.join(ordner, path.basename(g.url)));
    for (const [rel, f] of Object.entries(g.include || {})) await holen(f.url, path.join(ordner, rel));
    console.log('geladen', m.id);
  }
}

async function bauen() {
  const { NodeIO } = req('@gltf-transform/core');
  const { prune, dedup, weld, simplify, textureCompress } = req('@gltf-transform/functions');
  const { MeshoptSimplifier } = req('meshoptimizer');
  const sharp = req('sharp');
  await MeshoptSimplifier.ready;
  const io = new NodeIO();
  fs.mkdirSync(ZIEL, { recursive: true });
  for (const m of LISTE) {
    const ordner = path.join(QUELLE, m.id);
    const datei = fs.readdirSync(ordner).find(f => f.endsWith('.gltf'));
    const doc = await io.read(path.join(ordner, datei));
    // nur das Farbbild behalten
    for (const mat of doc.getRoot().listMaterials()) {
      mat.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null);
      mat.setMetallicFactor(0).setRoughnessFactor(0.8);
    }
    await doc.transform(prune(), dedup());
    const zaehle = () => doc.getRoot().listMeshes().reduce((s, me) => s + me.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
    const vorher = zaehle();
    if (vorher > m.hoechstens) {
      await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: m.hoechstens / vorher, error: 0.01 }));
    }
    await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [512, 512], quality: 80 }), prune());
    await io.write(path.join(ZIEL, `${m.name}.glb`), doc);
    const kb = Math.round(fs.statSync(path.join(ZIEL, `${m.name}.glb`)).size / 1024);
    console.log(`${m.name.padEnd(15)} ${String(Math.round(vorher)).padStart(6)} → ${String(Math.round(zaehle())).padStart(6)} Dreiecke, ${kb} KB`);
  }
}

const was = process.argv[2];
if (!was || was === 'laden') await laden();
if (!was || was === 'bauen') await bauen();
