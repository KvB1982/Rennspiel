// Rennspiel – macht aus den Supercar-Modellen von 3D AI Studio kleine Dateien für das Spiel.
//
//   PAKETE=~/modell-werkzeug node tools/supercars.mjs            alle sechs
//   PAKETE=~/modell-werkzeug node tools/supercars.mjs falkner    nur eins
//
// Die Vorlagen (je etwa 45 MB und 1,4 Millionen Dreiecke) liegen in quellen_modelle/supercars/<id>.glb
// (kommt nicht ins Repository). Heraus kommt modelle/supercars/<id>.glb mit etwa 20.000 Dreiecken.
// Braucht dieselben Hilfsprogramme wie tools/polyhaven.mjs (gltf-transform, meshoptimizer, sharp).
//
// Was passiert mit jedem Auto?
//   1. Drehen und auf die richtige Länge bringen: vorn ist +z, die Reifen stehen auf y = 0.
//   2. Die vier Räder werden herausgeschnitten und zu eigenen Teilen (rad_vl, rad_vr, rad_hl, rad_hr).
//      So kann das Spiel sie drehen und vorn einlenken. Jedes Rad merkt sich seine Stelle am Auto.
//   3. Alles wird vereinfacht (weniger Dreiecke).
//   4. Das Farbbild wird auf 1024 × 1024 verkleinert. Der blaue Lack wird dabei „genormt“ gespeichert:
//      Jeder Lack-Bildpunkt ist grau (Glanzlicht) plus Blau (wie hell der Lack dort ist). Das Spiel tauscht
//      das Blau gegen die gewählte Lackfarbe (siehe lackMaterial in js/supercarbau.js).

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const req = createRequire(process.env.PAKETE ? path.resolve(process.env.PAKETE, 'x.js') : import.meta.url);
const HIER = path.dirname(new URL(import.meta.url).pathname);
const QUELLE = path.resolve(HIER, '../quellen_modelle/supercars');
const ZIEL = path.resolve(HIER, '../modelle/supercars');

// lang = Länge des Autos in Metern (wie in FORMEN in js/supercarbau.js: zF − zR), mitte = Mitte in z,
// vornIst = in welche Richtung die Vorlage schaut, dreiecke = so viele bleiben für die Karosserie
export const AUTOS = {
  falkner: { lang: 4.55, mitte: -0.075, vornIst: '+x', dreiecke: 16000 },
  taurino: { lang: 4.8, mitte: 0, vornIst: '+x', dreiecke: 16000 },
  stallone: { lang: 4.75, mitte: 0.075, vornIst: '+z', dreiecke: 16000 },
  aurelion: { lang: 4.6, mitte: 0, vornIst: '+x', dreiecke: 16000 },
  nordvind: { lang: 4.6, mitte: 0, vornIst: '+x', dreiecke: 18000 },
  vento: { lang: 4.55, mitte: 0.025, vornIst: '+x', dreiecke: 16000 },
};
const RAD_DREIECKE = 1400;
const LACK_MITTE = 0.5;      // so stark ist das genormte Blau bei mittlerer Helligkeit

const { Document, NodeIO } = req('@gltf-transform/core');
const { weld, simplify, prune, dedup } = req('@gltf-transform/functions');
const { MeshoptSimplifier } = req('meshoptimizer');
const sharp = req('sharp');
await MeshoptSimplifier.ready;
const io = new NodeIO();

