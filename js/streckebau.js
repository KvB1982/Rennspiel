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
import { boxLage } from './box.js';
import { baueStrassenWelt, berge, grossstadt, kiste, giebel, hausMaterialien } from './stadtbau.js';
import { modell, alsGruppe, baumModell, echtGruppe, baumBild } from './modelle.js';

// ---------------------------------------------------------------- Hilfen

// Abschnitte, in denen pruef(i) wahr ist: [[von, bis], …] (bis einschließlich, kann über das Ende der Runde gehen)
export function abschnitte(n, pruef) {
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

// Riesige Strecken (def.weit, über 20 km): Alles wird in Stücke geteilt. Der Rechner malt dann nur die Stücke,
// die gerade im Bild sind – sonst müsste er in jedem Bild die ganze Strecke durchrechnen.
// Lange Abschnitte in Stücke von höchstens "lang" Messpunkten teilen (Nachbarn teilen sich eine Reihe, so bleibt keine Lücke)
export function stuecke(T, liste, lang = 500) {
  if (!T.def.weit) return liste;
  const out = [];
  for (const [von, bis] of liste) for (let a = von; a < bis; a += lang) out.push([a, Math.min(bis, a + lang)]);
  return out;
}
// Ein großes Netz in mehrere kleine zerlegen. fach(nr) sagt, in welches Fach das Dreieck mit der Nummer nr gehört.
// Alle Stücke benutzen dieselben Eckpunkte (und Farben) wie das große Netz – ändert man dort etwas, ändert es sich überall.
export function teileNetz(g, mat, fach, empfangen = true) {
  const idx = g.getIndex().array, pos = g.getAttribute('position'), faecher = new Map();
  for (let t = 0; t < idx.length / 3; t++) { const f = fach(t); if (!faecher.has(f)) faecher.set(f, []); faecher.get(f).push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]); }
  const gruppe = new THREE.Group(), kiste = new THREE.Box3(), v = new THREE.Vector3();
  for (const liste of faecher.values()) {
    const teil = new THREE.BufferGeometry();
    for (const name of Object.keys(g.attributes)) teil.setAttribute(name, g.getAttribute(name));
    teil.setIndex(liste);
    kiste.makeEmpty(); for (const k of liste) kiste.expandByPoint(v.fromBufferAttribute(pos, k));
    teil.boundingBox = kiste.clone(); teil.boundingSphere = kiste.getBoundingSphere(new THREE.Sphere());
    gruppe.add(mesh(teil, mat, false, empfangen));
  }
  return gruppe;
}

