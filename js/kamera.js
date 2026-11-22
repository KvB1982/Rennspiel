// Rennspiel – wo die Kamera steht.
//   hinten   = hinter dem Auto, schräg von oben (folgt weich)
//   weit     = wie hinten, aber höher und weiter weg
//   cockpit  = du sitzt im Auto am Lenkrad (Rennwagen, Supercars und Rallyeautos)
//   stand    = Modellauto: du stehst an einer Stelle neben der Bahn und drehst nur den Kopf

import * as THREE from 'three';
import { MASSSTAB } from './strecke.js';

export const SICHTEN = { hinten: 'Hinter dem Auto', weit: 'Hinter dem Auto (weit)', cockpit: 'Im Cockpit', stand: 'Neben der Bahn stehen' };

// Kopfneigung: In der Kurve legt sich das Bild schräg, als würde man den Kopf in die Kurve legen.
// KOPF = so viel pro "g" Kurvenkraft (rad), KOPF_MAX = höchstens (0,13 rad sind gut 7 Grad).
// Im Cockpit ist sie immer an. Hinter dem Auto ist sie etwas sanfter und im Menü abschaltbar ("Kopf neigt sich in die Kurve").
const KOPF = { super: 0.09, formel: 0.045, rallye: 0.06 }, KOPF_MAX = 0.13, KOPF_MAX_RALLYE = 0.09;   // Rallye: weniger, dort geht es dauernd links und rechts
const KOPF_HINTEN = 0.8, KOPF_HINTEN_MAX = 0.1, KOPF_WEICH = 5;   // hinter dem Auto: Anteil, höchstens (rad), wie schnell das Bild folgt

export class Kamera {
  constructor(cam) {
    this.cam = cam;
    this.modus = 'hinten';
    this.pos = new THREE.Vector3(); this.blick = new THREE.Vector3();
    this.richtung = 0;          // weich nachgeführte Blickrichtung
    this.frisch = true;
    this.standNr = 0;
    this.wackeln = 0;
    this.kopf = 0;              // so schräg steht das Bild gerade (hinter dem Auto)
  }
  setze(modus) { this.modus = modus === 'haube' ? 'cockpit' : modus; this.frisch = true; }   // die Motorhauben-Kamera gibt es nicht mehr

