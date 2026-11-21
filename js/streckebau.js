// Rennspiel – baut die Rennstrecke und die Landschaft in 3D.
//
// Die Fahrbahn, die Randsteine, Gras und Kies sind lange "Bänder", die der Mittellinie folgen.
// Daneben stehen Leitplanken, Reifenstapel oder Mauern, dahinter Tribünen, Bäume, Häuser, Meer oder Berge.
// Die kleinen Autos fahren im Wohnzimmer: das ferngesteuerte Auto auf einer Strecke aus Matten,
// das Slotcar auf einer Kunststoffbahn mit zwei Schlitzen und Weichen.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './texturen.js';
import { BELAG, MASSSTAB } from './strecke.js';
import { weichen, WEICHE_LANG } from './slot.js';

// ---------------------------------------------------------------- Hilfen

// Abschnitte, in denen pruef(i) wahr ist: [[von, bis], …] (bis einschließlich, kann über das Ende der Runde gehen)
function abschnitte(n, pruef) {
  const out = [];
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (pruef(i)) { if (start < 0) start = i; } else if (start >= 0) { out.push([start, i]); start = -1; }
  }
  if (start >= 0) {
    if (out.length && out[0][0] === 0) out[0][0] = start - n; else out.push([start, n]);
  }
  if (!out.length && pruef(0)) out.push([0, n]);
  return out;
}

// Ein Band entlang der Strecke. lat(i, j) = seitlicher Abstand (plus = links) der Spalte j, hoch(i, j) = Höhe darüber.
function band(T, von, bis, spalten, lat, hoch, { uv = null, farbe = null, schritt = 1 } = {}) {
  const n = T.n, pos = [], uvs = [], cols = [], idx = [];
  let reihen = 0;
  for (let k = von; ; k += schritt) {
    if (k > bis) k = bis;
    const i = ((k % n) + n) % n;
    const s = k >= n ? T.s[i] + T.laenge : k < 0 ? T.s[i] - T.laenge : T.s[i];
    for (let j = 0; j <= spalten; j++) {
      const l = lat(i, j);
      pos.push(T.x[i] + T.tz[i] * l, T.y[i] + hoch(i, j, l), T.z[i] - T.tx[i] * l);
      if (uv) { const [u, v] = uv(i, j, l, s); uvs.push(u, v); }
      if (farbe) { const c = farbe(i, j, l); cols.push(c[0], c[1], c[2]); }
    }
    reihen++;
    if (k >= bis) break;
  }
  const W = spalten + 1;
  // Flache Bänder sollen nach oben zeigen (sonst sieht man sie von oben nicht). Die Richtung hängt davon ab,
  // ob die Spalten nach links oder rechts laufen – das prüfen wir am ersten Viereck.
  const P = k => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  const [a0, b0, c0] = [P(0), P(1), P(W)];
  const e1 = [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]], e2 = [c0[0] - a0[0], c0[1] - a0[1], c0[2] - a0[2]];
  const ny = e1[2] * e2[0] - e1[0] * e2[2];
  const umdrehen = ny < 0;
  for (let r = 0; r < reihen - 1; r++) for (let j = 0; j < spalten; j++) {
    const a = r * W + j, b = a + 1, c = a + W, d = c + 1;
    if (umdrehen) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (farbe) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Bänder liegen flach: Normalen immer nach oben ausrichten, wenn sie falsch herum zeigen
  return g;
}

const mesh = (g, m, schatten = true, empfangen = true) => { const o = new THREE.Mesh(g, m); o.castShadow = schatten; o.receiveShadow = empfangen; return o; };

// Was neben der Strecke liegt (Breite der Randsteine)
const kerbBreite = T => T.def.modell ? T.hb[0] * 0.12 : 1.4;

// ---------------------------------------------------------------- Landschaft je Strecke

const STIMMUNG = {
  mittag: { hoehe: 58, richtung: 140, truebe: 2.2, rayleigh: 0.9, nebel: 0xbcd3e6, nebelWeit: 2600, licht: 3.2, himmel: 0.9, belicht: 0.55 },
  nachmittag: { hoehe: 30, richtung: 230, truebe: 4, rayleigh: 1.4, nebel: 0xc4cfd6, nebelWeit: 2200, licht: 3.0, himmel: 0.8, belicht: 0.55 },
  abend: { hoehe: 5, richtung: 280, truebe: 8, rayleigh: 2.8, nebel: 0xd8a27c, nebelWeit: 2000, licht: 2.4, himmel: 0.75, belicht: 0.62 },
  drinnen: { hoehe: 50, richtung: 200, truebe: 2, rayleigh: 1, nebel: 0x8a7a6a, nebelWeit: 60, licht: 1.6, himmel: 0.9, belicht: 0.9 },
};
export const stimmung = def => STIMMUNG[def.welt.zeit] || STIMMUNG.mittag;

