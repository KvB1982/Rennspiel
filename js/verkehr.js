// Rennspiel – Verkehr auf den Straßen-Strecken der Supercars (ohne three.js, auch in node testbar).
//
// Normale Autos, Transporter, Lastwagen und Busse fahren auf ihrer Spur mit dem Tempo, das in der Zone gilt
// (Stadt langsam, Landstraße schneller, Autobahn am schnellsten). Rechts fahren sie in deine Richtung,
// links kommen sie dir entgegen (Gegenverkehr). Auf der Autobahn fährt der Gegenverkehr hinter der Mittelmauer.
// Sie fahren nicht wie die Rennfahrer mit Physik, sondern wie auf Schienen entlang ihrer Spur:
// Ist vorn jemand langsamer, bremsen sie. Kracht ein Supercar hinein, fliegt das Verkehrsauto weg ("frei"):
// Es rutscht und dreht sich, springt ein wenig hoch, bleibt mit Warnblinker stehen und fährt dann weiter.
// Das Supercar zählt beim Stoß wie ein viel schwereres Auto (RENNER_MASSE) und bleibt deshalb fast auf Kurs.

import { ZONEN, ZONEN_LISTE } from './strecke.js';

// Fahrzeugarten: Länge, Breite, Höhe (m), wo sie fahren dürfen, wie oft
// masse = wie schwer es beim Zusammenstoß zählt (kg)
export const ARTEN = {
  kompakt: { lang: 4.0, breit: 1.75, hoch: 1.45, oft: 3, masse: 1100 },
  limousine: { lang: 4.8, breit: 1.85, hoch: 1.45, oft: 3, masse: 1500 },
  gelaende: { lang: 4.7, breit: 1.92, hoch: 1.7, oft: 2, masse: 1900 },
  transporter: { lang: 5.6, breit: 2.0, hoch: 2.5, oft: 1.2, masse: 2400 },
  lkw: { lang: 10, breit: 2.5, hoch: 3.6, oft: 0.8, nicht: ['stadt', 'dorf'], masse: 6000 },
  bus: { lang: 12, breit: 2.55, hoch: 3.1, oft: 0.6, nur: ['stadt'], masse: 7000 },
};
const RENNER_MASSE = 4;    // beim Stoß zählt ein Rennauto so viel mal schwerer, als es ist (Spiel-Wert: du bleibst stabil)
const WEG_AB = 2.5;        // ab diesem Aufprall-Tempo (m/s) fliegt das Verkehrsauto aus der Spur
const RUTSCH = 7;          // so stark bremst ein weggeschleudertes Auto beim Rutschen (m/s²)
const WARTEN = 2.5;        // so lange steht es danach (s), bevor es zurück in die Spur fährt
const FARBEN = [0xe8e8e8, 0x1c1c1e, 0x8a9099, 0xb02a2a, 0x2a4f8a, 0x3c6e47, 0xd9d2c0, 0x5a5f66, 0xc9c9c9, 0x7a2f45, 0xe0b020, 0x2f8fc0];
const ABSTAND = 14;   // so viel Platz lassen sie zum Vordermann (m)