// Ein Band entlang der Strecke. lat(i, j) = seitlicher Abstand (plus = links) der Spalte j, hoch(i, j) = Höhe darüber.
export function band(T, von, bis, spalten, lat, hoch, { uv = null, farbe = null, schritt = 1 } = {}) {
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

export const mesh = (g, m, schatten = true, empfangen = true) => { const o = new THREE.Mesh(g, m); o.castShadow = schatten; o.receiveShadow = empfangen; return o; };

// Was neben der Strecke liegt (Breite der Randsteine)
const kerbBreite = T => T.def.modell ? T.hb[0] * 0.12 : 1.4;

// ---------------------------------------------------------------- Landschaft je Strecke

const STIMMUNG = {
  mittag: { hoehe: 58, richtung: 140, truebe: 2.2, rayleigh: 0.9, nebel: 0xbcd3e6, nebelWeit: 2600, licht: 3.2, himmel: 0.9, belicht: 0.55 },
  nachmittag: { hoehe: 30, richtung: 230, truebe: 4, rayleigh: 1.4, nebel: 0xc4cfd6, nebelWeit: 2200, licht: 3.0, himmel: 0.8, belicht: 0.55 },
  abend: { hoehe: 5, richtung: 280, truebe: 8, rayleigh: 2.8, nebel: 0xd8a27c, nebelWeit: 2000, licht: 2.4, himmel: 0.75, belicht: 0.62 },
  // Rallye: trüber Morgen im Wald (tief hängende Wolken, Nebel zwischen den Bäumen)
  trueb: { grau: true, hoehe: 22, richtung: 150, truebe: 12, rayleigh: 0.5, nebel: 0xa7aeae, nebelNah: 20, nebelWeit: 430, licht: 1.5, himmel: 1.45, belicht: 0.66 },
  // Nacht in der Großstadt: Der Himmel ist dunkel, das Licht kommt von oben wie von Flutlicht-Masten.
  nacht: { nacht: true, hoehe: 62, richtung: 200, truebe: 2, rayleigh: 0.3, nebel: 0x0a1020, nebelWeit: 2600, licht: 1.5, himmel: 0.7, belicht: 0.85 },
  drinnen: { hoehe: 50, richtung: 200, truebe: 2, rayleigh: 1, nebel: 0x8a7a6a, nebelWeit: 60, licht: 1.6, himmel: 0.9, belicht: 0.9 },
};
// Eine Strecke darf einzelne Angaben ändern (welt.stimmung), z. B. weiter sehen im Gebirge oder gelber Dunst in der Wüste.
export const stimmung = def => ({ ...(STIMMUNG[def.welt.zeit] || STIMMUNG.mittag), ...(def.welt.stimmung || {}) });
// Ist es dunkel? Dann leuchten Fenster, Laternen und Scheinwerfer.
export const istDunkel = def => def.welt.zeit === 'abend' || def.welt.zeit === 'nacht';

// Die Landschaften der Rennstrecken (welt.art). Für jede steht hier, wie hügelig sie ist und was dort wächst:
//   amp = Höhe der Hügel (m), mass = Größe der Hügel (m), gross = dazu große Bergrücken weiter weg,
//   fern = so viel steigt das Land nach außen an (Talkessel), meer = Meer im Norden oder Süden, see = Bergsee in den Senken,
//   boden = Bild für den Boden, bergH/bergFarbe = Hügelkette am Horizont, bergArt = Gebirge mit Schnee oder Tafelberge,
//   baumZahl, schwelle (kleiner = mehr Wald), baeume = [Art, Farbe, Anteil, Größe], herbst = bunte Blätter,
//   felsen = 'tafel' (Tafelberge und rote Felsen) oder 'brocken' (graue Felsbrocken)
const LAND = {
  kueste: { amp: 34, meer: 'nord', bergH: 260, bergFarbe: 0x8a8f7a, baumZahl: 3500, schwelle: 0.15, baeume: [['pinie', 0x3d5f2c, 0.5, 1], ['zypresse', 0x2a4a26, 0.3, 1], ['laub', 0x587a35, 0.2, 0.8]] },
  wald: { amp: 70, gross: 120, bergH: 420, bergFarbe: 0x4a6a4a, baumZahl: 9000, schwelle: -0.25, baeume: [['nadel', 0x2c4f2a, 0.65, 1], ['laub', 0x3f6b2e, 0.35, 0.9]] },
  hafen: { amp: 4, meer: 'sued', baumZahl: 0, baeume: [] },
  wueste: { amp: 16, mass: 300, gross: 70, boden: 'sand', bergArt: 'tafel', baumZahl: 1100, schwelle: 0.3, einzeln: 0.006, baeume: [['palme', 0x4a6a2c, 0.75, 1], ['pinie', 0x5a6a34, 0.25, 0.75]], felsen: 'tafel' },
  alpen: { amp: 46, gross: 240, fern: 260, boden: 'grau', see: true, bergArt: 'schnee', baumZahl: 7500, schwelle: -0.05, baumGrenze: 150, baeume: [['nadel', 0x2c4f2a, 0.85, 1.05], ['laub', 0x4a7a34, 0.15, 0.8]], felsen: 'brocken' },
  nacht: { amp: 3, boden: 'beton', baumZahl: 0, baeume: [] },
  // Waldberge der Hohenburg-Schleife: dichter Mischwald gleich hinter der Leitplanke (allee = Anteil der Bäume am Streckenrand,
  // alleeTief = wie tief dieser Wald-Streifen ist), feiner = feineres Gitter für das Gelände, weil die Strecke riesig ist,
  // tief = so viel liegt das Land unter der Fahrbahn (m; mehr als sonst, damit es in den engen Kehren am Hang nicht durch die Straße schaut)
  eifel: { amp: 55, mass: 800, gross: 130, bergH: 420, bergFarbe: 0x486a4c, baumZahl: 60000, schwelle: -0.12, einzeln: 0.05, allee: 0.78, alleeTief: 46, feiner: 1.45, tief: 0.8,
    baeume: [['nadel', 0x2c4f2a, 0.55, 1.1], ['laub', 0x3f6b2e, 0.45, 1]] },
  park: { amp: 9, mass: 520, boden: 'grau', bergH: 170, bergFarbe: 0x6f6a3c, baumZahl: 15000, schwelle: 0.02, einzeln: 0.1, allee: 0.3, herbst: true, baeume: [['laub', 0xb8702a, 0.8, 1.1], ['nadel', 0x2c4f2a, 0.2, 1]] },
};
const landVon = art => LAND[art] || LAND.kueste;

// Räumliches Gitter für "wie weit ist der nächste Streckenpunkt?" (für Gelände und Bäume)
export function naeheGitter(T, zelle) {
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
    vertexColors: true, color: def.slot ? 0x4a4c50 : def.drift ? 0x33363c : modell ? 0x7c7f84 : 0xffffff,   // Drift-Matte: dunkelgrau bedruckt
  });
  if (modell) { asMat.map = null; asMat.normalMap = null; asMat.roughness = 0.45; }
  const SP = modell ? 6 : 10;
  const linie = welt.linie;   // wird später gesetzt (Gummi-Abrieb auf der Ideallinie), siehe gummiAuftragen
  const strasse = band(T, 0, T.n, SP, (i, j) => -T.hb[i] + 2 * T.hb[i] * j / SP, () => 0, {
    uv: (i, j, l, s) => [l / 6, s / 6],
    farbe: (i, j) => { const v = 0.92 + 0.08 * Math.sin(T.s[i] * 0.013 + j); return [v, v, v]; },
  });
  welt.strasse = mesh(strasse, asMat, false, true);
  // riesige Strecke: die Fahrbahn in Stücken von je 1 km zeigen (welt.strasse bleibt das ganze Netz, für Gummi und Ideallinie)
  gruppe.add(def.weit ? teileNetz(strasse, asMat, t => Math.floor(t / (2 * SP * 500))) : welt.strasse);

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
    for (const [von, bis] of stuecke(T, abschnitte(T.n, i => flag[i]))) {
      gruppe.add(mesh(band(T, von, bis, 2, (i, j) => seite * (T.hb[i] - (modell ? 0 : 0.05) + kb * j / 2), (i, j) => (modell ? 0.0003 : 0.01) + (j === 1 ? (modell ? 0.0006 : 0.05) : j === 2 ? (modell ? 0.0003 : 0.02) : 0), {
        uv: (i, j, l, s) => [j / 2, s / (modell ? 0.05 : 4)],
      }), kerbMat, false, true));
    }
  }

  // ---------------------------------------------------------------- Auslauf (Gras, Kies, Gehweg)
  const grasT = TX.rasenStreifen(), kiesT = TX.kies(), betonT = TX.beton();
  const wueste = art === 'wueste' || def.welt.land === 'wueste';
  // kleine Bahnen: grüner Filz statt Gras, heller Auslauf-Streifen statt Kies (einfarbig, die großen Bilder wären dort unscharf)
  const grasMat = modell ? new THREE.MeshStandardMaterial({ color: def.drift ? 0x8d9097 : 0x3f8a4a, roughness: 1 })   // Drift-Matte: heller Rand
    : wueste ? new THREE.MeshStandardMaterial({ map: TX.sand().map, roughness: 1, color: 0xf2dcae })   // in der Wüste liegt Sand neben der Straße
    : new THREE.MeshStandardMaterial({ map: grasT.map, roughness: 0.95, color: art === 'kueste' || def.welt.land === 'kueste' ? 0xd6e0a8 : art === 'park' ? 0xd8d49a : 0xffffff });
  const kiesMat = modell ? new THREE.MeshStandardMaterial({ color: def.slot ? 0xb8bcc2 : 0xd8c79a, roughness: 1 })
    : new THREE.MeshStandardMaterial({ map: kiesT.map, normalMap: kiesT.normalMap, roughness: 1 });
  const randMat = modell
    ? new THREE.MeshStandardMaterial({ color: 0x6d7076, roughness: 0.5 })
    : new THREE.MeshStandardMaterial({ map: betonT.map, normalMap: betonT.normalMap, roughness: 0.9, color: 0xd8d8d0 });
  for (const seite of [1, -1]) {
    const artArr = seite > 0 ? T.artL : T.artR, aus = seite > 0 ? T.ausL : T.ausR;
    for (const [code, mat, gross] of [[BELAG.gras, grasMat, 10], [BELAG.kies, kiesMat, 6], [BELAG.mauer, randMat, 4], [BELAG.asphalt, randMat, 4]]) {
      for (const [von, bis] of stuecke(T, abschnitte(T.n, i => artArr[i] === code))) {
        gruppe.add(mesh(band(T, von - 1, bis + 1, 2, (i, j) => seite * (T.hb[i] + (aus[i] + (modell ? 0 : 0.6)) * j / 2), (i, j) => modell ? 0 : (code === BELAG.mauer ? 0.12 : -0.03) * (j > 0 ? 1 : 0), {
          uv: (i, j, l, s) => [l / gross, s / gross], schritt: 1,
        }), mat, false, true));
      }
    }
  }

  // ---------------------------------------------------------------- Steilkessel: helle Beton-Platten auf der Innenseite der Kurve
  // (Angabe { beton: true } an einer Ecke in strecken.js). Außen bleibt ein Streifen Asphalt. Dunkle Fugen alle 5 m und eine längs.
  if (!modell && T.beton) {
    const platte = new THREE.MeshStandardMaterial({ map: betonT.map, normalMap: betonT.normalMap, roughness: 0.9, color: 0xe9e6da, polygonOffset: true, polygonOffsetFactor: -2 });
    const fuge = new THREE.MeshStandardMaterial({ color: 0x4a4a46, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 });
    for (const [von, bis] of abschnitte(T.n, i => T.beton[i])) {
      const mitte = ((Math.round((von + bis) / 2) % T.n) + T.n) % T.n, innen = T.k[mitte] > 0 ? 1 : -1;   // Linkskurve: innen ist links
      const lat = (i, u) => innen * T.hb[i] * (-0.28 + 1.26 * u);                                        // von knapp jenseits der Mitte bis zum Innenrand
      gruppe.add(mesh(band(T, von, bis, 2, (i, j) => lat(i, j / 2), () => 0.008, { uv: (i, j, l, s) => [l / 4, s / 4] }), platte, false, true));
      gruppe.add(mesh(band(T, von, bis, 1, (i, j) => lat(i, 0.5) + (j - 0.5) * 0.09, () => 0.011), fuge, false, false));
      const quer = [];
      for (let k = von; k < bis; k += Math.max(1, Math.round(5 / T.ds))) {
        const i = ((k % T.n) + T.n) % T.n, a = lat(i, 0), b2 = lat(i, 1), q = new THREE.PlaneGeometry(Math.abs(b2 - a), 0.09);
        q.rotateX(-Math.PI / 2); q.rotateY(Math.atan2(T.tx[i], T.tz[i])); const m = (a + b2) / 2;
        q.translate(T.x[i] + T.tz[i] * m, T.y[i] + 0.011, T.z[i] - T.tx[i] * m); quer.push(q);
      }
      if (quer.length) gruppe.add(mesh(mergeGeometries(quer), fuge, false, false));
    }
  }

  // ---------------------------------------------------------------- Boxengasse (kleine Autos)
  if (modell && T.box) baueBox(T, gruppe);

  // ---------------------------------------------------------------- Begrenzung: Leitplanke, Reifen, Mauer
  if (!T.strasse) baueBegrenzung(T, gruppe, viel, modell);

  // ---------------------------------------------------------------- Startampel über der Strecke
  baueAmpel(T, gruppe, welt, modell);

  // ---------------------------------------------------------------- Umgebung
  if (modell) baueZimmer(T, gruppe, welt, r);
  else if (T.strasse) baueStrassenWelt(T, gruppe, welt, viel, r);
  else {
    baueGelaende(T, gruppe, welt, art, viel, r);
    baueTribuenen(T, gruppe, welt, viel, r);
    if (art === 'hafen') baueStadt(T, gruppe, welt, viel, r);
    if (art === 'nacht') {
      // Großstadt bei Nacht: niedrige Häuser direkt an der Strecke, dahinter Hochhäuser mit leuchtenden Fenstern
      baueStadt(T, gruppe, welt, viel, r, { hafen: false, bis: 120 });
      const g = welt.grenzen;
      grossstadt(T, gruppe, naeheGitter(T, 60), { x: g.mx, z: g.mz, r: Math.hypot(g.maxx - g.minx, g.maxz - g.minz) / 2 + 650 }, r, 'nacht', viel, 120);
    }
    if (art === 'park') baueSchloss(T, gruppe, welt, r);
  }
  return welt;
}

