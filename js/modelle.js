// Rennspiel – fertige 3D-Modelle (Kenney, CC0) laden und für das Spiel herrichten.
//
// Die Dateien in modelle/ macht tools/modelle.mjs aus den Vorlagen: ohne Bilder, mit Farbe an jeder Ecke,
// sortiert in Teile ("lack", "rest", "krone", "stamm", "stoff", "dach", "wand").
// Weiße Teile bekommen im Spiel ihre Farbe dazu (Lackfarbe, Blätterfarbe, Dachfarbe …).
//
// So geht es:
//   await ladeModelle()            – einmal vor dem Bauen der Welt (kommt nach ein paar Sekunden auch ohne Internet zurück)
//   const m = modell('sofa')       – die Teile als Formen, oder null, wenn das Modell fehlt (dann baut das Spiel wie früher aus Kisten)
//   passend(m, { breit, hoch, lang }) – Formen auf eine Größe bringen: Mitte bei x = z = 0, unten bei y = 0
//
// Alle Modelle schauen nach vorn in Richtung +z.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const NAMEN = [
  'auto_kompakt', 'auto_limousine', 'auto_gelaende', 'auto_transporter', 'auto_lkw',
  'sofa', 'sessel', 'fernsehschrank', 'fernseher', 'pflanze', 'pflanze_klein', 'regal', 'stehlampe', 'lautsprecher', 'radio',
  'baum_tanne', 'baum_laub', 'baum_zypresse',
  'zelt', 'zelt_lang', 'flutlicht', 'fahne_ziel', 'tv_kamera', 'fahnenturm',
  'haus_a', 'haus_g', 'haus_h', 'haus_i', 'haus_m', 'haus_q',
];

const vorrat = new Map();   // Name → { teile: { name: Form }, kiste: Box3 }
let laeuft = null;

// Alle Modelle laden. Wartet höchstens `bis` Millisekunden; was dann noch fehlt, bleibt weg.
// Mit ?ohnemodelle in der Adresse bleibt alles aus Kisten (zum Vergleichen).
export function ladeModelle({ bis = 6000 } = {}) {
  if (typeof location !== 'undefined' && /ohnemodelle/.test(location.search)) return Promise.resolve();
  if (!laeuft) {
    const lader = new GLTFLoader();
    laeuft = Promise.all(NAMEN.map(n => lader.loadAsync(`modelle/${n}.glb`).then(g => {
      const teile = {}, kiste = new THREE.Box3();
      g.scene.updateMatrixWorld(true);
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        // in eine einfache Form mit Zahlen umwandeln (Farben kommen als 0…255 und werden zu 0…1)
        const alt = o.geometry, n2 = alt.getAttribute('position').count;
        const neu = new THREE.BufferGeometry();
        const pos = new Float32Array(n2 * 3), col = new Float32Array(n2 * 3);
        const p = new THREE.Vector3(), c = alt.getAttribute('color');
        for (let k = 0; k < n2; k++) {
          p.fromBufferAttribute(alt.getAttribute('position'), k).applyMatrix4(o.matrixWorld);
          pos.set([p.x, p.y, p.z], k * 3);
          col.set(c ? [c.getX(k), c.getY(k), c.getZ(k)] : [1, 1, 1], k * 3);
        }
        neu.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        neu.setAttribute('color', new THREE.BufferAttribute(col, 3));
        if (alt.index) neu.setIndex(Array.from(alt.index.array));
        neu.computeBoundingBox(); kiste.union(neu.boundingBox);
        teile[o.name || o.parent.name] = neu;
      });
      vorrat.set(n, { teile, kiste });
    }).catch(() => { /* fehlt: dann eben Kisten */ })));
  }
  return Promise.race([laeuft, new Promise(ok => setTimeout(ok, bis))]);
}

// Teile eines Modells (Formen nicht verändern – mit passend() bekommt man Kopien)
export const modell = name => vorrat.get(name) || null;

// Kopien der Teile, auf eine Größe gebracht. Fehlt ein Maß, wird gleichmäßig nach den anderen vergrößert.
// { breit, hoch, lang } in Metern (x, y, z); oder { mal } für einen festen Faktor.
export function passend(m, { breit, hoch, lang, mal } = {}) {
  const k = m.kiste, g = k.getSize(new THREE.Vector3()), mi = k.getCenter(new THREE.Vector3());
  const f = [breit && breit / g.x, hoch && hoch / g.y, lang && lang / g.z].filter(Boolean);
  const gleich = mal || (f.length ? f.reduce((a, b) => a + b) / f.length : 1);
  const sx = breit ? breit / g.x : gleich, sy = hoch ? hoch / g.y : gleich, sz = lang ? lang / g.z : gleich;
  const M = new THREE.Matrix4().makeScale(sx, sy, sz).multiply(new THREE.Matrix4().makeTranslation(-mi.x, -k.min.y, -mi.z));
  const aus = {};
  for (const [n, geo] of Object.entries(m.teile)) aus[n] = geo.clone().applyMatrix4(M);
  aus.masse = { breit: g.x * sx, hoch: g.y * sy, lang: g.z * sz };
  return aus;
}

// Gemeinsames Material: Farbe aus den Ecken, kantig gemalt (die Modelle haben keine eigenen Normalen)
const mats = new Map();
export function eckMaterial(farbe = 0xffffff, extra = {}) {
  const k = farbe + JSON.stringify(extra);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: farbe, vertexColors: true, flatShading: true, roughness: 0.75, ...extra }));
  return mats.get(k);
}

// Ein Modell als fertige Gruppe zum Hinstellen. farben = { teil: Farbe } für die weißen Teile.
export function alsGruppe(name, groesse, farben = {}, extra = {}) {
  const m = modell(name);
  if (!m) return null;
  const t = passend(m, groesse), g = new THREE.Group();
  for (const [n, geo] of Object.entries(t)) {
    if (n === 'masse') continue;
    const o = new THREE.Mesh(geo, eckMaterial(farben[n] ?? 0xffffff, extra[n] || {}));
    o.castShadow = o.receiveShadow = true; o.name = n;
    g.add(o);
  }
  g.userData.masse = t.masse;
  return g;
}

// Baum aus einem Modell für viele Instanzen: { krone, stamm, kroneMat, stammMat } oder null.
// hoch = Höhe in Metern bei Größe 1. Die Krone ist weiß und bekommt ihre Farbe pro Baum (setColorAt).
export function baumModell(name, hoch) {
  const m = modell(name);
  if (!m || !m.teile.krone || !m.teile.stamm) return null;
  const t = passend(m, { hoch });
  return { krone: t.krone, stamm: t.stamm, kroneMat: eckMaterial(0xffffff, { roughness: 0.95 }), stammMat: eckMaterial(0xffffff, { roughness: 1 }) };
}
