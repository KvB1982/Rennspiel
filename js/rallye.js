// Rennspiel – Rallye: eine Wertungsprüfung (WP) gegen die Uhr (ohne three.js, auch in node testbar).
//
// So läuft eine echte Wertungsprüfung ab:
//   1. Start: Das Auto steht an der Startlinie. Eine Uhr zählt herunter (5, 4, 3, 2, 1) – bei null geht es los.
//   2. Zwischenzeiten: An zwei Stellen wird die Zeit gemessen. So siehst du, ob du schneller oder langsamer bist als die anderen.
//   3. Fliegendes Ziel: Die Zeit stoppt, wenn du mit vollem Tempo durch das Ziel fährst.
//   4. Stopp: Ein Stück danach hältst du am Stopp-Schild an.
// Die anderen Fahrer starten in echt im Abstand von ein, zwei Minuten – man sieht sie nie. Deshalb fährst du hier
// allein; die Zeiten der anderen rechnet das Spiel aus (siehe planZeiten).
//
// Der Beifahrer liest den "Aufschrieb" vor (englisch: pacenotes): Richtung und Schärfe jeder Kurve (1 = Kehre, ganz eng,
// … 6 = fast gerade), dazu Kuppen, Sprünge, Wasser und Warnungen wie "nicht schneiden". ansagenBauen schreibt ihn
// aus der Form der Strecke.

import { neuesAuto, schritt, aufStrecke } from './physik.js';
import { BELAG } from './strecke.js';
import { ideallinie, bremsHilfe, lenkZurLinie } from './ki.js';
import { rallyeauto, RALLYEAUTOS } from './rallyeautos.js';

export const COUNTDOWN = 5;            // Sekunden auf der Startuhr
export const ZIEL_VOR = 300;           // so viele Meter vor der Startlinie liegt das fliegende Ziel
export const STOPP_VOR = 120;          // und hier das Stopp-Schild
export const ZWISCHEN = [0.34, 0.68];  // Zwischenzeiten (Anteil der Prüfung)
export const STRAFE = 5;               // Sekunden Strafe fürs Zurücksetzen auf den Weg
const STECKT_ZEIT = 3;                 // so lange darf das Auto neben dem Weg feststecken, dann wird es zurückgesetzt
const G = 9.81;

// Halt auf dem Untergrund (wie in physik.js) – für den Tempo-Plan der anderen Fahrer
const HALT = { [BELAG.asphalt]: 1, [BELAG.schotter]: 0.74, [BELAG.matsch]: 0.56, [BELAG.wasser]: 0.6 };

// Die anderen Fahrer (ausgedacht). faktor = wie viel langsamer als der Tempo-Plan (1 = genau der Plan)
const NAMEN = ['Aino Virtala', 'Bastien Lacombe', 'Tõnis Vaher', 'Kalle Rautio', 'Rhys Glanmor', 'Mathis Ferrand',
  'Iker Basaldua', 'Jari Kalliola', 'Henrik Øvregård', 'Fergus McAlden', 'Konrad Haberl', 'Odile Marchetti'];
export const STAERKE_RALLYE = { leicht: [1.03, 1.35], mittel: [0.9, 1.15], schwer: [0.83, 0.98] };   // geschätzt: Mit der Arcade-Hilfe ist man oft schneller als der Plan, deshalb sind die Gegner auf „mittel“ schon nah dran

