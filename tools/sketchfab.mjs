// Rennspiel – macht aus einem freien Auto-Modell mit vielen Materialien (z. B. von Sketchfab) eine kleine Datei
// im selben Aufbau wie die Supercars aus 3D AI Studio (siehe tools/supercars.mjs):
//   koerper + rad_vl, rad_vr, rad_hl, rad_hr, ein Farbbild, der Lack blau „genormt“.
//
//   PAKETE=~/modell-werkzeug node tools/sketchfab.mjs falkner_s
//
// Die Vorlage liegt in quellen_modelle/supercars/<id>.glb (kommt nicht ins Repository). Lizenz und Urheber
// stehen in LIZENZEN.md. Braucht dieselben Hilfsprogramme wie tools/supercars.mjs (gltf-transform, meshoptimizer, sharp).
//
// Was passiert?
//   1. Jedes Teil der Vorlage kommt mit seiner Lage ins Auto. Teile mit Marken-Zeichen (Logo, Schriftzug, Nummernschild)
//      und die durchsichtige Glanzschicht über dem Lack fliegen raus.
//   2. Jedes Material bekommt im Farbbild ein Feld mit seiner Farbe (Lack = blau, siehe lackMaterial in js/automodelle.js).
//      Nur die Rückleuchten behalten ihr Bild (rechte Hälfte des Farbbilds), Schriftzüge darin werden schwarz übermalt.
//   3. Drehen, auf die richtige Länge bringen, auf den Boden stellen.
//   4. Die Räder sind in der Vorlage eigene Teile: Sie werden links/rechts getrennt und zu rad_vl … rad_hr.
//   5. Jedes Teil wird für sich vereinfacht (weniger Dreiecke).

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const req = createRequire(process.env.PAKETE ? path.resolve(process.env.PAKETE, 'x.js') : import.meta.url);
const HIER = path.dirname(new URL(import.meta.url).pathname);

// Farben je Material der Vorlage: [r, g, b] von 0 bis 1, 'lack' = Lackfarbe, 'bild' = Bild der Vorlage behalten, null = weglassen
const AUTOS = {
  falkner_s: {
    datei: 'falkner_s.glb', lang: 4.52, mitte: 0, vornIst: '+z', dreiecke: 16000, radDreiecke: 1400,
    vorn: 'Cylinder.001', hinten: 'Cylinder.000',          // die beiden Rad-Gruppen der Vorlage (vorn sind sie eingelenkt)
    weg: ['boot.003', 'boot.007', 'Plane.005', 'Plane.006', 'Plane'],   // Schriftzug, Wappen, zwei Nummernschilder, Schatten-Fläche
    farben: {
      paint: 'lack', coat: null, logo: null, license: null, Material: null,
      full_black: [0.02, 0.02, 0.02], plastic: [0.05, 0.05, 0.05], silver: [0.62, 0.62, 0.64], rubber: [0.07, 0.07, 0.07],
      'Material.001': [0.85, 0.42, 0.05], window: [0.03, 0.04, 0.045], glass: [0.5, 0.52, 0.55], lights: [0.85, 0.85, 0.82],
      tex_shiny: 'bild',
    },
    // Im Bild der Rückleuchten stehen Wappen und Schriftzug: dieses Rechteck (u0, v0, u1, v1) wird schwarz
    schwarz: [0.14, 0, 1, 0.62],
  },
};