// kleine Zufallszahlen, die bei jedem Start gleich sind
function zufall(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export class Verkehr {
  // menge: 0 = kein Verkehr, 0,5 = wenig, 1 = normal, 1,6 = viel. frei = Bereich um den Start ohne Autos [von, bis] in Metern
  constructor(T, { menge = 1, seed = 7 } = {}) {
    this.T = T; this.autos = [];
    if (!T.strasse || menge <= 0) return;
    const r = zufall(seed), L = T.laenge;
    const zoneAn = s => ZONEN[ZONEN_LISTE[T.zone[T.index(s)]]];
    const artWahl = zn => {
      const liste = Object.entries(ARTEN).filter(([, A]) => !(A.nicht && A.nicht.includes(zn)) && !(A.nur && !A.nur.includes(zn)));
      let summe = liste.reduce((q, [, A]) => q + A.oft, 0), x = r() * summe;
      for (const [k, A] of liste) { x -= A.oft; if (x <= 0) return k; }
      return liste[0][0];
    };
    for (const dir of [1, -1]) for (let spur = 0; spur < 3; spur++) {
      let s = 200 + r() * 80;
      while (s < L - 320) {
        const Z = zoneAn(s), zn = ZONEN_LISTE[Z.nr];
        if (spur < Z.spuren) {
          const typ = artWahl(zn);
          const tempoMal = 0.86 + r() * 0.28;
          this.autos.push({ s, dir, spur, d: 0, v: Z.tempo * tempoMal, mal: tempoMal, typ, ...ARTEN[typ], farbe: FARBEN[Math.floor(r() * FARBEN.length)],
            x: 0, y: 0, z: 0, h: 0, u: 0, idx: 0, stoss: 0, blink: 0 });
          s += ARTEN[typ].lang + ABSTAND + 10 - Math.log(1 - r() * 0.98) / (Z.dicht * menge);
        } else s += 40;
      }
    }
    for (const t of this.autos) { t.d = this.spurD(t, T.index(t.s)); this.stellen(t); }
  }

  // Wo (seitlich) ist die Spur dieses Autos an der Stelle i? (plus = links)
  spurD(t, i) {
    const T = this.T, Z = ZONEN[ZONEN_LISTE[T.zone[i]]], hb = T.hb[i];
    const n = Z.spuren, k = t.spur % n;
    if (Z.getrennt) {
      const w = 2 * hb / n;
      return t.dir > 0 ? -hb + (k + 0.5) * w : hb + T.ausL[i] + 1.4 + 2 * hb - (k + 0.5) * w;
    }
    const w = hb / n;
    return t.dir > 0 ? -hb + (k + 0.5) * w : hb - (k + 0.5) * w;
  }

  // Ort und Richtung in der Welt (aus s und d)
  stellen(t) {
    const T = this.T, L = T.laenge;
    t.s = ((t.s % L) + L) % L;
    const f = t.s / L * T.n, i = Math.floor(f) % T.n, j = (i + 1) % T.n, u = f - Math.floor(f);
    const x = T.x[i] + (T.x[j] - T.x[i]) * u, z = T.z[i] + (T.z[j] - T.z[i]) * u;
    const tx = T.tx[i] + (T.tx[j] - T.tx[i]) * u, tz = T.tz[i] + (T.tz[j] - T.tz[i]) * u;
    t.idx = i;
    t.x = x + tz * t.d; t.z = z - tx * t.d; t.y = T.y[i] + (T.y[j] - T.y[i]) * u;
    t.h = Math.atan2(tx, tz) + (t.dir < 0 ? Math.PI : 0) - t.dir * (t.dWeg || 0);
    t.u = t.dir * t.v;           // Tempo entlang der Strecke (minus = Gegenverkehr), damit die Computerfahrer ausweichen können
  }

  // ein Bild weiter. renner = die Autos im Rennen (Physik-Autos mit x, z, s, d, u)
  update(dt, renner = []) {
    const T = this.T, L = T.laenge, A = this.autos;
    // Wer fährt vor wem? Nach Richtung und Stelle sortieren, dann ist der Vordermann der Nächste in der Liste.
    for (const dir of [1, -1]) {
      const liste = A.filter(t => t.dir === dir).sort((p, q) => dir * (p.s - q.s));
      const m = liste.length;
      for (let k = 0; k < m; k++) {
        const t = liste[k];
        if (t.frei) { this.fliegen(t, dt); continue; }
        const Z = ZONEN[ZONEN_LISTE[T.zone[t.idx]]];
        let ziel = Z.tempo * t.mal;
        // nach vorn schauen: das nächste Auto auf derselben Spur
        for (let q = 1; q < Math.min(m, 12); q++) {
          const o = liste[(k + q) % m];
          let ab = dir * (o.s - t.s); if (ab < 0) ab += L;
          if (ab > 90) break;
          if (Math.abs(o.d - t.d) > 2.2) continue;
          const luecke = ab - (o.lang + t.lang) / 2 - ABSTAND;
          ziel = Math.min(ziel, Math.max(0, o.v + luecke * 0.6));
          break;
        }
        // Rennfahrer vor mir auf meiner Spur: bremsen
        for (const a of renner) {
          let ab = dir * (a.s - t.s); if (ab < -L / 2) ab += L; if (ab > L / 2) ab -= L;
          if (ab <= 0 || ab > 70 || Math.abs(a.d - t.d) > 2.4) continue;
          const vor = dir * a.u;   // wie schnell der Rennfahrer in meine Richtung fährt
          ziel = Math.min(ziel, Math.max(0, vor + (ab - t.lang / 2 - 8) * 0.5));
        }
        // Gas und Bremse wie ein ruhiger Fahrer
        const dv = ziel - t.v;
        t.v += Math.max(-8, Math.min(2.2, dv * 2)) * dt;
        if (t.v < 0) t.v = 0;
        t.s += dir * t.v * dt;
        // Spur halten (wird die Straße breiter oder schmaler, gleitet es weich auf die neue Spur)
        const i = T.index(t.s);
        const dz = this.spurD(t, i);
        const neu = t.d + (dz - t.d) * Math.min(1, dt * 1.2);
        t.dWeg = t.v > 1 ? Math.atan2(neu - t.d, t.v * dt) * 0.8 : 0;
        t.d = neu;
        if (t.stoss > 0) t.stoss = Math.max(0, t.stoss - dt);
        if (t.blink > 0) t.blink -= dt;
        this.stellen(t);
        // nach dem Wegfliegen: Schräglage und Drehung weich wieder gerade machen
        if (t.dh) { t.h += t.dh; t.dh *= Math.max(0, 1 - dt * 1.5); if (Math.abs(t.dh) < 0.01) t.dh = 0; }
      }
    }
  }

  // Ein weggeschleudertes Auto: rutscht frei über die Straße, dreht sich, springt und kippt ein wenig
  fliegen(t, dt) {
    const T = this.T, F = t.frei;
    const v = Math.hypot(F.vx, F.vz);
    if (v > 0) { const nv = Math.max(0, v - RUTSCH * dt); F.vx *= nv / v; F.vz *= nv / v; }
    F.w *= Math.max(0, 1 - dt * 1.2);
    t.x += F.vx * dt; t.z += F.vz * dt; t.h += F.w * dt;
    // hoch und wieder runter
    F.vy -= 9.81 * dt; F.y += F.vy * dt;
    if (F.y < 0) { F.y = 0; F.vy = Math.abs(F.vy) > 2 ? -F.vy * 0.3 : 0; }
    F.kipp *= Math.max(0, 1 - dt * 2.5); F.nick *= Math.max(0, 1 - dt * 2.5);
    // nicht durch Häuser und Mauern: an der Begrenzung abprallen
    const f = T.finde(t.x, t.z, t.idx, 8);
    const zuRand = f.d > 0 ? T.hb[f.i] + T.ausL[f.i] + (T.zone[f.i] === 3 ? 2 * T.hb[f.i] + 1.4 : 0) - t.breit / 2
      : -(T.hb[f.i] + T.ausR[f.i] - t.breit / 2);
    if (Math.abs(f.d) > Math.abs(zuRand)) {
      const seite = Math.sign(f.d), nx = f.tz * seite, nz = -f.tx * seite, zu = Math.abs(f.d) - Math.abs(zuRand);
      t.x -= nx * zu; t.z -= nz * zu;
      const geg = F.vx * nx + F.vz * nz;
      if (geg > 0) { F.vx -= nx * geg * 1.4; F.vz -= nz * geg * 1.4; F.w *= 0.6; }
    }
    t.idx = f.i; t.s = f.s; t.d = f.d; t.y = f.y + F.y;
    // Tempo entlang der Strecke (für die Computerfahrer)
    t.u = F.vx * f.tx + F.vz * f.tz; t.v = Math.abs(t.u);
    if (Math.hypot(F.vx, F.vz) < 0.3 && F.y === 0) {
      F.steht += dt;
      if (F.steht > WARTEN) {
        // zurück in den Verkehr: Es fährt von hier langsam los und gleitet in seine Spur
        const bahn = Math.atan2(f.tx, f.tz) + (t.dir < 0 ? Math.PI : 0);
        let dh = t.h - bahn; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        t.dh = Math.abs(dh) > 1.2 ? 0 : dh;   // ganz verdreht: einfach gerade stellen
        t.frei = null; t.v = 0; t.kipp = 0; t.nick = 0;
        return;
      }
    }
    t.kipp = F.kipp; t.nick = F.nick;
    if (t.blink > 0) t.blink -= dt;
  }

  // Zusammenstöße mit den Rennautos. Gerechnet wird ein Stoß zwischen zwei Körpern: Das Rennauto zählt
  // RENNER_MASSE-mal schwerer, darum bleibt es fast auf Kurs, und das Verkehrsauto wird weggeschubst.
  // Gibt zurück, wie hart das Auto "ich" getroffen wurde (0 = gar nicht).
  stoesse(renner, ich = null) {
    let hart = 0;
    for (const a of renner) {
      for (const t of this.autos) {
        const dx0 = a.x - t.x, dz0 = a.z - t.z;
        if (dx0 * dx0 + dz0 * dz0 > (t.lang / 2 + 4) ** 2) continue;
        // Verkehrsauto als Reihe von Kreisen, Rennauto als zwei Kreise
        const rt = t.breit / 2, ra = 1.0;
        const st = Math.sin(t.h), ct = Math.cos(t.h);
        const kreise = Math.max(1, Math.round(t.lang / t.breit));
        const mA = (a.p.masse || 1500) * RENNER_MASSE, mT = t.masse;
        const anteilA = mT / (mA + mT);       // so viel vom Ineinander-Stecken und vom Stoß bekommt das Rennauto ab
        for (const ka of [-1.5, 1.5]) {
          const ax = a.x + Math.sin(a.h) * ka, az = a.z + Math.cos(a.h) * ka;
          for (let q = 0; q < kreise; q++) {
            const off = kreise === 1 ? 0 : -t.lang / 2 + rt + (t.lang - 2 * rt) * q / (kreise - 1);
            const bx = t.x + st * off, bz = t.z + ct * off;
            let nx = ax - bx, nz = az - bz; const d = Math.hypot(nx, nz);
            if (d >= ra + rt || d < 1e-6) continue;
            nx /= d; nz /= d;
            const tief = ra + rt - d;
            // Tempo beider Autos in der Welt
            const sh = Math.sin(a.h), ch = Math.cos(a.h);
            let wx = sh * a.u + ch * a.v, wz = ch * a.u - sh * a.v;
            const F = t.frei;
            const vtx = F ? F.vx : st * t.v, vtz = F ? F.vz : ct * t.v;
            const rel = (wx - vtx) * nx + (wz - vtz) * nz;    // minus = sie fahren aufeinander zu
            if (rel >= 0) {
              // nur ineinander, nicht aufeinander zu: auseinanderschieben
              a.x += nx * tief * (F ? anteilA : 1); a.z += nz * tief * (F ? anteilA : 1);
              if (F) { t.x -= nx * tief * (1 - anteilA); t.z -= nz * tief * (1 - anteilA); }
              continue;
            }
            const j = -(1 + 0.35) * rel;              // Stoß (Tempo-Änderung beider zusammen)
            const hartHier = -rel;
            if (!F && hartHier < WEG_AB) {
              // leichter Rempler: Das Verkehrsauto bleibt in der Spur, nur das Rennauto wird etwas abgelenkt
              a.x += nx * tief; a.z += nz * tief;
              wx += nx * j * 0.6; wz += nz * j * 0.6;
              t.v *= 0.9;
            } else {
              // Rumms: Das Verkehrsauto fliegt los
              a.x += nx * tief * anteilA; a.z += nz * tief * anteilA;
              wx += nx * j * anteilA; wz += nz * j * anteilA;
              let fx = vtx - nx * j * (1 - anteilA), fz = vtz - nz * j * (1 - anteilA);
              // ein Teil vom Tempo des Rennautos nimmt es mit (es wird geschoben)
              fx += (wx - fx) * 0.25; fz += (wz - fz) * 0.25;
              t.x -= nx * tief * (1 - anteilA); t.z -= nz * tief * (1 - anteilA);
              // Drehung: je weiter hinten oder vorn getroffen, desto mehr dreht es sich
              const hebel = off / (t.lang / 2 + 0.01);
              const quer = nx * ct - nz * st;           // wie sehr der Stoß von der Seite kommt
              const w = -hebel * quer * j * (1 - anteilA) * 0.35 + (Math.random() - 0.5) * Math.min(4, hartHier * 0.1);
              if (F) {
                F.vx = fx; F.vz = fz; F.w += w; F.vy = Math.max(F.vy, Math.min(5, hartHier * 0.12)); F.steht = 0;
              } else {
                t.frei = { vx: fx, vz: fz, w, y: 0, vy: Math.min(5, hartHier * 0.12),
                  kipp: Math.max(-0.6, Math.min(0.6, (quer + (Math.random() - 0.5) * 0.6) * hartHier * 0.02)),
                  nick: Math.max(-0.4, Math.min(0.4, (Math.random() - 0.5) * hartHier * 0.02)), steht: 0 };
              }
              t.blink = 8;
            }
            a.u = sh * wx + ch * wz; a.v = ch * wx - sh * wz;
            a.r += (Math.random() - 0.5) * Math.min(0.4, hartHier * 0.01);   // nur ein kleiner Ruck für das Rennauto
            a.stoss = Math.max(a.stoss, hartHier * anteilA * 2);
            t.stoss = 1.5;
            if (a === ich) hart = Math.max(hart, hartHier);
          }
        }
      }
    }
    return hart;
  }
}
