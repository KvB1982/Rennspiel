// Rennspiel – baut eine Wertungsprüfung (Rallye) in 3D.
//
// Anders als auf der Rennstrecke gibt es hier keine Leitplanken und keine Randsteine:
// Ein Schotterweg führt durch den Wald, daneben ein schmaler Streifen Gras und Graben, dann kommen schon die Bäume.
// Die Bäume stehen mit Absicht dicht am Weg – wenn sie vorbeifliegen, spürt man das Tempo.
// Dazu: Matsch, Pfützen, eine Wasserdurchfahrt, Felsen innen in manchen Kurven ("nicht schneiden!"),
// Holzstapel, Zuschauer hinter Absperrband an Kehren und Sprüngen, Start mit Startuhr, fliegendes Ziel und Stopp-Schild.

import * as THREE from 'three';
import * as TX from './texturen.js';
import { BELAG } from './strecke.js';
import { band, mesh, naeheGitter, abschnitte } from './streckebau.js';
import { baumBild } from './modelle.js';

// Zahlen zum Einstellen
const BAUM_ABSTAND = 3.2;      // so viele Meter liegen zwischen zwei Bäumen der ersten Reihe am Weg
const BAUM_REIHEN = 3;         // so viele Reihen Bäume stehen dicht am Weg
const FERNE_BAEUME = 7000;     // Bäume weiter weg im Gelände (bei Grafik "schön")
const HUEGEL = { kiefer: 28, laub: 45, berg: 150 };   // wie hoch das Gelände ringsum wird (m)

// Ein Punkt neben der Strecke: s = Meter entlang, d = seitlich (plus = links)
function punkt(T, s, d, hoch = 0) {
  const i = T.index(s);
  return { i, x: T.x[i] + T.tz[i] * d, y: T.y[i] + hoch, z: T.z[i] - T.tx[i] * d, h: Math.atan2(T.tx[i], T.tz[i]) };
}