// fester Zufall aus einem Text (gleiche Zeiten bei jedem Start)
function zufallAus(text) {
  let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function rivalen(staerke = 'mittel', anzahl = 9) {
  const [lo, hi] = STAERKE_RALLYE[staerke] || STAERKE_RALLYE.mittel;
  const r = zufallAus('rivalen' + staerke);
  return NAMEN.slice(0, anzahl).map((name, k) => ({
    name, auto: RALLYEAUTOS[k % RALLYEAUTOS.length].id, nummer: 2 + k,
    faktor: lo + (hi - lo) * (k / (anzahl - 1)) + (r() - 0.5) * 0.01,
  }));
}

// ---------------------------------------------------------------- Tempo-Plan und Zeiten der anderen
// Wie schnell geht es an jeder Stelle höchstens (Kurve, Untergrund), wo muss man bremsen, wie lange braucht man?
// Gibt für jeden Messpunkt die Zeit seit dem Start zurück (stehender Start bei s = 0).
export function planZeiten(T, L, p) {
  const n = T.n, ds = T.ds;
  const q = 0.5 * 1.2 * p.abtrieb / p.masse, wid = 0.5 * 1.2 * p.widerstand / p.masse;
  const mu = i => p.haft * 0.9 * (HALT[T.belag[i]] ?? 1);
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = L.kr[i], nenner = k - mu(i) * q;
    v[i] = nenner <= 0 ? p.vMax : Math.min(p.vMax, Math.sqrt(mu(i) * G / nenner));
    if (T.belag[i] === BELAG.wasser) v[i] = Math.min(v[i], 18);
  }
  for (let k = n - 2; k >= 0; k--) {
    const brems = mu(k) * (G + q * v[k + 1] ** 2) * p.bremse * (p.bremsGriff || 1) * 0.8 + wid * v[k + 1] ** 2;
    v[k] = Math.min(v[k], Math.sqrt(v[k + 1] ** 2 + 2 * brems * ds));
  }
  v[0] = 0;
  for (let k = 0; k < n - 1; k++) {
    const vi = Math.max(v[k], 1);
    const zug = Math.min(p.leistung / (p.masse * vi) * (p.schub || 1), p.schubMax / p.masse * (p.schub || 1), mu(k) * G * 0.75 * Math.min(p.zugGriff || 1, 1.3)) - wid * vi * vi;
    v[k + 1] = Math.min(v[k + 1], Math.sqrt(Math.max(1, v[k] ** 2 + 2 * Math.max(0, zug) * ds)));
  }
  const t = new Float32Array(n);
  for (let k = 1; k < n; k++) t[k] = t[k - 1] + (T.s[k] - T.s[k - 1]) / Math.max(1, (v[k] + v[k - 1]) / 2);
  return { v, t };
}
const zeitBei = (T, plan, s) => plan.t[Math.min(T.n - 1, Math.max(0, Math.floor(s / T.laenge * T.n)))];

// ---------------------------------------------------------------- Aufschrieb des Beifahrers
const ZAHL = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs'];
const WEITE = { 50: 'fünfzig', 100: 'hundert', 150: 'hundertfünfzig', 200: 'zweihundert', 250: 'zweihundertfünfzig', 300: 'dreihundert', 400: 'vierhundert', 500: 'fünfhundert' };

