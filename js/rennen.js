// Rennspiel – ein Rennen oder Zeitfahren: Startampel, Runden zählen, Zeiten, Plätze, Zusammenstöße
// (ohne three.js, auch in node testbar).

import { neuesAuto, schritt, aufStrecke } from './physik.js';
import { MASSSTAB } from './strecke.js';
import { slotStellen, slotSchritt, slotStoesse, slotFahren, slotPlan } from './slot.js';
import { boxNeu, verbrauch, boxDienst, boxFahrt, boxRel, reifenHalt } from './box.js';
import { ideallinie, neuerFahrer, fahren, bremsHilfe, lenkZurLinie } from './ki.js';
import { SUPERCARS, supercar } from './supercars.js';
import { Verkehr } from './verkehr.js';
import { turboFelder, turboSchritt } from './turbo.js';

// Ausgedachte Rennställe und Fahrer (keine echten Teams, Farben frei gewählt)
export const TEAMS = [
  { team: 'Falkenstein', farbe: 0x1e5bd8, zweit: 0xf2f2f2 },
  { team: 'Rotmilan', farbe: 0xd62a2a, zweit: 0x1b1b1b },
  { team: 'Polarstern', farbe: 0x18b6c9, zweit: 0x0e2a47 },
  { team: 'Vulkan', farbe: 0xf07a12, zweit: 0x222222 },
  { team: 'Smaragd', farbe: 0x14a05a, zweit: 0xf4d23c },
  { team: 'Nachtfalke', farbe: 0x3b2f7a, zweit: 0xe24fa8 },
  { team: 'Silberpfeil', farbe: 0xb9c0c8, zweit: 0x1aa0d8 },
  { team: 'Sonnenwind', farbe: 0xf4c519, zweit: 0x2a62c9 },
  { team: 'Kraken', farbe: 0x2a2a2e, zweit: 0x9be22d },
  { team: 'Korallenriff', farbe: 0xf0607a, zweit: 0xffffff },
];
export const FAHRER = ['Tom Kessler', 'Rafa Moretti', 'Jun Takeda', 'Aiden Cole', 'Luca Bernardi', 'Noah Lindqvist',
  'Emil Varga', 'Sami Okafor', 'Paul Renard', 'Ivo Petrov', 'Leo Hartmann'];

const DRIFT_AB = 12;   // ab so viel Grad Drift-Winkel zählt es als Drift
export const STAERKE = { leicht: [0.8, 0.86], mittel: [0.87, 0.93], schwer: [0.93, 0.985] };