export function baueWpWelt(T, szene, { qualitaet = 'hoch', etappe = null } = {}) {
  const def = T.def, wald = def.welt.wald || 'kiefer';
  const gruppe = new THREE.Group(); szene.add(gruppe);
  const viel = qualitaet === 'hoch' ? 1 : qualitaet === 'mittel' ? 0.6 : 0.3;
  const r = TX.zufall(def.id.length * 977 + 3);
  const welt = { gruppe, ampel: [], wasser: [], standorte: [], grenzen: null, rallye: true, leute: [] };
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (let i = 0; i < T.n; i++) { minx = Math.min(minx, T.x[i]); maxx = Math.max(maxx, T.x[i]); minz = Math.min(minz, T.z[i]); maxz = Math.max(maxz, T.z[i]); }
  welt.grenzen = { minx, maxx, minz, maxz, mx: (minx + maxx) / 2, mz: (minz + maxz) / 2 };
  const asphalt = def.belag === 'asphalt';
  const zuschauer = etappe ? etappe.zuschauer : [];
  // Ist an dieser Stelle (s, Seite) Platz für Zuschauer? Dort keine Bäume
  const beiLeuten = (s, seite, weit = 30) => zuschauer.some(z => z.seite === seite && Math.abs(((s - z.s + T.laenge * 1.5) % T.laenge) - T.laenge / 2) < weit);

  // Felder: Stücke der Strecke, die über offene Wiesen und Äcker führen (def.felder = [[Anteil von, bis]]).
  // feld[i] = 0 (Wald) bis 1 (Feld), am Übergang weich dazwischen
  const feld = feldStuecke(T, def.felder);

  // ---------------------------------------------------------------- der Weg
  const SP = 10;
  const wegMat = asphalt
    ? (() => { const a = TX.asphalt(); return new THREE.MeshStandardMaterial({ map: a.map, normalMap: a.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.85, color: 0xe8e8e8 }); })()
    : (() => { const w = TX.schotterWeg(wald === 'laub' ? 'dunkel' : 'hell'); return new THREE.MeshStandardMaterial({ map: w.map, normalMap: w.normalMap, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.97 }); })();
  // Der Weg ist in der Mitte etwas höher (Wasser läuft zur Seite ab)
  const wolbung = (l, i) => -((l / T.hb[i]) ** 2) * 0.07;
  welt.strasse = mesh(band(T, 0, T.n, SP, (i, j) => -T.hb[i] + 2 * T.hb[i] * j / SP, (i, j, l) => wolbung(l, i), {
    uv: asphalt ? (i, j, l, s) => [l / 6, s / 6] : (i, j, l, s) => [(l / T.hb[i] + 1) / 2, s / 12],
  }), wegMat, false, true);
  gruppe.add(welt.strasse);
  if (asphalt) {
    // Bergstraße: weiße Randlinien, in der Mitte eine gestrichelte Linie
    const weiss = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const seite of [-1, 1]) gruppe.add(mesh(band(T, 0, T.n, 1, (i, j) => seite * (T.hb[i] - 0.25 - j * 0.15), (i, j, l) => wolbung(l, i) + 0.01), weiss, false, true));
    const strich = Math.round(6 / T.ds), luecke = Math.round(6 / T.ds);
    for (let k = 0; k < T.n - strich; k += strich + luecke) gruppe.add(mesh(band(T, k, k + strich, 1, (i, j) => (j - 0.5) * 0.12, () => 0.012), weiss, false, true));
  }

  // ---------------------------------------------------------------- Matsch (dunkle, nasse Stellen auf dem Weg)
  const matschMat = new THREE.MeshStandardMaterial({
    map: TX.schotterWeg('dunkel').map, color: 0x6b5236, roughness: 0.38, metalness: 0.05, transparent: true, vertexColors: true,
    polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
  });
  const rampe = Math.round(10 / T.ds);
  for (const [von, bis] of abschnitte(T.n, i => T.belag[i] === BELAG.matsch)) {
    const g = band(T, von - rampe, bis + rampe, SP, (i, j) => (-T.hb[i] - 0.4) + (2 * T.hb[i] + 0.8) * j / SP, (i, j, l) => wolbung(Math.min(Math.abs(l), T.hb[i]), i) + 0.012, {
      uv: (i, j, l, s) => [(l / T.hb[i] + 1) / 2, s / 12],
    });
    // weich ein- und ausblenden (4. Zahl der Farbe = wie durchsichtig)
    const W = SP + 1, reihen = g.attributes.position.count / W, col = new Float32Array(reihen * W * 4);
    for (let rr = 0; rr < reihen; rr++) {
      const f = Math.min(1, rr / rampe, (reihen - 1 - rr) / rampe);
      for (let j = 0; j < W; j++) { const rand = Math.min(1, Math.min(j, SP - j) / 1.5); col.set([1, 1, 1, f * (0.55 + 0.45 * rand)], (rr * W + j) * 4); }
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    gruppe.add(mesh(g, matschMat, false, true));
  }

  // ---------------------------------------------------------------- Pfützen: dunkles Wasser, in dem sich der Himmel spiegelt
  {
    const teile = [], raender = [];
    for (const p of T.pfuetzen) {
      const q = punkt(T, p.s, p.d);
      const ell = (rx, rz, y) => {
        const g = new THREE.CircleGeometry(1, 22); g.rotateX(-Math.PI / 2);
        const pos = g.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          const a = Math.atan2(pos.getZ(k), pos.getX(k)), w = 1 + 0.12 * Math.sin(a * 3 + p.s) + 0.08 * Math.sin(a * 5 + p.d);   // nicht ganz rund
          pos.setXYZ(k, pos.getX(k) * rx * w, 0, pos.getZ(k) * rz * w);
        }
        g.rotateY(q.h); g.translate(q.x, q.y + y + wolbung(Math.min(Math.abs(p.d), T.hb[q.i]), q.i), q.z);
        return g;
      };
      teile.push(ell(p.r, p.lang, 0.03));
      raender.push(ell(p.r * 1.35, p.lang * 1.3, 0.02));
    }
    if (teile.length) {
      const zusammen = l => { const g = new THREE.BufferGeometry(); const pos = []; const idx = []; let o = 0; for (const t of l) { const ti = t.toNonIndexed(); const pa = ti.attributes.position.array; for (let k = 0; k < pa.length; k++) pos.push(pa[k]); for (let k = 0; k < pa.length / 3; k++) idx.push(o + k); o += pa.length / 3; } g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
      const w = TX.wellen(); const nm = w.normalMap.clone(); nm.needsUpdate = true; nm.repeat.set(0.4, 0.4);
      const wasserMat = new THREE.MeshStandardMaterial({ color: 0x3b3a30, roughness: 0.04, metalness: 0.55, normalMap: nm, normalScale: new THREE.Vector2(0.15, 0.15), polygonOffset: true, polygonOffsetFactor: -4 });
      const randMat = new THREE.MeshStandardMaterial({ color: 0x3e2f20, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -3 });
      gruppe.add(mesh(zusammen(raender), randMat, false, true));
      gruppe.add(mesh(zusammen(teile), wasserMat, false, true));
      welt.wasser.push(nm);
    }
  }

  // ---------------------------------------------------------------- Wasserdurchfahrt: ein Bach quert den Weg
  for (const F of T.furten || []) {
    const mitte = (F.s0 + F.s1) / 2, breit = F.s1 - F.s0 + 3, q = punkt(T, mitte, 0);
    const w = TX.wellen(); const nm = w.normalMap.clone(); nm.needsUpdate = true; nm.repeat.set(2, 18);
    const bachMat = new THREE.MeshStandardMaterial({ color: 0x2f3626, roughness: 0.38, metalness: 0, envMapIntensity: 0.35, normalMap: nm, normalScale: new THREE.Vector2(0.4, 0.4), transparent: true, opacity: 0.9 });
    // der Bach fließt quer zum Weg (lang = 140 m quer, breit = so lang wie die Furt)
    const bach = new THREE.Mesh(new THREE.PlaneGeometry(breit, 140), bachMat);
    bach.rotation.order = 'YXZ'; bach.rotation.set(-Math.PI / 2, q.h + Math.PI / 2, 0);
    bach.position.set(q.x, q.y + 0.22, q.z); bach.receiveShadow = true;
    gruppe.add(bach); welt.wasser.push(nm);
    // Steine am Ufer
    welt.furt = { x: q.x, y: q.y, z: q.z };
  }

  // ---------------------------------------------------------------- Rand: Graben, Gras, Waldboden – geht in den Wald über
  const bodenT = TX.waldboden(wald), grasT = TX.gras();
  const grasMat = new THREE.MeshStandardMaterial({ map: grasT.map, roughness: 1, color: wald === 'berg' ? 0xb8c098 : 0xa8b27e });
  const bodenMat = new THREE.MeshStandardMaterial({ map: bodenT.map, roughness: 1 });
  for (const seite of [1, -1]) {
    const aus = seite > 0 ? T.ausL : T.ausR;
    // Spalten: Wegrand (losen Schotter), Graben, Gras bis zum Waldrand
    const lat = (i, j) => seite * (T.hb[i] + [0, 0.35, 0.9, 1.6, aus[i] + 0.2][j]);
    const hoch = (i, j) => [wolbung(T.hb[i], i), -0.12, -0.42, -0.3, -0.15][j];
    gruppe.add(mesh(band(T, 0, T.n, 4, lat, hoch, { uv: (i, j, l, s) => [l / 3, s / 3] }), grasMat, false, true));
    // Waldboden: vom Waldrand nach außen, fällt etwas ab (darunter liegt das Gelände)
    const lat2 = (i, j) => seite * (T.hb[i] + aus[i] + [0.2, 7, 22][j]);
    const hoch2 = (i, j) => [-0.15, -0.55, -1.6][j];
    for (const [von, bis] of abschnitte(T.n, i => feld[i] <= 0.5)) gruppe.add(mesh(band(T, von, bis, 2, lat2, hoch2, { uv: (i, j, l, s) => [l / 5, s / 5] }), bodenMat, false, true));
    // auf dem Feld liegt dort Wiese statt Waldboden
    for (const [von, bis] of abschnitte(T.n, i => feld[i] > 0.5)) gruppe.add(mesh(band(T, von, bis, 2, lat2, hoch2, { uv: (i, j, l, s) => [l / 3, s / 3] }), grasMat, false, true));
  }

  // ---------------------------------------------------------------- Gelände ringsum (Hügel, im Dunst Berge)
  const nah = naeheGitter(T, 60);
  const hoeheBei = gelaende(T, gruppe, welt, wald, viel, nah, feld);

  // ---------------------------------------------------------------- Bäume
  baeume(T, gruppe, welt, wald, viel, r, nah, hoeheBei, beiLeuten, feld);

  // ---------------------------------------------------------------- Weidezaun und Heuballen auf den Feldern
  if (def.felder) feldSchmuck(T, gruppe, feld, hoeheBei, beiLeuten);

  // ---------------------------------------------------------------- Felsen, Holzstapel
  felsenUndHolz(T, gruppe, wald, viel, r, etappe, beiLeuten);

  // ---------------------------------------------------------------- Start, Ziel, Schilder
  if (etappe) schilder(T, gruppe, welt, etappe);

  // ---------------------------------------------------------------- Zuschauer
  if (etappe) baueZuschauer(T, gruppe, welt, zuschauer, r, viel);

  welt.update = (dt, a, et) => updateWelt(welt, dt, a, et);
  return welt;
}

