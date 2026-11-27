// Rennspiel – Motor, Reifen, Wind, Aufprall, Boxenstopp und Stimmen.
//
// Alle Aufnahmen im Ordner sounds/ sind mit 3D AI Studio erzeugt (Quellen in LIZENZEN.md, gebaut mit tools/klang_bau/).
// Solange sie noch laden – oder wenn sie fehlen – erzeugt der Browser die Töne selbst, so wie früher.
//
// Jedes Auto hat seinen eigenen Motor: zwei Schleifen, eine bei niedriger und eine bei hoher Drehzahl (sounds/motor/).
// Ein Motorgeräusch klingt höher, wenn der Motor schneller dreht. Deshalb spielen wir die Schleifen
// schneller oder langsamer ab (playbackRate) und blenden zwischen beiden weich über.
// Ein wenig vom selbst erzeugten Motor kommt dazu – der folgt der Drehzahl ganz genau.
// Selbst erzeugt: Ein Formel-Motor mit 6 Zylindern zündet 3-mal pro Umdrehung,
// bei 12.000 U/min sind das 600 Zündungen pro Sekunde.

// Welches Auto hat welchen Motor? Name des Autos (a.art) → Schleifen [niedrige Drehzahl, hohe Drehzahl].
// Die kleinen Autos haben einen Elektromotor: nur eine Schleife.
const M = name => ['sounds/motor/' + name + '_tief.wav', 'sounds/motor/' + name + '_hoch.wav'];
const MOTOREN = {
  f1: M('f1'),                     // Formel-Rennwagen: V6 mit Turbo, kreischt
  falkner: M('falkner'),           // Sechszylinder-Boxer mit zwei Turbos
  falkner_s: M('falkner_s'),       // Sechszylinder-Boxer ohne Turbo, heult metallisch
  taurino: M('taurino'),           // V12 ohne Turbo, schreit ganz hoch
  stallone: M('stallone'),         // V8, scharf und rau
  aurelion: M('aurelion'),         // W16 mit vier Turbos, tiefes Donnern
  nordvind: M('nordvind'),         // V8 mit zwei Turbos, brutal
  vento: M('vento'),               // V12 mit zwei Turbos, dunkel und weich
  sturmfalke: M('sturmfalke'),     // Rallye: kleiner Vierzylinder mit Turbo
  quadra: M('quadra'),             // Rallye: Fünfzylinder der 80er, jault
  kaiten: M('kaiten'),             // Rallye: Vierzylinder-Boxer, blubbert
  modell: ['sounds/motor/elektro.wav'],   // ferngesteuertes Auto
  drift: ['sounds/motor/elektro.wav'],    // Drift-Rallye
  slot: ['sounds/motor/slot.wav'],        // Slotcar: kleiner Motor, der schnarrt
};

// Welche Datei wofür? (einzelne Geräusche und Schleifen, die nicht zum Motor gehören)
const DATEIEN = {
  quietschen: 'sounds/reifen_quietschen.wav', // Schleife: rutschende Reifen auf Asphalt
  wind: 'sounds/wind.wav',                   // Schleife: Fahrtwind
  gras: 'sounds/gras.wav',                   // Schleife: Rumpeln neben der Strecke (Gras, Kies)
  schotter: 'sounds/schotter.wav',           // Schleife: Schotter unter den Reifen (Rallye)
  wasser: 'sounds/wasser.wav',               // Schleife: durch Wasser fahren (Rallye)
  rummsGross: 'sounds/aufprall_gross.mp3',   // harter Einschlag
  rummsKlein: 'sounds/aufprall_klein.mp3',   // leichter Stoß gegen Wand oder Auto
  plastik: 'sounds/aufprall_plastik.mp3',    // kleines Plastikauto knallt an
  landung: 'sounds/landung.mp3',             // Rallye: das Auto setzt nach einem Sprung auf
  schrauber: 'sounds/schlagschrauber.mp3',   // Boxenstopp: Räder ab und an
  turbo: 'sounds/turbo.mp3',                 // Turbo zündet
  ampel: 'sounds/ampel.mp3',                 // ein Licht der Startampel geht an, Startuhr zählt
  start: 'sounds/start.mp3',                 // Los!
  beste: 'sounds/bestzeit.mp3',              // Bestzeit: kleine Fanfare
  jubel: 'sounds/jubel.mp3',                 // Zuschauer jubeln im Ziel
};
// Rückfall für die Signale, solange die Aufnahme fehlt: ein Piepton [Tonhöhe in Hz, Dauer in s, Lautstärke]
const PIEP = { ampel: [440, 0.15, 0.2], zaehlen: [660, 0.15, 0.25], start: [1100, 0.45, 0.3], beste: [880, 0.25, 0.2] };
// So laut sind die Schleifen aus Aufnahmen im Vergleich zum selbst erzeugten Rauschen, das sie ersetzen
const LAUT_SCHLEIFE = { wind: 1.0, gras: 0.5, schotter: 0.6, wasser: 1.1 };