async function bauen(id) {
  const A = AUTOS[id];
  const doc = await io.read(path.join(QUELLE, id + '.glb'));
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const P = prim.getAttribute('POSITION').getArray(), UV = prim.getAttribute('TEXCOORD_0').getArray(), I = prim.getIndices().getArray();
  const n = P.length / 3;

  // 1. drehen, Größe, Lage
  const pos = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
    if (A.vornIst === '+x') { pos[k * 3] = -z; pos[k * 3 + 2] = x; }
    else if (A.vornIst === '-x') { pos[k * 3] = z; pos[k * 3 + 2] = -x; }
    else if (A.vornIst === '-z') { pos[k * 3] = -x; pos[k * 3 + 2] = -z; }
    else { pos[k * 3] = x; pos[k * 3 + 2] = z; }
    pos[k * 3 + 1] = y;
  }
  const mm = [[1e9, -1e9], [1e9, -1e9], [1e9, -1e9]];
  for (let k = 0; k < n * 3; k++) { const a = mm[k % 3]; if (pos[k] < a[0]) a[0] = pos[k]; if (pos[k] > a[1]) a[1] = pos[k]; }
  const mal = A.lang / (mm[2][1] - mm[2][0]);
  const weg = [(mm[0][0] + mm[0][1]) / 2, mm[1][0], (mm[2][0] + mm[2][1]) / 2];
  for (let k = 0; k < n; k++) {
    pos[k * 3] = (pos[k * 3] - weg[0]) * mal; pos[k * 3 + 1] = (pos[k * 3 + 1] - weg[1]) * mal; pos[k * 3 + 2] = (pos[k * 3 + 2] - weg[2]) * mal + A.mitte;
  }
  const breit = (mm[0][1] - mm[0][0]) * mal, hoch = (mm[1][1] - mm[1][0]) * mal;

  // 2. Räder finden: Die Ecken ganz unten (am Boden) gehören zu den Reifen
  const raeder = [];
  for (const [name, sx, sz] of [['rad_vl', 1, 1], ['rad_vr', -1, 1], ['rad_hl', 1, -1], ['rad_hr', -1, -1]]) {
    let zs = 0, anz = 0, aussen = 0;
    for (let k = 0; k < n; k++) {
      const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
      if (y < 0.03 && x * sx > 0 && (z - A.mitte) * sz > 0) { zs += z; anz++; aussen = Math.max(aussen, x * sx); }
    }
    const zc = zs / anz;
    // Halbmesser: In 15 cm Höhe messen, wie weit der Reifen nach vorn und hinten reicht (eine „Sehne“ des Kreises).
    // Daraus folgt der Halbmesser: r = (c² + h²) / (2 h)
    const h = 0.15, weit = [];
    for (let k = 0; k < n; k++) {
      const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
      if (Math.abs(y - h) < 0.012 && x * sx > aussen - 0.15 && x * sx < aussen + 0.1 && Math.abs(z - zc) < 0.5) weit.push(Math.abs(z - zc));
    }
    weit.sort((p, q) => p - q);
    let c = weit[0] || 0; for (const w of weit) { if (w - c > 0.03) break; c = w; }      // bis zur ersten Lücke (dahinter kommt die Karosserie)
    const oben = (c * c + h * h) / h;
    if (process.env.ZEIGEN) console.log(name, 'Ecken', weit.length, 'erste', weit.slice(0, 3).map(v => v.toFixed(3)), 'c', c.toFixed(3), 'max', (weit.at(-1) || 0).toFixed(3));
    raeder.push({ name, sx, zc, aussen, r: oben / 2 });
  }
  // gleiche Achse = gleicher Halbmesser und gleiche Stelle (links und rechts mitteln)
  for (const [a, b] of [[0, 1], [2, 3]]) {
    const r = Math.min(Math.max(raeder[a].r, raeder[b].r, 0.3), 0.39), zc = (raeder[a].zc + raeder[b].zc) / 2, au = (raeder[a].aussen + raeder[b].aussen) / 2;
    for (const k of [a, b]) Object.assign(raeder[k], { r, zc, aussen: au });
  }
  // Dreiecke verteilen: 0 = Karosserie, 1…4 = Rad
  const TIEF = 0.34;
  const teile = [[], [], [], [], []];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const x = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, y = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, z = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
    let wo = 0;
    raeder.forEach((R, k) => {
      const xs = x * R.sx;
      if (xs > R.aussen - TIEF && Math.hypot(y - R.r, z - R.zc) < R.r * 0.985) wo = k + 1;
    });
    teile[wo].push(a, b, c);
  }

  // 3. neue Datei: Karosserie und vier Räder, jedes Teil vereinfacht
  const neu = new Document(); const puffer = neu.createBuffer();
  const szene = neu.createScene();
  const bild = await lackBild(doc.getRoot().listMaterials()[0].getBaseColorTexture().getImage());
  const tex = neu.createTexture('farbe').setImage(bild).setMimeType('image/jpeg');
  const mat = neu.createMaterial('auto').setBaseColorTexture(tex).setMetallicFactor(0).setRoughnessFactor(0.6);
  const teil = (name, idx, mitte) => {
    // nur die benutzten Ecken mitnehmen
    const neuNr = new Map(), p = [], uv = [], ix = [];
    for (const k of idx) {
      if (!neuNr.has(k)) { neuNr.set(k, p.length / 3); p.push(pos[k * 3] - mitte[0], pos[k * 3 + 1] - mitte[1], pos[k * 3 + 2] - mitte[2]); uv.push(UV[k * 2], UV[k * 2 + 1]); }
      ix.push(neuNr.get(k));
    }
    const pr = neu.createPrimitive().setMaterial(mat)
      .setAttribute('POSITION', neu.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(puffer))
      .setAttribute('TEXCOORD_0', neu.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(puffer))
      .setIndices(neu.createAccessor().setType('SCALAR').setArray(new Uint32Array(ix)).setBuffer(puffer));
    const node = neu.createNode(name).setMesh(neu.createMesh(name).addPrimitive(pr)).setTranslation(mitte);
    szene.addChild(node);
    return pr;
  };
  const prims = [[teil('koerper', teile[0], [0, 0, 0]), A.dreiecke, teile[0].length / 3]];
  raeder.forEach((R, k) => prims.push([teil(R.name, teile[k + 1], [R.sx * (R.aussen - 0.15), R.r, R.zc]), RAD_DREIECKE, teile[k + 1].length / 3]));
  await neu.transform(weld());
  for (const [pr, soll] of prims) {
    const ix = pr.getIndices().getArray(), pp = pr.getAttribute('POSITION').getArray(), uu = pr.getAttribute('TEXCOORD_0').getArray();
    // Vereinfachen mit Blick auf die Bild-Koordinaten (damit das Farbbild nicht verrutscht)
    const [aus, fehler] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(ix), pp, 3, uu, 2, [0.6, 0.6], null, soll * 3, 0.02, []);
    pr.getIndices().setArray(new Uint32Array(aus));
    pr.userData = { fehler };
  }
  await neu.transform(prune({ keepAttributes: true }), dedup());
  // unbenutzte Ecken entfernen
  for (const me of neu.getRoot().listMeshes()) for (const pr of me.listPrimitives()) {
    const ix = pr.getIndices().getArray(), pp = pr.getAttribute('POSITION').getArray(), uu = pr.getAttribute('TEXCOORD_0').getArray();
    const nr = new Map(), p = [], uv = [], i2 = new Uint32Array(ix.length);
    ix.forEach((k, j) => { if (!nr.has(k)) { nr.set(k, p.length / 3); p.push(pp[k * 3], pp[k * 3 + 1], pp[k * 3 + 2]); uv.push(uu[k * 2], uu[k * 2 + 1]); } i2[j] = nr.get(k); });
    pr.getAttribute('POSITION').setArray(new Float32Array(p)); pr.getAttribute('TEXCOORD_0').setArray(new Float32Array(uv));
    pr.getIndices().setArray(p.length / 3 < 65536 ? new Uint16Array(i2) : i2);
  }
  fs.mkdirSync(ZIEL, { recursive: true });
  const datei = path.join(ZIEL, id + '.glb');
  await io.write(datei, neu);
  const zahl = neu.getRoot().listMeshes().map(me => me.listPrimitives()[0].getIndices().getCount() / 3);
  console.log(raeder.map(R => R.r.toFixed(3)).join(' '));
  console.log(`${id.padEnd(9)} ${breit.toFixed(2)} m breit, ${hoch.toFixed(2)} m hoch · Räder r=${raeder[0].r.toFixed(2)}/${raeder[2].r.toFixed(2)} bei z=${raeder[0].zc.toFixed(2)}/${raeder[2].zc.toFixed(2)}, außen ${raeder[0].aussen.toFixed(2)}/${raeder[2].aussen.toFixed(2)} · Dreiecke ${zahl.join(' + ')} · ${Math.round(fs.statSync(datei).size / 1024)} KB`);
}