  update(dt, a, { modell = false, standorte = [], massstab = MASSSTAB, kopfNeigen = true } = {}) {
    const cam = this.cam, sc = modell ? massstab : 1;
    const sh = Math.sin(a.h), ch = Math.cos(a.h);
    const speed = Math.abs(a.u) / a.p.vMax;
    // Wackeln auf Randsteinen und bei Stößen
    // Rallye: Schotter, Matsch und Wasser schütteln immer etwas (mehr bei Tempo) – das gehört zum Tempogefühl
    const rallye = !!a.p.rallye, holper = rallye && a.landung > 3 ? Math.min(1.5, a.landung * 0.12) : rallye && a.grund >= 2 && !a.luft ? (a.grund === 7 ? 0.7 : 0.22 + (a.grund === 2 ? 0.25 : 0)) * Math.min(1, speed * 1.4) : 0;
    // Tempogefühl (Rennwagen und Supercars): Beim Beschleunigen wird der Blick kurz weiter und die Kamera bleibt etwas
    // zurück (als würde man in den Sitz gedrückt), ganz schnell zittert das Bild ein wenig.
    const schnell = !!a.p.arcade || !!a.p.turbo;
    // (kleine Autos: Ihre Beschleunigung ist kleiner, und im Turbo reißt es den Blick ganz auf)
    const schubZiel = a.turbo > 0 ? 1.6 : schnell ? Math.max(-0.4, Math.min(1, (a.ax || 0) / (modell ? 2.2 : 14))) : 0;
    this.schub = (this.schub || 0) + (schubZiel - (this.schub || 0)) * Math.min(1, dt * (a.turbo > 0 ? 8 : 4));
    const zittern = schnell ? Math.max(0, speed - 0.55) * 0.35 : 0;
    this.wackeln = Math.max(this.wackeln * Math.exp(-dt * 6), (a.grund === 1 ? 0.5 * speed : 0) + holper + zittern + (a.turbo > 0 ? 0.35 : 0) + Math.min(1, a.stoss * 0.15 / sc));
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

    // So stark drückt die Kurve zur Seite (in "g", plus = Linkskurve) – daraus wird die Kopfneigung
    // (kleine Autos: Ihre Kurvenkräfte sind viel kleiner – mal 10, damit sich der Kopf trotzdem sichtbar neigt)
    const kurveG = a.u * a.r / 9.81 * (modell ? 10 : 1);
    const kopfJeG = rallye ? KOPF.rallye : a.p.super ? KOPF.super : KOPF.formel;

    if (this.modus === 'cockpit') {
      // Augen des Fahrers: hinter dem Lenkrad, knapp über dem Rand
      // Supercar: Augen links im Auto, höher (a.auge kommt vom 3D-Modell)
      // Rallye im Drift: Das Auto dreht sich im Bild um seine Vorderachse (siehe autoStellen) – du sitzt drin und drehst dich mit.
      // Der Kopf schaut dabei halb zurück in Fahrtrichtung (DRIFT_BLICK), so wie ein Fahrer im Drift durch die Seite der Scheibe schaut.
      const DRIFT_BLICK = 0.5;
      const dw = a.drift || 0, vorn = dw ? (a.p.a || 0) : 0;
      const sh = Math.sin(a.h + dw), ch = Math.cos(a.h + dw);
      const bx = a.x + vorn * (Math.sin(a.h) - sh), bz = a.z + vorn * (Math.cos(a.h) - ch);   // hier steht das Auto im Bild
      const bh = a.h + dw * (1 - DRIFT_BLICK), bs = Math.sin(bh), bc = Math.cos(bh);           // dorthin schaut der Kopf
      const [ex, ey, ez] = a.auge ? [a.auge[0], a.auge[1], a.auge[2]] : [0, 0.92, -0.12];
      // Der Kopf des Fahrers neigt sich in die Kurve hinein (bis etwa 7 Grad) – so spürt man die Kurve im Cockpit
      const nick = a.neigung, kMax = rallye ? KOPF_MAX_RALLYE : KOPF_MAX, roll = Math.max(-kMax, Math.min(kMax, kurveG * kopfJeG));
      cam.position.set(bx + sh * ez + ch * ex, a.y + ey, bz + ch * ez - sh * ex);
      if (modell) { cam.position.set(a.x + (sh * ez + ch * ex) * sc, a.y + ey * sc, a.z + (ch * ez - sh * ex) * sc); }
      cam.position.x += zit(); cam.position.y += zit();
      cam.up.set(bc * roll, 1, -bs * roll);
      cam.lookAt(cam.position.x + bs * 30 * sc, a.y + (ey - (a.blickTief ?? (a.auge ? 1.2 : 1.6)) - nick * 20 + (a.nick || 0) * 30) * sc, cam.position.z + bc * 30 * sc);
      cam.up.set(0, 1, 0);
      const fov = 60 + speed * (rallye ? 20 : 10) + this.schub * 5;   // je schneller, desto weiter der Blick: so fühlt sich Tempo nach Tempo an
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.near = modell ? 0.002 : 0.05;
      cam.updateProjectionMatrix();
      this.frisch = false;
      return;
    }

    // hinter dem Auto: Richtung folgt dem Auto mit etwas Verzögerung (so sieht man das Driften)
    const weit = this.modus === 'weit';
    // Rallye: etwas tiefer und näher am Auto, damit man den Weg und das Driften gut sieht
    // (kleine Autos: auch etwas näher dran – das kleine Auto soll groß im Bild sein)
    const ab = (weit ? 11 : rallye ? 5.9 : modell ? 6.3 : 7.2) * sc * (1 + this.schub * 0.12), hoch = (weit ? 4.4 : rallye ? 1.9 : modell ? 2.1 : 2.35) * sc;
    // Drift-Rallye: Die Kamera schaut eher dorthin, wohin das Auto rutscht – so sieht man es von hinten schön quer stehen
    const wohin = a.h + (a.p.leicht && a.u > 0.05 ? Math.atan2(a.v, a.u) * 0.55 : 0);
    let d = wohin - this.richtung; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (this.frisch) this.richtung = wohin; else this.richtung += d * Math.min(1, dt * (Math.abs(a.u) < 3 * sc ? 2.5 : 5));
    const rs = Math.sin(this.richtung), rc = Math.cos(this.richtung);
    const ziel = new THREE.Vector3(a.x - rs * ab, a.y + hoch, a.z - rc * ab);
    if (this.frisch) this.pos.copy(ziel); else this.pos.lerp(ziel, 1 - Math.exp(-dt * 20));
    // nicht unter die Fahrbahn
    cam.position.copy(this.pos); cam.position.x += zit(); cam.position.y += zit();
    // Kopfneigung auch hinter dem Auto (abschaltbar): Das Bild legt sich weich in die Kurve
    const kopfZiel = kopfNeigen ? Math.max(-KOPF_HINTEN_MAX, Math.min(KOPF_HINTEN_MAX, kurveG * kopfJeG * KOPF_HINTEN)) : 0;
    this.kopf = this.frisch ? kopfZiel : this.kopf + (kopfZiel - this.kopf) * Math.min(1, dt * KOPF_WEICH);
    cam.up.set(rc * this.kopf, 1, -rs * this.kopf);
    cam.lookAt(a.x + rs * 3.5 * sc, a.y + (weit ? 0.3 : 0.75) * sc, a.z + rc * 3.5 * sc);
    cam.up.set(0, 1, 0);
    const fov = (weit ? 46 : 48) + speed * (rallye ? 32 : modell ? 24 : 15) + this.schub * 7;   // je schneller, desto weiter der Blick: so fühlt sich Tempo nach Tempo an
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
    cam.near = modell ? 0.005 : 0.1;
    cam.updateProjectionMatrix();
    this.frisch = false;
  }
}