// ---------------------------------------------------------------- Gelände
// Macht aus den Feld-Stücken der Strecke eine Zahl je Messpunkt: 0 = Wald, 1 = Feld (auf etwa 50 m weich dazwischen)
function feldStuecke(T, felder) {
  const n = T.n, hart = new Float32Array(n), weich = new Float32Array(n);
  if (!felder) return weich;
  for (const [a, b] of felder) for (let i = Math.floor(a * n); i < Math.min(n, Math.ceil(b * n)); i++) hart[i] = 1;
  const w = Math.max(1, Math.round(25 / T.ds));
  let summe = 0;
  for (let k = -w; k <= w; k++) summe += hart[((k % n) + n) % n];
  for (let i = 0; i < n; i++) { weich[i] = summe / (2 * w + 1); summe += hart[(i + w + 1) % n] - hart[((i - w) % n + n) % n]; }
  return weich;
}

// Farben der Felder: Weizen, Wiese, junges Grün, Acker, Raps
const FELD_FARBEN = [0xe6cf7a, 0x9cc04e, 0xb9d268, 0xa98a5c, 0xe8dc4a, 0x8fb848];

function gelaende(T, gruppe, welt, wald, viel, nah, feld) {
  const { minx, maxx, minz, maxz } = welt.grenzen;
  const rand = 1100, x0 = minx - rand, x1 = maxx + rand, z0 = minz - rand, z1 = maxz + rand;
  const N = viel >= 1 ? 230 : viel > 0.5 ? 170 : 120;
  const rs = TX.rauschen(wald.length * 23 + 1), amp = HUEGEL[wald] || 30;
  const hoehe = (x, z) => {
    const f = nah(x, z, 4);
    const ty = f.i >= 0 ? T.y[f.i] : 0;
    const frei = f.i >= 0 ? T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 20 : 0;
    const d = f.i >= 0 ? f.d : 1e4;
    // über den Feldern bleibt das Land länger flach, die Hügel fangen erst weiter weg an
    const fw = f.i >= 0 ? feld[f.i] : 0;
    const w = Math.min(1, Math.max(0, (d - frei - fw * 60) / ((wald === 'berg' ? 160 : 220) + fw * 140))), glatt = w * w * (3 - 2 * w);
    // dicht am Weg etwas tiefer als der Rand (sonst schaut das Gelände bei Kuppen durch)
    return ty - 1.7 + glatt * (rs(x / 600, z / 600, 4) * amp + amp * 0.6 + (wald === 'berg' ? Math.max(0, rs(x / 1500 + 3, z / 1500, 2)) * 260 * glatt : 0));
  };
  const pos = [], cols = [], idx = [], uvs = [];
  const c = new THREE.Color(), boden = new THREE.Color(wald === 'laub' ? 0x6a6238 : 0x5f6a3a), moos = new THREE.Color(0x4f7232), fels = new THREE.Color(0x77736a), acker = new THREE.Color();
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = x0 + (x1 - x0) * i / N, z = z0 + (z1 - z0) * j / N, h = hoehe(x, z);
    pos.push(x, h, z); uvs.push(x / 14, z / 14);
    const v = rs(x / 80, z / 80, 3) * 0.5 + 0.5;
    c.copy(boden).lerp(moos, v * 0.6);
    if (wald === 'berg' && h > 220) c.lerp(fels, Math.min(1, (h - 220) / 80));
    // Felder: bunte Streifen wie ein Flickenteppich (jeder Acker hat seine Farbe)
    const fn = nah(x, z, 5);
    if (fn.i >= 0 && feld[fn.i] > 0) {
      const u = x * 0.87 + z * 0.5, w2 = -x * 0.5 + z * 0.87;
      const nr = Math.abs(Math.floor(u / 70) * 7 + Math.floor(w2 / 130) * 13) % FELD_FARBEN.length;
      acker.setHex(FELD_FARBEN[nr]).multiplyScalar(2.1);       // heller, weil das Bild vom Waldboden dunkel ist
      c.lerp(acker, feld[fn.i] * Math.min(1, Math.max(0, (300 - fn.d) / 80)));
    }
    cols.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, cc = a + N + 1, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals();
  gruppe.add(mesh(g, new THREE.MeshStandardMaterial({ map: TX.waldboden(wald).map, vertexColors: true, roughness: 1 }), false, true));
  // Berge am Horizont
  const bpos = [], bidx = [], M = 128, rsB = TX.rauschen(11), cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
  for (let k = 0; k <= M; k++) {
    const a = k / M * Math.PI * 2, hh = (wald === 'berg' ? 900 : 380) * (0.5 + 0.5 * rsB(Math.cos(a) * 3, Math.sin(a) * 3, 4));
    bpos.push(cx + Math.cos(a) * 4300, -30, cz + Math.sin(a) * 4300, cx + Math.cos(a) * 4700, hh, cz + Math.sin(a) * 4700);
  }
  for (let k = 0; k < M; k++) { const a = k * 2; bidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3)); bg.setIndex(bidx); bg.computeVertexNormals();
  gruppe.add(new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: wald === 'berg' ? 0x6a7080 : 0x3e5a40, roughness: 1, side: THREE.DoubleSide })));
  return hoehe;
}

