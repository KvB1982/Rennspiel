// Rennspiel – Bilder für Oberflächen, selbst gemalt (keine Bilddateien nötig).
// Jedes Bild wird einmal auf eine unsichtbare Leinwand (canvas) gemalt und dann als Textur benutzt.
//
// Dazu kommen ein paar echte Fotos aus dem Ordner bilder/ (Gras und Asphalt von Poly Haven, flache Baum-Bilder).
// ladeBilder() holt sie einmal vor dem Bauen der Welt. Fehlt ein Foto, bleibt es beim gemalten Bild.

import * as THREE from 'three';

// Zufall, der jedes Mal gleich ausfällt (damit die Strecke immer gleich aussieht)
export function zufall(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

// Weiches Rauschen (für Hügel, Flecken im Gras …): Werte etwa −1 … 1
export function rauschen(seed = 7) {
  const P = new Uint8Array(512), r = zufall(seed);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const n = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = P[X] + Y, b = P[X + 1] + Y;
    const l1 = grad(P[a], x, y) + u * (grad(P[b], x - 1, y) - grad(P[a], x, y));
    const l2 = grad(P[a + 1], x, y - 1) + u * (grad(P[b + 1], x - 1, y - 1) - grad(P[a + 1], x, y - 1));
    return l1 + v * (l2 - l1);
  };
  // mehrere Lagen übereinander: grob + fein
  return (x, y, lagen = 4) => { let s = 0, a = 1, f = 1, sum = 0; for (let k = 0; k < lagen; k++) { s += n(x * f, y * f) * a; sum += a; a *= 0.5; f *= 2; } return s / sum * 1.4; };
}

