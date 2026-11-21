// Rennspiel – die Welt der Supercar-Strecken: Straßen, Städte, Dörfer, Felder, Wälder und Berge.
//
// Die Straße selbst (Fahrbahn, weiße Randlinien, Gehweg oder Grünstreifen) baut streckebau.js wie bei den Rennstrecken.
// Hier kommt alles dazu, was eine normale Straße ausmacht:
//   Mittellinien und Spurlinien, Zebrastreifen, Leitplanken, Mittelmauer und zweite Fahrbahn der Autobahn,
//   Häuserzeilen an der Straße, große Städte mit Hochhäusern, Dörfer mit Giebeldächern, Bauernhöfe,
//   Felder in vielen Farben, Wälder, Berge am Horizont, Laternen, Ampeln, Ortsschilder und Autobahnschilder.
// Alle Städte, Dörfer und Namen sind ausgedacht.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './texturen.js';
import { band, abschnitte, mesh, naeheGitter } from './streckebau.js';
import { baumModell, modell, passend, eckMaterial } from './modelle.js';

const STADT = 0, DORF = 1, LAND = 2, AUTOBAHN = 3;
const DOERFER = ['Lindenau', 'Kirchberg', 'Weidenfeld', 'Hasenmoor', 'Eichtal', 'Sonnwies'];

// ---------------------------------------------------------------- kleine Bilder (Linien, Schilder)

