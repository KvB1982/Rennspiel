// Rennspiel – die Verbindung zwischen dem Handy (Lenkrad) und dem Gerät mit dem Spiel (großer Bildschirm).
//
// Wie in Frontline und Powershot finden sich zwei Geräte und schicken sich kleine Nachrichten.
// Dort ging das über Apples "Multipeer" (nur in der App). Hier geht es im Browser, mit WebRTC:
//   1. Das Spiel denkt sich einen Code aus (z. B. "K7QM") und zeigt ihn als QR-Code.
//   2. Das Handy scannt ihn und öffnet die Lenkrad-Seite.
//   3. Ein Vermittler im Internet (PeerJS) stellt die beiden einander vor. Danach reden sie direkt miteinander,
//      im selben WLAN meist ganz ohne Umweg. Pro Sekunde schickt das Handy 60-mal Lenkung, Gas und Bremse.
// Zum Testen auf einem Rechner geht es auch ohne Internet zwischen zwei Fenstern desselben Browsers (BroadcastChannel).

const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const VORSILBE = 'rennspiel-lenkrad-';
const ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

let ladend = null;
function peerLaden() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!ladend) ladend = new Promise((ok, nein) => {
    const s = document.createElement('script'); s.src = PEERJS; s.async = true;
    s.onload = () => ok(window.Peer); s.onerror = () => { ladend = null; nein(new Error('PeerJS nicht geladen')); };
    document.head.appendChild(s);
  });
  return ladend;
}

export const neuerCode = () => Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join('');

// ---------------------------------------------------------------- Spiel-Seite: wartet auf Lenkräder
export class LenkradEmpfang {
  constructor() {
    this.status = 'aus';      // aus, laden, bereit, verbunden, fehler
    this.code = null;
    this.verbindungen = new Set();
    this.letzte = 0;          // Zeitpunkt der letzten Nachricht vom Handy
    this.wennDaten = null; this.wennStatus = null;
    this.geraet = '';
  }
  get verbunden() { return this.status === 'verbunden' && performance.now() - this.letzte < 2500; }

  setzeStatus(s) { if (this.status !== s) { this.status = s; if (this.wennStatus) this.wennStatus(s); } }

  async start() {
    if (this.status !== 'aus' && this.status !== 'fehler') return;
    let gemerkt = null;
    try { gemerkt = localStorage.getItem('rennspiel.code'); } catch (e) {}
    this.code = gemerkt && /^[A-Z0-9]{4}$/.test(gemerkt) ? gemerkt : neuerCode();
    this.setzeStatus('laden');
    this.kanalOeffnen();
    try {
      const Peer = await peerLaden();
      this.peerStarten(Peer, 0);
    } catch (e) { this.setzeStatus(this.verbindungen.size ? 'verbunden' : 'fehler'); }
  }

  // Zum Testen: Lenkrad im zweiten Fenster desselben Browsers
  kanalOeffnen() {
    if (!('BroadcastChannel' in window)) return;
    if (this.kanal) this.kanal.close();
    this.kanal = new BroadcastChannel(VORSILBE + this.code);
    this.kanal.onmessage = e => this.empfangen(e.data, { send: m => this.kanal.postMessage({ an: 'handy', ...m }) });
  }

