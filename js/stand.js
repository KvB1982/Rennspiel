// Rennspiel – der Spielstand (ohne three.js, läuft auch in node). Vorbild: js/profile.js in Powershot.
//
// Alles, was sich das Spiel merkt, steht in EINEM Eintrag im Speicher des Geräts ('rennspiel.stand.v1'):
//
//   { v: 1,                                        Version – hochzählen, wenn sich der Aufbau ändert
//     profile: [{ id, name, farbe }], aktiv: id,   „Wer fährt?“ – jeder hat seinen eigenen Stand
//     je: { [id]: { einst: {…},                    die Einstellungen aus dem Menü
//                   best: { 'kueste|f1': 81.2 },   Bestzeiten in Sekunden
//                   drift: { 'drift_matte|mittel': 12000 },   Drift-Rekorde
//                   geister: { 'kueste|f1': 1732540000000 },  wann welcher Geist gespeichert wurde
//                   karriere: null } } }           (kommt später)
//
// Nur die Geister (die ganze aufgezeichnete Bestrunde) liegen getrennt, jeder in einem eigenen Eintrag – sie sind groß.
// Ist der Speicher voll, wird der älteste Geist gelöscht. Bestzeiten gehen dabei nie verloren.
// Dem Gerät gehören weiter (nicht dem Profil): Ton an/aus, Lenkrad-Code, Rolle als Lenkrad, Neige-Stufe des Handy-Lenkrads.

export const SCHLUESSEL = 'rennspiel.stand.v1';
export const VERSION = 1;
export const PROFILE_MAX = 6;
const FARBEN = 6;   // so viele Farben gibt es für die Profil-Knöpfe
const geistSchluessel = (pid, was) => 'rennspiel.g.' + pid + '.' + was;
const leer = () => ({ einst: {}, best: {}, drift: {}, geister: {}, karriere: null });
const kurz = name => String(name || '').replace(/\s+/g, ' ').trim().slice(0, 14);

export class Stand {
  // speicher: etwas wie localStorage (getItem, setItem, removeItem, length, key). In node kann man einen nachgemachten geben.
  constructor(speicher) {
    this.sp = speicher;
    this.d = null;
    this.neuUebernommen = false;   // true, wenn gerade ein alter Spielstand übernommen wurde
    this.laden();
  }

  lies(k) { try { return this.sp.getItem(k); } catch (e) { return null; } }
  schreib(k, v) { try { this.sp.setItem(k, v); return true; } catch (e) { return false; } }
  weg(k) { try { this.sp.removeItem(k); } catch (e) {} }
  alleSchluessel() { const l = []; try { for (let i = 0; i < this.sp.length; i++) l.push(this.sp.key(i)); } catch (e) {} return l.filter(k => typeof k === 'string'); }

  laden() {
    let d = null;
    try { d = JSON.parse(this.lies(SCHLUESSEL) || 'null'); } catch (e) {}
    if (!gueltig(d)) { d = this.vonAlt(); this.d = d; this.sichern(); }
    this.d = d;
  }
  // Der Stand selbst ist klein, aber er muss immer hineinpassen: Ist der Speicher voll, weicht dafür der älteste Geist.
  sichern() {
    for (let versuch = 0; versuch < 40; versuch++) {
      if (this.schreib(SCHLUESSEL, JSON.stringify(this.d))) return true;
      if (!this.d || !this.aeltestenGeistLoeschen(null)) break;
    }
    return false;
  }

