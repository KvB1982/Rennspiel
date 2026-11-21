// Rennspiel – fertige Auto-Modelle laden: die Supercars (sechs aus 3D AI Studio, eins von Sketchfab), der Formel-Rennwagen und der Verkehr.
//
// Alle Dateien macht tools/supercars.mjs aus den großen Vorlagen:
//   modelle/supercars/<id>.glb   Karosserie und vier einzelne Räder (drehen und lenken), Farbbild 1024
//   modelle/formel/formel.glb    genauso, für Rennwagen, ferngesteuertes Auto und Slotcar
//   modelle/verkehr/<art>.glb    ein Stück ohne einzelne Räder, Farbbild 512 (Kleinwagen, Limousine, Geländewagen, Transporter, Lkw, Bus)
// In jedem Farbbild ist der Lack blau gespeichert. lackMaterial tauscht das Blau gegen die gewünschte Farbe.
// Fehlt eine Datei (oder steht ?ohnemodelle in der Adresse), baut das Spiel das Auto wie früher aus Formen.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const echt = new Map();      // Name → { koerper: Form, raeder: [{ name, form, ort }], bild }
const laeuft = new Map();    // Name der Gruppe → Versprechen (damit nichts doppelt geladen wird)
const REIHE = 'rad_vl rad_vr rad_hl rad_hr';
const aus = wort => typeof location !== 'undefined' && new RegExp('ohnemodelle|' + wort).test(location.search);

// Das fertige Modell zu einem Namen (oder undefined, wenn es keins gibt)
export const echtesAuto = name => echt.get(name);

function laden(gruppe, dateien, bis, mitRaedern) {
  if (!laeuft.has(gruppe)) {
    const lader = new GLTFLoader();
    laeuft.set(gruppe, Promise.all(dateien.map(([name, pfad]) => lader.loadAsync(pfad).then(g => {
      const e = { koerper: null, raeder: [], bild: null };
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.computeVertexNormals();
        e.bild = o.material.map;
        if (o.name === 'koerper') e.koerper = o.geometry;
        else if (o.name.startsWith('rad_')) e.raeder.push({ name: o.name, form: o.geometry, ort: o.position.clone() });
      });
      e.raeder.sort((a, b) => REIHE.indexOf(a.name) - REIHE.indexOf(b.name));
      if (e.koerper && (!mitRaedern || e.raeder.length === 4)) echt.set(name, e);
    }).catch(() => { /* fehlt: dann das selbst gebaute Auto */ }))));
  }
  return Promise.race([laeuft.get(gruppe), new Promise(ok => setTimeout(ok, bis))]);
}

// Alle Supercars laden. Wartet höchstens `bis` Millisekunden. ?ohnesupercars = die alten Autos aus Formen.
export function ladeSupercars(ids, { bis = 8000 } = {}) {
  if (aus('ohnesupercars')) return Promise.resolve();
  return laden('supercars', ids.map(id => [id, `modelle/supercars/${id}.glb`]), bis, true);
}
// Die Rallyeautos laden (modelle/rallye/<id>.glb). ?ohnerallyemodelle = die Autos aus Formen.
export function ladeRallye(ids, { bis = 8000 } = {}) {
  if (aus('ohnerallyemodelle')) return Promise.resolve();
  return laden('rallye', ids.map(id => [id, `modelle/rallye/${id}.glb`]), bis, true);
}
// Den Formel-Rennwagen laden. ?ohneformel = das alte Auto aus Formen.
export function ladeFormel({ bis = 8000 } = {}) {
  if (aus('ohneformel')) return Promise.resolve();
  return laden('formel', [['formel', 'modelle/formel/formel.glb']], bis, true);
}
// Die Autos für den Verkehr laden (Namen wie in ARTEN in verkehr.js). ?ohneverkehrsmodelle = die Autos von früher.
export function ladeVerkehr(arten, { bis = 8000 } = {}) {
  if (aus('ohneverkehrsmodelle')) return Promise.resolve();
  return laden('verkehr', arten.map(a => ['verkehr_' + a, `modelle/verkehr/${a}.glb`]), bis, false);
}

// Material für die Karosserie: Im Farbbild ist der Lack blau gespeichert. Hier wird das Blau gegen die
// gewünschte Lackfarbe getauscht (in einem kleinen Zusatz zum Malprogramm der Grafikkarte) und der Lack glänzt.
// proAuto = true: Die Lackfarbe kommt nicht aus `farbe`, sondern von jedem einzelnen Auto (bei „Instanzen“, also im Verkehr).
export function lackMaterial(bild, farbe, { proAuto = false } = {}) {
  const mat = new THREE.MeshStandardMaterial({ map: bild, roughness: 0.6, metalness: 0 });
  const u = { uLack: { value: new THREE.Color(farbe) } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLack;\nfloat lackK = 0.0;')
      .replace('#include <color_fragment>', proAuto ? '' : '#include <color_fragment>')   // die Farbe des Autos soll nicht alles einfärben, nur den Lack
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 lackFarbe = ${proAuto ? 'vColor.rgb' : 'uLack'};
          float grau = min(diffuseColor.r, diffuseColor.g);       // Glanzlicht und Schatten
          float blau = diffuseColor.b - grau;                      // so viel Lack ist an dieser Stelle
          lackK = smoothstep(0.03, 0.12, blau);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(grau) + lackFarbe * min(blau * 3.4, 1.25), lackK);
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.2, lackK);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.4, lackK);');
  };
  mat.customProgramCacheKey = () => 'lack' + (proAuto ? 1 : 0);
  mat.userData.lack = u.uLack.value;
  return mat;
}
