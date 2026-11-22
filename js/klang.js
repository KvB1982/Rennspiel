// Rennspiel – Motor, Reifen, Wind, Aufprall und Boxenstopp.
//
// Motor, Reifenquietschen, Aufprall und Schlagschrauber kommen aus echten Aufnahmen im Ordner sounds/
// (frei nutzbar, Quellen in LIZENZEN.md). Solange die noch laden – oder wenn sie fehlen –
// erzeugt der Browser die Töne selbst, so wie früher. Wind und Rumpeln auf Gras/Kies sind immer selbst erzeugt.
//
// Ein Motorgeräusch klingt höher, wenn der Motor schneller dreht. Deshalb spielen wir die Aufnahme
// schneller oder langsamer ab (playbackRate). Für den Rennwagen gibt es zwei Aufnahmen:
// niedrige und hohe Drehzahl (ein Straßenauto, schneller abgespielt). Dazwischen wird weich überblendet,
// und ein wenig vom selbst erzeugten Motor kommt dazu.
// Selbst erzeugt: Ein Formel-Motor mit 6 Zylindern zündet 3-mal pro Umdrehung,
// bei 12.000 U/min sind das 600 Zündungen pro Sekunde.

// Welche Datei wofür? (alle: Mono, 32.000 Messungen pro Sekunde)
const DATEIEN = {
  leerlauf: 'sounds/f1_leerlauf.wav',        // Schleife: Motor bei niedriger Drehzahl
  hoch: 'sounds/f1_hoch.wav',                // Schleife: Motor bei hoher Drehzahl
  elektro: 'sounds/elektromotor.wav',        // Schleife: kleiner Elektromotor (Modellauto, Slotcar)
  quietschen: 'sounds/reifen_quietschen.wav', // Schleife: rutschende Reifen
  rummsGross: 'sounds/aufprall_gross.wav',   // harter Einschlag
  rummsKlein: 'sounds/aufprall_klein.wav',   // leichter Stoß gegen Wand oder Auto
  plastik: 'sounds/aufprall_plastik.wav',    // kleines Plastikauto knallt an
  schrauber: 'sounds/schlagschrauber.wav',   // Boxenstopp: Räder ab und an
};

// Zahlen zum Einstellen
const DZ_LEER = 2600;     // bei dieser Drehzahl klingt die Leerlauf-Aufnahme "richtig" (Tempo 1)
const DZ_HOCH = 5200;     // bei dieser Drehzahl klingt die Hochdrehzahl-Aufnahme "richtig" (die Aufnahme ist ein Straßenauto,
                          // der Rennwagen dreht viel höher – deshalb wird sie bis gut doppelt so schnell abgespielt)
const UEBERGANG = [5000, 8000];   // zwischen diesen Drehzahlen wird von Leerlauf nach hoch überblendet
const LAUT_AUFNAHME = 0.9;        // Lautstärke der Motor-Aufnahmen (Rennwagen)
const LAUT_ELEKTRO = 0.55;        // Lautstärke des Elektromotors
const SYNTH_DAZU = 0.35;          // so viel vom selbst erzeugten Motor kommt beim Rennwagen dazu (macht ihn "kreischender")

export class Klang {
  constructor() {
    this.an = true; this.ctx = null; this.proben = {};
    try { this.an = localStorage.getItem('rennspiel.ton') !== 'aus'; } catch (e) {}
  }