function leinwand(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

function textur(c, wiederholen = true, farbe = true) {
  const t = new THREE.CanvasTexture(c);
  if (wiederholen) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (farbe) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Aus einem Graubild (Höhen) eine "Normal-Map" machen: Sie lässt flache Flächen rau und körnig wirken
function normalAus(ctx, w, h, staerke = 2) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const [c, o] = leinwand(w, h);
  const img = o.createImageData(w, h);
  const H = (x, y) => d[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * staerke, dy = (H(x, y + 1) - H(x, y - 1)) * staerke;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  return textur(c, true, false);
}

// ---------------------------------------------------------------- Fotos aus bilder/
const FOTOS = {
  gras: 'bilder/gras.jpg', asphalt: 'bilder/asphalt.jpg',
  baum_fichte: 'bilder/baum_fichte.webp', baum_laub: 'bilder/baum_laub.webp', baum_pinie: 'bilder/baum_pinie.webp', baum_zypresse: 'bilder/baum_zypresse.webp',
};
const fotos = {};
let fotosLaufen = null;
// Alle Fotos laden. Wartet höchstens `bis` Millisekunden. Mit ?ohnemodelle bleibt alles selbst gemalt.
export function ladeBilder({ bis = 6000 } = {}) {
  if (typeof location !== 'undefined' && /ohnemodelle|ohnefotos/.test(location.search)) return Promise.resolve();
  if (!fotosLaufen) fotosLaufen = Promise.all(Object.entries(FOTOS).map(([n, datei]) => new Promise(ok => {
    const b = new Image();
    b.onload = () => { fotos[n] = b; ok(); };
    b.onerror = ok;
    b.src = datei;
  })));
  return Promise.race([fotosLaufen, new Promise(ok => setTimeout(ok, bis))]);
}
// Ein geladenes Foto (Bild-Element) oder null
export const foto = name => fotos[name] || null;
// Foto auf eine Leinwand malen und als Textur zurückgeben
function fotoTextur(name, w = 512) {
  const [c, x] = leinwand(w);
  x.drawImage(fotos[name], 0, 0, w, w);
  return textur(c);
}

const cache = new Map();
const merk = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

// Körniger Belag (Asphalt, Kies, Teppich …): Grundfarbe mit vielen kleinen Punkten
function koernig(name, w, grund, punkte, menge, groesse, normal = 2) {
  return merk(name, () => {
    const [c, x] = leinwand(w), r = zufall(name.length * 977);
    x.fillStyle = grund; x.fillRect(0, 0, w, w);
    const [hc, hx] = leinwand(w); hx.fillStyle = '#808080'; hx.fillRect(0, 0, w, w);
    for (let i = 0; i < menge; i++) {
      const px = r() * w, py = r() * w, s = groesse * (0.4 + r() * 0.9);
      x.fillStyle = punkte[Math.floor(r() * punkte.length)]; x.globalAlpha = 0.35 + r() * 0.6;
      x.fillRect(px, py, s, s);
      const g = Math.floor(80 + r() * 175); hx.fillStyle = `rgb(${g},${g},${g})`; hx.fillRect(px, py, s, s);
    }
    x.globalAlpha = 1;
    return { map: textur(c), normalMap: normalAus(hx, w, w, normal) };
  });
}

// Asphalt: Farbe vom Foto (wenn geladen), die Körnung ("Normal-Map") bleibt selbst gemacht
export const asphalt = () => merk('asphalt+', () => {
  const k = koernig('asphalt', 512, '#4a4c50', ['#2c2d30', '#5d6064', '#6f7276', '#3a3b3e', '#7d7f82'], 26000, 2.2, 3);
  return fotos.asphalt ? { map: fotoTextur('asphalt'), normalMap: k.normalMap } : k;
});
export const kies = () => koernig('kies', 256, '#b7a786', ['#d8ccb0', '#8f8068', '#a89878', '#e9e0cc', '#6f6450'], 9000, 3.2, 4);
export const teppich = () => koernig('teppich', 256, '#7a2f35', ['#8d3a40', '#6a272c', '#9a4a4e', '#5c2025'], 12000, 2, 2);
export const beton = () => koernig('beton', 256, '#a9a9a4', ['#bdbdb8', '#929290', '#b4b3ad', '#8a8a86'], 7000, 2, 1.5);
export const sand = () => koernig('sand', 256, '#d9c79c', ['#e8d9b2', '#c7b386', '#f0e4c6'], 8000, 1.6, 2);

export const gras = () => merk('gras', () => {
  if (fotos.gras) return { map: fotoTextur('gras') };
  const w = 256, [c, x] = leinwand(w), r = zufall(31);
  x.fillStyle = '#4f7a32'; x.fillRect(0, 0, w, w);
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = ['#5d8a3a', '#3f6a28', '#6b9643', '#466f2c', '#7aa34e'][Math.floor(r() * 5)];
    x.globalAlpha = 0.5; x.fillRect(r() * w, r() * w, 1 + r() * 2, 2 + r() * 4);
  }
  x.globalAlpha = 1;
  return { map: textur(c) };
});

// Rasen mit gemähten Streifen (hell/dunkel) – für den Platz direkt neben der Strecke
export const rasenStreifen = () => merk('rasenStreifen', () => {
  const w = 256, [c, x] = leinwand(w);
  x.drawImage(gras().map.image, 0, 0, w, w);
  x.fillStyle = 'rgba(255,255,220,0.10)'; x.fillRect(0, 0, w, w / 2);
  x.fillStyle = 'rgba(0,20,0,0.08)'; x.fillRect(0, w / 2, w, w / 2);
  return { map: textur(c) };
});

// Randstein: rot und weiß im Wechsel
export const kerb = (rot = '#d32222') => merk('kerb' + rot, () => {
  const [c, x] = leinwand(64, 128);
  x.fillStyle = rot; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 64, 64, 64);
  // Rillen quer
  x.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 128; i += 16) x.fillRect(0, i, 64, 3);
  return { map: textur(c) };
});

// Zielflagge (schwarz-weiß kariert)
export const karo = () => merk('karo', () => {
  const [c, x] = leinwand(128, 32);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5'; x.fillRect(i * 8, j * 8, 8, 8); }
  return { map: textur(c) };
});