// Was der Streckensprecher sagen kann (sounds/stimme/sprecher/<name>.mp3). Was der Beifahrer sagen kann, steht in js/rallye.js.
export const SPRECHER_WORTE = ['los', 'letzte_runde', 'bestzeit', 'ziel', 'sieg', 'platz_2', 'platz_3', 'platz_4', 'platz_5', 'platz_6', 'platz_7', 'platz_8', 'platz_9', 'platz_10',
  'runde_ungueltig', 'tank_leer', 'aufgetankt', 'rausgeflogen', 'drift_verloren', 'super_turbo', 'mega_turbo'];

// Zahlen zum Einstellen (alle geschätzt)
const STIMME_LAUT = 1.0;  // Lautstärke der Stimmen (sie gehen am Hauptregler vorbei, damit man sie über dem Motor versteht)
const LUECKE = 0.03;      // Sekunden Pause zwischen zwei Aufnahmen in einem Satz
const LEISER = 0.55;      // so leise werden Motor und Reifen, solange jemand spricht
const TIEF_BEI = 0.38;    // die Schleife "niedrige Drehzahl" klingt richtig (Tempo 1) bei 38 % der höchsten Drehzahl des Autos
const HOCH_BEI = 0.86;    // die Schleife "hohe Drehzahl" klingt richtig bei 86 % der höchsten Drehzahl
const UEBERGANG = [0.5, 0.72];    // zwischen diesen Anteilen der höchsten Drehzahl wird von "niedrig" nach "hoch" überblendet
const HOCH_IMMER = 0.3;           // so viel von der hohen Schleife ist immer dabei (langsam abgespielt gibt sie dem tiefen Brummen Biss)
const LAUT_AUFNAHME = 0.9;        // Lautstärke der Motor-Aufnahmen
const LAUT_ELEKTRO = 0.55;        // Lautstärke des Elektromotors
const SYNTH_DAZU = { f1: 0.2 };   // so viel vom selbst erzeugten Motor kommt dazu (macht den Rennwagen "kreischender")
const SYNTH_SONST = 0.08;         // … und bei allen anderen Autos

export class Klang {
  constructor() {
    this.an = true; this.ctx = null; this.proben = {}; this.motoren = {}; this.worte = {}; this.geplant = []; this.stimmeFrei = 0;
    try { this.an = localStorage.getItem('rennspiel.ton') !== 'aus'; } catch (e) {}
  }