// ---------------------------------------------------------------- Bäume: dichte Reihen am Weg, dazu Wald im Gelände
function baeume(T, gruppe, welt, wald, viel, r, nah, hoehe, beiLeuten, feld) {
  // Welche Bäume? [Bild, Höhe, Anteil]
  const ARTEN = wald === 'laub' ? [['laub', 12, 0.75], ['fichte', 15, 0.25]] : wald === 'berg' ? [['fichte', 14, 0.85], ['laub', 9, 0.15]] : [['fichte', 16, 0.7], ['pinie', 13, 0.15], ['laub', 11, 0.15]];
  const stellen = [];   // [x, y, z, Größe]
  const schritt = BAUM_ABSTAND / Math.max(0.45, viel);
  for (const seite of [1, -1]) {
    const aus = seite > 0 ? T.ausL : T.ausR;
    for (let s = 0; s < T.laenge; s += schritt * (0.7 + r() * 0.6)) {
      if (beiLeuten(s, seite)) continue;
      if (s < 40 || s > T.laenge - 30) continue;           // am Start ist eine Lichtung
      const i = T.index(s);
      if (T.belag[i] === BELAG.wasser) continue;
      if (feld[i] > 0.5 && r() > 0.04) continue;           // auf dem Feld stehen nur einzelne Bäume am Weg
      for (let k = 0; k < BAUM_REIHEN; k++) {
        if (r() < 0.12 + k * 0.1) continue;                 // Lücken
        const d = seite * (T.hb[i] + aus[i] + 0.9 + k * 4.2 + r() * 3.2);
        const x = T.x[i] + T.tz[i] * d + (r() - 0.5) * 2, z = T.z[i] - T.tx[i] * d + (r() - 0.5) * 2;
        // nicht auf die andere Seite einer nahen Kurve (wo wieder der Weg ist)
        const f = nah(x, z, 2);
        if (f.i >= 0 && f.d < T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 0.6) continue;
        stellen.push([x, T.y[i] - 0.3 - k * 0.4, z, 0.8 + r() * 0.45]);
      }
    }
  }
  // dahinter der Wald, den man von der Straße aus sieht (15 bis 130 m weit weg)
  for (let s = 0; s < T.laenge; s += 7 / Math.max(0.45, viel)) {
    const i = T.index(s);
    for (const seite of [1, -1]) for (let k = 0; k < 3; k++) {
      const aus = seite > 0 ? T.ausL[i] : T.ausR[i], weit = 14 + r() * r() * 120;
      const d = seite * (T.hb[i] + aus + weit);
      const x = T.x[i] + T.tz[i] * d + (r() - 0.5) * 6, z = T.z[i] - T.tx[i] * d + (r() - 0.5) * 6;
      if (beiLeuten(s, seite, 40) && weit < 40) continue;
      if (feld[i] > 0.5 && weit < 110) continue;           // Feld: der Wald fängt erst weit hinten an
      const f = nah(x, z, 3);
      if (f.i >= 0 && f.d < T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 10) continue;
      stellen.push([x, hoehe(x, z) - 0.3, z, 0.8 + r() * 0.5]);
    }
  }
  // Wald im Gelände (dort wo das Rauschen "Wald" sagt, sonst Lichtungen)
  const { minx, maxx, minz, maxz } = welt.grenzen, rs = TX.rauschen(19);
  const zahl = Math.round(FERNE_BAEUME * viel);
  for (let v = 0, k = 0; k < zahl && v < zahl * 8; v++) {
    const x = minx - 700 + r() * (maxx - minx + 1400), z = minz - 700 + r() * (maxz - minz + 1400);
    const f = nah(x, z, 3);
    if (f.i >= 0 && f.d < T.hb[f.i] + Math.max(T.ausL[f.i], T.ausR[f.i]) + 14) continue;
    if (rs(x / 300, z / 300, 2) < -0.35) continue;
    if (f.i >= 0 && feld[f.i] > 0.5 && f.d < 230) continue;   // keine Bäume mitten im Acker
    const h = hoehe(x, z);
    if (wald === 'berg' && h > 260) continue;               // oben am Berg nur Fels
    stellen.push([x, h - 0.3, z, 0.85 + r() * 0.5]); k++;
  }
  // auf die Baumarten verteilen
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), achse = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  let start = 0;
  ARTEN.forEach(([bild, hoch, anteil], n) => {
    const bis = n === ARTEN.length - 1 ? stellen.length : start + Math.round(stellen.length * anteil);
    // gemischt: jede Art bekommt jeden k-ten Platz
    const meine = stellen.filter((_, k) => { const t = (k * 0.6180339) % 1; let a0 = 0; for (let m = 0; m < n; m++) a0 += ARTEN[m][2]; return t >= a0 && t < a0 + anteil; });
    start = bis;
    const bb = baumBild(bild, hoch);
    let geo, mat;
    if (bb) { geo = bb.krone; mat = bb.kroneMat; }
    else {   // Rückfall ohne Bilder: einfache Kegel
      geo = new THREE.ConeGeometry(hoch * 0.22, hoch * 0.85, 7); geo.translate(0, hoch * 0.55, 0);
      mat = new THREE.MeshStandardMaterial({ color: 0x2c4a26, roughness: 1, flatShading: true });
    }
    const im = new THREE.InstancedMesh(geo, mat, meine.length);
    meine.forEach(([x, y, z, s], k) => {
      q.setFromAxisAngle(achse, (x * 13.7 + z * 7.1) % 6.283);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * (0.9 + ((x * 3.3) % 1) * 0.3), s));
      im.setMatrixAt(k, m4);
      const v = 0.72 + ((x * 7.7 + z * 3.1) % 1 + 1) % 1 * 0.32; c.setRGB(v, v, v * 0.95); im.setColorAt(k, c);
    });
    im.castShadow = true; im.receiveShadow = false;
    gruppe.add(im);
  });
}