// Boxengasse rechts neben der Start-Ziel-Geraden: Boden, Linien, blauer Halte-Bereich, Schild.
// Bei der Slotcar-Bahn zweigt ein dritter Schlitz ab.
function baueBox(T, gruppe) {
  const B = T.box, def = T.def, n = T.n, ds = T.laenge / n, hb = T.hb[0];
  const von = Math.round(B.ab / ds), bis = von + Math.round(B.lang / ds);
  const rel = i => ((((i - von) % n) + n) % n) * ds;
  const glatt = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const prof = r => Math.min(glatt(r / B.rampe), glatt((B.lang - r) / B.rampe));   // 0 an den Enden, 1 in der Mitte
  const farbe = (c, off = -2, mehr = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: off, ...mehr });
  if (def.slot) {
    // Boden: Die Bahn wird nach rechts breiter
    gruppe.add(mesh(band(T, von, bis, 1, (i, j) => -hb + 0.002 - j * (B.breite * prof(rel(i)) + 0.002), () => 0.0001), farbe(0x4a4c50, 0, { vertexColors: false }), false, true));
    // dritter Schlitz mit Metallstreifen
    const lage = i => boxLage(T, rel(i), -def.spur);
    for (const m of [-1, 1]) gruppe.add(mesh(band(T, von, bis, 1, (i, j) => lage(i) + m * 0.006 + (j - 0.5) * 0.004, () => 0.0005), farbe(0xc8ccd2, -2, { metalness: 0.9, roughness: 0.25 }), false, true));
    gruppe.add(mesh(band(T, von, bis, 1, (i, j) => lage(i) + (j - 0.5) * 0.004, () => 0.0008), farbe(0x0c0c0c, -3), false, true));
    // weißer Rand außen
    gruppe.add(mesh(band(T, von, bis, 1, (i, j) => -hb - B.breite * prof(rel(i)) + 0.004 + j * 0.006, () => 0.0006), farbe(0xf2f2ee, -2), false, true));
  } else {
    // weiße Linie zwischen Strecke und Boxengasse
    gruppe.add(mesh(band(T, von, bis, 1, (i, j) => -hb - 0.004 - j * 0.008, () => 0.0006), farbe(0xf2f2ee, -3), false, true));
  }
  // Halte-Bereich: blaues Feld mit gelbem Anfang und Ende
  const h0 = von + Math.round(B.halt[0] / ds), h1 = von + Math.round(B.halt[1] / ds), halb = B.breite * (def.slot ? 0.3 : 0.4);
  const neben = def.slot ? 0.03 : 0;   // bei der Slotcar-Bahn links und rechts vom Schlitz je ein Streifen
  for (const seite of def.slot ? [-1, 1] : [0]) {
    gruppe.add(mesh(band(T, h0, h1, 1, (i, j) => B.d + seite * (neben + halb / 2) - (def.slot ? halb / 2 : halb) + j * (def.slot ? halb : 2 * halb), () => 0.0004),
      farbe(0x2a6fd6, -2), false, true));
  }
  for (const h of [h0, h1]) gruppe.add(mesh(band(T, h - 1, h, 1, (i, j) => B.d - B.breite * 0.45 + j * B.breite * 0.9, () => 0.0007), farbe(0xf2c21a, -3), false, true));
  // Schild "BOX" an der Einfahrt
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#1f5fc4'; ctx.fillRect(0, 0, 128, 64); ctx.fillStyle = '#fff'; ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BOX', 64, 34);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const i0 = ((von % n) + n) % n, aussen = -(hb + B.breite + 0.06);
  const schild = new THREE.Group();
  const pfahl = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), farbe(0x555555)); pfahl.position.y = 0.07; schild.add(pfahl);
  const tafel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.004), [farbe(0x1f5fc4), farbe(0x1f5fc4), farbe(0x1f5fc4), farbe(0x1f5fc4), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 })]);
  tafel.position.y = 0.16; schild.add(tafel);
  schild.position.set(T.x[i0] + T.tz[i0] * aussen, 0, T.z[i0] - T.tx[i0] * aussen);
  schild.rotation.y = Math.atan2(T.tx[i0], T.tz[i0]);
  gruppe.add(schild);
}