const bildCache = new Map();
function leinwand(w, h, malen) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  malen(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// gestrichelte Linie: oben weiß, unten durchsichtig
const strichBild = () => bildCache.get('strich') || (bildCache.set('strich', (() => {
  const t = leinwand(8, 64, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#f4f4ef'; x.fillRect(0, 0, w, h * 0.45); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})()), bildCache.get('strich'));
// Zebrastreifen: Streifen quer über die Straße
const zebraBild = () => bildCache.get('zebra') || (bildCache.set('zebra', (() => {
  const t = leinwand(64, 8, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#f4f4ef'; x.fillRect(0, 0, w * 0.5, h); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})()), bildCache.get('zebra'));

// Ortsschild: gelb mit schwarzem Rand und Namen (raus = rot durchgestrichen)
function ortsschild(name, raus) {
  return leinwand(256, 160, (x, w, h) => {
    x.fillStyle = '#f2c21a'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#111'; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#111'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(name, w / 2, h / 2 - (raus ? 14 : 0));
    if (raus) { x.font = '22px sans-serif'; x.fillText('Ende', w / 2, h / 2 + 34); x.strokeStyle = '#c81e1e'; x.lineWidth = 12; x.beginPath(); x.moveTo(24, h - 24); x.lineTo(w - 24, 24); x.stroke(); }
  });
}
// Blaues Autobahnschild mit Ziel und Entfernung
function autobahnSchild(ziel, km) {
  return leinwand(512, 192, (x, w, h) => {
    x.fillStyle = '#1d4fa8'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = '#fff'; x.font = 'bold 64px sans-serif'; x.textBaseline = 'middle';
    x.fillText(ziel, 36, h / 2); x.textAlign = 'right'; x.fillText(km + ' km', w - 36, h / 2);
  });
}

// ---------------------------------------------------------------- Hilfen

// Ort neben der Strecke: Stelle i, seitlich l (plus = links)
const neben = (T, i, l) => [T.x[i] + T.tz[i] * l, T.z[i] - T.tx[i] * l];
const richtung = (T, i) => Math.atan2(T.tx[i], T.tz[i]);
// Kiste an einen Ort stellen und drehen (für zusammengefügte Formen)
function kiste(w, h, d, x, y, z, dreh = 0, uvMass = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (uvMass) {
    // Fenster-Bild passend zur Größe strecken: ein Fensterfeld ist uvMass[0] breit und uvMass[1] hoch
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) {
      const seite = Math.floor(k / 4), breit = seite < 2 ? d : w;
      if (seite === 2 || seite === 3) uv.setXY(k, 0.01, 0.99);   // Dach und Boden: einfarbig (Wandfarbe ohne Fenster)
      else uv.setXY(k, uv.getX(k) * breit / uvMass[0], uv.getY(k) * h / uvMass[1]);
    }
  }
  g.rotateY(dreh); g.translate(x, y + h / 2, z);
  return g;
}
// Giebeldach (Prisma): w breit (quer zum First), d lang, h hoch
function giebel(w, d, h, x, y, z, dreh) {
  const g = new THREE.BufferGeometry();
  const a = w / 2, b = d / 2;
  const p = [-a, 0, -b, a, 0, -b, 0, h, -b, -a, 0, b, a, 0, b, 0, h, b];
  const idx = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
  const pos = [];
  for (const k of idx) pos.push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  g.computeVertexNormals();
  g.rotateY(dreh); g.translate(x, y, z);
  return g;
}

// ---------------------------------------------------------------- alles zusammen

export function baueStrassenWelt(T, gruppe, welt, viel, r) {
  const def = T.def, n = T.n;
  const nah = naeheGitter(T, 60);
  const staedte = def.welt.staedte || [];
  const abend = def.welt.zeit === 'abend';
  // Was liegt wo? Zonen-Abschnitte
  const zonenAb = z => abschnitte(n, i => T.zone[i] === z);
  const zonen = { stadt: zonenAb(STADT), dorf: zonenAb(DORF), land: zonenAb(LAND), autobahn: zonenAb(AUTOBAHN) };

  // Für jedes Dorf einen Namen, für jede Stadt-Strecke die nächste Stadt
  const stadtVon = i => {
    let best = null, bd = Infinity;
    for (const s of staedte) { const d = Math.hypot(T.x[i] - s.x, T.z[i] - s.z); if (d < bd) { bd = d; best = s; } }
    return best;
  };

  linien(T, gruppe, zonen);
  autobahnGegenseite(T, gruppe, zonen);
  begrenzung(T, gruppe, zonen, viel);
  laternen(T, gruppe, zonen, abend);
  haeuserzeilen(T, gruppe, nah, r, abend, viel);
  for (const s of staedte) grossstadt(T, gruppe, nah, s, r, abend, viel);
  bauernhoefe(T, gruppe, nah, r, viel);
  schilder(T, gruppe, zonen, stadtVon);
  ampeln(T, gruppe, r);
  const land = gelaende(T, gruppe, welt, nah, staedte, viel);
  baeume(T, gruppe, nah, land, staedte, r, viel);
  berge(T, gruppe, welt, def);
}

// ---------------------------------------------------------------- Linien auf der Straße

function linien(T, gruppe, zonen) {
  const strich = strichBild();
  const weiss = new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const gestrichelt = (laenge) => {
    const t = strich.clone(); t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false, userData: { laenge } });
  };
  const strichMat = gestrichelt(12), kurzMat = gestrichelt(6);
  const linie = (von, bis, lat, breite, mat, uvLang = 12) => gruppe.add(mesh(band(T, von - 1, bis + 1, 1, (i, j) => lat(i) + (j - 0.5) * breite, () => 0.015, {
    uv: (i, j, l, s) => [j, s / uvLang],
  }), mat, false, true));
  // Stadt: durchgezogene Mittellinie (doppelt) und gestrichelte Spurlinien
  for (const [von, bis] of zonen.stadt) {
    for (const o of [-0.12, 0.12]) linie(von, bis, () => o, 0.12, weiss);
    for (const sl of [-0.5, 0.5]) linie(von, bis, i => sl * T.hb[i], 0.13, kurzMat, 6);
  }
  // Dorf und Land: gestrichelte Mittellinie
  for (const z of ['dorf', 'land']) for (const [von, bis] of zonen[z]) linie(von, bis, () => 0, 0.13, strichMat);
  // Autobahn: zwei gestrichelte Spurlinien (drei Spuren)
  for (const [von, bis] of zonen.autobahn) for (const sl of [-1 / 3, 1 / 3]) linie(von, bis, i => sl * T.hb[i], 0.15, strichMat);
  // Zebrastreifen in der Stadt (alle paar hundert Meter, nur auf geraden Stücken)
  const zebra = zebraBild();
  const zMat = new THREE.MeshStandardMaterial({ map: zebra, transparent: true, alphaTest: 0.4, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false });
  const schritt = Math.round(260 / T.ds);
  for (const [von, bis] of zonen.stadt) for (let k = von + Math.round(80 / T.ds); k < bis - 20; k += schritt) {
    const i = ((k % T.n) + T.n) % T.n;
    if (Math.abs(T.k[i]) > 1 / 400) continue;
    const lang = Math.round(4 / T.ds);
    gruppe.add(mesh(band(T, k, k + lang, 1, (ii, j) => -T.hb[ii] + 0.3 + j * (2 * T.hb[ii] - 0.6), () => 0.018, { uv: (ii, j, l) => [l / 1.0, j] }), zMat, false, true));
  }
}

// ---------------------------------------------------------------- Autobahn: Mittelmauer und Fahrbahn für den Gegenverkehr

function autobahnGegenseite(T, gruppe, zonen) {
  const as = TX.asphalt();
  const asMat = new THREE.MeshStandardMaterial({ map: as.map, normalMap: as.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.9, color: 0xdddddd });
  const weiss = new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const strich = strichBild().clone(); strich.needsUpdate = true;
  const sMat = new THREE.MeshStandardMaterial({ map: strich, transparent: true, alphaTest: 0.4, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const beton = new THREE.MeshStandardMaterial({ color: 0xc8c8c0, roughness: 0.85 });
  for (const [von, bis] of zonen.autobahn) {
    const innen = i => T.hb[i] + T.ausL[i];            // Mittelmauer
    const a0 = i => innen(i) + 0.6, a1 = i => innen(i) + 2.2 + 2 * T.hb[i];
    gruppe.add(mesh(band(T, von - 1, bis + 1, 4, (i, j) => a0(i) + (a1(i) - a0(i)) * j / 4, () => -0.01, { uv: (i, j, l, s) => [l / 6, s / 6] }), asMat, false, true));
    for (const l of [i => a0(i) + 0.8, i => a1(i) - 0.5]) gruppe.add(mesh(band(T, von, bis, 1, (i, j) => l(i) + (j - 0.5) * 0.2, () => 0.004), weiss, false, true));
    for (const f of [1 / 3, 2 / 3]) gruppe.add(mesh(band(T, von, bis, 1, (i, j) => a0(i) + 0.8 + (a1(i) - a0(i) - 1.3) * f + (j - 0.5) * 0.15, () => 0.005, { uv: (i, j, l, s) => [j, s / 12] }), sMat, false, true));
    // Mittelmauer aus Beton (unten breit, oben schmal)
    gruppe.add(mesh(band(T, von, bis, 3, (i, j) => innen(i) + [0, 0.18, 0.42, 0.6][j], (i, j) => [0, 0.85, 0.85, 0][j]), beton));
  }
}

// ---------------------------------------------------------------- Leitplanken (Land, Autobahn)

function begrenzung(T, gruppe, zonen, viel) {
  const blech = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide });
  const pfosten = [];
  const leitplanke = (von, bis, lat) => {
    gruppe.add(mesh(band(T, von, bis, 1, i => lat(i), (i, j) => 0.5 + j * 0.3), blech));
    for (let k = von; k <= bis; k += Math.max(1, Math.round(4 / T.ds))) { const i = ((k % T.n) + T.n) % T.n; const [x, z] = neben(T, i, lat(i) * 1.004); pfosten.push([x, T.y[i], z]); }
  };
  for (const [von, bis] of zonen.land) for (const s of [1, -1]) leitplanke(von, bis, i => s * (T.hb[i] + (s > 0 ? T.ausL[i] : T.ausR[i])));
  for (const [von, bis] of zonen.autobahn) leitplanke(von, bis, i => -(T.hb[i] + T.ausR[i]));
  if (pfosten.length) {
    const g = new THREE.BoxGeometry(0.1, 0.8, 0.1); g.translate(0, 0.4, 0);
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.5, metalness: 0.5 }), pfosten.length);
    const m4 = new THREE.Matrix4();
    pfosten.forEach(([x, y, z], k) => { m4.makeTranslation(x, y, z); im.setMatrixAt(k, m4); });
    gruppe.add(im);
  }
}

// ---------------------------------------------------------------- Straßenlaternen

function laternen(T, gruppe, zonen, abend) {
  const pos = [];
  const step = Math.round(36 / T.ds);
  for (const z of ['stadt', 'dorf']) for (const [von, bis] of zonen[z]) for (let k = von; k < bis; k += step) {
    const i = ((k % T.n) + T.n) % T.n;
    for (const s of [-1, 1]) { const l = s * (T.hb[i] + (s > 0 ? T.ausL[i] : T.ausR[i]) - 0.8); const [x, zz] = neben(T, i, l); pos.push([x, T.y[i], zz, richtung(T, i) + (s > 0 ? -Math.PI / 2 : Math.PI / 2)]); }
  }
  for (const [von, bis] of zonen.autobahn) for (let k = von; k < bis; k += Math.round(60 / T.ds)) {
    const i = ((k % T.n) + T.n) % T.n; const l = T.hb[i] + T.ausL[i] + 0.3; const [x, zz] = neben(T, i, l);
    pos.push([x, T.y[i] + 0.8, zz, richtung(T, i) + Math.PI / 2], [x, T.y[i] + 0.8, zz, richtung(T, i) - Math.PI / 2]);
  }
  if (!pos.length) return;
  const mast = new THREE.CylinderGeometry(0.08, 0.12, 8, 6); mast.translate(0, 4, 0);
  const arm = new THREE.BoxGeometry(0.08, 0.08, 2.2); arm.translate(0, 8, 1.1);
  const kopf = new THREE.BoxGeometry(0.35, 0.12, 0.7); kopf.translate(0, 7.95, 2.1);
  const mi = new THREE.InstancedMesh(mergeGeometries([mast, arm]), new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.6 }), pos.length);
  const ki = new THREE.InstancedMesh(kopf, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe0a0, emissiveIntensity: abend ? 3 : 0.4 }), pos.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3(1, 1, 1), y = new THREE.Vector3(0, 1, 0);
  pos.forEach(([x, h, z, dreh], k) => { q.setFromAxisAngle(y, dreh); m4.compose(new THREE.Vector3(x, h, z), q, e); mi.setMatrixAt(k, m4); ki.setMatrixAt(k, m4); });
  mi.castShadow = true;
  gruppe.add(mi, ki);
}

// ---------------------------------------------------------------- Häuser an der Straße

// Materialien für Häuser: Fassaden mit Fenstern in verschiedenen Farben, Glas-Hochhäuser, Dächer
function hausMaterialien(abend) {
  const tex = TX.fassade(abend ? 'abend' : 'tag');
  const leucht = abend ? { emissiveMap: tex.leucht, emissive: 0xffd9a0, emissiveIntensity: 1 } : {};
  const fassaden = [0xe8d8c0, 0xd9b38c, 0xc98f6a, 0xf0e6d2, 0xb7c4cf, 0xe3c99b, 0xd7a8a0, 0xcfd3d6, 0x9ea7ad].map(c =>
    new THREE.MeshStandardMaterial({ map: tex.map, color: c, roughness: 0.8, ...leucht }));
  const glas = [0x6f8fa8, 0x4f6f88, 0x8aa7b8, 0x5d7b6e].map(c => new THREE.MeshStandardMaterial({ map: tex.map, color: c, roughness: 0.12, metalness: 0.85, ...leucht }));
  const dach = [0xa83c2a, 0x8a3a2a, 0x5e4a3e, 0x6a6e74].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }));
  const putz = [0xf2ead8, 0xf6f0e2, 0xe8d6b8, 0xdfe6e0, 0xf0d8c8].map(c => new THREE.MeshStandardMaterial({ map: tex.map, color: c, roughness: 0.9, ...leucht }));
  return { fassaden, glas, dach, putz };
}

