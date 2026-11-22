// Rennspiel – Bauteile für die Cockpits (was man sieht, wenn die Kamera im Auto sitzt).
//
// Hier wird nichts fertig zusammengebaut, sondern es gibt Einzelteile, die jedes Auto an seine Stelle setzt:
//   baueAnzeige  = der Bildschirm hinter dem Lenkrad. Er zeigt wirklich Tempo, Gang und Drehzahl an
//                  (ein kleines gemaltes Bild, das neu gemalt wird, sobald sich eine Zahl ändert).
//   baueLenkrad  = Lenkrad mit Speichen, Knöpfen und Schaltwippen, dazu die Hände in Handschuhen und die Unterarme
//   lueftung, schalterReihe, kartenBild = Kleinteile für das Armaturenbrett
//
// Richtungen wie überall: +z ist vorn, +x ist links, +y ist oben. Der Fahrer schaut nach +z,
// deshalb zeigen Bildschirme und das Lenkrad mit ihrer Vorderseite nach −z (zum Fahrer).

import * as THREE from 'three';

// Ein Stab von a nach b (dünn = r)
export function stab(a, b, r, mat, r2 = r, ecken = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, A.distanceTo(B), ecken), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
export function klotz(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  return m;
}
const leuchte = (farbe, stark = 1.2) => new THREE.MeshStandardMaterial({ color: farbe, emissive: farbe, emissiveIntensity: stark, roughness: 0.4 });

// Farben der Schaltlichter von links nach rechts: erst grün, dann gelb, am Ende rot (dann schalten!)
const LICHTER = ['#27d94f', '#27d94f', '#27d94f', '#27d94f', '#f4d21f', '#f4d21f', '#f4d21f', '#ff2a2a', '#ff2a2a', '#b44cff'];