// ---------------------------------------------------------------- Felder: Weidezaun am Weg, Heuballen auf der Wiese
function feldSchmuck(T, gruppe, feld, hoehe, beiLeuten) {
  const r = TX.zufall(71), kiste = new THREE.BoxGeometry(1, 1, 1);
  const holz = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.95 });
  const teile = [];   // [x, y, z, Richtung, breit, hoch, lang]
  const PFOSTEN = 3.5;   // alle 3,5 m ein Pfosten
  for (const seite of [1, -1]) {
    const aus = seite > 0 ? T.ausL : T.ausR;
    let alt = null;
    for (let s = 0; s < T.laenge; s += PFOSTEN) {
      const i = T.index(s);
      if (feld[i] < 0.6 || beiLeuten(s, seite) || s < 30 || s > T.laenge - 20) { alt = null; continue; }
      const d = seite * (T.hb[i] + aus[i] + 0.7);
      const p = { x: T.x[i] + T.tz[i] * d, y: T.y[i] - 0.25, z: T.z[i] - T.tx[i] * d };
      teile.push([p.x, p.y + 0.55, p.z, 0, 0, 0.12, 1.1, 0.12]);
      if (alt) {   // zwei Latten vom letzten Pfosten bis zu diesem
        const dx = p.x - alt.x, dz = p.z - alt.z, lang = Math.hypot(dx, dz), h = Math.atan2(dx, dz), steig = Math.atan2(p.y - alt.y, lang);
        for (const hoch of [0.45, 0.9]) teile.push([(p.x + alt.x) / 2, (p.y + alt.y) / 2 + hoch, (p.z + alt.z) / 2, h, -steig, 0.05, 0.1, lang]);
      }
      alt = p;
    }
  }
  const zaun = new THREE.InstancedMesh(kiste, holz, teile.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
  teile.forEach(([x, y, z, h, steig, b, ho, l], k) => { e.set(steig, h, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(b, ho, l)); zaun.setMatrixAt(k, m4); });
  zaun.castShadow = true; gruppe.add(zaun);

  // Heuballen: dicke Rollen, die auf der Wiese liegen
  const rolle = new THREE.CylinderGeometry(0.8, 0.8, 1.3, 14); rolle.rotateZ(Math.PI / 2);
  const heu = new THREE.MeshStandardMaterial({ color: 0xd8bc6a, roughness: 1 });
  const ballen = [];
  for (let s = 0; s < T.laenge; s += 28) {
    const i = T.index(s);
    if (feld[i] < 0.9 || r() < 0.35) continue;
    const seite = r() < 0.5 ? 1 : -1, aus = seite > 0 ? T.ausL[i] : T.ausR[i], weit = 4 + r() * 16, d = seite * (T.hb[i] + aus + 0.2 + weit);
    const x = T.x[i] + T.tz[i] * d, z = T.z[i] - T.tx[i] * d;
    // die Wiese fällt vom Weg weg etwas ab (wie das Band oben in baueWpWelt)
    const tief = weit < 6.8 ? 0.15 + 0.4 * weit / 6.8 : 0.55 + 1.05 * (weit - 6.8) / 15;
    ballen.push([x, T.y[i] - tief + 0.75, z, r() * 6.28]);
  }
  const bm = new THREE.InstancedMesh(rolle, heu, ballen.length);
  ballen.forEach(([x, y, z, h], k) => { e.set(0, h, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); bm.setMatrixAt(k, m4); });
  bm.castShadow = true; gruppe.add(bm);
}