// Liefert eine Liste von Ansagen [{ s, bis, art, seite, grad, zusatz: [], text, sprache, weiter }] (s = Meter ab Start)
export function ansagenBauen(T, plan) {
  const n = T.n, ds = T.ds, L = T.laenge;
  // Krümmung etwas glätten (±8 m), damit kleine Schlenker keine eigenen Kurven werden
  const w = Math.max(1, Math.round(8 / ds)), k = new Float32Array(n);
  for (let i = 0; i < n; i++) { let a = 0; for (let j = -w; j <= w; j++) a += T.k[(i + j + n) % n]; k[i] = a / (2 * w + 1); }
  const ende = L - ZIEL_VOR + 40;
  const notizen = [];
  // 1. Kurven: zusammenhängende Stücke mit Krümmung in dieselbe Richtung
  let i = 0;
  while (i < n) {
    if (Math.abs(k[i]) < 1 / 320 || T.s[i] > ende) { i++; continue; }
    const sg = Math.sign(k[i]); let j = i, luecke = 0, last = i;
    while (j < n - 1 && luecke < Math.round(14 / ds)) { j++; if (Math.sign(k[j]) === sg && Math.abs(k[j]) >= 1 / 320) { luecke = 0; last = j; } else luecke++; }
    let winkel = 0, kmax = 0, kVorn = 0, kHinten = 0;
    const len = last - i + 1;
    for (let m = i; m <= last; m++) {
      winkel += k[m] * ds; kmax = Math.max(kmax, Math.abs(k[m]));
      if (m < i + len / 3) kVorn = Math.max(kVorn, Math.abs(k[m])); if (m > last - len / 3) kHinten = Math.max(kHinten, Math.abs(k[m]));
    }
    const grad = Math.abs(winkel) * 180 / Math.PI, r = 1 / kmax;
    if (grad >= 18) {
      const stufe = r <= 20 ? 1 : r <= 32 ? 2 : r <= 50 ? 3 : r <= 80 ? 4 : r <= 135 ? 5 : 6;
      if (!(stufe === 6 && grad < 30)) {
        const zusatz = [];
        if (stufe === 1 && grad > 110) zusatz.push('kehre');
        if ((T.s[last] - T.s[i] > 70 && grad > 70 && stufe >= 3) || grad > 160) zusatz.push('lang');
        if (kHinten > kVorn * 1.45 && stufe >= 2) zusatz.push('enger');
        else if (kVorn > kHinten * 1.45 && stufe >= 2) zusatz.push('oeffnet');
        // Scheitel: wo die Kurve am engsten ist
        let sch = i; for (let m = i; m <= last; m++) if (Math.abs(k[m]) > Math.abs(k[sch])) sch = m;
        // vorher viel schneller als in der Kurve? Dann warnt der Beifahrer
        const vor = Math.round(120 / ds), vVor = plan.v[Math.max(0, i - vor)], vIn = plan.v[sch];
        const achtung = vVor - vIn > 20 && stufe <= 3;
        // "nicht schneiden": In manchen engen Kurven liegt innen ein Felsbrocken (die Landschaft stellt ihn genau dorthin)
        const fels = stufe <= 4 && ((sch * 2654435761) >>> 0) % 100 < 35;
        if (fels) zusatz.push('nichtSchneiden');
        notizen.push({ s: T.s[i], bis: T.s[last], scheitel: sch, art: 'kurve', seite: sg > 0 ? 'links' : 'rechts', grad: stufe, winkel: grad, zusatz, achtung, fels });
      }
    }
    i = last + 1;
  }
  // 2. Kuppen und Sprünge: wo die Straße oben rund ist (negative Krümmung nach oben)
  for (let m = 2; m < n - 2; m++) {
    const kv = -T.kv[m];
    if (kv < 0.006 || kv < -T.kv[m - 1] || kv < -T.kv[m + 1] || T.s[m] > ende) continue;
    const v = plan.v[m], hebt = kv * v * v / G;
    const art = hebt > 1.05 ? 'sprung' : kv > 0.009 ? 'kuppe' : null;
    if (!art) continue;
    notizen.push({ s: T.s[m] - 12, bis: T.s[m] + 6, art, gross: hebt > 1.9, grad: 0, zusatz: [] });
  }
  // 3. Wasser und Matsch
  for (const f of T.furten || []) notizen.push({ s: f.s0 - 5, bis: f.s1, art: 'wasser', grad: 0, zusatz: [] });
  for (let m = 1; m < n; m++) if (T.belag[m] === BELAG.matsch && T.belag[m - 1] !== BELAG.matsch && T.s[m] < ende) notizen.push({ s: T.s[m], bis: T.s[m] + 10, art: 'matsch', grad: 0, zusatz: [] });
  notizen.push({ s: L - ZIEL_VOR, bis: L - ZIEL_VOR, art: 'ziel', grad: 0, zusatz: [] });
  notizen.sort((a, b) => a.s - b.s);
  // Kuppe direkt vor einer Kurve: "über Kuppe" gehört zur Kurve
  for (let m = 0; m < notizen.length - 1; m++) {
    const a = notizen[m], b = notizen[m + 1];
    if ((a.art === 'kuppe') && b.art === 'kurve' && b.s - a.bis < 25) { b.zusatz.unshift('ueberKuppe'); a.weg = true; }
  }
  const liste = notizen.filter(x => !x.weg);
  // Abstand zur nächsten Ansage: "und" (direkt danach) oder Meter (gerundet)
  for (let m = 0; m < liste.length; m++) {
    const a = liste[m], b = liste[m + 1];
    if (!b) continue;
    const luecke = b.s - a.bis;
    a.weiter = luecke < 30 ? 'und' : luecke >= 50 ? Math.min(500, Math.round(luecke / 50) * 50) : null;
    if (a.weiter && a.weiter > 300 && a.weiter < 400) a.weiter = 300;
    if (a.weiter && a.weiter > 400 && a.weiter < 500) a.weiter = 400;
  }
  for (const a of liste) { a.text = ansageText(a); a.sprache = ansageSprache(a); }
  return liste;
}