// ---------- Bildschirm mit Tempo, Gang und Drehzahl ----------
// art: 'rund' = Straßen-Sportwagen (runder Drehzahlmesser, große Tempo-Zahl)
//      'renn' = Rennwagen und Rallyeauto (Schaltlichter oben, riesiger Gang in der Mitte)
// farbe = Leuchtfarbe der Anzeige. Liefert { mesh, male(a, mal) }; mal = Tempo-Zahl malnehmen (kleine Autos: Maßstab).
export function baueAnzeige(breite, hoehe, { art = 'rund', farbe = '#39c2ff' } = {}) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * hoehe / breite);
  const g = cv.getContext('2d'), B = cv.width, H = cv.height;
  const bild = new THREE.CanvasTexture(cv); bild.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(breite, hoehe), new THREE.MeshBasicMaterial({ map: bild, toneMapped: false }));
  mesh.rotation.y = Math.PI;   // Vorderseite zum Fahrer
  let zuletzt = '';

  function male(a, mal = 1) {
    const p = a.p, kmh = Math.round(Math.abs(a.u) * 3.6 * mal);
    const dreh = Math.min(1, Math.max(0, ((a.drehzahl || 0) - 4000) / ((p.drehzahlMax || 8000) - 4000)));
    const gang = a.u < -0.5 * (p.vMax / 60) ? 'R' : p.gaenge > 1 ? String(a.gang || 1) : 'D';
    const stufe = Math.round(dreh * 30);
    const key = gang + '|' + kmh + '|' + stufe;
    if (key === zuletzt) return;
    zuletzt = key;
    g.fillStyle = '#05070a'; g.fillRect(0, 0, B, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (art === 'renn') {
      // Schaltlichter oben
      const n = LICHTER.length, an = Math.round(dreh * n * 1.05);
      for (let k = 0; k < n; k++) {
        g.fillStyle = k < an ? LICHTER[k] : '#1b1f24';
        g.beginPath(); g.arc(B * (0.08 + 0.84 * k / (n - 1)), H * 0.13, H * 0.065, 0, 7); g.fill();
      }
      // Gang groß in der Mitte
      g.fillStyle = dreh > 0.93 ? '#ff3b3b' : '#ffffff';
      g.font = `bold ${H * 0.66}px sans-serif`; g.fillText(gang, B * 0.5, H * 0.62);
      // Tempo links, Drehzahl rechts
      g.fillStyle = farbe; g.font = `bold ${H * 0.3}px sans-serif`; g.fillText(String(kmh), B * 0.19, H * 0.55);
      g.fillStyle = '#8a97a6'; g.font = `${H * 0.13}px sans-serif`; g.fillText('km/h', B * 0.19, H * 0.82);
      g.fillStyle = '#ffd23a'; g.font = `bold ${H * 0.22}px sans-serif`; g.fillText(String(Math.round((a.drehzahl || 0) / 100) * 100), B * 0.81, H * 0.52);
      g.fillStyle = '#8a97a6'; g.font = `${H * 0.13}px sans-serif`; g.fillText('U/min', B * 0.81, H * 0.82);
      g.strokeStyle = '#27313c'; g.lineWidth = 2; g.strokeRect(B * 0.36, H * 0.28, B * 0.28, H * 0.68);
    } else {
      // runder Drehzahlmesser links: Bogen mit Strichen, rotes Ende, Zeiger
      const mx = B * 0.27, my = H * 0.56, r = H * 0.42, von = Math.PI * 0.75, bis = Math.PI * 2.25;
      g.lineWidth = H * 0.05; g.lineCap = 'butt';
      g.strokeStyle = '#1f2630'; g.beginPath(); g.arc(mx, my, r, von, bis); g.stroke();
      g.strokeStyle = farbe; g.beginPath(); g.arc(mx, my, r, von, von + (bis - von) * Math.min(dreh, 0.85)); g.stroke();
      g.strokeStyle = '#ff3030'; g.beginPath(); g.arc(mx, my, r, von + (bis - von) * 0.85, von + (bis - von) * Math.max(0.85, dreh > 0.85 ? dreh : 0.85) + 0.001); g.stroke();
      g.strokeStyle = '#5a1a1a'; g.lineWidth = H * 0.02; g.beginPath(); g.arc(mx, my, r + H * 0.045, von + (bis - von) * 0.85, bis); g.stroke();
      g.strokeStyle = '#c9d3de'; g.lineWidth = 2;
      for (let k = 0; k <= 8; k++) {
        const w = von + (bis - von) * k / 8;
        g.beginPath(); g.moveTo(mx + Math.cos(w) * (r - H * 0.06), my + Math.sin(w) * (r - H * 0.06)); g.lineTo(mx + Math.cos(w) * (r - H * 0.13), my + Math.sin(w) * (r - H * 0.13)); g.stroke();
      }
      const zw = von + (bis - von) * dreh;
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(zw) * r * 0.82, my + Math.sin(zw) * r * 0.82); g.stroke();
      g.fillStyle = '#ffffff'; g.font = `bold ${H * 0.3}px sans-serif`; g.fillText(gang, mx, my + H * 0.02);
      // Tempo rechts
      g.fillStyle = '#ffffff'; g.font = `bold ${H * 0.44}px sans-serif`; g.fillText(String(kmh), B * 0.72, H * 0.46);
      g.fillStyle = '#8a97a6'; g.font = `${H * 0.14}px sans-serif`; g.fillText('km/h', B * 0.72, H * 0.8);
      g.fillStyle = farbe; g.fillRect(B * 0.54, H * 0.92, B * 0.36 * Math.min(1, kmh / (p.vMax * 3.6 * mal || 300)), H * 0.035);
    }
    bild.needsUpdate = true;
  }
  male({ u: 0, drehzahl: 4000, gang: 1, p: { gaenge: 6, drehzahlMax: 8000, vMax: 80 } });
  return { mesh, male };
}