// ---------------------------------------------------------------- Felsen ("nicht schneiden") und Holzstapel
function felsenUndHolz(T, gruppe, wald, viel, r, etappe, beiLeuten) {
  const felsGeo = new THREE.IcosahedronGeometry(1, 1);
  const p = felsGeo.attributes.position, rr = TX.zufall(5);
  // ein wenig verbeulen, damit er nicht wie eine Kugel aussieht (gleiche Ecken bekommen gleiche Verschiebung)
  const beule = new Map();
  for (let k = 0; k < p.count; k++) {
    const key = [p.getX(k), p.getY(k), p.getZ(k)].map(v => v.toFixed(3)).join();
    if (!beule.has(key)) beule.set(key, 0.75 + rr() * 0.5);
    const f = beule.get(key); p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * 0.7, p.getZ(k) * f);
  }
  felsGeo.computeVertexNormals();
  const felsMat = new THREE.MeshStandardMaterial({ color: wald === 'berg' ? 0x8d8a84 : 0x7b786e, roughness: 0.95, flatShading: true });
  const liste = [];
  // die Felsen, vor denen der Beifahrer warnt (die Etappe kennt ihre Lage, dort stößt man auch an)
  if (etappe) for (const f of etappe.felsen) liste.push([f.x, f.y - 0.25, f.z, f.rad]);
  // weitere Felsen und Steine am Waldrand
  const zahl = Math.round(T.laenge / (wald === 'berg' ? 25 : 60) * Math.max(0.5, viel));
  for (let k = 0; k < zahl; k++) {
    const s = r() * T.laenge, seite = r() < 0.5 ? 1 : -1, i = T.index(s);
    if (beiLeuten(s, seite)) continue;
    const aus = seite > 0 ? T.ausL[i] : T.ausR[i], d = seite * (T.hb[i] + aus + 0.4 + r() * 3);
    liste.push([T.x[i] + T.tz[i] * d, T.y[i] - 0.4, T.z[i] - T.tx[i] * d, 0.4 + r() * (wald === 'berg' ? 1.6 : 0.9)]);
  }
  const im = new THREE.InstancedMesh(felsGeo, felsMat, liste.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  liste.forEach(([x, y, z, s], k) => { e.set(rr() * 0.5, rr() * 6.28, rr() * 0.5); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s * (0.8 + rr() * 0.4))); im.setMatrixAt(k, m4); });
  im.castShadow = true; im.receiveShadow = true;
  gruppe.add(im);

  // Holzstapel am Waldrand (Baumstämme, quer gestapelt)
  const stamm = new THREE.CylinderGeometry(0.22, 0.22, 5, 8); stamm.rotateX(Math.PI / 2);
  const holzMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 });
  const staemme = [];
  const stapel = Math.round(T.laenge / 450);
  for (let k = 0; k < stapel; k++) {
    const s = 80 + r() * (T.laenge - 200), seite = r() < 0.5 ? 1 : -1, i = T.index(s);
    if (beiLeuten(s, seite) || T.belag[i] === BELAG.wasser) continue;
    const aus = seite > 0 ? T.ausL[i] : T.ausR[i], d = seite * (T.hb[i] + aus + 1.1);
    const h = Math.atan2(T.tx[i], T.tz[i]);
    for (let reihe = 0; reihe < 3; reihe++) for (let n = 0; n < 4 - reihe; n++) {
      const dd = d + seite * (n * 0.46 + reihe * 0.23 - 0.7);
      staemme.push([T.x[i] + T.tz[i] * dd, T.y[i] - 0.15 + 0.22 + reihe * 0.4, T.z[i] - T.tx[i] * dd, h]);
    }
  }
  const sm = new THREE.InstancedMesh(stamm, holzMat, staemme.length);
  staemme.forEach(([x, y, z, h], k) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); sm.setMatrixAt(k, m4); });
  sm.castShadow = true; gruppe.add(sm);
}

// ---------------------------------------------------------------- Start, Zwischenzeit, Ziel, Stopp
function schilder(T, gruppe, welt, et) {
  const dunkel = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.6, metalness: 0.4 });
  // Tor über den Weg mit einem Banner
  const tor = (s, tex, hoch = 5.2) => {
    const i = T.index(s), breite = T.hb[i] * 2 + 3.2, g = new THREE.Group();
    for (const seite of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, hoch + 0.8, 0.35), dunkel); p.position.set(seite * breite / 2, (hoch + 0.8) / 2, 0); g.add(p); }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(breite, 1.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }));
    banner.position.y = hoch; g.add(banner);
    g.position.set(T.x[i], T.y[i], T.z[i]); g.rotation.y = Math.atan2(T.tx[i], T.tz[i]) + Math.PI;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    gruppe.add(g);
    return g;
  };
  // Schild am Rand auf einem Pfosten
  const tafel = (s, seite, tex, w = 1.6, h = 0.8, hoch = 1.6) => {
    const i = T.index(s), d = seite * (T.hb[i] + 1.0), g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, hoch, 0.12), dunkel); p.position.y = hoch / 2; g.add(p);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide })); t.position.y = hoch + h / 2; g.add(t);
    g.position.set(T.x[i] + T.tz[i] * d, T.y[i], T.z[i] - T.tx[i] * d); g.rotation.y = Math.atan2(T.tx[i], T.tz[i]) + Math.PI;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    gruppe.add(g);
  };
  const wp = T.def.name.split('·')[0].trim(), name = T.def.name.split('·')[1]?.trim() || '';
  tor(9, TX.schild([['START', 92], [wp + ' · ' + name, 40]], { grund: '#d81d1d', schrift: '#fff', w: 1024, h: 160 }));
  // Startuhr rechts neben dem Auto: zeigt die Sekunden bis zum Start
  {
    const i = T.index(4), d = -(T.hb[i] + 1.3);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const kasten = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.3), dunkel); kasten.position.y = 1.9; g.add(kasten);
    const bild = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); bild.position.set(0, 1.9, -0.16); bild.rotation.y = Math.PI; g.add(bild);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), dunkel); p.position.y = 0.75; g.add(p);
    g.position.set(T.x[i] + T.tz[i] * d, T.y[i], T.z[i] - T.tx[i] * d); g.rotation.y = Math.atan2(T.tx[i], T.tz[i]) + 0.5;
    gruppe.add(g);
    welt.startUhr = { cv, ctx: cv.getContext('2d'), tex, zuletzt: null };
  }
  // Zwischenzeit-Tafeln
  et.zwS.forEach((s, k) => tafel(s, 1, TX.schild([['⏱ ' + (k + 1), 70]], { grund: '#f2c21a', w: 256, h: 128 }), 1.0, 0.5));
  // Vor dem Ziel: gelbe Tafel 200 m vorher, dann das Ziel mit Karo, dann das rote Stopp-Schild
  tafel(et.zielS - 200, -1, TX.schild([['ZIEL', 64], ['200 m', 44]], { grund: '#f2c21a', w: 256, h: 192 }), 1.2, 0.9);
  tor(et.zielS, TX.schild([['ZIEL', 110]], { grund: '#ffffff', karo: true, w: 1024, h: 160 }));
  tafel(et.zielS, -1, TX.schild([['🏁', 120]], { grund: '#ffffff', w: 256, h: 256 }), 1.0, 1.0, 1.4);
  tafel(et.stoppS, -1, TX.schild([['STOPP', 110]], { grund: '#d81d1d', schrift: '#fff', rand: '#fff', w: 512, h: 256 }), 1.6, 0.8, 1.6);
}