export class Rennen {
  // modus: 'zeit' (allein gegen die Uhr) oder 'rennen'. art: 'f1', 'modell' oder 'slot'. tempo: Höchsttempo der kleinen Autos (m/s).
  // Supercars: art = 'super', auto = welches Supercar du fährst, lack = Farbe (Zahl oder null = Werksfarbe),
  // verkehr = wie viel Verkehr (0 = keiner, 1 = normal)
  constructor(T, { modus = 'rennen', runden = 3, gegner = 7, staerke = 'mittel', art = 'f1', spielerFarbe = 0, name = 'Du', mitSpieler = true, tempo = 0, boxen = false,
    auto = 'falkner', lack = null, verkehr = 0 } = {}) {
    this.T = T; this.modus = modus; this.runden = runden; this.art = art;
    this.super = art === 'super';
    // Welches Fahrzeug fährt wer? Bei den Supercars fahren die Gegner die anderen Modelle (reihum).
    const andereSuper = SUPERCARS.filter(s => s.id !== auto);
    const artVon = (ich, k) => !this.super ? art : ich ? supercar(auto).id : andereSuper[k % andereSuper.length].id;
    this.sc = T.sc;
    this.slot = art === 'slot';
    this.drift = art === 'drift';   // Drift-Rallye: es gibt Drift-Punkte (siehe driftZaehlen)
    // Turbo (ferngesteuertes Auto und Drift-Rallye): Drift-Turbo und Turbo-Felder auf der Bahn (siehe turbo.js)
    this.turbo = art === 'drift' || art === 'modell';
    this.felder = this.turbo ? turboFelder(T) : [];
    // Tanken und Reifenwechsel: nur bei den kleinen Autos, nur im Rennen, nur wenn die Strecke eine Boxengasse hat
    this.boxen = !!(boxen && T.box && modus === 'rennen');
    const muster = neuesAuto(this.super ? supercar(auto).id : art, tempo).p;
    // Verkehr auf den Straßen (nur Supercar-Strecken)
    this.verkehr = T.strasse && verkehr > 0 ? new Verkehr(T, { menge: verkehr, seed: T.n }) : null;
    this.L = this.slot ? null : ideallinie(T, muster, { rechts: !!this.verkehr });
    this.LS = this.L;        // Linie und Tempo-Plan für dich (im Fahrgefühl „echter“ ein vorsichtigerer Plan, siehe linieFuer in ki.js)
    this.LG = this.L;        // Linie und Tempo-Plan der Computerfahrer (im Fahrgefühl „echter“ derselbe vorsichtige Plan wie deiner – sonst hättest du keine Chance)
    this.plan = this.slot ? slotPlan(T, muster) : null;
    this.autos = [];
    this.zeit = 0;           // Sekunden seit dem Start (grünes Licht)
    this.uhr = 0;            // Sekunden seit dem Laden
    this.phase = modus === 'zeit' ? 'los' : 'ampel';
    this.ampel = 0;          // wie viele rote Lichter an sind (0 … 5)
    this.ampelAus = 5 + 0.4 + Math.random() * 1.2;
    this.hilfe = { bremsen: false, lenken: false };
    this.ereignisse = [];    // Meldungen für die Anzeige (Runde, Bestzeit, Ziel …)
    this.geistAlt = null;    // Bestrunde zum Hinterherfahren (Zeitfahren)

    const anzahl = modus === 'zeit' ? 0 : gegner;
    // (Ferngesteuertes Auto: Die Computerfahrer haben keinen Turbo und fahren etwas vorsichtiger – sonst wären sie mit der
    //  Arcade-Hilfe, die auch für sie gilt, selbst auf „leicht“ kaum zu schlagen)
    const [lo, hi] = (STAERKE[staerke] || STAERKE.mittel).map(v => v * (art === 'modell' ? 0.88 : 1));
    // Startaufstellung: hinter der Linie, versetzt links und rechts, alle 8 m (beim Modellauto passend kleiner)
    const reihe = 8 * this.sc, seite = Math.min(3, T.hb[0] * 0.45) * (this.sc === 1 ? 1 : 1 / 3);
    const slots = [];
    for (let k = 0; k <= anzahl; k++) slots.push(this.slot
      ? { s: T.laenge - 0.12 - Math.floor(k / 2) * 0.3, d: k % 2 ? -1 : 1 }      // Slotcar: zwei Spuren, immer zwei nebeneinander
      : { s: T.laenge - 6 * this.sc - k * reihe, d: (k % 2 ? -1 : 1) * (T.def.modell ? T.hb[0] * 0.45 : seite) });
    // Spieler startet in der Mitte des Feldes (Rennen) oder ein Stück vor der Linie (Zeitfahren)
    const meinPlatz = modus === 'zeit' ? -1 : Math.min(anzahl, Math.floor(anzahl * 0.6));
    const teams = TEAMS.filter((_, i) => i !== spielerFarbe);
    let k = 0;
    for (let platz = 0; platz <= anzahl; platz++) {
      if (!mitSpieler && platz === meinPlatz) continue;
      const ich = platz === meinPlatz || (modus === 'zeit' && platz === 0);
      const a = neuesAuto(artVon(ich, k), tempo);
      // Drift-Rallye: Die Computerfahrer fahren sauber auf Haftung (sie würden sich sonst dauernd drehen) – driften tust nur du
      if (this.drift && !ich) { a.p.hinten = 1; a.p.esp = { ...a.p.esp, beta: 0.15, nurWinkel: false }; }
      if (this.slot) { /* wird unten in die Spur gesetzt */ }
      else if (modus === 'zeit') aufStrecke(a, T, T.laenge - (T.def.modell ? 1.5 : 150), 0);
      else aufStrecke(a, T, slots[platz].s, slots[platz].d);
      let team = ich ? TEAMS[spielerFarbe] : teams[k % teams.length];
      if (this.super) { const sc0 = supercar(a.art); team = { team: sc0.name, farbe: ich && lack !== null ? lack : sc0.farbe, zweit: sc0.zweit }; }
      const st = lo + (hi - lo) * (anzahl > 1 ? (k / (anzahl - 1)) : 0.5);
      this.autos.push({
        a, ich, name: ich ? name : FAHRER[k % FAHRER.length], team: team.team, farbe: team.farbe, zweit: team.zweit,
        fahrer: ich ? null : neuerFahrer(st), nummer: ich ? 1 : 2 + k * 3 % 97,
        runde: 0, rundeStart: 0, letzte: null, beste: null, zeiten: [], ziel: null, gueltig: true, prevS: a.s || slots[platz]?.s || 0,
        fortschritt: 0, platz: 0, aus: 0,
      });
      if (this.slot) slotStellen(this.autos[this.autos.length - 1], T, modus === 'zeit' ? T.laenge - 1.5 : slots[platz].s, modus === 'zeit' ? 1 : slots[platz].d);
      if (!ich) k++;
    }
    for (const c of this.autos) { boxNeu(c); c.haft0 = c.a.p.haft; }
    for (const c of this.autos) { if (!this.slot) { const f = T.finde(c.a.x, c.a.z, -1); c.a.idx = f.i; c.a.s = f.s; } c.prevS = c.a.s; }
    this.ich = this.autos.find(c => c.ich) || null;
    this.geist = { punkte: [], takt: 0 };   // laufende Runde (Spieler) für einen neuen Geist
    this.bestProS = null;                   // Zeit je Abschnitt der besten Runde (für die Plus/Minus-Anzeige)
  }