// Sammelt Formen je Material und fügt sie am Ende zu wenigen großen Formen zusammen (das ist viel schneller)
function sammler(gruppe) {
  const eimer = new Map();
  return {
    dazu(mat, g) { if (!eimer.has(mat)) eimer.set(mat, []); eimer.get(mat).push(g); },
    fertig() { for (const [mat, liste] of eimer) { if (!liste.length) continue; for (let k = 0; k < liste.length; k += 400) gruppe.add(mesh(mergeGeometries(liste.slice(k, k + 400)), mat, true, true)); } eimer.clear(); },
  };
}

// Dorfhaus aus einem fertigen Modell (Kenney City Kit Suburban, CC0): eine Form mit Eckfarben,
// Wand und Dach bekommen zufällige Farben. Die Haustür (Modell-Vorderseite +z) zeigt mit dreh zur Straße.
const HAEUSER = ['haus_a', 'haus_g', 'haus_h', 'haus_i', 'haus_m', 'haus_q'];
const WAND = [0xf2ead8, 0xf6f0e2, 0xe8d6b8, 0xdfe6e0, 0xf0d8c8, 0xe9e3cf];
const DACH = [0xa83c2a, 0x8a3a2a, 0x9c4a30, 0x5e4a3e, 0x6a6e74];
const hausMat = eckMaterial(0xffffff, { roughness: 0.85 });
function hausModell(r, breit, tief, x, y, z, dreh) {
  const m = modell(HAEUSER[Math.floor(r() * HAEUSER.length)]);
  if (!m) return null;
  const g = m.kiste.getSize(new THREE.Vector3());
  const s = Math.min(breit / g.x, tief * 1.4 / g.z);
  const t = passend(m, { mal: s });
  const wand = new THREE.Color(WAND[Math.floor(r() * WAND.length)]), dach = new THREE.Color(DACH[Math.floor(r() * DACH.length)]);
  const teile = [];
  for (const [n, geo] of Object.entries(t)) {
    if (n === 'masse') continue;
    const f = n === 'wand' ? wand : n === 'dach' ? dach : null;
    if (f) { const c = geo.getAttribute('color'); for (let k = 0; k < c.count; k++) c.setXYZ(k, c.getX(k) * f.r, c.getY(k) * f.g, c.getZ(k) * f.b); }
    teile.push(geo);
  }
  const ganz = mergeGeometries(teile);
  ganz.rotateY(dreh); ganz.translate(x, y, z);
  return ganz;
}

