// Rennspiel – das kleine Drift-Rallyeauto in 3D, aus einfachen Formen gebaut.
//
// Ein kurzes, breites Rallyeauto mit drei Türen (ausgedacht, kein echtes Modell, keine Marke, kein Logo):
// dicke Radläufe, großer Heckflügel, Lampen-Leiste auf der Haube, Lufthutze auf dem Dach, Schmutzfänger hinter den Rädern
// und eine Lackierung mit Streifen in der Zweitfarbe und einer weißen Startnummer-Tafel auf der Tür.
// Gebaut wird in echter Größe (4,1 m lang), dann auf 1:43 verkleinert – so groß wie die kleinen Drift-Autos zum Steuern mit dem Handy.
// Vorn ist +z, links ist +x. Der Nullpunkt liegt im Schwerpunkt zwischen den Achsen (wie bei den anderen Autos).

import * as THREE from 'three';
import { rumpf, rad, stange } from './autobau.js';
import { nummer } from './texturen.js';

const VORN = 1.2, HINTEN = -1.33;   // Achsen (wie in physik.js: a = 0,028 m, b = 0,031 m – mal 43)
const RAD = 0.33;                   // Radhalbmesser
const W = 0.93;                     // halbe Breite über den Radläufen

// weich zwischen Stützwerten [z, Wert] (nach z sortiert)
function kurve(punkte, z) {
  if (z <= punkte[0][0]) return punkte[0][1];
  for (let k = 1; k < punkte.length; k++) {
    const [z1, v1] = punkte[k], [z0, v0] = punkte[k - 1];
    if (z <= z1) { const t = (z - z0) / (z1 - z0 || 1), w = (1 - Math.cos(t * Math.PI)) / 2; return v0 + (v1 - v0) * w; }
  }
  return punkte[punkte.length - 1][1];
}

const kiste = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true;
  return m;
};