  // erst nach einem Fingertipp oder Klick erlaubt der Browser Töne
  wecken() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.haupt = c.createGain(); this.haupt.gain.value = this.an ? 0.6 : 0; this.haupt.connect(c.destination);
    // Motor (selbst erzeugt): zwei Sägezahn-Schwingungen, durch einen "Verzerrer" und einen Filter
    // Beide Motoren fangen stumm an. Laut werden sie erst, wenn gefahren wird (update).
    // (Früher fing der eigene Motor laut an: Dann brummte im Menü nach dem ersten Klick ein Dauerton.)
    this.motor = this.baueMotor(0);
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
    // Rallye: Schotter knirscht. Selbst erzeugt: viele kleine "Klicks" (Steinchen) in zufälligen Abständen,
    // jeder klingt kurz aus. Je schneller das Auto, desto schneller wird die Schleife abgespielt (mehr Steinchen).
    {
      const n = c.sampleRate * 1.5, kb = c.createBuffer(1, n, c.sampleRate), kd = kb.getChannelData(0);
      let t = 0;
      while (t < n) {
        const laut = 0.2 + Math.random() * 0.8, lang = 40 + Math.random() * 260;
        for (let k = 0; k < lang && t + k < n; k++) kd[t + k] += (Math.random() * 2 - 1) * laut * Math.exp(-k / (lang * 0.25));
        t += Math.floor(30 + Math.random() * 380);
      }
      const ks = c.createBufferSource(); ks.buffer = kb; ks.loop = true; ks.start();
      const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2200; hp.Q.value = 0.6;
      this.knirsch = c.createGain(); this.knirsch.gain.value = 0; this.knirschQuelle = ks;
      ks.connect(hp); hp.connect(this.knirsch); this.knirsch.connect(this.haupt);
      // Wasser rauscht (tiefes, breites Rauschen)
      const wf2 = c.createBiquadFilter(); wf2.type = 'bandpass'; wf2.frequency.value = 700; wf2.Q.value = 0.5;
      this.platscher = c.createGain(); this.platscher.gain.value = 0;
      rausch().connect(wf2); wf2.connect(this.platscher); this.platscher.connect(this.haupt);
    }
    this.ladeProben();
  }

  // Die Aufnahmen laden. Klappt es nicht, bleibt es bei den selbst erzeugten Tönen.
  async ladeProben() {
    for (const [name, url] of Object.entries(DATEIEN)) {
      try {
        const daten = await (await fetch(url)).arrayBuffer();
        // ältere Safari kennen decodeAudioData nur mit Rückruf
        this.proben[name] = await new Promise((ok, fehler) => this.ctx.decodeAudioData(daten, ok, fehler));
      } catch (e) { console.warn('Ton fehlt:', url, e); }
    }
    // Sobald die Motor-Schleifen da sind: für eigenes Auto und Gegner je einen Satz bauen
    if (this.proben.leerlauf && this.proben.hoch && this.proben.elektro) {
      this.motorA = this.baueAufnahmeMotor();
      this.gegnerA = this.baueAufnahmeMotor();
    }
    if (this.proben.quietschen) this.quietsch = this.schleife('quietschen', this.haupt);
  }

  // Eine Aufnahme als Endlos-Schleife, zuerst stumm
  schleife(name, ziel) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.proben[name]; s.loop = true; g.gain.value = 0;
    s.connect(g); g.connect(ziel);
    // jede Schleife fängt an einer anderen Stelle an, damit eigenes Auto und Gegner nicht gleich klingen
    s.start(0, Math.random() * s.buffer.duration);
    return { s, g };
  }

  // Motor aus Aufnahmen: Leerlauf + hoch (Rennwagen) und Elektromotor, alles durch einen Filter
  baueAufnahmeMotor() {
    const c = this.ctx;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000; f.Q.value = 0.7;
    f.connect(this.haupt);
    return { f, leer: this.schleife('leerlauf', f), hoch: this.schleife('hoch', f), elektro: this.schleife('elektro', f) };
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

  // Alles still: Motoren, Reifen, Wind, Rumpeln. Für das Menü, dort fährt ja niemand.
  ruhe() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const aus = g => { if (g) g.gain.setTargetAtTime(0, t, 0.05); };
    aus(this.motor.g); aus(this.gegner.g);
    for (const m of [this.motorA, this.gegnerA]) if (m) { aus(m.leer.g); aus(m.hoch.g); aus(m.elektro.g); }
    if (this.quietsch) aus(this.quietsch.g);
    aus(this.reifen); aus(this.wind); aus(this.rumpel); aus(this.knirsch); aus(this.platscher);
  }

  schalten(an) {
    this.an = an;
    try { localStorage.setItem('rennspiel.ton', an ? 'an' : 'aus'); } catch (e) {}
    if (this.haupt) this.haupt.gain.value = an ? 0.6 : 0;
  }

  // Einen Aufnahme-Motor auf Drehzahl, Gas und Lautstärke stellen.
  // modell = Elektromotor, laut = Gesamtlautstärke (0 = stumm)
  stelleAufnahme(m, a, modell, laut) {
    const t = this.ctx.currentTime, glatt = 0.05;
    const ziel = (sg, wert, zeit = 0.08) => sg.g.gain.setTargetAtTime(wert, t, zeit);
    if (modell) {
      // Elektromotor: je schneller das Auto, desto höher das Surren
      // Mit Gängen (ferngesteuertes Auto, Drift-Rallye): Das Surren steigt in jedem Gang an und fällt beim Hochschalten
      // wieder ab – so hört man das Auto durch die Gänge schalten. Mit jedem Gang klingt es etwas höher.
      const dreh = a.p.gaenge > 1 ? Math.max(0, (a.drehzahl - 4500) / (a.p.drehzahlMax - 4500)) : 0;
      const v = a.p.gaenge > 1 ? Math.min(1.3, 0.12 + dreh * 0.62 + (a.gang - 1) / (a.p.gaenge - 1) * 0.3 + (a.turbo > 0 ? 0.15 : 0)) : Math.min(1.2, Math.abs(a.u) / a.p.vMax);
      m.elektro.s.playbackRate.setTargetAtTime(0.55 + v * 1.6, t, glatt);
      m.f.frequency.setTargetAtTime(2500 + v * 6000, t, glatt);
      ziel(m.elektro, laut * LAUT_ELEKTRO); ziel(m.leer, 0); ziel(m.hoch, 0);
      return;
    }
    const dz = a.drehzahl, gas = a.gas || 0;
    const w = Math.min(1, Math.max(0, (dz - UEBERGANG[0]) / (UEBERGANG[1] - UEBERGANG[0])));
    m.leer.s.playbackRate.setTargetAtTime(Math.min(2.4, Math.max(0.8, dz / DZ_LEER)), t, glatt);
    m.hoch.s.playbackRate.setTargetAtTime(Math.min(2.6, Math.max(0.6, dz / DZ_HOCH)), t, glatt);
    // Gas gibt den hellen, lauten Klang; vom Gas gehen klingt dumpfer und leiser
    m.f.frequency.setTargetAtTime(900 + gas * 7000 + dz * 0.25, t, glatt);
    const druck = 0.35 + 0.65 * gas;
    ziel(m.leer, laut * LAUT_AUFNAHME * (1 - w) * 0.8);
    ziel(m.hoch, laut * LAUT_AUFNAHME * w * druck);
    ziel(m.elektro, 0);
  }

  // jedes Bild: eigenes Auto, nächster Gegner (Abstand in m), Modellauto ja/nein
  update(a, gegner, modell, laeuft) {
    if (!this.ctx || !this.an) return;
    const t = this.ctx.currentTime, glatt = 0.05;
    const dz = a.drehzahl, gas = a.gas;
    const m = this.motor;
    const aufnahme = !!this.motorA;     // Aufnahmen da? Dann ist der selbst erzeugte Motor nur noch leise dabei (Rennwagen) oder still (kleine Autos)
    if (aufnahme) {
      this.stelleAufnahme(this.motorA, a, modell, modell ? (laeuft ? 0.35 + gas * 0.65 : 0) : (laeuft ? 1 : 0.15));
      if (modell) m.g.gain.setTargetAtTime(0, t, 0.1);
    }
    if (aufnahme && modell) {
      // nichts weiter: der Elektromotor kommt nur aus der Aufnahme
    } else if (modell) {
      // Elektromotor: hohes Surren
      const f = 120 + Math.abs(a.u) / a.p.vMax * 1500;
      m.o1.frequency.setTargetAtTime(f, t, glatt); m.o2.frequency.setTargetAtTime(f * 1.5, t, glatt); m.o3.frequency.setTargetAtTime(f * 0.5, t, glatt);
      m.f.frequency.setTargetAtTime(2500, t, glatt);
      m.g.gain.setTargetAtTime(laeuft ? 0.05 + gas * 0.1 : 0, t, 0.1);
    } else {
      const f = dz / 60 * 3 / 4;   // Grundton (eine Oktave tiefer klingt voller)
      m.o1.frequency.setTargetAtTime(f, t, glatt); m.o2.frequency.setTargetAtTime(f * 2.01, t, glatt); m.o3.frequency.setTargetAtTime(f * 0.5, t, glatt);
      m.f.frequency.setTargetAtTime(600 + gas * 2600 + dz * 0.1, t, glatt);
      m.g.gain.setTargetAtTime((laeuft ? 0.13 + gas * 0.2 : 0.05) * (aufnahme ? SYNTH_DAZU : 1), t, 0.08);
    }
    // Gegner: der nächste Wagen, leiser je weiter weg
    const gm = this.gegner;
    const sc = modell ? 0.03 : 1;
    const gLaut = gegner && laeuft ? Math.min(0.12, 2.5 / (1 + (gegner.ab / sc) * 0.25)) * (modell ? 0.4 : 1) : 0;
    if (aufnahme) {
      this.stelleAufnahme(this.gegnerA, gegner ? gegner.a : a, modell, gLaut * (modell ? 6 : 4));
      gm.g.gain.setTargetAtTime(0, t, 0.1);
    } else if (gegner && laeuft) {
      const f = (modell ? 100 + Math.abs(gegner.a.u) / gegner.a.p.vMax * 1400 : gegner.a.drehzahl / 60 * 3 / 4);
      gm.o1.frequency.setTargetAtTime(f, t, glatt); gm.o2.frequency.setTargetAtTime(f * 2.02, t, glatt); gm.o3.frequency.setTargetAtTime(f * 0.5, t, glatt);
      gm.f.frequency.setTargetAtTime(modell ? 2000 : 1600, t, glatt);
      gm.g.gain.setTargetAtTime(gLaut, t, 0.1);
    } else gm.g.gain.setTargetAtTime(0, t, 0.1);
    // Reifen: rutschen = quietschen (Aufnahme, sonst gefiltertes Rauschen)
    const rutsch = Math.max(a.rutschVorn, a.rutschHinten) * Math.min(1, Math.abs(a.u) / (a.p.vMax * 0.1));
    const quietschtJetzt = laeuft && a.grund <= 1 ? rutsch : 0;
    if (this.quietsch) {
      // kleine Reifen quietschen höher und leiser
      this.quietsch.s.playbackRate.setTargetAtTime((modell ? 1.7 : 0.9) + Math.min(0.3, rutsch * 0.3), t, glatt);
      this.quietsch.g.gain.setTargetAtTime(Math.min(1, quietschtJetzt * 1.5) * (modell ? 0.08 : 0.45), t, 0.05);
      this.reifen.gain.setTargetAtTime(0, t, 0.05);
    } else this.reifen.gain.setTargetAtTime(quietschtJetzt * (modell ? 0.03 : 0.18), t, 0.05);
    const v = Math.abs(a.u) / a.p.vMax;
    this.wind.gain.setTargetAtTime(modell ? 0 : v * v * 0.25, t, 0.1);
    this.rumpel.gain.setTargetAtTime(laeuft && (a.grund === 1 || a.grund >= 2) ? Math.min(1, v * 3) * (a.grund === 1 ? 0.5 : 0.3) * (modell ? 0.2 : 1) : 0, t, 0.04);
    // Rallye: Schotter knirscht, Matsch schmatzt dumpfer, Wasser rauscht. In der Luft: Stille unter dem Auto
    if (this.knirsch) {
      const boden = laeuft && !a.luft && a.p.rallye;
      const kies = boden && (a.grund === 5 || a.grund === 3) ? 1 : boden && a.grund === 6 ? 0.55 : boden && a.grund === 2 ? 0.35 : 0;
      const rutschen = Math.max(a.rutschVorn || 0, a.rutschHinten || 0);
      this.knirsch.gain.setTargetAtTime(kies * Math.min(1, v * 2.5) * (0.28 + rutschen * 0.4), t, 0.05);
      this.knirschQuelle.playbackRate.setTargetAtTime(0.6 + Math.min(1.6, Math.abs(a.u) / 25), t, 0.1);
      this.platscher.gain.setTargetAtTime(boden && a.grund === 7 ? Math.min(0.9, v * 2) : 0, t, 0.03);
      // Landung nach einem Sprung
      if (a.landung > 3) this.rumms(Math.min(1, a.landung / 14), false);
    }
  }

  // Eine Aufnahme einmal abspielen. Gibt false zurück, wenn sie (noch) nicht da ist.
  einmal(name, laut = 1, tempo = 1, wann = 0) {
    const b = this.proben[name];
    if (!b) return false;
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; s.playbackRate.value = tempo; g.gain.value = laut;
    s.connect(g); g.connect(this.haupt); s.start(c.currentTime + wann);
    return true;
  }

  // kurzer Ton (Startampel, Bestzeit)
  piep(f = 660, dauer = 0.18, laut = 0.25) {
    if (!this.ctx || !this.an) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f; o.type = 'sine';
    g.gain.setValueAtTime(laut, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dauer);
    o.connect(g); g.connect(this.haupt); o.start(); o.stop(c.currentTime + dauer + 0.02);
  }

  // Turbo zündet: ein Fauchen, das schnell ansteigt (selbst erzeugt). Je höher die Stufe, desto länger und heller.
  turbo(stufe = 1) {
    if (!this.ctx || !this.an) return;
    const c = this.ctx, t = c.currentTime, dauer = 0.35 + stufe * 0.2;
    // Rauschen durch einen Filter, der nach oben fährt
    const n = Math.floor(c.sampleRate * dauer), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const q = c.createBufferSource(); q.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600 + stufe * 900, t + dauer * 0.7);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
    q.connect(f); f.connect(g); g.connect(this.haupt); q.start(t);
    // dazu ein Ton, der hochzieht
    const o = c.createOscillator(), g2 = c.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(700 + stufe * 250, t + dauer * 0.8);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.12, t + 0.04); g2.gain.exponentialRampToValueAtTime(0.001, t + dauer);
    o.connect(g2); g2.connect(this.haupt); o.start(t); o.stop(t + dauer + 0.05);
  }

  // Aufprall: staerke 0…1. Kleine Autos klingen nach Plastik, der Rennwagen nach Blech und Kohlefaser.
  rumms(staerke, modell = false) {
    if (!this.ctx || !this.an) return;
    const s = Math.min(1, staerke), zufall = 0.9 + Math.random() * 0.2;
    if (this.jetztRumms && this.ctx.currentTime - this.jetztRumms < 0.12) return;   // nicht 60-mal pro Sekunde
    this.jetztRumms = this.ctx.currentTime;
    if (modell ? this.einmal('plastik', 0.3 + s * 0.7, zufall * (1.25 - s * 0.3))
      : this.einmal(s > 0.45 ? 'rummsGross' : 'rummsKlein', 0.25 + s * 0.75, zufall)) return;
    // Rückfall: dumpfer Schlag, selbst erzeugt
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(90, c.currentTime); o.frequency.exponentialRampToValueAtTime(35, c.currentTime + 0.25);
    g.gain.setValueAtTime(Math.min(0.8, staerke), c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
    o.connect(g); g.connect(this.haupt); o.start(); o.stop(c.currentTime + 0.32);
  }

  // Boxenstopp beginnt: Schlagschrauber – Räder ab, kurz warten, Räder wieder an
  box(modell) {
    if (!this.ctx || !this.an) return;
    const tempo = modell ? 1.5 : 1, laut = modell ? 0.35 : 0.7;
    if (this.einmal('schrauber', laut, tempo, 0)) { this.einmal('schrauber', laut, tempo * 1.05, 1.1); return; }
    this.piep(1500, 0.12, 0.15);
  }
}