  // stimme = Namen der Aufnahmen, die der Streckensprecher dazu sagt (sounds/stimme/sprecher/, siehe js/klang.js)
  melden(text, art = 'info', stimme = null) { this.ereignisse.push({ text, art, t: this.uhr, stimme }); }

  // ein Bild weiter. eingabe = { lenk −1…1 (plus = links), gas 0…1, brems 0…1 }
  update(dt, eingabe) {
    dt = Math.min(dt, 0.05);
    this.uhr += dt;
    const T = this.T;
    if (this.phase === 'ampel') {
      this.ampel = Math.min(5, Math.floor(this.uhr));
      if (this.uhr >= this.ampelAus) { this.phase = 'los'; this.ampel = 0; this.zeit = 0; this.melden('Los!', 'start', ['los']); }
    } else if (this.phase !== 'pause') this.zeit += dt;

    const steht = this.phase === 'ampel';
    // Alle, denen die Computerfahrer ausweichen: die anderen Rennautos und der Verkehr
    const andere = this.autos.map(c => c.a);
    if (this.verkehr) andere.push(...this.verkehr.autos);
    if (this.slot) { this.slotUpdate(dt, eingabe, steht); this.runden_zaehlen(); this.plaetze(); return; }
    let nr = 0;
    for (const c of this.autos) {
      const a = c.a;
      nr++;
      if (this.boxen && !steht) {
        this.boxUpdate(c, dt);
        a.p.haft = c.haft0 * reifenHalt(c);
        // Computerfahrer fährt wie auf einer Schiene durch die Boxengasse
        if (c.fahrer && (c.bf || (c.boxWill && c.ziel === null && boxRel(T, a.s) < 0.4))) { boxFahrt(c, T, dt, nr); continue; }
      }
      if (c.ich) {
        a.lenkWunsch = eingabe.lenk; a.gas = eingabe.gas; a.brems = eingabe.brems;
        // Handbremse: eigene Taste, oder Gas und Bremse gleichzeitig (so geht es auch mit dem Handy-Lenkrad und den Pedalen)
        const hand = !!(eingabe.hand || (eingabe.gas > 0.5 && eingabe.brems > 0.5));
        a.handbremse = this.drift && hand;
        // Ferngesteuertes Auto: Die „Handbremse“ wirft nur das Heck herum (Drift im Bild) – die Reifen halten weiter
        a.driftHand = this.art === 'modell' && hand;
        if (hand && this.turbo) a.brems = 0;
        if (this.hilfe.lenken) a.lenkWunsch = Math.max(-1, Math.min(1, eingabe.lenk * 0.6 + lenkZurLinie(a, T, this.L) * 0.55));
        c.hilfeBremst = this.hilfe.bremsen ? bremsHilfe(a, T, this.LS) : false;
        if (c.ziel !== null && this.modus === 'rennen') { fahren(c.auslauf || (c.auslauf = neuerFahrer(0.7)), a, T, this.LG, andere, dt); }
      } else if (c.fahrer) {
        fahren(c.fahrer, a, T, this.LG, andere, dt);
        if (c.ziel !== null) { a.gas = Math.min(a.gas, 0.5); }
      }
      if (this.boxen && c.sprit === 0) a.gas = Math.min(a.gas, 0.3);   // Tank leer: nur noch Schleichfahrt
      // vor dem Start stehen alle still (der Motor darf aber schon heulen)
      if (steht) { a.u = 0; a.v = 0; a.r = 0; a.drehzahl = 5000 + a.gas * 6000; continue; }
      schritt(a, T, dt);
      if (this.drift && c.ich && this.phase === 'los') this.driftZaehlen(c, dt);
      if (this.turbo && c.ich && this.phase === 'los') {
        const was = turboSchritt(a, c.tb || (c.tb = { ladung: 0, stufe: 0, ruhe: 0, zahl: 0 }), this.felder, T, dt);
        if (was === 'zuenden') this.melden(['', 'Turbo!', 'Super-Turbo!', 'Mega-Turbo!'][a.turboStufe], 'turbo', [null, null, ['super_turbo'], ['mega_turbo']][a.turboStufe]);
        else if (was === 'feld') this.melden('Turbo-Feld!', 'turbo');
      }
      // Computerfahrer, die festhängen (an der Mauer, im Kies), setzt ein Streckenposten zurück auf die Strecke
      if (c.fahrer && this.phase === 'los') {
        c.steckt = Math.abs(a.u) < 2 * this.sc ? (c.steckt || 0) + dt : 0;
        // auch wer zwar zappelt, aber nicht vorankommt (eingeklemmt zwischen Mauer und Verkehr), wird zurückgesetzt
        c.wegUhr = (c.wegUhr || 0) + dt;
        if (c.wegUhr > 5) { let w = a.s - (c.wegS ?? a.s); if (w < -T.laenge / 2) w += T.laenge; if (w < 15 * this.sc) c.steckt = 9; c.wegS = a.s; c.wegUhr = 0; }
        if (c.steckt > 3) { aufStrecke(a, T, a.s + (this.verkehr ? 12 : 1) * this.sc, this.L.off[a.idx] || 0); c.steckt = 0; c.wegS = a.s; c.wegUhr = 0; }
      }
    }
    this.zusammenstoesse();
    if (this.verkehr) {
      const rennerA = this.autos.map(c => c.a);
      this.verkehr.update(steht ? 0 : dt, rennerA);
      const hart = this.verkehr.stoesse(rennerA, this.ich ? this.ich.a : null);
      if (hart > 0.5) this.beruehrt = Math.max(this.beruehrt || 0, hart);
    }
    this.runden_zaehlen();
    this.plaetze();
  }