  peerStarten(Peer, versuch) {
    const peer = this.peer = new Peer(VORSILBE + this.code.toLowerCase(), { debug: 0 });
    peer.on('open', () => { try { localStorage.setItem('rennspiel.code', this.code); } catch (e) {} if (this.status !== 'verbunden') this.setzeStatus('bereit'); });
    peer.on('connection', conn => {
      conn.on('open', () => { this.verbindungen.add(conn); });
      conn.on('data', d => this.empfangen(d, conn));
      conn.on('close', () => { this.verbindungen.delete(conn); if (!this.verbindungen.size) this.setzeStatus('bereit'); });
    });
    peer.on('error', e => {
      if (e.type === 'unavailable-id' && versuch < 4) {
        // Code ist schon vergeben (z. B. noch offen in einem anderen Fenster): neuen nehmen
        peer.destroy(); this.code = neuerCode(); this.kanalOeffnen(); this.peerStarten(Peer, versuch + 1);
        if (this.wennStatus) this.wennStatus(this.status);
      } else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') {
        if (this.status !== 'verbunden') this.setzeStatus('fehler');
      }
    });
    // Verbindung zum Vermittler verloren: in Ruhe nochmal versuchen (immer länger warten)
    peer.on('disconnected', () => {
      this.warte = Math.min(60000, (this.warte || 2000) * 2);
      clearTimeout(this.neuVersuch);
      this.neuVersuch = setTimeout(() => { if (!peer.destroyed) try { peer.reconnect(); } catch (e) {} }, this.warte);
    });
    peer.on('open', () => { this.warte = 0; });
  }

  empfangen(d, conn) {
    if (!d || typeof d !== 'object' || d.an === 'handy') return;
    this.letzte = performance.now();
    if (d.t === 'hallo') { this.geraet = String(d.name || 'Handy').slice(0, 30); this.antwort = conn; }
    this.antwort = conn;
    this.setzeStatus('verbunden');
    if (this.wennDaten) this.wennDaten(d);
  }

  // Nachricht ans Handy (Tempo, Platz, Rütteln …)
  senden(m) {
    if (this.antwort) try { this.antwort.send(m); } catch (e) {}
  }

  // Adresse für den QR-Code. Auf dem eigenen Rechner (localhost) zeigt sie auf die Seite im Internet,
  // weil das Handy den Rechner nicht unter "localhost" findet und Bewegungssensoren nur über https gehen.
  adresse() {
    const hier = location.origin + location.pathname.replace(/index\.html$/, '');
    const lokal = /^(localhost|127\.|192\.168\.|10\.|172\.)/.test(location.hostname) || location.protocol !== 'https:';
    const basis = lokal ? 'https://kvb1982.github.io/rennspiel/' : hier;
    return basis + '?lenkrad=' + this.code;
  }
}

// ---------------------------------------------------------------- Handy-Seite: verbindet sich mit dem Spiel
export class LenkradSender {
  constructor(code, lokal = false) {
    this.code = code.toUpperCase(); this.lokal = lokal;
    this.status = 'aus'; this.conn = null;
    this.wennDaten = null; this.wennStatus = null;
  }
  setzeStatus(s) { if (this.status !== s) { this.status = s; if (this.wennStatus) this.wennStatus(s); } }

  async verbinden() {
    this.setzeStatus('suchen');
    if (this.lokal && 'BroadcastChannel' in window) {
      this.kanal = new BroadcastChannel(VORSILBE + this.code);
      this.kanal.onmessage = e => { if (e.data && e.data.an === 'handy') { this.setzeStatus('verbunden'); if (this.wennDaten) this.wennDaten(e.data); } };
      this.conn = { send: m => this.kanal.postMessage(m), open: true };
      this.senden({ t: 'hallo', name: 'Testfenster' });
      return;
    }
    try {
      const Peer = await peerLaden();
      if (this.peer) this.peer.destroy();
      const peer = this.peer = new Peer({ debug: 0 });
      peer.on('open', () => this.anrufen());
      peer.on('error', e => {
        if (e.type === 'peer-unavailable') { this.setzeStatus('nichtGefunden'); setTimeout(() => this.anrufen(), 2500); }
        else if (e.type === 'network' || e.type === 'server-error') { this.setzeStatus('fehler'); setTimeout(() => this.verbinden(), 4000); }
      });
    } catch (e) { this.setzeStatus('fehler'); setTimeout(() => this.verbinden(), 4000); }
  }
  anrufen() {
    if (!this.peer || this.peer.destroyed) return;
    const conn = this.peer.connect(VORSILBE + this.code.toLowerCase(), { serialization: 'json' });
    conn.on('open', () => { this.conn = conn; this.setzeStatus('verbunden'); this.senden({ t: 'hallo', name: geraeteName() }); });
    conn.on('data', d => { if (this.wennDaten) this.wennDaten(d); });
    conn.on('close', () => { this.conn = null; this.setzeStatus('suchen'); setTimeout(() => this.anrufen(), 1500); });
  }
  senden(m) { if (this.conn && this.conn.open !== false) try { this.conn.send(m); } catch (e) {} }
}

function geraeteName() {
  const u = navigator.userAgent;
  return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android-Handy' : 'Handy';
}
