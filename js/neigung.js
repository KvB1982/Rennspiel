// Rennspiel – das Gerät als Lenkrad: Wie weit ist es nach links oder rechts gedreht?
//
// Die Rechnung kommt aus Frontline (js/touch.js, "Steuern durch Neigen"): Aus den Sensorwinkeln (beta, gamma)
// wird die Richtung "oben" berechnet, vom Bildschirm aus gesehen. Hält man das Handy quer wie ein Lenkrad
// und dreht es, dreht sich "oben" auf dem Bildschirm mit. Dieser Winkel ist der Lenkwinkel.
// Anders als in Frontline wird hier der ganze Drehwinkel benutzt (atan2), nicht nur die Neigung:
// so geht das Lenken auch weit über 45 Grad und es ist egal, ob man das Handy flach oder steil hält.

const DEG = 180 / Math.PI;
// Empfindlichkeit: wie weit man das Handy für vollen Lenkeinschlag drehen muss (Grad)
export const VOLL = [110, 90, 70, 55, 42];

export class Neigung {
  constructor() {
    this.an = false; this.erlaubt = false;
    this.u = null;           // Richtung "oben" im Gerät
    this.mitte = 0;          // Winkel beim Kalibrieren
    this.winkel = 0;         // Drehung seit dem Kalibrieren (Grad, plus = nach links gedreht)
    this.nick = 0;           // nach vorn/hinten gekippt (Grad)
    this.th = null;          // wie der Bildschirm gedreht ist (quer links/rechts)
    this.stufe = 3;
    this.signal = false;
    try { const s = +localStorage.getItem('rennspiel.empf'); if (s >= 1 && s <= VOLL.length) this.stufe = s; } catch (e) {}
    this.handler = e => this.sensor(e);
  }
  get lenk() {
    if (!this.an) return 0;
    const v = this.winkel / VOLL[this.stufe - 1];
    const a = Math.abs(v);
    // ganz kleine Drehungen zählen nicht, danach weich ansteigend
    const tot = 0.025;
    return a < tot ? 0 : Math.sign(v) * Math.min(1, (a - tot) / (1 - tot));
  }
  stufeWeiter() { this.stufe = this.stufe % VOLL.length + 1; try { localStorage.setItem('rennspiel.empf', this.stufe); } catch (e) {} return this.stufe; }

  // muss direkt aus einem Fingertipp kommen (iPhone fragt dann einmal um Erlaubnis)
  async start() {
    const D = window.DeviceOrientationEvent;
    if (!D) return false;
    if (typeof D.requestPermission === 'function') {
      try { if (await D.requestPermission() !== 'granted') return false; } catch (e) { return false; }
    }
    this.erlaubt = true; this.an = true;
    window.addEventListener('deviceorientation', this.handler);
    this.mitteSetzen = true;
    return true;
  }
  stop() { this.an = false; window.removeEventListener('deviceorientation', this.handler); }
  kalibrieren() { this.mitteSetzen = true; }

  // Richtung "oben" auf dem gedrehten Bildschirm: [nach rechts, nach oben, aus dem Bildschirm]
  aufSchirm(u, th) { return [u[0] * Math.cos(th) - u[1] * Math.sin(th), u[0] * Math.sin(th) + u[1] * Math.cos(th), u[2]]; }

  // Wie herum der Bildschirm gedreht ist, sagt die Schwerkraft (wie in Frontline: auf screen.orientation ist kein Verlass)
  drehungFinden(u) {
    const quer = window.innerWidth >= window.innerHeight, kand = quer ? [90, 270] : [0, 180];
    const sy = this.aufSchirm(u, kand[0] / DEG)[1];
    if (Math.abs(sy) > 0.25) return kand[sy > 0 ? 0 : 1] / DEG;
    const so = window.screen && screen.orientation;
    const rep = (((so && typeof so.angle === 'number' ? so.angle : (window.orientation || 0)) % 360) + 360) % 360;
    return (kand.includes(rep) ? rep : kand[0]) / DEG;
  }

  sensor(e) {
    if (e.beta === null || e.gamma === null || e.beta === undefined) return;
    this.signal = true;
    const b = e.beta / DEG, g = e.gamma / DEG;
    const u = this.u = [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
    const quer = window.innerWidth >= window.innerHeight;
    if (this.th === null || this.quer !== quer || this.mitteSetzen) { this.th = this.drehungFinden(u); this.quer = quer; }
    const s = this.aufSchirm(u, this.th);
    // Drehwinkel um die Achse, die aus dem Bildschirm zeigt
    const w = Math.atan2(s[0], s[1]) * DEG;
    this.nick = Math.atan2(s[2], Math.hypot(s[0], s[1])) * DEG;
    if (this.mitteSetzen) { this.mitte = w; this.mitteSetzen = false; }
    let d = w - this.mitte; while (d > 180) d -= 360; while (d < -180) d += 360;
    this.winkel = d;
  }
}
