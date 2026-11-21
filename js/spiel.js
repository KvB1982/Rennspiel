// Rennspiel – das Spiel auf dem großen Bildschirm: Menü, Spiel-Schleife, Anzeige, Ergebnis.

import { STRECKEN, strecke } from './strecken.js';
import { baueStrecke, MASSSTAB } from './strecke.js';
import { Rennen, TEAMS, zeitText } from './rennen.js';
import { aufStrecke, kmh } from './physik.js';
import { Buehne } from './szene.js';
import { ladeModelle } from './modelle.js';
import { ladeBilder } from './texturen.js';
import { ladeSupercars } from './supercarbau.js';
import { Kamera, SICHTEN } from './kamera.js';
import { Eingabe } from './eingabe.js';
import { LenkradEmpfang } from './verbindung.js';
import { Klang } from './klang.js';
import { SUPERCARS, LACKE, supercar } from './supercars.js';

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- Einstellungen (werden im Browser gemerkt)
const STANDARD = {
  fahrzeug: 'f1', modus: 'rennen', strecke: 'kueste', strecke_modell: 'wohnzimmer', strecke_slot: 'slot_oval', strecke_super: 'metropole', tempo: 'mittel',
  supercar: 'falkner', lack: 0, verkehr: 'normal', runden_super: 1, gegner_super: 5,
  gegner: 7, staerke: 'mittel', runden: 3, farbe: 0, kamera: 'hinten',
  bremshilfe: true, lenkhilfe: false, traktion: true, autogas: false, grafik: 'hoch', linie: true, boxen: true,
};
// Höchsttempo der kleinen Autos in Metern pro Sekunde. 3 m/s sehen beim Maßstab 1:30 aus wie 325 km/h.
const TEMPO = { modell: { langsam: 1.6, mittel: 2.3, schnell: 3.0 }, slot: { langsam: 2.6, mittel: 3.5, schnell: 4.5 } };
const streckenFeld = () => E.fahrzeug === 'modell' ? 'strecke_modell' : E.fahrzeug === 'slot' ? 'strecke_slot' : E.fahrzeug === 'super' ? 'strecke_super' : 'strecke';
// Wie viel Verkehr: Zahl für verkehr.js (0 = keiner)
const VERKEHR = { aus: 0, wenig: 0.5, normal: 1, viel: 1.6 };
const istKlein = () => E.fahrzeug === 'modell' || E.fahrzeug === 'slot';   // die kleinen Autos (Maßstab 1:30)
const E = Object.assign({}, STANDARD);
try { Object.assign(E, JSON.parse(localStorage.getItem('rennspiel.einst') || '{}')); } catch (e) {}
const merken = () => { try { localStorage.setItem('rennspiel.einst', JSON.stringify(E)); } catch (e) {} };

// Bestzeiten und Geist-Runden
const bestKey = (id, art) => 'rennspiel.geist.' + id + '.' + art;
const ladeGeist = (id, art) => { try { return JSON.parse(localStorage.getItem(bestKey(id, art)) || 'null'); } catch (e) { return null; } };
const speichereGeist = (id, art, g) => { try { localStorage.setItem(bestKey(id, art), JSON.stringify(g)); } catch (e) {} };

// Bestzeiten der kleinen Autos gelten je Höchsttempo (sonst wären sie nicht vergleichbar)
const geistArt = () => E.fahrzeug === 'f1' ? '' : E.fahrzeug === 'super' ? '.' + E.supercar : '.' + E.tempo;
const streckenCache = new Map();
const holeStrecke = id => { if (!streckenCache.has(id)) streckenCache.set(id, baueStrecke(strecke(id))); return streckenCache.get(id); };