// Häuserzeilen direkt an der Straße (Stadt) und Häuser mit Giebeldach (Dorf)
function haeuserzeilen(T, gruppe, nah, r, abend, viel) {
  const M = hausMaterialien(abend), S = sammler(gruppe);
  const n = T.n, ds = T.ds;
  for (const seite of [1, -1]) {
    let k = 0, platz = 0;
    while (k < n) {
      const i = k, zone = T.zone[i];
      if (zone !== STADT && zone !== DORF) { k += 5; continue; }
      const stadt = zone === STADT;
      const breit = stadt ? 16 + r() * 16 : 9 + r() * 4;
      const luecke = stadt ? (r() < 0.14 ? 14 : 0.5) : 5 + r() * 9;   // in der Stadt ab und zu eine Querstraße
      platz += 1;
      // Innen in engen Kurven ist kein Platz für Häuser
      if (Math.sign(T.k[i]) === seite && Math.abs(T.k[i]) > 1 / 70) { k += Math.round(6 / ds); continue; }
      const aus = seite > 0 ? T.ausL[i] : T.ausR[i];
      const tief = stadt ? 14 + r() * 10 : 9 + r() * 2;
      const vorn = T.hb[i] + aus + (stadt ? 0.2 : 2.5 + r() * 3);
      const mitte = vorn + tief / 2;
      const [x, z] = neben(T, i, seite * mitte);
      // nicht auf eine andere Stelle der Strecke bauen
      const f = nah(x, z, 2);
      let weg = Math.abs(T.s[f.i] - T.s[i]); weg = Math.min(weg, T.laenge - weg);
      if (weg > 50 && f.d < T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + tief / 2 + breit / 2) { k += Math.round(8 / ds); continue; }
      const dreh = richtung(T, i), y = T.y[i] - 0.3;
      if (stadt) {
        const stock = 3 + Math.floor(r() * 7) + (r() < 0.15 ? 6 : 0);
        const h = stock * 3.2 + 1;
        const glas = r() < 0.2;
        S.dazu(glas ? M.glas[Math.floor(r() * M.glas.length)] : M.fassaden[Math.floor(r() * M.fassaden.length)], kiste(breit - 0.4, h, tief, x, y, z, dreh, [7, 25.6 / 8 * 8]));
      } else {
        const h = 5.5 + r() * 2.5;
        const haus = hausModell(r, breit, tief, x, y + 0.3, z, Math.atan2(-seite * T.tz[i], seite * T.tx[i]));
        if (haus) S.dazu(hausMat, haus);
        else {
          S.dazu(M.putz[Math.floor(r() * M.putz.length)], kiste(breit, h, tief, x, y, z, dreh, [7, 25.6]));
          S.dazu(M.dach[Math.floor(r() * 3)], giebel(tief + 0.8, breit + 0.6, 3 + r() * 1.5, x, y + h, z, dreh + Math.PI / 2));
        }
      }
      k += Math.max(1, Math.round((breit + luecke) / ds));
    }
  }
  S.fertig();
}