// Ideallinie und Bremszonen auf die Fahrbahn malen (Fahrhilfe für den Rennwagen):
// ganz zart hellblau die beste Linie, kräftig rot die Stücke, auf denen man bremsen muss.
export function linieZeigen(welt, T, L, { hoch = null, kraeftig = false, kurz = 3 } = {}) {
  const n = T.n, ds = T.laenge / n;
  // gebremst wird dort, wo der Tempo-Plan deutlich langsamer wird (mehr als 5 m/s² Verzögerung)
  const bremst = i => { const v0 = L.tempo[i], v1 = L.tempo[(i + 1) % n]; return (v0 * v0 - v1 * v1) / (2 * ds) > 5; };
  const zart = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: kraeftig ? 0.32 : 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const rot = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: kraeftig ? 0.6 : 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 });
  // hoch(l, i) = so viel höher oder tiefer liegt die Fahrbahn an dieser Stelle (Rallye: der Weg ist gewölbt)
  const h = (i, l, dazu) => (hoch ? hoch(l, i) : 0) + dazu;
  const g = new THREE.Group();
  g.add(mesh(band(T, 0, n, 1, (i, j) => L.off[i] + (j - 0.5) * 0.7, (i, j, l) => h(i, l, 0.02)), zart, false, false));
  for (const [von, bis] of abschnitte(n, bremst)) {
    if (bis - von < kurz) continue;   // ganz kurze Stücke weglassen (sonst flimmern lauter rote Krümel)
    g.add(mesh(band(T, von, bis, 1, (i, j) => L.off[i] + (j - 0.5) * 1.1, (i, j, l) => h(i, l, 0.03)), rot, false, false));
  }
  welt.gruppe.add(g);
  welt.linie = g;
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
    for (const [von, bis] of stuecke(T, abschnitte(n, i => !istMauer(i)))) {
      // Leitplanke: zwei Blechbänder auf Pfosten
      for (const h of [0.45, 0.75]) gruppe.add(mesh(band(T, von, bis, 1, (i, j) => lat(i), (i, j) => h + j * 0.22), blech));
      for (let k = von; k < bis + (def.weit ? 0 : 1); k += Math.max(1, Math.round((def.weit ? 8 : 4) / T.ds))) { const i = ((k % n) + n) % n; const [x, z] = wo(i, lat(i) + seite * 0.08); pfosten.push([x, T.y[i], z, 1.0, 0.05]); }
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
    // (riesige Strecke: einfache Pfosten mit vier Kanten, ohne Schatten und ohne Deckel – es sind über fünftausend)
    const g = def.weit ? new THREE.CylinderGeometry(1, 1, 1, 4, 1, true) : new THREE.CylinderGeometry(1, 1, 1, 6); g.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(g, pfostenMat, pfosten.length);
    const m4 = new THREE.Matrix4();
    pfosten.forEach(([x, y, z, h, rr], k) => { m4.makeScale(rr, h, rr); m4.setPosition(x, y, z); im.setMatrixAt(k, m4); });
    im.castShadow = !def.weit; gruppe.add(im);
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
  const sc = T.sc;
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
  const P = landVon(art);
  const rand = 900;
  const x0 = minx - rand, x1 = maxx + rand, z0 = minz - rand, z1 = maxz + rand;
  // (riesige Strecke: feineres Gitter, auch bei einfacher Grafik nie gröber als bei mittlerer – sonst schaut am Hang das Land durch die Fahrbahn)
  const N = Math.round(Math.max(qualitaetsGitter(viel), P.feiner ? 160 : 0) * (P.feiner || 1));
  const nah = naeheGitter(T, 60);
  const rs = TX.rauschen(art.length * 17);
  const amp = P.amp, mass = P.mass || 700;
  const meer = P.meer === 'nord' ? minz - 70 : P.meer === 'sued' ? maxz + 60 : null;
  // höchste und tiefste Stelle der Strecke: danach richten sich Bergsee, Baumgrenze und Schnee
  let yMin = Infinity, yMax = -Infinity; for (let i = 0; i < T.n; i++) { yMin = Math.min(yMin, T.y[i]); yMax = Math.max(yMax, T.y[i]); }
  const seeY = P.see ? yMin - 5 : null;
  const wasserY = meer !== null ? 0.5 : seeY !== null ? seeY + 0.6 : null;   // darunter wächst nichts
  const pos = [], cols = [], idx = [];
  const gruen = new THREE.Color(0x5c8a3a), trocken = new THREE.Color(0xa7a35a), fels = new THREE.Color(0x8b8173), sandC = new THREE.Color(0xd8c48e), stadt = new THREE.Color(0x7d7d78), wald = new THREE.Color(0x2f5a2a);
  // Riesige Strecke: Weit weg von der Fahrbahn (mitten in der Schleife) richtet sich das Land nach allen Teilen der Strecke
  // ringsum – nahe Teile zählen viel, ferne wenig. So gibt es keine Stufe im Gelände, wenn die Strecke 300 m höher liegt.
  let fern = null;
  if (T.def.weit) {
    const px = [], pz = [], py = [];
    for (let i = 0; i < T.n; i += Math.max(1, Math.round(100 / T.ds))) { px.push(T.x[i]); pz.push(T.z[i]); py.push(T.y[i]); }
    fern = (x, z) => {
      let sum = 0, gew = 0, d2min = Infinity;
      for (let k = 0; k < px.length; k++) { const d2 = (px[k] - x) ** 2 + (pz[k] - z) ** 2 + 400; const g = 1 / (d2 * d2); sum += py[k] * g; gew += g; if (d2 < d2min) d2min = d2; }
      return { y: sum / gew, d: Math.sqrt(d2min) };
    };
  }
  const burg = T.def.welt.burg || null;   // [x, z]: Dort steht ein Burgberg
  // So viel liegt das Land unter der Fahrbahn. Je gröber das Gitter, desto mehr (P.tief gilt für Felder von 24 m).
  const tief = P.tief ? P.tief * Math.max(1, ((x1 - x0) / N / 24) ** 2) : 0.35;
  const hoehe = (x, z) => {
    const f = nah(x, z, 4);
    let ty = f.i >= 0 ? T.y[f.i] : 0;
    const frei = f.i >= 0 ? T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 14 : 0;
    let d = f.i >= 0 ? f.d : 1e4;
    if (fern) {
      const e = fern(x, z);
      if (f.i < 0) { ty = e.y; d = e.d; } else { const u = Math.min(1, Math.max(0, (d - 60) / 180)); ty += (e.y - ty) * u * u * (3 - 2 * u); }
    }
    const w = Math.min(1, Math.max(0, (d - frei) / 260));
    const glatt = w * w * (3 - 2 * w);
    if (burg) { const u = Math.max(0, 1 - Math.hypot(x - burg[0], z - burg[1]) / 420); ty += glatt * 95 * u * u * (3 - 2 * u); }
    let h = ty - tief + glatt * (rs(x / mass, z / mass, 4) * amp + amp * 0.35 + (P.gross ? Math.max(0, rs(x / 1800 + 5, z / 1800, 2)) * P.gross * glatt : 0));
    // Talkessel: Je weiter weg von der Strecke, desto höher steigt das Land
    if (P.fern) { const u = Math.min(1.25, Math.max(0, (d - 120) / 800)); h += P.fern * u * u * Math.max(0.15, 0.9 + 1.5 * rs(x / 420 + 9, z / 420, 4)); }
    // Bergsee: In manchen Senken liegt das Land tiefer als der Wasserspiegel
    if (seeY !== null) { const senke = Math.min(1, Math.max(0, (-0.12 - rs(x / 800 + 3, z / 800 + 7, 2)) / 0.2)); h -= glatt * senke * (h - seeY + 9); }
    if (meer !== null) {
      const ab = art === 'kueste' ? (meer - z) : (z - meer);   // wie weit im Meer
      if (ab > 0) h = Math.min(h, ty - 0.35 - Math.min(1, ab / 25) * 14);
    }
    return { h, d, glatt, ty };
  };
  // erst alle Höhen ausrechnen (daraus ergibt sich, wo es steil ist), dann die Farben
  const W = N + 1, H = new Float32Array(W * W), G = new Float32Array(W * W), TY = new Float32Array(W * W);
  const dx = (x1 - x0) / N, dz = (z1 - z0) / N;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const e = hoehe(x0 + dx * i, z0 + dz * j);
    H[j * W + i] = e.h; G[j * W + i] = e.glatt; TY[j * W + i] = e.ty;
  }
  const sandHell = new THREE.Color(0xe6cf9c), sandDunkel = new THREE.Color(0xcf9f62), rotFels = new THREE.Color(0xb86a3e);
  const alm = new THREE.Color(0x5a8c34), almWald = new THREE.Color(0x2f5226), grauFels = new THREE.Color(0x8d8f90), schnee = new THREE.Color(0xf3f6f9), nachtBoden = new THREE.Color(0x4a4c52), laubBoden = new THREE.Color(0x8a7a2c), parkGruen = new THREE.Color(0x4f8230);
  const eifelWald = new THREE.Color(0x3f6a34), eifelWiese = new THREE.Color(0x7fa84a);
  const c = new THREE.Color();
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = x0 + dx * i, z = z0 + dz * j, k = j * W + i;
    const h = H[k], glatt = G[k];
    pos.push(x, h, z);
    const v = rs(x / 90, z / 90, 3) * 0.5 + 0.5;
    // wie steil ist es hier? (Höhenunterschied zu den Nachbarn)
    const steil = Math.max(Math.abs(H[j * W + Math.min(N, i + 1)] - H[j * W + Math.max(0, i - 1)]) / (2 * dx), Math.abs(H[Math.min(N, j + 1) * W + i] - H[Math.max(0, j - 1) * W + i]) / (2 * dz));
    if (art === 'hafen') c.copy(stadt).lerp(gruen, glatt * 0.4 * v);
    else if (art === 'kueste') { c.copy(gruen).lerp(trocken, 0.35 + v * 0.5); if (h < 1.2) c.copy(sandC); if (h < -2) c.copy(fels); }
    else if (art === 'wueste') { c.copy(sandHell).lerp(sandDunkel, v * 0.8); if (steil > 0.45) c.lerp(rotFels, Math.min(1, (steil - 0.45) * 4)); }
    else if (art === 'alpen') {
      const rel = h - TY[k];
      c.copy(alm).lerp(almWald, glatt * 0.5 * v).lerp(trocken, v * 0.12);
      const felsig = Math.max(Math.min(1, Math.max(0, (steil - 0.55) * 3)), Math.min(1, Math.max(0, (rel - 170) / 90)));
      c.lerp(grauFels, felsig);
      const weiss = Math.min(1, Math.max(0, (h - (yMax + 230 + v * 60)) / 50));
      c.lerp(schnee, weiss);
      if (seeY !== null && h < seeY + 0.4) c.copy(grauFels).lerp(sandC, 0.4);
    }
    else if (art === 'nacht') c.copy(nachtBoden);
    else if (art === 'park') c.copy(parkGruen).lerp(laubBoden, glatt * (0.15 + v * 0.5));
    else if (art === 'eifel') {
      // Waldberge: dunkler Waldboden, dazwischen helle Wiesen und Lichtungen
      const lichtung = Math.min(1, Math.max(0, (rs(x / 520 + 3, z / 520 + 8, 3) - 0.08) * 6));
      c.copy(eifelWald).lerp(eifelWiese, lichtung * (0.55 + 0.45 * glatt)).lerp(trocken, v * 0.18);
    }
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
  const gt = P.boden === 'sand' ? TX.sand() : P.boden === 'beton' ? TX.beton() : P.boden === 'grau' ? TX.bodenGrau() : TX.gras();
  const gm = new THREE.MeshStandardMaterial({ map: gt.map, vertexColors: true, roughness: 1, color: P.boden ? 0xffffff : 0xcfcfcf });
  // riesige Strecke: das Gelände in Kacheln von 40 × 40 Feldern zeigen
  gruppe.add(T.def.weit ? teileNetz(g, gm, t => { const feld = t >> 1; return Math.floor(Math.floor(feld / N) / 40) * 1000 + Math.floor((feld % N) / 40); }) : mesh(g, gm, false, true));

  // ferne Berge rundherum (gehen im Dunst unter)
  if (P.bergArt) {
    // richtiges Gebirge mit Schnee oder Tafelberge aus rotem Fels (dieselben wie bei den Straßen-Strecken)
    berge(T, gruppe, welt, P.bergArt === 'schnee' ? { hoch: 1500, weg: 1500, schneeAb: 0.42 }
      : { hoch: 380, weg: 1700, tafel: true, fuss: 0xd2b47c, fels: 0xb86a3e, boden: 0xd9c08e });
  } else if (P.bergH) {
    const ring = new THREE.CylinderGeometry(5200, 5200, 1, 64, 1, true);
    const bpos = [], bidx = [], M = 128, rsB = TX.rauschen(5);
    const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
    // Die Hügelkette steht 4,2 km von der Mitte weg – bei einer riesigen Strecke weiter draußen, hinter dem Gelände
    const weg = Math.max(4200, Math.hypot(x1 - x0, z1 - z0) / 2 + 300), fuss = weg > 4200 ? yMin - 60 : -20;
    for (let k = 0; k <= M; k++) {
      const a = k / M * Math.PI * 2;
      const hh = (weg > 4200 ? yMax : 0) + P.bergH * (0.55 + 0.45 * rsB(Math.cos(a) * 3, Math.sin(a) * 3, 4));
      const meerSeite = art === 'kueste' && Math.sin(a) < -0.2;
      bpos.push(cx + Math.cos(a) * weg, fuss, cz + Math.sin(a) * weg, cx + Math.cos(a) * (weg + 400), meerSeite ? -10 : hh, cz + Math.sin(a) * (weg + 400));
    }
    for (let k = 0; k < M; k++) { const a = k * 2; bidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    ring.dispose();
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3)); bg.setIndex(bidx); bg.computeVertexNormals();
    gruppe.add(new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: P.bergFarbe, roughness: 1, side: THREE.DoubleSide })));
  }

  // Meer oder Bergsee
  if (meer !== null || seeY !== null) {
    const w = TX.wellen();
    const nm = w.normalMap.clone(); nm.needsUpdate = true; nm.repeat.set(60, 60);
    const wm = new THREE.MeshPhysicalMaterial({ color: seeY !== null ? 0x2f7f8a : art === 'kueste' ? 0x1d5f86 : 0x23465a, roughness: 0.08, metalness: 0.1, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.6 });
    const wasser = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), wm);
    wasser.rotation.x = -Math.PI / 2; wasser.position.set((minx + maxx) / 2, seeY !== null ? seeY : -1.2, (minz + maxz) / 2);
    wasser.receiveShadow = true;
    gruppe.add(wasser);
    welt.wasser.push(nm);
  }

  // Felsen: Tafelberge und rote Brocken in der Wüste, graue Felsbrocken im Gebirge
  if (P.felsen) {
    const liste = [], tafel = P.felsen === 'tafel';
    const zahl = Math.round((tafel ? 520 : 520) * viel);
    for (let k = 0, versuche = 0; k < zahl && versuche < zahl * 20; versuche++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      const e = hoehe(x, z), f = nah(x, z, 3);
      const frei = f.i >= 0 ? T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 10 : 0;
      if (e.d < frei || (wasserY !== null && e.h < wasserY)) continue;
      const gross = tafel && e.d > 120 && r() < 0.22;
      if (gross) { const b = 30 + r() * 70; liste.push([x, e.h - 6, z, b, 22 + r() * 46, b * (0.6 + r() * 0.7), r() * 6.28, 1]); }
      else { const b = 0.8 + r() * r() * (tafel ? 5 : 7); liste.push([x, e.h - b * 0.25, z, b * (0.8 + r() * 0.6), b * (0.55 + r() * 0.5), b * (0.8 + r() * 0.6), r() * 6.28, 0]); }
      k++;
    }
    baueFelsen(gruppe, liste, tafel ? 0xb86a3e : 0x8d8f90, r);
  }

  // Burg auf dem Burgberg mitten in der Schleife (welt.burg): runder Turm, Ringmauer mit vier kleinen Türmen, Fahne
  if (burg) {
    const [bx, bz] = burg, by = hoehe(bx, bz).h - 3;
    const stein = new THREE.MeshStandardMaterial({ color: 0x9a9484, roughness: 1, flatShading: true });
    const dachRot = new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.9, flatShading: true });
    const teile = [], daecher = [];
    const rolle = (x, z, rad, h, y = 0) => { const g = new THREE.CylinderGeometry(rad, rad * 1.08, h, 12); g.translate(bx + x, by + y + h / 2, bz + z); teile.push(g); };
    rolle(0, 0, 8, 38); rolle(0, 0, 9.4, 3.5, 38);                                   // Bergfried mit breitem Kranz
    for (let k = 0; k < 8; k++) {
      const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2, R = 36;
      const x0b = Math.cos(a0) * R, z0b = Math.sin(a0) * R, x1b = Math.cos(a1) * R, z1b = Math.sin(a1) * R;
      const wand = new THREE.BoxGeometry(Math.hypot(x1b - x0b, z1b - z0b) + 1, k % 3 === 1 ? 7 : 11, 2.2);   // ein paar Stücke sind eingefallen (Ruine)
      wand.rotateY(-Math.atan2(z1b - z0b, x1b - x0b)); wand.translate(bx + (x0b + x1b) / 2, by + (k % 3 === 1 ? 3.5 : 5.5), bz + (z0b + z1b) / 2); teile.push(wand);
      if (k % 2 === 0) { rolle(x0b, z0b, 4.2, 17); const d = new THREE.ConeGeometry(5.2, 8, 12); d.translate(bx + x0b, by + 21, bz + z0b); daecher.push(d); }
    }
    { const haus = new THREE.BoxGeometry(22, 13, 11); haus.translate(bx + 14, by + 6.5, bz - 16); teile.push(haus); const d = new THREE.CylinderGeometry(0.1, 8.5, 7, 4); d.rotateY(Math.PI / 4); d.scale(1.75, 1, 0.9); d.translate(bx + 14, by + 16.5, bz - 16); daecher.push(d); }
    const flach = l => mergeGeometries(l.map(g => g.index ? g.toNonIndexed() : g));
    gruppe.add(mesh(flach(teile), stein, true, true), mesh(flach(daecher), dachRot, true, true));
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 12, 6), stein); mast.position.set(bx, by + 47, bz); gruppe.add(mast);
    const fahne = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), new THREE.MeshStandardMaterial({ color: 0xc8a020, roughness: 0.8, side: THREE.DoubleSide })); fahne.position.set(bx + 3.6, by + 50.5, bz); gruppe.add(fahne);
    welt.burg = { x: bx, y: by, z: bz };
  }

  // Bäume
  baueBaeume(T, gruppe, art, viel, nah, hoehe, x0, x1, z0, z1, r, wasserY, P, yMax);
}