// ---------- kleines gemaltes Bild für den Bildschirm in der Mitte (Landkarte mit Pfeil) ----------
export function kartenBild(breite, hoehe, farbe = '#39c2ff') {
  const cv = document.createElement('canvas'); cv.width = 192; cv.height = Math.round(192 * hoehe / breite);
  const g = cv.getContext('2d'), B = cv.width, H = cv.height;
  g.fillStyle = '#0b1218'; g.fillRect(0, 0, B, H);
  g.strokeStyle = '#22313f'; g.lineWidth = 5;
  for (const [x1, y1, x2, y2] of [[0, 0.3, 1, 0.45], [0.2, 0, 0.35, 1], [0.7, 0, 0.6, 1], [0, 0.8, 1, 0.7]]) { g.beginPath(); g.moveTo(x1 * B, y1 * H); g.lineTo(x2 * B, y2 * H); g.stroke(); }
  g.strokeStyle = farbe; g.lineWidth = 6; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(B * 0.5, H); g.lineTo(B * 0.5, H * 0.62); g.lineTo(B * 0.64, H * 0.4); g.lineTo(B * 0.62, 0); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(B * 0.5, H * 0.56); g.lineTo(B * 0.44, H * 0.74); g.lineTo(B * 0.56, H * 0.74); g.fill();
  g.fillStyle = '#131c25'; g.fillRect(0, 0, B, H * 0.14);
  g.fillStyle = '#8a97a6'; g.font = `${H * 0.09}px sans-serif`; g.textBaseline = 'middle'; g.fillText('▲ 400 m', B * 0.05, H * 0.07);
  const bild = new THREE.CanvasTexture(cv); bild.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(breite, hoehe), new THREE.MeshBasicMaterial({ map: bild, toneMapped: false }));
  m.rotation.y = Math.PI;
  return m;
}

// ---------- runde Lüftungsdüse (Ring mit Lamellen), Vorderseite nach −z ----------
export function lueftung(r, ringMat, dunkel) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 8, 20), ringMat); g.add(ring);
  const loch = new THREE.Mesh(new THREE.CircleGeometry(r, 20), dunkel); loch.rotation.y = Math.PI; loch.position.z = 0.004; g.add(loch);
  for (const y of [-0.45, 0, 0.45]) g.add(klotz(r * 1.7 * Math.sqrt(1 - y * y), r * 0.1, 0.006, ringMat, 0, y * r, 0));
  return g;
}

// ---------- Reihe Kippschalter mit Lämpchen (Rallyeauto) ----------
export function schalterReihe(n, abstand, metall, farben = [0x30d060, 0x30d060, 0xf2c21a, 0xe02020, 0x39c2ff]) {
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) {
    const x = -(k - (n - 1) / 2) * abstand;
    g.add(stab([x, 0, 0], [x, 0.022, -0.016], 0.004, metall));
    g.add(klotz(0.01, 0.006, 0.004, leuchte(farben[k % farben.length]), x, 0.034, 0));
  }
  return g;
}