function ansageText(a) {
  const z = a.zusatz;
  let t;
  if (a.art === 'kurve') t = (a.achtung ? '⚠ ' : '') + (a.seite === 'links' ? 'Links ' : 'Rechts ') + (z.includes('kehre') ? 'Kehre' : a.grad);
  else t = { kuppe: 'Kuppe', sprung: a.gross ? 'Großer Sprung' : 'Sprung', wasser: 'Wasser!', matsch: 'Matsch', ziel: 'Ziel' }[a.art];
  const mehr = [];
  if (z.includes('ueberKuppe')) mehr.push('über Kuppe');
  if (z.includes('lang')) mehr.push('lang');
  if (z.includes('enger')) mehr.push('wird enger');
  if (z.includes('oeffnet')) mehr.push('öffnet');
  if (z.includes('nichtSchneiden')) mehr.push('nicht schneiden');
  return { haupt: t, mehr: mehr.join(' · '), weiter: a.weiter === 'und' ? 'und' : a.weiter ? String(a.weiter) : '' };
}

function ansageSprache(a) {
  const z = a.zusatz, w = [];
  if (a.achtung) w.push('Achtung');
  if (a.art === 'kurve') {
    if (z.includes('ueberKuppe')) w.push('über Kuppe');
    w.push(a.seite, z.includes('kehre') ? 'Kehre' : ZAHL[a.grad]);
    if (z.includes('lang')) w.push('lang');
    if (z.includes('enger')) w.push('wird enger');
    if (z.includes('oeffnet')) w.push('öffnet');
    if (z.includes('nichtSchneiden')) w.push('nicht schneiden');
  } else w.push({ kuppe: 'Kuppe', sprung: a.gross ? 'großer Sprung' : 'Sprung', wasser: 'Achtung Wasser', matsch: 'Matsch', ziel: 'Ziel, voll durch' }[a.art]);
  if (a.weiter === 'und') w.push('und');
  else if (a.weiter) w.push(WEITE[a.weiter] || String(a.weiter));
  return w.join(' ');
}

// Ansagen, die zusammen gesprochen werden ("Links 4 und rechts 3"): Gruppen bis zum nächsten Abstand
export function ansageGruppen(liste) {
  const gruppen = []; let akt = null;
  for (const a of liste) {
    if (!akt) { akt = { s: a.s, teile: [] }; gruppen.push(akt); }
    akt.teile.push(a);
    // höchstens drei Ansagen am Stück, sonst wird es zu viel zum Merken (der Rest kommt gleich danach)
    if (a.weiter !== 'und' || akt.teile.length >= 3) akt = null;
  }
  for (const g of gruppen) g.sprache = g.teile.map(a => a.sprache).join(', ');
  return gruppen;
}

// ---------------------------------------------------------------- Wo stehen Zuschauer?
// An Kehren (außen ist zu gefährlich: sie stehen innen und hinten), an Sprüngen, an Start und Ziel und ein paar schnellen Stellen.
export function zuschauerStellen(T, ansagen) {
  const r = zufallAus(T.def.id + 'zuschauer'), stellen = [];
  const dazu = (s, seite, zahl, art) => { if (!stellen.some(p => Math.abs(p.s - s) < 60 && p.seite === seite)) stellen.push({ s, seite, zahl, art }); };
  dazu(18, 1, 30, 'start'); dazu(18, -1, 24, 'start');
  dazu(T.laenge - ZIEL_VOR + 20, 1, 22, 'ziel');
  for (const a of ansagen) {
    if (a.art === 'kurve' && a.grad <= 2) dazu(T.s[a.scheitel] + 6, a.seite === 'links' ? 1 : -1, 16 + Math.floor(r() * 18), 'kehre');
    else if (a.art === 'sprung') { dazu(a.bis + 22, r() < 0.5 ? 1 : -1, 18 + Math.floor(r() * 16), 'sprung'); }
    else if (a.art === 'wasser') { dazu(a.s + 6, 1, 26, 'wasser'); dazu(a.s + 10, -1, 18, 'wasser'); }
    else if (a.art === 'kurve' && a.grad === 3 && r() < 0.3) dazu(T.s[a.scheitel], a.seite === 'links' ? 1 : -1, 10 + Math.floor(r() * 10), 'kurve');
  }
  return stellen;
}

