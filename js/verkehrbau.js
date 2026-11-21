// Rennspiel – die Autos im Verkehr in 3D.
//
// Jede Fahrzeugart (Kleinwagen, Limousine, Geländewagen, Transporter, Lastwagen, Bus) ist eine Form aus wenigen Kisten.
// Alle Autos einer Art werden auf einmal gemalt ("Instanzen") – das geht viel schneller als jedes Auto einzeln.
// Die Lackfarbe kommt pro Auto dazu, Scheiben und Reifen bleiben dunkel, die Lichter leuchten.
// Autos in der Nähe der Kamera (bis NAH Meter) zeigen ein fertiges Modell, weiter weg reichen die Kisten –
// das spart viele Dreiecke (ein Modell hat etwa 5000, eine Kisten-Form etwa 100).
// Die fertigen Modelle kommen aus 3D AI Studio (modelle/verkehr/, siehe js/automodelle.js): echt aussehende Autos mit Farbbild,
// der Lack wird je Auto umgefärbt. Fehlen sie, nimmt das Spiel die bunten Autos von Kenney (CC0, js/modelle.js).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARTEN } from './verkehr.js';
import { modell, passend, eckMaterial } from './modelle.js';
import { echtesAuto, lackMaterial } from './automodelle.js';

const NAH = 220;   // so nah (m) muss ein Auto sein, damit es als Modell gezeigt wird
const MODELL = { kompakt: 'auto_kompakt', limousine: 'auto_limousine', gelaende: 'auto_gelaende', transporter: 'auto_transporter', lkw: 'auto_lkw' };

// Kiste mit einer festen Farbe (wird mit der Lackfarbe malgenommen: weiß = Lack, dunkel = bleibt dunkel)
function teil(w, h, d, x, y, z, farbe) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
  const c = new THREE.Color(farbe), cols = [];
  for (let k = 0; k < g.getAttribute('position').count; k++) cols.push(c.r, c.g, c.b);
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return g;
}
function radTeil(x, z, r, b) {
  const g = new THREE.CylinderGeometry(r, r, b, 10); g.rotateZ(Math.PI / 2); g.translate(x, r, z);
  const cols = []; for (let k = 0; k < g.getAttribute('position').count; k++) cols.push(0.06, 0.06, 0.06);
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return g;
}

// Ein fertiges Modell auf die Maße der Fahrzeugart bringen (Mitte bei x = z = 0, Reifen auf y = 0)
function aufMass(form, A) {
  const g = form.clone(); g.computeBoundingBox();
  const k = g.boundingBox, gr = k.getSize(new THREE.Vector3());
  g.translate(-(k.min.x + k.max.x) / 2, -k.min.y, -(k.min.z + k.max.z) / 2);
  g.scale(A.breit / gr.x, A.hoch / gr.y, A.lang / gr.z);
  g.computeVertexNormals();
  return g;
}

const LACK = 0xffffff, SCHEIBE = 0x15191f, DUNKEL = 0x202226;