// ---------- Lenkrad mit Händen ----------
// art: 'rund'   = Straßen-Sportwagen (drei Speichen, Knöpfe, Schaltwippen)
//      'sport'  = Rallye (unten abgeflacht wirkende Speichen, gelbe Marke oben, tiefe Nabe)
//      'formel' = Rennwagen (eckig mit zwei Griffen, eigener Bildschirm, viele Knöpfe und Drehregler)
// Liefert { halter, gruppe, anzeige, stelle }: halter = alles zusammen (das stellt das Auto an seinen Platz und kippt es),
// gruppe = das Lenkrad selbst, stelle(winkel) dreht es. Die Hände drehen mit, die Ellbogen bleiben, wo sie sind –
// die Unterarme werden bei jedem Bild neu dazwischen gelegt. anzeige gibt es nur beim Formel-Lenkrad.
export function baueLenkrad(art = 'rund', { r = 0.17, naht = 0xc0181c, handschuh = 0x16171a, aermel = 0x1f2228, haende = true, arm = [0.11, -0.27, -0.23], armDick = 1, weit = 9 } = {}) {
  const halter = new THREE.Group(), gruppe = new THREE.Group(); halter.add(gruppe);
  const arme = [];   // je Arm: { mesh, hand: Punkt am Lenkrad, ellbogen: fester Punkt }
  const leder = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.75 });
  const karbon = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.4, metalness: 0.5 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.3, metalness: 0.9 });
  const farbig = new THREE.MeshStandardMaterial({ color: naht, roughness: 0.6 });
  let anzeige = null, griffe;   // griffe = wo die Hände zupacken: [x, y]

  if (art === 'formel') {
    // eckiges Lenkrad: Platte in der Mitte, links und rechts ein Griff
    gruppe.add(klotz(0.25, 0.14, 0.03, karbon));
    gruppe.add(klotz(0.17, 0.035, 0.03, karbon, 0, 0.085, 0));
    for (const s of [-1, 1]) {
      const griff = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.11, 4, 10), leder); griff.position.set(s * 0.15, 0.005, -0.004); griff.rotation.z = s * 0.14; gruppe.add(griff);
      gruppe.add(klotz(0.05, 0.022, 0.03, karbon, s * 0.135, 0.065, 0), klotz(0.05, 0.022, 0.03, karbon, s * 0.135, -0.06, 0));
      gruppe.add(klotz(0.075, 0.05, 0.006, alu, s * 0.1, 0.0, 0.03));          // Schaltwippe hinten
    }
    anzeige = baueAnzeige(0.115, 0.066, { art: 'renn', farbe: '#39ff8a' });
    anzeige.mesh.position.set(0, 0.03, -0.0165); gruppe.add(anzeige.mesh);
    // Knöpfe rund um den Bildschirm und drei Drehregler unten
    const knoepfe = [[0.092, 0.05, 0xff3030], [0.092, 0.018, 0x30a0ff], [-0.092, 0.05, 0x30d060], [-0.092, 0.018, 0xffc020], [0.092, -0.014, 0xffffff], [-0.092, -0.014, 0xff7a1a]];
    for (const [x, y, f] of knoepfe) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 10), leuchte(f, 0.5)); b.rotation.x = Math.PI / 2; b.position.set(x, y, -0.018); gruppe.add(b); }
    for (const [x, f] of [[0.055, 0xd8242a], [0, 0x2a6fdb], [-0.055, 0xe8c21a]]) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.016, 12), alu); d.rotation.x = Math.PI / 2; d.position.set(x, -0.04, -0.022); gruppe.add(d);
      gruppe.add(klotz(0.004, 0.014, 0.004, new THREE.MeshStandardMaterial({ color: f }), x, -0.034, -0.031));
    }
    griffe = [[0.152, 0.01], [-0.152, 0.01]];
  } else {
    const dick = art === 'sport' ? 0.019 : 0.021;
    gruppe.add(new THREE.Mesh(new THREE.TorusGeometry(r, dick, 10, 36), leder));
    // farbige Marke oben in der Mitte: daran sieht man, wie weit das Lenkrad gedreht ist
    const marke = new THREE.Mesh(new THREE.TorusGeometry(r, dick * 1.04, 8, 4, 0.16), art === 'sport' ? new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.5 }) : farbig);
    marke.rotation.z = Math.PI / 2 - 0.08; gruppe.add(marke);
    // Nabe und Speichen (beim Sport-Lenkrad liegt die Nabe tiefer: "geschüsselt")
    const tief = art === 'sport' ? 0.05 : 0.015;
    const nabe = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.34, 0.035, 20), art === 'sport' ? alu : leder); nabe.rotation.x = Math.PI / 2; nabe.position.z = tief; gruppe.add(nabe);
    const deckel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.012, 20), karbon); deckel.rotation.x = Math.PI / 2; deckel.position.z = tief - 0.02; gruppe.add(deckel);
    const speiche = art === 'sport' ? alu : karbon;
    for (const s of [-1, 1]) gruppe.add(stab([s * r * 0.3, 0, tief], [s * (r - 0.012), 0.012, 0], 0.014, speiche, 0.018, 6));
    gruppe.add(stab([0, -r * 0.3, tief], [0, -(r - 0.012), 0], 0.014, speiche, 0.018, 6));
    if (art === 'rund') {
      // Knöpfe auf den Speichen und Schaltwippen dahinter
      for (const s of [-1, 1]) {
        gruppe.add(klotz(0.03, 0.014, 0.008, leuchte(s > 0 ? 0x39c2ff : 0xff4a3a, 0.5), s * r * 0.62, 0.012, -0.012));
        gruppe.add(klotz(0.012, 0.012, 0.008, leuchte(0xe9edf2, 0.4), s * r * 0.44, 0.008, -0.004));
        gruppe.add(klotz(0.04, 0.07, 0.005, karbon, s * r * 0.72, 0.02, 0.035));
      }
    }
    griffe = [[r * 0.966, r * 0.26], [-r * 0.966, r * 0.26]];   // Hände auf "viertel vor drei"
  }

  if (haende) {
    const stoff = new THREE.MeshStandardMaterial({ color: handschuh, roughness: 0.85 });
    const aermelMat = new THREE.MeshStandardMaterial({ color: aermel, roughness: 0.9 });
    for (const [x, y] of griffe) {
      const s = Math.sign(x);
      // Handfläche mit Fingern, die um den Kranz greifen, und der Daumen innen
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), stoff); hand.scale.set(0.9, 1.25, 0.8); hand.position.set(x + s * 0.006, y, -0.012); hand.rotation.z = -s * 0.2; gruppe.add(hand);
      for (let k = 0; k < 4; k++) gruppe.add(klotz(0.05, 0.016, 0.03, stoff, x + s * 0.004, y + 0.036 - k * 0.022, 0.012, 0, 0, -s * 0.2));
      const daumen = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.035, 3, 8), stoff); daumen.position.set(x - s * 0.03, y + 0.03, -0.022); daumen.rotation.z = s * 0.9; gruppe.add(daumen);
      gruppe.add(klotz(0.058, 0.014, 0.012, farbig, x + s * 0.008, y - 0.052, -0.03, 0, 0, -s * 0.2));   // farbiger Streifen am Handgelenk
      // Unterarm: vom Handgelenk nach unten außen zum Ellbogen (arm = wie weit zur Seite, nach unten, zum Fahrer)
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.031 * armDick, 0.04 * armDick, 1, 10), aermelMat); halter.add(mesh);
      arme.push({ mesh, hand: new THREE.Vector3(x + s * 0.012, y - 0.045, -0.03), ellbogen: new THREE.Vector3(x + s * arm[0], y + arm[1], arm[2]) });
    }
  }
  const hoch = new THREE.Vector3(0, 1, 0), achse = new THREE.Vector3(0, 0, 1), p = new THREE.Vector3(), d = new THREE.Vector3();
  const e = new THREE.Vector3();
  function stelle(winkel) {
    winkel = Math.max(-weit, Math.min(weit, winkel));        // weiter drehen die Hände nicht mit (weit = Grenze)
    gruppe.rotation.z = winkel;
    for (const A of arme) {
      p.copy(A.hand).applyAxisAngle(achse, winkel);          // wo das Handgelenk jetzt ist
      // der Ellbogen wandert ein Stück mit der Hand mit, sonst würde der Arm quer durchs Bild liegen
      e.copy(p).sub(A.hand).multiplyScalar(0.5); e.z = 0; e.add(A.ellbogen);
      d.copy(p).sub(e);
      A.mesh.scale.y = d.length();
      A.mesh.position.copy(p).add(e).multiplyScalar(0.5);
      A.mesh.quaternion.setFromUnitVectors(hoch, d.normalize());
    }
  }
  stelle(0);
  return { halter, gruppe, anzeige, stelle };
}
