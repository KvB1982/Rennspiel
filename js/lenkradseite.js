// Rennspiel – die Seite auf dem Handy: Das Handy ist das Lenkrad.
//
// Handy quer halten wie ein Lenkrad. Drehen = lenken. Rechter Daumen = Gas, linker Daumen = Bremse.
// Oben: Kamera wechseln, Pause, zurück auf die Strecke, Mitte neu setzen.
// Die Seite öffnet man über den QR-Code im Spiel (Adresse mit ?lenkrad=CODE).

import { LenkradSender } from './verbindung.js';
import { Neigung, VOLL } from './neigung.js';

export function lenkradStarten(code, lokal) {
  document.body.className = 'handy';
  document.body.innerHTML = `
  <div id="hl">
    <div id="hlOben">
      <span id="hlStatus">Verbinde …</span>
      <span id="hlInfo"></span>
      <span class="hlKnoepfe">
        <button data-k="kamera">🎥 Kamera</button><button data-k="pause">⏸ Pause</button>
        <button data-k="zurueck">↺ Zurück</button><button id="hlMitte">⊙ Mitte</button><button id="hlEmpf"></button>
      </span>
    </div>
    <div id="hlBremse" class="pedal"><b>BREMSE</b><small>linker Daumen</small></div>
    <div id="hlMitteBox">
      <svg id="hlRad" viewBox="-120 -80 240 160" aria-hidden="true">
        <path d="M-100,-38 Q-112,-10 -100,38 L-70,52 Q0,64 70,52 L100,38 Q112,-10 100,-38 L70,-50 Q0,-62 -70,-50 Z" fill="#1d2026" stroke="#444a55" stroke-width="3"/>
        <rect x="-118" y="-42" width="26" height="84" rx="12" fill="#2b2f36"/><rect x="92" y="-42" width="26" height="84" rx="12" fill="#2b2f36"/>
        <rect x="-46" y="-30" width="92" height="40" rx="6" fill="#0b0d10" stroke="#30363f"/>
        <text id="hlTempo" x="0" y="-4" text-anchor="middle" font-size="22" fill="#7dff9a" font-family="monospace">0</text>
        <text id="hlGang" x="0" y="20" text-anchor="middle" font-size="12" fill="#ffd24a" font-family="monospace">N</text>
        <g id="hlLeds"></g>
        <circle cx="-64" cy="22" r="7" fill="#e33"/><circle cx="64" cy="22" r="7" fill="#29f"/><circle cx="-64" cy="-14" r="6" fill="#fc3"/><circle cx="64" cy="-14" r="6" fill="#3d6"/>
      </svg>
      <div id="hlZeiger"><i></i></div>
      <div id="hlHinweis">Handy quer halten wie ein Lenkrad und drehen</div>
    </div>
    <div id="hlGas" class="pedal"><b>GAS</b><small>rechter Daumen</small></div>
    <div id="hlStart"><div><h2>🏎️ Handy als Lenkrad</h2><p>Code <b id="hlCode"></b></p><p>Handy quer halten.<br>Tippen, um den Bewegungssensor einzuschalten.</p><button>Los geht's</button></div></div>
    <div id="hlQuer">Bitte das Handy quer halten ↻</div>
  </div>`;
  const $ = id => document.getElementById(id);
  $('hlCode').textContent = code.toUpperCase();
  const leds = $('hlLeds');
  for (let k = 0; k < 10; k++) leds.insertAdjacentHTML('beforeend', `<rect x="${-45 + k * 9.2}" y="-40" width="7" height="5" rx="1" fill="#222"/>`);

  const sender = new LenkradSender(code, lokal);
  const neig = new Neigung();
  const zustand = { gas: 0, brems: 0 };
  const statusText = {
    suchen: 'Suche das Spiel …', nichtGefunden: 'Spiel mit Code ' + code.toUpperCase() + ' nicht gefunden – ist es offen?',
    fehler: 'Keine Verbindung zum Internet', verbunden: '✅ Verbunden',
  };
  sender.wennStatus = s => { $('hlStatus').textContent = statusText[s] || s; document.body.classList.toggle('verbunden', s === 'verbunden'); };
  let letzteInfo = null;
  sender.wennDaten = d => {
    if (d.t === 'mitte') { neig.kalibrieren(); return; }
    if (d.t !== 'i') return;
    letzteInfo = d;
    $('hlTempo').textContent = Math.round(d.v);
    $('hlGang').textContent = d.gang ? 'Gang ' + d.gang : '';
    $('hlInfo').textContent = (d.platz ? 'P' + d.platz + '/' + d.von + '  ' : '') + (d.runden ? 'Runde ' + d.runde + '/' + d.runden : d.runde ? 'Runde ' + d.runde : '');
    const an = Math.round((d.dz || 0) * 10);
    [...leds.children].forEach((r, k) => r.setAttribute('fill', k < an ? (k < 4 ? '#2d4' : k < 7 ? '#fc2' : k < 9 ? '#f33' : '#58f') : '#222'));
    // Rütteln (nur Android kann das im Browser)
    if (d.r && navigator.vibrate) navigator.vibrate(Math.min(60, Math.round(d.r * 40)));
  };

  // Pedale: mehrere Finger gleichzeitig
  const finger = new Map();
  const pedalNeu = () => {
    zustand.gas = [...finger.values()].includes('gas') ? 1 : 0;
    zustand.brems = [...finger.values()].includes('brems') ? 1 : 0;
    $('hlGas').classList.toggle('an', !!zustand.gas); $('hlBremse').classList.toggle('an', !!zustand.brems);
  };
  const welchesPedal = x => x > window.innerWidth * 0.5 ? 'gas' : 'brems';
  const hl = $('hl');
  hl.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || e.target.closest('#hlStart')) return;
    e.preventDefault(); finger.set(e.pointerId, welchesPedal(e.clientX)); pedalNeu();
  });
  hl.addEventListener('pointermove', e => { if (finger.has(e.pointerId)) { finger.set(e.pointerId, welchesPedal(e.clientX)); pedalNeu(); } });
  const los = e => { finger.delete(e.pointerId); pedalNeu(); };
  hl.addEventListener('pointerup', los); hl.addEventListener('pointercancel', los);
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  document.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { sender.senden({ t: 'k', k: b.dataset.k }); if (navigator.vibrate) navigator.vibrate(15); }));
  $('hlMitte').addEventListener('click', () => { neig.kalibrieren(); });
  const empfText = () => $('hlEmpf').textContent = '🎚 ' + VOLL[neig.stufe - 1] + '°';
  $('hlEmpf').addEventListener('click', () => { neig.stufeWeiter(); empfText(); });
  empfText();

  // Start: Sensor erlauben, Bildschirm wach halten, Vollbild (Android)
  let wach = null;
  const wachHalten = async () => { try { if ('wakeLock' in navigator) wach = await navigator.wakeLock.request('screen'); } catch (e) {} };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wachHalten(); });
  $('hlStart').querySelector('button').addEventListener('click', async () => {
    const ok = await neig.start();
    if (!ok) $('hlHinweis').textContent = 'Kein Bewegungssensor erlaubt. Seite neu laden und „Erlauben“ tippen (nur über https).';
    try { if (document.documentElement.requestFullscreen && !/iPhone|iPad/.test(navigator.userAgent)) await document.documentElement.requestFullscreen(); } catch (e) {}
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) {}
    wachHalten();
    $('hlStart').remove();
    sender.verbinden();
  });

  // 60-mal pro Sekunde schicken, Lenkrad auf dem Bildschirm mitdrehen
  // Das gezeichnete Lenkrad dreht sich mit dem Handy von selbst mit. Der Balken darunter zeigt den Einschlag.
  const zeiger = $('hlZeiger').firstElementChild;
  const schleife = () => {
    const l = neig.lenk;
    zeiger.style.left = (50 - l * 48) + '%';
    if (neig.signal) $('hlHinweis').textContent = Math.abs(l) > 0.98 ? 'voll eingeschlagen' : l > 0.05 ? '◀ links' : l < -0.05 ? 'rechts ▶' : 'geradeaus';
    requestAnimationFrame(schleife);
  };
  requestAnimationFrame(schleife);
  setInterval(() => sender.senden({ t: 's', l: +neig.lenk.toFixed(3), g: zustand.gas, b: zustand.brems }), 16);

  // zum Testen ohne echtes Handy
  window.__lenkrad = { neig, sender, zustand, sensor: (beta, gamma) => neig.sensor({ beta, gamma }) };
}