// ---------------------------------------------------------------- Zuschauer hinter Absperrband
// Jede Gruppe steht an einer Stelle (s, Seite). Jeder Mensch: Beine und Kopf (ein Teil), Jacke (eigene Farbe), Arme.
// Kommt das Auto näher, jubeln sie: springen und reißen die Arme hoch.
function baueZuschauer(T, gruppe, welt, stellen, r, viel) {
  const anzahl = stellen.reduce((s, z) => s + Math.round(z.zahl * Math.max(0.5, viel)), 0);
  if (!anzahl) return;
  // Beine (dunkel) + Kopf (Haut) als ein Teil mit Eckfarben
  const teil = (w, h, d, y, farbe) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y, 0); const c = new THREE.Color(farbe); const a = []; for (let k = 0; k < g.attributes.position.count; k++) a.push(c.r, c.g, c.b); g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); return g.toNonIndexed(); };
  const kopf = new THREE.SphereGeometry(0.12, 10, 8); kopf.translate(0, 1.62, 0);
  const kc = new THREE.Color(0xe0b494), ka = []; for (let k = 0; k < kopf.attributes.position.count; k++) ka.push(kc.r, kc.g, kc.b); kopf.setAttribute('color', new THREE.Float32BufferAttribute(ka, 3));
  const beine = teil(0.34, 0.86, 0.2, 0.43, 0x2a3040);
  const rest = verbinde([beine, kopf.toNonIndexed()]);
  const jacke = new THREE.BoxGeometry(0.44, 0.62, 0.26); jacke.translate(0, 1.17, 0);
  // Arme: hängen an den Schultern (Drehpunkt oben), werden beim Jubeln nach oben geschwungen
  const arm = s => { const g = new THREE.BoxGeometry(0.1, 0.6, 0.1); g.translate(0, -0.28, 0); g.rotateZ(s * 0.12); g.translate(s * 0.27, 0, 0); return g.toNonIndexed(); };
  const arme = verbinde([arm(1), arm(-1)]);
  const mRest = new THREE.InstancedMesh(rest, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), anzahl);
  const mJacke = new THREE.InstancedMesh(jacke, new THREE.MeshStandardMaterial({ roughness: 0.8 }), anzahl);
  const mArme = new THREE.InstancedMesh(arme, new THREE.MeshStandardMaterial({ roughness: 0.8 }), anzahl);
  const JACKEN = [0xd12a2a, 0x2a62d1, 0xf2c21a, 0x2e8a3e, 0xf07a12, 0x1a1a1a, 0xeeeeee, 0x7a3bb0, 0x8a2a2a, 0x3a6a8a, 0xe85aa0];
  const c = new THREE.Color();
  let k = 0;
  // Absperrband: rot-weiß gestreift
  const bandT = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 8); x.fillStyle = '#d81d1d'; x.fillRect(0, 0, 32, 8); const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const bandMat = new THREE.MeshStandardMaterial({ map: bandT, side: THREE.DoubleSide, roughness: 0.7 });
  const pfostenMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.6 });
  const pfosten = [];
  for (const z of stellen) {
    const zahl = Math.round(z.zahl * Math.max(0.5, viel));
    const lang = Math.max(10, zahl * 0.9), i0 = T.index(z.s);
    const aus = z.seite > 0 ? T.ausL[i0] : T.ausR[i0];
    const bandD = T.hb[i0] + Math.min(aus * 0.55, 3) + (z.art === 'sprung' ? 1.5 : 0.4);
    const gruppeL = { k0: k, zahl: 0, s: z.s, seite: z.seite, leute: [] };
    for (let n = 0; n < zahl; n++) {
      const s = z.s - lang / 2 + r() * lang, i = T.index(s);
      const d = z.seite * (bandD + 0.6 + r() * Math.max(1.5, aus - (bandD - T.hb[i]) + 3.5));
      const x = T.x[i] + T.tz[i] * d, zz = T.z[i] - T.tx[i] * d;
      // zur Straße schauen (etwas durcheinander)
      const blick = Math.atan2(T.x[i] - x, T.z[i] - zz) + (r() - 0.5) * 0.8;
      const gross = 0.9 + r() * 0.2;
      gruppeL.leute.push({ x, y: T.y[i] - 0.2, z: zz, blick, gross, phase: r() * 6.28, mut: 0.5 + r() * 0.5, jubel: 0 });
      c.setHex(JACKEN[Math.floor(r() * JACKEN.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.12);
      mJacke.setColorAt(k, c); mArme.setColorAt(k, c);
      k++; gruppeL.zahl++;
    }
    welt.leute.push(gruppeL);
    // Band an Pfosten, entlang der Stelle
    const von = T.index(z.s - lang / 2 - 3), bis = von + Math.round((lang + 6) / T.ds);
    const lat = () => z.seite * bandD;
    gruppe.add(mesh(band(T, von, bis, 1, lat, (i, j) => 0.85 + j * 0.09, { uv: (i, j, l, s) => [s / 1.2, j] }), bandMat, false, false));
    for (let s = z.s - lang / 2 - 3; s <= z.s + lang / 2 + 3; s += 4) { const q = punkt(T, s, z.seite * bandD); pfosten.push([q.x, q.y, q.z]); }
  }
  mRest.count = mJacke.count = mArme.count = k;
  for (const m of [mRest, mJacke, mArme]) { m.castShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); gruppe.add(m); }
  welt.leuteMesh = { mRest, mJacke, mArme, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), qa: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), e: new THREE.Euler(0, 0, 0, 'YXZ') };
  // alle einmal hinstellen
  for (const G of welt.leute) G.leute.forEach((p, n) => stelleMensch(welt.leuteMesh, G.k0 + n, p, 0, 0));
  for (const m of [mRest, mJacke, mArme]) m.instanceMatrix.needsUpdate = true;
  const pg = new THREE.CylinderGeometry(0.03, 0.03, 1.05, 5); pg.translate(0, 0.52, 0);
  const pm = new THREE.InstancedMesh(pg, pfostenMat, pfosten.length);
  pfosten.forEach(([x, y, z], n) => { welt.leuteMesh.m4.makeTranslation(x, y - 0.05, z); pm.setMatrixAt(n, welt.leuteMesh.m4); });
  gruppe.add(pm);
}