// Werbebanden mit ausgedachten Namen
const WERBUNG = [['VOLTARA', '#0d3b8c', '#fff'], ['BLITZBRAUSE', '#e2231a', '#fff'], ['NORDLICHT', '#1a1a1a', '#5fe0ff'], ['KOMETA REIFEN', '#f6c400', '#111'],
  ['SPEEDOMAT', '#ffffff', '#e2231a'], ['AQUAMONT', '#0a7f6f', '#fff'], ['FUNKENWERK', '#ff7a00', '#111'], ['ORBIS UHREN', '#111', '#d4af37']];
export const werbung = () => merk('werbung', () => {
  const W = 1024, H = 64 * WERBUNG.length, [c, x] = leinwand(W, H);
  WERBUNG.forEach(([text, bg, fg], i) => {
    x.fillStyle = bg; x.fillRect(0, i * 64, W, 64);
    x.fillStyle = fg; x.font = 'bold 44px Arial, sans-serif'; x.textBaseline = 'middle';
    for (let k = 0; k < 3; k++) x.fillText(text, 20 + k * 345, i * 64 + 34);
  });
  return { map: textur(c), anzahl: WERBUNG.length };
});

// Zuschauer: viele bunte Köpfe und Oberkörper in Reihen
export const zuschauer = () => merk('zuschauer', () => {
  const W = 512, H = 256, [c, x] = leinwand(W, H), r = zufall(5);
  x.fillStyle = '#2a2d33'; x.fillRect(0, 0, W, H);
  const reihen = 8, rh = H / reihen;
  for (let j = 0; j < reihen; j++) {
    x.fillStyle = '#5b6068'; x.fillRect(0, j * rh + rh * 0.78, W, rh * 0.22);   // Sitzreihe
    for (let i = 0; i < 40; i++) {
      if (r() < 0.12) continue;
      const px = i * (W / 40) + r() * 4, py = j * rh + rh * 0.25;
      x.fillStyle = `hsl(${Math.floor(r() * 360)},${50 + r() * 40}%,${35 + r() * 35}%)`;
      x.fillRect(px, py + rh * 0.22, W / 40 * 0.8, rh * 0.5);
      x.fillStyle = ['#f1c9a5', '#d9a77e', '#8d5a3b', '#5b3a26', '#e8b896'][Math.floor(r() * 5)];
      x.beginPath(); x.arc(px + W / 80 * 0.8, py + rh * 0.12, rh * 0.14, 0, 7); x.fill();
      if (r() < 0.3) { x.fillStyle = ['#e2231a', '#ffffff', '#1e5bd8', '#f6c400'][Math.floor(r() * 4)]; x.fillRect(px, py - rh * 0.05, W / 40 * 0.8, rh * 0.08); }
    }
  }
  return { map: textur(c) };
});

// Hausfassade mit Fenstern (abends leuchten manche)
export const fassade = (art = 'tag') => merk('fassade' + art, () => {
  const W = 256, [c, x] = leinwand(W), r = zufall(art === 'tag' ? 11 : 12);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, W);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) {
    const hell = art === 'abend' && r() < 0.45;
    x.fillStyle = hell ? `hsl(${38 + r() * 12},90%,${62 + r() * 20}%)` : `hsl(210,${10 + r() * 15}%,${18 + r() * 18}%)`;
    x.fillRect(i * 42 + 9, j * 32 + 7, 24, 19);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i * 42 + 8, j * 32 + 26, 26, 3);
  }
  const t = textur(c);
  if (art === 'abend') {
    // Leuchtbild: nur die hellen Fenster
    const [c2, x2] = leinwand(W); const d = x.getImageData(0, 0, W, W);
    for (let i = 0; i < d.data.length; i += 4) { const g = d.data[i] > 200 && d.data[i + 2] < 190 && !(d.data[i + 1] > 250 && d.data[i + 2] > 250); if (!g) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; } }
    x2.putImageData(d, 0, 0);
    return { map: t, leucht: textur(c2) };
  }
  return { map: t };
});

// Fangzaun (Maschendraht): durchsichtig mit feinen Linien
export const zaun = () => merk('zaun', () => {
  const [c, x] = leinwand(64);
  x.strokeStyle = 'rgba(200,205,210,0.9)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke();
  return { map: textur(c) };
});