// Form einer Fahrzeugart: Körper und Lichter (vorn +z)
function form(typ) {
  const A = ARTEN[typ], L = A.lang, B = A.breit, H = A.hoch;
  const teile = [], lichter = [];
  const raeder = (r, vorn, hinten) => { for (const z of [vorn, hinten]) for (const s of [-1, 1]) teile.push(radTeil(s * (B / 2 - 0.12), z, r, 0.26)); };
  const lampen = (y, z, x = B / 2 - 0.25) => {
    for (const s of [-1, 1]) { lichter.push(teil(0.3, 0.12, 0.05, s * x, y, L / 2, 0xfff6dd)); lichter.push(teil(0.28, 0.12, 0.05, s * x, y, -L / 2, 0xff2010)); }
  };
  if (typ === 'kompakt' || typ === 'limousine' || typ === 'gelaende') {
    const unten = typ === 'gelaende' ? 0.45 : 0.3, gurt = typ === 'gelaende' ? 1.15 : 0.95;
    teile.push(teil(B, gurt - unten, L, 0, (gurt + unten) / 2, 0, LACK));
    const kl = typ === 'kompakt' ? L * 0.62 : typ === 'limousine' ? L * 0.5 : L * 0.68;
    const kz = typ === 'kompakt' ? -L * 0.12 : typ === 'limousine' ? -L * 0.05 : -L * 0.1;
    teile.push(teil(B - 0.16, H - gurt, kl, 0, (H + gurt) / 2, kz, SCHEIBE));
    teile.push(teil(B - 0.22, 0.06, kl - 0.3, 0, H + 0.01, kz, LACK));                 // Dach
    teile.push(teil(B - 0.1, 0.18, 0.1, 0, unten + 0.1, L / 2 - 0.02, DUNKEL));        // Stoßstange
    raeder(0.33, L * 0.32, -L * 0.32);
    lampen(gurt - 0.15);
  } else if (typ === 'transporter') {
    teile.push(teil(B, H - 0.35, L - 0.8, 0, (H + 0.35) / 2, -0.4, LACK));
    teile.push(teil(B, 0.75, 0.8, 0, 0.35 + 0.37, L / 2 - 0.4, LACK));                 // Motorhaube
    teile.push(teil(B - 0.1, 0.8, 0.06, 0, 1.55, L / 2 - 0.78, SCHEIBE));             // Frontscheibe
    for (const s of [-1, 1]) teile.push(teil(0.05, 0.6, 1.0, s * B / 2, 1.6, L / 2 - 1.4, SCHEIBE));
    raeder(0.35, L * 0.33, -L * 0.33);
    lampen(0.85);
  } else if (typ === 'lkw') {
    teile.push(teil(B, 2.4, 2.2, 0, 0.55 + 1.2, L / 2 - 1.1, LACK));                   // Führerhaus
    teile.push(teil(B - 0.1, 0.8, 0.06, 0, 2.3, L / 2 + 0.01, SCHEIBE));
    teile.push(teil(B, H - 0.9, L - 2.6, 0, 0.9 + (H - 0.9) / 2, -1.2, 0xd8d8d8));     // Ladung (heller Kasten)
    teile.push(teil(B - 0.3, 0.3, L, 0, 0.7, 0, DUNKEL));                              // Rahmen
    raeder(0.5, L / 2 - 1.3, -L / 2 + 1.5); raeder(0.5, -L / 2 + 2.6, -L / 2 + 2.6);
    lampen(0.8);
  } else if (typ === 'bus') {
    teile.push(teil(B, H - 0.35, L, 0, (H + 0.35) / 2, 0, LACK));
    for (const s of [-1, 1]) teile.push(teil(0.04, 1.1, L - 1.5, s * B / 2, 1.9, -0.3, SCHEIBE));
    teile.push(teil(B - 0.2, 1.4, 0.05, 0, 1.75, L / 2 + 0.01, SCHEIBE));
    raeder(0.5, L / 2 - 2.6, -L / 2 + 3);
    lampen(0.7);
  }
  return { koerper: mergeGeometries(teile), lichter: mergeGeometries(lichter) };
}