// ---------------------------------------------------------------- Die Prüfung
export class Etappe {
  // auto = id des Rallyeautos, lack = Farbe (oder null), staerke = wie schnell die anderen sind, nr = Nummer der WP
  constructor(T, { auto = 'sturmfalke', lack = null, staerke = 'mittel', nr = 1, nummer = 1 } = {}) {
    this.T = T; this.modus = 'rallye'; this.rallye = true; this.nr = nr;
    this.super = true; this.slot = false; this.boxen = false; this.verkehr = null; this.runden = 1; this.sc = 1;
    const S = rallyeauto(auto);
    const a = neuesAuto(S.id);
    aufStrecke(a, T, 3, 0);
    this.L = ideallinie(T, a.p);
    this.plan = planZeiten(T, this.L, a.p);
    // Bremshilfe (und Computerfahrer beim Testen) richten sich nach dem Tempo-Plan mit Schotter und Matsch
    this.L.tempo = Float32Array.from(this.plan.v, (v, i) => i === 0 ? this.plan.v[1] : v);
    this.ich = {
      a, ich: true, name: 'Du', team: S.name, farbe: lack ?? S.farbe, zweit: S.zweit, nummer, fahrer: null,
      runde: 0, rundeStart: 0, letzte: null, beste: null, zeiten: [], ziel: null, gueltig: true, platz: 1, prevS: a.s,
    };
    this.autos = [this.ich];
    this.reihenfolge = [this.ich];
    this.zielS = T.laenge - ZIEL_VOR; this.stoppS = T.laenge - STOPP_VOR;
    this.zwS = ZWISCHEN.map(f => f * this.zielS);
    this.zw = [];                       // deine Zwischenzeiten
    this.weg = a.s;                     // gefahrene Meter ab der Startlinie (ohne Sprung bei 0)
    this.phase = 'start'; this.uhr = 0; this.zeit = 0; this.ampel = 0;
    this.countdown = COUNTDOWN;
    this.hilfe = { bremsen: false, lenken: false };
    this.ereignisse = [];
    this.geistAlt = null; this.geist = { punkte: [], takt: 0, proS: [] };
    // Zeiten der anderen: Tempo-Plan mal ihrem Faktor (dazu etwas Zufall je Prüfung)
    const r = zufallAus(T.def.id + staerke);
    const tZiel = zeitBei(T, this.plan, this.zielS);
    this.rivalen = rivalen(staerke).map(R => {
      const f = R.faktor * (1 + (r() - 0.5) * 0.03);
      return { ...R, zw: this.zwS.map(s => zeitBei(T, this.plan, s) * f), zeit: tZiel * f };
    });
    this.ansagen = ansagenBauen(T, this.plan);
    this.gruppen = ansageGruppen(this.ansagen);
    this.naechsteGruppe = 0;            // welche Ansage als nächste dran ist
    this.ansageNeu = null;              // spiel.js liest das und lässt den Beifahrer sprechen
    this.zuschauer = zuschauerStellen(T, this.ansagen);
    // Felsen innen in den Kurven mit "nicht schneiden": Wer die Kurve abkürzt, prallt dagegen
    this.felsen = this.ansagen.filter(n => n.fels).map(n => {
      const i = n.scheitel, seite = n.seite === 'links' ? 1 : -1, rad = 0.8 + ((i * 7919) % 100) / 100 * 0.5;
      const d = seite * (T.hb[i] + 0.6 + rad * 0.8);
      return { s: T.s[i], i, d, rad, x: T.x[i] + T.tz[i] * d, y: T.y[i], z: T.z[i] - T.tx[i] * d };
    });
  }

  // Zurück auf den Weg (Taste R, oder von selbst, wenn das Auto feststeckt). Kostet STRAFE Sekunden.
  zuruecksetzen() {
    const a = this.ich.a, T = this.T;
    if (this.phase !== 'los') return;
    aufStrecke(a, T, a.s, 0);
    a.y = T.y[a.idx];
    this.zeit += STRAFE; this.steckt = 0; this.wegListe = [];
    this.melden(`Zurück auf den Weg (+${STRAFE} s)`, 'warn');
  }

  // Ist das Auto gegen einen Felsen gefahren? Dann zurückschieben und stark abbremsen
  felsenPruefen(a) {
    for (const f of this.felsen) {
      const dx = a.x - f.x, dz = a.z - f.z, ab = Math.hypot(dx, dz), min = f.rad * 0.7 + 0.9;
      if (ab >= min || ab < 1e-3) continue;
      const nx = dx / ab, nz = dz / ab;
      a.x += nx * (min - ab); a.z += nz * (min - ab);
      const sh = Math.sin(a.h), ch = Math.cos(a.h);
      let wx = sh * a.u + ch * a.v, wz = ch * a.u - sh * a.v;
      const gegen = -(wx * nx + wz * nz);
      if (gegen > 0) {
        wx += nx * gegen * 1.3; wz += nz * gegen * 1.3; wx *= 0.7; wz *= 0.7;
        a.u = sh * wx + ch * wz; a.v = ch * wx - sh * wz;
        a.r += (Math.random() - 0.5) * gegen * 0.15;
        a.stoss = Math.max(a.stoss, gegen);
        this.beruehrt = Math.max(this.beruehrt || 0, gegen);
      }
    }
  }