// Räumliches Gitter für "wie weit ist der nächste Streckenpunkt?" (für Gelände und Bäume)
function naeheGitter(T, zelle) {
  const g = new Map(), key = (a, b) => a * 100003 + b;
  const schritt = Math.max(1, Math.round(4 / T.ds));
  for (let i = 0; i < T.n; i += schritt) {
    const k = key(Math.floor(T.x[i] / zelle), Math.floor(T.z[i] / zelle));
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(i);
  }
  return (x, z, max = 2) => {
    const cx = Math.floor(x / zelle), cz = Math.floor(z / zelle);
    let best = -1, bd = Infinity;
    for (let r = 0; r <= max; r++) {
      for (let a = cx - r; a <= cx + r; a++) for (let b = cz - r; b <= cz + r; b++) {
        if (Math.max(Math.abs(a - cx), Math.abs(b - cz)) !== r) continue;
        const l = g.get(key(a, b)); if (!l) continue;
        for (const i of l) { const d = (T.x[i] - x) ** 2 + (T.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
      }
      if (best >= 0 && r >= 1) break;
    }
    return { i: best, d: Math.sqrt(bd) };
  };
}

export function baueWelt(T, szene, { qualitaet = 'hoch' } = {}) {
  const def = T.def, art = def.welt.art;
  const gruppe = new THREE.Group();
  szene.add(gruppe);
  const viel = qualitaet === 'hoch' ? 1 : qualitaet === 'mittel' ? 0.55 : 0.25;
  const modell = !!def.modell;
  const r = TX.zufall(def.id.length * 131 + 7);
  const welt = { gruppe, ampel: [], wasser: [], standorte: [], grenzen: null };

  // Größe der Strecke
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (let i = 0; i < T.n; i++) { minx = Math.min(minx, T.x[i]); maxx = Math.max(maxx, T.x[i]); minz = Math.min(minz, T.z[i]); maxz = Math.max(maxz, T.z[i]); }
  welt.grenzen = { minx, maxx, minz, maxz, mx: (minx + maxx) / 2, mz: (minz + maxz) / 2 };

  // ---------------------------------------------------------------- Fahrbahn
  const as = TX.asphalt();
  const asMat = new THREE.MeshStandardMaterial({
    map: as.map, normalMap: as.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.88, metalness: 0,
    vertexColors: true, color: def.slot ? 0x4a4c50 : modell ? 0x7c7f84 : 0xffffff,
  });
  if (modell) { asMat.map = null; asMat.normalMap = null; asMat.roughness = 0.45; }
  const SP = modell ? 6 : 10;
  const linie = welt.linie;   // wird später gesetzt (Gummi-Abrieb auf der Ideallinie), siehe gummiAuftragen
  const strasse = band(T, 0, T.n, SP, (i, j) => -T.hb[i] + 2 * T.hb[i] * j / SP, () => 0, {
    uv: (i, j, l, s) => [l / 6, s / 6],
    farbe: (i, j) => { const v = 0.92 + 0.08 * Math.sin(T.s[i] * 0.013 + j); return [v, v, v]; },
  });
  welt.strasse = mesh(strasse, asMat, false, true);
  gruppe.add(welt.strasse);

  // Weiße Linien am Rand, Startlinie, Startplätze
  const weiss = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const lb = modell ? 0.006 : 0.22, lrand = modell ? 0.004 : 0.15, hoch = modell ? 0.0004 : 0.012;
  for (const seite of [-1, 1]) {
    gruppe.add(mesh(band(T, 0, T.n, 1, (i, j) => seite * (T.hb[i] - lrand - j * lb), () => hoch), weiss, false, true));
  }
  if (def.slot) {
    // Schlitze der Kunststoffbahn: zwei Spuren, je ein dunkler Schlitz mit Metallstreifen (Strom) daneben
    const schlitz = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 });
    const metall = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    const sp = def.spur;
    for (const spur of [-sp, sp]) {
      for (const m of [-1, 1]) gruppe.add(mesh(band(T, 0, T.n, 1, (i, j) => spur + m * 0.006 + (j - 0.5) * 0.004, () => 0.0004), metall, false, true));
      gruppe.add(mesh(band(T, 0, T.n, 1, (i, j) => spur + (j - 0.5) * 0.004, () => 0.0006), schlitz, false, true));
    }
    // Weichen: Hier kreuzen sich zwei Schlitze, dazu ein gelbes Feld, damit man die Stelle von weitem sieht
    const gelb = new THREE.MeshStandardMaterial({ color: 0xf2c21a, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
    const dsT = T.laenge / T.n, lang = Math.round(WEICHE_LANG / dsT);
    const weich = t => t * t * (3 - 2 * t);
    for (const w of weichen(T)) {
      const von = Math.round(w / dsT);
      const t = i => Math.max(0, Math.min(1, (((i - von) % T.n + T.n) % T.n) / lang));
      for (const seite of [-1, 1]) {
        gruppe.add(mesh(band(T, von, von + lang, 1, (i, j) => seite * sp * (1 - 2 * weich(t(i))) + (j - 0.5) * 0.004, () => 0.0007), schlitz, false, true));
        // gelbe Pfeile am Rand vor der Weiche
        gruppe.add(mesh(band(T, von - 3, von + 1, 1, (i, j) => seite * (T.hb[i] - 0.012 - j * 0.014), () => 0.0005), gelb, false, true));
      }
      gruppe.add(mesh(band(T, von - 1, von, 1, (i, j) => -0.02 + j * 0.04, () => 0.0005), gelb, false, true));
    }
  }
  // Startlinie und Zielflagge auf dem Boden
  {
    const i = 0, w = T.hb[i] * 2, tief = modell ? 0.02 : 1.2;
    const k = new THREE.Mesh(new THREE.PlaneGeometry(w, tief), new THREE.MeshStandardMaterial({ map: TX.karo().map, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3 }));
    k.material.map = k.material.map.clone(); k.material.map.repeat.set(w / (tief * 4), 1); k.material.map.needsUpdate = true;
    k.rotation.x = -Math.PI / 2; k.rotation.z = Math.atan2(T.tx[i], T.tz[i]) + Math.PI / 2;
    k.position.set(T.x[i], T.y[i] + hoch * 1.5, T.z[i]); k.receiveShadow = true;
    gruppe.add(k);
    // Startplätze: weiße Winkel
    if (!modell) for (let p = 0; p < 12; p++) {
      const s = T.laenge - 6 - p * 8, d = (p % 2 ? -1 : 1) * Math.min(3, T.hb[0] * 0.45);
      const j = T.index(s), box = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.2), weiss);
      box.rotation.x = -Math.PI / 2; box.rotation.z = Math.atan2(T.tx[j], T.tz[j]) + Math.PI / 2;
      box.position.set(T.x[j] + T.tz[j] * d + T.tx[j] * 2.6, T.y[j] + hoch, T.z[j] - T.tx[j] * d + T.tz[j] * 2.6);
      gruppe.add(box);
    }
  }

  // ---------------------------------------------------------------- Randsteine
  const kb = kerbBreite(T);
  const kerbMat = new THREE.MeshStandardMaterial({ map: TX.kerb().map, roughness: 0.6 });
  for (const seite of [1, -1]) {
    const flag = seite > 0 ? T.kerbL : T.kerbR;
    for (const [von, bis] of abschnitte(T.n, i => flag[i])) {
      gruppe.add(mesh(band(T, von, bis, 2, (i, j) => seite * (T.hb[i] - (modell ? 0 : 0.05) + kb * j / 2), (i, j) => (modell ? 0.0003 : 0.01) + (j === 1 ? (modell ? 0.0006 : 0.05) : j === 2 ? (modell ? 0.0003 : 0.02) : 0), {
        uv: (i, j, l, s) => [j / 2, s / (modell ? 0.05 : 4)],
      }), kerbMat, false, true));
    }
  }

  // ---------------------------------------------------------------- Auslauf (Gras, Kies, Gehweg)
  const grasT = TX.rasenStreifen(), kiesT = TX.kies(), betonT = TX.beton();
  const grasMat = new THREE.MeshStandardMaterial({ map: grasT.map, roughness: 0.95, color: art === 'kueste' ? 0xd6e0a8 : 0xffffff });
  const kiesMat = new THREE.MeshStandardMaterial({ map: kiesT.map, normalMap: kiesT.normalMap, roughness: 1 });
  const randMat = modell
    ? new THREE.MeshStandardMaterial({ color: 0x6d7076, roughness: 0.5 })
    : new THREE.MeshStandardMaterial({ map: betonT.map, normalMap: betonT.normalMap, roughness: 0.9, color: 0xd8d8d0 });
  for (const seite of [1, -1]) {
    const artArr = seite > 0 ? T.artL : T.artR, aus = seite > 0 ? T.ausL : T.ausR;
    for (const [code, mat, gross] of [[BELAG.gras, grasMat, 10], [BELAG.kies, kiesMat, 6], [BELAG.mauer, randMat, 4], [BELAG.asphalt, randMat, 4]]) {
      for (const [von, bis] of abschnitte(T.n, i => artArr[i] === code)) {
        gruppe.add(mesh(band(T, von - 1, bis + 1, 2, (i, j) => seite * (T.hb[i] + (aus[i] + (modell ? 0 : 0.6)) * j / 2), (i, j) => modell ? 0 : (code === BELAG.mauer ? 0.12 : -0.03) * (j > 0 ? 1 : 0), {
          uv: (i, j, l, s) => [l / gross, s / gross], schritt: 1,
        }), mat, false, true));
      }
    }
  }

  // ---------------------------------------------------------------- Begrenzung: Leitplanke, Reifen, Mauer
  baueBegrenzung(T, gruppe, viel, modell);

  // ---------------------------------------------------------------- Startampel über der Strecke
  baueAmpel(T, gruppe, welt, modell);

  // ---------------------------------------------------------------- Umgebung
  if (modell) baueZimmer(T, gruppe, welt, r);
  else {
    baueGelaende(T, gruppe, welt, art, viel, r);
    baueTribuenen(T, gruppe, welt, viel, r);
    if (art === 'hafen') baueStadt(T, gruppe, welt, viel, r);
  }
  return welt;
}

