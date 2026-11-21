// Rennspiel – das Formel-Auto in 3D, aus einfachen Formen gebaut (ausgedachtes Aussehen, keine echte Lackierung).
//
// Die Karosserie entsteht wie ein Schiffsrumpf: Querschnitte von vorn nach hinten (breit/schmal, hoch/flach),
// die miteinander verbunden werden. Dazu Flügel, Räder, Aufhängung, der Fahrer mit Helm und der Halo-Bügel.
// Vorn ist +z, links ist +x (so passt es zur Fahrphysik). Der Nullpunkt liegt zwischen den Achsen (Schwerpunkt).

import * as THREE from 'three';
import { nummer } from './texturen.js';
import { echtesAuto, lackMaterial } from './automodelle.js';

const VORN = 1.6, HINTEN = -2.0;   // Achsen (wie in physik.js: a = 1,6 m, b = 2,0 m)
// Das ganze Auto ist 5,6 m lang und 1,95 m breit (wie ein echter Formel-Wagen).
// nz staucht alles vor der Vorderachse, damit die Nase nicht zu lang wird.
const nz = z => z > VORN ? VORN + (z - VORN) * 0.62 : z;

// Rumpf aus Querschnitten: [z, halbe Breite, halbe Höhe, Mitte y, (Mitte x)]
export function rumpf(schnitte, rund = 3, M = 20) {
  const pos = [], idx = [];
  for (const [z, w, h, y, x = 0] of schnitte) {
    for (let k = 0; k < M; k++) {
      const t = k / M * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      // "Superellipse": zwischen Ellipse und abgerundetem Rechteck
      const px = Math.sign(c) * Math.pow(Math.abs(c), 2 / rund) * w, py = Math.sign(s) * Math.pow(Math.abs(s), 2 / rund) * h;
      pos.push(x + px, y + py, z);
    }
  }
  const S = schnitte.length;
  for (let j = 0; j < S - 1; j++) for (let k = 0; k < M; k++) {
    const a = j * M + k, b = j * M + (k + 1) % M, c = (j + 1) * M + k, d = (j + 1) * M + (k + 1) % M;
    idx.push(a, c, b, b, c, d);
  }
  // Deckel vorn und hinten
  const deckel = (j, rueck) => {
    const m = pos.length / 3; const [z, , , y, x = 0] = schnitte[j]; pos.push(x, y, z);
    for (let k = 0; k < M; k++) { const a = j * M + k, b = j * M + (k + 1) % M; rueck ? idx.push(m, b, a) : idx.push(m, a, b); }
  };
  deckel(0, false); deckel(S - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function kiste(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

export function stange(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 6), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  m.castShadow = true;
  return m;
}

// Ein Rad: Reifen mit runden Schultern, Felge, farbiger Ring (Reifenmischung)
export function rad(radius, breite, mats) {
  const g = new THREE.Group();
  const prof = [];
  const sch = 0.06;
  prof.push(new THREE.Vector2(radius * 0.62, -breite / 2));
  for (let k = 0; k <= 6; k++) { const t = k / 6 * Math.PI / 2; prof.push(new THREE.Vector2(radius - sch + Math.sin(t) * sch, -breite / 2 + sch - Math.cos(t) * sch)); }
  for (let k = 0; k <= 6; k++) { const t = k / 6 * Math.PI / 2; prof.push(new THREE.Vector2(radius - sch + Math.cos(t) * sch, breite / 2 - sch + Math.sin(t) * sch)); }
  prof.push(new THREE.Vector2(radius * 0.62, breite / 2));
  const reifen = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), mats.reifen);
  reifen.rotation.z = Math.PI / 2; reifen.castShadow = true;
  g.add(reifen);
  for (const s of [-1, 1]) {
    const felge = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.63, radius * 0.63, 0.01, 24), mats.felge);
    felge.rotation.z = Math.PI / 2; felge.position.x = s * (breite / 2 - 0.02); g.add(felge);
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.7, radius * 0.76, 28), mats.mischung);
    ring.rotation.y = s * Math.PI / 2; ring.position.x = s * (breite / 2 + 0.002); g.add(ring);
    // Speichen, damit man das Drehen sieht
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.012, radius * 1.15, 0.035), mats.felgeHell);
      sp.rotation.x = k / 5 * Math.PI; sp.position.x = s * (breite / 2 - 0.01); g.add(sp);
    }
  }
  return g;
}