  // Der allererste Start mit dem neuen Spielstand: Die alten einzelnen Einträge werden zum ersten Profil.
  vonAlt() {
    const id = 'p1', ich = leer();
    const d = { v: VERSION, profile: [{ id, name: 'Fahrer 1', farbe: 0 }], aktiv: id, je: { [id]: ich } };
    try { const e = JSON.parse(this.lies('rennspiel.einst') || 'null'); if (e && typeof e === 'object') { ich.einst = e; this.neuUebernommen = true; } } catch (e) {}
    for (const k of this.alleSchluessel()) {
      // 'rennspiel.best.<strecke>.<art>' – die Strecke hat nie einen Punkt im Namen, die Art manchmal schon ('super.falkner')
      let m = /^rennspiel\.best\.([^.]+)\.(.+)$/.exec(k);
      if (m) { const z = parseFloat(this.lies(k)); if (z > 0) besser(ich.best, m[1] + '|' + m[2], z); this.neuUebernommen = true; continue; }
      m = /^rennspiel\.geist\.([^.]+)\.(.+)$/.exec(k);
      if (m) {
        const text = this.lies(k), was = m[1] + '|' + m[2];
        let g = null; try { g = JSON.parse(text); } catch (e) {}
        if (g && g.zeit > 0) besser(ich.best, was, g.zeit);   // ganz alte Stände: Die Bestzeit stand nur im Geist
        this.weg(k);                                            // erst löschen, dann unter dem neuen Namen schreiben (braucht so keinen doppelten Platz)
        if (g && this.schreib(geistSchluessel(id, was), text)) ich.geister[was] = Date.now();
        this.neuUebernommen = true; continue;
      }
      m = /^rennspiel\.drift2\.([^.]+)\.(.+)$/.exec(k);
      if (m) { const p = +this.lies(k); if (p > 0) ich.drift[m[1] + '|' + m[2]] = p; this.neuUebernommen = true; }
    }
    for (const k of this.alleSchluessel()) if (/^rennspiel\.(best|drift2)\./.test(k) || k === 'rennspiel.einst') this.weg(k);
    return d;
  }

  // ---------------------------------------------------------------- Profile
  get profile() { return this.d.profile; }
  get aktiv() { return this.d.profile.find(p => p.id === this.d.aktiv) || this.d.profile[0]; }
  get ich() { return this.d.je[this.aktiv.id] || (this.d.je[this.aktiv.id] = leer()); }

  profilNeu(name) {
    if (this.d.profile.length >= PROFILE_MAX) return null;
    let n = 1; while (this.d.profile.some(p => p.id === 'p' + n)) n++;
    const benutzt = new Set(this.d.profile.map(p => p.farbe));
    let farbe = 0; while (benutzt.has(farbe) && farbe < FARBEN - 1) farbe++;
    const p = { id: 'p' + n, name: kurz(name) || 'Fahrer ' + n, farbe };
    this.d.profile.push(p); this.d.je[p.id] = leer(); this.d.aktiv = p.id;
    this.sichern();
    return p;
  }
  wechseln(id) { if (!this.d.profile.some(p => p.id === id)) return false; this.d.aktiv = id; this.sichern(); return true; }
  umbenennen(id, name) { const p = this.d.profile.find(q => q.id === id); if (!p || !kurz(name)) return false; p.name = kurz(name); this.sichern(); return true; }
  // Ein Profil mit allem löschen, was dazugehört. Das letzte Profil bleibt immer.
  loeschen(id) {
    if (this.d.profile.length < 2 || !this.d.profile.some(p => p.id === id)) return false;
    for (const was of Object.keys((this.d.je[id] || {}).geister || {})) this.weg(geistSchluessel(id, was));
    this.d.profile = this.d.profile.filter(p => p.id !== id); delete this.d.je[id];
    if (this.d.aktiv === id) this.d.aktiv = this.d.profile[0].id;
    this.sichern();
    return true;
  }

  // ---------------------------------------------------------------- Einstellungen, Bestzeiten, Drift-Rekorde
  einst() { return this.ich.einst || {}; }
  einstMerken(E) { this.ich.einst = { ...E }; this.sichern(); }
  best(id, art) { const z = this.ich.best[id + '|' + art]; return z > 0 ? z : null; }
  bestSetzen(id, art, zeit) { if (!(zeit > 0)) return false; const neu = besser(this.ich.best, id + '|' + art, zeit); if (neu) this.sichern(); return neu; }
  drift(id, tempo) { return this.ich.drift[id + '|' + tempo] || 0; }
  driftSetzen(id, tempo, punkte) { if (!(punkte > this.drift(id, tempo))) return false; this.ich.drift[id + '|' + tempo] = punkte; this.sichern(); return true; }

