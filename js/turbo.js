// Rennspiel – Turbo für die kleinen Autos (ohne three.js, auch in node testbar).
//
// Zwei Wege zum Turbo:
//   1. DRIFT-TURBO: Rutscht das Auto quer durch die Kurve, lädt sich der Turbo auf. Erst sprühen blaue Funken,
//      dann orange, dann rosa (Stufe 1, 2, 3). Wird das Auto wieder gerade und du gibst Gas, zündet der Turbo:
//      je höher die Stufe, desto länger schiebt er. Wer in die Bande fährt, verliert die Ladung.
//   2. TURBO-FELDER: leuchtende Pfeile auf der Bahn. Wer darüber fährt, bekommt sofort einen Schub.
// Alle Zahlen sind geschätzt.

export const TURBO = {
  stufen: [0.55, 1.3, 2.3],     // so viele Sekunden Drift braucht es für Stufe 1, 2, 3
  dauer: [0, 0.7, 1.1, 1.6],    // so lange brennt der Turbo je Stufe (Sekunden)
  feld: 1.0,                    // so lange brennt der Turbo nach einem Turbo-Feld
  feldLang: 9,                  // Länge eines Turbo-Felds in Metern eines großen Autos (wird mit dem Maßstab verkleinert)
  feldBreit: 0.42,              // halbe Breite eines Felds als Anteil der halben Bahnbreite
  winkel: { drift: 0.2, modell: 0.13 },   // ab so viel Drift-Winkel (rad) lädt der Turbo
  abTempo: 0.4,                 // … und ab so viel vom Höchsttempo
  ruhe: 0.22,                   // so lange nach dem Drift wartet der Turbo, bevor er zündet (Sekunden)
};
export const FUNKEN_FARBE = [0xffffff, 0x4fb8ff, 0xff9a2e, 0xff4fd0];   // Farbe der Funken je Stufe

// Wo liegen die Turbo-Felder einer Strecke? def.turbo = [[Anteil der Runde, Seite −1 … 1], …]
export function turboFelder(T) {
  return (T.def.turbo || []).map(([anteil, seite = 0]) => {
    const s = anteil * T.laenge, i = T.index(s), hb = T.hb[i];
    return { s, i, lang: TURBO.feldLang * T.sc, d: seite * hb * 0.5, breit: hb * TURBO.feldBreit, an: 0 };
  });
}

// Wie schräg steht das Auto gerade? (Drift-Rallye: wirklich quer; Modellauto: der Drift im Bild)
export const driftWinkel = a => a.p.leicht || !(a.arcade && a.p.arcade) ? (Math.abs(a.u) > 0.02 ? Math.abs(Math.atan2(a.v, Math.abs(a.u))) : 0) : Math.abs(a.drift || 0);

// Jedes Bild für dein Auto. tb = Merkzettel { ladung, stufe, ruhe, zahl }, felder = aus turboFelder.
// Gibt zurück, was passiert ist: 'feld', 'zuenden', 'weg' (Ladung an der Bande verloren) oder null.
export function turboSchritt(a, tb, felder, T, dt) {
  let was = null;
  const p = a.p, schnell = a.u > p.vMax * TURBO.abTempo;
  const w = driftWinkel(a), ab = p.leicht ? TURBO.winkel.drift : TURBO.winkel.modell;
  if (a.stoss > 0.15 && tb.ladung > 0) { tb.ladung = 0; tb.ruhe = 0; was = 'weg'; }
  else if (w > ab && schnell) { tb.ladung += dt * Math.min(1.6, 0.7 + w); tb.ruhe = 0; }
  else if (tb.ladung > 0) {
    tb.ruhe += dt;
    if (tb.ruhe > TURBO.ruhe) {
      if (tb.stufe > 0 && a.gas > 0.3) { a.turbo = Math.max(a.turbo || 0, TURBO.dauer[tb.stufe]); a.turboStufe = tb.stufe; tb.zahl++; was = 'zuenden'; }
      tb.ladung = 0;
    }
  }
  tb.stufe = tb.ladung >= TURBO.stufen[2] ? 3 : tb.ladung >= TURBO.stufen[1] ? 2 : tb.ladung >= TURBO.stufen[0] ? 1 : 0;
  a.funken = tb.stufe;            // fürs Bild: Farbe der Funken an den Hinterrädern
  // Turbo-Felder
  for (const f of felder) {
    if (f.an > 0) f.an -= dt;
    let ds = a.s - f.s; if (ds < -T.laenge / 2) ds += T.laenge; if (ds > T.laenge / 2) ds -= T.laenge;
    if (ds > 0 && ds < f.lang && Math.abs(a.d - f.d) < f.breit && a.u > 0 && f.an <= 0) {
      a.turbo = Math.max(a.turbo || 0, TURBO.feld); a.turboStufe = 2; f.an = 1.5; tb.zahl++; was = 'feld';
    }
  }
  return was;
}
