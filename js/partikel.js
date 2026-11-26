// Rennspiel – Staub, Steinchen, Matsch und Wasser, die hinter den Rädern hochfliegen (Rallye).
//
// Jedes "Teilchen" ist ein weicher runder Fleck (ein Punkt, der zur Kamera schaut). Sie fliegen, werden größer
// und blasser und verschwinden. Höchstens MAX Stück gleichzeitig – ist die Liste voll, wird das älteste wiederverwendet.

import * as THREE from 'three';
import { BELAG } from './strecke.js';

const MAX = 2400;
const G = 9.81;

// Arten: Farbe, Größe am Anfang und am Ende (m), Lebenszeit (s), wie stark die Luft bremst, Schwerkraft (Anteil), Deckkraft
const ARTEN = {
  staub:  { farbe: 0xcbb894, von: [0.8, 1.6], bis: [3.5, 6.5], leben: [1.6, 3.0], luft: 2.2, schwer: -0.04, deck: 0.32 },
  stein:  { farbe: 0x6d6250, von: [0.05, 0.09], bis: [0.05, 0.09], leben: [0.5, 0.9], luft: 0.3, schwer: 1, deck: 1 },
  matsch: { farbe: 0x4a3622, von: [0.1, 0.24], bis: [0.14, 0.3], leben: [0.7, 1.1], luft: 0.4, schwer: 1, deck: 0.95 },
  nebel:  { farbe: 0x6a5640, von: [0.6, 1.0], bis: [1.8, 3.0], leben: [0.8, 1.4], luft: 2.5, schwer: 0, deck: 0.3 },
  wasser: { farbe: 0xe6eef2, von: [0.25, 0.6], bis: [0.9, 1.8], leben: [0.6, 1.0], luft: 0.9, schwer: 0.9, deck: 0.55 },
  rauch:  { farbe: 0xd8d8d8, von: [0.6, 1.0], bis: [3.0, 5.0], leben: [1.4, 2.4], luft: 2.0, schwer: -0.05, deck: 0.3 },
  gras:   { farbe: 0x55642e, von: [0.06, 0.12], bis: [0.06, 0.12], leben: [0.5, 0.8], luft: 0.5, schwer: 1, deck: 1 },
};

