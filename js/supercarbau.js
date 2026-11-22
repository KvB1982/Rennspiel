// Rennspiel – die Supercars in 3D, aus einfachen Formen gebaut.
//
// Jedes Auto entsteht aus Querschnitten wie ein Schiffsrumpf (rumpf aus autobau.js):
//   der Körper (unten breit, über den Rädern mit runden Radläufen), darauf die Kabine aus dunklem Glas.
// Die Form steuern ein paar Zahlen je Auto (FORMEN): wie hoch Nase, Haube, Hüfte und Heck sind, wo die Kabine sitzt,
// wie eckig alles ist. Dazu Scheinwerfer, Rücklichter, Lufteinlässe, Flügel und Auspuff.
// Alle Formen sind ausgedacht und nur an die Vorbilder angelehnt – keine Logos, keine echten Lackierungen.
// Vorn ist +z, links ist +x. Der Nullpunkt liegt im Schwerpunkt zwischen den Achsen (wie beim Rennwagen).
//
// Seit November 2026 gibt es dazu fertige Modelle aus 3D AI Studio (modelle/supercars/<id>.glb, gemacht mit
// tools/supercars.mjs): Karosserie mit Farbbild und vier einzelne Räder, die sich drehen und vorn einlenken.
// ladeSupercars() holt sie vor dem Rennen. Von außen sieht man dann das fertige Modell; in der Cockpit-Kamera
// bleibt das selbst gebaute Auto mit Armaturenbrett und Lenkrad (m.sicht schaltet um). Ohne Modell bleibt alles wie früher.

import * as THREE from 'three';
import { rumpf, rad, stange } from './autobau.js';
import { ladeSupercars as laden, ladeRallye, echtesAuto, lackMaterial } from './automodelle.js';
import { supercar, SUPERCARS } from './supercars.js';
import { RALLYEAUTOS } from './rallyeautos.js';
import { baueAnzeige, baueLenkrad, kartenBild, lueftung, schalterReihe, stab, klotz } from './cockpit.js';

// Farbe von Nähten und Zierleisten im Innenraum je Auto (fehlt eins: rotbraun)
const INNEN_FARBE = { falkner: 0xb5482a, falkner_s: 0xc9a227, taurino: 0xe2b714, stallone: 0xc41e1e, aurelion: 0x2f6fd6, nordvind: 0xe86a17, vento: 0x8b5a2b };

// Alle Supercar-Modelle laden (siehe js/automodelle.js)
export const ladeSupercars = opt => laden(SUPERCARS.map(S => S.id), opt);
// Alle Rallyeauto-Modelle laden
export const ladeRallyeautos = opt => ladeRallye(RALLYEAUTOS.map(S => S.id), opt);

const VORN = 1.25, HINTEN = -1.45;   // Achsen (wie in supercars.js: a = 1,25 m, b = 1,45 m)
const RAD = 0.35;                    // Radhalbmesser