// Gummi auf der Ideallinie: Die Fahrbahn wird dort etwas dunkler (wie bei echten Rennstrecken)
export function gummiAuftragen(welt, T, L) {
  const g = welt.strasse.geometry, col = g.getAttribute('color'), pos = g.getAttribute('position');
  const SP = T.def.modell ? 6 : 10, W = SP + 1;
  if (T.def.modell) return;
  for (let r = 0; r * W < pos.count; r++) {
    const i = Math.min(T.n - 1, r) % T.n;
    for (let j = 0; j <= SP; j++) {
      const l = -T.hb[i] + 2 * T.hb[i] * j / SP;
      const ab = Math.abs(l - L.off[i]);
      const dunkel = Math.max(0, 1 - ab / 2.2) * 0.32;
      const v = col.getX(r * W + j) * (1 - dunkel);
      col.setXYZ(r * W + j, v, v, v);
    }
  }
  col.needsUpdate = true;
}

function baueBegrenzung(T, gruppe, viel, modell) {
  const n = T.n, def = T.def;
  const blech = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide });
  const pfostenMat = new THREE.MeshStandardMaterial({ color: 0x777a7e, roughness: 0.6, metalness: 0.5 });
  const wandMat = new THREE.MeshStandardMaterial({ color: 0xe6e4dc, roughness: 0.85, side: THREE.DoubleSide });
  const wb = TX.werbung();
  const werbeMat = new THREE.MeshStandardMaterial({ map: wb.map, roughness: 0.6, side: THREE.DoubleSide });
  const plastik = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.5, side: THREE.DoubleSide });
  const plastikRot = new THREE.MeshStandardMaterial({ color: 0xd22828, roughness: 0.45 });
  const zaunT = TX.zaun().map.clone(); zaunT.needsUpdate = true;
  const zaunMat = new THREE.MeshStandardMaterial({ map: zaunT, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4, depthWrite: true });
  const reifenMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95 });
  const pfosten = [], reifen = [];
  const wo = (i, l) => [T.x[i] + T.tz[i] * l, T.z[i] - T.tx[i] * l];

  for (const seite of [1, -1]) {
    const aus = seite > 0 ? T.ausL : T.ausR, artA = seite > 0 ? T.artL : T.artR;
    const lat = i => seite * (T.hb[i] + aus[i] + (modell ? 0 : 0.6));
    if (def.slot) continue;   // die Slotcar-Bahn hat keine Wand: wer zu schnell ist, fliegt raus
    if (modell) {
      // Kunststoff-Leitplanke: dunkle Wand mit rotem Streifen oben
      gruppe.add(mesh(band(T, 0, n, 2, (i, j) => lat(i) + seite * (j === 2 ? 0.006 : 0), (i, j) => j === 0 ? 0 : 0.028), plastik));
      gruppe.add(mesh(band(T, 0, n, 1, (i, j) => lat(i) + seite * 0.006 * j, () => 0.0285), plastikRot));
      continue;
    }
    // Mauer (Stadtkurs) oder Leitplanke
    const istMauer = i => artA[i] === BELAG.mauer;
    for (const [von, bis] of abschnitte(n, istMauer)) {
      // Innenseite mit Werbung, Oberseite, Außenseite
      const reihe = Math.floor(r01(von) * wb.anzahl);
      gruppe.add(mesh(band(T, von, bis, 1, i => lat(i), (i, j) => j * 1.1, {
        uv: (i, j, l, s) => [s / 30, (reihe + (j ? 0.95 : 0.05)) / wb.anzahl],
      }), werbeMat));
      gruppe.add(mesh(band(T, von, bis, 1, (i, j) => lat(i) + seite * 0.5 * j, () => 1.1), wandMat));
      gruppe.add(mesh(band(T, von, bis, 1, (i, j) => lat(i) + seite * 0.5, (i, j) => j * 1.1), wandMat));
      // Fangzaun auf der Mauer
      gruppe.add(mesh(band(T, von, bis, 1, i => lat(i) + seite * 0.25, (i, j) => 1.1 + j * 3.2, { uv: (i, j, l, s) => [s / 0.5, j * 3.2 / 0.5] }), zaunMat, false, false));
      for (let k = von; k <= bis; k += Math.max(1, Math.round(6 / T.ds))) { const i = ((k % n) + n) % n; const [x, z] = wo(i, lat(i) + seite * 0.25); pfosten.push([x, T.y[i] + 1.1, z, 3.3, 0.06]); }
    }
    for (const [von, bis] of abschnitte(n, i => !istMauer(i))) {
      // Leitplanke: zwei Blechbänder auf Pfosten
      for (const h of [0.45, 0.75]) gruppe.add(mesh(band(T, von, bis, 1, (i, j) => lat(i), (i, j) => h + j * 0.22), blech));
      for (let k = von; k <= bis; k += Math.max(1, Math.round(4 / T.ds))) { const i = ((k % n) + n) % n; const [x, z] = wo(i, lat(i) + seite * 0.08); pfosten.push([x, T.y[i], z, 1.0, 0.05]); }
      // Werbebande davor an Geraden
      // Reifenstapel vor der Leitplanke, wo Kies liegt (Kurven außen)
      for (let k = von; k <= bis; k += Math.max(1, Math.round(0.75 / T.ds))) {
        const i = ((k % n) + n) % n;
        if (artA[i] !== BELAG.kies || r01(i * 7 + seite) > 0.97) continue;
        for (const reihe of [0, 1]) { const [x, z] = wo(i, lat(i) - seite * (0.45 + reihe * 0.7)); reifen.push([x, T.y[i], z]); }
      }
      // Fangzaun hinter der Leitplanke auf Geraden
      gruppe.add(mesh(band(T, von, bis, 1, i => lat(i) + seite * 2.5, (i, j) => j * 3.6, { uv: (i, j, l, s) => [s / 0.5, j * 3.6 / 0.5] }), zaunMat, false, false));
    }
  }
  // Pfosten und Reifen als "Instanzen": ein Modell, tausendmal hingestellt (schnell)
  if (pfosten.length) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 6); g.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(g, pfostenMat, pfosten.length);
    const m4 = new THREE.Matrix4();
    pfosten.forEach(([x, y, z, h, rr], k) => { m4.makeScale(rr, h, rr); m4.setPosition(x, y, z); im.setMatrixAt(k, m4); });
    im.castShadow = true; gruppe.add(im);
  }
  if (reifen.length) {
    const g = new THREE.CylinderGeometry(0.36, 0.36, 0.72, 10); g.translate(0, 0.36, 0);
    const im = new THREE.InstancedMesh(g, reifenMat, reifen.length);
    const m4 = new THREE.Matrix4();
    reifen.forEach(([x, y, z], k) => { m4.makeTranslation(x, y, z); im.setMatrixAt(k, m4); });
    im.castShadow = true; im.receiveShadow = true; gruppe.add(im);
  }
}
const r01 = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function baueAmpel(T, gruppe, welt, modell) {
  const sc = modell ? MASSSTAB : 1;
  const i = T.index(T.laenge - 2 * sc);
  const breite = (T.hb[i] * 2 + (T.def.slot ? 0.06 : modell ? 0.3 : 4)) / sc;
  const g = new THREE.Group();
  const dunkel = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5, metalness: 0.5 });
  const traeger = new THREE.Mesh(new THREE.BoxGeometry(breite, 0.5, 0.6), dunkel); traeger.position.y = 6.2; g.add(traeger);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.4, 0.5), dunkel); p.position.set(s * breite / 2, 3.2, 0); p.castShadow = true; g.add(p); }
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.5), dunkel); kasten.position.y = 5.4; g.add(kasten);
  for (let k = 0; k < 5; k++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a1a, emissiveIntensity: 0 });
    for (const hh of [5.65, 5.15]) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.19, 16), mat);
      l.position.set((k - 2) * 0.62, hh, -0.26); l.rotation.y = Math.PI; g.add(l);
    }
    welt.ampel.push(mat);
  }
  // Schild "START" oben
  g.position.set(T.x[i], T.y[i], T.z[i]);
  g.rotation.y = Math.atan2(T.tx[i], T.tz[i]);
  g.scale.setScalar(sc);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  gruppe.add(g);
}