function stelleMensch(L, k, p, hoch, armWinkel) {
  const { m4, q, v, s, e } = L;
  e.set(0, p.blick, 0); q.setFromEuler(e);
  v.set(p.x, p.y + hoch, p.z); s.set(p.gross, p.gross, p.gross);
  m4.compose(v, q, s); L.mRest.setMatrixAt(k, m4); L.mJacke.setMatrixAt(k, m4);
  // Arme: an der Schulter (1,45 m hoch) drehen
  e.set(-armWinkel, p.blick, 0, 'YXZ'); q.setFromEuler(e);
  v.set(p.x, p.y + hoch + 1.45 * p.gross, p.z);
  m4.compose(v, q, s); L.mArme.setMatrixAt(k, m4);
}

// Mehrere Formen (ohne Index) zu einer zusammenfügen – nur Lage und Farbe
function verbinde(teile) {
  const pos = [], col = [], nor = [];
  for (const t of teile) {
    const g = t.index ? t.toNonIndexed() : t;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    if (g.attributes.color) col.push(...g.attributes.color.array); else for (let k = 0; k < g.attributes.position.count; k++) col.push(1, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ---------------------------------------------------------------- jedes Bild: Zuschauer jubeln, Startuhr zählt
function updateWelt(welt, dt, a, et) {
  welt.uhr = (welt.uhr || 0) + dt;
  const L = welt.leuteMesh;
  if (L && a) {
    let geaendert = false;
    for (const G of welt.leute) {
      const p0 = G.leute[0];
      if (!p0) continue;
      const ab = Math.hypot(p0.x - a.x, p0.z - a.z);
      if (ab > 260 && !G.aktiv) continue;
      G.aktiv = ab < 260;
      const tempo = Math.min(1, Math.abs(a.u) / 25);
      G.leute.forEach((p, n) => {
        const d = Math.hypot(p.x - a.x, p.z - a.z);
        // Zielwert: je näher und schneller das Auto, desto wilder
        const ziel = d < 90 ? Math.min(1, (1 - d / 90) * 1.6) * (0.4 + 0.6 * tempo) * p.mut : 0.05;
        p.jubel += (ziel - p.jubel) * Math.min(1, dt * (ziel > p.jubel ? 6 : 1.5));
        const t = welt.uhr * (7 + p.mut * 3) + p.phase;
        const hoch = Math.max(0, Math.sin(t)) * 0.28 * p.jubel;
        const arm = p.jubel * (2.4 + 0.5 * Math.sin(t * 0.5)) + 0.05 * Math.sin(t * 0.3);
        stelleMensch(L, G.k0 + n, p, hoch, arm);
      });
      geaendert = true;
    }
    if (geaendert) for (const m of [L.mRest, L.mJacke, L.mArme]) m.instanceMatrix.needsUpdate = true;
  }
  // Startuhr: zeigt die Sekunden bis zum Start (rot), dann die laufende Zeit (grün)
  const U = welt.startUhr;
  if (U && et) {
    const text = et.phase === 'start' ? String(Math.max(0, Math.ceil(et.countdown))) : et.phase === 'los' ? '00:' + String(Math.floor(et.zeit)).padStart(2, '0') : '–';
    if (text !== U.zuletzt) {
      U.zuletzt = text; const x = U.ctx;
      x.fillStyle = '#050505'; x.fillRect(0, 0, 256, 128);
      x.fillStyle = et.phase === 'start' ? (et.countdown <= 1 ? '#3dff6a' : '#ff3030') : '#3dff6a';
      x.font = 'bold 96px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 68);
      U.tex.needsUpdate = true;
    }
  }
}