// Parkett für den Wohnzimmerboden
export const parkett = () => merk('parkett', () => {
  const W = 512, [c, x] = leinwand(W), r = zufall(3);
  x.fillStyle = '#a8743f'; x.fillRect(0, 0, W, W);
  // Dielen in Reihen, jede zweite Reihe um eine halbe Diele verschoben (über den Rand hinaus, damit das Bild nahtlos ist)
  for (let j = 0; j < 8; j++) for (let i = -1; i < 2; i++) {
    const px = i * 256 + (j % 2) * 128;
    x.fillStyle = `hsl(${28 + r() * 8},${45 + r() * 15}%,${42 + r() * 12}%)`;
    x.fillRect(px, j * 64, 256, 64);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, j * 64, 2, 64); x.fillRect(0, j * 64, W, 2);
    for (let k = 0; k < 14; k++) { x.strokeStyle = `rgba(60,30,10,${0.08 + r() * 0.1})`; x.beginPath(); const yy = j * 64 + r() * 64; x.moveTo(px, yy); x.bezierCurveTo(px + 80, yy + r() * 8 - 4, px + 170, yy + r() * 8 - 4, px + 256, yy); x.stroke(); }
  }
  return { map: textur(c) };
});

// Wasser: Wellen als Normal-Map
export const wellen = () => merk('wellen', () => {
  const w = 256, [c, x] = leinwand(w), n = rauschen(99);
  const img = x.createImageData(w, w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    // nahtlos: Rauschen auf einem Ring
    const a = i / w * Math.PI * 2, b = j / w * Math.PI * 2;
    const v = n(Math.cos(a) * 2 + 10, Math.sin(a) * 2 + Math.cos(b) * 3 + Math.sin(b) * 1.5, 4);
    const g = Math.max(0, Math.min(255, 128 + v * 90)), k = (j * w + i) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = g; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return { normalMap: normalAus(x, w, w, 3) };
});

// Startnummer als Bild
export function nummer(n, farbe = '#fff', grund = null) {
  const [c, x] = leinwand(128, 128);
  if (grund) { x.fillStyle = grund; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); }
  x.fillStyle = farbe; x.font = 'bold 84px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(n), 64, 70);
  return textur(c, false);
}

// ---------------------------------------------------------------- Rallye
// Schotterweg: Das Bild geht über die ganze Breite des Weges (links → rechts) und 12 m in Fahrtrichtung.
// Wo die Räder fahren, ist der Schotter festgefahren und dunkler (zwei Fahrspuren), in der Mitte und am Rand
// liegt loser, heller Schotter mit größeren Steinen. hell = Grundfarbe (heller Kalkschotter oder dunkle Walderde)
export const schotterWeg = (art = 'hell') => merk('schotterWeg' + art, () => {
  const W = 512, H = 512, [c, x] = leinwand(W, H), [hc, hx] = leinwand(W, H), r = zufall(art.length * 71 + 5);
  const n = rauschen(art === 'hell' ? 41 : 43);
  const F = art === 'hell'
    ? { grund: [176, 160, 132], spur: [128, 116, 96], stein: ['#d9ccb2', '#b8a888', '#9a8a70', '#e8dfcc', '#7d705c'] }
    : { grund: [122, 102, 78], spur: [84, 70, 54], stein: ['#a08a6c', '#857058', '#6a5844', '#b8a688', '#5a4a3a'] };
  // Wie stark ist eine Stelle festgefahren? (0 = lose, 1 = Fahrspur). u = 0 … 1 quer über den Weg
  const fest = u => Math.max(Math.exp(-(((u - 0.3) / 0.075) ** 2)), Math.exp(-(((u - 0.7) / 0.075) ** 2)));
  const img = x.createImageData(W, H), himg = hx.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = i / W, a = j / H * Math.PI * 2;
    // nahtlos in Fahrtrichtung: Rauschen auf einem Ring
    const v = n(u * 6, Math.cos(a) * 1.6 + 7, 4) * 0.5 + n(u * 22 + 3, Math.sin(a) * 4 + Math.cos(a) * 2, 2) * 0.35;
    const f = fest(u) * (0.85 + 0.15 * Math.sin(a * 3 + u * 9));
    const k = (j * W + i) * 4;
    for (let m = 0; m < 3; m++) img.data[k + m] = Math.max(0, Math.min(255, F.grund[m] + (F.spur[m] - F.grund[m]) * f + v * 26));
    img.data[k + 3] = 255;
    const h = 128 + v * 40 * (1 - f * 0.7);
    himg.data[k] = himg.data[k + 1] = himg.data[k + 2] = h; himg.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); hx.putImageData(himg, 0, 0);
  // lose Steine: viele in der Mitte und an den Rändern, wenige in den Fahrspuren
  for (let k = 0; k < 26000; k++) {
    const u = r(), px = u * W, py = r() * H;
    if (r() < fest(u) * 0.85) continue;
    const s = (0.7 + r() * 1.8) * (r() < 0.05 ? 2.4 : 1);
    x.fillStyle = F.stein[Math.floor(r() * F.stein.length)]; x.globalAlpha = 0.55 + r() * 0.45;
    x.fillRect(px, py, s, s * (0.7 + r() * 0.6));
    const g = 150 + Math.floor(r() * 105); hx.fillStyle = `rgb(${g},${g},${g})`; hx.fillRect(px, py, s, s);
  }
  // Rillen in den Fahrspuren (vom Reifenprofil), ganz fein
  x.globalAlpha = 0.12; x.fillStyle = '#000';
  for (const m of [0.3, 0.7]) for (let k = 0; k < 9; k++) x.fillRect((m - 0.06 + k * 0.014) * W, 0, 1, H);
  x.globalAlpha = 1;
  return { map: textur(c), normalMap: normalAus(hx, W, H, 3) };
});