// ---------------------------------------------------------------- Gelände, Meer, Bäume

function baueGelaende(T, gruppe, welt, art, viel, r) {
  const { minx, maxx, minz, maxz } = welt.grenzen;
  const rand = 900;
  const x0 = minx - rand, x1 = maxx + rand, z0 = minz - rand, z1 = maxz + rand;
  const N = qualitaetsGitter(viel);
  const nah = naeheGitter(T, 60);
  const rs = TX.rauschen(art.length * 17);
  const amp = art === 'wald' ? 70 : art === 'kueste' ? 34 : 4;
  const meer = art === 'kueste' ? minz - 70 : art === 'hafen' ? maxz + 60 : null;
  const pos = [], cols = [], idx = [];
  const gruen = new THREE.Color(0x5c8a3a), trocken = new THREE.Color(0xa7a35a), fels = new THREE.Color(0x8b8173), sandC = new THREE.Color(0xd8c48e), stadt = new THREE.Color(0x7d7d78), wald = new THREE.Color(0x2f5a2a);
  const hoehe = (x, z) => {
    const f = nah(x, z, 4);
    const ty = f.i >= 0 ? T.y[f.i] : 0;
    const frei = f.i >= 0 ? T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 14 : 0;
    const d = f.i >= 0 ? f.d : 1e4;
    const w = Math.min(1, Math.max(0, (d - frei) / 260));
    const glatt = w * w * (3 - 2 * w);
    let h = ty - 0.35 + glatt * (rs(x / 700, z / 700, 4) * amp + amp * 0.35 + (art === 'wald' ? Math.max(0, rs(x / 1800 + 5, z / 1800, 2)) * 120 * glatt : 0));
    if (meer !== null) {
      const ab = art === 'kueste' ? (meer - z) : (z - meer);   // wie weit im Meer
      if (ab > 0) h = Math.min(h, ty - 0.35 - Math.min(1, ab / 25) * 14);
    }
    return { h, d, glatt };
  };
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = x0 + (x1 - x0) * i / N, z = z0 + (z1 - z0) * j / N;
    const { h, d, glatt } = hoehe(x, z);
    pos.push(x, h, z);
    const c = new THREE.Color();
    const v = rs(x / 90, z / 90, 3) * 0.5 + 0.5;
    if (art === 'hafen') c.copy(stadt).lerp(gruen, glatt * 0.4 * v);
    else if (art === 'kueste') { c.copy(gruen).lerp(trocken, 0.35 + v * 0.5); if (h < 1.2) c.copy(sandC); if (h < -2) c.copy(fels); }
    else { c.copy(gruen).lerp(wald, glatt * 0.7).lerp(trocken, v * 0.25); }
    if (meer !== null && h < -3) c.copy(fels);
    cols.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const uvs = []; for (let k = 0; k < pos.length; k += 3) uvs.push(pos[k] / 12, pos[k + 2] / 12);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const gt = TX.gras();
  const gm = new THREE.MeshStandardMaterial({ map: gt.map, vertexColors: true, roughness: 1, color: 0xcfcfcf });
  const boden = mesh(g, gm, false, true);
  gruppe.add(boden);

  // ferne Berge rundherum (gehen im Dunst unter)
  if (art !== 'hafen') {
    const ring = new THREE.CylinderGeometry(5200, 5200, 1, 64, 1, true);
    const bpos = [], bidx = [], M = 128, rsB = TX.rauschen(5);
    const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
    for (let k = 0; k <= M; k++) {
      const a = k / M * Math.PI * 2;
      const hh = (art === 'wald' ? 420 : 260) * (0.55 + 0.45 * rsB(Math.cos(a) * 3, Math.sin(a) * 3, 4));
      const meerSeite = art === 'kueste' && Math.sin(a) < -0.2;
      bpos.push(cx + Math.cos(a) * 4200, -20, cz + Math.sin(a) * 4200, cx + Math.cos(a) * 4600, meerSeite ? -10 : hh, cz + Math.sin(a) * 4600);
    }
    for (let k = 0; k < M; k++) { const a = k * 2; bidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    ring.dispose();
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3)); bg.setIndex(bidx); bg.computeVertexNormals();
    gruppe.add(new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: art === 'wald' ? 0x4a6a4a : 0x8a8f7a, roughness: 1, side: THREE.DoubleSide })));
  }

  // Meer
  if (meer !== null) {
    const w = TX.wellen();
    const nm = w.normalMap.clone(); nm.needsUpdate = true; nm.repeat.set(60, 60);
    const wm = new THREE.MeshPhysicalMaterial({ color: art === 'kueste' ? 0x1d5f86 : 0x23465a, roughness: 0.08, metalness: 0.1, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.6 });
    const wasser = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), wm);
    wasser.rotation.x = -Math.PI / 2; wasser.position.set((minx + maxx) / 2, -1.2, (minz + maxz) / 2);
    wasser.receiveShadow = true;
    gruppe.add(wasser);
    welt.wasser.push(nm);
  }

  // Bäume
  baueBaeume(T, gruppe, art, viel, nah, hoehe, x0, x1, z0, z1, r, meer);
}