// ---------------------------------------------------------------- Große Stadt: Häuserblocks, nach innen immer höher

function grossstadt(T, gruppe, nah, s, r, abend, viel) {
  const M = hausMaterialien(abend), S = sammler(gruppe);
  const block = 64, strasse = 14;
  const R = s.r;
  for (let bx = s.x - R; bx <= s.x + R; bx += block) for (let bz = s.z - R; bz <= s.z + R; bz += block) {
    const ab = Math.hypot(bx - s.x, bz - s.z);
    if (ab > R * (0.85 + 0.15 * r())) continue;
    if (r() > 0.55 + 0.45 * viel) continue;
    const f = nah(bx, bz, 3);
    const frei = f.i >= 0 ? T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 26 + block * 0.35 : 0;
    if (f.i >= 0 && f.d < frei) continue;
    const kern = Math.max(0, 1 - ab / R);                 // 1 in der Mitte, 0 am Rand
    const inner = block - strasse;
    // Park statt Häusern (ab und zu)
    if (r() < 0.06) { S.dazu(parkMat(), kiste(inner, 0.25, inner, bx, (f.i >= 0 ? T.y[f.i] : 0) - 0.2, bz)); continue; }
    // ein großes Haus oder vier kleinere je Block
    const teile = kern > 0.55 && r() < 0.7 ? 1 : r() < 0.5 ? 2 : 4;
    const y0 = (f.i >= 0 ? T.y[f.i] : 0) - 0.3;
    const stuecke = teile === 1 ? [[0, 0, inner, inner]] : teile === 2 ? [[-inner / 4, 0, inner / 2 - 2, inner], [inner / 4, 0, inner / 2 - 2, inner]]
      : [[-inner / 4, -inner / 4], [inner / 4, -inner / 4], [-inner / 4, inner / 4], [inner / 4, inner / 4]].map(([x, z]) => [x, z, inner / 2 - 2, inner / 2 - 2]);
    for (const [ox, oz, w, d] of stuecke) {
      const hoch = kern * kern * (teile === 1 ? 170 : 70) * (0.4 + r() * 0.9) + 10 + r() * 14;
      const glas = hoch > 50 && r() < 0.75;
      const mat = glas ? M.glas[Math.floor(r() * M.glas.length)] : M.fassaden[Math.floor(r() * M.fassaden.length)];
      const ww = w * (0.75 + r() * 0.25), dd = d * (0.75 + r() * 0.25);
      S.dazu(mat, kiste(ww, hoch, dd, bx + ox, y0, bz + oz, 0, [7, 25.6]));
      S.dazu(M.dach[3], kiste(ww * 0.35, 2.2, dd * 0.3, bx + ox + (r() - 0.5) * ww * 0.3, y0 + hoch, bz + oz + (r() - 0.5) * dd * 0.3));   // Aufbau auf dem Dach
      // Hochhäuser bekommen oben einen Absatz und manchmal eine Antenne
      if (hoch > 70) {
        S.dazu(mat, kiste(ww * 0.6, hoch * 0.12, dd * 0.6, bx + ox, y0 + hoch, bz + oz, 0, [7, 25.6]));
        if (r() < 0.5) S.dazu(M.dach[3], kiste(0.8, hoch * 0.15, 0.8, bx + ox, y0 + hoch * 1.12, bz + oz));
      }
    }
  }
  S.fertig();
}
let parkMatCache = null;
const parkMat = () => parkMatCache || (parkMatCache = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1 }));

// ---------------------------------------------------------------- Bauernhöfe auf dem Land