// Felsen als Instanzen. liste = [x, y, z, Breite, Höhe, Tiefe, Drehung, 1 = Tafelberg (oben flach)]
export function baueFelsen(gruppe, liste, farbe, r) {
  if (!liste.length) return;
  // Brocken: eine Kugel aus wenigen Flächen, jede Ecke etwas verschoben, damit sie kantig aussieht
  const brocken = new THREE.IcosahedronGeometry(1, 1);
  { const p = brocken.getAttribute('position'), rz = TX.rauschen(23); for (let k = 0; k < p.count; k++) { const m = 0.78 + 0.4 * rz(p.getX(k) * 2.1, p.getY(k) * 2.1 + p.getZ(k) * 1.7, 2); p.setXYZ(k, p.getX(k) * m, Math.max(-0.3, p.getY(k) * m), p.getZ(k) * m); } brocken.computeVertexNormals(); }
  // Tafelberg: unten breit, oben flach
  const tafel = new THREE.CylinderGeometry(0.72, 1, 1, 9, 2); tafel.translate(0, 0.5, 0);
  { const p = tafel.getAttribute('position'), rz = TX.rauschen(29); for (let k = 0; k < p.count; k++) { const m = 0.86 + 0.3 * rz(p.getX(k) * 3, p.getZ(k) * 3 + p.getY(k), 2); p.setX(k, p.getX(k) * m); p.setZ(k, p.getZ(k) * m); } tafel.computeVertexNormals(); }
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  for (const [art, geo] of [[0, brocken], [1, tafel]]) {
    const teil = liste.filter(f => f[7] === art); if (!teil.length) continue;
    const im = new THREE.InstancedMesh(geo, mat, teil.length);
    teil.forEach(([x, y, z, b, h, t, dreh], k) => {
      q.setFromAxisAngle(Y, dreh); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(b, h, t)); im.setMatrixAt(k, m4);
      c.setHex(farbe).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.12, (r() - 0.5) * 0.14); im.setColorAt(k, c);
    });
    im.castShadow = true; im.receiveShadow = true;
    gruppe.add(im);
  }
}

