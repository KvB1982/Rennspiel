// Rennspiel – Motor, Reifen, Wind und Aufprall, alles mit dem Browser selbst erzeugt (keine Tondateien).
//
// Ein Motorgeräusch besteht aus Schwingungen, deren Tonhöhe mit der Drehzahl steigt.
// Ein Formel-Motor mit 6 Zylindern zündet 3-mal pro Umdrehung: bei 12.000 U/min sind das 600 Zündungen pro Sekunde.
// Quietschende Reifen und Wind sind gefiltertes Rauschen.

export class Klang {
  constructor() { this.an = true; this.ctx = null; try { this.an = localStorage.getItem('rennspiel.ton') !== 'aus'; } catch (e) {} }

  // erst nach einem Fingertipp oder Klick erlaubt der Browser Töne
  wecken() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.haupt = c.createGain(); this.haupt.gain.value = this.an ? 0.6 : 0; this.haupt.connect(c.destination);
    // Motor: zwei Sägezahn-Schwingungen, durch einen "Verzerrer" und einen Filter
    this.motor = this.baueMotor(0.5);
    this.gegner = this.baueMotor(0);
    // Rauschen für Reifen und Wind
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const rausch = () => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    this.reifen = c.createGain(); this.reifen.gain.value = 0;
    const rf = c.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1100; rf.Q.value = 6;
    rausch().connect(rf); rf.connect(this.reifen); this.reifen.connect(this.haupt);
    this.wind = c.createGain(); this.wind.gain.value = 0;
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
    rausch().connect(wf); wf.connect(this.wind); this.wind.connect(this.haupt);
    this.rumpel = c.createGain(); this.rumpel.gain.value = 0;
    const kf = c.createBiquadFilter(); kf.type = 'lowpass'; kf.frequency.value = 140;
    rausch().connect(kf); kf.connect(this.rumpel); this.rumpel.connect(this.haupt);
  }

  baueMotor(laut) {
    const c = this.ctx;
    const o1 = c.createOscillator(), o2 = c.createOscillator(), o3 = c.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'square';
    const verz = c.createWaveShaper();
    const kurve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; kurve[i] = Math.tanh(x * 2.2); }
    verz.curve = kurve;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; f.Q.value = 2;
    const g = c.createGain(); g.gain.value = laut;
    const g3 = c.createGain(); g3.gain.value = 0.25;
    o1.connect(verz); o2.connect(verz); o3.connect(g3); g3.connect(verz); verz.connect(f); f.connect(g); g.connect(this.haupt);
    o1.start(); o2.start(); o3.start();
    return { o1, o2, o3, f, g };
  }

  schalten(an) {
    this.an = an;
    try { localStorage.setItem('rennspiel.ton', an ? 'an' : 'aus'); } catch (e) {}
    if (this.haupt) this.haupt.gain.value = an ? 0.6 : 0;
  }

  // jedes Bild: eigenes Auto, nächster Gegner (Abstand in m), Modellauto ja/nein
  update(a, gegner, modell, laeuft) {
    if (!this.ctx || !this.an) return;
    const t = this.ctx.currentTime, glatt = 0.05;
    const dz = a.drehzahl, gas = a.gas;
    const m = this.motor;
    if (modell) {
      // Elektromotor: hohes Surren
      const f = 120 + Math.abs(a.u) / a.p.vMax * 1500;
      m.o1.frequency.setTargetAtTime(f, t, glatt); m.o2.frequency.setTargetAtTime(f * 1.5, t, glatt); m.o3.frequency.setTargetAtTime(f * 0.5, t, glatt);
      m.f.frequency.setTargetAtTime(2500, t, glatt);
      m.g.gain.setTargetAtTime(laeuft ? 0.05 + gas * 0.1 : 0, t, 0.1);
    } else {
      const f = dz / 60 * 3 / 4;   // Grundton (eine Oktave tiefer klingt voller)
      m.o1.frequency.setTargetAtTime(f, t, glatt); m.o2.frequency.setTargetAtTime(f * 2.01, t, glatt); m.o3.frequency.setTargetAtTime(f * 0.5, t, glatt);
      m.f.frequency.setTargetAtTime(600 + gas * 2600 + dz * 0.1, t, glatt);
      m.g.gain.setTargetAtTime(laeuft ? 0.13 + gas * 0.2 : 0.05, t, 0.08);
    }
    // Gegner: der nächste Wagen, leiser je weiter weg
    const gm = this.gegner;
    if (gegner && laeuft) {
      const f = (modell ? 100 + Math.abs(gegner.a.u) / gegner.a.p.vMax * 1400 : gegner.a.drehzahl / 60 * 3 / 4);
      gm.o1.frequency.setTargetAtTime(f, t, glatt); gm.o2.frequency.setTargetAtTime(f * 2.02, t, glatt); gm.o3.frequency.setTargetAtTime(f * 0.5, t, glatt);
      gm.f.frequency.setTargetAtTime(modell ? 2000 : 1600, t, glatt);
      const sc = modell ? 0.03 : 1;
      gm.g.gain.setTargetAtTime(Math.min(0.12, 2.5 / (1 + (gegner.ab / sc) * 0.25)) * (modell ? 0.4 : 1), t, 0.1);
    } else gm.g.gain.setTargetAtTime(0, t, 0.1);
    const rutsch = Math.max(a.rutschVorn, a.rutschHinten) * Math.min(1, Math.abs(a.u) / (a.p.vMax * 0.1));
    this.reifen.gain.setTargetAtTime(laeuft && a.grund <= 1 ? rutsch * (modell ? 0.03 : 0.18) : 0, t, 0.05);
    const v = Math.abs(a.u) / a.p.vMax;
    this.wind.gain.setTargetAtTime(modell ? 0 : v * v * 0.25, t, 0.1);
    this.rumpel.gain.setTargetAtTime(laeuft && (a.grund === 1 || a.grund >= 2) ? Math.min(1, v * 3) * (a.grund === 1 ? 0.5 : 0.3) * (modell ? 0.2 : 1) : 0, t, 0.04);
  }

  // kurzer Ton (Startampel, Bestzeit)
  piep(f = 660, dauer = 0.18, laut = 0.25) {
    if (!this.ctx || !this.an) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f; o.type = 'sine';
    g.gain.setValueAtTime(laut, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dauer);
    o.connect(g); g.connect(this.haupt); o.start(); o.stop(c.currentTime + dauer + 0.02);
  }
  // dumpfer Schlag bei einem Aufprall
  rumms(staerke) {
    if (!this.ctx || !this.an) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(90, c.currentTime); o.frequency.exponentialRampToValueAtTime(35, c.currentTime + 0.25);
    g.gain.setValueAtTime(Math.min(0.8, staerke), c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
    o.connect(g); g.connect(this.haupt); o.start(); o.stop(c.currentTime + 0.32);
  }
}
