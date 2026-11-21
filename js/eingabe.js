// Rennspiel – alle Arten zu steuern, zusammengefasst zu: lenken (−1 … 1, plus = links), Gas (0 … 1), Bremse (0 … 1).
//
//   Handy-Lenkrad  (verbunden über verbindung.js) – hat immer Vorrang
//   Gamepad        (Controller am Rechner)
//   Neigen         (dieses Gerät selbst ist das Lenkrad, Pedale auf dem Bildschirm)
//   Tastatur       (Pfeiltasten oder W A S D)

import { Neigung } from './neigung.js';

export class Eingabe {
  constructor(empfang) {
    this.empfang = empfang;
    this.tasten = new Set();
    this.lenk = 0; this.gas = 0; this.brems = 0;
    this.quelle = 'tastatur';
    this.handy = { l: 0, g: 0, b: 0 };
    this.befehle = [];            // Knöpfe: kamera, pause, zurueck
    this.neigung = new Neigung();
    this.pedal = { gas: 0, brems: 0 };   // Pedale auf dem Bildschirm
    this.autoGas = false;
    window.addEventListener('keydown', e => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (!this.tasten.has(e.code)) {
        if (e.code === 'KeyC' || e.code === 'KeyV') this.befehle.push('kamera');
        if (e.code === 'KeyP' || e.code === 'Escape') this.befehle.push('pause');
        if (e.code === 'KeyR') this.befehle.push('zurueck');
      }
      this.tasten.add(e.code);
      if (/Arrow|Space/.test(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.tasten.delete(e.code));
    window.addEventListener('blur', () => this.tasten.clear());
    if (empfang) empfang.wennDaten = d => this.vomHandy(d);
    this.padKnoepfe = {};
  }

  vomHandy(d) {
    if (d.t === 's') {
      this.handy.l = clamp(+d.l || 0, -1, 1); this.handy.g = clamp(+d.g || 0, 0, 1); this.handy.b = clamp(+d.b || 0, 0, 1);
    } else if (d.t === 'k' && typeof d.k === 'string') this.befehle.push(d.k);
  }

  holeBefehl() { return this.befehle.shift(); }

  update(dt) {
    // 1. Handy
    if (this.empfang && this.empfang.verbunden) {
      this.quelle = 'handy';
      this.lenk = this.handy.l;
      this.gas = this.autoGas ? (this.handy.b > 0.1 ? 0 : 1) : this.handy.g;
      this.brems = this.handy.b;
      return;
    }
    // 2. Gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0, rt = p.buttons[7] ? p.buttons[7].value : 0, lt = p.buttons[6] ? p.buttons[6].value : 0;
      const a = p.buttons[0] && p.buttons[0].pressed, b = p.buttons[1] && p.buttons[1].pressed;
      const knopf = (i, was) => { const gedr = p.buttons[i] && p.buttons[i].pressed; if (gedr && !this.padKnoepfe[i]) this.befehle.push(was); this.padKnoepfe[i] = gedr; };
      knopf(3, 'kamera'); knopf(9, 'pause'); knopf(2, 'zurueck');
      if (Math.abs(ax) > 0.12 || rt > 0.05 || lt > 0.05 || a || b) this.quelle = 'gamepad';
      if (this.quelle === 'gamepad') {
        const x = Math.abs(ax) < 0.08 ? 0 : ax;
        this.lenk = -Math.sign(x) * Math.pow(Math.abs(x), 1.4);
        this.gas = Math.max(rt, a ? 1 : 0); this.brems = Math.max(lt, b ? 1 : 0);
        return;
      }
    }
    // 3. Neigen mit Pedalen auf dem Bildschirm
    if (this.neigung.an) {
      this.quelle = 'neigen';
      this.lenk = this.neigung.lenk;
      this.gas = this.autoGas ? (this.pedal.brems ? 0 : 1) : this.pedal.gas; this.brems = this.pedal.brems;
      return;
    }
    // 4. Tastatur: Lenkung baut sich weich auf, damit man nicht ruckartig lenkt
    const T = this.tasten;
    const links = T.has('ArrowLeft') || T.has('KeyA'), rechts = T.has('ArrowRight') || T.has('KeyD');
    const ziel = (links ? 1 : 0) - (rechts ? 1 : 0);
    if (links || rechts || T.has('ArrowUp') || T.has('ArrowDown') || T.has('KeyW') || T.has('KeyS') || T.has('Space')) this.quelle = 'tastatur';
    const tempo = ziel === 0 ? 6 : (Math.sign(ziel) !== Math.sign(this.lenk) ? 7 : 3.2);
    this.lenk += clamp(ziel - this.lenk, -tempo * dt, tempo * dt);
    const gasT = T.has('ArrowUp') || T.has('KeyW'), bremsT = T.has('ArrowDown') || T.has('KeyS') || T.has('Space');
    this.gas = this.autoGas ? (bremsT ? 0 : 1) : (gasT ? 1 : this.pedal.gas);
    this.brems = bremsT ? 1 : this.pedal.brems;
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