  // erst nach einem Fingertipp oder Klick erlaubt der Browser Töne
  wecken() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) { this.schlaeft = false; this.ctx.resume(); } return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.haupt = c.createGain(); this.haupt.gain.value = this.an ? 0.6 : 0; this.haupt.connect(c.destination);
    this.stimme = c.createGain(); this.stimme.gain.value = this.an ? STIMME_LAUT : 0; this.stimme.connect(c.destination);
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
    rausch().connect(wf); wf.connect(this.wind); this.wind.connect(this.haupt); this.windAlt = wf;
    this.rumpel = c.createGain(); this.rumpel.gain.value = 0;
    const kf = c.createBiquadFilter(); kf.type = 'lowpass'; kf.frequency.value = 140;
    rausch().connect(kf); kf.connect(this.rumpel); this.rumpel.connect(this.haupt); this.rumpelAlt = kf;
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
      ks.connect(hp); hp.connect(this.knirsch); this.knirsch.connect(this.haupt); this.knirschAlt = hp;
      // Wasser rauscht (tiefes, breites Rauschen)
      const wf2 = c.createBiquadFilter(); wf2.type = 'bandpass'; wf2.frequency.value = 700; wf2.Q.value = 0.5;
      this.platscher = c.createGain(); this.platscher.gain.value = 0;
      rausch().connect(wf2); wf2.connect(this.platscher); this.platscher.connect(this.haupt); this.platscherAlt = wf2;
    }
    this.ladeProben();
  }

  // Die Aufnahmen laden. Klappt es nicht, bleibt es bei den selbst erzeugten Tönen.
  async holen(url) {
    const antwort = await fetch(url);
    if (!antwort.ok) throw new Error('nicht da');
    const daten = await antwort.arrayBuffer();
    // ältere Safari kennen decodeAudioData nur mit Rückruf
    return new Promise((ok, fehler) => this.ctx.decodeAudioData(daten, ok, fehler));
  }

  async ladeProben() {
    this.motorA = this.baueAufnahmeMotor();
    this.gegnerA = this.baueAufnahmeMotor();
    if (this.wunsch) this.motorLaden(this.wunsch);
    if (this.stimmWunsch) this.stimmeLaden(...this.stimmWunsch);
    for (const [name, url] of Object.entries(DATEIEN)) {
      try { this.proben[name] = await this.holen(url); } catch (e) { console.warn('Ton fehlt:', url, e); }
    }
    if (this.proben.quietschen) this.quietsch = this.schleife('quietschen', this.haupt);
    // Wind, Rumpeln, Schotter und Wasser: Ist die Aufnahme da, ersetzt sie das selbst erzeugte Rauschen am selben Lautstärke-Regler
    for (const [name, regler, alt] of [['wind', this.wind, this.windAlt], ['gras', this.rumpel, this.rumpelAlt], ['schotter', this.knirsch, this.knirschAlt], ['wasser', this.platscher, this.platscherAlt]]) {
      if (!this.proben[name]) continue;
      alt.disconnect();
      const neu = this.schleife(name, regler); neu.g.gain.value = LAUT_SCHLEIFE[name];
      if (name === 'schotter') this.knirschQuelle = neu.s;
    }
  }

  // ---------------------------------------------------------------- Stimmen (Streckensprecher, Beifahrer)
  // Die Aufnahmen einer Stimme laden: ordner = 'sprecher' oder 'beifahrer', worte = Liste der Namen.
  stimmeLaden(ordner, worte) {
    this.stimmWunsch = [ordner, worte];
    if (!this.ctx) return;
    for (const w of worte) {
      const name = ordner + '/' + w;
      if (name in this.worte) continue;
      this.worte[name] = null;
      this.holen('sounds/stimme/' + name + '.mp3').then(b => { this.worte[name] = b; }).catch(() => { delete this.worte[name]; });
    }
  }

  // Einen Satz aus Aufnahmen sagen, z. B. sagen('beifahrer', ['links_3', 'und', 'rechts_kehre']).
  // Gibt false zurück, wenn eine Aufnahme fehlt (dann kann das Spiel die Stimme des Geräts nehmen).
  // Spricht gerade noch jemand, wartet der neue Satz. Wartet schon einer, wird der ersetzt – lieber einen Satz auslassen als zu spät sagen.
  sagen(ordner, teile, tempo = 1) {
    if (!this.ctx || !teile || !teile.length) return false;
    const puffer = teile.map(w => this.worte[ordner + '/' + w]);
    if (puffer.some(b => !b)) return false;
    if (!this.an) return true;
    const c = this.ctx, jetzt = c.currentTime;
    // was noch nicht angefangen hat, fällt weg
    this.geplant = this.geplant.filter(q => {
      if (q.ab > jetzt + 0.02) { try { q.s.stop(); } catch (e) {} if (q.erst) this.stimmeFrei = Math.min(this.stimmeFrei, q.ab); return false; }
      return q.bis > jetzt;
    });
    let t = Math.max(jetzt + 0.01, this.stimmeFrei);
    const anfang = t;
    puffer.forEach((b, k) => {
      const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = tempo; s.connect(this.stimme); s.start(t);
      const bis = t + b.duration / tempo;
      this.geplant.push({ s, ab: t, bis, erst: k === 0 });
      t = bis + LUECKE;
    });
    this.stimmeFrei = t;
    // Motor und Reifen werden etwas leiser, solange gesprochen wird
    const g = this.haupt.gain, voll = 0.6;
    g.cancelScheduledValues(jetzt);
    g.setTargetAtTime(voll * LEISER, anfang, 0.06);
    g.setTargetAtTime(voll, t, 0.25);
    return true;
  }

  // sofort still (Menü, neue Fahrt)
  schweigen() {
    for (const q of this.geplant) try { q.s.stop(); } catch (e) {}
    this.geplant = []; this.stimmeFrei = 0;
    if (this.haupt && this.an) { const t = this.ctx.currentTime; this.haupt.gain.cancelScheduledValues(t); this.haupt.gain.setTargetAtTime(0.6, t, 0.05); }
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

  // Die Motor-Schleifen eines Autos laden (nur einmal; art = Name des Autos, z. B. 'f1' oder 'taurino').
  // Das Spiel ruft das beim Start einer Fahrt für das eigene Auto. Die Motoren der Gegner kommen nach, wenn sie gebraucht werden.
  motorLaden(art) {
    this.wunsch = art;
    if (!this.ctx || !MOTOREN[art] || this.motoren[art]) return;
    const satz = this.motoren[art] = { da: false };
    Promise.all(MOTOREN[art].map(url => this.holen(url)))
      .then(([tief, hoch]) => { satz.tief = tief; satz.hoch = hoch || null; satz.da = true; })
      .catch(e => { satz.fehlt = true; console.warn('Motor fehlt:', art, e); });
  }

  // Ein Platz für einen Motor aus Aufnahmen: zwei Lautstärke-Regler (niedrige, hohe Drehzahl) hinter einem Filter.
  // Welche Schleifen darin laufen, steckt bestuecke hinein.
  baueAufnahmeMotor() {
    const c = this.ctx;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000; f.Q.value = 0.7;
    f.connect(this.haupt);
    const regler = () => { const g = c.createGain(); g.gain.value = 0; g.connect(f); return { g, s: null }; };
    return { f, tief: regler(), hoch: regler(), art: null };
  }

  // Die Schleifen eines Autos in einen Motor-Platz stecken. Gibt false zurück, solange sie noch nicht geladen sind.
  bestuecke(m, art) {
    if (m.art === art) return true;
    const satz = this.motoren[art];
    if (!satz) { this.motorLaden(art); this.wunsch = this.motorA && this.motorA.art || this.wunsch; }
    if (!satz || !satz.da) return false;
    const c = this.ctx;
    for (const [teil, puffer] of [[m.tief, satz.tief], [m.hoch, satz.hoch]]) {
      if (teil.s) { try { teil.s.stop(); } catch (e) {} teil.s.disconnect(); teil.s = null; }
      if (!puffer) continue;
      const s = teil.s = c.createBufferSource(); s.buffer = puffer; s.loop = true; s.connect(teil.g);
      // jede Schleife fängt an einer anderen Stelle an, damit eigenes Auto und Gegner nicht gleich klingen
      s.start(0, Math.random() * puffer.duration);
    }
    m.art = art;
    return true;
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
    for (const m of [this.motorA, this.gegnerA]) if (m) { aus(m.tief.g); aus(m.hoch.g); }
    if (this.quietsch) aus(this.quietsch.g);
    aus(this.reifen); aus(this.wind); aus(this.rumpel); aus(this.knirsch); aus(this.platscher);
  }

  // App im Hintergrund: Der Ton hält ganz an (sonst brummt der Motor weiter, während man telefoniert)
  schlafen() { this.ruhe(); this.schweigen(); this.schlaeft = true; if (this.ctx && this.ctx.state === 'running') try { this.ctx.suspend(); } catch (e) {} }
  aufwachen() { this.schlaeft = false; if (this.ctx && this.ctx.state === 'suspended') try { this.ctx.resume(); } catch (e) {} }

  schalten(an) {
    this.an = an;
    try { localStorage.setItem('rennspiel.ton', an ? 'an' : 'aus'); } catch (e) {}
    if (this.haupt) { this.haupt.gain.cancelScheduledValues(this.ctx.currentTime); this.haupt.gain.value = an ? 0.6 : 0; this.stimme.gain.value = an ? STIMME_LAUT : 0; }
  }

  // Einen Aufnahme-Motor auf Drehzahl, Gas und Lautstärke stellen.
  // modell = Elektromotor, laut = Gesamtlautstärke (0 = stumm).
  // Gibt false zurück, wenn die Aufnahmen dieses Autos (noch) nicht da sind – dann spielt der selbst erzeugte Motor.
  stelleAufnahme(m, a, modell, laut) {
    const t = this.ctx.currentTime, glatt = 0.05;
    const ziel = (sg, wert, zeit = 0.08) => sg.g.gain.setTargetAtTime(wert, t, zeit);
    const tempo = (sg, wert) => { if (sg.s) sg.s.playbackRate.setTargetAtTime(wert, t, glatt); };
    if (!this.bestuecke(m, MOTOREN[a.art] ? a.art : modell ? 'modell' : 'f1')) { ziel(m.tief, 0); ziel(m.hoch, 0); return false; }
    if (modell) {
      // Elektromotor: je schneller das Auto, desto höher das Surren
      // Mit Gängen (ferngesteuertes Auto, Drift-Rallye): Das Surren steigt in jedem Gang an und fällt beim Hochschalten
      // wieder ab – so hört man das Auto durch die Gänge schalten. Mit jedem Gang klingt es etwas höher.
      const dreh = a.p.gaenge > 1 ? Math.max(0, (a.drehzahl - 4500) / (a.p.drehzahlMax - 4500)) : 0;
      const v = a.p.gaenge > 1 ? Math.min(1.3, 0.12 + dreh * 0.62 + (a.gang - 1) / (a.p.gaenge - 1) * 0.3 + (a.turbo > 0 ? 0.15 : 0)) : Math.min(1.2, Math.abs(a.u) / a.p.vMax);
      tempo(m.tief, 0.55 + v * 1.6);
      m.f.frequency.setTargetAtTime(2500 + v * 6000, t, glatt);
      ziel(m.tief, laut * LAUT_ELEKTRO); ziel(m.hoch, 0);
      return true;
    }
    const dz = a.drehzahl, gas = a.gas || 0, max = a.p.drehzahlMax;
    // w: 0 = nur die Schleife "niedrige Drehzahl", 1 = nur "hohe Drehzahl". Ohne Gas klingt der Motor tiefer und dumpfer.
    const w = Math.min(1, Math.max(0, (dz / max - UEBERGANG[0]) / (UEBERGANG[1] - UEBERGANG[0]))) * (0.5 + 0.5 * gas);
    tempo(m.tief, Math.min(2.2, Math.max(0.5, dz / (max * TIEF_BEI))));
    tempo(m.hoch, Math.min(1.35, Math.max(0.4, dz / (max * HOCH_BEI))));
    // Gas gibt den hellen, lauten Klang; vom Gas gehen klingt dumpfer und leiser
    m.f.frequency.setTargetAtTime(1200 + gas * 7500 + dz / max * 2500, t, glatt);
    const druck = 0.4 + 0.6 * gas;
    ziel(m.tief, laut * LAUT_AUFNAHME * (1 - w) * 0.9);
    ziel(m.hoch, laut * LAUT_AUFNAHME * (HOCH_IMMER + (1 - HOCH_IMMER) * w) * druck);
    return true;
  }

  // jedes Bild: eigenes Auto, nächster Gegner (Abstand in m), Modellauto ja/nein
  update(a, gegner, modell, laeuft) {
    if (!this.ctx || !this.an) return;
    const t = this.ctx.currentTime, glatt = 0.05;
    const dz = a.drehzahl, gas = a.gas;
    const m = this.motor;
    // Aufnahmen da? Dann ist der selbst erzeugte Motor nur noch leise dabei (große Autos) oder still (kleine Autos)
    const aufnahme = !!this.motorA && this.stelleAufnahme(this.motorA, a, modell, modell ? (laeuft ? 0.35 + gas * 0.65 : 0) : (laeuft ? 1 : 0.15));
    if (aufnahme && modell) m.g.gain.setTargetAtTime(0, t, 0.1);
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
      m.g.gain.setTargetAtTime((laeuft ? 0.13 + gas * 0.2 : 0.05) * (aufnahme ? SYNTH_DAZU[a.art] ?? SYNTH_SONST : 1), t, 0.08);
    }
    // Gegner: der nächste Wagen, leiser je weiter weg
    const gm = this.gegner;
    const sc = modell ? 0.03 : 1;
    const gLaut = gegner && laeuft ? Math.min(0.12, 2.5 / (1 + (gegner.ab / sc) * 0.25)) * (modell ? 0.4 : 1) : 0;
    if (this.gegnerA && this.stelleAufnahme(this.gegnerA, gegner ? gegner.a : a, modell, gLaut * (modell ? 6 : 4))) {
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
      if (a.landung > 3 && !this.einmalNur('landung', 0.35 + Math.min(0.65, a.landung / 14))) this.rumms(Math.min(1, a.landung / 14), false);
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

  // wie einmal, aber nicht mehrmals in derselben Viertelsekunde (Landung, Jubel)
  einmalNur(name, laut = 1, tempo = 1) {
    if (!this.ctx || !this.an || !this.proben[name]) return false;
    const t = this.ctx.currentTime;
    this.zuletzt ||= {};
    if (t - (this.zuletzt[name] ?? -9) > 0.25) { this.zuletzt[name] = t; this.einmal(name, laut, tempo); }
    return true;
  }

  // Signal: 'ampel' (ein Licht geht an), 'zaehlen' (Startuhr der Rallye), 'start' (Los!), 'beste' (Bestzeit), 'jubel' (im Ziel).
  // Fehlt die Aufnahme, piept es wie früher.
  signal(art) {
    if (!this.ctx || !this.an) return;
    const laut = { ampel: 0.6, zaehlen: 0.6, start: 0.8, beste: 0.6, jubel: 0.7 }[art] ?? 0.6;
    if (this.einmal(art === 'zaehlen' ? 'ampel' : art, laut, art === 'zaehlen' ? 1.12 : 1)) return;
    if (PIEP[art]) this.piep(...PIEP[art]);
  }

  // kurzer Ton (Rückfall für die Signale)
  piep(f = 660, dauer = 0.18, laut = 0.25) {
    if (!this.ctx || !this.an) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f; o.type = 'sine';
    g.gain.setValueAtTime(laut, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dauer);
    o.connect(g); g.connect(this.haupt); o.start(); o.stop(c.currentTime + dauer + 0.02);
  }

  // Turbo zündet: ein Fauchen, das schnell ansteigt (Aufnahme, sonst selbst erzeugt). Je höher die Stufe, desto länger und heller.
  turbo(stufe = 1) {
    if (!this.ctx || !this.an) return;
    // Aufnahme: je höher die Stufe, desto lauter und etwas höher
    if (this.einmal('turbo', 0.45 + stufe * 0.15, 0.9 + stufe * 0.08)) return;
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