// Die Formen. Höhen in Metern über der Straße, z in Metern (vorn plus).
//   W = halbe Breite, zF/zR = Spitze vorn/hinten, nase/haube/huefte/heck = Höhe der Oberkante,
//   kv/kh = Kabine von/bis, dach = Dachhöhe, scheibe = wie weit die Frontscheibe nach hinten reicht, flach = Länge des flachen Dachs,
//   rund = 2 rund … 5 eckig, licht/ruecklicht = Art der Lampen, einlass = Lufteinlass vor dem Hinterrad,
//   fluegel = Heckflügel (0 = keiner, 1 = klein, 2 = groß), auspuff = Art, kabineBreit = Breite der Kabine (Anteil von W)
export const FORMEN = {
  falkner: { W: 0.95, zF: 2.2, zR: -2.35, nase: 0.6, haube: 0.8, huefte: 0.9, heck: 0.84, kv: 0.45, kh: -2.0, dach: 1.3, scheibe: 0.85, flach: 0.55, rund: 2.8,
    licht: 'rund', ruecklicht: 'band', einlass: false, fluegel: 1, auspuff: 'zwei', kabineBreit: 0.74 },
  taurino: { W: 1.02, zF: 2.4, zR: -2.4, nase: 0.42, haube: 0.76, huefte: 0.92, heck: 0.94, kv: 0.95, kh: -1.15, dach: 1.13, scheibe: 1.15, flach: 0.35, rund: 5,
    licht: 'keil', ruecklicht: 'y', einlass: true, fluegel: 1, auspuff: 'mitte', kabineBreit: 0.7 },
  stallone: { W: 0.99, zF: 2.45, zR: -2.3, nase: 0.47, haube: 0.72, huefte: 0.93, heck: 0.9, kv: 0.7, kh: -1.25, dach: 1.18, scheibe: 0.95, flach: 0.45, rund: 3.2,
    licht: 'schlitz', ruecklicht: 'rund', einlass: true, fluegel: 0, auspuff: 'zwei', kabineBreit: 0.68 },
  aurelion: { W: 1.02, zF: 2.3, zR: -2.3, nase: 0.62, haube: 0.82, huefte: 0.96, heck: 0.96, kv: 0.8, kh: -1.2, dach: 1.21, scheibe: 0.9, flach: 0.5, rund: 3,
    licht: 'vier', ruecklicht: 'band', einlass: true, fluegel: 1, auspuff: 'mitte', kabineBreit: 0.66, hufeisen: true, bogen: true },
  nordvind: { W: 1.0, zF: 2.3, zR: -2.3, nase: 0.5, haube: 0.8, huefte: 0.96, heck: 0.98, kv: 0.75, kh: -1.05, dach: 1.2, scheibe: 0.95, flach: 0.4, rund: 3.5,
    licht: 'schlitz', ruecklicht: 'rund', einlass: true, fluegel: 2, auspuff: 'mitte', kabineBreit: 0.66, streifen: true },
  vento: { W: 1.0, zF: 2.3, zR: -2.25, nase: 0.55, haube: 0.82, huefte: 0.95, heck: 0.9, kv: 0.8, kh: -0.95, dach: 1.17, scheibe: 0.95, flach: 0.35, rund: 2.6,
    licht: 'turm', ruecklicht: 'rund', einlass: true, fluegel: 0, auspuff: 'vier', kabineBreit: 0.64, klappen: true },
  // wie der Falkner, nur ohne Heckflügel (die Form sieht man nur im Cockpit oder wenn das Modell fehlt)
  falkner_s: { W: 0.93, zF: 2.2, zR: -2.3, nase: 0.6, haube: 0.8, huefte: 0.88, heck: 0.84, kv: 0.45, kh: -2.0, dach: 1.3, scheibe: 0.85, flach: 0.55, rund: 2.8,
    licht: 'rund', ruecklicht: 'band', einlass: false, fluegel: 0, auspuff: 'zwei', kabineBreit: 0.74 },
  // Rallyeautos: kurz und hoch (Kleinwagen, Coupé, Limousine), großer Heckflügel
  sturmfalke: { W: 0.9, zF: 2.0, zR: -2.1, nase: 0.62, haube: 0.88, huefte: 0.95, heck: 1.0, kv: 0.6, kh: -1.95, dach: 1.45, scheibe: 0.8, flach: 1.2, rund: 3.4,
    licht: 'schlitz', ruecklicht: 'rund', einlass: false, fluegel: 2, auspuff: 'zwei', kabineBreit: 0.8 },
  quadra: { W: 0.9, zF: 2.0, zR: -2.2, nase: 0.62, haube: 0.86, huefte: 0.92, heck: 0.95, kv: 0.55, kh: -1.6, dach: 1.36, scheibe: 0.75, flach: 0.8, rund: 4.6,
    licht: 'vier', ruecklicht: 'band', einlass: false, fluegel: 2, auspuff: 'zwei', kabineBreit: 0.8 },
  kaiten: { W: 0.9, zF: 2.15, zR: -2.2, nase: 0.6, haube: 0.84, huefte: 0.92, heck: 0.98, kv: 0.6, kh: -1.35, dach: 1.4, scheibe: 0.8, flach: 0.9, rund: 3.6,
    licht: 'vier', ruecklicht: 'band', einlass: false, fluegel: 2, auspuff: 'zwei', kabineBreit: 0.8 },
};

// weich zwischen Stützwerten [z, Wert] hin und her (Werte nach z sortiert)
function kurve(punkte, z) {
  if (z <= punkte[0][0]) return punkte[0][1];
  for (let k = 1; k < punkte.length; k++) {
    const [z1, v1] = punkte[k], [z0, v0] = punkte[k - 1];
    if (z <= z1) { const t = (z - z0) / (z1 - z0 || 1), w = (1 - Math.cos(t * Math.PI)) / 2; return v0 + (v1 - v0) * w; }
  }
  return punkte[punkte.length - 1][1];
}