const qualitaetsGitter = viel => viel >= 1 ? 220 : viel > 0.5 ? 160 : 110;

function baueBaeume(T, gruppe, art, viel, nah, hoehe, x0, x1, z0, z1, r, meer) {
  if (art === 'hafen') return;
  const anzahl = Math.round((art === 'wald' ? 9000 : 3500) * viel);
  const rs = TX.rauschen(77);
  // Baumarten: Nadelbaum (Kegel), Laubbaum (Kugeln), Pinie (Schirm), Zypresse (schmal)
  const stamm = new THREE.CylinderGeometry(0.18, 0.28, 1, 6); stamm.translate(0, 0.5, 0);
  const formen = {
    nadel: () => { const k1 = new THREE.ConeGeometry(2.6, 6, 8); k1.translate(0, 5, 0); const k2 = new THREE.ConeGeometry(2, 5, 8); k2.translate(0, 7.5, 0); const k3 = new THREE.ConeGeometry(1.3, 3.5, 8); k3.translate(0, 9.7, 0); return mergeGeometries([k1, k2, k3]); },
    laub: () => { const a = new THREE.IcosahedronGeometry(2.6, 1); a.translate(0, 5.5, 0); const b = new THREE.IcosahedronGeometry(2, 1); b.translate(1.3, 6.8, 0.5); const c = new THREE.IcosahedronGeometry(1.9, 1); c.translate(-1.1, 6.5, -0.7); return mergeGeometries([a, b, c]); },
    pinie: () => { const a = new THREE.SphereGeometry(3.4, 10, 6); a.scale(1, 0.38, 1); a.translate(0, 7.8, 0); return a; },
    zypresse: () => { const a = new THREE.SphereGeometry(1, 8, 8); a.scale(1.1, 5, 1.1); a.translate(0, 5.2, 0); return a; },
  };
  const arten = art === 'wald' ? [['nadel', 0x2c4f2a, 0.65, 1], ['laub', 0x3f6b2e, 0.35, 0.9]] : [['pinie', 0x3d5f2c, 0.5, 1], ['zypresse', 0x2a4a26, 0.3, 1], ['laub', 0x587a35, 0.2, 0.8]];
  const stammHoehe = { nadel: 3, laub: 4, pinie: 7.4, zypresse: 1.5 };
  const kroneMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const stammMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 });
  for (const [name, farbe, anteil, groesse] of arten) {
    const zahl = Math.round(anzahl * anteil);
    const krone = new THREE.InstancedMesh(formen[name](), kroneMat, zahl);
    const st = new THREE.InstancedMesh(stamm, stammMat, zahl);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    let k = 0, versuche = 0;
    while (k < zahl && versuche < zahl * 30) {
      versuche++;
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      const f = nah(x, z, 3);
      if (f.i >= 0 && f.d < T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 9) continue;
      // Wälder in Gruppen (wo das Rauschen hoch ist), sonst nur vereinzelt
      const dicht = rs(x / 260, z / 260, 3);
      if (dicht < (art === 'wald' ? -0.25 : 0.15) && r() > 0.08) continue;
      const hh = hoehe(x, z);
      if (meer !== null && hh.h < 0.5) continue;
      const s = (0.75 + r() * 0.6) * groesse;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      m4.compose(new THREE.Vector3(x, hh.h - 0.2, z), q, new THREE.Vector3(s, s, s));
      krone.setMatrixAt(k, m4);
      m4.compose(new THREE.Vector3(x, hh.h - 0.2, z), q, new THREE.Vector3(s, s * stammHoehe[name], s));
      st.setMatrixAt(k, m4);
      c.setHex(farbe).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08);
      krone.setColorAt(k, c);
      k++;
    }
    krone.count = st.count = k;
    krone.castShadow = st.castShadow = true;
    krone.receiveShadow = true;
    gruppe.add(krone, st);
  }
}