export function starteSpiel() {
  const empfang = new LenkradEmpfang();
  const eingabe = new Eingabe(empfang);
  const klang = new Klang();
  let buehne = null, kamera = null, rennen = null, T = null;
  let kurven = null;   // für jede Stelle der Strecke: wo die nächste Kurve ist und welcher Gang dort passt
  let laeuft = false, pausiert = false, letzteZeit = 0, infoTakt = 0, meldungBis = 0, fertigGezeigt = false;
  const app = { E, empfang, eingabe, klang };
  window.__rennspiel = app;

  // ---------------------------------------------------------------- Menü
  const waehle = (box, wert) => [...$(box).children].forEach(b => b.classList.toggle('an', b.dataset.wert === String(wert)));
  const menueBauen = () => {
    waehle('mFahrzeug', E.fahrzeug); waehle('mModus', E.modus);
    // Strecken passend zum Fahrzeug
    const box = $('mStrecke'); box.innerHTML = '';
    const liste = STRECKEN.filter(s => E.fahrzeug === 'slot' ? s.slot : E.fahrzeug === 'modell' ? s.modell && !s.slot : E.fahrzeug === 'super' ? s.strasse : !s.modell && !s.strasse);
    // Supercars: Auswahl des Autos
    $('mSuper').hidden = E.fahrzeug !== 'super';
    if (E.fahrzeug === 'super') autosBauen();
    const feld = streckenFeld(), aktiv = E[feld];
    for (const def of liste) {
      const b = document.createElement('button'); b.dataset.wert = def.id;
      const T0 = holeStrecke(def.id);
      const g = ladeGeist(def.id, E.fahrzeug + geistArt());
      const laenge = def.modell ? (T0.laenge).toFixed(1) + ' m' : (T0.laenge / 1000).toFixed(2) + ' km';
      b.innerHTML = `<canvas width="300" height="150"></canvas><b>${def.name}</b><small>${def.ort} · ${laenge}</small><small>${def.text}</small>${g ? `<span class="best">⏱ Bestzeit ${zeitText(g.zeit)}</span>` : ''}`;
      karteMalen(b.querySelector('canvas'), T0, '#e8edf3', 6);
      b.addEventListener('click', () => { E[feld] = def.id; merken(); menueBauen(); });
      box.appendChild(b);
    }
    waehle('mStrecke', aktiv);
    if (!liste.some(s => s.id === aktiv)) { E[feld] = liste[0].id; waehle('mStrecke', liste[0].id); }
    // Einstellungen
    const ein = $('mEinst'); ein.innerHTML = '';
    const zeile = (name, schluessel, werte, sichtbar = true) => {
      if (!sichtbar) return;
      const z = document.createElement('div'); z.className = 'zeile';
      z.innerHTML = `<span>${name}</span><div class="wahl"></div>`;
      const w = z.lastChild;
      for (const [wert, text] of werte) {
        const b = document.createElement('button'); b.textContent = text; b.dataset.wert = wert;
        if (String(E[schluessel]) === String(wert)) b.classList.add('an');
        b.addEventListener('click', () => { E[schluessel] = typeof STANDARD[schluessel] === 'number' ? +wert : typeof STANDARD[schluessel] === 'boolean' ? String(wert) === 'true' : wert; merken(); menueBauen(); });
        w.appendChild(b);
      }
      ein.appendChild(z);
    };
    const rennenAn = E.modus === 'rennen', modell = istKlein(), slot = E.fahrzeug === 'slot', sup = E.fahrzeug === 'super';   // modell = eines der kleinen Autos
    if (sup) {
      zeile('Gegner', 'gegner_super', [3, 5, 7].map(n => [n, String(n)]), rennenAn);
      zeile('Stärke der Gegner', 'staerke', [['leicht', 'leicht'], ['mittel', 'mittel'], ['schwer', 'schwer']], rennenAn);
      zeile('Runden', 'runden_super', [1, 2, 3, 5].map(n => [n, String(n)]), rennenAn);
      zeile('Verkehr', 'verkehr', [['aus', 'keiner'], ['wenig', 'wenig'], ['normal', 'normal'], ['viel', 'viel']]);
    } else {
      zeile('Gegner', 'gegner', (modell ? [1, 2, 3] : [3, 5, 7, 9]).map(n => [n, String(n)]), rennenAn);
      if (modell && E.gegner > 3) E.gegner = 3;
      zeile('Stärke der Gegner', 'staerke', [['leicht', 'leicht'], ['mittel', 'mittel'], ['schwer', 'schwer']], rennenAn);
      zeile('Runden', 'runden', (modell ? [3, 5, 10, 20] : [1, 3, 5, 10]).map(n => [n, String(n)]), rennenAn);
    }
    if (!modell) zeile('Kamera', 'kamera', [['hinten', 'hinter dem Auto'], ['weit', 'weiter weg'], ['cockpit', 'im Cockpit']]);
    zeile('Höchsttempo', 'tempo', [['langsam', 'langsam'], ['mittel', 'mittel'], ['schnell', 'schnell']], modell);
    zeile('Tanken und Reifen', 'boxen', [[true, 'an'], [false, 'aus']], modell && rennenAn);
    zeile('Ideallinie und Bremszonen', 'linie', [[true, 'an'], [false, 'aus']], !modell);
    zeile('Bremshilfe', 'bremshilfe', [[true, 'an'], [false, 'aus']], !slot);
    zeile('Lenkhilfe', 'lenkhilfe', [[true, 'an'], [false, 'aus']], !slot);
    zeile('Traktionskontrolle', 'traktion', [[true, 'an'], [false, 'aus']], !slot);
    zeile('Gas von allein', 'autogas', [[true, 'an'], [false, 'aus']], !slot);
    zeile('Grafik', 'grafik', [['hoch', 'schön'], ['mittel', 'mittel'], ['niedrig', 'schnell']]);
    // Farbe des eigenen Autos (Supercar: Lackfarbe, sonst Rennstall)
    const z = document.createElement('div'); z.className = 'zeile'; z.innerHTML = `<span>${sup ? 'Lackfarbe' : 'Dein Rennstall'}</span><div class="wahl"></div>`;
    if (sup) LACKE.forEach((l, k) => {
      const b = document.createElement('button'); b.className = 'farbe' + (E.lack === k ? ' an' : ''); b.title = l.name;
      const f = l.farbe ?? supercar(E.supercar).farbe;
      b.style.background = '#' + f.toString(16).padStart(6, '0');
      if (l.farbe === null) b.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,.35)';
      b.addEventListener('click', () => { E.lack = k; merken(); menueBauen(); });
      z.lastChild.appendChild(b);
    });
    else TEAMS.forEach((t, k) => {
      const b = document.createElement('button'); b.className = 'farbe' + (E.farbe === k ? ' an' : ''); b.title = t.team;
      b.style.background = `linear-gradient(135deg, #${t.farbe.toString(16).padStart(6, '0')} 60%, #${t.zweit.toString(16).padStart(6, '0')} 60%)`;
      b.addEventListener('click', () => { E.farbe = k; merken(); menueBauen(); });
      z.lastChild.appendChild(b);
    });
    ein.appendChild(z);
    const ton = document.createElement('div'); ton.className = 'zeile';
    ton.innerHTML = `<span>Ton</span><div class="wahl"><button class="${klang.an ? 'an' : ''}">an</button><button class="${klang.an ? '' : 'an'}">aus</button></div>`;
    ton.querySelectorAll('button').forEach((b, k) => b.addEventListener('click', () => { klang.schalten(k === 0); menueBauen(); }));
    ein.appendChild(ton);
    $('mBest').textContent = slot ? 'Slotcar: Du gibst nur Gas. Vor der Kurve vom Gas gehen, sonst fliegt das Auto raus! Spur wechseln: an einer gelben Weiche nach links oder rechts lenken. Boxengasse: auf der rechten Spur an der Einfahrt nach rechts lenken und im blauen Feld anhalten. Mit 🎥 wechselst du die Stelle, an der du stehst.'
      : modell ? 'Ferngesteuertes Auto: Du stehst neben der Bahn. Tanken und Reifen wechseln: in der Boxengasse rechts neben der Startgeraden im blauen Feld anhalten. Mit 🎥 wechselst du die Stelle, an der du stehst.'
      : sup ? 'Supercar: Rechts fährt der Verkehr in deine Richtung, links kommt dir Gegenverkehr entgegen. Auf der Autobahn ist der Gegenverkehr hinter der Mittelmauer. Überhol vorsichtig!' : '';
  };
  // Karten der Supercars: kleines Bild (Seitenansicht als Umriss), Name, Vorbild, Leistung
  function autosBauen() {
    const box = $('mAutos'); box.innerHTML = '';
    for (const S of SUPERCARS) {
      const b = document.createElement('button'); b.dataset.wert = S.id;
      const ps = Math.round(S.p.leistung / 735.5), kmhMax = Math.round(S.p.vMax * 3.6);
      b.innerHTML = `<canvas width="300" height="120"></canvas><b>${S.name}</b><small>Vorbild: ${S.vorbild}</small><small>${S.text}</small><span class="werte">${ps} PS · ${kmhMax} km/h · ${S.p.masse} kg</span>`;
      umriss(b.querySelector('canvas'), S, E.supercar === S.id && LACKE[E.lack] && LACKE[E.lack].farbe !== null ? LACKE[E.lack].farbe : S.farbe);
      b.classList.toggle('an', S.id === E.supercar);
      b.addEventListener('click', () => { E.supercar = S.id; merken(); menueBauen(); });
      box.appendChild(b);
    }
  }
  $('mFahrzeug').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { E.fahrzeug = b.dataset.wert; merken(); menueBauen(); } });
  $('mModus').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { E.modus = b.dataset.wert; merken(); menueBauen(); } });
  $('mStart').addEventListener('click', () => { klang.wecken(); starten(); });
  $('lbNeigen').addEventListener('click', async () => {
    const ok = await eingabe.neigung.start();
    $('lbNeigen').textContent = ok ? 'dieses Gerät ist das Lenkrad ✓' : 'Neigen geht hier nicht (nur auf Tablet/Handy über https)';
  });
  menueBauen();

  // ---------------------------------------------------------------- Handy verbinden: QR-Code
  const lenkradAnzeigen = () => {
    const s = empfang.status;
    $('lbCode').textContent = empfang.code || '…';
    const adr = empfang.code ? empfang.adresse() : '';
    $('lbAdresse').textContent = adr;
    const st = $('lbStatus');
    st.className = s === 'verbunden' ? 'verbunden' : '';
    st.textContent = { laden: 'Verbindung wird vorbereitet …', bereit: 'Wartet auf dein Handy …', verbunden: '✅ ' + (empfang.geraet || 'Handy') + ' ist verbunden', fehler: 'Kein Internet: Handy-Lenkrad geht gerade nicht' }[s] || s;
    if (adr && adr !== app.qrFuer) { app.qrFuer = adr; qrMalen($('qr'), adr); }
    const h = $('hHandy'); h.textContent = s === 'verbunden' ? '📱 Lenkrad' : '📱 –'; h.classList.toggle('an', s === 'verbunden');
  };
  empfang.wennStatus = () => {
    lenkradAnzeigen();
    // Handy verloren mitten im Rennen: anhalten
    if (laeuft && !pausiert && empfang.status !== 'verbunden' && eingabe.quelle === 'handy') pauseAn();
  };
  empfang.start().then(lenkradAnzeigen);
  lenkradAnzeigen();

  // ---------------------------------------------------------------- Spiel starten
  const zeige = (id, an) => { $(id).hidden = !an; };
  function starten() {
    zeige('laden', true);
    setTimeout(async () => {
      await Promise.all([ladeModelle(), ladeBilder(), E.fahrzeug === 'super' ? ladeSupercars() : null]);   // fertige 3D-Modelle (nur beim ersten Start; ohne Internet geht es nach ein paar Sekunden mit Kisten weiter)
      const modell = istKlein(), slot = E.fahrzeug === 'slot', sup = E.fahrzeug === 'super';
      const id = E[streckenFeld()];
      T = holeStrecke(id);
      rennen = new Rennen(T, { modus: E.modus, runden: sup ? E.runden_super : E.runden, gegner: sup ? E.gegner_super : modell ? Math.min(3, E.gegner) : E.gegner, staerke: E.staerke, art: E.fahrzeug, spielerFarbe: E.farbe, tempo: modell ? TEMPO[E.fahrzeug][E.tempo] || 0 : 0, boxen: modell && E.boxen,
        auto: E.supercar, lack: sup && LACKE[E.lack] ? LACKE[E.lack].farbe : null, verkehr: sup ? VERKEHR[E.verkehr] ?? 1 : 0 });
      kurven = rennen.L && !modell ? kurvenFinden(T, rennen.L, rennen.ich.a.p) : null;
      rennen.hilfe.bremsen = E.bremshilfe && !slot; rennen.hilfe.lenken = E.lenkhilfe && !slot;
      if (rennen.ich) rennen.ich.a.tc = E.traktion ? true : false;
      eingabe.autoGas = E.autogas && !slot;
      eingabe.sanft = E.fahrzeug === 'modell' ? 0.5 : 1;
      if (E.modus === 'zeit') {
        const g = ladeGeist(id, E.fahrzeug + geistArt());
        if (g) { rennen.setzeGeist(g); }
        rennen.wennBestzeit = neu => {
          const alt = ladeGeist(id, E.fahrzeug + geistArt());
          if (!alt || neu.zeit < alt.zeit) speichereGeist(id, E.fahrzeug + geistArt(), neu);
        };
      }
      rennen.wennBestzeit = rennen.wennBestzeit || null;
      if (!buehne || buehne.qualitaet !== E.grafik) { buehne = new Buehne($('bild'), E.grafik); app.buehne = buehne; }
      buehne.laden(T, rennen.autos, rennen.L, { linie: E.linie, verkehr: rennen.verkehr });
      $('hEinheit').textContent = modell ? 'km/h im Maßstab' : 'km/h';
      kamera = new Kamera(buehne.kamera);
      kamera.setze(modell ? 'stand' : E.kamera);
      groesse();
      zeige('menue', false); zeige('laden', false); zeige('ergebnis', false); zeige('pause', false); zeige('hud', true);
      zeige('pedale', !empfang.verbunden && eingabe.neigung.an);
      $('hHilfe').textContent = eingabe.quelle === 'handy' || empfang.verbunden ? (slot ? 'Spur wechseln: an einer gelben Weiche nach links oder rechts lenken' : '')
        : slot ? 'Gas ↑   Bremse ↓   Spur wechseln ← → (an einer gelben Weiche)   Standort C   Pause P'
        : sup ? 'Lenken ← →   Gas ↑   Bremse ↓ (im Stand: rückwärts)   Kamera C   Pause P   Zurück auf die Straße R'
        : 'Lenken ← →   Gas ↑   Bremse ↓ (im Stand: rückwärts)   Kamera C   Pause P   Zurück auf die Strecke R';
      kartenGrund = null;
      laeuft = true; pausiert = false; fertigGezeigt = false; letzteZeit = performance.now(); app.rennen = rennen; app.T = T; app.kamera = kamera;
      lenkradAnzeigen();
    }, 30);
  }

  function zumMenue() {
    laeuft = false; pausiert = false;
    zeige('hud', false); zeige('pause', false); zeige('ergebnis', false); zeige('menue', true);
    if (klang.ctx) klang.update({ ...rennen.ich.a, u: 0, gas: 0 }, null, false, false);
    menueBauen();
  }
  function pauseAn() { if (!laeuft) return; pausiert = true; zeige('pause', true); }
  function pauseAus() { pausiert = false; zeige('pause', false); letzteZeit = performance.now(); }
  function kameraWeiter() {
    if (!kamera) return;
    if (kamera.modus === 'stand') { kamera.standNr = (kamera.standNr + 1) % Math.max(1, buehne.welt.standorte.length); kamera.frisch = true; melden(buehne.welt.standorte[kamera.standNr].name); return; }
    const folge = ['hinten', 'weit', 'cockpit'];
    kamera.setze(folge[(folge.indexOf(kamera.modus) + 1) % folge.length]);
    melden(SICHTEN[kamera.modus]);
  }
  function zurueckAufStrecke() {
    const c = rennen && rennen.ich; if (!c || rennen.slot) return;
    const d = Math.max(-T.hb[c.a.idx] * 0.5, Math.min(T.hb[c.a.idx] * 0.5, c.a.d));
    aufStrecke(c.a, T, c.a.s, d);
    c.a.y = T.y[c.a.idx];
  }
  $('pause').addEventListener('click', e => {
    const a = e.target.dataset.a;
    if (a === 'weiter') pauseAus(); else if (a === 'neu') starten(); else if (a === 'menue') zumMenue();
    else if (a === 'kamera') kameraWeiter(); else if (a === 'mitte') { empfang.senden({ t: 'mitte' }); eingabe.neigung.kalibrieren(); pauseAus(); }
  });
  $('ergebnis').addEventListener('click', e => { const a = e.target.dataset.a; if (a === 'neu') starten(); else if (a === 'menue') zumMenue(); });
  $('hPause').addEventListener('click', () => pausiert ? pauseAus() : pauseAn());
  $('hKamera').addEventListener('click', kameraWeiter);
  // Pedale auf dem Bildschirm (wenn dieses Gerät selbst das Lenkrad ist)
  const pf = new Map();
  const pedalNeu = () => { const v = [...pf.values()]; eingabe.pedal.gas = v.includes('g') ? 1 : 0; eingabe.pedal.brems = v.includes('b') ? 1 : 0; $('pGas').classList.toggle('an', !!eingabe.pedal.gas); $('pBremse').classList.toggle('an', !!eingabe.pedal.brems); };
  $('pedale').addEventListener('pointerdown', e => { pf.set(e.pointerId, e.clientX > innerWidth / 2 ? 'g' : 'b'); pedalNeu(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('pedale').addEventListener(ev, e => { pf.delete(e.pointerId); pedalNeu(); });
  document.addEventListener('pointerdown', () => klang.wecken(), { once: false });

  // ---------------------------------------------------------------- Anzeige
  const melden = (text, art = 'info', dauer = 1.6) => {
    const m = $('hMeldung'); m.textContent = text; m.className = 'an ' + art; meldungBis = performance.now() + dauer * 1000;
  };
  let kartenGrund = null;
  function hudMalen() {
    const R = rennen, c = R.ich, a = c.a;
    const modell = !!T.def.modell;
    // Platz und Runde
    if (R.modus === 'rennen') {
      $('hPlatz').innerHTML = 'P' + c.platz + '<small>/' + R.autos.length + '</small>';
      $('hRunde').textContent = 'Runde ' + Math.max(1, Math.min(R.runden, c.runde)) + '/' + R.runden;
    } else { $('hPlatz').innerHTML = '⏱'; $('hRunde').textContent = c.runde > 0 ? 'Runde ' + c.runde : 'Anlauf zur Startlinie'; }
    // Liste der Fahrer
    if (R.modus === 'rennen') {
      $('hListe').innerHTML = R.reihenfolge.map(o => `<div class="${o.ich ? 'ich' : ''}"><b>${o.platz}</b><i style="background:#${o.farbe.toString(16).padStart(6, '0')}"></i>${o.ich ? 'Du' : o.name}${o.ziel !== null ? ' 🏁' : ''}</div>`).join('');
    } else $('hListe').innerHTML = '';
    // Zeiten
    const jetzt = c.runde > 0 ? R.zeit - c.rundeStart : 0;
    const ab = R.abstand();
    let z = `<div class="gross ${c.gueltig ? '' : 'ungueltig'}">${zeitText(c.runde > 0 && R.phase === 'los' && c.ziel === null ? jetzt : null)}</div>`;
    if (ab !== null) z += `<div class="${ab < 0 ? 'gut' : 'schlecht'}">${ab < 0 ? '−' : '+'}${Math.abs(ab).toFixed(2)}</div>`;
    z += `<div>Letzte ${zeitText(c.letzte)}</div><div>Beste ${zeitText(c.beste ?? (R.geistAlt ? R.geistAlt.zeit : null))}</div>`;
    $('hZeiten').innerHTML = z;
    // Tacho
    // Kleine Autos: Tempo auf ein großes Auto hochgerechnet (mal 30), damit man es vergleichen kann
    $('hKmh').textContent = Math.round(kmh(a) * (modell ? 1 / MASSSTAB : 1));
    $('hGang').textContent = R.slot ? (c.slot.raus > 0 ? '💥' : c.slot.spur > 0 ? '◀ links' : 'rechts ▶') : modell ? (a.u < -0.05 ? 'R' : '') : (a.u < -0.5 ? 'R' : Math.abs(a.u) < 0.3 && a.gas < 0.05 ? 'N' : a.gang);
    $('hDz').firstChild.style.width = (modell ? Math.min(1, Math.abs(a.u) / a.p.vMax) * 100 : Math.max(0, (a.drehzahl - 4000) / (a.p.drehzahlMax - 4000)) * 100).toFixed(1) + '%';
    // Hinweis über dem Tacho: beim Rennwagen der Gang für die nächste Kurve, bei den kleinen Autos Tank und Reifen
    let hin = '';
    if (kurven && R.phase === 'los') {
      const k = kurven.naechste[a.idx >= 0 ? a.idx : 0];
      if (k >= 0) {
        let weg = T.s[k] - a.s; if (weg < 0) weg += T.laenge;
        if (weg < 450) hin = `<span class="kurve">Kurve in ${Math.round(weg / 10) * 10} m</span><b class="${a.gang > kurven.gang[k] ? 'runter' : ''}">Gang ${kurven.gang[k]}</b>`;
      }
    }
    if (R.boxen) {
      const pr = v => Math.round(v * 100), kl = v => v < 0.25 ? 'knapp' : '';
      hin = `<span class="${kl(c.sprit)}">⛽ ${pr(c.sprit)} %</span><span class="${kl(c.reifen)}">🛞 ${pr(c.reifen)} %</span>` + (c.dienst > 0 ? '<b>Boxenstopp …</b>' : '');
    }
    if (hin !== app.hinAlt) { $('hKurve').innerHTML = hin; app.hinAlt = hin; }
    // Ampel
    const amp = $('hAmpel');
    amp.classList.toggle('an', R.phase === 'ampel');
    [...amp.children].forEach((l, k) => l.classList.toggle('an', k < R.ampel));
    // Meldungen aus dem Rennen
    while (R.ereignisse.length) {
      const m = R.ereignisse.shift();
      melden(m.text, m.art, m.art === 'ziel' ? 4 : 2);
      if (m.art === 'start') klang.piep(1100, 0.4, 0.3);
      if (m.art === 'beste') klang.piep(880, 0.25, 0.2);
    }
    if (performance.now() > meldungBis) $('hMeldung').className = '';
    // Karte
    const kc = $('hKarte'), ctx = kc.getContext('2d');
    if (!kartenGrund) { kartenGrund = document.createElement('canvas'); kartenGrund.width = kc.width; kartenGrund.height = kc.height; app.karte = karteMalen(kartenGrund, T, 'rgba(255,255,255,0.85)', 5); }
    ctx.clearRect(0, 0, kc.width, kc.height); ctx.drawImage(kartenGrund, 0, 0);
    const k = app.karte;
    for (const o of [...R.autos].sort(o => o.ich ? 1 : -1)) {
      ctx.fillStyle = o.ich ? '#ff3b30' : '#' + o.farbe.toString(16).padStart(6, '0');
      ctx.beginPath(); ctx.arc(k.x(o.a.x), k.y(o.a.z), o.ich ? 6 : 4, 0, 7); ctx.fill();
      if (o.ich) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    const gl = R.geistBei();
    if (gl) { ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(k.x(gl.x), k.y(gl.z), 4, 0, 7); ctx.fill(); }
  }

  function ergebnisZeigen() {
    const R = rennen;
    $('eTitel').textContent = R.ich.ziel !== null ? (R.ich.platz === 1 ? '🏆 Sieg!' : 'Platz ' + R.ich.platz) : 'Rennen vorbei';
    const sieger = R.reihenfolge[0];
    $('eTabelle').innerHTML = R.reihenfolge.map(o => `<tr class="${o.ich ? 'ich' : ''}"><td>${o.platz}.</td><td>${o.ich ? 'Du' : o.name}</td><td>${o.team}</td><td>${o.ziel !== null ? (o === sieger ? zeitText(o.ziel) : '+' + (o.ziel - sieger.ziel).toFixed(3)) : 'noch unterwegs'}</td><td>beste ${zeitText(o.beste)}</td></tr>`).join('');
    zeige('ergebnis', true);
  }

  // ---------------------------------------------------------------- Schleife
  const groesse = () => { if (buehne) buehne.groesse(innerWidth, innerHeight); };
  addEventListener('resize', groesse);

  function bild(dt, malen = true) {
    eingabe.update(dt);
    let b;
    while ((b = eingabe.holeBefehl())) {
      if (b === 'kamera') kameraWeiter();
      else if (b === 'pause') { if (laeuft) (pausiert ? pauseAus() : pauseAn()); }
      else if (b === 'zurueck') zurueckAufStrecke();
    }
    if (!laeuft) return;
    const R = rennen;
    if (!pausiert) {
      R.update(dt, { lenk: eingabe.lenk, gas: eingabe.gas, brems: eingabe.brems });
      const klein = !!T.def.modell;
      if (R.beruehrt) { klang.rumms(R.beruehrt * 0.08, klein); R.beruehrt = 0; }
      if (R.ich.a.stoss > (klein ? 0.1 : 3)) klang.rumms(Math.min(1, R.ich.a.stoss / (klein ? 1 : 25)), klein);
      // Slotcar fliegt raus: lauter Plastik-Knall
      const raus = !!(R.ich.slot && R.ich.slot.raus > 0);
      if (raus && !app.warRaus) klang.rumms(1, true);
      app.warRaus = raus;
      // Boxenstopp fängt an: Schlagschrauber
      const dienst = (R.ich.dienst || 0) > 0;
      if (dienst && !app.warDienst) klang.box(klein);
      app.warDienst = dienst;
      // Ampel piept
      if (R.phase === 'ampel' && R.ampel !== app.letzteAmpel) { if (R.ampel > 0) klang.piep(440, 0.15, 0.2); app.letzteAmpel = R.ampel; }
      if (R.phase === 'fertig' && !fertigGezeigt) { fertigGezeigt = true; setTimeout(ergebnisZeigen, 1200); }
    }
    kamera.update(dt, R.ich.a, { modell: !!T.def.modell, standorte: buehne.welt.standorte });
    if (!malen) return;
    buehne.malen(dt, R.ich.a, R.geistBei(), R.phase === 'ampel' ? R.ampel : 0, false, kamera.modus === 'cockpit' ? R.ich : null);
    hudMalen();
    // nächster Gegner (für den Klang)
    let naechster = null;
    for (const o of R.autos) if (!o.ich) { const d = Math.hypot(o.a.x - R.ich.a.x, o.a.z - R.ich.a.z); if (!naechster || d < naechster.ab) naechster = { a: o.a, ab: d }; }
    klang.update(R.ich.a, naechster, !!T.def.modell, !pausiert);
    // Infos ans Handy (10-mal pro Sekunde)
    infoTakt -= dt;
    if (infoTakt <= 0 && empfang.verbunden) {
      infoTakt = 0.1;
      const a = R.ich.a, rueck = (a.grund === 1 ? 0.6 : a.grund >= 2 ? 0.8 : 0) * Math.min(1, Math.abs(a.u) / (a.p.vMax * 0.2)) + Math.min(1, a.stoss * 0.1);
      empfang.senden({ t: 'i', v: kmh(a) * (T.def.modell ? 1 / MASSSTAB : 1), gang: T.def.modell ? 0 : a.gang, dz: Math.max(0, (a.drehzahl - 4000) / (a.p.drehzahlMax - 4000)), platz: R.modus === 'rennen' ? R.ich.platz : 0, von: R.autos.length, runde: R.ich.runde, runden: R.modus === 'rennen' ? R.runden : 0, r: +rueck.toFixed(2) });
    }
  }

  function schleife(t) {
    const dt = Math.min(0.05, (t - letzteZeit) / 1000 || 0.016);
    letzteZeit = t;
    if (!app.angehalten) bild(dt);
    requestAnimationFrame(schleife);
  }
  requestAnimationFrame(schleife);

  // Für Tests: Spiel ohne requestAnimationFrame vorspulen (wie __powershot.step in Powershot)
  // Gemalt wird nur das letzte Bild (Malen ist im Test-Browser ohne Grafikkarte sehr langsam)
  app.step = (n = 1, dt = 1 / 60) => { for (let k = 0; k < n; k++) bild(dt, k === n - 1); };
  app.starten = starten; app.zumMenue = zumMenue; app.kameraWeiter = kameraWeiter;
  app.zustand = () => ({ laeuft, pausiert });
}

// ---------------------------------------------------------------- nächste Kurve und passender Gang
// Eine Kurve ist dort, wo der Tempo-Plan der Ideallinie am langsamsten ist (Scheitelpunkt).
// Der Gang ergibt sich aus dem Tempo dort, genauso gerechnet wie die Gang-Anzeige in physik.js.
function kurvenFinden(T, L, p) {
  const n = T.n, t = L.tempo, w = Math.max(2, Math.round(25 / T.ds)), stufe = p.vMax / p.gaenge;
  const naechste = new Int32Array(n).fill(-1), gang = new Uint8Array(n);
  const scheitel = [];
  for (let i = 0; i < n; i++) {
    if (t[i] > p.vMax * 0.9) continue;
    let tief = true;
    for (let j = 1; j <= w && tief; j++) if (t[(i + j) % n] < t[i] || t[(i - j + n) % n] <= t[i]) tief = false;
    if (tief) { scheitel.push(i); gang[i] = Math.min(p.gaenge, Math.max(1, Math.floor(t[i] / stufe * 0.95) + 1)); }
  }
  if (!scheitel.length) return null;
  let k = scheitel[0];
  for (let i = 2 * n - 1; i >= 0; i--) { const m = i % n; if (gang[m]) k = m; naechste[m] = k; }
  return { naechste, gang, scheitel };
}

// ---------------------------------------------------------------- Streckenkarte (Menü und Anzeige)
function karteMalen(cv, T, farbe, dicke) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (let i = 0; i < T.n; i++) { minx = Math.min(minx, T.x[i]); maxx = Math.max(maxx, T.x[i]); minz = Math.min(minz, T.z[i]); maxz = Math.max(maxz, T.z[i]); }
  const rand = 14, sc = Math.min((W - 2 * rand) / (maxx - minx), (H - 2 * rand) / (maxz - minz));
  const ox = (W - (maxx - minx) * sc) / 2, oz = (H - (maxz - minz) * sc) / 2;
  const x = v => ox + (v - minx) * sc, y = v => oz + (v - minz) * sc;
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round'; ctx.lineWidth = dicke + 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  const pfad = () => { ctx.beginPath(); for (let i = 0; i < T.n; i += 2) i ? ctx.lineTo(x(T.x[i]), y(T.z[i])) : ctx.moveTo(x(T.x[i]), y(T.z[i])); ctx.closePath(); };
  pfad(); ctx.stroke();
  ctx.lineWidth = dicke; ctx.strokeStyle = farbe; pfad(); ctx.stroke();
  // Startlinie
  ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 3; ctx.beginPath();
  const nx = T.tz[0], nz = -T.tx[0];
  ctx.moveTo(x(T.x[0] + nx * T.hb[0] * 3), y(T.z[0] + nz * T.hb[0] * 3)); ctx.lineTo(x(T.x[0] - nx * T.hb[0] * 3), y(T.z[0] - nz * T.hb[0] * 3)); ctx.stroke();
  return { x, y };
}

// ---------------------------------------------------------------- QR-Code (Bibliothek qrcode-generator von jsDelivr)
let qrLib = null;
async function qrMalen(cv, text) {
  try {
    if (!qrLib) qrLib = await new Promise((ok, nein) => {
      if (window.qrcode) return ok(window.qrcode);
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
      s.onload = () => ok(window.qrcode); s.onerror = nein; document.head.appendChild(s);
    });
    const q = qrLib(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), ctx = cv.getContext('2d'), W = cv.width, rand = 4, z = (W - rand * 2) / n;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, W); ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(rand + c * z, rand + r * z, Math.ceil(z), Math.ceil(z));
  } catch (e) {
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#000'; ctx.font = '14px sans-serif'; ctx.fillText('QR-Code fehlt', 50, 110);
  }
}

// ---------------------------------------------------------------- Umriss eines Supercars für die Karte im Menü (Seitenansicht)
function umriss(cv, S, farbe) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  import('./supercarbau.js').then(({ FORMEN }) => {
    const F = FORMEN[S.id]; if (!F) return;
    const sc = W / 5.4, ox = W / 2 - (F.zF + F.zR) / 2 * sc, boden = H - 18;
    const X = z => ox + z * sc, Y = y => boden - y * sc;
    const hex = '#' + farbe.toString(16).padStart(6, '0');
    // Körper: von hinten unten über Heck, Hüfte, Kabine, Haube zur Nase
    const dachV = F.kv - F.scheibe, dachH = dachV - F.flach;
    ctx.beginPath();
    ctx.moveTo(X(F.zR), Y(0.25)); ctx.lineTo(X(F.zR), Y(F.heck - 0.1)); ctx.lineTo(X(F.zR + 0.25), Y(F.heck));
    ctx.quadraticCurveTo(X(F.kh), Y(F.huefte + 0.05), X(dachH), Y(F.dach)); ctx.lineTo(X(dachV), Y(F.dach));
    ctx.quadraticCurveTo(X(F.kv - F.scheibe * 0.3), Y(F.dach - 0.05), X(F.kv), Y(F.haube)); ctx.lineTo(X(F.zF - 0.35), Y(F.nase + 0.06));
    ctx.quadraticCurveTo(X(F.zF), Y(F.nase), X(F.zF), Y(0.25)); ctx.closePath();
    ctx.fillStyle = hex; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; ctx.stroke();
    // Fenster
    ctx.beginPath(); ctx.moveTo(X(F.kh + 0.35), Y(F.huefte)); ctx.quadraticCurveTo(X(dachH), Y(F.dach - 0.06), X(dachH + 0.1), Y(F.dach - 0.06));
    ctx.lineTo(X(dachV), Y(F.dach - 0.06)); ctx.lineTo(X(F.kv - 0.12), Y(F.haube + 0.04)); ctx.closePath(); ctx.fillStyle = '#16202c'; ctx.fill();
    // Räder
    for (const z of [1.25, -1.45]) { ctx.beginPath(); ctx.arc(X(z), Y(0.35), 0.35 * sc, 0, 7); ctx.fillStyle = '#111'; ctx.fill(); ctx.beginPath(); ctx.arc(X(z), Y(0.35), 0.2 * sc, 0, 7); ctx.fillStyle = '#9aa0a8'; ctx.fill(); }
    if (F.fluegel === 2) { ctx.fillStyle = '#111'; ctx.fillRect(X(F.zR + 0.1), Y(F.heck + 0.4), 0.5 * sc, 0.06 * sc); }
  });
}
