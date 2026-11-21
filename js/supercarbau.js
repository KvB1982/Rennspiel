// Rennspiel – die Supercars in 3D, aus einfachen Formen gebaut.
//
// Jedes Auto entsteht aus Querschnitten wie ein Schiffsrumpf (rumpf aus autobau.js):
//   der Körper (unten breit, über den Rädern mit runden Radläufen), darauf die Kabine aus dunklem Glas.
// Die Form steuern ein paar Zahlen je Auto (FORMEN): wie hoch Nase, Haube, Hüfte und Heck sind, wo die Kabine sitzt,
// wie eckig alles ist. Dazu Scheinwerfer, Rücklichter, Lufteinlässe, Flügel und Auspuff.
// Alle Formen sind ausgedacht und nur an die Vorbilder angelehnt – keine Logos, keine echten Lackierungen.
// Vorn ist +z, links ist +x. Der Nullpunkt liegt im Schwerpunkt zwischen den Achsen (wie beim Rennwagen).

import * as THREE from 'three';
import { rumpf, rad, stange } from './autobau.js';
import { supercar } from './supercars.js';

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
  add(new THREE.Mesh(rumpf(schnitte.reverse(), F.rund, 28), lack));   // rumpf will die Schnitte von vorn nach hinten
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
  if (dachSchnitte.length > 2) add(new THREE.Mesh(rumpf(dachSchnitte.reverse(), 3, 16), lack));

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
  const auge = [0.36, F.dach - 0.16, F.kv - F.scheibe - 0.05];
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }));
  kopf.position.set(auge[0], auge[1] - 0.02, auge[2] - 0.08); add(kopf);

  // Innenraum (nur im Cockpit zu sehen): Armaturenbrett, Säulen der Scheibe, Türverkleidung, Lenkrad
  const innen = new THREE.Group(); koerper.add(innen);
  const hb = kurve(oben, F.kv);
  const brett = new THREE.Mesh(new THREE.BoxGeometry(W * 1.7, 0.12, 0.45), innenMat); brett.position.set(0, hb + 0.02, F.kv - 0.32); innen.add(brett);
  const tacho = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x2a7fff, emissiveIntensity: 0.5 }));
  tacho.position.set(auge[0], hb + 0.085, F.kv - 0.5); tacho.rotation.x = -0.6; innen.add(tacho);
  for (const s of [-1, 1]) {
    innen.add(stange([s * W * F.kabineBreit * 0.95, hb + 0.02, F.kv - 0.05], [s * W * F.kabineBreit * 0.78, F.dach - 0.02, dachVorn], 0.035, innenMat));
    const tuer = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), innenMat);
    tuer.position.set(s * (W * F.kabineBreit * 0.98), hb - 0.1, (F.kv + dachHinten) / 2 - 0.2); tuer.rotation.y = Math.PI / 2; innen.add(tuer);
  }
  innen.add(kiste(W * 2 * F.kabineBreit * 0.8, 0.05, 0.06, innenMat, 0, F.dach - 0.03, dachVorn));
  innen.add(kiste(0.2, 0.05, 0.02, chrom, 0, F.dach - 0.1, dachVorn - 0.02));   // Innenspiegel
  const sitz = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.12), leder); sitz.position.set(-auge[0], hb - 0.08, auge[2] - 0.25); innen.add(sitz);
  innen.visible = false;

  // Lenkrad (dreht sich mit dem Einschlag)
  const lenkHalter = new THREE.Group(); lenkHalter.position.set(auge[0], hb - 0.02, auge[2] + 0.42); lenkHalter.rotation.x = -0.35; innen.add(lenkHalter);
  const lenkrad = new THREE.Group(); lenkHalter.add(lenkrad);
  const kranz = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 24), new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.7 })); lenkrad.add(kranz);
  const nabe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.03), innenMat); lenkrad.add(nabe);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0xf2c21a })); mark.position.y = 0.17; lenkrad.add(mark);

  // Räder mit Bremssätteln
  const raeder = [], lenkVorn = [];
  for (const [z, b, k] of [[VORN, 0.26, 0], [VORN, 0.26, 1], [HINTEN, 0.32, 2], [HINTEN, 0.32, 3]]) {
    const s = k % 2 ? -1 : 1;
    const halter = new THREE.Group(); halter.position.set(s * (W - 0.12), RAD, z); auto.add(halter);
    const rd = rad(RAD, b, mats); halter.add(rd); raeder.push(rd);
    if (k < 2) lenkVorn.push(halter);
  }

  auto.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // Glas soll keine harten Schatten ins Auto werfen
  return { gruppe: auto, koerper, raeder, lenkVorn, lenkrad, licht: { material: rueckMat }, helm: [kopf, kopf], halo: [], innen, auge, scheinwerfer: scheinMat, massstab: 1, supercar: true };
}