// ---------------------------------------------------------------- Tribünen, Boxengebäude

function baueTribuenen(T, gruppe, welt, viel, r) {
  const zMat = new THREE.MeshStandardMaterial({ map: TX.zuschauer().map, roughness: 0.9 });
  const grau = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.7, metalness: 0.2 });
  const dach = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
  const glas = new THREE.MeshStandardMaterial({ color: 0x5f7d93, roughness: 0.1, metalness: 0.8 });
  const n = T.n;
  // Wo steht man? Innen oder außen an der Start-Ziel-Geraden
  let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += T.x[i]; cz += T.z[i]; } cx /= n; cz /= n;
  const innen = ((cx - T.x[0]) * T.tz[0] - (cz - T.z[0]) * T.tx[0]) > 0 ? 1 : -1;   // +1 = Mitte liegt links
  const tribuene = (i, seite, laenge, reihen = 10) => {
    const ab = T.hb[i] + (seite > 0 ? T.ausL[i] : T.ausR[i]) + 0.6 + 6;
    const g = new THREE.Group();
    const tiefe = reihen * 0.9, hoehe = reihen * 0.55;
    // Schräge mit Zuschauern
    const schraege = new THREE.PlaneGeometry(laenge, Math.hypot(tiefe, hoehe));
    const tex = zMat.map.clone(); tex.needsUpdate = true; tex.repeat.set(laenge / 24, reihen / 8);
    const sm = new THREE.Mesh(schraege, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    // schräg nach hinten ansteigend, die Zuschauer schauen zur Strecke
    sm.rotation.set(-Math.PI / 2 - Math.atan2(hoehe, tiefe), 0, Math.PI); sm.position.set(0, 1.5 + hoehe / 2, tiefe / 2);
    g.add(sm);
    // Unterbau und Rückwand
    const unten = new THREE.Mesh(new THREE.BoxGeometry(laenge, 1.5, tiefe), grau); unten.position.set(0, 0.75, tiefe / 2); g.add(unten);
    const rueck = new THREE.Mesh(new THREE.BoxGeometry(laenge, hoehe + 4.5, 0.4), grau); rueck.position.set(0, (hoehe + 4.5) / 2, tiefe + 0.2); g.add(rueck);
    for (const s of [-1, 1]) { const seiteW = new THREE.Mesh(new THREE.BoxGeometry(0.4, hoehe + 1.5, tiefe), grau); seiteW.position.set(s * laenge / 2, (hoehe + 1.5) / 2, tiefe / 2); g.add(seiteW); }
    // Dach
    const d = new THREE.Mesh(new THREE.BoxGeometry(laenge + 2, 0.25, tiefe + 3), dach); d.position.set(0, hoehe + 4.6, tiefe / 2 - 1); d.rotation.x = -0.06; g.add(d);
    for (let k = -laenge / 2; k <= laenge / 2; k += 12) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.3, hoehe + 4.6, 0.3), grau); st.position.set(k, (hoehe + 4.6) / 2, tiefe - 0.2); g.add(st); }
    // aufstellen: Rücken weg von der Strecke
    const nx = T.tz[i] * seite, nz = -T.tx[i] * seite;
    g.position.set(T.x[i] + nx * ab, T.y[i] - 0.2, T.z[i] + nz * ab);
    g.rotation.y = Math.atan2(nx, nz);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    gruppe.add(g);
  };
  // Haupttribüne gegenüber der Box, Boxengebäude innen
  const lang = Math.min(240, T.laenge * 0.06);
  const iStart = T.index(-lang * 0.3);
  tribuene(iStart, -innen, lang, 14);
  // Boxengebäude
  {
    const i = T.index(-lang * 0.4), seite = innen;
    const ab = T.hb[i] + (seite > 0 ? T.ausL[i] : T.ausR[i]) + 0.6 + 14;
    const g = new THREE.Group();
    const hausT = TX.fassade('tag');
    const fm = new THREE.MeshStandardMaterial({ map: hausT.map.clone(), roughness: 0.6, color: 0xdfe6ee }); fm.map.repeat.set(lang / 30, 1); fm.map.needsUpdate = true;
    const haus = new THREE.Mesh(new THREE.BoxGeometry(lang * 1.3, 9, 16), [fm, fm, grau, grau, fm, fm]); haus.position.set(0, 4.5, 8); g.add(haus);
    const band2 = new THREE.Mesh(new THREE.BoxGeometry(lang * 1.3, 2.2, 0.3), glas); band2.position.set(0, 7.4, -0.1); g.add(band2);
    // Boxentore
    const tor = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5 });
    for (let k = -lang * 0.6; k < lang * 0.6; k += 14) { const t = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.2), tor); t.position.set(k + 7, 2.1, -0.02); t.rotation.y = Math.PI; g.add(t); }
    const nx = T.tz[i] * seite, nz = -T.tx[i] * seite;
    g.position.set(T.x[i] + nx * ab, T.y[i] - 0.1, T.z[i] + nz * ab);
    g.rotation.y = Math.atan2(nx, nz);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    gruppe.add(g);
    // Boden vor der Box (Boxengasse) aus Asphalt
    const as = TX.asphalt();
    const gasse = new THREE.Mesh(new THREE.PlaneGeometry(lang * 1.3, 14), new THREE.MeshStandardMaterial({ map: as.map, roughness: 0.9, color: 0x9a9a9a }));
    gasse.rotation.x = -Math.PI / 2; gasse.position.set(0, 0.04, -7); g.add(gasse); gasse.receiveShadow = true;
  }
  // kleinere Tribünen an engen Kurven (außen)
  const enge = [];
  for (let i = 0; i < n; i += 5) if (Math.abs(T.k[i]) > 1 / 45 && !enge.some(j => Math.abs(T.s[j] - T.s[i]) < 300)) enge.push(i);
  enge.slice(0, Math.round(5 * Math.max(0.4, viel))).forEach(i => tribuene(i, T.k[i] > 0 ? -1 : 1, 50, 9));
}