function bauernhoefe(T, gruppe, nah, r, viel) {
  const M = hausMaterialien(false), S = sammler(gruppe);
  const scheune = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 });
  for (let i = 0; i < T.n; i += Math.round(420 / T.ds)) {
    if (T.zone[i] !== LAND || r() > 0.75 * viel + 0.2) continue;
    const seite = r() < 0.5 ? 1 : -1, ab = 45 + r() * 120;
    const [x, z] = neben(T, i, seite * (T.hb[i] + ab));
    const f = nah(x, z, 3);
    if (f.d < T.hb[f.i] + 30) continue;
    const dreh = richtung(T, i) + (r() - 0.5) * 0.6, y = T.y[f.i] - 0.3;
    S.dazu(M.putz[Math.floor(r() * M.putz.length)], kiste(12, 6, 10, x, y, z, dreh, [7, 25.6]));
    S.dazu(M.dach[0], giebel(10.8, 12.8, 4, x, y + 6, z, dreh));
    const sx = x + Math.cos(dreh) * 18, sz = z - Math.sin(dreh) * 18;
    S.dazu(scheune, kiste(20, 7, 12, sx, y, sz, dreh));
    S.dazu(M.dach[2], giebel(12.8, 20.8, 4.5, sx, y + 7, sz, dreh + Math.PI / 2));
    // ein Silo
    const silo = new THREE.CylinderGeometry(2.2, 2.2, 13, 12); silo.translate(sx + Math.sin(dreh) * 10, y + 6.5, sz + Math.cos(dreh) * 10);
    S.dazu(M.fassaden[7], silo);
  }
  S.fertig();
}

// ---------------------------------------------------------------- Schilder: Ortsschilder und Autobahnschilder

function schilder(T, gruppe, zonen, stadtVon) {
  const n = T.n;
  const pfahl = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.5, metalness: 0.6 });
  let dorfNr = 0;
  const schild = (i, seite, tex, w, h, hoch, ueber = false) => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
    p.position.y = hoch; p.rotation.y = Math.PI; g.add(p);
    if (ueber) {
      // Brücke über die Fahrbahn
      const breite = T.hb[i] * 2 + 3;
      for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.3, hoch + h / 2, 0.3), pfahl); st.position.set(s * breite / 2, (hoch + h / 2) / 2, 0.2); g.add(st); }
      const tr = new THREE.Mesh(new THREE.BoxGeometry(breite, 0.3, 0.3), pfahl); tr.position.set(0, hoch + h / 2, 0.2); g.add(tr);
    } else { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, hoch, 6), pfahl); st.position.set(0, hoch / 2 - h / 2, 0.03); g.add(st); }
    const l = seite * (T.hb[i] + (seite > 0 ? T.ausL[i] : T.ausR[i]) - 0.5);
    const [x, z] = ueber ? [T.x[i], T.z[i]] : neben(T, i, l);
    g.position.set(x, T.y[i], z); g.rotation.y = richtung(T, i);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    gruppe.add(g);
  };
  // Ortseingang: wo eine Stadt oder ein Dorf beginnt; Ortsausgang: wo es endet
  for (const z of ['stadt', 'dorf']) for (const [von, bis] of zonen[z]) {
    if (bis - von >= n - 2) continue;   // ganze Strecke in der Stadt: kein Schild
    const i0 = ((von % n) + n) % n, i1 = ((bis % n) + n) % n;
    const name = z === 'stadt' ? (stadtVon(i0)?.name || 'Valmera') : DOERFER[dorfNr++ % DOERFER.length];
    schild((i0 + Math.round(10 / T.ds)) % n, -1, ortsschild(name, false), 1.6, 1.0, 2.2);
    schild((i1 + n - Math.round(10 / T.ds)) % n, -1, ortsschild(name, true), 1.6, 1.0, 2.2);
  }
  // Autobahn: ein großes blaues Schild über der Fahrbahn am Anfang, mit dem nächsten Ziel
  for (const [von, bis] of zonen.autobahn) {
    const i = ((von % n) + n) % n + Math.round(150 / T.ds);
    const ziel = stadtVon(((bis % n) + n) % n);
    const km = Math.max(1, Math.round((bis - von - 150 / T.ds) * T.ds / 1000));
    schild(i % n, 0, autobahnSchild(ziel ? ziel.name : 'Valmera', km), 7, 2.6, 6.5, true);
  }
}

// ---------------------------------------------------------------- Ampeln an den Ecken in der Stadt (nur zum Ansehen)

function ampeln(T, gruppe, r) {
  const pos = [];
  let letzte = -1e9;
  for (let i = 0; i < T.n; i += 2) {
    if (T.zone[i] !== STADT || Math.abs(T.k[i]) < 1 / 45 || T.s[i] - letzte < 120) continue;
    letzte = T.s[i];
    const j = (i - Math.round(25 / T.ds) + T.n) % T.n;   // kurz vor der Kurve, rechts
    const l = -(T.hb[j] + T.ausR[j] - 1);
    const [x, z] = neben(T, j, l);
    pos.push([x, T.y[j], z, richtung(T, j), r() < 0.5]);
  }
  if (!pos.length) return;
  const dunkel = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.5 });
  const lampen = [0xff2a1a, 0xffb21a, 0x2aff5a].map(c => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 0 }));
  const an = [0xff2a1a, 0xffb21a, 0x2aff5a].map(c => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 3 }));
  for (const [x, y, z, dreh, rot] of pos) {
    const g = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), dunkel); mast.position.y = 1.7; g.add(mast);
    const kasten = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.3), dunkel); kasten.position.y = 3.6; g.add(kasten);
    [0, 1, 2].forEach(k => { const l = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), (rot ? k === 0 : k === 2) ? an[k] : lampen[k]); l.position.set(0, 3.92 - k * 0.32, -0.16); l.rotation.y = Math.PI; g.add(l); });
    g.position.set(x, y, z); g.rotation.y = dreh;
    gruppe.add(g);
  }
}