  // Drift-Punkte (wie beim Gymkhana): Solange das Auto quer rutscht, gibt es Punkte – je schräger und je schneller, desto mehr.
  // Hängt man Drifts ohne Pause aneinander, steigt der Faktor (x2, x3 … bis x5). Wer dabei in die Bande fährt, verliert den laufenden Drift.
  driftZaehlen(c, dt) {
    const a = c.a, D = c.drift || (c.drift = { laufend: 0, gesamt: 0, faktor: 1, bester: 0, ruhe: 0, winkel: 0, an: false, kette: 0 });
    const au = Math.abs(a.u);
    const winkel = au > 0.02 ? Math.abs(Math.atan2(a.v, au)) * 180 / Math.PI : 0;   // Drift-Winkel in Grad
    D.winkel = winkel;
    const kmhM = au * 3.6 / this.sc;                                                 // Tempo im Maßstab (km/h)
    const aufMatte = Math.abs(a.d) < this.T.hb[Math.max(0, a.idx)] + 0.02;
    if (a.stoss > 0.15 && D.an) {
      this.melden('Bande! Drift verloren', 'warn', ['drift_verloren']);
      D.laufend = 0; D.an = false; D.faktor = 1; D.ruhe = 0; D.kette = 0;
      return;
    }
    if (winkel > DRIFT_AB && kmhM > 40 && aufMatte && a.u > 0) {
      if (!D.an) { D.an = true; if (D.kette > 0) D.faktor = Math.min(5, D.faktor + 1); }
      D.ruhe = 0;
      D.laufend += dt * Math.min(winkel, 60) * kmhM / 20;
    } else if (D.an) {
      D.ruhe += dt;
      if (D.ruhe > 0.35) {
        // Drift vorbei: Punkte gutschreiben
        const p = Math.round(D.laufend * D.faktor);
        if (p >= 20) {
          D.gesamt += p; D.bester = Math.max(D.bester, p);
          this.melden('Drift +' + p + (D.faktor > 1 ? '  (x' + D.faktor + ')' : ''), p > 600 ? 'beste' : 'runde');
          D.kette = 1.2;   // so viele Sekunden hat man Zeit für den nächsten Drift, damit der Faktor steigt
        } else D.kette = 0;
        D.laufend = 0; D.an = false;
      }
    } else if (D.kette > 0) { D.kette -= dt; if (D.kette <= 0) D.faktor = 1; }
  }