// Waldboden neben dem Weg: Erde, Nadeln, Moos, ein paar Steine
export const waldboden = (art = 'kiefer') => merk('waldboden' + art, () => {
  const w = 256, [c, x] = leinwand(w), r = zufall(art.length * 13 + 3);
  const grund = art === 'laub' ? '#5b5a2e' : art === 'berg' ? '#6e7656' : '#5d5a34';
  x.fillStyle = grund; x.fillRect(0, 0, w, w);
  const farben = art === 'laub' ? ['#7a5a2a', '#8c6a32', '#4f6a2a', '#a07836', '#3e4a22'] : ['#6c7a34', '#4c5e28', '#8a7444', '#5a4a30', '#7d8a44'];
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = farben[Math.floor(r() * farben.length)]; x.globalAlpha = 0.45 + r() * 0.4;
    const a = r() * 6.28, l = 1.5 + r() * 4;
    x.save(); x.translate(r() * w, r() * w); x.rotate(a); x.fillRect(0, 0, l, 1 + r()); x.restore();
  }
  x.globalAlpha = 1;
  return { map: textur(c) };
});

// Schild mit Schrift (Start, Ziel, Stopp, Zwischenzeit, Kilometer …). zeilen = [[Text, Größe in Bildpunkten], …]
export function schild(zeilen, { grund = '#ffffff', schrift = '#111111', rand = null, w = 512, h = 256, karo = false } = {}) {
  const [c, x] = leinwand(w, h);
  x.fillStyle = grund; x.fillRect(0, 0, w, h);
  if (karo) { const q = h / 4; for (let j = 0; j < 4; j++) for (let i = 0; i < w / q; i++) if ((i + j) % 2) { x.fillStyle = '#111'; x.fillRect(i * q, j * q, q, q); } }
  if (rand) { x.strokeStyle = rand; x.lineWidth = h * 0.06; x.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1); }
  x.fillStyle = schrift; x.textAlign = 'center'; x.textBaseline = 'middle';
  const sum = zeilen.reduce((s, z) => s + z[1] * 1.15, 0);
  let y = h / 2 - sum / 2;
  for (const [t, g] of zeilen) { x.font = `bold ${g}px Arial, sans-serif`; y += g * 0.575; x.fillText(t, w / 2, y); y += g * 0.575; }
  return textur(c, false);
}