const { Document, NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const { weld, prune, dedup } = req('@gltf-transform/functions');
const { MeshoptSimplifier } = req('meshoptimizer');
const sharp = req('sharp');
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const BILD = 1024, FELD = 64;     // Farbbild 1024 × 1024, links Farbfelder von je 64 × 64, rechts das Bild der Rückleuchten (512 × 512)
const LACK = [0.1, 0.1, 0.5];   // Lack: wenig Grau, viel Blau (wie die genormten Bilder der anderen Supercars)

async function bauen(id) {
  const A = AUTOS[id];
  const doc = await io.read(path.resolve(HIER, '../quellen_modelle/supercars', A.datei));

  // 1. + 2. Farbfelder verteilen
  const felder = new Map();       // Material → [u, v] Mitte des Farbfelds
  const pixel = Buffer.alloc(BILD * BILD * 3);
  let nr = 0;
  for (const [name, f] of Object.entries(A.farben)) {
    if (!f || f === 'bild') continue;
    const c = f === 'lack' ? LACK : f;
    const fx = (nr % 8) * FELD, fy = Math.floor(nr / 8) * FELD; nr++;
    for (let y = fy; y < fy + FELD; y++) for (let x = fx; x < fx + FELD; x++) for (let k = 0; k < 3; k++) pixel[(y * BILD + x) * 3 + k] = Math.round(c[k] * 255);
    felder.set(name, [(fx + FELD / 2) / BILD, (fy + FELD / 2) / BILD]);
  }
  // Bild der Rückleuchten in die rechte Hälfte (Blau wegnehmen, damit es nicht als Lack gilt; Schriftzüge schwarz)
  let bildMat = null;
  for (const m of doc.getRoot().listMaterials()) if (A.farben[m.getName()] === 'bild') bildMat = m;
  if (bildMat) {
    const H = BILD / 2;
    const { data } = await sharp(Buffer.from(bildMat.getBaseColorTexture().getImage())).resize(H, H).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const [u0, v0, u1, v1] = A.schwarz;
    for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) {
      let r = data[(y * H + x) * 3], g = data[(y * H + x) * 3 + 1], b = data[(y * H + x) * 3 + 2];
      if (x / H >= u0 && x / H <= u1 && y / H >= v0 && y / H <= v1) r = g = b = 8;
      b = Math.min(b, Math.max(r, g));
      const o = (y * BILD + H + x) * 3; pixel[o] = r; pixel[o + 1] = g; pixel[o + 2] = b;
    }
  }

  // Alle Dreiecke sammeln: Lage in der Welt, Bild-Koordinate, Gruppe (Karosserie oder Rad)
  const stuecke = [];   // { gruppe: 'koerper' | 'vorn' | 'hinten', pos: [], uv: [], ix: [] }
  for (const n of doc.getRoot().listNodes()) {
    const me = n.getMesh(); if (!me) continue;
    const knoten = n.getName().replace(/_\d+$/, '');
    if (A.weg.includes(knoten)) continue;
    const gruppe = knoten === A.vorn ? 'vorn' : knoten === A.hinten ? 'hinten' : 'koerper';
    const M = n.getWorldMatrix();
    for (const p of me.listPrimitives()) {
      const name = p.getMaterial()?.getName(), f = A.farben[name];
      if (!f) continue;
      const P = p.getAttribute('POSITION').getArray(), T = p.getAttribute('TEXCOORD_0')?.getArray();
      const I = p.getIndices() ? p.getIndices().getArray() : P.map((_, k) => k).filter(k => k < P.length / 3);
      const pos = [], uv = [];
      for (let k = 0; k < P.length / 3; k++) {
        const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
        pos.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
        if (f === 'bild') uv.push(0.5 + Math.min(Math.max(T[k * 2], 0), 1) / 2, Math.min(Math.max(T[k * 2 + 1], 0), 1) / 2);
        else uv.push(...felder.get(name));
      }
      stuecke.push({ gruppe, name, pos, uv, ix: Array.from(I) });
    }
  }

  // 3. drehen, Größe, Lage (wie in tools/supercars.mjs)
  const dreh = (x, z) => A.vornIst === '+x' ? [-z, x] : A.vornIst === '-x' ? [z, -x] : A.vornIst === '-z' ? [-x, -z] : [x, z];
  const mm = [[1e9, -1e9], [1e9, -1e9], [1e9, -1e9]];
  for (const s of stuecke) for (let k = 0; k < s.pos.length; k += 3) {
    const [x, z] = dreh(s.pos[k], s.pos[k + 2]); s.pos[k] = x; s.pos[k + 2] = z;
    for (let j = 0; j < 3; j++) { const v = s.pos[k + j]; if (v < mm[j][0]) mm[j][0] = v; if (v > mm[j][1]) mm[j][1] = v; }
  }
  const mal = A.lang / (mm[2][1] - mm[2][0]);
  const weg = [(mm[0][0] + mm[0][1]) / 2, mm[1][0], (mm[2][0] + mm[2][1]) / 2];
  for (const s of stuecke) for (let k = 0; k < s.pos.length; k += 3) {
    s.pos[k] = (s.pos[k] - weg[0]) * mal; s.pos[k + 1] = (s.pos[k + 1] - weg[1]) * mal; s.pos[k + 2] = (s.pos[k + 2] - weg[2]) * mal + A.mitte;
  }
  const breit = (mm[0][1] - mm[0][0]) * mal, hoch = (mm[1][1] - mm[1][0]) * mal;

  // 4. Räder links und rechts trennen. Ein Dreieck gehört zur Seite, auf der seine Mitte liegt.
  const teile = { koerper: [], rad_vl: [], rad_vr: [], rad_hl: [], rad_hr: [] };
  for (const s of stuecke) {
    if (s.gruppe === 'koerper') { teile.koerper.push(s); continue; }
    const l = { ...s, pos: s.pos.slice(), ix: [] }, r = { ...s, pos: s.pos.slice(), ix: [] };
    for (let t = 0; t < s.ix.length; t += 3) {
      const x = (s.pos[s.ix[t] * 3] + s.pos[s.ix[t + 1] * 3] + s.pos[s.ix[t + 2] * 3]) / 3;
      (x > 0 ? l : r).ix.push(s.ix[t], s.ix[t + 1], s.ix[t + 2]);
    }
    const v = s.gruppe === 'vorn' ? 'v' : 'h';
    teile['rad_' + v + 'l'].push(l); teile['rad_' + v + 'r'].push(r);
  }

  const gestellt = [];
  // Eingelenkte Räder gerade stellen: um die senkrechte Achse drehen, bis der Reifen am schmalsten ist
  for (const name of ['rad_vl', 'rad_vr', 'rad_hl', 'rad_hr']) {
    const gummi = teile[name].filter(s => s.name === 'rubber');
    const ecken = []; for (const s of gummi) for (const k of s.ix) ecken.push([s.pos[k * 3], s.pos[k * 3 + 2]]);
    const cx = ecken.reduce((a, e) => a + e[0], 0) / ecken.length, cz = ecken.reduce((a, e) => a + e[1], 0) / ecken.length;
    let best = 0, bestBreit = 1e9;
    for (let w = -30; w <= 30; w += 0.25) {
      const c = Math.cos(w * Math.PI / 180), sn = Math.sin(w * Math.PI / 180);
      let lo = 1e9, hi = -1e9;
      for (const [x, z] of ecken) { const xx = (x - cx) * c - (z - cz) * sn; lo = Math.min(lo, xx); hi = Math.max(hi, xx); }
      if (hi - lo < bestBreit - 1e-5) { bestBreit = hi - lo; best = w; }
    }
    if (Math.abs(best) < 0.5) continue;
    const c = Math.cos(best * Math.PI / 180), sn = Math.sin(best * Math.PI / 180);
    for (const s of teile[name]) for (let k = 0; k < s.pos.length; k += 3) {
      const x = s.pos[k] - cx, z = s.pos[k + 2] - cz;
      s.pos[k] = cx + x * c - z * sn; s.pos[k + 2] = cz + x * sn + z * c;
    }
    if (process.env.ZEIGEN) console.log(name, 'gerade gestellt um', best, '°');
    gestellt.push(name);
  }
  // Beim Einlenken dreht sich ein Rad nicht um seine Mitte: Das linke Rad rutscht nach vorn, das rechte nach hinten.
  // Deshalb beide Räder auf dieselbe Stelle schieben (Mittelwert von links und rechts).
  const gummiMitte = name => {
    const b = [[1e9, -1e9], [1e9, -1e9]];
    for (const s of teile[name]) if (s.name === 'rubber') for (const k of s.ix) for (const [j, a] of [[0, 0], [1, 2]]) { const v = s.pos[k * 3 + a]; b[j][0] = Math.min(b[j][0], v); b[j][1] = Math.max(b[j][1], v); }
    return b.map(([a, c]) => (a + c) / 2);
  };
  for (const [l, r] of [['rad_vl', 'rad_vr'], ['rad_hl', 'rad_hr']]) {
    if (!gestellt.includes(l) && !gestellt.includes(r)) continue;
    const ml = gummiMitte(l), mr = gummiMitte(r), x = (ml[0] - mr[0]) / 2, z = (ml[1] + mr[1]) / 2;
    for (const [name, m, sx] of [[l, ml, 1], [r, mr, -1]]) for (const s of teile[name]) for (let k = 0; k < s.pos.length; k += 3) { s.pos[k] += sx * x - m[0]; s.pos[k + 2] += z - m[1]; }
  }

  // 5. neue Datei
  const neu = new Document(); const puffer = neu.createBuffer(); const szene = neu.createScene();
  const jpg = new Uint8Array(await sharp(pixel, { raw: { width: BILD, height: BILD, channels: 3 } }).jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer());
  const tex = neu.createTexture('farbe').setImage(jpg).setMimeType('image/jpeg');
  const mat = neu.createMaterial('auto').setBaseColorTexture(tex).setMetallicFactor(0).setRoughnessFactor(0.6);
  const info = [];
  for (const [name, liste] of Object.entries(teile)) {
    // Mitte des Teils: bei Rädern die Mitte des Reifens (dort dreht es sich; nur der Gummi zählt, nicht der Bremssattel)
    let mitte = [0, 0, 0];
    if (name !== 'koerper') {
      const b = [[1e9, -1e9], [1e9, -1e9], [1e9, -1e9]];
      for (const s of liste) if (s.name === 'rubber') for (const k of s.ix) for (let j = 0; j < 3; j++) { const v = s.pos[k * 3 + j]; b[j][0] = Math.min(b[j][0], v); b[j][1] = Math.max(b[j][1], v); }
      mitte = b.map(([a, c]) => (a + c) / 2);
      if (process.env.ZEIGEN) console.log(name, JSON.stringify(b.map(v => v.map(w => +w.toFixed(3)))));
      info.push(`${name} r=${((b[1][1] - b[1][0]) / 2).toFixed(2)} x=${mitte[0].toFixed(2)} z=${mitte[2].toFixed(2)}`);
    }
    // jedes Stück für sich vereinfachen; jedes bekommt so viele Dreiecke, wie es am ganzen Teil ausmacht
    const soll = name === 'koerper' ? A.dreiecke : A.radDreiecke;
    const alle = liste.reduce((s, x) => s + x.ix.length / 3, 0);
    const p = [], uv = [], ix = [];
    for (const s of liste) {
      if (!s.ix.length) continue;
      // gleiche Ecken zusammenlegen, damit das Vereinfachen Flächen zusammenfassen kann
      const map = new Map(), pp = [], uu = [], ii = [];
      for (const k of s.ix) {
        const key = `${s.pos[k * 3].toFixed(4)},${s.pos[k * 3 + 1].toFixed(4)},${s.pos[k * 3 + 2].toFixed(4)},${s.uv[k * 2].toFixed(4)},${s.uv[k * 2 + 1].toFixed(4)}`;
        if (!map.has(key)) { map.set(key, pp.length / 3); pp.push(s.pos[k * 3] - mitte[0], s.pos[k * 3 + 1] - mitte[1], s.pos[k * 3 + 2] - mitte[2]); uu.push(s.uv[k * 2], s.uv[k * 2 + 1]); }
        ii.push(map.get(key));
      }
      const ziel = Math.max(24, Math.round(soll * (s.ix.length / 3) / alle));
      const [aus] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(ii), new Float32Array(pp), 3, new Float32Array(uu), 2, [0.6, 0.6], null, Math.min(ii.length, ziel * 3), 0.05, []);
      const n0 = p.length / 3, benutzt = new Map();
      for (const k of aus) {
        if (!benutzt.has(k)) { benutzt.set(k, n0 + benutzt.size); p.push(pp[k * 3], pp[k * 3 + 1], pp[k * 3 + 2]); uv.push(uu[k * 2], uu[k * 2 + 1]); }
        ix.push(benutzt.get(k));
      }
    }
    const pr = neu.createPrimitive().setMaterial(mat)
      .setAttribute('POSITION', neu.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(puffer))
      .setAttribute('TEXCOORD_0', neu.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(puffer))
      .setIndices(neu.createAccessor().setType('SCALAR').setArray(p.length / 3 < 65536 ? new Uint16Array(ix) : new Uint32Array(ix)).setBuffer(puffer));
    szene.addChild(neu.createNode(name).setMesh(neu.createMesh(name).addPrimitive(pr)).setTranslation(mitte));
  }
  await neu.transform(prune({ keepAttributes: true }), dedup());
  const datei = path.resolve(HIER, '../modelle/supercars', id + '.glb');
  await io.write(datei, neu);
  const zahl = neu.getRoot().listMeshes().map(me => me.listPrimitives()[0].getIndices().getCount() / 3);
  console.log(`${id} ${breit.toFixed(2)} m breit, ${hoch.toFixed(2)} m hoch · ${info.join(' · ')} · Dreiecke ${zahl.join(' + ')} · ${Math.round(fs.statSync(datei).size / 1024)} KB`);
}

for (const id of process.argv[2] ? [process.argv[2]] : Object.keys(AUTOS)) await bauen(id);