// ---------------------------------------------------------------- Gelände: Hügel, Felder, Stadtboden

function gelaende(T, gruppe, welt, nah, staedte, viel) {
  const { minx, maxx, minz, maxz } = welt.grenzen;
  const rand = 1400;
  const x0 = minx - rand, x1 = maxx + rand, z0 = minz - rand, z1 = maxz + rand;
  const zellen = viel >= 1 ? 64000 : viel > 0.5 ? 36000 : 18000;
  const seitenV = (x1 - x0) / (z1 - z0);
  const NX = Math.round(Math.sqrt(zellen * seitenV)), NZ = Math.round(zellen / NX);
  const rs = TX.rauschen(41), rf = TX.rauschen(93);
  const hoch = T.def.welt.art === 'stadt' ? 6 : 45;
  // Wie stark ist eine Stelle "Stadt"? (1 = mitten in der Stadt)
  const stadtAnteil = (x, z) => { let m = 0; for (const s of staedte) m = Math.max(m, 1 - Math.hypot(x - s.x, z - s.z) / (s.r * 1.1)); return Math.min(1, Math.max(0, m * 3)); };
  const hoehe = (x, z) => {
    const f = nah(x, z, 4);
    const ty = f.i >= 0 ? T.y[f.i] : 0;
    // Wie weit muss das Gelände flach neben der Straße bleiben? Auf der Autobahn auch für die zweite Fahrbahn.
    const frei = f.i >= 0 ? T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 8 + (T.zone[f.i] === AUTOBAHN ? 2 * T.hb[f.i] + 4 : 0) : 0;
    const d = f.i >= 0 ? f.d : 1e4;
    const w = Math.min(1, Math.max(0, (d - frei) / 220));
    const glatt = w * w * (3 - 2 * w) * (1 - stadtAnteil(x, z));
    const h = ty - 0.35 + glatt * (rs(x / 900, z / 900, 4) * hoch + hoch * 0.4);
    return { h, d, glatt };
  };
  const pos = [], cols = [], idx = [];
  // Felder: ein schiefes Raster aus Rechtecken, jedes in einer anderen Farbe
  const feldFarben = [0xc9b25a, 0x7da24a, 0x9a7a52, 0xe2d24a, 0x5f8f3a, 0xb8c36a, 0x8a6a4a].map(c => new THREE.Color(c));
  const wiese = new THREE.Color(0x5e8f3c), wald = new THREE.Color(0x355a2c), grau = new THREE.Color(0xa4a6aa), c = new THREE.Color();
  const feld = (x, z) => {
    const a = 0.35, u = x * Math.cos(a) - z * Math.sin(a), v = x * Math.sin(a) + z * Math.cos(a);
    const fu = Math.floor(u / 140), fv = Math.floor(v / 90);
    const h = Math.abs(Math.sin(fu * 127.1 + fv * 311.7) * 43758.5) % 1;
    return feldFarben[Math.floor(h * feldFarben.length)];
  };
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = x0 + (x1 - x0) * i / NX, z = z0 + (z1 - z0) * j / NZ;
    let { h, d } = hoehe(x, z);
    if (i === 0 || j === 0 || i === NX || j === NZ) h = -60;   // am Rand sanft nach unten, dort geht der große Boden weiter
    pos.push(x, h, z);
    const st = stadtAnteil(x, z);
    const waldig = rf(x / 700, z / 700, 3);
    if (waldig > 0.25) c.copy(wald); else if (d < 40) c.copy(wiese); else c.copy(feld(x, z)).lerp(wiese, 0.15);
    c.lerp(grau, st);
    cols.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, cc = a + NX + 1, d = cc + 1;
    idx.push(a, cc, b, b, cc, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const uvs = []; for (let k = 0; k < pos.length; k += 3) uvs.push(pos[k] / 14, pos[k + 2] / 14);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const gt = TX.gras();
  gruppe.add(mesh(g, new THREE.MeshStandardMaterial({ map: gt.map, vertexColors: true, roughness: 1, color: 0xd8d8d8 }), false, true));
  return { hoehe, stadtAnteil, wald: (x, z) => rf(x / 700, z / 700, 3), x0, x1, z0, z1 };
}

// ---------------------------------------------------------------- Bäume: Wälder, Baumreihen an der Landstraße

function baeume(T, gruppe, nah, land, staedte, r, viel) {
  const anzahl = Math.round(7000 * viel);
  const stamm = new THREE.CylinderGeometry(0.18, 0.28, 1, 6); stamm.translate(0, 0.5, 0);
  const formen = {
    nadel: () => { const k1 = new THREE.ConeGeometry(2.6, 6, 8); k1.translate(0, 5, 0); const k2 = new THREE.ConeGeometry(2, 5, 8); k2.translate(0, 7.5, 0); const k3 = new THREE.ConeGeometry(1.3, 3.5, 8); k3.translate(0, 9.7, 0); return mergeGeometries([k1, k2, k3]); },
    laub: () => { const a = new THREE.IcosahedronGeometry(2.6, 0); a.translate(0, 5.5, 0); const b = new THREE.IcosahedronGeometry(2, 0); b.translate(1.3, 6.8, 0.5); const c = new THREE.IcosahedronGeometry(1.9, 0); c.translate(-1.1, 6.5, -0.7); return mergeGeometries([a, b, c]); },
  };
  const arten = [['nadel', 0x2c4f2a, 0.45, 1, 3], ['laub', 0x46722f, 0.55, 1, 4]];
  const kroneMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const stammMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 });
  // fertige Baum-Modelle (Kenney Nature Kit, CC0), wenn geladen
  const MODELL = { nadel: ['baum_tanne', 11.5], laub: ['baum_laub', 8.5] };
  for (const [name, farbe, anteil, groesse, stammH] of arten) {
    const zahl = Math.round(anzahl * anteil);
    const bm = baumModell(...MODELL[name]);
    const krone = new THREE.InstancedMesh(bm ? bm.krone : formen[name](), bm ? bm.kroneMat : kroneMat, zahl);
    const st = new THREE.InstancedMesh(bm ? bm.stamm : stamm, bm ? bm.stammMat : stammMat, zahl);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
    let k = 0, versuche = 0;
    while (k < zahl && versuche < zahl * 25) {
      versuche++;
      let x, z;
      if (r() < 0.25) {
        // Baumreihe an der Landstraße
        const i = Math.floor(r() * T.n); if (T.zone[i] !== LAND) continue;
        const s = r() < 0.5 ? 1 : -1;
        [x, z] = neben(T, i, s * (T.hb[i] + (s > 0 ? T.ausL[i] : T.ausR[i]) + 4 + r() * 6));
      } else {
        x = land.x0 + r() * (land.x1 - land.x0); z = land.z0 + r() * (land.z1 - land.z0);
        if (land.wald(x, z) < 0.25 && r() > 0.04) continue;     // Wälder in Gruppen, sonst nur vereinzelt
      }
      if (land.stadtAnteil(x, z) > 0.05) continue;
      const f = nah(x, z, 3);
      if (f.i >= 0 && f.d < T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 3 + (T.zone[f.i] === AUTOBAHN ? 2 * T.hb[f.i] + 4 : 0)) continue;
      if (f.i >= 0 && (T.zone[f.i] === DORF || T.zone[f.i] === STADT) && f.d < 60) continue;
      const hh = land.hoehe(x, z);
      const s = (0.75 + r() * 0.6) * groesse;
      q.setFromAxisAngle(Y, r() * 6.28);
      m4.compose(new THREE.Vector3(x, hh.h - 0.2, z), q, new THREE.Vector3(s, s, s)); krone.setMatrixAt(k, m4);
      if (!bm) m4.compose(new THREE.Vector3(x, hh.h - 0.2, z), q, new THREE.Vector3(s, s * stammH, s));
      st.setMatrixAt(k, m4);
      c.setHex(farbe).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08); krone.setColorAt(k, c);
      k++;
    }
    krone.count = st.count = k;
    krone.castShadow = st.castShadow = true; krone.receiveShadow = true;
    gruppe.add(krone, st);
  }
}

