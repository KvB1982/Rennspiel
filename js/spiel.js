// Rennspiel – das Spiel auf dem großen Bildschirm: Menü, Spiel-Schleife, Anzeige, Ergebnis.

import { STRECKEN, strecke } from './strecken.js';
import { baueStrecke, MASSSTAB } from './strecke.js';
import { TEAMS, zeitText } from './rennen.js';
import { aufStrecke, kmh } from './physik.js';
import { Buehne } from './szene.js';
import { ladeModelle } from './modelle.js';
import { ladeBilder } from './texturen.js';
import { ladeSupercars } from './supercarbau.js';
import { ladeFormel, ladeVerkehr } from './automodelle.js';
import { ARTEN } from './verkehr.js';
import { Kamera, SICHTEN } from './kamera.js';
import { Eingabe } from './eingabe.js';
import { LenkradEmpfang } from './verbindung.js';
import { Klang, SPRECHER_WORTE } from './klang.js';
import { SUPERCARS, LACKE, supercar } from './supercars.js';
import { inApp, istApfelGeraet, teilPlugin } from './native.js';
import { zeitText as rallyeZeit, BEIFAHRER_WORTE } from './rallye.js';
import { baueRennen, TEMPO } from './rennbau.js';
import { Rekorder, raster, SCHRITT, SCHRITTE_MAX } from './rekorder.js';
import { Stand, PROFILE_MAX } from './stand.js';
import { RALLYEAUTOS, rallyeauto } from './rallyeautos.js';
import { ladeRallyeautos } from './supercarbau.js';

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- Einstellungen (werden im Browser gemerkt)
const STANDARD = {
  fahrzeug: 'f1', modus: 'rennen', strecke: 'kueste', strecke_modell: 'wohnzimmer', strecke_slot: 'slot_oval', strecke_drift: 'drift_matte', strecke_super: 'metropole', strecke_rallye: 'wp_seen', tempo: 'mittel',
  rallyeauto: 'sturmfalke', lack_rallye: 0, beifahrer: 'beides', ansagen: 'an',   // ansagen: Der Streckensprecher sagt „Letzte Runde!“, „Bestzeit!“ …
  kamera_rallye: 'hinten', kopfneigen: 'wenig',
  supercar: 'falkner', lack: 0, verkehr: 'normal', runden_super: 1, gegner_super: 5,
  gegner: 7, staerke: 'mittel', runden: 3, farbe: 0, kamera: 'hinten',
  kamera_klein: 'hinten',   // kleine Autos: hinter dem Auto, im Cockpit oder neben der Bahn stehen ('stand')
  bremshilfe: true, lenkhilfe: false, traktion: true, arcade: true, autogas: false, grafik: 'hoch', linie: true, boxen: true,
  messwerte: false,   // kleine Anzeige für Tüftler: Bilder pro Sekunde, Dreiecke, Lenkung, Gas, Bremse
  hud: false,      // Gang und Kurven-Gang groß in der Bildmitte (wie in der Scheibe eines echten Autos) statt unten rechts
  neigStufe: 3,    // wie weit man das Gerät dafür neigen muss (2 = weit … 5 = ganz wenig; Grad stehen in VOLL in neigung.js)
  neigen: false,   // dieses Gerät selbst neigen (Gas und Bremse auf dem Bildschirm), wenn kein Handy-Lenkrad verbunden ist
};
const streckenFeld = () => E.fahrzeug === 'modell' ? 'strecke_modell' : E.fahrzeug === 'slot' ? 'strecke_slot' : E.fahrzeug === 'drift' ? 'strecke_drift' : E.fahrzeug === 'super' ? 'strecke_super' : E.fahrzeug === 'rallye' ? 'strecke_rallye' : 'strecke';
// Kopfneigung in der Kurve: So stark legt sich das Bild in die Kurve (mal). "wenig" ist der Stand vom 25.11.2026.
const KOPF_STUFEN = { aus: 0, wenig: 1, stark: 2 };
const istKlein = () => E.fahrzeug === 'modell' || E.fahrzeug === 'slot' || E.fahrzeug === 'drift';   // die kleinen Autos (Maßstab 1:30, Drift 1:43)
// Der Spielstand: Profile („Wer fährt?“), Einstellungen, Bestzeiten, Drift-Rekorde, Geister (js/stand.js)
const speicher = (() => { try { localStorage.getItem('x'); return localStorage; } catch (e) { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } }; } })();
const stand = new Stand(speicher);
const PROFIL_FARBEN = ['#e3342f', '#3aa0ff', '#2fd06a', '#ffd24a', '#c56bff', '#ff8a3a'];
const E = {};
// Die Einstellungen des Profils holen, das gerade fährt (beim Start und nach „Wer fährt?“)
function einstLaden() {
  for (const k of Object.keys(E)) delete E[k];
  Object.assign(E, STANDARD);
  // iPad und iPhone: zuerst "mittel" (weniger Bildpunkte, weniger Häuser und Bäume), bis man selbst etwas anderes wählt
  if (istApfelGeraet()) { E.grafik = 'mittel'; E.neigen = true; }   // und zuerst durch Neigen steuern
  Object.assign(E, stand.einst());
  if (E.kopfneigen === true) E.kopfneigen = 'wenig'; else if (E.kopfneigen === false) E.kopfneigen = 'aus';   // früher gab es nur an und aus
  if (!(E.kopfneigen in KOPF_STUFEN)) E.kopfneigen = 'wenig';
  if (E.kamera_rallye === 'haube') E.kamera_rallye = 'cockpit';   // die Motorhauben-Kamera ist jetzt ein richtiges Cockpit
}
einstLaden();
const merken = () => stand.einstMerken(E);

// Bestzeiten und Geist-Runden. Die Bestzeit steht im Spielstand (winzig), der Geist (die ganze aufgezeichnete Runde)
// in einem eigenen Eintrag: Ist der Speicher des Geräts voll, geht nur ein Geist verloren – die Bestzeit bleibt.
const ladeGeist = (id, art) => stand.geist(id, art);
const speichereGeist = (id, art, g) => stand.geistSetzen(id, art, g);
const ladeBest = (id, art) => stand.best(id, art);
const speichereBest = (id, art, zeit) => stand.bestSetzen(id, art, zeit);

