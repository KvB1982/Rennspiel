// Rennspiel – der Eingabe-Rekorder (ohne three.js, läuft auch in node).
//
// Wozu? Bisher wurde das Fahrgefühl nur mit künstlichen Fahrern nachgemessen. Der Rekorder schreibt mit,
// was ein echter Mensch macht: 60-mal pro Sekunde Lenkung, Gas und Bremse – und dazu, wo das Auto wirklich war.
// Mit „Fahrt sichern“ wird daraus eine Datei. Das Werkzeug tools/nachfahren.mjs fährt sie am Rechner noch einmal nach.
//
// Damit das Nachfahren haargenau stimmt, werden die Eingaben VOR dem Rechnen auf feste Stufen gerundet (raster):
// Das Spiel rechnet dann mit genau den Zahlen, die auch in der Datei stehen. Die Stufen sind so fein
// (Lenkung in 10.000 Schritten je Seite), dass man davon nichts merkt.

export const FASSUNG = 1;
// Der feste Rechenschritt: Die Fahrphysik rechnet immer in Schritten von 1/120 Sekunde – egal, wie schnell der Bildschirm ist.
// (833 Hunderttausendstel, weil die Datei Zeiten in dieser Stufe aufschreibt.)
export const SCHRITT = 833 / 100000;
export const SCHRITTE_MAX = 6;   // höchstens so viele Schritte je Bild (ruckelt es stärker, läuft das Spiel kurz langsamer)
const DT_MAL = 100000, LENK_MAL = 10000, PEDAL_MAL = 250;
const SPUR_ALLE = 24;         // alle 24 Schritte (5-mal pro Sekunde) wird aufgeschrieben, wo das Auto wirklich ist
const SPUR_FELDER = 8;        // x, z, Richtung, Tempo vorwärts, Tempo seitwärts, Drehen, Abstand zur Mitte, Weg auf der Strecke
const SPUR_MAL = [10000, 10000, 100000, 10000, 10000, 10000, 10000, 1000];
const MAX_BILDER = 120 * 60 * 20;   // höchstens 20 Minuten, dann hört die Aufnahme auf
const QUELLEN = ['tastatur', 'handy', 'gamepad', 'neigen'];

// Eingaben auf die Stufen der Datei runden. Das Spiel rechnet mit dem, was hier herauskommt.
export function raster(dt, e) {
  return {
    dt: Math.min(65535, Math.round(dt * DT_MAL)) / DT_MAL,
    lenk: Math.max(-LENK_MAL, Math.min(LENK_MAL, Math.round((+e.lenk || 0) * LENK_MAL))) / LENK_MAL,
    gas: Math.max(0, Math.min(PEDAL_MAL, Math.round((+e.gas || 0) * PEDAL_MAL))) / PEDAL_MAL,
    brems: Math.max(0, Math.min(PEDAL_MAL, Math.round((+e.brems || 0) * PEDAL_MAL))) / PEDAL_MAL,
    hand: e.hand ? 1 : 0,
  };
}

export class Rekorder {
  constructor() { this.an = false; this.n = 0; }

  // Neue Fahrt. kopf = alles, was man zum Nachfahren wissen muss (Strecke, Auto, Einstellungen …)
  start(kopf) {
    this.kopf = { fassung: FASSUNG, ...kopf };
    this.platz = 120 * 120;
    this.dt = new Uint16Array(this.platz); this.lenk = new Int16Array(this.platz);
    this.gas = new Uint8Array(this.platz); this.brems = new Uint8Array(this.platz);
    this.zeichen = new Uint8Array(this.platz);      // kleine Ja/Nein-Angaben je Bild (siehe bild)
    this.neig = new Int16Array(this.platz);         // beim Neigen: der rohe Drehwinkel des Geräts (Grad mal 100)
    this.spur = new Int32Array(this.platz / SPUR_ALLE * SPUR_FELDER + SPUR_FELDER);
    this.n = 0; this.spurN = 0; this.neigDa = false;
    this.ereignisse = [];   // z. B. „zurück auf die Strecke“ bei Bild 1234
    this.technik = [];      // alle zwei Sekunden: Bilder pro Sekunde, Bildschärfe, Dreiecke, Zeichenaufrufe
    this.ende = null;
    this.an = true;
  }

  wachsen() {
    const neu = this.platz * 2;
    for (const f of ['dt', 'lenk', 'gas', 'brems', 'zeichen', 'neig']) { const a = new this[f].constructor(neu); a.set(this[f]); this[f] = a; }
    const s = new Int32Array(neu / SPUR_ALLE * SPUR_FELDER + SPUR_FELDER); s.set(this.spur); this.spur = s;
    this.platz = neu;
  }