export class VerkehrBild {
  constructor(szene, verkehr, { abend = false, kamera = null } = {}) {
    this.v = verkehr; this.gruppen = []; this.kamera = kamera;
    const koerperMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 });
    const lichtMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    lichtMat.color.setScalar(abend ? 2.2 : 1.2);
    const lackMat = eckMaterial(0xffffff, { roughness: 0.3, metalness: 0.35 }), restMat = eckMaterial(0xffffff, { roughness: 0.6 });
    for (const typ of Object.keys(ARTEN)) {
      const liste = verkehr.autos.filter(t => t.typ === typ);
      if (!liste.length) continue;
      const f = form(typ);
      const k = new THREE.InstancedMesh(f.koerper, koerperMat, liste.length);
      const l = new THREE.InstancedMesh(f.lichter, lichtMat, liste.length);
      const c = new THREE.Color();
      liste.forEach((t, i) => k.setColorAt(i, c.setHex(t.farbe)));
      k.castShadow = true; k.receiveShadow = true;
      k.frustumCulled = l.frustumCulled = false;   // die Autos fahren herum: nicht mit der alten Größe wegschneiden
      szene.add(k, l);
      // fertiges Modell für die nahen Autos (auf die Maße der Fahrzeugart gezogen)
      let nah = null;
      const echt = echtesAuto('verkehr_' + typ);
      const m = !echt && MODELL[typ] && modell(MODELL[typ]);
      if (echt) {
        // echt aussehendes Modell: ein Stück, der Lack bekommt die Farbe des einzelnen Autos
        const lack = new THREE.InstancedMesh(aufMass(echt.koerper, ARTEN[typ]), lackMaterial(echt.bild, 0xffffff, { proAuto: true }), liste.length);
        lack.setColorAt(0, c.setHex(0xffffff));
        lack.castShadow = lack.receiveShadow = true; lack.frustumCulled = false; lack.count = 0; szene.add(lack);
        nah = { lack, rest: null };
      } else if (m) {
        const A = ARTEN[typ], t = passend(m, { breit: A.breit, hoch: A.hoch, lang: A.lang });
        const lack = new THREE.InstancedMesh(t.lack, lackMat, liste.length), rest = new THREE.InstancedMesh(t.rest, restMat, liste.length);
        for (const o of [lack, rest]) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; o.count = 0; szene.add(o); }
        nah = { lack, rest };
      }
      this.gruppen.push({ liste, k, l, nah });
    }
    this.nichts = new THREE.Matrix4().makeScale(0, 0, 0);
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.e = new THREE.Vector3(1, 1, 1); this.eu = new THREE.Euler(0, 0, 0, 'YXZ');
    this.farbe = new THREE.Color();
  }
  update() {
    const { m4, q, p, e, eu } = this;
    const kp = this.kamera ? this.kamera.position : null;
    for (const { liste, k, l, nah } of this.gruppen) {
      let fern = 0, n = 0;
      liste.forEach((t, i) => {
        // weggeschleuderte Autos kippen und nicken ein wenig (kipp, nick)
        eu.set(t.nick || 0, t.h, t.kipp || 0); q.setFromEuler(eu); p.set(t.x, t.y, t.z);
        m4.compose(p, q, e);
        const nahDran = nah && kp && (t.x - kp.x) ** 2 + (t.z - kp.z) ** 2 < NAH * NAH;
        // Lampen als kleine Kisten: nur bei den einfachen Autos (die echten Modelle haben ihre Lampen im Farbbild)
        l.setMatrixAt(i, nahDran && !nah.rest ? this.nichts : m4);
        // nah: als Modell, weit weg: als Kisten-Form (die Listen werden jedes Bild neu gefüllt)
        if (nahDran) {
          nah.lack.setMatrixAt(n, m4); if (nah.rest) nah.rest.setMatrixAt(n, m4); nah.lack.setColorAt(n, this.farbe.setHex(t.farbe)); n++;
        } else { k.setMatrixAt(fern, m4); k.setColorAt(fern, this.farbe.setHex(t.farbe)); fern++; }
      });
      k.count = fern;
      k.instanceMatrix.needsUpdate = true; l.instanceMatrix.needsUpdate = true;
      if (k.instanceColor) k.instanceColor.needsUpdate = true;
      if (nah) {
        nah.lack.count = n; nah.lack.instanceMatrix.needsUpdate = true;
        if (nah.rest) { nah.rest.count = n; nah.rest.instanceMatrix.needsUpdate = true; }
        if (nah.lack.instanceColor) nah.lack.instanceColor.needsUpdate = true;
      }
    }
  }
}