export class Spritzer {
  // staubFarbe = Farbe des Staubs auf dieser Prüfung
  constructor(szene, { staubFarbe = null, viel = 1 } = {}) {
    this.max = Math.round(MAX * Math.max(0.35, viel));
    this.viel = viel;
    const n = this.max;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.farbe = new Float32Array(n * 3); this.gross = new Float32Array(n); this.deck = new Float32Array(n);
    this.alter = new Float32Array(n).fill(1e9); this.leben = new Float32Array(n).fill(1);
    this.von = new Float32Array(n); this.bis = new Float32Array(n); this.deck0 = new Float32Array(n);
    this.luft = new Float32Array(n); this.schwer = new Float32Array(n);
    this.naechstes = 0; this.uhr = 0;
    this.staubFarbe = new THREE.Color(staubFarbe ?? ARTEN.staub.farbe);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('farbe', new THREE.BufferAttribute(this.farbe, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('gross', new THREE.BufferAttribute(this.gross, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('deck', new THREE.BufferAttribute(this.deck, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { skala: { value: 500 }, licht: { value: 1 } }]),
      vertexShader: `
        attribute vec3 farbe; attribute float gross; attribute float deck;
        uniform float skala; varying vec3 vFarbe; varying float vDeck;
        #include <fog_pars_vertex>
        void main() {
          vFarbe = farbe;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = deck > 0.0 ? min(400.0, gross * skala / max(0.5, -mvPosition.z)) : 0.0;
          // ganz dicht vor der Kamera blasser (sonst liegt eine Wolke wie ein Vorhang vor dem Bild)
          vDeck = deck * smoothstep(1.0, 5.0, -mvPosition.z);
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float licht; varying vec3 vFarbe; varying float vDeck;
        #include <fog_pars_fragment>
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          if (r > 1.0) discard;
          float a = vDeck * (1.0 - r * r);
          gl_FragColor = vec4(vFarbe * licht, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true,
    });
    this.punkte = new THREE.Points(g, this.mat);
    this.punkte.frustumCulled = false;
    this.punkte.renderOrder = 5;
    szene.add(this.punkte);
    this.c = new THREE.Color();
    this.warLuft = false;
  }

  // ein Teilchen der Art `art` bei (x, y, z) mit Tempo (vx, vy, vz)
  neu(art, x, y, z, vx, vy, vz, farbe = null) {
    const A = ARTEN[art], k = this.naechstes; this.naechstes = (k + 1) % this.max;
    const zz = () => Math.random();
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz;
    this.c.set(farbe ?? (art === 'staub' ? this.staubFarbe : A.farbe)).offsetHSL(0, 0, (zz() - 0.5) * 0.08);
    this.farbe[k * 3] = this.c.r; this.farbe[k * 3 + 1] = this.c.g; this.farbe[k * 3 + 2] = this.c.b;
    this.von[k] = A.von[0] + zz() * (A.von[1] - A.von[0]); this.bis[k] = A.bis[0] + zz() * (A.bis[1] - A.bis[0]);
    this.leben[k] = A.leben[0] + zz() * (A.leben[1] - A.leben[0]); this.alter[k] = 0;
    this.deck0[k] = A.deck; this.luft[k] = A.luft; this.schwer[k] = A.schwer;
  }

  // Das Auto wirft hinter den Rädern etwas hoch – je nach Untergrund und Tempo
  auto(a, dt) {
    const sh0 = Math.sin(a.h), ch0 = Math.cos(a.h);
    const vx = sh0 * a.u + ch0 * a.v, vz = ch0 * a.u - sh0 * a.v, v = Math.hypot(vx, vz);
    const p = a.p, b = p.b || 1.3, aa = p.a || 1.2;
    // Im Drift steht das Auto im Bild quer (um die Vorderachse gedreht): Staub und Steine kommen von dort, wo die Räder zu sehen sind
    const dw = (a.drift || 0) * (a.driftMal ?? 1), sh = Math.sin(a.h + dw), ch = Math.cos(a.h + dw);
    const ax = a.x + (dw ? aa * (sh0 - sh) : 0), az = a.z + (dw ? aa * (ch0 - ch) : 0);
    // gelandet nach einem Sprung: eine große Staubwolke
    if (this.warLuft && !a.luft && v > 8) this.wolke(a, Math.min(1, v / 35));
    this.warLuft = !!a.luft;
    if (a.luft || v < 2) return;
    const grund = a.grund, rutsch = Math.max(a.rutschHinten || 0, a.rutschVorn || 0);
    const dreh = Math.min(1, Math.abs(a.gas) * 0.6 + rutsch);   // durchdrehende oder rutschende Räder werfen mehr
    const zahl = (rate) => { const m = rate * dt * this.viel; return Math.floor(m) + (Math.random() < m % 1 ? 1 : 0); };
    for (const seite of [-1, 1]) {
      // Hinterrad (in der Welt)
      const hx = ax - sh * b + ch * seite * 0.78, hz = az - ch * b - sh * seite * 0.78, y = a.y + 0.15;
      const zuf = s => (Math.random() - 0.5) * s;
      if (grund === BELAG.schotter || grund === BELAG.kies) {
        for (let k = zahl(Math.min(60, v * 1.1) * (0.5 + dreh)); k--;) this.neu('staub', hx + zuf(0.6), y + 0.2, hz + zuf(0.6), vx * 0.5 + zuf(2), 0.6 + Math.random() * 1.2, vz * 0.5 + zuf(2));
        for (let k = zahl(v * 0.9 * dreh); k--;) this.neu('stein', hx, y, hz, vx * 0.35 - sh * 4 + zuf(3), 1.5 + Math.random() * 3, vz * 0.35 - ch * 4 + zuf(3));
      } else if (grund === BELAG.matsch) {
        for (let k = zahl(v * 1.6 * (0.4 + dreh)); k--;) this.neu('matsch', hx, y, hz, vx * 0.4 - sh * 5 + zuf(3), 1.5 + Math.random() * 3.5, vz * 0.4 - ch * 5 + zuf(3));
        for (let k = zahl(v * 0.35); k--;) this.neu('nebel', hx, y + 0.2, hz, vx * 0.3 + zuf(1.5), 0.4, vz * 0.3 + zuf(1.5));
      } else if (grund === BELAG.wasser) {
        // Wasser: zu beiden Seiten hoch hinaus (wie Flügel), vorne und hinten
        const st = Math.min(1.6, v / 18);
        for (const vorn of [1, 0]) {
          const ox = vorn ? ax + sh * aa + ch * seite * 0.8 : hx, oz = vorn ? az + ch * aa - sh * seite * 0.8 : hz;
          for (let k = zahl(v * 5 * st); k--;) {
            const raus = 2 + Math.random() * 4 * st;
            this.neu('wasser', ox, a.y + 0.2, oz, vx * 0.55 + ch * seite * raus + zuf(1.5), 2 + Math.random() * 4.5 * st, vz * 0.55 - sh * seite * raus + zuf(1.5));
          }
        }
      } else if (grund === BELAG.gras) {
        for (let k = zahl(v * 0.8 * (0.5 + dreh)); k--;) this.neu('gras', hx, y, hz, vx * 0.4 - sh * 3 + zuf(2), 1 + Math.random() * 2.5, vz * 0.4 - ch * 3 + zuf(2));
        for (let k = zahl(v * 0.4); k--;) this.neu('staub', hx, y + 0.2, hz, vx * 0.2 + zuf(1.5), 0.4, vz * 0.2 + zuf(1.5), 0x8a7a58);
      } else if (grund === BELAG.asphalt && rutsch > 0.3 && v > 6) {
        for (let k = zahl(rutsch * 40); k--;) this.neu('rauch', hx, y + 0.1, hz, vx * 0.2 + zuf(1), 0.5, vz * 0.2 + zuf(1));
      }
    }
  }

  // Staubwolke rund um das Auto (Landung nach einem Sprung)
  wolke(a, staerke) {
    const n = Math.round(40 * staerke * this.viel), art = a.grund === BELAG.matsch ? 'nebel' : a.grund === BELAG.wasser ? 'wasser' : 'staub';
    for (let k = 0; k < n; k++) {
      const w = Math.random() * 6.283, r = 3 + Math.random() * 4;
      this.neu(art, a.x + Math.cos(w) * 1.2, a.y + 0.3, a.z + Math.sin(w) * 1.6, Math.cos(w) * r, 0.5 + Math.random() * 1.5, Math.sin(w) * r);
    }
  }

  update(dt, kamera, hoehe, licht = 1) {
    this.mat.uniforms.skala.value = hoehe * 0.5 / Math.tan(THREE.MathUtils.degToRad(kamera.fov) / 2);
    this.mat.uniforms.licht.value = licht;
    const P = this.pos, V = this.vel;
    for (let k = 0; k < this.max; k++) {
      const t = this.alter[k];
      if (t > this.leben[k]) { if (this.deck[k] !== 0) this.deck[k] = 0; continue; }
      const nt = this.alter[k] = t + dt, f = nt / this.leben[k];
      const brems = Math.exp(-this.luft[k] * dt);
      V[k * 3] *= brems; V[k * 3 + 2] *= brems; V[k * 3 + 1] = V[k * 3 + 1] * brems - G * this.schwer[k] * dt;
      P[k * 3] += V[k * 3] * dt; P[k * 3 + 1] += V[k * 3 + 1] * dt; P[k * 3 + 2] += V[k * 3 + 2] * dt;
      this.gross[k] = this.von[k] + (this.bis[k] - this.von[k]) * Math.sqrt(f);
      // weich auftauchen (erste 10 %) und langsam verschwinden
      this.deck[k] = this.deck0[k] * Math.min(1, f * 10) * (1 - f) * (1 - f * 0.3);
      if (f >= 1) this.deck[k] = 0;
    }
    const at = this.geo.attributes;
    at.position.needsUpdate = at.farbe.needsUpdate = at.gross.needsUpdate = at.deck.needsUpdate = true;
  }
}