  // Tank und Reifen eines Autos: verbrauchen, in der Box auffüllen, Computerfahrer entscheidet sich für einen Stopp
  boxUpdate(c, dt) {
    verbrauch(c, dt, this.T.laenge);
    const erg = boxDienst(c, this.T, dt);
    if (c.ich) {
      if (erg === 'fertig') this.melden('Aufgetankt, neue Reifen – los!', 'beste', ['aufgetankt']);
      if (c.sprit === 0 && !c.leerGemeldet) { c.leerGemeldet = true; this.melden('Tank leer! Ab in die Box', 'warn', ['tank_leer']); }
      if (c.sprit > 0.5) c.leerGemeldet = false;
    } else if (c.ziel === null && (c.sprit < 0.22 || c.reifen < 0.25) && c.runde <= this.runden) c.boxWill = true;
    if (c.fahrer) c.fahrer.mal = Math.sqrt(reifenHalt(c));
  }

  // Slotcar-Rennen: nur Gas und Spurwechsel
  slotUpdate(dt, eingabe, steht) {
    const T = this.T;
    for (const c of this.autos) {
      const a = c.a;
      if (this.boxen && !steht) this.boxUpdate(c, dt);
      else { c.sprit = 1; c.reifen = 1; }
      if (c.ich && !(c.ziel !== null && this.modus === 'rennen')) {
        a.gas = eingabe.gas; a.brems = eingabe.brems; a.lenkWunsch = eingabe.lenk; c.slot.wunsch = 0;
      } else {
        if (c.ich && !c.auslauf) c.auslauf = neuerFahrer(0.8);
        slotFahren(c, T, this.plan, this.autos, dt);
        if (c.ziel !== null) a.gas = Math.min(a.gas, 0.4);
      }
      if (steht) { a.u = 0; a.drehzahl = 2000 + a.gas * 9000; continue; }
      if (slotSchritt(c, T, dt, this.autos) === 'raus' && c.ich) this.melden('Zu schnell – rausgeflogen!', 'warn', ['rausgeflogen']);
    }
    const st = slotStoesse(this.autos, T);
    if (st > 0.3) this.beruehrt = Math.max(this.beruehrt || 0, st * 4);
  }

