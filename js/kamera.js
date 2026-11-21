// Rennspiel – wo die Kamera steht.
//   hinten   = hinter dem Auto, schräg von oben (folgt weich)
//   weit     = wie hinten, aber höher und weiter weg
//   cockpit  = du sitzt im Auto am Lenkrad
//   stand    = Modellauto: du stehst an einer Stelle neben der Bahn und drehst nur den Kopf

import * as THREE from 'three';
import { MASSSTAB } from './strecke.js';

export const SICHTEN = { hinten: 'Hinter dem Auto', weit: 'Hinter dem Auto (weit)', cockpit: 'Im Cockpit', stand: 'Neben der Bahn stehen' };

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

  update(dt, a, { modell = false, standorte = [] } = {}) {
    const cam = this.cam, sc = modell ? MASSSTAB : 1;
    const sh = Math.sin(a.h), ch = Math.cos(a.h);
    const speed = Math.abs(a.u) / a.p.vMax;
    // Wackeln auf Randsteinen und bei Stößen
    this.wackeln = Math.max(this.wackeln * Math.exp(-dt * 6), (a.grund === 1 ? 0.5 * speed : 0) + Math.min(1, a.stoss * 0.15 / sc));
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
      const fov = THREE.MathUtils.clamp(6 + ab * 4.2, 12, 34);
      cam.fov += (fov - cam.fov) * (this.frisch ? 1 : 1 - Math.exp(-dt * 2));
      cam.updateProjectionMatrix();
      this.frisch = false;
      return;
    }

    if (this.modus === 'cockpit') {
      // Augen des Fahrers: hinter dem Lenkrad, knapp über dem Rand
      // Supercar: Augen links im Auto, höher (a.auge kommt vom 3D-Modell)
      const [ex, ey, ez] = a.auge ? [a.auge[0], a.auge[1], a.auge[2]] : [0, 0.92, -0.12];
      // Der Kopf des Fahrers neigt sich in die Kurve hinein (bis etwa 7 Grad) – so spürt man die Kurve im Cockpit
      const nick = a.neigung, roll = Math.max(-0.13, Math.min(0.13, a.u * a.r / 9.81 * (a.p.super ? 0.09 : 0.045)));
      cam.position.set(a.x + sh * ez + ch * ex, a.y + ey, a.z + ch * ez - sh * ex).multiplyScalar(1);
      if (modell) { cam.position.set(a.x + sh * ez * sc, a.y + ey * sc, a.z + ch * ez * sc); }
      cam.position.x += zit(); cam.position.y += zit();
      const vorX = a.x + sh * 30 * sc, vorZ = a.z + ch * 30 * sc;
      cam.up.set(Math.cos(a.h) * roll, 1, -Math.sin(a.h) * roll);
      cam.lookAt(vorX + ch * ex, a.y + (ey - (a.auge ? 1.2 : 1.6) - nick * 20) * sc, vorZ - sh * ex);
      cam.up.set(0, 1, 0);
      const fov = 60 + speed * 10;   // je schneller, desto weiter der Blick: so fühlt sich Tempo nach Tempo an
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.near = modell ? 0.002 : 0.05;
      cam.updateProjectionMatrix();
      this.frisch = false;
      return;
    }

    // hinter dem Auto: Richtung folgt dem Auto mit etwas Verzögerung (so sieht man das Driften)
    const weit = this.modus === 'weit';
    const ab = (weit ? 11 : 7.2) * sc, hoch = (weit ? 4.4 : 2.35) * sc;
    let d = a.h - this.richtung; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (this.frisch) this.richtung = a.h; else this.richtung += d * Math.min(1, dt * (Math.abs(a.u) < 3 * sc ? 2.5 : 5));
    const rs = Math.sin(this.richtung), rc = Math.cos(this.richtung);
    const ziel = new THREE.Vector3(a.x - rs * ab, a.y + hoch, a.z - rc * ab);
    if (this.frisch) this.pos.copy(ziel); else this.pos.lerp(ziel, 1 - Math.exp(-dt * 20));
    // nicht unter die Fahrbahn
    cam.position.copy(this.pos); cam.position.x += zit(); cam.position.y += zit();
    cam.lookAt(a.x + rs * 3.5 * sc, a.y + (weit ? 0.3 : 0.75) * sc, a.z + rc * 3.5 * sc);
    const fov = (weit ? 46 : 48) + speed * 15;   // je schneller, desto weiter der Blick: so fühlt sich Tempo nach Tempo an
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
    cam.near = modell ? 0.005 : 0.1;
    cam.updateProjectionMatrix();
    this.frisch = false;
  }
}