// farbe = Lack, zweit = Streifen, num = Startnummer, massstab = 1/43
export function baueRallye({ farbe = 0x1e5bd8, zweit = 0xffffff, num = 1, massstab = 1 / 43 } = {}) {
  const lack = new THREE.MeshPhysicalMaterial({ color: farbe, roughness: 0.32, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  const streifen = new THREE.MeshStandardMaterial({ color: zweit, roughness: 0.4, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const schwarz = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.6, metalness: 0.2 });
  const glas = new THREE.MeshPhysicalMaterial({ color: 0x0d141c, roughness: 0.08, metalness: 0.4, clearcoat: 1 });
  const weiss = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const scheinMat = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, emissive: 0xe8f2ff, emissiveIntensity: 1.2, roughness: 0.2 });
  const rueckMat = new THREE.MeshStandardMaterial({ color: 0x500000, emissive: 0xff1010, emissiveIntensity: 0.4, roughness: 0.3 });
  const mats = {
    reifen: new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.95 }),
    felge: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.35, metalness: 0.6 }),   // weiße Rallye-Felgen
    felgeHell: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 }),
    mischung: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, side: THREE.DoubleSide }),
  };

  const auto = new THREE.Group();
  const koerper = new THREE.Group(); auto.add(koerper);
  const add = m => { koerper.add(m); m.castShadow = true; return m; };
  const zF = 2.05, zR = -2.05;

  // Körper: kurze Haube, steiles Heck. Oberkante von hinten nach vorn
  const oben = [[zR, 0.95], [zR + 0.2, 1.02], [-0.9, 1.02], [0.55, 0.98], [VORN, 0.9], [zF - 0.3, 0.78], [zF, 0.62]];
  const unten = z => {
    let h = 0.2;
    for (const za of [VORN, HINTEN]) { const R = RAD + 0.06, dz = z - za; if (Math.abs(dz) < R) h = Math.max(h, RAD + Math.sqrt(R * R - dz * dz) * 0.9); }
    return h;
  };
  // Breite: über den Radläufen am breitesten (dicke Backen), an den Enden schmaler
  const breite = z => {
    let b = W * 0.9;
    for (const za of [VORN, HINTEN]) b = Math.max(b, W * (0.9 + 0.1 * Math.max(0, 1 - Math.abs(z - za) / 0.6)));
    const t = Math.min(z - zR, zF - z);
    return b * (0.82 + 0.18 * Math.min(1, t / 0.35));
  };
  const N = 40, schnitte = [];
  for (let k = 0; k <= N; k++) {
    const z = zR + (zF - zR) * k / N, u = unten(z), o = Math.max(u + 0.1, kurve(oben, z));
    schnitte.push([z, breite(z), (o - u) / 2, (o + u) / 2]);
  }
  add(new THREE.Mesh(rumpf(schnitte.reverse(), 3.4, 28), lack));
  add(kiste(W * 2 - 0.4, 0.3, zF - zR - 0.6, schwarz, 0, 0.3, 0));   // Unterboden (man sieht nicht durch die Radläufe)
  for (const za of [VORN, HINTEN]) add(kiste(W * 2 - 0.3, 0.5, 0.8, schwarz, 0, 0.45, za));

  // Kabine: Glas mit Dach in Wagenfarbe
  const kv = 0.55, kh = -1.8, dach = 1.45;
  const kab = [];
  for (let k = 0; k <= 18; k++) {
    const z = kh + (kv - kh) * k / 18, basis = kurve(oben, z) - 0.03;
    let top = dach;
    if (z > -0.25) top = basis + (dach - basis) * Math.pow(Math.max(0, (kv - z) / (kv + 0.25)), 0.75);   // schräge Frontscheibe
    if (z < -1.55) top = basis + (dach - basis) * Math.pow(Math.max(0, (z - kh) / 0.25), 0.6);         // fast senkrechtes Heck
    top = Math.max(basis + 0.01, top);
    kab.push([z, W * 0.78 * (0.85 + 0.15 * Math.min(1, (top - basis) / 0.35)), (top - basis) / 2, (top + basis) / 2]);
  }
  add(new THREE.Mesh(rumpf(kab.slice().reverse(), 3, 24), glas));
  const dachTeil = kab.filter(q => q[3] + q[2] > dach - 0.05).map(([z, kb, h, y]) => [z, kb * 0.9, 0.025, y + h + 0.005]);
  if (dachTeil.length > 2) add(new THREE.Mesh(rumpf(dachTeil.reverse(), 3.5, 16), lack));
  // Lufthutze auf dem Dach
  add(kiste(0.34, 0.08, 0.4, lack, 0, dach + 0.07, -0.35));
  add(kiste(0.26, 0.05, 0.02, schwarz, 0, dach + 0.07, -0.14));

  // Streifen: zwei breite Bänder über Haube, Dach und Heck (Zweitfarbe)
  for (const x of [-0.17, 0.17]) {
    const pts = [[zF - 0.2, 0.8], [VORN, 0.93], [kv - 0.05, 1.01], [0.05, dach + 0.04], [-1.4, dach + 0.04], [-1.75, 1.08], [zR + 0.1, 1.03]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [z0, y0] = pts[k], [z1, y1] = pts[k + 1];
      const l = Math.hypot(z1 - z0, y1 - y0), p = new THREE.Mesh(new THREE.PlaneGeometry(0.14, l), streifen);
      p.position.set(x, (y0 + y1) / 2 + 0.012, (z0 + z1) / 2); p.rotation.x = Math.atan2(z1 - z0, y1 - y0); add(p);   // flach auf die Karosserie legen, der Neigung folgend
    }
  }
  // Seiten: schräger Streifen und weiße Tafel mit Startnummer auf der Tür
  const nrMat = new THREE.MeshStandardMaterial({ map: nummer(num, '#111'), transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -4 });
  for (const s of [-1, 1]) {
    const x = s * (W * 0.93 + 0.012);
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.12), streifen);
    sb.position.set(x, 0.72, -0.2); sb.rotation.set(0, s * Math.PI / 2, s * 0.12); add(sb);
    const tafel = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.38), weiss);
    tafel.position.set(x + s * 0.003, 0.66, -0.25); tafel.rotation.y = s * Math.PI / 2; add(tafel);
    const nr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), nrMat);
    nr.position.set(x + s * 0.006, 0.66, -0.25); nr.rotation.y = s * Math.PI / 2; add(nr);
    // Schmutzfänger hinter den Rädern
    for (const za of [VORN, HINTEN]) add(kiste(0.02, 0.26, 0.3, schwarz, s * (W - 0.12), 0.18, za - 0.42));
    // Außenspiegel
    add(stange([s * W * 0.72, 1.06, kv - 0.1], [s * (W + 0.06), 1.1, kv - 0.15], 0.015, schwarz));
    add(kiste(0.12, 0.08, 0.06, lack, s * (W + 0.1), 1.1, kv - 0.16));
  }

  // Front: Scheinwerfer, Grill, Lampen-Leiste mit vier Zusatzscheinwerfern auf der Haube
  for (const s of [-1, 1]) add(kiste(0.34, 0.1, 0.05, scheinMat, s * 0.58, 0.68, zF - 0.06, 0, s * 0.2));
  add(kiste(0.75, 0.16, 0.05, schwarz, 0, 0.5, zF - 0.02));
  add(kiste(1.2, 0.05, 0.18, schwarz, 0, 0.27, zF + 0.04));   // Frontlippe
  add(kiste(1.15, 0.05, 0.08, schwarz, 0, 0.92, VORN + 0.45));
  for (let k = 0; k < 4; k++) {
    const x = (k - 1.5) * 0.27;
    const topf = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 14), schwarz);
    topf.rotation.x = Math.PI / 2; topf.position.set(x, 1.03, VORN + 0.5); add(topf);
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.085, 14), scheinMat); l.position.set(x, 1.03, VORN + 0.545); add(l);
  }
  // Heck: Rücklichter, großer Flügel, Auspuff
  for (const s of [-1, 1]) add(kiste(0.3, 0.12, 0.04, rueckMat, s * 0.62, 0.86, zR - 0.01));
  add(kiste(W * 1.6, 0.18, 0.12, schwarz, 0, 0.32, zR + 0.04));
  add(kiste(W * 2.02, 0.04, 0.34, schwarz, 0, dach + 0.12, -1.78, 0.12));
  for (const s of [-1, 1]) {
    add(kiste(0.03, 0.22, 0.4, streifen, s * W * 1.0, dach + 0.04, -1.76));
    add(stange([s * 0.4, dach - 0.03, -1.6], [s * 0.4, dach + 0.11, -1.72], 0.02, schwarz));
  }
  const rohr = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.2, metalness: 1 }));
  rohr.rotation.x = Math.PI / 2; rohr.position.set(-0.55, 0.3, zR - 0.02); add(rohr);

  // Fahrer mit Helm (man sieht ihn schwach durch die Scheibe)
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshStandardMaterial({ color: zweit, roughness: 0.4 }));
  helm.position.set(0.33, 1.2, -0.55); add(helm);

  // Räder
  const raeder = [], lenkVorn = [];
  for (const [z, k] of [[VORN, 0], [VORN, 1], [HINTEN, 2], [HINTEN, 3]]) {
    const s = k % 2 ? -1 : 1;
    const halter = new THREE.Group(); halter.position.set(s * (W - 0.15), RAD, z); auto.add(halter);
    const rd = rad(RAD, 0.26, mats); halter.add(rd); raeder.push(rd);
    if (k < 2) lenkVorn.push(halter);
  }

  auto.traverse(o => { if (o.isMesh) o.castShadow = true; });
  auto.scale.setScalar(massstab);
  const lenkrad = new THREE.Group();   // im Rallyeauto sitzt man nie (Kamera steht neben der Matte), das Lenkrad bleibt unsichtbar
  return { gruppe: auto, koerper, raeder, lenkVorn, lenkrad, licht: { material: rueckMat }, helm: [helm, helm], halo: [], massstab, scheinwerfer: scheinMat };
}