// farbe/zweit: Zahlen wie 0x1e5bd8. num: Startnummer.
export function baueAuto({ farbe = 0x1e5bd8, zweit = 0xffffff, num = 1, massstab = 1, cockpit = false } = {}) {
  const lack = new THREE.MeshPhysicalMaterial({ color: farbe, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const akzent = new THREE.MeshPhysicalMaterial({ color: zweit, roughness: 0.35, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  const karbon = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.45, metalness: 0.4 });
  const mats = {
    reifen: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.92, metalness: 0 }),
    felge: new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.35, metalness: 0.85 }),
    felgeHell: new THREE.MeshStandardMaterial({ color: 0x8b8d92, roughness: 0.3, metalness: 0.9 }),
    mischung: new THREE.MeshStandardMaterial({ color: 0xd42828, roughness: 0.6, side: THREE.DoubleSide }),
  };
  const auto = new THREE.Group();
  const koerper = new THREE.Group();   // alles, was federt (nickt und neigt sich)
  auto.add(koerper);
  const add = m => { koerper.add(m); m.castShadow = true; return m; };

  // Rumpf mit Nase, Cockpit, Motorhaube
  add(new THREE.Mesh(rumpf([
    [3.38, 0.08, 0.05, 0.27], [3.05, 0.13, 0.08, 0.29], [2.5, 0.19, 0.12, 0.34], [1.9, 0.24, 0.16, 0.41],
    [1.25, 0.31, 0.21, 0.46], [0.65, 0.39, 0.25, 0.49], [0.05, 0.43, 0.25, 0.49], [-0.45, 0.46, 0.31, 0.54],
    [-0.95, 0.41, 0.37, 0.61], [-1.55, 0.31, 0.29, 0.55], [-2.15, 0.19, 0.19, 0.45], [-2.72, 0.1, 0.11, 0.38],
  ].map(q => [nz(q[0]), ...q.slice(1)]), 3.2), lack));
  // Streifen auf der Nase
  add(new THREE.Mesh(rumpf([[3.2, 0.03, 0.02, 0.33], [2.4, 0.05, 0.02, 0.45], [1.6, 0.06, 0.02, 0.56], [1.1, 0.07, 0.02, 0.66]].map(q => [nz(q[0]), ...q.slice(1)]), 2, 10), akzent));
  // Seitenkästen (Kühler)
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(rumpf([
      [0.5, 0.15, 0.16, 0.42, s * 0.6], [0.25, 0.2, 0.19, 0.42, s * 0.58], [-0.5, 0.2, 0.18, 0.4, s * 0.55],
      [-1.3, 0.13, 0.13, 0.34, s * 0.44], [-1.9, 0.05, 0.07, 0.29, s * 0.3],
    ], 4, 16), lack));
    // dunkle Öffnung vorn am Seitenkasten
    const loch = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), karbon);
    loch.position.set(s * 0.6, 0.43, 0.51); add(loch);
  }
  // Finne auf der Motorhaube
  add(kiste(0.02, 0.22, 1.2, akzent, 0, 0.88, -1.55, -0.08));
  // Lufteinlass über dem Kopf
  add(new THREE.Mesh(rumpf([[-0.35, 0.1, 0.09, 0.93], [-0.6, 0.12, 0.1, 0.91], [-0.9, 0.08, 0.06, 0.86]], 3, 12), karbon));

  // Boden (flach, mit Seitenteilen)
  const boden = new THREE.Shape();
  boden.moveTo(-0.32, 1.25); boden.lineTo(0.32, 1.25); boden.lineTo(0.82, 0.55); boden.lineTo(0.8, -1.5); boden.lineTo(0.5, -2.35);
  boden.lineTo(-0.5, -2.35); boden.lineTo(-0.8, -1.5); boden.lineTo(-0.82, 0.55); boden.closePath();
  const bg = new THREE.ExtrudeGeometry(boden, { depth: 0.035, bevelEnabled: false });
  bg.rotateX(Math.PI / 2);
  const bm = new THREE.Mesh(bg, karbon); bm.position.y = 0.11; bm.scale.z = -1; add(bm);

  // Frontflügel: Hauptblatt, zwei Klappen, Endplatten
  add(kiste(1.9, 0.025, 0.38, karbon, 0, 0.1, nz(3.2)));
  add(kiste(1.75, 0.02, 0.18, lack, 0, 0.16, nz(3.2) - 0.14, -0.35));
  add(kiste(1.6, 0.02, 0.14, akzent, 0, 0.22, nz(3.2) - 0.24, -0.6));
  for (const s of [-1, 1]) add(kiste(0.025, 0.24, 0.52, akzent, s * 0.96, 0.17, nz(3.2) - 0.07));
  // Heckflügel mit Endplatten und Halter
  add(kiste(1.0, 0.03, 0.32, karbon, 0, 0.86, -2.62, 0.12));
  add(kiste(0.98, 0.025, 0.2, lack, 0, 0.98, -2.55, 0.45));
  for (const s of [-1, 1]) add(kiste(0.025, 0.5, 0.55, akzent, s * 0.51, 0.78, -2.6));
  add(kiste(0.04, 0.42, 0.12, karbon, 0, 0.62, -2.55));
  add(kiste(0.95, 0.02, 0.16, karbon, 0, 0.4, -2.65));
  // Rücklicht (leuchtet beim Bremsen)
  const licht = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1010, emissiveIntensity: 0.2 }));
  licht.position.set(0, 0.42, -2.77); add(licht);

  // Halo (Schutzbügel über dem Fahrer)
  const haloKurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.3, 0.66, -0.15), new THREE.Vector3(0.3, 0.83, 0.2), new THREE.Vector3(0.17, 0.89, 0.5),
    new THREE.Vector3(0, 0.9, 0.58), new THREE.Vector3(-0.17, 0.89, 0.5), new THREE.Vector3(-0.3, 0.83, 0.2), new THREE.Vector3(-0.3, 0.66, -0.15)]);
  const halo = [add(new THREE.Mesh(new THREE.TubeGeometry(haloKurve, 30, 0.028, 8), karbon)),
    add(stange([0, 0.9, 0.58], [0, 0.72, 0.84], 0.022, karbon))];

  // Fahrer: Helm und Schultern (Helm in der Zweitfarbe, Visier dunkel)
  const helmMat = new THREE.MeshPhysicalMaterial({ color: zweit, roughness: 0.25, clearcoat: 1 });
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), helmMat);
  helm.position.set(0, 0.8, -0.05); add(helm);
  const visier = new THREE.Mesh(new THREE.SphereGeometry(0.142, 20, 8, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.38, Math.PI * 0.22),
    new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.1, metalness: 0.6 }));
  visier.position.copy(helm.position); add(visier);
  helm.visible = visier.visible = !cockpit;
  // Rückspiegel
  for (const s of [-1, 1]) { add(stange([s * 0.33, 0.6, 0.45], [s * 0.55, 0.66, 0.5], 0.012, karbon)); add(kiste(0.13, 0.055, 0.035, lack, s * 0.58, 0.67, 0.5)); }

  // Lenkrad (sieht man nur aus dem Cockpit gut)
  const lenkrad = new THREE.Group();
  const lr = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.04), karbon); lenkrad.add(lr);
  for (const s of [-1, 1]) { const griff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), mats.reifen); griff.position.x = s * 0.15; lenkrad.add(griff); }
  const anzeige = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x2a8f2a, emissiveIntensity: 0.6 }));
  anzeige.position.set(0, 0.01, 0.021); anzeige.rotation.y = Math.PI; lenkrad.add(anzeige);
  const knoepfe = [0xff3030, 0x30a0ff, 0xffc020, 0x30d060];
  knoepfe.forEach((c, k) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 })); b.rotation.x = Math.PI / 2; b.position.set((k < 2 ? -1 : 1) * 0.085, (k % 2 ? -1 : 1) * 0.035, 0.022); lenkrad.add(b); });
  lenkrad.position.set(0, 0.71, 0.36); lenkrad.rotation.x = -0.35;
  add(lenkrad);

  // Startnummer oben auf der Nase
  const nr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshStandardMaterial({ map: nummer(num, '#fff'), transparent: true, roughness: 0.4 }));
  nr.rotation.x = -Math.PI / 2 + 0.13; nr.rotation.z = Math.PI; nr.position.set(0, 0.55, nz(2.05)); add(nr);

  // Räder und Aufhängung (die Räder federn nicht mit dem Körper)
  const raeder = [], lenkVorn = [], alteHalter = [];
  const ecken = [[0.8, VORN, 0.33, 0.3], [-0.8, VORN, 0.33, 0.3], [0.78, HINTEN, 0.36, 0.4], [-0.78, HINTEN, 0.36, 0.4]];
  ecken.forEach(([x, z, r, b], k) => {
    const halter = new THREE.Group(); halter.position.set(x, r, z); auto.add(halter); alteHalter.push(halter);
    const rd = rad(r, b, mats); halter.add(rd);
    raeder.push(rd); if (k < 2) lenkVorn.push(halter);
    // Querlenker vom Rumpf zum Rad
    const inn = Math.sign(x) * (k < 2 ? 0.2 : 0.3);
    koerper.add(stange([inn, 0.48, z + 0.15], [x - Math.sign(x) * b * 0.4, r + 0.08, z], 0.016, karbon));
    koerper.add(stange([inn, 0.3, z - 0.15], [x - Math.sign(x) * b * 0.4, r - 0.08, z], 0.016, karbon));
  });

  // Gibt es das fertige Modell (modelle/formel/formel.glb)? Dann kommt alles bisher Gebaute in eine Gruppe "alt".
  // Die sieht man nur noch im Cockpit (dort braucht man Lenkrad und Nase direkt vor den Augen), samt den alten Rädern.
  const E = echtesAuto('formel');
  let sicht = null;
  if (E) {
    const alt = new THREE.Group();
    for (const kind of [...koerper.children]) alt.add(kind);
    koerper.add(alt, licht);   // das Rücklicht bleibt immer zu sehen (es sitzt auch beim neuen Auto mitten am Heck)
    const neu = new THREE.Group(); auto.add(neu);
    const karosse = new THREE.Mesh(E.koerper, lackMaterial(E.bild, farbe)); koerper.add(karosse);
    const radMat = lackMaterial(E.bild, 0x26272b);
    E.raeder.forEach((R, k) => {
      const halter = new THREE.Group(); halter.position.copy(R.ort); neu.add(halter);
      const rd = new THREE.Mesh(R.form, radMat); halter.add(rd); raeder.push(rd);
      if (k < 2) lenkVorn.push(halter);
    });
    sicht = imAuto => { alt.visible = imAuto; for (const h of alteHalter) h.visible = imAuto; karosse.visible = neu.visible = !imAuto; };
    sicht(false);
  }

  auto.scale.setScalar(massstab);
  auto.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { gruppe: auto, koerper, raeder, lenkVorn, lenkrad, licht, helm: [helm, visier], halo, massstab, sicht };
}

// Das Auto im Bild auf den Stand der Physik bringen
export function autoStellen(m, a, uhr = 0) {
  const g = m.gruppe;
  g.position.set(a.x, a.y, a.z);
  // Bergauf hebt sich die Nase (a.nick = Steigung, nur bei Strecken mit Sprüngen ausgerechnet)
  g.rotation.order = 'YXZ';
  g.rotation.set(-Math.atan(a.nick || 0), a.h, 0);
  m.koerper.rotation.x = a.neigung; m.koerper.rotation.z = a.kippen;
  for (const v of m.lenkVorn) v.rotation.y = a.lenk;
  const dreh = a.radDreh;
  for (const r of m.raeder) r.rotation.x = dreh;
  m.lenkrad.rotation.z = -a.lenk * 6;
  m.licht.material.emissiveIntensity = a.brems > 0.1 ? 3 : 0.3;
}