  melden(text, art = 'info') { this.ereignisse.push({ text, art, t: this.uhr }); }

  update(dt, eingabe) {
    dt = Math.min(dt, 0.05);
    this.uhr += dt;
    const T = this.T, c = this.ich, a = c.a;
    if (this.phase === 'start') {
      const vorher = Math.ceil(this.countdown);
      this.countdown -= dt;
      this.ampel = Math.max(0, Math.ceil(this.countdown));
      if (Math.ceil(this.countdown) !== vorher && this.countdown > 0) this.melden(String(Math.ceil(this.countdown)), 'zaehlen');
      a.gas = eingabe.gas; a.brems = 0; a.lenkWunsch = eingabe.lenk;
      a.u = a.v = a.r = 0; a.drehzahl = 2500 + a.gas * 5200;
      if (this.countdown <= 0) { this.phase = 'los'; this.zeit = 0; this.melden('Los!', 'start'); }
      this.vorlesen(a);
      return;
    }
    if (this.phase === 'los') this.zeit += dt;
    if (this.phase === 'fertig') { a.gas = 0; a.brems = 1; a.handbremse = false; schritt(a, T, dt); return; }
    a.lenkWunsch = eingabe.lenk; a.gas = eingabe.gas; a.brems = eingabe.brems;
    // Handbremse: Leertaste, Schultertaste – oder Gas und Bremse zugleich (so geht es auch mit dem Handy)
    a.handbremse = !!(eingabe.hand || (eingabe.gas > 0.5 && eingabe.brems > 0.5));
    if (a.handbremse) a.brems = 0;
    if (this.hilfe.lenken) a.lenkWunsch = Math.max(-1, Math.min(1, eingabe.lenk * 0.6 + lenkZurLinie(a, T, this.L) * 0.55));
    c.hilfeBremst = this.hilfe.bremsen ? bremsHilfe(a, T, this.L) : false;
    // nach dem Ziel: langsam ausrollen bis zum Stopp-Schild
    if (this.phase === 'ziel') {
      if (this.weg > this.stoppS - 70) { a.gas = 0; a.brems = Math.max(a.brems, Math.min(1, (this.weg - (this.stoppS - 70)) / 40)); }
      if (Math.abs(a.u) < 1.5 && (this.weg > this.stoppS - 40 || this.uhr - this.zielUhr > 12)) { this.phase = 'fertig'; }
    }
    schritt(a, T, dt);
    this.felsenPruefen(a);
    // Steckt das Auto fest (neben dem Weg, kaum Tempo)? Nach ein paar Sekunden setzen die Streckenposten es zurück
    if (this.phase === 'los' && Math.abs(a.u) < 1.2 && Math.abs(a.d) > T.hb[a.idx] + 0.5) {
      this.steckt = (this.steckt || 0) + dt;
      if (this.steckt > STECKT_ZEIT) this.zuruecksetzen();
    } else this.steckt = 0;
    // Kommt man gar nicht mehr voran (dreht sich im Kreis, fährt verkehrt herum)? Nach 8 Sekunden auch zurücksetzen
    if (this.phase === 'los') {
      this.merkUhr = (this.merkUhr || 0) + dt;
      if (this.merkUhr >= 1) { this.merkUhr = 0; (this.wegListe ||= []).push(this.weg); if (this.wegListe.length > 8) this.wegListe.shift(); }
      if (this.wegListe && this.wegListe.length >= 8 && this.weg - this.wegListe[0] < 15) { this.wegListe = []; this.zuruecksetzen(); }
    }
    // gefahrene Meter (über die Startlinie hinweg weiterzählen)
    let d = a.s - c.prevS; if (d < -T.laenge / 2) d += T.laenge; if (d > T.laenge / 2) d -= T.laenge;
    c.prevS = a.s; this.weg += d;
    if (this.phase === 'los') {
      this.geistAufnehmen();
      this.zwS.forEach((s, k) => {
        if (this.zw[k] === undefined && this.weg >= s) {
          this.zw[k] = this.zeit;
          const best = Math.min(...this.rivalen.map(R => R.zw[k]));
          const ab = this.zeit - best;
          this.melden(`Zwischenzeit ${k + 1}: ${zeitText(this.zeit)}  (${ab <= 0 ? '−' : '+'}${Math.abs(ab).toFixed(1)})`, ab <= 0 ? 'beste' : 'runde');
        }
      });
      if (this.weg >= this.zielS) {
        c.ziel = this.zeit; c.letzte = this.zeit; this.phase = 'ziel'; this.zielUhr = this.uhr;
        this.plaetze();
        this.melden(`Ziel! ${zeitText(this.zeit)} – Platz ${c.platz}`, 'ziel');
        if (!this.geistAlt || this.zeit < this.geistAlt.zeit) {
          this.geistAlt = { zeit: this.zeit, punkte: this.geist.punkte, proS: this.geist.proS };
          if (this.wennBestzeit) this.wennBestzeit(this.geistAlt);
        }
      }
    }
    this.vorlesen(a);
  }