// Farbbild verkleinern und den blauen Lack genormt speichern
async function lackBild(daten) {
  const { data, info } = await sharp(daten).resize(1024, 1024).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = info.width * info.height, staerken = [];
  const lack = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const r = data[k * 3] / 255, g = data[k * 3 + 1] / 255, b = data[k * 3 + 2] / 255;
    const w = Math.min(r, g), s = b - Math.max(r, g);
    if (s > 0.02 && b > Math.max(r, g) * 1.15 && !(b < 0.4 && (b - w) / b < 0.45)) { lack[k] = 1; staerken.push(b - w); }   // bläulich, aber nicht dunkel und blass (das wäre Glas)
  }
  staerken.sort((a, b) => a - b);
  const mitte = staerken[Math.floor(staerken.length * 0.6)] || 0.5;
  for (let k = 0; k < N; k++) {
    const r = data[k * 3] / 255, g = data[k * 3 + 1] / 255, b = data[k * 3 + 2] / 255;
    if (lack[k]) {
      const w = Math.min(r, g) * 0.8, s = Math.min(1 - w, Math.max(0.28, Math.pow((b - Math.min(r, g)) / mitte, 0.6) * LACK_MITTE));   // hoch 0,6: dunkle Schatten im Bild etwas aufhellen
      data[k * 3] = data[k * 3 + 1] = Math.round(w * 255); data[k * 3 + 2] = Math.round((w + s) * 255);
    } else if (b > Math.max(r, g)) {
      // kein Lack, aber bläulich (Glas, Schatten): Blau wegnehmen, damit das Spiel es nicht umfärbt
      data[k * 3 + 2] = Math.round(Math.max(r, g) * 255);
    }
  }
  return new Uint8Array(await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 86, chromaSubsampling: '4:4:4' }).toBuffer());
}

for (const id of process.argv[2] ? [process.argv[2]] : Object.keys(AUTOS)) await bauen(id);