// ---------------------------------------------------------------- Stadt am Hafen (Häuser zwischen den Straßen)

function baueStadt(T, gruppe, welt, viel, r) {
  const nah = naeheGitter(T, 40);
  const { minx, maxx, minz, maxz } = welt.grenzen;
  const tex = TX.fassade('abend');
  const farben = [0xe8d8c0, 0xd9b38c, 0xc98f6a, 0xf0e6d2, 0xb7c4cf, 0xe3c99b, 0xd7a8a0];
  const geos = farben.map(() => []);
  const block = 26;
  for (let x = minx - 300; x < maxx + 300; x += block) for (let z = minz - 300; z < maxz + 60; z += block) {
    const px = x + (r() - 0.5) * 4, pz = z + (r() - 0.5) * 4;
    const f = nah(px, pz, 3);
    const frei = f.i >= 0 ? T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 13 : 0;
    if (f.i >= 0 && f.d < frei) continue;
    if (r() < 0.12) continue;
    const w = 14 + r() * 8, d = 14 + r() * 8, h = 9 + Math.floor(r() * 6) * 3.2 + (f.d > 200 ? r() * 20 : 0);
    const g = new THREE.BoxGeometry(w, h, d);
    // Fenster passend zur Größe: Bildkoordinaten strecken
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) {
      const face = Math.floor(k / 4);
      const sx = face < 2 ? d : w;
      uv.setXY(k, uv.getX(k) * sx / 42, uv.getY(k) * (face === 2 || face === 3 ? 0 : h / 25.6));
    }
    g.translate(px, (f.i >= 0 ? T.y[f.i] : 0) + h / 2 - 0.4, pz);
    geos[Math.floor(r() * farben.length)].push(g);
  }
  const lichtMap = tex.leucht;
  geos.forEach((liste, k) => {
    if (!liste.length) return;
    const m = new THREE.MeshStandardMaterial({ map: tex.map, color: farben[k], roughness: 0.8, emissiveMap: lichtMap, emissive: 0xffd9a0, emissiveIntensity: 0.9 });
    const o = mesh(mergeGeometries(liste), m, true, true);
    gruppe.add(o);
  });
  // Boote im Hafen
  const rumpfMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.5 });
  for (let k = 0; k < 40 * viel; k++) {
    const b = new THREE.Group();
    const l = 8 + r() * 14;
    const rumpf = new THREE.Mesh(new THREE.CylinderGeometry(l * 0.18, l * 0.12, l, 8, 1), rumpfMat);
    rumpf.rotation.x = Math.PI / 2; rumpf.scale.set(1, 1, 0.45); b.add(rumpf);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, l * 1.2, 5), mastMat); mast.position.y = l * 0.6; b.add(mast);
    b.position.set(minx + r() * (maxx - minx), -0.9, maxz + 120 + r() * 300);
    b.rotation.y = r() * 6;
    gruppe.add(b);
  }
  // Straßenlaternen entlang der Mauern
  const lampe = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffcf80, emissiveIntensity: 2.5 });
  const mastG = new THREE.CylinderGeometry(0.08, 0.12, 7, 5); mastG.translate(0, 3.5, 0);
  const kopfG = new THREE.SphereGeometry(0.35, 8, 6); kopfG.translate(0, 7.1, 0);
  const pos = [];
  for (let i = 0; i < T.n; i += Math.round(35 / T.ds)) for (const s of [-1, 1]) {
    const l = s * (T.hb[i] + (s > 0 ? T.ausL[i] : T.ausR[i]) + 2.5);
    pos.push([T.x[i] + T.tz[i] * l, T.y[i], T.z[i] - T.tx[i] * l]);
  }
  const mi = new THREE.InstancedMesh(mastG, new THREE.MeshStandardMaterial({ color: 0x2b2b2b }), pos.length);
  const ki = new THREE.InstancedMesh(kopfG, lampe, pos.length);
  const m4 = new THREE.Matrix4();
  pos.forEach(([x, y, z], k) => { m4.makeTranslation(x, y, z); mi.setMatrixAt(k, m4); ki.setMatrixAt(k, m4); });
  gruppe.add(mi, ki);
}

// ---------------------------------------------------------------- Wohnzimmer (Modellauto)