// ---------------------------------------------------------------- Berge am Horizont (mit Schnee auf den Gipfeln)

function berge(T, gruppe, welt, def) {
  const { minx, maxx, minz, maxz } = welt.grenzen;
  const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
  const R = Math.hypot(maxx - minx, maxz - minz) / 2 + 2600;
  const M = 220, rs = TX.rauschen(5);
  const pos = [], cols = [], idx = [];
  const fuss = new THREE.Color(0x56704e), fels = new THREE.Color(0x7c7a78), schnee = new THREE.Color(0xf4f6f8);
  const hoch = def.welt.art === 'stadt' ? 500 : 900;
  const reihen = [[R, 0], [R + 500, 0.5], [R + 1400, 1]];   // drei Reihen: vorn niedrig, hinten hoch
  for (const [rad, hinten] of reihen) {
    const start = pos.length / 3;
    for (let k = 0; k <= M; k++) {
      const a = k / M * Math.PI * 2;
      const h = hoch * (0.35 + 0.65 * hinten) * Math.max(0.15, 0.55 + 0.6 * rs(Math.cos(a) * 4 + hinten * 7, Math.sin(a) * 4, 4));
      pos.push(cx + Math.cos(a) * (rad - 600), -40, cz + Math.sin(a) * (rad - 600), cx + Math.cos(a) * rad, h, cz + Math.sin(a) * rad);
      cols.push(fuss.r, fuss.g, fuss.b);
      c3.copy(fels).lerp(schnee, Math.max(0, Math.min(1, (h - hoch * 0.55) / (hoch * 0.25)))); cols.push(c3.r, c3.g, c3.b);
    }
    for (let k = 0; k < M; k++) { const a = start + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, flatShading: true }));
  gruppe.add(m);
  // großer flacher Boden bis zu den Bergen (unter dem Gelände)
  const boden = new THREE.Mesh(new THREE.CircleGeometry(R + 1500, 64), new THREE.MeshStandardMaterial({ color: 0x4f6a3c, roughness: 1 }));
  boden.rotation.x = -Math.PI / 2; boden.position.set(cx, -55, cz); gruppe.add(boden);
  welt.weit = R + 1600;   // so weit muss die Kamera sehen können
}
const c3 = new THREE.Color();