const qualitaetsGitter = viel => viel >= 1 ? 220 : viel > 0.5 ? 160 : 110;

function baueBaeume(T, gruppe, art, viel, nah, hoehe, x0, x1, z0, z1, r, wasserY, P, yMax) {
  if (!P.baumZahl) return;
  const anzahl = Math.round(P.baumZahl * viel);
  const rs = TX.rauschen(77);
  // Baumarten: Nadelbaum (Kegel), Laubbaum (Kugeln), Pinie (Schirm), Zypresse (schmal)
  const stamm = new THREE.CylinderGeometry(0.18, 0.28, 1, 6); stamm.translate(0, 0.5, 0);
  const formen = {
    nadel: () => { const k1 = new THREE.ConeGeometry(2.6, 6, 8); k1.translate(0, 5, 0); const k2 = new THREE.ConeGeometry(2, 5, 8); k2.translate(0, 7.5, 0); const k3 = new THREE.ConeGeometry(1.3, 3.5, 8); k3.translate(0, 9.7, 0); return mergeGeometries([k1, k2, k3]); },
    laub: () => { const a = new THREE.IcosahedronGeometry(2.6, 1); a.translate(0, 5.5, 0); const b = new THREE.IcosahedronGeometry(2, 1); b.translate(1.3, 6.8, 0.5); const c = new THREE.IcosahedronGeometry(1.9, 1); c.translate(-1.1, 6.5, -0.7); return mergeGeometries([a, b, c]); },
    pinie: () => { const a = new THREE.SphereGeometry(3.4, 10, 6); a.scale(1, 0.38, 1); a.translate(0, 7.8, 0); return a; },
    zypresse: () => { const a = new THREE.SphereGeometry(1, 8, 8); a.scale(1.1, 5, 1.1); a.translate(0, 5.2, 0); return a; },
  };
  formen.palme = formen.pinie;
  const arten = P.baeume;
  const stammHoehe = { nadel: 3, laub: 4, pinie: 7.4, zypresse: 1.5, palme: 7.4 };
  // Herbst: Die Bilder der Laubbäume werden gelb, orange und rot eingefärbt (Zahlen über 1 machen eine Farbe kräftiger)
  const HERBST = [[1.9, 1.0, 0.45], [2.2, 0.72, 0.35], [1.7, 1.35, 0.4], [2.0, 0.9, 0.3], [1.15, 1.1, 0.85], [1.5, 1.2, 0.5]];
  const kroneMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const stammMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 });
  // fertige Baum-Modelle (Kenney Nature Kit, CC0), wenn geladen; die Pinie bleibt selbst gebaut
  const MODELL = { nadel: ['baum_tanne', 11.5], laub: ['baum_laub', 8.5], zypresse: ['baum_zypresse', 10.2] };
  const BILD = { nadel: ['fichte', 12], laub: ['laub', 9.5], pinie: ['pinie', 9.5], zypresse: ['zypresse', 10.5], palme: ['palme', 9] };
  for (const [name, farbe, anteil, groesse] of arten) {
    const zahl = Math.round(anzahl * anteil);
    // am liebsten flache Bilder echter Bäume (4 Dreiecke je Baum), sonst Kenney-Modell, sonst selbst gebaut
    const bb = baumBild(...BILD[name]);
    const bm = bb || (MODELL[name] ? baumModell(...MODELL[name]) : null);
    let krone = new THREE.InstancedMesh(bm ? bm.krone : formen[name](), bm ? bm.kroneMat : kroneMat, zahl);
    const st = bb ? null : new THREE.InstancedMesh(bm ? bm.stamm : stamm, bm ? bm.stammMat : stammMat, zahl);
    const kacheln = T.def.weit && bb ? new Map() : null;   // riesige Strecke: Bäume nach Gegend sortieren (Kacheln von 1 km)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    let k = 0, versuche = 0;
    while (k < zahl && versuche < zahl * 30) {
      versuche++;
      let x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      // Allee: Ein Teil der Bäume steht in Reihen links und rechts der Strecke (Park)
      const allee = P.allee && r() < P.allee;
      if (allee) { const i = Math.floor(r() * T.n), sd = r() < 0.5 ? 1 : -1, l = sd * (T.hb[i] + (sd > 0 ? T.ausL[i] : T.ausR[i]) + 9 + r() * (P.alleeTief || 16)); x = T.x[i] + T.tz[i] * l; z = T.z[i] - T.tx[i] * l; }
      const f = nah(x, z, 3);
      if (f.i >= 0 && f.d < T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 9) continue;
      if (T.def.welt.burg && Math.hypot(x - T.def.welt.burg[0], z - T.def.welt.burg[1]) < 44) continue;   // im Burghof stehen keine Bäume
      // Wälder in Gruppen (wo das Rauschen hoch ist), sonst nur vereinzelt
      const dicht = rs(x / 260, z / 260, 3);
      if (!allee && dicht < P.schwelle && r() > (P.einzeln ?? 0.08)) continue;
      const hh = hoehe(x, z);
      if (wasserY !== null && hh.h < wasserY) continue;
      if (P.baumGrenze && hh.h > yMax + P.baumGrenze - 40 * r()) continue;   // über der Baumgrenze wächst nichts mehr
      const s = (0.75 + r() * 0.6) * groesse;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      m4.compose(new THREE.Vector3(x, hh.h - 0.2, z), q, new THREE.Vector3(s, s, s));
      krone.setMatrixAt(k, m4);
      if (!bm) m4.compose(new THREE.Vector3(x, hh.h - 0.2, z), q, new THREE.Vector3(s, s * stammHoehe[name], s));
      if (st) st.setMatrixAt(k, m4);
      if (bb && P.herbst && name === 'laub') { const f = HERBST[Math.floor(r() * HERBST.length)], v = 0.8 + r() * 0.3; c.setRGB(f[0] * v, f[1] * v, f[2] * v); }
      else if (bb) { const v = 0.78 + r() * 0.3; c.setRGB(v, v, v * 0.94); }       // Bild behält seine Farben, nur etwas heller oder dunkler
      else c.setHex(farbe).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08);
      krone.setColorAt(k, c);
      if (kacheln) { const f = Math.floor(x / 1000) * 1000 + Math.floor(z / 1000); if (!kacheln.has(f)) kacheln.set(f, []); kacheln.get(f).push(k); }
      k++;
    }
    krone.count = k; krone.castShadow = true; krone.receiveShadow = !bb;
    if (kacheln) {
      // je Kachel ein eigener Baum-Haufen: Was nicht im Bild ist, wird nicht gemalt
      for (const liste of kacheln.values()) {
        const teil = new THREE.InstancedMesh(krone.geometry, krone.material, liste.length);
        liste.forEach((von, nach) => { krone.getMatrixAt(von, m4); teil.setMatrixAt(nach, m4); krone.getColorAt(von, c); teil.setColorAt(nach, c); });
        teil.castShadow = true; teil.receiveShadow = false; teil.computeBoundingSphere();
        gruppe.add(teil);
      }
      krone.dispose(); continue;
    }
    gruppe.add(krone);
    if (st) { st.count = k; st.castShadow = true; gruppe.add(st); }
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
  const tribuene = (i, seite, laenge, reihen = 10, deko = null) => {
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
    if (deko) deko(g, laenge, tiefe);
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
  // Haupttribüne mit Fan-Zelten dahinter, Flutlicht und Fahnentürmen (fertige Modelle, Kenney Racing Kit, CC0)
  tribuene(iStart, -innen, lang, 14, (g, laenge, tiefe) => {
    const stoffe = [0xd8352a, 0xf2f2f2, 0x2f6fc0, 0xf0c020, 0x3c9a4a];
    // Fan-Zelte links und rechts neben der Tribüne, offen zur Strecke
    let k = 0;
    for (const sx of [-1, 1]) for (let d = 12; d < 46; d += 11, k++) {
      const z = alsGruppe(k % 3 === 1 ? 'zelt_lang' : 'zelt', { breit: k % 3 === 1 ? 9 : 5.5 }, { stoff: stoffe[Math.floor(r() * stoffe.length)] });
      if (z) { z.position.set(sx * (laenge / 2 + d), 0, 3 + r() * 2); g.add(z); }
    }
    for (const x of [-laenge / 2 - 4, laenge / 2 + 4]) {
      const f = alsGruppe('fahnenturm', { hoch: 9 }, { stoff: 0xd8352a });
      if (f) { f.position.set(x, 0, 2); g.add(f); }
    }
    for (let x = -laenge / 2 + 10; x <= laenge / 2 - 10; x += laenge / 3) {
      const l = alsGruppe('flutlicht', { hoch: 22 });
      if (l) { l.position.set(x, 0, tiefe + 3); l.rotation.y = Math.PI; g.add(l); }
    }
  });
  // Zielflagge am Rand der Start-Ziel-Linie
  {
    const f = alsGruppe('fahne_ziel', { hoch: 4.5 }), sd = -innen;
    if (f) {
      const ab = T.hb[0] + (sd > 0 ? T.ausL[0] : T.ausR[0]) + 1.5;
      f.position.set(T.x[0] + T.tz[0] * sd * ab, T.y[0], T.z[0] - T.tx[0] * sd * ab);
      f.rotation.y = Math.atan2(T.tx[0], T.tz[0]) + Math.PI / 2;
      gruppe.add(f);
    }
  }
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
  // … mit einer Fernsehkamera davor
  const kameraDeko = (g, laenge) => { const k = alsGruppe('tv_kamera', { hoch: 2.2 }); if (k) { k.position.set(laenge / 2 + 2, 0, -2.5); k.rotation.y = Math.PI; g.add(k); } };
  enge.slice(0, Math.round(5 * Math.max(0.4, viel))).forEach(i => tribuene(i, T.k[i] > 0 ? -1 : 1, 50, 9, kameraDeko));
}