  // ---------------------------------------------------------------- Geister
  geist(id, art) {
    const was = id + '|' + art;
    try { return JSON.parse(this.lies(geistSchluessel(this.aktiv.id, was)) || 'null'); } catch (e) { return null; }
  }
  // Speichert den Geist. Ist der Speicher voll, fliegt der älteste Geist (egal von welchem Profil) raus – so lange, bis es passt.
  geistSetzen(id, art, g) {
    const was = id + '|' + art, k = geistSchluessel(this.aktiv.id, was), text = JSON.stringify(g);
    for (let versuch = 0; versuch < 40; versuch++) {
      if (this.schreib(k, text)) { this.ich.geister[was] = Date.now(); this.sichern(); return true; }
      if (!this.aeltestenGeistLoeschen(k)) break;
    }
    delete this.ich.geister[was]; this.weg(k); this.sichern();
    return false;
  }
  aeltestenGeistLoeschen(nicht) {
    let alt = null;
    for (const p of this.d.profile) for (const [was, wann] of Object.entries((this.d.je[p.id] || {}).geister || {})) {
      const k = geistSchluessel(p.id, was);
      if (k !== nicht && (!alt || wann < alt.wann)) alt = { k, wann, pid: p.id, was };
    }
    if (!alt) return false;
    this.weg(alt.k); delete this.d.je[alt.pid].geister[alt.was];
    return true;
  }

  // ---------------------------------------------------------------- als Datei sichern und wieder laden
  // Alles von allen Profilen, mit Geistern. Der Text kommt in eine Datei.
  paket() {
    const geister = {};
    for (const p of this.d.profile) for (const was of Object.keys((this.d.je[p.id] || {}).geister || {})) {
      const t = this.lies(geistSchluessel(p.id, was)); if (t) geister[p.id + '/' + was] = t;
    }
    return JSON.stringify({ rennspielStand: VERSION, wann: new Date().toISOString(), stand: this.d, geister });
  }
  // Einen gesicherten Stand zurückholen. Der jetzige Stand wird dabei ganz ersetzt. Gibt true zurück, wenn es geklappt hat.
  einspielen(text) {
    let p = null; try { p = JSON.parse(text); } catch (e) {}
    if (!p || p.rennspielStand !== VERSION || !gueltig(p.stand)) return false;
    for (const k of this.alleSchluessel()) if (k.startsWith('rennspiel.g.')) this.weg(k);
    this.d = p.stand;
    for (const q of this.d.profile) { const j = this.d.je[q.id] || (this.d.je[q.id] = leer()); for (const f of ['einst', 'best', 'drift']) if (!j[f] || typeof j[f] !== 'object') j[f] = {}; j.geister = {}; }
    for (const [name, t] of Object.entries(p.geister || {})) {
      const i = name.indexOf('/'), pid = name.slice(0, i), was = name.slice(i + 1);
      if (this.d.je[pid] && typeof t === 'string' && this.schreib(geistSchluessel(pid, was), t)) this.d.je[pid].geister[was] = Date.now();
    }
    return this.sichern();
  }
}

const besser = (liste, was, zeit) => { if (liste[was] > 0 && liste[was] <= zeit) return false; liste[was] = zeit; return true; };
function gueltig(d) {
  return !!d && d.v === VERSION && Array.isArray(d.profile) && d.profile.length > 0 && d.profile.length <= PROFILE_MAX
    && d.profile.every(p => p && typeof p.id === 'string' && /^p\d+$/.test(p.id) && typeof p.name === 'string') && !!d.je && typeof d.je === 'object';
}
