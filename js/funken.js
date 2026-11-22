// Rennspiel – Turbo im Bild (kleine Autos): Funken an den Hinterrädern, Flamme am Heck, leuchtende Turbo-Felder.
// Die Regeln dazu stehen in turbo.js.

import * as THREE from 'three';
import { FUNKEN_FARBE } from './turbo.js';

const ANZAHL = 700;      // so viele Funken gibt es höchstens gleichzeitig (die ältesten werden wiederverwendet)

export class Funken {
  // sc = Maßstab der Strecke (1/30 oder 1/43): Alle Größen sind mit verkleinert
  constructor(szene, sc) {
    this.sc = sc; this.n = 0; this.rest = 0;
    this.ort = new Float32Array(ANZAHL * 3); this.farbe = new Float32Array(ANZAHL * 3);
    this.tempo = new Float32Array(ANZAHL * 3); this.leben = new Float32Array(ANZAHL); this.start = new Float32Array(ANZAHL * 4);
    const geo = this.geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.ort, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.farbe, 3));
    for (let i = 0; i < ANZAHL; i++) this.ort[i * 3 + 1] = -99;   // unbenutzte Funken liegen unter dem Boden
    // (kein Aufaddieren der Farben: Auf dem hellen Boden würden die Funken sonst alle weiß)
    const mat = new THREE.PointsMaterial({ size: 0.24 * sc, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, map: punktBild(), toneMapped: false, alphaTest: 0.05 });
    this.punkte = new THREE.Points(geo, mat); this.punkte.frustumCulled = false;
    szene.add(this.punkte);
    this.c = new THREE.Color();
  }

  // einen Funken losschicken: Ort, Tempo (Welt), Farbe, Lebensdauer in Sekunden
  funke(x, y, z, vx, vy, vz, farbe, dauer) {
    const i = this.n++ % ANZAHL, j = i * 3;
    this.ort[j] = x; this.ort[j + 1] = y; this.ort[j + 2] = z;
    this.tempo[j] = vx; this.tempo[j + 1] = vy; this.tempo[j + 2] = vz;
    this.c.setHex(farbe);
    this.start[i * 4] = this.c.r; this.start[i * 4 + 1] = this.c.g; this.start[i * 4 + 2] = this.c.b; this.start[i * 4 + 3] = dauer;
    this.leben[i] = dauer;
  }

  // Jedes Bild für dein Auto: Lädt der Turbo, sprühen Funken an den Hinterrädern (a.funken = Stufe 1 … 3).
  // Brennt er (a.turbo > 0), schlägt eine Flamme aus dem Heck.
  auto(a, dt) {
    const sc = this.sc, sh = Math.sin(a.h), ch = Math.cos(a.h), z = () => Math.random() - 0.5;
    const hinten = a.p.b / sc;                              // Hinterachse (in Metern eines großen Autos)
    const tempo = Math.abs(a.u);
    if (a.funken > 0 && tempo > 0.05) {
      this.rest += dt * (50 + a.funken * 45);
      while (this.rest >= 1) {
        this.rest -= 1;
        const seite = Math.random() < 0.5 ? -1 : 1, vor = -(hinten + 0.1) * sc, link = seite * 0.8 * sc;
        const s = (0.8 + Math.random() * 1.6) * sc * 4;
        this.funke(a.x + sh * vor + ch * link, a.y + 0.08 * sc, a.z + ch * vor - sh * link,
          -sh * s + z() * s * 0.8 + ch * seite * s * 0.4, (0.6 + Math.random() * 1.6) * sc * 3, -ch * s + z() * s * 0.8 - sh * seite * s * 0.4,
          FUNKEN_FARBE[a.funken], 0.22 + Math.random() * 0.22);
      }
    }
    if (a.turbo > 0) {
      for (let k = 0; k < 7; k++) {
        const vor = -(hinten + 0.75) * sc, link = z() * 0.5 * sc, s = (4 + Math.random() * 6) * sc;
        this.funke(a.x + sh * vor + ch * link, a.y + (0.3 + Math.random() * 0.25) * sc, a.z + ch * vor - sh * link,
          sh * (tempo - s) + z() * sc, z() * sc, ch * (tempo - s) + z() * sc,
          Math.random() < 0.35 ? 0xfff2a0 : Math.random() < 0.6 ? 0xff9a2e : FUNKEN_FARBE[a.turboStufe || 2], 0.1 + Math.random() * 0.14);
      }
    }
  }

  update(dt) {
    const g = 9.81 * this.sc * 6;
    for (let i = 0; i < ANZAHL; i++) {
      if (this.leben[i] <= 0) continue;
      const j = i * 3;
      this.leben[i] -= dt;
      if (this.leben[i] <= 0) { this.ort[j + 1] = -99; continue; }
      this.tempo[j + 1] -= g * dt;
      this.ort[j] += this.tempo[j] * dt; this.ort[j + 1] = Math.max(0.0005, this.ort[j + 1] + this.tempo[j + 1] * dt); this.ort[j + 2] += this.tempo[j + 2] * dt;
      this.farbe[j] = this.start[i * 4]; this.farbe[j + 1] = this.start[i * 4 + 1]; this.farbe[j + 2] = this.start[i * 4 + 2];
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}

// weicher runder Punkt (damit die Funken nicht eckig aussehen)
function punktBild() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const ctx = cv.getContext('2d'), g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

// Die Turbo-Felder auf die Bahn malen: leuchtende Pfeile, die nach vorn laufen. felder = aus turboFelder (turbo.js).
// Gibt eine Funktion zurück, die jedes Bild aufgerufen wird (lässt die Pfeile laufen und blitzen, wenn du darüber fährst).
export function baueTurboFelder(szene, T, felder) {
  if (!felder.length) return null;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(255,120,0,0.5)'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#ffe26a'; ctx.lineWidth = 16; ctx.lineJoin = 'miter';
  for (const y of [-8, 56, 120]) { ctx.beginPath(); ctx.moveTo(12, y + 44); ctx.lineTo(64, y); ctx.lineTo(116, y + 44); ctx.stroke(); }
  const teile = felder.map(f => {
    const bild = new THREE.CanvasTexture(cv); bild.wrapT = THREE.RepeatWrapping; bild.repeat.set(1, 2.5); bild.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: bild, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, toneMapped: false });
    const geo = new THREE.PlaneGeometry(f.breit * 2, f.lang); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI);   // flach hinlegen, Bild-Oben zeigt in Fahrtrichtung
    const m = new THREE.Mesh(geo, mat);
    const i = T.index(f.s + f.lang / 2);
    m.position.set(T.x[i] + T.tz[i] * f.d, T.y[i] + 0.0012, T.z[i] - T.tx[i] * f.d);
    m.rotation.y = Math.atan2(T.tx[i], T.tz[i]);
    m.renderOrder = 2; szene.add(m);
    return { f, mat, bild };
  });
  return dt => { for (const t of teile) { t.bild.offset.y -= dt * 1.6; t.mat.opacity = t.f.an > 0 ? 1 : 0.8; t.mat.color.setScalar(t.f.an > 1.2 ? 2.2 : 1); } };
}