function baueZimmer(T, gruppe, welt, r) {
  const { minx, maxx, minz, maxz } = welt.grenzen;
  const mx = (minx + maxx) / 2, mz = (minz + maxz) / 2;
  // Das Zimmer ist so groß, dass die Bahn mit Platz zum Herumgehen hineinpasst
  const W = Math.max(7.5, maxx - minx + 3.4), D = Math.max(6.5, maxz - minz + 3.6), H = 2.7;
  // Boden
  const pk = TX.parkett().map.clone(); pk.needsUpdate = true; pk.repeat.set(W / 1.6, D / 1.6);
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: pk, roughness: 0.45 }));
  boden.rotation.x = -Math.PI / 2; boden.position.set(mx, -0.004, mz); boden.receiveShadow = true; gruppe.add(boden);
  // Teppich unter der Bahn
  const tp = TX.teppich().map.clone(); tp.needsUpdate = true; tp.repeat.set(6, 4);
  const tw = maxx - minx + 1.3, td = maxz - minz + 1.3;
  const tep = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.006, td), new THREE.MeshStandardMaterial({ map: tp, roughness: 1 }));
  tep.position.set(mx, -0.004, mz); tep.receiveShadow = true; gruppe.add(tep);
  // Bahn-Untergrund (die Platten der Kunststoffbahn sind etwas dick: Bahn liegt 4 mm hoch – hier flach)
  // Wände
  const wand = new THREE.MeshStandardMaterial({ color: 0xe9e1d2, roughness: 0.9, side: THREE.BackSide });
  const raum = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wand); raum.position.set(mx, H / 2 - 0.005, mz); raum.receiveShadow = true; gruppe.add(raum);
  // Fußleisten
  const leiste = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  for (const [w, d, x, z] of [[W, 0.02, 0, -D / 2 + 0.01], [W, 0.02, 0, D / 2 - 0.01], [0.02, D, -W / 2 + 0.01, 0], [0.02, D, W / 2 - 0.01, 0]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), leiste); l.position.set(mx + x, 0.04, mz + z); gruppe.add(l);
  }
  // Fenster (hell) an einer Wand
  for (const x of [-1.6, 1.6]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.5), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeeff, emissiveIntensity: 1.4 }));
    f.position.set(mx + x, 1.5, mz - D / 2 + 0.02); gruppe.add(f);
    const rahmen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 0.04), leiste); rahmen.position.set(mx + x, 1.5, mz - D / 2 + 0.005); gruppe.add(rahmen);
    rahmen.scale.z = 0.5;
  }
  // Sofa
  const stoff = new THREE.MeshStandardMaterial({ color: 0x3f5d7a, roughness: 0.95 });
  const sofa = new THREE.Group();
  const sitz = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 0.9), stoff); sitz.position.y = 0.21; sofa.add(sitz);
  const lehne = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.22), stoff); lehne.position.set(0, 0.62, 0.34); sofa.add(lehne);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.9), stoff); arm.position.set(s * 1.1, 0.3, 0); sofa.add(arm); }
  for (let k = -1; k <= 1; k += 2) { const kissen = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.75), new THREE.MeshStandardMaterial({ color: 0x4a6b8a, roughness: 1 })); kissen.position.set(k * 0.5, 0.48, -0.02); sofa.add(kissen); }
  sofa.position.set(mx, 0, mz + D / 2 - 0.55);   // Lehne an der Wand, Sitz zeigt ins Zimmer
  gruppe.add(sofa);
  // Fernseh-Schrank und Fernseher
  const holz = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.6 });
  const schrank = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.45), holz); schrank.position.set(mx, 0.25, mz - D / 2 + 0.3); gruppe.add(schrank);
  const tv = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.05), new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.2, metalness: 0.4 }));
  tv.position.set(mx, 0.95, mz - D / 2 + 0.25); gruppe.add(tv);
  welt.fernseher = tv;
  // Pflanze in der Ecke
  const topf = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 14), new THREE.MeshStandardMaterial({ color: 0xc8683a, roughness: 0.8 }));
  topf.position.set(mx + W / 2 - 0.4, 0.2, mz - D / 2 + 0.4); gruppe.add(topf);
  for (let k = 0; k < 9; k++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.9, flatShading: true }));
    b.scale.set(0.6, 1.6, 0.25); b.position.set(topf.position.x + (r() - 0.5) * 0.3, 0.75 + r() * 0.5, topf.position.z + (r() - 0.5) * 0.3); b.rotation.set(r() - 0.5, r() * 6, r() - 0.5);
    gruppe.add(b);
  }
  // Regal mit Büchern
  const regal = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.9, 1.6), holz); regal.position.set(mx - W / 2 + 0.2, 0.95, mz + 0.6); gruppe.add(regal);
  for (let b = 0; b < 4; b++) for (let k = 0; k < 14; k++) {
    const buch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24 + r() * 0.08, 0.06), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(r(), 0.5, 0.45), roughness: 0.8 }));
    buch.position.set(mx - W / 2 + 0.26, 0.2 + b * 0.45 + 0.13, mz + 0.6 - 0.7 + k * 0.1); gruppe.add(buch);
  }
  // Schachtel der Rennbahn
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0xd8262a, roughness: 0.6 }));
  box.position.set(maxx + 0.55, 0.06, minz - 0.05); box.rotation.y = 0.3; gruppe.add(box);
  gruppe.traverse(o => { if (o.isMesh) { o.receiveShadow = true; if (o !== raum && o !== boden && o !== tep) o.castShadow = true; } });

  // Wo man stehen kann (Augenhöhe 1,5 m): drei Stellen rund um die Bahn
  const aug = 1.5;
  welt.standorte = [
    { name: 'An der Startlinie', x: T.x[0] + T.tz[0] * (T.hb[0] + 0.9), y: aug, z: T.z[0] - T.tx[0] * (T.hb[0] + 0.9) },
    { name: 'Vor dem Sofa', x: mx, y: aug, z: maxz + 1.0 },
    { name: 'Am Regal', x: minx - 0.9, y: aug, z: mz + 0.2 },
    { name: 'Auf dem Stuhl (Überblick)', x: maxx + 1.0, y: 2.25, z: maxz + 0.9 },
  ];
}