// Bestzeiten der kleinen Autos gelten je Höchsttempo (sonst wären sie nicht vergleichbar)
const geistArt = () => E.fahrzeug === 'f1' ? '' : E.fahrzeug === 'super' ? '.' + E.supercar : E.fahrzeug === 'rallye' ? '.' + E.rallyeauto : '.' + E.tempo + (E.fahrzeug === 'slot' ? '' : '.3');   // .3: seit es Turbo und die Arcade-Hilfe für die kleinen Autos gibt, zählen die alten Bestzeiten nicht mehr
// Die ganze Rallye: alle Prüfungen nacheinander
const RALLYE_FOLGE = ['wp_seen', 'wp_nebel', 'wp_pass', 'wp_alm'];
const ZAHLWORT = ['null', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht'];
const streckenCache = new Map();
const holeStrecke = id => { if (!streckenCache.has(id)) streckenCache.set(id, baueStrecke(strecke(id))); return streckenCache.get(id); };

export function starteSpiel() {
  const empfang = new LenkradEmpfang();
  const eingabe = new Eingabe(empfang);
  const klang = new Klang();
  let buehne = null, kamera = null, rennen = null, T = null;
  let kurven = null;   // für jede Stelle der Strecke: wo die nächste Kurve ist und welcher Gang dort passt
  let laeuft = false, pausiert = false, letzteZeit = 0, zeitRest = 0, infoTakt = 0, meldungBis = 0, fertigGezeigt = false;
  const rek = new Rekorder();   // schreibt jede Fahrt mit (js/rekorder.js); „Fahrt sichern“ macht daraus eine Datei
  const app = { E, empfang, eingabe, klang, rek, stand };
  const sprecher = new Beifahrer();
  window.__rennspiel = app;

  // ---------------------------------------------------------------- Menü
  const waehle = (box, wert) => [...$(box).children].forEach(b => b.classList.toggle('an', b.dataset.wert === String(wert)));
  // „Wer fährt?“: ein Knopf je Profil, dazu Neu und Bearbeiten
  const profileBauen = () => {
    const box = $('mProfil'); box.innerHTML = '<span>Wer fährt?</span>';
    for (const p of stand.profile) {
      const b = document.createElement('button'); b.className = 'profil' + (p.id === stand.aktiv.id ? ' an' : '');
      const punkt = document.createElement('i'); punkt.style.background = PROFIL_FARBEN[p.farbe % PROFIL_FARBEN.length];
      b.append(punkt, p.name);
      b.addEventListener('click', () => { if (p.id === stand.aktiv.id) return profilFenster(p); stand.wechseln(p.id); einstLaden(); menueBauen(); });
      box.appendChild(b);
    }
    if (stand.profile.length < PROFILE_MAX) { const neu = document.createElement('button'); neu.className = 'profil'; neu.textContent = '＋ Neu'; neu.addEventListener('click', () => profilFenster(null)); box.appendChild(neu); }
    const mehr = document.createElement('button'); mehr.className = 'profil'; mehr.textContent = '✎'; mehr.title = 'Namen ändern, Spielstand sichern und laden'; mehr.addEventListener('click', () => profilFenster(stand.aktiv)); box.appendChild(mehr);
  };
  // Das Fenster dazu: Namen eingeben oder ändern, Profil löschen, Spielstand als Datei sichern und laden
  let profilOffen = null;
  function profilFenster(p) {
    profilOffen = p;
    $('pfTitel').textContent = p ? 'Fahrer „' + p.name + '“' : 'Neuer Fahrer';
    $('pfName').value = p ? p.name : '';
    $('pfLoeschen').hidden = !p || stand.profile.length < 2; $('pfLoeschen').textContent = 'Diesen Fahrer löschen';
    $('pfMeldung').textContent = p ? '' : 'Jeder Fahrer hat eigene Einstellungen, Bestzeiten und Geister.';
    zeige('profilFenster', true);
    if (!p) $('pfName').focus();
  }
  $('profilFenster').addEventListener('click', e => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'ok') {
      const name = $('pfName').value;
      if (profilOffen) stand.umbenennen(profilOffen.id, name);
      else { merken(); if (stand.profilNeu(name)) einstLaden(); }
      zeige('profilFenster', false); menueBauen();
    } else if (a === 'zu') zeige('profilFenster', false);
    else if (a === 'loeschen') {
      // Zwei Tipps, damit nichts aus Versehen verschwindet
      if (e.target.textContent !== 'Wirklich löschen? Bestzeiten sind dann weg') { e.target.textContent = 'Wirklich löschen? Bestzeiten sind dann weg'; return; }
      stand.loeschen(profilOffen.id); einstLaden(); zeige('profilFenster', false); menueBauen();
    } else if (a === 'standSichern') {
      const zwei = n => String(n).padStart(2, '0'), d = new Date();
      dateiTeilen(`rennspiel_stand_${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}.json`, stand.paket(), e.target);
    } else if (a === 'standLaden') $('pfDatei').click();
  });
  $('pfDatei').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    let ok = false; try { ok = stand.einspielen(await f.text()); } catch (err) { console.error(err); }
    if (!ok) { $('pfMeldung').textContent = 'Diese Datei ist kein Spielstand vom Rennspiel. Es wurde nichts geändert.'; return; }
    einstLaden(); zeige('profilFenster', false); menueBauen();
  });
  const menueBauen = () => {
    profileBauen();
    waehle('mFahrzeug', E.fahrzeug); waehle('mModus', E.modus);
    // Strecken passend zum Fahrzeug
    const box = $('mStrecke'); box.innerHTML = '';
    const liste = STRECKEN.filter(s => E.fahrzeug === 'slot' ? s.slot : E.fahrzeug === 'drift' ? s.drift : E.fahrzeug === 'modell' ? s.modell && !s.slot && !s.drift : E.fahrzeug === 'super' ? s.strasse || s.auchSuper : E.fahrzeug === 'rallye' ? s.rallye : !s.modell && !s.strasse && !s.rallye);
    // Supercars: Auswahl des Autos
    $('mSuper').hidden = E.fahrzeug !== 'super' && E.fahrzeug !== 'rallye';
    $('mAutoTitel').textContent = E.fahrzeug === 'rallye' ? 'Dein Rallyeauto' : 'Dein Supercar';
    if (E.fahrzeug === 'super' || E.fahrzeug === 'rallye') autosBauen();
    // Rallye: Zeitfahren heißt hier "einzelne Prüfung", Rennen heißt "ganze Rallye"
    const [mz, mr] = [$('mModus').querySelector('[data-wert=zeit]'), $('mModus').querySelector('[data-wert=rennen]')];
    if (E.fahrzeug === 'rallye') {
      mz.innerHTML = '<span class="gross">⏱️</span><b>Eine Prüfung</b><small>Eine Wertungsprüfung gegen die Uhr – mit Geist-Auto deiner Bestzeit</small>';
      mr.innerHTML = '<span class="gross">🏆</span><b>Ganze Rallye</b><small>Alle ' + ZAHLWORT[RALLYE_FOLGE.length] + ' Prüfungen nacheinander, die Zeiten werden zusammengezählt</small>';
    } else {
      mz.innerHTML = '<span class="gross">⏱️</span><b>Zeitfahren</b><small>Allein gegen die Uhr, mit Geist-Auto deiner besten Runde</small>';
      mr.innerHTML = '<span class="gross">🏆</span><b>Rennen</b><small>Gegen Computerfahrer, mit Startampel</small>';
    }
    const feld = streckenFeld(), aktiv = E[feld];
    for (const def of liste) {
      const b = document.createElement('button'); b.dataset.wert = def.id;
      const T0 = holeStrecke(def.id);
      const best = ladeBest(def.id, E.fahrzeug + geistArt());
      const laenge = def.modell ? (T0.laenge).toFixed(1) + ' m' : (T0.laenge / 1000).toFixed(2) + ' km';
      b.innerHTML = `<canvas width="300" height="150"></canvas><b>${def.name}</b><small>${def.ort} · ${laenge}</small><small>${def.text}</small>${best ? `<span class="best">⏱ Bestzeit ${zeitText(best)}</span>` : ''}`;
      const cv = b.querySelector('canvas');
      // hinter dem Streckenplan: ein Bild aus dem Spiel, etwas abgedunkelt, damit man die Linie gut sieht
      cv.style.backgroundImage = `linear-gradient(rgba(8,12,20,.3), rgba(8,12,20,.55)), url(bilder/menue/strecke_${def.id}.webp)`;
      karteMalen(cv, T0, '#ffffff', 6);
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
        b.addEventListener('click', () => { E[schluessel] = typeof STANDARD[schluessel] === 'number' ? +wert : wert; merken(); menueBauen(); });   // an/aus bleibt an/aus, ein Wort wie 'neu' bleibt ein Wort
        w.appendChild(b);
      }
      ein.appendChild(z);
    };
    const rennenAn = E.modus === 'rennen', modell = istKlein(), slot = E.fahrzeug === 'slot', sup = E.fahrzeug === 'super', drift = E.fahrzeug === 'drift';   // modell = eines der kleinen Autos
    const rallye = E.fahrzeug === 'rallye';
    if (rallye) {
      zeile('Stärke der anderen Fahrer', 'staerke', [['leicht', 'leicht'], ['mittel', 'mittel'], ['schwer', 'schwer']]);
      zeile('Beifahrer', 'beifahrer', [['beides', 'spricht und zeigt'], ['bild', 'nur zeigen'], ['aus', 'aus']]);
      zeile('Kamera', 'kamera_rallye', [['hinten', 'hinter dem Auto'], ['weit', 'weiter weg'], ['cockpit', 'im Cockpit']]);
    } else if (sup) {
      zeile('Gegner', 'gegner_super', [3, 5, 7].map(n => [n, String(n)]), rennenAn);
      zeile('Stärke der Gegner', 'staerke', [['leicht', 'leicht'], ['mittel', 'mittel'], ['schwer', 'schwer']], rennenAn);
      zeile('Runden', 'runden_super', (strecke(E.strecke_super).rundenMax ? [1, 2] : [1, 2, 3, 5]).map(n => [n, String(n)]), rennenAn);
      // Verkehr gibt es nur auf Straßen – auf einer Rennstrecke (Hohenburg-Schleife) sind die Supercars unter sich
      zeile('Verkehr', 'verkehr', [['aus', 'keiner'], ['wenig', 'wenig'], ['normal', 'normal'], ['viel', 'viel']], !!strecke(E.strecke_super).strasse);
    } else {
      zeile('Gegner', 'gegner', (modell ? [1, 2, 3] : [3, 5, 7, 9]).map(n => [n, String(n)]), rennenAn);
      if (modell && E.gegner > 3) E.gegner = 3;
      zeile('Stärke der Gegner', 'staerke', [['leicht', 'leicht'], ['mittel', 'mittel'], ['schwer', 'schwer']], rennenAn);
      // sehr lange Strecken (rundenMax): höchstens zwei Runden – eine dauert schon so lange wie sonst ein ganzes Rennen
      zeile('Runden', 'runden', (modell ? [3, 5, 10, 20] : !sup && strecke(E.strecke).rundenMax ? [1, 2] : [1, 3, 5, 10]).map(n => [n, String(n)]), rennenAn);
    }
    if (!modell && !rallye) zeile('Kamera', 'kamera', [['hinten', 'hinter dem Auto'], ['weit', 'weiter weg'], ['cockpit', 'im Cockpit']]);
    zeile('Kamera', 'kamera_klein', [['hinten', 'hinter dem Auto'], ['cockpit', 'im Cockpit'], ['stand', 'neben der Bahn']], modell);
    // Kopfneigung: Das Bild legt sich in die Kurve (hinter dem Auto und im Cockpit; „aus“ gilt für beide)
    zeile('Kopf neigt sich in die Kurve', 'kopfneigen', [['aus', 'aus'], ['wenig', 'wenig'], ['stark', 'stark']], !slot);
    zeile('Höchsttempo', 'tempo', [['langsam', 'langsam'], ['mittel', 'mittel'], ['schnell', 'schnell']], modell);
    zeile('Tanken und Reifen', 'boxen', [[true, 'an'], [false, 'aus']], modell && rennenAn && !drift);
    zeile('Ideallinie und Bremszonen', 'linie', [[true, 'an'], [false, 'aus']], !modell && !rallye);
    // HUD: Gang, Tempo und der Gang für die nächste Kurve stehen mitten im Bild
    zeile('Gang-Anzeige', 'hud', [[false, 'unten rechts'], [true, 'HUD in der Mitte']], !modell);
    zeile('Bremshilfe', 'bremshilfe', [[true, 'an'], [false, 'aus']], !slot);
    zeile('Lenkhilfe', 'lenkhilfe', [[true, 'an'], [false, 'aus']], !slot);
    // Arcade-Hilfe (Rennwagen und Supercars): direkte Lenkung, und der Computer hilft unsichtbar, auf der Straße zu bleiben
    // Rallye: dazu „Neu“ = das schlichte Fahrmodell ohne ziehende Hilfen (schlichtSchritt in physik.js), zum Vergleichen mit den alten
    if (E.arcade === 'neu' && E.fahrzeug !== 'rallye') E.arcade = true;
    zeile('Fahrgefühl', 'arcade', E.fahrzeug === 'rallye' ? [[true, 'Arcade'], [false, 'echter'], ['neu', 'Neu (zum Ausprobieren)']] : [[true, 'Arcade'], [false, 'echter']], !modell || E.fahrzeug === 'modell');
    zeile('Traktionskontrolle', 'traktion', [[true, 'an'], [false, 'aus']], !slot && !drift);
    // Drift-Hilfe: dreht das Auto zurück, bevor es sich ganz quer stellt (gleiche Einstellung wie die Traktionskontrolle)
    zeile('Drift-Hilfe', 'traktion', [[true, 'an'], [false, 'aus (schwer)']], drift);
    zeile('Gas von allein', 'autogas', [[true, 'an'], [false, 'aus']], !slot);
    zeile('Dieses Gerät neigen', 'neigen', [[true, 'an'], [false, 'aus']], neigenGeht);
    zeile('Lenken beim Neigen', 'neigStufe', [[2, 'ruhig'], [3, 'normal'], [4, 'direkt'], [5, 'sehr direkt']], neigenGeht && E.neigen);
    zeile('Grafik', 'grafik', [['hoch', 'schön'], ['mittel', 'mittel'], ['niedrig', 'schnell']]);
    zeile('Messwerte anzeigen', 'messwerte', [[false, 'aus'], [true, 'an']]);
    // Farbe des eigenen Autos (Supercar: Lackfarbe, sonst Rennstall)
    const z = document.createElement('div'); z.className = 'zeile'; z.innerHTML = `<span>${sup || rallye ? 'Lackfarbe' : 'Dein Rennstall'}</span><div class="wahl"></div>`;
    const lackFeld = rallye ? 'lack_rallye' : 'lack';
    if (sup || rallye) LACKE.forEach((l, k) => {
      const b = document.createElement('button'); b.className = 'farbe' + (E[lackFeld] === k ? ' an' : ''); b.title = l.name;
      const f = l.farbe ?? (rallye ? rallyeauto(E.rallyeauto) : supercar(E.supercar)).farbe;
      b.style.background = '#' + f.toString(16).padStart(6, '0');
      if (l.farbe === null) b.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,.35)';
      b.addEventListener('click', () => { E[lackFeld] = k; merken(); menueBauen(); });
      z.lastChild.appendChild(b);
    });
    else TEAMS.forEach((t, k) => {
      const b = document.createElement('button'); b.className = 'farbe' + (E.farbe === k ? ' an' : ''); b.title = t.team;
      b.style.background = `linear-gradient(135deg, #${t.farbe.toString(16).padStart(6, '0')} 60%, #${t.zweit.toString(16).padStart(6, '0')} 60%)`;
      b.addEventListener('click', () => { E.farbe = k; merken(); menueBauen(); });
      z.lastChild.appendChild(b);
    });
    ein.appendChild(z);
    zeile('Ansagen (Stimme)', 'ansagen', [['an', 'an'], ['aus', 'aus']], !rallye);
    const ton = document.createElement('div'); ton.className = 'zeile';
    ton.innerHTML = `<span>Ton</span><div class="wahl"><button class="${klang.an ? 'an' : ''}">an</button><button class="${klang.an ? '' : 'an'}">aus</button></div>`;
    ton.querySelectorAll('button').forEach((b, k) => b.addEventListener('click', () => { klang.schalten(k === 0); menueBauen(); }));
    ein.appendChild(ton);
    $('mBest').textContent = rallye ? 'Rallye: Du fährst allein gegen die Uhr, die anderen Fahrer sind schon gefahren. Hör auf deinen Beifahrer: Die Zahl sagt, wie eng die Kurve ist (1 = Haarnadel, 6 = fast gerade), „und“ heißt, die nächste kommt gleich danach. Auf Schotter driftet das Auto – lenk dagegen und gib Gas. Handbremse: Leertaste oder Gas und Bremse zugleich. Nicht schneiden: Innen liegen Felsen!'
      : drift ? 'Drift-Rallye: Du lenkst, wohin das Auto fährt. Je mehr du einlenkst und Gas gibst, desto schräger stellt es sich – Gas weg oder gerade lenken, und es fängt sich wieder. Handbremse für Haarnadeln: Gas und Bremse gleichzeitig (Tastatur: Leertaste). Je schräger und schneller du rutschst, desto mehr Drift-Punkte. Hängst du Drifts aneinander, steigt der Faktor bis x5. In die Bande = Drift verloren. Drift-Turbo: Beim Driften sprühen Funken – erst blau, dann orange, dann rosa. Stellst du das Auto wieder gerade und gibst Gas, zündet der Turbo! Die leuchtenden Pfeile auf der Matte sind Turbo-Felder. Mit 🎥 wechselst du die Kamera.'
      : slot ? 'Slotcar: Du gibst nur Gas. Vor der Kurve vom Gas gehen, sonst fliegt das Auto raus! Spur wechseln: an einer gelben Weiche nach links oder rechts lenken. Boxengasse: auf der rechten Spur an der Einfahrt nach rechts lenken und im blauen Feld anhalten. Mit 🎥 wechselst du die Kamera.'
      : modell ? 'Ferngesteuertes Auto: Es fährt wie ein kleiner Rennwagen – auf der Geraden schaltet es bis in den 6. Gang, vor der Kurve bremst die Bremshilfe. Drift-Turbo: Fährst du hart durch die Kurve, stellt sich das Auto quer und Funken sprühen (blau, orange, rosa). Am Kurvenausgang zündet der Turbo! Noch weiter quer: Gas und Bremse gleichzeitig (Tastatur: Leertaste). Leuchtende Pfeile auf der Bahn sind Turbo-Felder. Tanken und Reifen wechseln: in der Boxengasse rechts neben der Startgeraden im blauen Feld anhalten. Mit 🎥 wechselst du die Kamera: hinter dem Auto, im Cockpit oder neben der Bahn.'
      : sup && !strecke(E.strecke_super).strasse ? 'Supercar auf der Rennstrecke: Hier gibt es keinen Verkehr und keinen Gegenverkehr – die ganze Breite gehört dir. Die Strecke ist sehr lang: Eine Runde dauert etwa sechs bis acht Minuten.'
      : sup ? 'Supercar: Rechts fährt der Verkehr in deine Richtung, links kommt dir Gegenverkehr entgegen. Auf der Autobahn ist der Gegenverkehr hinter der Mittelmauer. Überhol vorsichtig!' : '';
  };
  // Karten der Supercars: Bild des Autos in der gewählten Lackfarbe, Name, Vorbild, Leistung
  function autosBauen() {
    const box = $('mAutos'); box.innerHTML = '';
    const rallye = E.fahrzeug === 'rallye', feld = rallye ? 'rallyeauto' : 'supercar', lack = E[rallye ? 'lack_rallye' : 'lack'];
    for (const S of rallye ? RALLYEAUTOS : SUPERCARS) {
      const b = document.createElement('button'); b.dataset.wert = S.id;
      const ps = Math.round(S.p.leistung / 735.5), kmhMax = Math.round(S.p.vMax * 3.6);
      b.innerHTML = `<canvas width="600" height="240"></canvas><b>${S.name}</b><small>Vorbild: ${S.vorbild}</small><small>${S.text}</small><span class="werte">${ps} PS · ${kmhMax} km/h · ${S.p.masse} kg${S.jahr && rallye ? ' · Allrad' : ''}</span>`;
      autoBild(b.querySelector('canvas'), S, E[feld] === S.id && LACKE[lack] && LACKE[lack].farbe !== null ? LACKE[lack].farbe : S.farbe);
      b.classList.toggle('an', S.id === E[feld]);
      b.addEventListener('click', () => { E[feld] = S.id; merken(); menueBauen(); });
      box.appendChild(b);
    }
  }
  $('mFahrzeug').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { E.fahrzeug = b.dataset.wert; merken(); menueBauen(); } });
  $('mModus').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { E.modus = b.dataset.wert; merken(); menueBauen(); } });
  // Steuern durch Neigen dieses Geräts: nur wo es einen Bewegungssensor und einen Bildschirm zum Antippen gibt
  const neigenGeht = !!window.DeviceOrientationEvent && (navigator.maxTouchPoints > 0 || inApp);
  // Der Sensor darf nur direkt nach einem Fingertipp eingeschaltet werden (im Browser fragt das iPhone dann um Erlaubnis)
  const neigenAn = async () => {
    if (!E.neigen || !neigenGeht) { eingabe.neigung.stop(); return false; }
    eingabe.neigung.stufe = E.neigStufe;
    if (eingabe.neigung.an) return true;
    return await eingabe.neigung.start();
  };
  $('mEinst').addEventListener('click', () => { neigenAn(); });   // Einstellung „an“ getippt: gleich einschalten
  $('mStart').addEventListener('click', async () => { klang.wecken(); await neigenAn(); app.rallyeStand = null; starten(); });
  // App: Dieses Gerät wird zum Lenkrad für ein iPad in der Nähe
  $('lbNahLenkrad').addEventListener('click', () => { location.href = location.pathname + '?nahlenkrad'; });
  $('lbNeigen').addEventListener('click', async () => {
    const ok = await eingabe.neigung.start();
    if (ok) { E.neigen = true; merken(); menueBauen(); }
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
    st.textContent = { laden: 'Verbindung wird vorbereitet …', bereit: empfang.nah && empfang.netzFehler ? 'Kein Internet: QR-Code geht gerade nicht' : 'Wartet auf dein Handy …', verbunden: '✅ ' + (empfang.geraet || 'Handy') + ' ist verbunden', fehler: 'Kein Internet: Handy-Lenkrad geht gerade nicht' }[s] || s;
    if (inApp) $('lbNahStatus').textContent = empfang.nahVerbunden ? '✅ ' + (empfang.geraet || 'iPhone') + ' ist verbunden' : 'Wartet auf ein iPhone in der Nähe …';
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
    $('ladenText').textContent = 'Strecke wird gebaut …'; zeige('ladenZurueck', false);
    zeige('laden', true);
    // Geht beim Bauen etwas schief, soll das Ladebild nicht für immer stehen bleiben
    setTimeout(() => bauen().catch(e => {
      console.error(e);
      laeuft = false; pausiert = false; klang.ruhe(); wachAus();
      zeige('hud', false); zeige('pause', false); zeige('ergebnis', false);
      $('ladenText').textContent = 'Das hat leider nicht geklappt'; zeige('ladenZurueck', true);
    }), 30);
  }
  async function bauen() {
    {
      const rallye = E.fahrzeug === 'rallye';
      await Promise.all([ladeModelle(), ladeBilder(), ...(E.fahrzeug === 'super' ? [ladeSupercars(), ladeVerkehr(Object.keys(ARTEN))] : rallye ? [ladeRallyeautos()] : [ladeFormel()])]);   // fertige 3D-Modelle (nur beim ersten Start; ohne Internet geht es nach ein paar Sekunden mit Kisten weiter)
      const modell = istKlein(), slot = E.fahrzeug === 'slot', sup = E.fahrzeug === 'super', drift = E.fahrzeug === 'drift';
      // Ganze Rallye: welche Prüfung ist dran? (app.rallyeStand merkt sich die Zeiten der fertigen Prüfungen)
      if (rallye && E.modus === 'rennen' && !app.rallyeStand) app.rallyeStand = { nr: 0, fertig: [] };
      const ganz = rallye && E.modus === 'rennen';
      const id = ganz ? RALLYE_FOLGE[app.rallyeStand.nr] : E[streckenFeld()];
      T = holeStrecke(id);
      if (sprecher) sprecher.stopp();
      // Ton für diese Fahrt: der Motor des eigenen Autos und die Stimme (Rallye: Beifahrer, sonst Streckensprecher)
      klang.schweigen();
      klang.motorLaden(sup ? E.supercar : rallye ? E.rallyeauto : E.fahrzeug);
      if (rallye) klang.stimmeLaden('beifahrer', BEIFAHRER_WORTE); else klang.stimmeLaden('sprecher', SPRECHER_WORTE);
      rennen = baueRennen(E, T, ganz ? app.rallyeStand.nr + 1 : 0);   // Auto, Gegner, Hilfen (js/rennbau.js)
      kurven = rennen.L && !modell && !rallye ? kurvenFinden(T, rennen.LS, rennen.ich.a.p) : null;
      // Aufnahme der Fahrt beginnt: alles aufschreiben, was man zum Nachfahren wissen muss
      rek.start({ wann: new Date().toISOString(), strecke: id, rallyeNr: ganz ? app.rallyeStand.nr + 1 : 0, E: JSON.parse(JSON.stringify(E)),
        ampelAus: rennen.ampelAus ?? null, geraet: { ua: navigator.userAgent, breite: innerWidth, hoehe: innerHeight, punkte: devicePixelRatio || 1, app: inApp } });
      eingabe.autoGas = E.autogas && !slot;
      eingabe.sanft = 1;   // (früher lenkten die Tasten beim ferngesteuerten Auto langsamer – jetzt soll es direkt einlenken)
      eingabe.handbremseDa = drift || rallye || E.fahrzeug === 'modell';
      if (E.modus === 'zeit' || rallye) {
        const g = ladeGeist(id, E.fahrzeug + geistArt());
        if (g) { rennen.setzeGeist(g); }
        rennen.wennBestzeit = neu => {
          const art = E.fahrzeug + geistArt(), best = ladeBest(id, art), alt = ladeGeist(id, art);
          if (best === null || neu.zeit < best) speichereBest(id, art, neu.zeit);   // zuerst die Zeit (klein), dann der Geist (groß)
          if (!alt || neu.zeit < alt.zeit) speichereGeist(id, art, neu);
        };
      }
      rennen.wennBestzeit = rennen.wennBestzeit || null;
      if (!buehne || buehne.qualitaet !== E.grafik) {
        // Andere Grafik-Stufe: Der alte Zeichner wird freigegeben und bekommt eine frische Malfläche
        // (sonst bliebe sein Speicher belegt, und die Kantenglättung würde sich erst nach einem Neustart ändern).
        if (buehne) { const alt = $('bild'), neu = alt.cloneNode(false); buehne.weg(); alt.replaceWith(neu); }
        buehne = new Buehne($('bild'), E.grafik); app.buehne = buehne;
        buehne.wennVerloren = grafikWeg; buehne.wennZurueck = grafikDa;
        buehne.renderer.info.autoReset = false;   // Dreiecke und Zeichenaufrufe zählen wir selbst für ein ganzes Bild (siehe bild)
      }
      buehne.laden(T, rennen.autos, rennen.LS || rennen.L, { linie: E.linie, verkehr: rennen.verkehr, etappe: rallye ? rennen : null, felder: rennen.felder || [] });
      $('hEinheit').textContent = modell ? 'km/h im Maßstab' : 'km/h';
      kamera = new Kamera(buehne.kamera);
      kamera.setze(modell ? E.kamera_klein : rallye ? E.kamera_rallye : E.kamera);
      groesse();
      zeige('menue', false); zeige('laden', false); zeige('ergebnis', false); zeige('pause', false); zeige('hud', true);
      eingabe.neigung.kalibrieren();   // so wie man das Gerät beim Start hält, ist „geradeaus“
      pedaleZeigen();
      $('hHilfe').textContent = eingabe.quelle === 'handy' || empfang.verbunden ? (slot ? 'Spur wechseln: an einer gelben Weiche nach links oder rechts lenken' : drift || rallye ? 'Handbremse: Gas und Bremse gleichzeitig' : E.fahrzeug === 'modell' ? 'Quer stellen: Gas und Bremse gleichzeitig' : '')
        : eingabe.neigung.an && (drift || rallye) ? 'Gerät wie ein Lenkrad drehen   Gas rechts, Bremse links   Handbremse: beide zugleich'
        : eingabe.neigung.an ? (slot ? 'Gerät neigen = Spur wechseln (an einer gelben Weiche)   Gas rechts, Bremse links' : 'Gerät wie ein Lenkrad drehen   Gas rechts, Bremse links (im Stand: rückwärts)   Mitte neu setzen: Pause ⏸')
        : E.neigen && neigenGeht ? 'Der Bewegungssensor ist nicht erlaubt – Seite neu laden und „Erlauben“ tippen'
        : drift ? 'Lenken ← →   Gas ↑   Bremse ↓   Handbremse Leertaste   Kamera C   Pause P   Zurück auf die Matte R'
        : E.fahrzeug === 'modell' ? 'Lenken ← →   Gas ↑   Bremse ↓ (im Stand: rückwärts)   Quer stellen Leertaste   Kamera C   Pause P   Zurück auf die Strecke R'
        : rallye ? 'Lenken ← →   Gas ↑   Bremse ↓   Handbremse Leertaste   Kamera C   Pause P   Zurück auf den Weg R'
        : slot ? 'Gas ↑   Bremse ↓   Spur wechseln ← → (an einer gelben Weiche)   Kamera C   Pause P'
        : sup ? 'Lenken ← →   Gas ↑   Bremse ↓ (im Stand: rückwärts)   Kamera C   Pause P   Zurück auf die Straße R'
        : 'Lenken ← →   Gas ↑   Bremse ↓ (im Stand: rückwärts)   Kamera C   Pause P   Zurück auf die Strecke R';
      kartenGrund = null;
      laeuft = true; pausiert = false; fertigGezeigt = false; zeitRest = 0; letzteZeit = performance.now(); app.rennen = rennen; app.T = T; app.kamera = kamera;
      lenkradAnzeigen();
      wachAn();
    }
  }
  $('ladenZurueck').addEventListener('click', () => { zeige('laden', false); zumMenue(); });

  // ---------------------------------------------------------------- Bildschirm wach halten, Pause beim Verlassen
  // Wer nur neigt, tippt nicht: Ohne das hier würde der Bildschirm im Browser nach einer Weile dunkel.
  let wach = null;
  async function wachAn() { try { if (!wach && 'wakeLock' in navigator && !document.hidden) { wach = await navigator.wakeLock.request('screen'); wach.addEventListener('release', () => { wach = null; }); } } catch (e) {} }
  function wachAus() { try { if (wach) wach.release(); } catch (e) {} wach = null; }
  // App im Hintergrund, anderer Tab, Anruf: Das Rennen hält an und der Ton ist aus.
  // Beim Zurückkommen bleibt die Pause stehen, bis man „Weiterfahren“ tippt.
  function wegGegangen() { if (laeuft && !pausiert) pauseAn(); klang.schlafen(); }
  function wiederDa() { klang.aufwachen(); if (laeuft) wachAn(); letzteZeit = performance.now(); }
  document.addEventListener('visibilitychange', () => document.hidden ? wegGegangen() : wiederDa());
  window.addEventListener('pagehide', wegGegangen);
  document.addEventListener('pause', wegGegangen);    // die App meldet so, dass sie nicht mehr vorn ist (auch bei einem Anruf)
  document.addEventListener('resume', wiederDa);

  // Die Grafikkarte kann dem Spiel das Bild wegnehmen (das iPad macht das, wenn der Speicher knapp wird).
  // Dann: Pause, und wenn das Bild wieder da ist, die Strecke neu aufbauen.
  function grafikWeg() { app.grafikWeg = true; if (laeuft) pauseAn(); }
  function grafikDa() {
    app.grafikWeg = false;
    if (!laeuft || !buehne) return;
    try { buehne.neuLaden(); kamera = new Kamera(buehne.kamera); kamera.setze(app.kamera ? app.kamera.modus : 'hinten'); app.kamera = kamera; groesse(); melden('Das Bild ist wieder da', 'info', 3); }
    catch (e) { console.error(e); zumMenue(); }
  }

  function zumMenue() {
    laeuft = false; pausiert = false; app.rallyeStand = null;
    wachAus();
    if (sprecher) sprecher.stopp();
    zeige('hud', false); zeige('pause', false); zeige('ergebnis', false); zeige('menue', true);
    klang.ruhe(); klang.schweigen();   // im Menü ist alles still
    menueBauen();
  }
  function pauseAn() { if (!laeuft) return; pausiert = true; zeige('pause', true); if (sprecher) sprecher.stopp(); }
  function pauseAus() { pausiert = false; zeige('pause', false); letzteZeit = performance.now(); }
  function kameraWeiter() {
    if (!kamera) return;
    // Kleine Autos: hinter dem Auto → im Cockpit → neben der Bahn (dort nacheinander alle Stellen zum Stehen) → wieder von vorn
    if (T.def.modell) {
      const orte = buehne.welt.standorte;
      if (kamera.modus === 'hinten') kamera.setze('cockpit');
      else if (kamera.modus === 'cockpit' && orte.length) { kamera.setze('stand'); kamera.standNr = 0; }
      else if (kamera.modus === 'stand' && kamera.standNr + 1 < orte.length) { kamera.standNr++; kamera.frisch = true; }
      else kamera.setze('hinten');
      E.kamera_klein = kamera.modus; merken();
      melden(kamera.modus === 'stand' ? 'Neben der Bahn: ' + orte[kamera.standNr].name : SICHTEN[kamera.modus]);
      return;
    }
    const folge = ['hinten', 'weit', 'cockpit'];
    kamera.setze(folge[(folge.indexOf(kamera.modus) + 1) % folge.length]);
    melden(SICHTEN[kamera.modus]);
  }
  function zurueckAufStrecke() {
    const c = rennen && rennen.ich; if (!c || rennen.slot) return;
    rek.ereignis('zurueck');
    if (rennen.rallye) return rennen.zuruecksetzen();
    const d = Math.max(-T.hb[c.a.idx] * 0.5, Math.min(T.hb[c.a.idx] * 0.5, c.a.d));
    aufStrecke(c.a, T, c.a.s, d);
    c.a.y = T.y[c.a.idx];
  }
  $('pause').addEventListener('click', e => {
    const a = e.target.dataset.a;
    if (a === 'weiter') pauseAus(); else if (a === 'neu') starten(); else if (a === 'menue') zumMenue();
    else if (a === 'kamera') kameraWeiter(); else if (a === 'mitte') { empfang.senden({ t: 'mitte' }); eingabe.neigung.kalibrieren(); pauseAus(); }
  });
  $('ergebnis').addEventListener('click', e => {
    const a = e.target.dataset.a;
    if (a === 'neu') { if (rennen && rennen.rallye && app.rallyeStand) app.rallyeStand.fertig.length = app.rallyeStand.nr; starten(); }   // Prüfung nochmal: ihre Zeit zählt nicht
    else if (a === 'weiter') { app.rallyeStand.nr++; starten(); }
    else if (a === 'menue') zumMenue();
  });
  // Die zwei Knöpfe während der Fahrt gehen schon beim Berühren los: Liegt beim Neigen ein Daumen auf Gas oder Bremse,
  // kommt auf iPhone und iPad sonst oft gar kein „Klick“ an.
  const tipp = (b, tun) => {
    let eben = 0;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); eben = performance.now(); tun(); });
    b.addEventListener('click', () => { if (performance.now() - eben > 700) tun(); });
  };
  tipp($('hPause'), () => pausiert ? pauseAus() : pauseAn());
  tipp($('hKamera'), kameraWeiter);
  // Pedale auf dem Bildschirm (wenn dieses Gerät selbst das Lenkrad ist)
  const pf = new Map();
  // Die Pedale gibt es nur, solange dieses Gerät selbst das Lenkrad ist. Verbindet sich ein Handy, verschwinden sie.
  let pedaleDa = null;
  const pedaleZeigen = () => {
    const an = !empfang.verbunden && eingabe.neigung.an;
    if (an === pedaleDa) return;
    pedaleDa = an; zeige('pedale', an);
    if (!an) { pf.clear(); eingabe.pedal.gas = eingabe.pedal.brems = 0; $('pGas').classList.remove('an'); $('pBremse').classList.remove('an'); }
  };
  const pedalNeu = () => { const v = [...pf.values()]; eingabe.pedal.gas = v.includes('g') ? 1 : 0; eingabe.pedal.brems = v.includes('b') ? 1 : 0; $('pGas').classList.toggle('an', !!eingabe.pedal.gas); $('pBremse').classList.toggle('an', !!eingabe.pedal.brems); };
  $('pedale').addEventListener('pointerdown', e => { pf.set(e.pointerId, e.clientX > innerWidth / 2 ? 'g' : 'b'); pedalNeu(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('pedale').addEventListener(ev, e => { pf.delete(e.pointerId); pedalNeu(); });
  document.addEventListener('pointerdown', () => klang.wecken(), { once: false });

  // ---------------------------------------------------------------- Anzeige
  const melden = (text, art = 'info', dauer = 1.6) => {
    const m = $('hMeldung'); m.textContent = text; m.className = 'an ' + art; meldungBis = performance.now() + dauer * 1000;
  };
  let kartenGrund = null;
  // HUD in der Bildmitte (Einstellung „Gang-Anzeige“): Gang groß, links das Tempo, rechts der Gang für die nächste Kurve.
  // gang = was in der Mitte steht, tempo = km/h, dz = Drehzahl von 0 bis 1, kurve = Text rechts (oder '')
  function hudMitte(gang, tempo, dz, kurve) {
    const an = !!E.hud && !T.def.modell && rennen.phase !== 'ampel';   // an der Startampel ist dort oben die Ampel
    if (an !== app.hudAn) { $('hHud').hidden = !an; $('hHud').classList.toggle('rallye', !!rennen.rallye); $('hud').classList.toggle('mitte', an); app.hudAn = an; }
    if (!an) return;
    $('hudGang').textContent = gang;
    $('hudKmh').firstChild.textContent = tempo;
    const b = $('hudDz');
    b.firstChild.style.width = (dz * 100).toFixed(1) + '%';
    b.className = dz > 0.9 ? 'rot' : dz > 0.72 ? 'hoch' : '';   // kurz vor dem Schalten wird der Balken gelb, dann rot
    if (kurve !== app.hudKurveAlt) { $('hudKurve').innerHTML = kurve; app.hudKurveAlt = kurve; }
  }
  function hudMalen() {
    if (rennen.rallye) return hudRallye();
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
    $('hKmh').textContent = Math.round(kmh(a) / T.sc);
    $('hGang').textContent = R.slot ? (c.slot.raus > 0 ? '💥' : c.slot.spur > 0 ? '◀ links' : 'rechts ▶') : modell ? (a.u < -0.05 ? 'R' : a.p.gaenge > 1 ? (Math.abs(a.u) < 0.02 && a.gas < 0.05 ? 'N' : a.gang) : '') : (a.u < -0.5 ? 'R' : Math.abs(a.u) < 0.3 && a.gas < 0.05 ? 'N' : a.gang);
    $('hDz').firstChild.style.width = (modell && a.p.gaenge < 2 ? Math.min(1, Math.abs(a.u) / a.p.vMax) * 100 : Math.max(0, (a.drehzahl - 4000) / (a.p.drehzahlMax - 4000)) * 100).toFixed(1) + '%';
    // Hinweis über dem Tacho: beim Rennwagen der Gang für die nächste Kurve, bei den kleinen Autos Tank und Reifen
    let hin = '', mitte = '';
    if (kurven && R.phase === 'los') {
      const k = kurven.naechste[a.idx >= 0 ? a.idx : 0];
      if (k >= 0) {
        let weg = T.s[k] - a.s; if (weg < 0) weg += T.laenge;
        if (weg < 450) {
          const runter = a.gang > kurven.gang[k], m = Math.round(weg / 10) * 10;
          hin = `<span class="kurve">Kurve in ${m} m</span><b class="${runter ? 'runter' : ''}">Gang ${kurven.gang[k]}</b>`;
          mitte = `<b class="${runter ? 'runter' : ''}">${runter ? '▼' : '▸'} ${kurven.gang[k]}</b><small>Kurve in ${m} m</small>`;
        }
      }
    }
    // Mit HUD steht der Kurven-Gang in der Bildmitte, das Kästchen über dem Tacho bleibt dann leer
    if (E.hud && !modell) hin = '';
    hudMitte($('hGang').textContent, $('hKmh').textContent, modell ? 0 : Math.min(1, Math.max(0, (a.drehzahl - 4000) / (a.p.drehzahlMax - 4000))), mitte);
    if (R.boxen) {
      const pr = v => Math.round(v * 100), kl = v => v < 0.25 ? 'knapp' : '';
      hin = `<span class="${kl(c.sprit)}">⛽ ${pr(c.sprit)} %</span><span class="${kl(c.reifen)}">🛞 ${pr(c.reifen)} %</span>` + (c.dienst > 0 ? '<b>Boxenstopp …</b>' : '');
    }
    if (R.drift) {
      const D = c.drift || { gesamt: 0, laufend: 0, faktor: 1, winkel: 0, an: false };
      hin = `<span class="drift">🌀 ${D.gesamt.toLocaleString('de-DE')}</span>` + (D.an ? `<b>+${Math.round(D.laufend * D.faktor)}${D.faktor > 1 ? ' x' + D.faktor : ''} · ${Math.round(D.winkel)}°</b>` : (D.faktor > 1 ? `<span>Faktor x${D.faktor}</span>` : ''));
    }
    // Turbo: Ladung als Blitze (blau, orange, rosa), brennt er, steht es groß da
    if (R.turbo && c.tb) {
      const st = c.tb.stufe;
      hin += a.turbo > 0 ? '<b class="turbo an">🔥 TURBO</b>' : st > 0 ? `<b class="turbo s${st}">${'⚡'.repeat(st)}</b>` : '';
    }
    if (hin !== app.hinAlt) { $('hKurve').innerHTML = hin; app.hinAlt = hin; }
    $('hud').classList.toggle('turbo', a.turbo > 0);
    // Ampel
    const amp = $('hAmpel');
    amp.classList.toggle('an', R.phase === 'ampel');
    [...amp.children].forEach((l, k) => l.classList.toggle('an', k < R.ampel));
    // Meldungen aus dem Rennen
    while (R.ereignisse.length) {
      const m = R.ereignisse.shift();
      melden(m.text, m.art, m.art === 'ziel' ? 4 : m.art === 'turbo' ? 1 : 2);
      if (m.stimme && E.ansagen !== 'aus') klang.sagen('sprecher', m.stimme);
      if (m.art === 'start' || m.art === 'beste') klang.signal(m.art);
      if (m.art === 'ziel') klang.signal('jubel');
      if (m.art === 'turbo') klang.turbo(R.ich.a.turboStufe || 1);
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
    $('eWeiter').hidden = true;
    if (R.rallye) return ergebnisRallye();
    $('eTitel').textContent = R.ich.ziel !== null ? (R.ich.platz === 1 ? '🏆 Sieg!' : 'Platz ' + R.ich.platz) : 'Rennen vorbei';
    const sieger = R.reihenfolge[0];
    if (R.drift) {
      const D = R.ich.drift || { gesamt: 0, bester: 0 };
      const alt = stand.drift(T.def.id, E.tempo);
      stand.driftSetzen(T.def.id, E.tempo, D.gesamt);
      $('eTitel').textContent += ` · 🌀 ${D.gesamt.toLocaleString('de-DE')} Drift-Punkte` + (D.gesamt > alt && alt > 0 ? ' (neuer Rekord!)' : '');
    }
    $('eTabelle').innerHTML = R.reihenfolge.map(o => `<tr class="${o.ich ? 'ich' : ''}"><td>${o.platz}.</td><td>${o.ich ? 'Du' : o.name}</td><td>${o.team}</td><td>${o.ziel !== null ? (o === sieger ? zeitText(o.ziel) : '+' + (o.ziel - sieger.ziel).toFixed(3)) : 'noch unterwegs'}</td><td>beste ${zeitText(o.beste)}</td></tr>`).join('');
    zeige('ergebnis', true);
  }

  // ---------------------------------------------------------------- Rallye: Anzeige und Ergebnis
  function hudRallye() {
    const R = rennen, c = R.ich, a = c.a;
    $('hPlatz').innerHTML = R.nr ? 'WP ' + R.nr + '<small>/' + RALLYE_FOLGE.length + '</small>' : '⏱';
    const rest = Math.max(0, R.zielS - R.weg);
    $('hRunde').textContent = R.phase === 'start' ? 'Start in ' + Math.max(1, Math.ceil(R.countdown)) + ' …' : R.phase === 'los' ? (rest >= 1000 ? (rest / 1000).toFixed(1) + ' km' : Math.round(rest / 10) * 10 + ' m') + ' bis zum Ziel' : 'Im Ziel';
    // Liste: an der letzten Zwischenzeit die drei Schnellsten und du; nach dem Ziel die Wertung
    const zeile = (platz, name, zeit, ich) => `<div class="rallye ${ich ? 'ich' : ''}"><b>${platz}</b>${name}<span>${zeit}</span></div>`;
    let liste = '';
    if (R.tabelle && R.phase !== 'los') {
      const T5 = R.tabelle.slice(0, 5), ich = R.tabelle.find(o => o.ich);
      if (!T5.includes(ich)) T5.push(ich);
      liste = T5.map(o => zeile(o.platz, o.ich ? 'Du' : o.name, o.platz === 1 ? rallyeZeit(o.ziel) : '+' + (o.ziel - R.tabelle[0].ziel).toFixed(1), o.ich)).join('');
    } else {
      const k = R.zw.length;
      const zeitVon = o => k ? o.zw[k - 1] : o.zeit;
      const reihe = [...R.rivalen].sort((p, q) => zeitVon(p) - zeitVon(q));
      const kopf = `<div class="rallye"><span>${k ? 'Zwischenzeit ' + k : 'Bestzeiten'}</span></div>`;
      liste = kopf + reihe.slice(0, 3).map((o, n) => zeile(n + 1, o.name, rallyeZeit(zeitVon(o)), false)).join('');
      if (k) { const ich = R.zw[k - 1], platz = 1 + reihe.filter(o => zeitVon(o) < ich).length; liste += zeile(platz, 'Du', rallyeZeit(ich), true); }
    }
    if (liste !== app.listeAlt) { $('hListe').innerHTML = liste; app.listeAlt = liste; }
    // Zeiten
    const jetzt = R.phase === 'los' ? R.zeit : c.ziel;
    let z = `<div class="gross">${rallyeZeit(R.phase === 'start' ? 0 : jetzt)}</div>`;
    R.zw.forEach((t, k) => {
      const best = Math.min(...R.rivalen.map(o => o.zw[k])), ab = t - best;
      z += `<div class="zw">⏱${k + 1} ${rallyeZeit(t)} <span class="${ab <= 0 ? 'gut' : 'schlecht'}">${ab <= 0 ? '−' : '+'}${Math.abs(ab).toFixed(1)}</span></div>`;
    });
    const ab = R.abstand();
    if (ab !== null) z += `<div class="${ab < 0 ? 'gut' : 'schlecht'}">👻 ${ab < 0 ? '−' : '+'}${Math.abs(ab).toFixed(1)}</div>`;
    if (app.rallyeStand && app.rallyeStand.fertig.length) z += `<div class="zw">Gesamt ${rallyeZeit(app.rallyeStand.fertig.reduce((s, f) => s + f.zeit, 0) + (R.phase === 'los' ? R.zeit : c.ziel ?? 0))}</div>`;
    $('hZeiten').innerHTML = z;
    // Tacho
    $('hKmh').textContent = Math.round(kmh(a));
    $('hGang').textContent = a.u < -0.5 ? 'R' : Math.abs(a.u) < 0.3 && a.gas < 0.05 ? 'N' : a.gang;
    $('hDz').firstChild.style.width = (Math.max(0, (a.drehzahl - 3000) / (a.p.drehzahlMax - 3000)) * 100).toFixed(1) + '%';
    if (app.hinAlt !== '') { $('hKurve').innerHTML = ''; app.hinAlt = ''; }
    hudMitte($('hGang').textContent, $('hKmh').textContent, Math.min(1, Math.max(0, (a.drehzahl - 3000) / (a.p.drehzahlMax - 3000))), '');
    $('hAmpel').classList.remove('an');
    // Ansagen des Beifahrers als Bild
    const kommend = E.beifahrer === 'aus' ? [] : R.kommende(3);
    const key = kommend.map(n => n.s + ':' + Math.max(0, Math.round(n.weg / 10))).join();
    if (key !== app.ansageAlt) { app.ansageAlt = key; $('hAnsage').innerHTML = kommend.map((n, k) => ansageKarte(n, k === 0)).join(''); }
    // Meldungen
    while (R.ereignisse.length) {
      const m = R.ereignisse.shift();
      melden(m.text, m.art, m.art === 'ziel' ? 4 : m.art === 'zaehlen' ? 0.8 : 2.4);
      if (m.stimme && E.beifahrer === 'beides') klang.sagen('beifahrer', m.stimme, m.art === 'zaehlen' ? 1.1 : 1);
      if (m.art === 'zaehlen' || m.art === 'start' || m.art === 'beste') klang.signal(m.art);
      if (m.art === 'ziel') klang.signal('jubel');
    }
    if (performance.now() > meldungBis) $('hMeldung').className = '';
    // Karte
    const kc = $('hKarte'), ctx = kc.getContext('2d');
    if (!kartenGrund) { kartenGrund = document.createElement('canvas'); kartenGrund.width = kc.width; kartenGrund.height = kc.height; app.karte = karteMalen(kartenGrund, T, 'rgba(255,255,255,0.85)', 5); }
    ctx.clearRect(0, 0, kc.width, kc.height); ctx.drawImage(kartenGrund, 0, 0);
    const k = app.karte, gl = R.geistBei();
    if (gl) { ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(k.x(gl.x), k.y(gl.z), 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(k.x(a.x), k.y(a.z), 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }

  function ergebnisRallye() {
    const R = rennen, ich = R.ich, tab = R.tabelle || R.plaetze();
    const sieger = tab[0];
    let titel = ich.ziel !== null ? (ich.platz === 1 ? '🏆 Bestzeit! ' : 'Platz ' + ich.platz + ' · ') + rallyeZeit(ich.ziel) : 'Prüfung vorbei';
    const reihe = (o, bezug) => `<tr class="${o.ich ? 'ich' : ''}"><td>${o.platz}.</td><td>${o.ich ? 'Du' : o.name}</td><td>${o.ich ? ich.team : rallyeauto(o.team).name}</td><td>${o === bezug ? rallyeZeit(o.ziel) : '+' + (o.ziel - bezug.ziel).toFixed(1)}</td></tr>`;
    let html = `<tr class="kopf"><td colspan="4">${T.def.name}</td></tr>` + tab.map(o => reihe(o, sieger)).join('');
    const St = app.rallyeStand;
    if (St) {
      // Zeit dieser Prüfung merken (wer nicht ins Ziel kam, bekommt die langsamste Zeit plus eine Minute)
      const langsam = tab[tab.length - 1].ziel;
      St.fertig[St.nr] = { id: T.def.id, zeit: ich.ziel ?? (isFinite(langsam) ? langsam : 0) + 60, rivalen: Object.fromEntries(R.rivalen.map(o => [o.name, o.zeit])) };
      St.fertig.length = St.nr + 1;
      // Gesamtwertung nach dieser Prüfung
      const summe = name => St.fertig.reduce((s, f) => s + (name ? f.rivalen[name] : f.zeit), 0);
      const ges = [...R.rivalen.map(o => ({ name: o.name, team: o.auto, ziel: summe(o.name), ich: false })), { name: 'Du', team: ich.team, ziel: summe(null), ich: true }].sort((p, q) => p.ziel - q.ziel);
      ges.forEach((o, n) => { o.platz = n + 1; });
      const meinPlatz = ges.find(o => o.ich).platz, letzte = St.nr >= RALLYE_FOLGE.length - 1;
      html += `<tr class="kopf"><td colspan="4">${letzte ? 'Endstand der Rallye' : 'Gesamt nach ' + (St.nr + 1) + ' von ' + RALLYE_FOLGE.length + ' Prüfungen'}</td></tr>` + ges.map(o => reihe(o, ges[0])).join('');
      if (letzte) titel = meinPlatz === 1 ? '🏆 Rallye gewonnen!' : 'Rallye beendet – Platz ' + meinPlatz;
      $('eWeiter').hidden = letzte;
    }
    $('eTitel').textContent = titel;
    $('eTabelle').innerHTML = html;
    zeige('ergebnis', true);
  }

  // ---------------------------------------------------------------- Schleife
  const groesse = () => { if (buehne) buehne.groesse(innerWidth, innerHeight); };
  addEventListener('resize', groesse);

  // ---------------------------------------------------------------- Messwerte (Menü „Messwerte anzeigen“)
  const mess = { zeit: 1 / 60, bps: 60, lang: 0, dreiecke: 0, aufrufe: 0, takt: 0 };
  app.mess = mess;
  function messwerteMalen() {
    const box = $('hMess');
    if (box.hidden === !!E.messwerte) box.hidden = !E.messwerte;
    if (!E.messwerte) return;
    const balken = (id, w) => { $(id).style.width = Math.round(Math.abs(w) * 100) + '%'; };
    // Lenkung: Balken wächst von der Mitte nach links oder rechts
    const l = eingabe.lenk, lb = $('mLenk');
    lb.style.width = Math.abs(l) * 50 + '%'; lb.style.left = (l > 0 ? 50 - l * 50 : 50) + '%';
    balken('mGas', eingabe.gas); balken('mBrems', eingabe.brems);
    if (++mess.takt % 15) return;   // die Zahlen nur 4-mal pro Sekunde, sonst flimmern sie
    const tsd = n => n.toLocaleString('de-DE');
    $('mText').textContent = Math.round(mess.bps) + ' Bilder/s · ' + (mess.zeit * 1000).toFixed(1) + ' ms (längstes ' + (mess.lang * 1000).toFixed(0) + ')\n'
      + tsd(mess.dreiecke) + ' Dreiecke · ' + mess.aufrufe + ' Aufrufe · Schärfe ' + buehne.punkte.toFixed(2).replace('.', ',') + '\n'
      + 'Steuerung: ' + eingabe.quelle + (eingabe.quelle === 'neigen' ? ' ' + eingabe.neigung.winkel.toFixed(0) + '°' : '') + ' · Aufnahme ' + Math.round(rek.n / 120) + ' s';
  }

  // ---------------------------------------------------------------- Fahrt sichern
  // Macht aus der Aufnahme eine Datei. In der App geht das Teilen-Fenster auf (AirDrop, Dateien, Mail …),
  // im Browser auf Handy und iPad das Teilen des Browsers, am Rechner wird die Datei heruntergeladen.
  async function fahrtSichern(knopf) {
    if (!rek.kopf || !rek.n) return;
    const c = rennen && rennen.ich;
    if (c) rek.fertig({ phase: rennen.phase, zeit: rennen.zeit, ziel: c.ziel, beste: c.beste, letzte: c.letzte, zeiten: c.zeiten || [], platz: c.platz || 0, runde: c.runde || 0 });
    const text = JSON.stringify(rek.paket());
    const zwei = n => String(n).padStart(2, '0'), d = new Date();
    const auto = E.fahrzeug === 'super' ? E.supercar : E.fahrzeug === 'rallye' ? E.rallyeauto : E.fahrzeug;
    const name = `fahrt_${rek.kopf.strecke}_${auto}_${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}_${zwei(d.getHours())}${zwei(d.getMinutes())}${zwei(d.getSeconds())}.json`;
    dateiTeilen(name, text, knopf);
  }
  // Eine Datei aus dem Spiel herausgeben (Fahrt oder Spielstand). Der Knopf zeigt kurz, ob es geklappt hat.
  async function dateiTeilen(name, text, knopf) {
    app.letzteDatei = { name, text };
    const alt = knopf.textContent, sag = t => { knopf.textContent = t; setTimeout(() => { knopf.textContent = alt; }, 2500); };
    try {
      const T0 = teilPlugin();
      if (T0) { const r = await T0.datei({ name, text }); return sag(r && r.geteilt ? '✓ Gesichert' : 'Nicht gesichert'); }
      const datei = typeof File === 'function' ? new File([text], name, { type: 'application/json' }) : null;
      if (datei && 'ontouchstart' in window && navigator.canShare && navigator.canShare({ files: [datei] })) { await navigator.share({ files: [datei], title: name }); return sag('✓ Gesichert'); }
      const adr = URL.createObjectURL(new Blob([text], { type: 'application/json' })), l = document.createElement('a');
      l.href = adr; l.download = name; document.body.appendChild(l); l.click(); l.remove();
      setTimeout(() => URL.revokeObjectURL(adr), 5000);
      sag('✓ Datei liegt bei den Downloads');
    } catch (e) { if (e && e.name === 'AbortError') return sag('Nicht gesichert'); console.error(e); sag('Das hat nicht geklappt'); }
  }
  for (const b of document.querySelectorAll('[data-a=sichern]')) b.addEventListener('click', () => fahrtSichern(b));

  function bild(dt, malen = true) {
    eingabe.update(dt);
    let b;
    while ((b = eingabe.holeBefehl())) {
      if (b === 'kamera') kameraWeiter();
      else if (b === 'pause') { if (laeuft) (pausiert ? pauseAus() : pauseAn()); }
      else if (b === 'zurueck') zurueckAufStrecke();
    }
    if (!laeuft) return;
    pedaleZeigen();
    const R = rennen;
    if (!pausiert) {
      // Die Eingaben werden auf feste Stufen gerundet und mitgeschrieben – so lässt sich die Fahrt später genau nachfahren
      const ein = raster(SCHRITT, eingabe), klein = !!T.def.modell, ich = R.ich.a;
      // Fester Zeitschritt: Die vergangene Zeit wird gesammelt und in gleich großen Schritten von 1/120 Sekunde gerechnet.
      // So fährt das Auto auf jedem Gerät gleich – egal ob der Bildschirm 30, 60 oder 120 Bilder pro Sekunde zeigt.
      zeitRest += dt;
      let schritte = Math.round(zeitRest / SCHRITT);
      zeitRest -= schritte * SCHRITT;
      if (schritte > SCHRITTE_MAX) { schritte = SCHRITTE_MAX; zeitRest = 0; }
      for (let k = 0; k < schritte; k++) {
      R.update(ein.dt, ein);
      rek.bild(ein, ich, { neben: ich.idx >= 0 && Math.abs(ich.d) > T.hb[ich.idx] + 0.5 * T.sc, wand: ich.stoss > (klein ? 0.1 : 2), laeuft: R.phase === 'los', quelle: eingabe.quelle, winkel: eingabe.neigung.winkel, neu: k === 0 });
      if (rek.n % 240 === 0 && buehne) rek.messwert([Math.round(mess.bps), buehne.punkte, mess.dreiecke, mess.aufrufe]);
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
      if (R.phase === 'ampel' && R.ampel !== app.letzteAmpel) { if (R.ampel > 0) klang.signal('ampel'); app.letzteAmpel = R.ampel; }
      if (R.phase === 'fertig' && !fertigGezeigt) { fertigGezeigt = true; const dieses = R; setTimeout(() => { if (laeuft && rennen === dieses) ergebnisZeigen(); }, 1200); }   // wer inzwischen im Menü ist oder neu gestartet hat, bekommt kein Ergebnis mehr darübergelegt
      // Rallye: Der Beifahrer liest die nächste Ansage vor
      if (R.rallye && R.ansageNeu) { const g = R.ansageNeu; R.ansageNeu = null; if (E.beifahrer === 'beides' && !klang.sagen('beifahrer', g.worte, g.s - R.weg < 90 ? 1.12 : 1)) sprecher.sagen(g.sprache, g.s - R.weg); }   // zuerst die Aufnahmen; fehlt eine, liest die Stimme des Geräts
      }
    }
    kamera.update(dt, R.ich.a, { modell: !!T.def.modell, standorte: buehne.welt.standorte, massstab: T.sc, kopfMal: KOPF_STUFEN[E.kopfneigen] ?? 1 });
    if (!pausiert) buehne.schritt(dt, R.ich.a);
    if (!malen) return;
    buehne.renderer.info.reset();
    buehne.malen(dt, R.ich.a, R.geistBei(), R.phase === 'ampel' ? R.ampel : 0, false, kamera.modus === 'cockpit' ? R.ich : null);
    hudMalen();
    mess.dreiecke = buehne.renderer.info.render.triangles; mess.aufrufe = buehne.renderer.info.render.calls;
    messwerteMalen();
    // nächster Gegner (für den Klang)
    let naechster = null;
    for (const o of R.autos) if (!o.ich) { const d = Math.hypot(o.a.x - R.ich.a.x, o.a.z - R.ich.a.z); if (!naechster || d < naechster.ab) naechster = { a: o.a, ab: d }; }
    klang.update(R.ich.a, naechster, !!T.def.modell, !pausiert);
    // Infos ans Handy (10-mal pro Sekunde)
    infoTakt -= dt;
    if (infoTakt <= 0 && empfang.verbunden) {
      infoTakt = 0.1;
      const a = R.ich.a, rueck = (a.grund === 1 ? 0.6 : a.grund >= 2 ? 0.8 : 0) * Math.min(1, Math.abs(a.u) / (a.p.vMax * 0.2)) + Math.min(1, a.stoss * 0.1);
      empfang.senden({ t: 'i', v: kmh(a) / T.sc, gang: T.def.modell && a.p.gaenge < 2 ? 0 : a.gang, dz: Math.max(0, (a.drehzahl - 4000) / (a.p.drehzahlMax - 4000)), platz: R.modus === 'rennen' ? R.ich.platz : 0, von: R.autos.length, runde: R.ich.runde, runden: R.modus === 'rennen' ? R.runden : 0, r: +rueck.toFixed(2) });
    }
  }

  function schleife(t) {
    // t von requestAnimationFrame kann etwas vor performance.now() liegen (nach Start oder Pause): nie rückwärts rechnen
    const roh = (t - letzteZeit) / 1000 || 0.016;
    const dt = Math.max(0, Math.min(0.05, roh));
    letzteZeit = t;
    // Wie flüssig läuft es? Bildzeit weich gemittelt, dazu das längste Bild der letzten Sekunde
    if (roh > 0 && roh < 0.25) { mess.zeit += (roh - mess.zeit) * 0.05; mess.bps = 1 / mess.zeit; mess.lang = Math.max(mess.lang * 0.985, roh); }
    if (!app.angehalten) bild(dt);
    // Ruckelt es (z. B. auf dem iPad mit vielen Häusern), malt die Bühne mit weniger Bildpunkten
    if (laeuft && !pausiert && !app.angehalten && buehne) buehne.tempoPruefen(roh);
    requestAnimationFrame(schleife);
  }
  requestAnimationFrame(schleife);

  // Für Tests: Spiel ohne requestAnimationFrame vorspulen (wie __powershot.step in Powershot)
  // Gemalt wird nur das letzte Bild (Malen ist im Test-Browser ohne Grafikkarte sehr langsam)
  app.step = (n = 1, dt = 1 / 60, malen = true) => { for (let k = 0; k < n; k++) bild(dt, malen && k === n - 1); };
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

// ---------------------------------------------------------------- QR-Code (Bibliothek qrcode-generator von jsDelivr, in der App vom Gerät)
let qrLib = null;
async function qrMalen(cv, text) {
  try {
    if (!qrLib) qrLib = await new Promise((ok, nein) => {
      if (window.qrcode) return ok(window.qrcode);
      const s = document.createElement('script'); s.src = window.RENNSPIEL_LIB ? window.RENNSPIEL_LIB + 'qrcode.js' : 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
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

// ---------------------------------------------------------------- Bild eines Supercars für die Karte im Menü
// Die Bilder in bilder/menue/auto_<id>.webp zeigen das Auto mit blauem Lack (gemalt mit tools/autobilder.html).
// Hier wird das Blau Punkt für Punkt gegen die gewählte Lackfarbe getauscht – dieselbe Idee wie beim Auto im Spiel.
const autoBilder = new Map();   // id → Versprechen auf das geladene Bild
function autoBild(cv, S, farbe) {
  if (!autoBilder.has(S.id)) autoBilder.set(S.id, new Promise((ok, fehler) => { const b = new Image(); b.onload = () => ok(b); b.onerror = fehler; b.src = `bilder/menue/auto_${S.id}.webp`; }));
  autoBilder.get(S.id).then(bild => {
    const ctx = cv.getContext('2d', { willReadFrequently: true }), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H); ctx.drawImage(bild, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H), p = d.data;
    const lr = (farbe >> 16 & 255) / 255, lg = (farbe >> 8 & 255) / 255, lb = (farbe & 255) / 255;
    for (let k = 0; k < p.length; k += 4) {
      const grau = Math.min(p[k], p[k + 1]), blau = p[k + 2] - grau;   // grau = Glanzlicht, blau = so viel Lack ist hier
      if (blau < 6) continue;
      p[k] = Math.min(255, grau + lr * blau); p[k + 1] = Math.min(255, grau + lg * blau); p[k + 2] = Math.min(255, grau + lb * blau);
    }
    ctx.putImageData(d, 0, 0);
  }).catch(() => umriss(cv, S, farbe));   // kein Bild da: der gezeichnete Umriss von früher
}

// ---------------------------------------------------------------- Umriss eines Supercars (Seitenansicht, nur als Rückfall)
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

// ---------------------------------------------------------------- Rallye: der Beifahrer spricht (Sprachausgabe des Geräts)
class Beifahrer {
  constructor() {
    this.geht = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.stimme = null;
    if (this.geht) {
      const waehlen = () => {
        const alle = speechSynthesis.getVoices().filter(v => /^de/i.test(v.lang));
        // lieber eine klare, schnelle Stimme (auf Apple-Geräten heißen sie z. B. "Anna", "Markus", "Yannick")
        this.stimme = alle.find(v => /Markus|Yannick|Viktor|Martin|Google Deutsch/i.test(v.name)) || alle[0] || null;
      };
      waehlen(); speechSynthesis.onvoiceschanged = waehlen;
    }
  }
  // text sagen; weg = wie weit die Stelle noch weg ist (ist sie nah, spricht er schneller)
  sagen(text, weg = 150) {
    if (!this.geht || !text) return;
    // hängt er hinterher (noch zwei Sätze offen), wird der älteste abgebrochen – lieber kurz als zu spät
    if (speechSynthesis.pending) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE'; if (this.stimme) u.voice = this.stimme;
    u.rate = weg < 90 ? 1.55 : 1.35; u.pitch = 1; u.volume = 1;
    speechSynthesis.speak(u);
  }
  stopp() { if (this.geht) speechSynthesis.cancel(); }
}

// Eine Karte für die Anzeige: Pfeil mit Zahl (Kurve) oder ein Zeichen (Kuppe, Sprung, Wasser …)
function ansageKarte(n, erst) {
  const t = n.text || { haupt: '', mehr: '', weiter: '' };
  const kurve = n.art === 'kurve';
  const bild = kurve ? pfeilSvg(n.seite, n.grad, n.zusatz.includes('kehre'))
    : `<div class="zeichen">${{ kuppe: '⛰️', sprung: '🚀', wasser: '🌊', matsch: '🟤', ziel: '🏁' }[n.art] || '•'}</div>`;
  const zahl = kurve ? `<div class="zahl">${n.zusatz.includes('kehre') ? 'K' : n.grad}</div>` : `<div class="was">${t.haupt}</div>`;
  const weg = erst ? `<div class="weg">${n.weg > 5 ? Math.round(n.weg / 10) * 10 + ' m' : 'jetzt'}</div>` : (t.weiter ? `<div class="weg">${t.weiter === 'und' ? 'und' : t.weiter + ' m'}</div>` : '');
  return `<div class="karte ${erst ? 'erst' : ''} ${n.achtung ? 'warn' : ''}">${bild}${zahl}${t.mehr ? `<div class="was">${t.mehr}</div>` : ''}${weg}</div>`;
}

// Pfeil für eine Kurve: je kleiner die Zahl, desto enger der Bogen (1 = Haarnadel, 6 = leichter Knick)
function pfeilSvg(seite, grad, kehre) {
  const g = Math.max(1, Math.min(6, grad || 3));
  const winkel = (kehre ? 180 : [160, 120, 95, 72, 50, 30][g - 1]) * Math.PI / 180, radius = kehre ? 9 : [10, 13, 17, 22, 30, 42][g - 1];
  const sg = seite === 'links' ? -1 : 1, pts = [[0, 0]];
  let x = 0, y = 0, h = 0;
  const schritt = l => { x += Math.sin(h) * l; y -= Math.cos(h) * l; pts.push([x, y]); };
  schritt(20);
  for (let k = 0; k < 18; k++) { h += sg * winkel / 18; schritt(radius * winkel / 18); }
  schritt(6);
  // Pfeilspitze
  const sx = Math.sin(h), sy = -Math.cos(h), qx = -sy, qy = sx;
  const spitze = [[x + sx * 11, y + sy * 11], [x + qx * 9, y + qy * 9], [x - qx * 9, y - qy * 9]];
  const alle = pts.concat(spitze);
  const minX = Math.min(...alle.map(p => p[0])) - 6, maxX = Math.max(...alle.map(p => p[0])) + 6, minY = Math.min(...alle.map(p => p[1])) - 6, maxY = Math.max(...alle.map(p => p[1])) + 6;
  const w = Math.max(maxX - minX, maxY - minY), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const f = v => v.toFixed(1);
  return `<svg viewBox="${f(cx - w / 2)} ${f(cy - w / 2)} ${f(w)} ${f(w)}"><path d="M${pts.map(p => f(p[0]) + ' ' + f(p[1])).join(' L')}" stroke="#fff" stroke-width="${f(w * 0.09)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M${spitze.map(p => f(p[0]) + ' ' + f(p[1])).join(' L')}Z" fill="#fff"/></svg>`;
}