  zusammenstoesse() {
    const R = 1.05 * this.sc, halb = 1.55 * this.sc;
    const A = this.autos;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i].a, b = A[j].a;
      const dx0 = b.x - a.x, dz0 = b.z - a.z;
      if (dx0 * dx0 + dz0 * dz0 > (4 * halb) ** 2) continue;
      // jedes Auto als zwei Kreise (vorn und hinten)
      for (const ka of [-halb, halb]) for (const kb of [-halb, halb]) {
        const ax = a.x + Math.sin(a.h) * ka, az = a.z + Math.cos(a.h) * ka;
        const bx = b.x + Math.sin(b.h) * kb, bz = b.z + Math.cos(b.h) * kb;
        let dx = bx - ax, dz = bz - az; const d = Math.hypot(dx, dz);
        if (d >= 2 * R || d < 1e-6) continue;
        dx /= d; dz /= d;
        const tief = 2 * R - d;
        a.x -= dx * tief / 2; a.z -= dz * tief / 2; b.x += dx * tief / 2; b.z += dz * tief / 2;
        // Tempo in der Welt
        const wa = welt(a), wb = welt(b);
        const rel = (wb[0] - wa[0]) * dx + (wb[1] - wa[1]) * dz;
        if (rel < 0) {
          const st = -rel, imp = -rel * 0.6;   // etwas weniger als ganz elastisch
          wa[0] -= dx * imp; wa[1] -= dz * imp; wb[0] += dx * imp; wb[1] += dz * imp;
          zurueck(a, wa); zurueck(b, wb);
          a.r += (Math.random() - 0.5) * Math.min(1, -rel) * 0.5; b.r += (Math.random() - 0.5) * Math.min(1, -rel) * 0.5;
          if (A[i].ich || A[j].ich) this.beruehrt = Math.max(this.beruehrt || 0, st);
        }
      }
    }
  }

  runden_zaehlen() {
    const T = this.T, Lg = T.laenge;
    for (const c of this.autos) {
      const s = c.a.s;
      const vor = c.prevS > Lg * 0.75 && s < Lg * 0.25;
      const zurueckUeber = c.prevS < Lg * 0.25 && s > Lg * 0.75;
      // Strecke verlassen (alle vier Räder neben der Fahrbahn): Runde zählt im Zeitfahren nicht
      // (Drift-Matte: Wer quer rutscht, kommt weiter hinaus – erst ab der Mitte des Rand-Streifens zählt es)
      // Beim Formel-Rennwagen ist das abgeschaltet (Kristians Wunsch): Dort zählt jede Runde, auch mit einem Ausflug ins Gras.
      if (this.art !== 'f1' && !this.slot && !T.strasse && c.ich && this.modus === 'zeit' && c.runde > 0 && Math.abs(c.a.d) > T.hb[c.a.idx] + (this.drift ? 0.07 : 1.6 * this.sc + (T.kerbL[c.a.idx] || T.kerbR[c.a.idx] ? 1.2 * this.sc : 0))) {
        if (c.gueltig) this.melden('Strecke verlassen – Runde zählt nicht', 'warn', ['runde_ungueltig']);
        c.gueltig = false;
      }
      if (c.ich && this.modus === 'zeit' && c.runde > 0 && this.phase === 'los') this.geistAufnehmen(c);
      if (zurueckUeber) c.runde--;
      if (vor && this.phase === 'los') {
        if (c.runde >= 1 && c.ziel === null) {
          const t = this.zeit - c.rundeStart;
          c.letzte = t; c.zeiten.push({ t, gueltig: c.gueltig });
          const neu = c.gueltig && (c.beste === null || t < c.beste);
          if (neu) c.beste = t;
          if (c.ich) {
            this.melden((neu ? 'Bestzeit! ' : c.gueltig ? 'Runde ' : 'Ungültig: ') + zeitText(t), neu ? 'beste' : 'runde', neu && c.zeiten.length > 1 ? ['bestzeit'] : null);
            if (neu && this.modus === 'zeit') this.neuerGeist(c, t);
          }
        }
        c.runde++;
        if (c.runde === 1 && this.modus === 'zeit') this.zeit = 0;
        c.rundeStart = this.zeit; c.gueltig = true;
        if (c.ich && this.modus === 'zeit') this.geist = { punkte: [], takt: 0, proS: [] };
        if (this.modus === 'rennen' && c.runde > this.runden && c.ziel === null) {
          c.ziel = this.zeit;
          if (c.ich) { const platz = this.autos.filter(o => o.ziel !== null).length; this.melden('Ziel! Platz ' + platz, 'ziel', platz === 1 ? ['sieg'] : ['ziel', 'platz_' + platz]); }
          else if (!this.autos.some(o => o !== c && o.ziel !== null && o.ziel < c.ziel)) this.melden(c.name + ' gewinnt!', 'info');
        } else if (c.ich && this.modus === 'rennen' && c.runde === this.runden && c.ziel === null) this.melden('Letzte Runde!', 'runde', ['letzte_runde']);
      }
      c.prevS = s;
    }
    if (this.modus === 'rennen' && this.phase === 'los') {
      // Rennen vorbei: wenn du im Ziel bist und alle anderen auch (oder 25 s nach dir)
      const ich = this.ich;
      if (ich && ich.ziel !== null && this.autos.every(c => c.ziel !== null || this.zeit - ich.ziel > 25)) this.phase = 'fertig';
      if (!ich && this.autos.every(c => c.ziel !== null)) this.phase = 'fertig';
    }
  }

  plaetze() {
    const Lg = this.T.laenge;
    for (const c of this.autos) {
      let s = c.a.s; if (c.runde === 0 && s > Lg / 2) s -= Lg;
      c.fortschritt = c.ziel !== null ? 1e9 - c.ziel : (c.runde - (c.runde > 0 ? 1 : 0)) * Lg + s + (c.runde > 0 ? Lg : 0);
    }
    const sortiert = [...this.autos].sort((p, q) => q.fortschritt - p.fortschritt);
    sortiert.forEach((c, i) => c.platz = i + 1);
    this.reihenfolge = sortiert;
  }

  // Abstand zur Bestrunde an dieser Stelle (Sekunden, minus = schneller)
  abstand() {
    const c = this.ich;
    if (!c || !this.bestProS || c.runde < 1) return null;
    const k = Math.floor(c.a.s / (10 * this.sc));
    const ref = this.bestProS[k];
    if (ref === undefined) return null;
    return (this.zeit - c.rundeStart) - ref;
  }

  geistAufnehmen(c) {
    const g = this.geist;
    const t = this.zeit - c.rundeStart;
    if (!g.proS) g.proS = [];
    const k = Math.floor(c.a.s / (10 * this.sc));
    if (g.proS[k] === undefined && c.a.s < this.T.laenge * 0.98) g.proS[k] = t;
    if (t >= g.takt) {
      g.takt = t + 0.05;
      const a = c.a;
      g.punkte.push([+t.toFixed(3), +a.x.toFixed(3), +a.y.toFixed(3), +a.z.toFixed(3), +a.h.toFixed(4)]);
    }
  }
  neuerGeist(c, t) {
    this.geistAlt = { zeit: t, punkte: this.geist.punkte, proS: this.geist.proS || [] };
    this.bestProS = this.geistAlt.proS;
    if (this.wennBestzeit) this.wennBestzeit(this.geistAlt);
  }
  setzeGeist(g) { this.geistAlt = g; this.bestProS = g ? g.proS : null; if (this.ich && g) this.ich.beste = this.ich.beste ?? null; }

  // Wo der Geist gerade wäre (Zeitfahren): Zeit seit Rundenbeginn
  geistBei() {
    const g = this.geistAlt, c = this.ich;
    if (!g || !c || c.runde < 1) return null;
    const t = this.zeit - c.rundeStart, P = g.punkte;
    if (!P.length || t > P[P.length - 1][0]) return null;
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], f = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
    let dh = b[4] - a[4]; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    return { x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f, z: a[3] + (b[3] - a[3]) * f, h: a[4] + dh * f };
  }
}

function welt(a) { const sh = Math.sin(a.h), ch = Math.cos(a.h); return [sh * a.u + ch * a.v, ch * a.u - sh * a.v]; }
function zurueck(a, w) { const sh = Math.sin(a.h), ch = Math.cos(a.h); a.u = sh * w[0] + ch * w[1]; a.v = ch * w[0] - sh * w[1]; }

export function zeitText(t) {
  if (t === null || t === undefined || !isFinite(t)) return '–:––.–––';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
}