  // Ein Bild aufschreiben – gleich NACH dem Rechnen. e = die gerundeten Eingaben aus raster, a = dein Auto,
  // neben = Auto ist neben der Fahrbahn, wand = harter Stoß in diesem Bild, laeuft = die Uhr läuft (nach der Ampel),
  // neu = mit diesem Schritt fängt ein neues Bild auf dem Bildschirm an (daran sieht man später, wie flüssig es lief)
  bild(e, a, { neben = false, wand = false, laeuft = true, quelle = 'tastatur', winkel = 0, neu = false } = {}) {
    if (!this.an) return;
    if (this.n >= MAX_BILDER) { this.an = false; this.kopf.abgeschnitten = true; return; }
    if (this.n >= this.platz) this.wachsen();
    const n = this.n;
    this.dt[n] = Math.round(e.dt * DT_MAL); this.lenk[n] = Math.round(e.lenk * LENK_MAL);
    this.gas[n] = Math.round(e.gas * PEDAL_MAL); this.brems[n] = Math.round(e.brems * PEDAL_MAL);
    const q = Math.max(0, QUELLEN.indexOf(quelle));
    this.zeichen[n] = (e.hand ? 1 : 0) | (wand ? 2 : 0) | (neben ? 4 : 0) | (a.luft ? 8 : 0) | (q << 4) | (laeuft ? 64 : 0) | (neu ? 128 : 0);
    if (quelle === 'neigen') { this.neig[n] = Math.max(-32767, Math.min(32767, Math.round(winkel * 100))); this.neigDa = true; }
    if (n % SPUR_ALLE === 0) {
      const w = [a.x, a.z, a.h, a.u, a.v, a.r, a.d, a.s], o = this.spurN * SPUR_FELDER;
      for (let k = 0; k < SPUR_FELDER; k++) this.spur[o + k] = Math.round((w[k] || 0) * SPUR_MAL[k]);
      this.spurN++;
    }
    this.n++;
  }

  // Etwas Besonderes ist passiert (gilt für das nächste Bild, das gerechnet wird)
  ereignis(art) { if (this.an) this.ereignisse.push([this.n, art]); }
  messwert(werte) { if (this.an && this.technik.length < 900) this.technik.push([this.n, ...werte]); }
  // Die Fahrt ist zu Ende: Zeiten und Platz dazuschreiben (aufgenommen wird weiter, bis eine neue Fahrt beginnt)
  fertig(ergebnis) { if (this.kopf) this.ende = ergebnis; }

  // Alles zusammen als ein Paket, das man als Text (JSON) sichern kann
  paket() {
    const n = this.n, p = { ...this.kopf, schritt: SCHRITT, bilder: n, ende: this.ende, ereignisse: this.ereignisse, technik: this.technik,
      dt: alsText(this.dt.subarray(0, n)), lenk: alsText(this.lenk.subarray(0, n)), gas: alsText(this.gas.subarray(0, n)),
      brems: alsText(this.brems.subarray(0, n)), zeichen: alsText(this.zeichen.subarray(0, n)),
      spurAlle: SPUR_ALLE, spur: alsText(this.spur.subarray(0, this.spurN * SPUR_FELDER)) };
    if (this.neigDa) p.neig = alsText(this.neig.subarray(0, n));
    return p;
  }
}

// Ein Paket wieder in Zahlen verwandeln (für tools/nachfahren.mjs)
export function auspacken(p) {
  if (!p || p.fassung !== FASSUNG) throw new Error('Diese Datei ist keine Fahrt, die ich lesen kann (Fassung ' + (p && p.fassung) + ')');
  const n = p.bilder;
  const dt = Array.from(ausText(p.dt, Uint16Array), v => v / DT_MAL), lenk = Array.from(ausText(p.lenk, Int16Array), v => v / LENK_MAL);
  const gas = Array.from(ausText(p.gas, Uint8Array), v => v / PEDAL_MAL), brems = Array.from(ausText(p.brems, Uint8Array), v => v / PEDAL_MAL);
  const z = ausText(p.zeichen, Uint8Array);
  const neig = p.neig ? Array.from(ausText(p.neig, Int16Array), v => v / 100) : null;
  const roh = ausText(p.spur, Int32Array), spur = [];
  for (let o = 0; o + SPUR_FELDER <= roh.length; o += SPUR_FELDER) {
    const w = k => roh[o + k] / SPUR_MAL[k];
    spur.push({ bild: spur.length * p.spurAlle, x: w(0), z: w(1), h: w(2), u: w(3), v: w(4), r: w(5), d: w(6), s: w(7) });
  }
  return { n, dt, lenk, gas, brems, neig, spur,
    hand: i => z[i] & 1, wand: i => !!(z[i] & 2), neben: i => !!(z[i] & 4), luft: i => !!(z[i] & 8),
    quelle: i => QUELLEN[(z[i] >> 4) & 3], laeuft: i => !!(z[i] & 64), neu: i => !!(z[i] & 128), schritt: p.schritt || 0 };
}

// Zahlenreihe ↔ Text (Base64), damit sie in eine JSON-Datei passt
function alsText(feld) {
  const b = new Uint8Array(feld.buffer, feld.byteOffset, feld.byteLength);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function ausText(text, Art) {
  const s = atob(text || ''), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return new Art(b.buffer, 0, Math.floor(b.length / Art.BYTES_PER_ELEMENT));
}