  // Der Beifahrer liest rechtzeitig vor: je schneller, desto früher (etwa 2,8 Sekunden vor der Stelle)
  vorlesen(a) {
    const G = this.gruppen;
    while (this.naechsteGruppe < G.length) {
      const g = G[this.naechsteGruppe];
      const vor = Math.max(70, Math.min(200, Math.abs(a.u) * 3));
      if (g.s - this.weg > vor) break;
      this.naechsteGruppe++;
      if (g.s - this.weg > -10) { this.ansageNeu = g; break; }   // schon vorbei (z. B. nach dem Zurücksetzen): nicht mehr sagen
    }
  }
  // die nächsten Ansagen für die Anzeige
  kommende(zahl = 3) {
    const out = [];
    for (let k = this.naechsteGruppe - 1; k < this.gruppen.length && out.length < zahl; k++) {
      if (k < 0) continue;
      for (const t of this.gruppen[k].teile) if (t.bis > this.weg - 5 && out.length < zahl) out.push({ ...t, weg: t.s - this.weg });
    }
    return out;
  }

  plaetze() {
    const ich = this.ich;
    const alle = [...this.rivalen.map(R => ({ name: R.name, team: R.auto, ziel: R.zeit, nummer: R.nummer, ich: false, farbe: 0x888888 })),
      { name: 'Du', team: ich.team, ziel: ich.ziel ?? Infinity, nummer: ich.nummer, ich: true, farbe: ich.farbe }];
    alle.sort((p, q) => p.ziel - q.ziel);
    alle.forEach((o, k) => { o.platz = k + 1; if (o.ich) ich.platz = k + 1; });
    this.tabelle = alle;
    return alle;
  }

  // Abstand zur eigenen Bestzeit an dieser Stelle (Sekunden, minus = schneller), oder zur schnellsten anderen Zeit
  abstand() {
    if (this.phase !== 'los') return null;
    const k = Math.floor(this.weg / 10);
    if (this.geistAlt && this.geistAlt.proS && this.geistAlt.proS[k] !== undefined) return this.zeit - this.geistAlt.proS[k];
    return null;
  }
  geistAufnehmen() {
    const g = this.geist, t = this.zeit, a = this.ich.a;
    const k = Math.floor(this.weg / 10);
    if (g.proS[k] === undefined && k >= 0) g.proS[k] = t;
    if (t >= g.takt) { g.takt = t + 0.05; g.punkte.push([+t.toFixed(3), +a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), +a.h.toFixed(4)]); }
  }
  setzeGeist(g) { this.geistAlt = g; }
  geistBei() {
    const g = this.geistAlt;
    if (!g || this.phase !== 'los') return null;
    const t = this.zeit, P = g.punkte;
    if (!P.length || t > P[P.length - 1][0]) return null;
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; }
    const p = P[lo], q = P[hi], f = q[0] > p[0] ? Math.min(1, Math.max(0, (t - p[0]) / (q[0] - p[0]))) : 0;
    let dh = q[4] - p[4]; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    return { x: p[1] + (q[1] - p[1]) * f, y: p[2] + (q[2] - p[2]) * f, z: p[3] + (q[3] - p[3]) * f, h: p[4] + dh * f };
  }
}

export function zeitText(t) {
  if (t === null || t === undefined || !isFinite(t)) return '–:––.–';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}