// ---------------------------------------------------------------- Stadt am Hafen (Häuser zwischen den Straßen)

// hafen = mit Booten im Wasser, bis = nur so weit von der Strecke weg stehen diese Häuser (dahinter kommt die Großstadt)
function baueStadt(T, gruppe, welt, viel, r, { hafen = true, bis = Infinity } = {}) {
  const nah = naeheGitter(T, 40);
  const { minx, maxx, minz, maxz } = welt.grenzen;
  const tex = TX.fassade('abend');
  const farben = [0xe8d8c0, 0xd9b38c, 0xc98f6a, 0xf0e6d2, 0xb7c4cf, 0xe3c99b, 0xd7a8a0];
  const geos = farben.map(() => []);
  const block = 26;
  for (let x = minx - 300; x < maxx + 300; x += block) for (let z = minz - 300; z < maxz + (hafen ? 60 : 300); z += block) {
    const px = x + (r() - 0.5) * 4, pz = z + (r() - 0.5) * 4;
    const f = nah(px, pz, 3);
    const frei = f.i >= 0 ? T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 13 : 0;
    if (f.i >= 0 && f.d < frei) continue;
    if (f.d > bis) continue;
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
  for (let k = 0; hafen && k < 40 * viel; k++) {
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

// ---------------------------------------------------------------- Schloss im Park (Königspark-Ring)

// Ein Schloss mitten im Park: langer Bau mit zwei Flügeln, vier Türmen mit spitzem Dach und einem Kiesplatz davor.
// Es steht an der Stelle innerhalb der Strecke, die am weitesten von der Fahrbahn weg ist.
function baueSchloss(T, gruppe, welt, r) {
  const nah = naeheGitter(T, 60);
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (let i = 0; i < T.n; i++) { minx = Math.min(minx, T.x[i]); maxx = Math.max(maxx, T.x[i]); minz = Math.min(minz, T.z[i]); maxz = Math.max(maxz, T.z[i]); }
  let best = null;
  for (let a = 1; a < 30; a++) for (let b = 1; b < 16; b++) {
    const x = minx + (maxx - minx) * a / 30, z = minz + (maxz - minz) * b / 16, f = nah(x, z, 8);
    if (f.i >= 0 && (!best || f.d > best.d)) best = { x, z, d: f.d, i: f.i };
  }
  if (!best || best.d < 110) return;
  welt.schloss = best;
  const M = hausMaterialien(false), teile = new Map();
  const dazu = (mat, g) => { if (!teile.has(mat)) teile.set(mat, []); teile.get(mat).push(g); };
  const y = T.y[best.i] - 0.5, { x, z } = best;
  // das Schloss schaut zur nächsten Stelle der Strecke
  const dreh = Math.atan2(T.x[best.i] - x, T.z[best.i] - z);
  const ort = (lx, lz) => [x + lx * Math.cos(dreh) + lz * Math.sin(dreh), z - lx * Math.sin(dreh) + lz * Math.cos(dreh)];
  const wand = M.putz[1], dach = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.7, flatShading: true });
  const bau = (lx, lz, b, h, t) => { const [px, pz] = ort(lx, lz); dazu(wand, kiste(b, h, t, px, y, pz, dreh, [7, 25.6])); dazu(dach, giebel(t + 1, b + 1, Math.min(b, t) * 0.45, px, y + h, pz, dreh + Math.PI / 2)); };
  bau(0, 0, 84, 17, 18);                                   // Hauptbau
  for (const s of [-1, 1]) {
    const [px, pz] = ort(s * 36, 22); dazu(wand, kiste(16, 14, 34, px, y, pz, dreh, [7, 25.6])); dazu(dach, giebel(17, 35, 7, px, y + 14, pz, dreh));   // Flügel nach vorn
    for (const lz of [-9, 39]) {
      const [tx, tz] = ort(s * 44, lz);
      const turm = new THREE.CylinderGeometry(5, 5, 26, 14); turm.translate(tx, y + 13, tz); dazu(M.putz[0], turm);
      const spitze = new THREE.ConeGeometry(6.2, 13, 14); spitze.translate(tx, y + 32.5, tz); dazu(dach, spitze);
    }
  }
  // Kiesplatz vor dem Schloss
  { const [px, pz] = ort(0, 34); const platz = new THREE.CylinderGeometry(26, 26, 0.5, 24); platz.translate(px, y + 0.3, pz); dazu(new THREE.MeshStandardMaterial({ map: TX.kies().map, roughness: 1 }), platz); }
  for (const [mat, liste] of teile) gruppe.add(mesh(mergeGeometries(liste.map(g => g.index ? g.toNonIndexed() : g)), mat, true, true));
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
  // Möbel: fertige Modelle (Poly Haven und Kenney), sonst wie früher aus Kisten
  if (!zimmerMoebel(gruppe, welt, mx, mz, W, D)) {
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
  }
  // Schachtel der Rennbahn
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0xd8262a, roughness: 0.6 }));
  box.position.set(maxx + T.hb[0] + T.ausL[0] + 0.45, 0.06, minz - 0.05); box.rotation.y = 0.3; gruppe.add(box);   // neben der Bahn, nicht auf der Bande
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