// Wie hoch ist die Unterkante des Körpers bei z? Über den Rädern ein runder Bogen (Radlauf).
function unterkante(z) {
  let h = 0.16;
  for (const za of [VORN, HINTEN]) {
    const R = RAD + 0.05, dz = z - za;
    if (Math.abs(dz) < R) h = Math.max(h, RAD + Math.sqrt(R * R - dz * dz) * 0.95);
  }
  return h;
}

const kiste = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true;
  return m;
};

export function baueSupercar(id, { farbe = null } = {}) {
  const S = supercar(id), F = FORMEN[S.id];
  const lackFarbe = farbe ?? S.farbe;
  const lack = new THREE.MeshPhysicalMaterial({ color: lackFarbe, roughness: 0.28, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 });
  const akzent = new THREE.MeshPhysicalMaterial({ color: S.zweit, roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const schwarz = new THREE.MeshStandardMaterial({ color: 0x131416, roughness: 0.55, metalness: 0.3 });
  const glas = new THREE.MeshPhysicalMaterial({ color: 0x0b1118, roughness: 0.05, metalness: 0.4, clearcoat: 1, transparent: true, opacity: 0.9 });
  const chrom = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.15, metalness: 1 });
  const scheinMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, emissive: 0xdfefff, emissiveIntensity: 1.2, roughness: 0.2 });
  const rueckMat = new THREE.MeshStandardMaterial({ color: 0x500000, emissive: 0xff1010, emissiveIntensity: 0.6, roughness: 0.3 });
  const innenMat = new THREE.MeshStandardMaterial({ color: 0x1d1e22, roughness: 0.8, side: THREE.DoubleSide });
  const leder = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.7 });
  const mats = {
    reifen: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
    felge: new THREE.MeshStandardMaterial({ color: 0x2b2c30, roughness: 0.3, metalness: 0.9 }),
    felgeHell: new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.2, metalness: 1 }),
    mischung: new THREE.MeshStandardMaterial({ color: S.id === 'stallone' ? 0xf4d23c : 0xc8c8c8, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
  };

  const auto = new THREE.Group();
  const koerper = new THREE.Group(); auto.add(koerper);
  const add = m => { koerper.add(m); m.castShadow = true; return m; };
  const { W, zF, zR } = F;

  // Oberkante des Körpers von hinten nach vorn
  const oben = [[zR, F.heck - 0.12], [zR + 0.25, F.heck], [Math.max(zR + 0.5, F.kh), F.huefte], [HINTEN + 0.5, F.huefte],
    [F.kv, F.haube], [VORN, F.haube - 0.04], [zF - 0.35, F.nase + 0.06], [zF, F.nase - 0.08]].sort((p, q) => p[0] - q[0]);
  // halbe Breite: an den Enden schmaler, über den Rädern am breitesten
  const breite = z => {
    const t = (z - zR) / (zF - zR);
    const ende = Math.min(1, Math.min(t, 1 - t) * 6);
    return W * (0.8 + 0.2 * Math.sin(ende * Math.PI / 2)) - (z > VORN + 0.6 ? (z - VORN - 0.6) * 0.12 : 0);
  };
  const N = 44, schnitte = [];
  for (let k = 0; k <= N; k++) {
    const z = zR + (zF - zR) * k / N;
    const u = unterkante(z), o = Math.max(u + 0.08, kurve(oben, z));
    schnitte.push([z, breite(z), (o - u) / 2, (o + u) / 2]);
  }
  schnitte.reverse();                                                  // rumpf will die Schnitte von vorn nach hinten
  const huelle = add(new THREE.Mesh(rumpf(schnitte, F.rund, 28), lack));
  // Im Cockpit wird die ganze Hülle ausgeblendet (ihr Blech läge sonst mitten im Innenraum). Dafür gibt es
  // die Haube noch einmal allein: nur das Stück vor der Scheibe.
  const haubeInnen = new THREE.Mesh(rumpf(schnitte.filter(q => q[0] >= F.kv - 0.12), F.rund, 28), lack);
  // dunkler Unterboden, damit man durch die Radläufe nicht hindurchsieht
  add(kiste(W * 2 - 0.5, 0.26, zF - zR - 1.2, schwarz, 0, 0.27, (zF + zR) / 2));
  for (const za of [VORN, HINTEN]) { const t = Math.min(0.64, kurve(oben, za) - 0.06); add(kiste(W * 2 - 0.4, t - 0.2, 0.8, schwarz, 0, (t + 0.2) / 2, za)); }

  // Kabine aus Glas: steigt an der Frontscheibe an, flaches Dach, fällt nach hinten ab
  const dachVorn = F.kv - F.scheibe, dachHinten = dachVorn - F.flach;
  const kab = [];
  const KN = 22;
  for (let k = 0; k <= KN; k++) {
    const z = F.kh + (F.kv - F.kh) * k / KN;
    const basis = kurve(oben, z) - 0.03;
    let top;
    if (z > dachVorn) top = basis + (F.dach - basis) * Math.pow(Math.max(0, (F.kv - z) / F.scheibe), 0.8);
    else if (z > dachHinten) top = F.dach;
    else top = basis + (F.dach - basis) * Math.pow(Math.max(0, (z - F.kh) / (dachHinten - F.kh)), 0.7);
    top = Math.max(basis + 0.01, top);
    const kb = W * F.kabineBreit * (0.8 + 0.2 * Math.min(1, (top - basis) / 0.3));
    kab.push([z, kb, (top - basis) / 2, (top + basis) / 2]);
  }
  add(new THREE.Mesh(rumpf(kab.slice().reverse(), 2.6, 24), glas));
  // Dach in Wagenfarbe (eine dünne Haut oben auf dem Glas)
  const dachSchnitte = kab.filter(q => q[3] + q[2] > F.dach - 0.12).map(([z, kb, h, y]) => [z, kb * 0.82, 0.02, y + h + 0.004]);
  // (Im Cockpit wird die Haut ausgeblendet: Sie liegt dicht über den Augen und schwenkt sonst in jeder Kurve groß ins Bild.)
  const dachHaut = dachSchnitte.length > 2 ? add(new THREE.Mesh(rumpf(dachSchnitte.reverse(), 3, 16), lack)) : null;

  // Scheinwerfer
  const vorne = zF - 0.18;
  const yLicht = F.nase + 0.02;
  const lampe = (x, y, z, w, h, d, ry = 0) => add(kiste(w, h, d, scheinMat, x, y, z, 0, ry));
  for (const s of [-1, 1]) {
    const x = s * (W - 0.3);
    if (F.licht === 'rund') {
      const r = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), scheinMat);
      r.position.set(x, kurve(oben, VORN + 0.55) - 0.02, VORN + 0.62); r.rotation.x = -0.9; add(r);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.13, 20), chrom); ring.position.copy(r.position); ring.rotation.copy(r.rotation); ring.position.y += 0.003; add(ring);
    } else if (F.licht === 'turm') {
      for (const k of [0, 1]) { const r = new THREE.Mesh(new THREE.CircleGeometry(0.055, 14), scheinMat); r.position.set(x - s * k * 0.05, yLicht - 0.02 + k * 0.08, vorne - 0.05 - k * 0.08); r.rotation.x = -0.4; add(r); }
    } else if (F.licht === 'vier') {
      for (let k = 0; k < 4; k++) lampe(x - s * k * 0.08, yLicht - 0.02, vorne - 0.06 - k * 0.04, 0.05, 0.04, 0.02);
    } else if (F.licht === 'keil') {
      lampe(x, yLicht - 0.01, vorne - 0.05, 0.42, 0.04, 0.12, s * 0.25);
      lampe(x + s * 0.12, yLicht - 0.08, vorne - 0.02, 0.18, 0.025, 0.05, -s * 0.5);
    } else {
      lampe(x, yLicht - 0.01, vorne - 0.06, 0.34, 0.04, 0.1, s * 0.18);
    }
  }
  // Mund / Kühlergrill
  if (F.hufeisen) {
    // hoher Grill in Hufeisen-Form mit Chromrand
    const g = new THREE.Shape(); g.moveTo(-0.17, 0); g.lineTo(0.17, 0); g.quadraticCurveTo(0.2, 0.18, 0, 0.3); g.quadraticCurveTo(-0.2, 0.18, -0.17, 0);
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(g), schwarz); gm.position.set(0, 0.22, zF - 0.02); add(gm);
    const rand = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.17, 0], [-0.19, 0.16], [0, 0.31], [0.19, 0.16], [0.17, 0]].map(([x, y]) => new THREE.Vector3(x, y, 0))), 20, 0.012, 6), chrom);
    rand.position.set(0, 0.22, zF - 0.01); add(rand);
  } else {
    const mund = kiste(W * 1.3, 0.12, 0.05, schwarz, 0, 0.25, zF - 0.06); add(mund);
  }
  for (const s of [-1, 1]) add(kiste(0.3, 0.16, 0.05, schwarz, s * (W - 0.28), 0.24, zF - 0.12));

  // Rücklichter (leuchten beim Bremsen heller)
  const hinten = zR + 0.03, yR = F.heck - 0.12;
  if (F.ruecklicht === 'band') add(kiste(W * 1.7, 0.045, 0.03, rueckMat, 0, yR, hinten));
  for (const s of [-1, 1]) {
    const x = s * (W - 0.25);
    if (F.ruecklicht === 'rund') {
      for (const k of [0, 1]) { const r = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), rueckMat); r.position.set(x - s * k * 0.17, yR, hinten - 0.01); r.rotation.y = Math.PI; add(r); }
    } else if (F.ruecklicht === 'y') {
      add(kiste(0.32, 0.035, 0.03, rueckMat, x, yR + 0.03, hinten, 0, 0, s * 0.35));
      add(kiste(0.32, 0.035, 0.03, rueckMat, x, yR - 0.06, hinten, 0, 0, -s * 0.35));
    } else add(kiste(0.3, 0.07, 0.03, rueckMat, x, yR, hinten));
  }
  // Diffusor und Auspuff
  add(kiste(W * 1.5, 0.16, 0.25, schwarz, 0, 0.24, zR + 0.12));
  const rohr = (x, y, r = 0.045) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 12), chrom); m.rotation.x = Math.PI / 2; m.position.set(x, y, zR + 0.02); add(m); };
  if (F.auspuff === 'zwei') for (const s of [-1, 1]) rohr(s * 0.45, 0.25);
  else if (F.auspuff === 'mitte') { rohr(-0.08, 0.38, 0.06); rohr(0.08, 0.38, 0.06); }
  else if (F.auspuff === 'vier') for (const x of [-0.06, 0.06]) for (const y of [0.34, 0.44]) rohr(x, y, 0.04);

  // Lufteinlass vor dem Hinterrad (Mittelmotor)
  if (F.einlass) for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.22), schwarz);
    e.position.set(s * (breite(-0.6) + 0.004), 0.62, -0.55); e.rotation.y = s * Math.PI / 2; add(e);
  }
  // Seitenstreifen in der Zweitfarbe
  if (F.streifen) for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(zF - zR - 1.2, 0.07), akzent);
    st.position.set(s * (W + 0.005), 0.5, (zF + zR) / 2 + 0.2); st.rotation.y = s * Math.PI / 2; add(st);
  }
  // Bogen um die Tür (Zweitfarbe), wie ein großes "C"
  if (F.bogen) for (const s of [-1, 1]) {
    const pts = [[0.6, 0.35], [0.45, 0.75], [0.0, 0.88], [-0.55, 0.86], [-0.75, 0.6]].map(([z, y]) => new THREE.Vector3(s * (W + 0.008), y, z));
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.03, 6), chrom));
  }
  // Klappen am Heck (hochgestellt)
  if (F.klappen) for (const s of [-1, 1]) add(kiste(0.4, 0.015, 0.2, lack, s * 0.55, F.heck + 0.06, zR + 0.35, -0.35));

  // Heckflügel
  if (F.fluegel === 1) add(kiste(W * 1.5, 0.03, 0.22, F.id === 'falkner' ? lack : schwarz, 0, F.heck + 0.04, zR + 0.3, 0.12));
  if (F.fluegel === 2) {
    add(kiste(W * 1.9, 0.035, 0.34, schwarz, 0, F.heck + 0.36, zR + 0.32, 0.18));
    for (const s of [-1, 1]) {
      add(stange([s * 0.35, F.heck - 0.04, zR + 0.55], [s * 0.35, F.heck + 0.34, zR + 0.28], 0.018, schwarz));
      add(kiste(0.02, 0.24, 0.42, akzent, s * W * 0.95, F.heck + 0.32, zR + 0.32));
    }
  }
  // Außenspiegel
  for (const s of [-1, 1]) {
    const y = kurve(oben, F.kv - 0.2) + 0.1, z = F.kv - 0.22;
    add(stange([s * W * 0.82, y - 0.06, z + 0.04], [s * (W + 0.1), y, z], 0.015, schwarz));
    add(kiste(0.16, 0.08, 0.06, lack, s * (W + 0.14), y, z));
  }

  // Fahrer: Kopf (man sieht ihn nur schwach durch das dunkle Glas). Im Cockpit wird er ausgeblendet.
  // auge = wo die Augen des Fahrers sind (links im Auto). Alles im Cockpit wird von dort aus hingestellt,
  // damit Lenkrad, Hände und Anzeige bei jedem Auto gut im Bild liegen.
  const rallyeArt = RALLYEAUTOS.includes(S);
  const auge = [0.36, F.dach - 0.16, F.kv - F.scheibe - 0.15];
  const [ax, ay, az] = auge;
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }));
  kopf.position.set(ax, ay - 0.02, az + 0.02); add(kopf);

  // ---------- Innenraum (nur im Cockpit zu sehen) ----------
  const innen = new THREE.Group(); koerper.add(innen);
  const drin = m => { innen.add(m); return m; };
  const hb = kurve(oben, F.kv), kb = W * F.kabineBreit;
  drin(haubeInnen);
  const naht = rallyeArt ? 0xc0181c : (INNEN_FARBE[S.id] ?? 0xb5482a);          // Farbe der Nähte und Zierleisten
  const zier = new THREE.MeshStandardMaterial({ color: naht, roughness: 0.55 });
  const weich = new THREE.MeshStandardMaterial({ color: 0x26272c, roughness: 0.95 });   // gepolsterte Flächen (etwas heller als das Brett)
  const alu = new THREE.MeshStandardMaterial({ color: 0xaeb3bb, roughness: 0.3, metalness: 0.9 });
  const loch = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1 });

  // Armaturenbrett: eine Platte bis zur Scheibe und eine Front zum Fahrer hin
  const brettOben = Math.min(hb + 0.08, ay - 0.12), brettHinten = az + 0.7, tiefe = Math.max(0.3, F.kv - brettHinten + 0.05);
  drin(klotz(W * 1.75, 0.05, tiefe, innenMat, 0, brettOben - 0.025, brettHinten + tiefe / 2));
  drin(klotz(W * 1.75, 0.36, 0.06, weich, 0, brettOben - 0.2, brettHinten + 0.03));
  drin(klotz(W * 1.75, 0.009, 0.012, zier, 0, brettOben + 0.001, brettHinten + 0.004));            // farbige Naht an der Kante
  drin(klotz(W * 1.75, 0.012, 0.008, alu, 0, brettOben - 0.2, brettHinten - 0.002));               // Zierleiste quer über die Front

  // Boden, Wand zum Motorraum und Rückwand (dunkel, damit man nirgends auf die Straße hinunterschaut)
  drin(klotz(W * 1.9, 0.04, F.kv - az + 0.9, innenMat, 0, 0.3, (F.kv + az - 0.9) / 2));
  drin(klotz(W * 1.9, brettOben - 0.3, 0.04, innenMat, 0, (brettOben + 0.3) / 2, brettHinten + 0.12));
  drin(klotz(W * 1.9, F.dach - 0.3, 0.04, weich, 0, (F.dach + 0.3) / 2, az - 0.5));
  for (const s of [-1, 1]) drin(klotz(0.04, hb - 0.2, F.kv - az + 0.5, innenMat, s * W * 0.97, (hb + 0.2) / 2 + 0.05, (F.kv + az - 0.5) / 2));

  // Lenkrad mit Händen (dreht sich mit dem Einschlag), dahinter die Lenksäule mit Hebeln
  const ly = ay - 0.29, lz = az + 0.5;
  const lenk = baueLenkrad(rallyeArt ? 'sport' : 'rund', { r: rallyeArt ? 0.165 : 0.175, naht, handschuh: rallyeArt ? 0x16171a : 0x2a211c, aermel: rallyeArt ? 0x1a2348 : 0x2b2d33 });
  const lenkrad = lenk.gruppe; lenk.halter.position.set(ax, ly, lz); lenk.halter.rotation.x = 0.38; innen.add(lenk.halter);
  drin(stab([ax, ly, lz + 0.02], [ax, ly - 0.07, brettHinten + 0.04], 0.03, innenMat, 0.036));
  if (!rallyeArt) for (const s of [-1, 1]) drin(stab([ax, ly - 0.03, lz + 0.09], [ax + s * 0.2, ly - 0.02, lz + 0.07], 0.008, innenMat));   // Blinker- und Wischerhebel

  // Anzeige hinter dem Lenkrad: zeigt wirklich Tempo, Gang und Drehzahl (durch das Lenkrad hindurch zu sehen)
  const anz = baueAnzeige(rallyeArt ? 0.26 : 0.3, 0.12, { art: rallyeArt ? 'renn' : 'rund', farbe: rallyeArt ? '#39ff8a' : '#' + new THREE.Color(naht).lerp(new THREE.Color(0xffffff), 0.35).getHexString() });
  const anzY = ly + 0.085, anzOben = anzY + 0.075;
  anz.mesh.position.set(ax, anzY, brettHinten - 0.012); anz.mesh.rotation.x = 0.12; drin(anz.mesh);
  // Gehäuse um die Anzeige: Rückwand, Dach gegen die Sonne, zwei Wangen
  drin(klotz(0.36, Math.max(0.17, anzOben - brettOben + 0.2), 0.05, innenMat, ax, anzOben - Math.max(0.17, anzOben - brettOben + 0.2) / 2 + 0.01, brettHinten + 0.02));
  drin(klotz(0.38, 0.022, 0.13, innenMat, ax, anzOben + 0.012, brettHinten + 0.0));
  for (const s of [-1, 1]) drin(klotz(0.02, 0.16, 0.11, innenMat, ax + s * 0.18, anzY, brettHinten + 0.01));

  // Scheibensäulen, Dachkante, Sonnenblenden, Innenspiegel
  const saeuleUnten = [kb * 0.95, hb + 0.02, F.kv - 0.05], saeuleOben = [kb * 0.78, F.dach - 0.02, dachVorn];
  for (const s of [-1, 1]) {
    drin(stange([s * saeuleUnten[0], saeuleUnten[1], saeuleUnten[2]], [s * saeuleOben[0], saeuleOben[1], saeuleOben[2]], 0.035, innenMat));
    drin(klotz(0.3, 0.012, 0.13, weich, s * 0.36, F.dach - 0.045, dachVorn + 0.03, -0.25));        // Sonnenblende
  }
  drin(klotz(kb * 1.6, 0.05, 0.06, innenMat, 0, F.dach - 0.03, dachVorn));
  const spiegelY = hb + (F.dach - hb) * 0.86;
  drin(stab([0, spiegelY + 0.05, dachVorn + 0.2], [0, spiegelY, dachVorn + 0.17], 0.008, innenMat));
  drin(klotz(0.24, 0.065, 0.02, innenMat, 0, spiegelY - 0.02, dachVorn + 0.165));
  drin(klotz(0.22, 0.05, 0.004, chrom, 0, spiegelY - 0.02, dachVorn + 0.153));

  // Türen: Verkleidung, Armlehne mit farbiger Leiste, Griff
  for (const s of [-1, 1]) {
    const x = s * kb * 0.98, zt = (F.kv + dachHinten) / 2 - 0.2;
    const tuer = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), weich); tuer.position.set(x, hb - 0.17, zt); tuer.rotation.y = Math.PI / 2; drin(tuer);
    drin(klotz(0.07, 0.05, 0.75, innenMat, x - s * 0.035, hb - 0.16, az + 0.2));
    drin(klotz(0.012, 0.012, 1.1, zier, x - s * 0.008, hb + 0.06, az + 0.25));
    drin(klotz(0.012, 0.014, 0.08, alu, x - s * 0.012, hb - 0.03, az + 0.5));
    if (rallyeArt) {   // Überrollkäfig: Kreuz in der Tür und ein Rohr an der Scheibensäule
      const rohr = alu;
      drin(stange([s * kb * 0.9, hb - 0.3, F.kv - 0.15], [s * kb * 0.9, hb - 0.02, az - 0.4], 0.02, rohr));
      drin(stange([s * kb * 0.9, hb - 0.02, F.kv - 0.15], [s * kb * 0.9, hb - 0.3, az - 0.4], 0.02, rohr));
    }
  }

  // Mitte: Konsole zwischen den Sitzen, darüber Bildschirm und Lüftung (Rallye: Schalter und Hebel)
  drin(klotz(0.22, 0.09, 0.62, innenMat, 0, ay - 0.5, az + 0.34, -0.22));
  if (rallyeArt) {
    const schalter = schalterReihe(6, 0.035, alu); schalter.position.set(0, brettOben - 0.11, brettHinten - 0.004); drin(schalter);
    drin(klotz(0.26, 0.085, 0.01, new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.4, metalness: 0.6 }), 0, brettOben - 0.1, brettHinten - 0.001));
    // Wegstreckenzähler vor dem Beifahrer (mit grüner Leuchtschrift)
    drin(klotz(0.22, 0.09, 0.05, innenMat, -ax, brettOben + 0.045, brettHinten + 0.05));
    drin(klotz(0.17, 0.045, 0.006, new THREE.MeshStandardMaterial({ color: 0x06140a, emissive: 0x30e060, emissiveIntensity: 0.8 }), -ax, brettOben + 0.047, brettHinten + 0.022));
    // langer Schalthebel und Handbremshebel, hoch und griffbereit neben dem Lenkrad
    const rot = new THREE.MeshStandardMaterial({ color: 0xc0181c, roughness: 0.5 });
    drin(stab([0.1, ay - 0.5, az + 0.32], [0.13, ly - 0.03, az + 0.42], 0.011, alu));
    const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), rot); knauf.position.set(0.13, ly - 0.02, az + 0.42); drin(knauf);
    drin(stab([-0.02, ay - 0.5, az + 0.24], [-0.02, ly + 0.02, az + 0.36], 0.013, alu));
    drin(stab([-0.02, ly - 0.07, az + 0.335], [-0.02, ly + 0.03, az + 0.365], 0.02, weich));
    drin(klotz(0.3, 0.16, 0.1, rot, -ax, ay - 0.02, az - 0.12));   // Kopfstütze am Schalensitz des Beifahrers
    drin(klotz(0.42, 0.5, 0.1, rot, -ax, ay - 0.36, az - 0.1));
  } else {
    drin(klotz(0.27, 0.165, 0.012, alu, 0, brettOben - 0.1, brettHinten + 0.001));
    const karte = kartenBild(0.25, 0.145, anz.mesh.material.color ? '#39c2ff' : '#39c2ff'); karte.position.set(0, brettOben - 0.1, brettHinten - 0.007); drin(karte);
    for (const x of [0.2, -0.2, -(kb - 0.13), kb - 0.13]) { const l = lueftung(0.036, alu, loch); l.position.set(x, brettOben - 0.09, brettHinten - 0.004); drin(l); }
    // Wählhebel und drei leuchtende Tasten auf der Konsole
    drin(stab([0, ay - 0.47, az + 0.38], [0, ay - 0.39, az + 0.4], 0.012, alu));
    const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), leder); knauf.position.set(0, ay - 0.38, az + 0.4); drin(knauf);
    [0xff4a3a, 0xe9edf2, 0x39c2ff].forEach((f, k) => drin(klotz(0.03, 0.01, 0.03, new THREE.MeshStandardMaterial({ color: f, emissive: f, emissiveIntensity: 0.6 }), (k - 1) * 0.05, ay - 0.41, az + 0.52, -0.22)));
    // Beifahrersitz mit Kopfstütze und farbiger Naht
    drin(klotz(0.46, 0.55, 0.12, leder, -ax, ay - 0.38, az - 0.12));
    drin(klotz(0.24, 0.16, 0.1, leder, -ax, ay - 0.02, az - 0.12));
    drin(klotz(0.012, 0.5, 0.125, zier, -ax, ay - 0.38, az - 0.12));
  }
  innen.traverse(o => { o.castShadow = false; });
  innen.visible = false;

  // Gibt es das fertige Modell? Dann kommt alles bisher Gebaute in eine Gruppe "alt" (nur im Cockpit zu sehen)
  const E = echtesAuto(S.id);
  const raeder = [], lenkVorn = [];
  let sicht = null;
  if (E) {
    const alt = new THREE.Group();
    for (const kind of [...koerper.children]) if (kind !== innen) alt.add(kind);
    koerper.add(alt); alt.visible = false;
    const neu = new THREE.Mesh(E.koerper, lackMaterial(E.bild, lackFarbe)); koerper.add(neu);
    const radMat = lackMaterial(E.bild, 0x2a2b30);   // blaue Spiegelungen auf den Felgen werden dunkelgrau
    E.raeder.forEach((R, k) => {
      const halter = new THREE.Group(); halter.position.copy(R.ort); auto.add(halter);
      const rd = new THREE.Mesh(R.form, radMat); halter.add(rd); raeder.push(rd);
      if (k < 2) lenkVorn.push(halter);
    });
    sicht = imAuto => { alt.visible = imAuto; neu.visible = !imAuto; };
  }
  // Räder mit Bremssätteln
  for (const [z, b, k] of E ? [] : [[VORN, 0.26, 0], [VORN, 0.26, 1], [HINTEN, 0.32, 2], [HINTEN, 0.32, 3]]) {
    const s = k % 2 ? -1 : 1;
    const halter = new THREE.Group(); halter.position.set(s * (W - 0.12), RAD, z); auto.add(halter);
    const rd = rad(RAD, b, mats); halter.add(rd); raeder.push(rd);
    if (k < 2) lenkVorn.push(halter);
  }

  auto.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // Glas soll keine harten Schatten ins Auto werfen
  return { gruppe: auto, koerper, raeder, lenkVorn, lenkrad, licht: { material: rueckMat }, helm: [kopf, kopf], halo: [], innen, auge, blickTief: 2.7, zeige: (a, mal) => anz.male(a, mal), lenkStellen: lenk.stelle, scheinwerfer: scheinMat, massstab: 1, supercar: true, sicht, dachHaut, huelle };
}
