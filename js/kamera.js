// Rennspiel – wo die Kamera steht.
//   hinten   = hinter dem Auto, schräg von oben (folgt weich)
//   weit     = wie hinten, aber höher und weiter weg
//   cockpit  = du sitzt im Auto am Lenkrad
//   stand    = Modellauto: du stehst an einer Stelle neben der Bahn und drehst nur den Kopf

import * as THREE from 'three';
import { MASSSTAB } from './strecke.js';

export const SICHTEN = { hinten: 'Hinter dem Auto', weit: 'Hinter dem Auto (weit)', haube: 'Auf der Motorhaube', cockpit: 'Im Cockpit', stand: 'Neben der Bahn stehen' };

export class Kamera {
  constructor(cam) {
    this.cam = cam;
    this.modus = 'hinten';
    this.pos = new THREE.Vector3(); this.blick = new THREE.Vector3();
    this.richtung = 0;          // weich nachgeführte Blickrichtung
    this.frisch = true;
    this.standNr = 0;
    this.wackeln = 0;
  }
  setze(modus) { this.modus = modus; this.frisch = true; }

  update(dt, a, { modell = false, standorte = [], massstab = MASSSTAB } = {}) {
    const cam = this.cam, sc = modell ? massstab : 1;
    const sh = Math.sin(a.h), ch = Math.cos(a.h);
    const speed = Math.abs(a.u) / a.p.vMax;
    // Wackeln auf Randsteinen und bei Stößen
    // Rallye: Schotter, Matsch und Wasser schütteln immer etwas (mehr bei Tempo) – das gehört zum Tempogefühl
    const rallye = !!a.p.rallye, holper = rallye && a.landung > 3 ? Math.min(1.5, a.landung * 0.12) : rallye && a.grund >= 2 && !a.luft ? (a.grund === 7 ? 0.7 : 0.22 + (a.grund === 2 ? 0.25 : 0)) * Math.min(1, speed * 1.4) : 0;
    // Tempogefühl (Rennwagen und Supercars): Beim Beschleunigen wird der Blick kurz weiter und die Kamera bleibt etwas
    // zurück (als würde man in den Sitz gedrückt), ganz schnell zittert das Bild ein wenig.
    const schnell = !!a.p.arcade;
    this.schub = (this.schub || 0) + ((schnell ? Math.max(-0.4, Math.min(1, (a.ax || 0) / 14)) : 0) - (this.schub || 0)) * Math.min(1, dt * 4);
    const zittern = schnell ? Math.max(0, speed - 0.55) * 0.35 : 0;
    this.wackeln = Math.max(this.wackeln * Math.exp(-dt * 6), (a.grund === 1 ? 0.5 * speed : 0) + holper + zittern + Math.min(1, a.stoss * 0.15 / sc));
    const w = this.wackeln * (this.modus === 'cockpit' ? 0.012 : 0.05) * sc;
    const zit = () => (Math.random() - 0.5) * w;

    if (this.modus === 'stand' && standorte.length) {
      const st = standorte[this.standNr % standorte.length];
      cam.position.set(st.x, st.y, st.z);
      const ziel = new THREE.Vector3(a.x, a.y + 0.02, a.z);
      if (this.frisch) this.blick.copy(ziel); else this.blick.lerp(ziel, 1 - Math.exp(-dt * 9));
      cam.lookAt(this.blick);
      // Je weiter das Auto weg ist, desto mehr "kneift man die Augen zusammen" (leicht heranholen)
      const ab = cam.position.distanceTo(ziel);
      // (kleinere Autos wie die Drift-Rallyeautos 1:43: noch etwas näher heranholen)
      const k = Math.min(1, massstab / MASSSTAB);
      const fov = THREE.MathUtils.clamp((6 + ab * 4.2) * k, 12 * k, 34);
      cam.fov += (fov - cam.fov) * (this.frisch ? 1 : 1 - Math.exp(-dt * 2));
      cam.updateProjectionMatrix();
      this.frisch = false;
      return;
    }

    if (this.modus === 'cockpit' || this.modus === 'haube') {
      // Augen des Fahrers: hinter dem Lenkrad, knapp über dem Rand
      // Supercar: Augen links im Auto, höher (a.auge kommt vom 3D-Modell)
      // Motorhaube (Rallye): Kamera vorn auf der Haube, ganz tief – so wirkt das Tempo am stärksten
      const haube = this.modus === 'haube';
      const [ex, ey, ez] = haube ? [0, 1.66, 0.55] : a.auge ? [a.auge[0], a.auge[1], a.auge[2]] : [0, 0.92, -0.12];
      // Der Kopf des Fahrers neigt sich in die Kurve hinein (bis etwa 7 Grad) – so spürt man die Kurve im Cockpit
      const nick = a.neigung, roll = Math.max(-0.13, Math.min(0.13, a.u * a.r / 9.81 * (a.p.super ? 0.09 : 0.045)));
      cam.position.set(a.x + sh * ez + ch * ex, a.y + ey, a.z + ch * ez - sh * ex).multiplyScalar(1);
      if (modell) { cam.position.set(a.x + sh * ez * sc, a.y + ey * sc, a.z + ch * ez * sc); }
      cam.position.x += zit(); cam.position.y += zit();
      const vorX = a.x + sh * 30 * sc, vorZ = a.z + ch * 30 * sc;
      cam.up.set(Math.cos(a.h) * roll, 1, -Math.sin(a.h) * roll);
      cam.lookAt(vorX + ch * ex, a.y + (ey - (haube ? 1.6 : a.auge ? 1.2 : 1.6) - nick * 20 + (a.nick || 0) * 30) * sc, vorZ - sh * ex);
      cam.up.set(0, 1, 0);
      const fov = (haube ? 64 + speed * 16 : 60 + speed * (rallye ? 14 : 10)) + this.schub * 5;   // je schneller, desto weiter der Blick: so fühlt sich Tempo nach Tempo an
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.near = modell ? 0.002 : 0.05;
      cam.updateProjectionMatrix();
      this.frisch = false;
      return;
    }

    // hinter dem Auto: Richtung folgt dem Auto mit etwas Verzögerung (so sieht man das Driften)
    const weit = this.modus === 'weit';
    // Rallye: etwas tiefer und näher am Auto, damit man den Weg und das Driften gut sieht
    const ab = (weit ? 11 : rallye ? 6.4 : 7.2) * sc * (1 + this.schub * 0.12), hoch = (weit ? 4.4 : rallye ? 2.05 : 2.35) * sc;
    let d = a.h - this.richtung; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (this.frisch) this.richtung = a.h; else this.richtung += d * Math.min(1, dt * (Math.abs(a.u) < 3 * sc ? 2.5 : 5));
    const rs = Math.sin(this.richtung), rc = Math.cos(this.richtung);
    const ziel = new THREE.Vector3(a.x - rs * ab, a.y + hoch, a.z - rc * ab);
    if (this.frisch) this.pos.copy(ziel); else this.pos.lerp(ziel, 1 - Math.exp(-dt * 20));
    // nicht unter die Fahrbahn
    cam.position.copy(this.pos); cam.position.x += zit(); cam.position.y += zit();
    cam.lookAt(a.x + rs * 3.5 * sc, a.y + (weit ? 0.3 : 0.75) * sc, a.z + rc * 3.5 * sc);
    const fov = (weit ? 46 : 48) + speed * (rallye ? 24 : 15) + this.schub * 7;   // je schneller, desto weiter der Blick: so fühlt sich Tempo nach Tempo an
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
    cam.near = modell ? 0.005 : 0.1;
    cam.updateProjectionMatrix();
    this.frisch = false;
  }
}