// Möbel im Wohnzimmer aus fertigen Modellen. Gibt false zurück, wenn die Modelle fehlen.
// Zuerst die echt aussehenden von Poly Haven (mit Holz- und Stoffbild), sonst die bunten von Kenney (beide CC0).
function zimmerMoebel(gruppe, welt, mx, mz, W, D) {
  if (!modell('sofa') || !modell('fernsehschrank')) return false;
  const hin = (g, x, z, dreh = 0, y = 0) => { if (!g) return null; g.position.set(x, y, z); g.rotation.y = dreh; gruppe.add(g); return g; };
  // echtes Modell mit seiner Größe, sonst Kenney mit seiner Größe und Farbe
  const stueck = (name, echt, kenney, farben) => echtGruppe(name, echt) || alsGruppe(name, kenney, farben);
  const holz = { rest: 0xb98a5e };   // Holz etwas dunkler als bei Kenney
  // Sofa an der Wand, schaut ins Zimmer; daneben ein Beistelltisch, ein Sessel und eine Stehlampe
  hin(stueck('sofa', { breit: 1.9 }, { breit: 2.2 }, { stoff: 0x3f5d7a }), mx, mz + D / 2 - 0.5, Math.PI);
  hin(echtGruppe('beistelltisch', { hoch: 0.55 }), mx + 1.25, mz + D / 2 - 0.35, Math.PI);
  hin(stueck('sessel', { hoch: 1.05 }, { breit: 1.0 }, { stoff: 0x8a4f3a }), mx + 2.0, mz + D / 2 - 0.6, Math.PI + 0.5);
  hin(alsGruppe('stehlampe', { hoch: 1.75 }), mx - 1.5, mz + D / 2 - 0.35);
  // Fernseh-Schrank mit Fernseher, Lautsprechern und einer kleinen Pflanze
  const schrank = hin(stueck('fernsehschrank', { breit: 1.8, hoch: 0.8 }, { breit: 2.0 }, holz), mx, mz - D / 2 + 0.3);
  const oben = schrank ? schrank.userData.masse.hoch : 0.5;
  welt.fernseher = hin(alsGruppe('fernseher', { breit: 1.45 }), mx, mz - D / 2 + 0.3, 0, oben);
  for (const s of [-1, 1]) hin(alsGruppe('lautsprecher', { hoch: 1.1 }), mx + s * 1.3, mz - D / 2 + 0.3);
  hin(stueck('pflanze_klein', { hoch: 0.35 }, { hoch: 0.45 }), mx + 0.75, mz - D / 2 + 0.3, 0, oben);
  hin(alsGruppe('radio', { breit: 0.4 }), mx - 0.75, mz - D / 2 + 0.3, 0, oben);
  // große Pflanze in der Ecke
  hin(alsGruppe('pflanze', { hoch: 1.3 }), mx + W / 2 - 0.45, mz - D / 2 + 0.45);
  // Regal an der linken Wand, es schaut ins Zimmer (+x): ein echtes, sonst zwei von Kenney
  const regal = echtGruppe('regal', { hoch: 1.9 });
  if (regal) hin(regal, mx - W / 2 + 0.32, mz + 0.5, Math.PI / 2);
  else for (const dz of [0.05, 1.0]) hin(alsGruppe('regal', { hoch: 1.9 }, holz), mx - W / 2 + 0.3, mz + dz, Math.PI / 2);
  return true;
}
