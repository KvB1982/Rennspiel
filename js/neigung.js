// Rennspiel – das Gerät als Lenkrad: Wie weit ist es nach links oder rechts gedreht?
//
// Die Rechnung kommt aus Frontline (js/touch.js, "Steuern durch Neigen"): Aus den Sensorwinkeln (beta, gamma)
// wird die Richtung "oben" berechnet, vom Bildschirm aus gesehen. Hält man das Handy quer wie ein Lenkrad
// und dreht es, dreht sich "oben" auf dem Bildschirm mit. Dieser Winkel ist der Lenkwinkel.
// Gemessen wird, wie schräg die lange Kante des Bildschirms gegen den Horizont steht (linke Seite tiefer = links).
// Das ist bei einem aufrecht gehaltenen Handy genau der Drehwinkel des „Lenkrads“. Und es bleibt ruhig, wenn man
// ein iPad flach vor sich hält: Früher wurde der Winkel dann riesig (winzige Bewegung = voller Lenkeinschlag).

const DEG = 180 / Math.PI;
// Empfindlichkeit: wie weit man das Handy für vollen Lenkeinschlag drehen muss (Grad)
export const VOLL = [80, 65, 52, 42, 33];
// Zittern der Hand glätten: so schnell folgt der Winkel dem Sensor (Sekunden; klein = direkter)
const RUHE = 0.035;
const FLACH = 0.7;
// Um die Mitte herum feiner lenken: 0 = gerade Kennlinie, 1 = in der Mitte ganz weich
const FEIN = 0.5;

export class Neigung {
  constructor() {
    this.an = false; this.erlaubt = false;
    this.u = null;           // Richtung "oben" im Gerät
    this.mitte = 0;          // Winkel beim Kalibrieren
    this.winkel = 0;         // Drehung seit dem Kalibrieren (Grad, plus = nach links gedreht)
    this.nick = 0;           // nach vorn/hinten gekippt (Grad)
    this.th = null;          // wie der Bildschirm gedreht ist (quer links/rechts)
    this.stufe = 3;
    this.signal = false; this.zeit = 0;
    try { const s = +localStorage.getItem('rennspiel.empf2'); if (s >= 1 && s <= VOLL.length) this.stufe = s; } catch (e) {}
    this.handler = e => this.sensor(e);
  }
  get lenk() {
    if (!this.an) return 0;
    const v = this.winkel / VOLL[this.stufe - 1];
    const a = Math.abs(v);
    // ganz kleine Drehungen zählen nicht; danach steigt es erst sanft und weiter außen kräftiger
    // (so fährt man leicht geradeaus und kommt trotzdem bis zum vollen Einschlag)
    const tot = 0.03;
    if (a < tot) return 0;
    const x = Math.min(1, (a - tot) / (1 - tot));
    return Math.sign(v) * x * (1 - FEIN + FEIN * x * x);
  }
  stufeSetzen(s) { this.stufe = Math.max(1, Math.min(VOLL.length, Math.round(s) || 3)); try { localStorage.setItem('rennspiel.empf2', this.stufe); } catch (e) {} return this.stufe; }
  stufeWeiter() { return this.stufeSetzen(this.stufe % VOLL.length + 1); }

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
    // Wie schräg steht die Bildschirm-Kante? (−90 … 90 Grad, fast egal wie flach das Gerät gehalten wird)
    // FLACH: Liegt das Gerät fast flach, zählt die Neigung etwas mehr (dort kippt man es eher, als es zu drehen)
    const w = Math.atan2(s[0], Math.hypot(s[1], FLACH * s[2])) * DEG;
    this.nick = Math.atan2(s[2], Math.hypot(s[0], s[1])) * DEG;
    // Mitte: so wie man das Gerät gerade hält (aber höchstens 25 Grad schief, sonst reicht der Weg zu einer Seite nicht)
    if (this.mitteSetzen) { this.mitte = Math.max(-25, Math.min(25, w)); this.mitteSetzen = false; this.winkel = 0; this.zeit = 0; }
    const d = w - this.mitte;
    // weich folgen statt springen (der Sensor zittert immer ein wenig)
    const jetzt = (e.timeStamp || performance.now()) / 1000;
    const dt = this.zeit ? Math.max(0, Math.min(0.1, jetzt - this.zeit)) : 0.016;
    this.zeit = jetzt;
    this.winkel += (d - this.winkel) * (1 - Math.exp(-dt / RUHE));
  }
}
