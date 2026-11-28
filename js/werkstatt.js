// Rennspiel – die Werkstatt (ohne three.js, auch in node testbar).
//
// In der Werkstatt (Pause → „🔧 Werkstatt“) stellt man die Fahrphysik seines Autos selbst ein: mit Schiebereglern.
// Diese Datei weiß nur, WELCHE Regler es gibt und wie aus den Regler-Werten die Zahlen des Autos werden.
// Das Fenster mit den Reglern baut spiel.js.
//
// Wichtig:
//   - Wer keinen Regler bewegt, fährt haargenau mit den Werten aus physik.js, supercars.js und rallyeautos.js.
//   - Die Regler gelten nur für dein Auto. Die Computerfahrer behalten ihre Werte.
//   - Gemerkt wird je Fahrzeug und Fahrgefühl (z. B. „super.arcade“) in den Einstellungen des Profils: E.werkstatt.
//     Dort stehen nur die Regler, die man bewegt hat.
//   - Weil E mit in die Datei von „Fahrt sichern“ kommt, fährt tools/nachfahren.mjs mit denselben Regler-Werten nach.

import { tempoPlan } from './ki.js';

// Ein Regler:
//   pfad    = wo die Zahl im Auto steht (z. B. 'haft' oder 'arcade.rand')
//   name    = Überschrift, text = Erklärung in einem Satz
//   von/bis = Grenzen des Reglers, schritt = Feinheit
//   mal     = der Regler ist ein Faktor (1 = wie gebaut). Das braucht man bei Zahlen, die bei jedem Auto anders sind.
//   grad    = die Zahl ist ein Winkel (im Auto in rad, angezeigt in Grad)
//   sonst   = Wert, wenn das Auto die Zahl gar nicht hat
//   mehr    = steht unter „Mehr Regler“ (für Tüftler)

// Regler für die Arcade-Hilfe (Formel-Rennwagen und Supercars; bei den Supercars auch im Fahrgefühl „echter“,
// denn das ist dort dieselbe Hilfe mit anderen Start-Werten)
const ARCADE = [
  { pfad: 'haft', mal: true, von: 0.7, bis: 1.4, schritt: 0.01, name: 'Reifenhaftung', text: 'Mehr = schneller durch die Kurve, das Auto rutscht später.' },
  { pfad: 'hinten', mal: true, von: 0.85, bis: 1.15, schritt: 0.005, name: 'Halt der Hinterreifen', text: 'Weniger = das Heck kommt eher herum. Mehr = das Auto liegt ruhig, schiebt aber eher geradeaus.' },
  { pfad: 'lenkMax', mal: true, von: 0.6, bis: 1.5, schritt: 0.01, name: 'Lenkeinschlag', text: 'Mehr = die Räder schlagen weiter ein, das Auto dreht enger.' },
  { pfad: 'arcade.lenk', von: 1, bis: 2.5, schritt: 0.05, name: 'Lenkung bei hohem Tempo', text: 'Mehr = auch bei hohem Tempo bleibt viel Lenkeinschlag (schnelle Spurwechsel).' },
  { pfad: 'bremsGriff', mal: true, von: 0.5, bis: 1.6, schritt: 0.01, name: 'Bremskraft', text: 'Mehr = kürzerer Bremsweg.' },
  { pfad: 'schub', mal: true, sonst: 1, von: 0.5, bis: 1.5, schritt: 0.01, name: 'Motorkraft', text: 'Mehr = das Auto beschleunigt stärker.' },
  { pfad: 'arcade.frei', grad: true, von: 0, bis: 0.45, schritt: 0.01, name: 'Erlaubter Drift', text: 'So weit darf das Auto quer rutschen, bevor der Computer es zurückholt.' },
  { pfad: 'arcade.rand', von: 0, bis: 6, schritt: 0.1, name: 'Führung am Straßenrand', text: 'Die unsichtbare Hand, die das Auto vom Rand wegdreht. 0 = aus.' },
  { pfad: 'arcade.ein', von: 0, bis: 20, schritt: 0.5, name: 'Eindreh-Hilfe', text: 'Der Computer dreht das Auto mit, wenn es geradeaus schiebt. 0 = aus.' },
  { pfad: 'arcade.fang', von: 0, bis: 15, schritt: 0.5, name: 'Heck-Fänger', text: 'Der Computer fängt das Heck, wenn es ausbricht. 0 = aus.' },
  { pfad: 'arcade.kurve', von: 0.8, bis: 1.4, schritt: 0.01, name: 'Bremshilfe: Tempo in der Kurve', text: 'Nur mit Bremshilfe: Mehr = sie lässt dich schneller in die Kurve.' },
  { pfad: 'arcade.halt', mehr: true, von: 0, bis: 10, schritt: 0.1, name: 'Zurückholen aus dem Drift', text: 'Wie kräftig der Computer das Auto zurückholt, wenn es weiter rutscht als erlaubt.' },
  { pfad: 'arcade.griff', mehr: true, von: 0.8, bis: 1.8, schritt: 0.01, name: 'Dreh-Freude', text: 'So viel schneller, als die Reifen eigentlich können, darf sich das Auto mit der Eindreh-Hilfe drehen.' },
  { pfad: 'arcade.folgen', mehr: true, von: 6, bis: 60, schritt: 1, name: 'Tempo der Lenkung', text: 'Wie schnell die Räder dem Lenkrad folgen. Mehr = direkter.' },
  { pfad: 'arcade.zug', mehr: true, von: 0, bis: 1, schritt: 0.05, name: 'Zugkraft in der Kurve', text: 'So viel Motorkraft bleibt auch mitten in der Kurve und im Drift.' },
  { pfad: 'lenkTempo', mal: true, mehr: true, von: 0.6, bis: 2, schritt: 0.01, name: 'Lenkung wird bei Tempo feiner', text: 'Mehr = erst bei höherem Tempo wird der Lenkeinschlag kleiner.' },
  { pfad: 'abtrieb', mal: true, mehr: true, von: 0.5, bis: 2, schritt: 0.01, name: 'Abtrieb der Flügel', text: 'Mehr = bei hohem Tempo klebt das Auto stärker auf der Straße.' },
  { pfad: 'esp.beta', grad: true, mehr: true, von: 0.03, bis: 0.8, schritt: 0.01, name: 'Schleuderschutz greift ab', text: 'Erst ab diesem Rutschwinkel fängt der Schleuderschutz das Auto (nur mit „Traktion an“).' },
  { pfad: 'zugGriff', mal: true, mehr: true, von: 0.5, bis: 1.5, schritt: 0.01, name: 'Halt beim Beschleunigen', text: 'Mehr = die Räder drehen beim Gasgeben später durch.' },
];

// Regler für das Fahrgefühl „echter“ des Formel-Rennwagens (das rechnet anders als Arcade: ohne ziehende Hilfen)
const FORMEL_ECHT = [
  { pfad: 'haft', mal: true, von: 0.7, bis: 1.4, schritt: 0.01, name: 'Reifenhaftung', text: 'Mehr = schneller durch die Kurve, das Auto rutscht später.' },
  { pfad: 'hinten', mal: true, von: 0.85, bis: 1.15, schritt: 0.005, name: 'Halt der Hinterreifen', text: 'Weniger = das Heck kommt eher herum. Mehr = das Auto liegt ruhig, schiebt aber eher geradeaus.' },
  { pfad: 'echt.gMitte', von: 1, bis: 8, schritt: 0.1, name: 'Lenkung bei hohem Tempo', text: 'Mehr = schon wenig Lenkrad lenkt bei hohem Tempo stark ein.' },
  { pfad: 'bremsGriff', mal: true, von: 0.5, bis: 1.6, schritt: 0.01, name: 'Bremskraft', text: 'Mehr = kürzerer Bremsweg.' },
  { pfad: 'schub', mal: true, sonst: 1, von: 0.5, bis: 1.5, schritt: 0.01, name: 'Motorkraft', text: 'Mehr = das Auto beschleunigt stärker.' },
  { pfad: 'echt.kurvenAbs', von: 0, bis: 1, schritt: 0.05, name: 'Lenken beim Bremsen', text: 'So viel Halt bleibt beim Bremsen fürs Lenken übrig (nur mit „Traktion an“). 0 = aus.' },
  { pfad: 'echt.esp.beta', grad: true, von: 0.03, bis: 0.5, schritt: 0.01, name: 'Schleuderschutz greift ab', text: 'Erst ab diesem Rutschwinkel fängt der Schleuderschutz das Auto (nur mit „Traktion an“).' },
  { pfad: 'echt.esp.dreh', von: 0, bis: 25, schritt: 0.5, name: 'Stärke des Schleuderschutzes', text: 'Wie kräftig er das Auto wieder gerade stellt. 0 = aus.' },
  { pfad: 'echt.sicher', von: 0.5, bis: 1, schritt: 0.01, name: 'Bremszonen: Tempo in der Kurve', text: 'Mehr = rote Bremszonen und Bremshilfe lassen dich schneller durch die Kurve.' },
  { pfad: 'echt.bremsen', von: 0.4, bis: 1, schritt: 0.01, name: 'Bremszonen: wie spät bremsen', text: 'Mehr = die Bremszonen fangen später an.' },
  { pfad: 'echt.neben', von: 0, bis: 1, schritt: 0.05, name: 'Halt neben der Fahrbahn', text: 'So viel Halt bleibt mindestens auf Gras und Kies.' },
  { pfad: 'lenkMax', mal: true, mehr: true, von: 0.6, bis: 1.5, schritt: 0.01, name: 'Lenkeinschlag', text: 'Mehr = die Räder schlagen weiter ein, das Auto dreht enger.' },
  { pfad: 'echt.kurve', mehr: true, von: 0.8, bis: 1.2, schritt: 0.01, name: 'Bremshilfe: Tempo in der Kurve', text: 'Nur mit Bremshilfe: Mehr = sie lässt dich schneller in die Kurve.' },
  { pfad: 'echt.regler', mehr: true, von: 0, bis: 1, schritt: 0.02, name: 'Lenkung regelt nach', text: 'Wie stark die Lenkung von selbst nachstellt, bis das Auto so dreht, wie das Lenkrad steht.' },
  { pfad: 'echt.folgen', mehr: true, von: 6, bis: 60, schritt: 1, name: 'Tempo der Lenkung', text: 'Wie schnell die Räder dem Lenkrad folgen. Mehr = direkter.' },
  { pfad: 'abtrieb', mal: true, mehr: true, von: 0.5, bis: 2, schritt: 0.01, name: 'Abtrieb der Flügel', text: 'Mehr = bei hohem Tempo klebt das Auto stärker auf der Straße.' },
  { pfad: 'zugGriff', mal: true, mehr: true, von: 0.5, bis: 1.5, schritt: 0.01, name: 'Halt beim Beschleunigen', text: 'Mehr = die Räder drehen beim Gasgeben später durch.' },
];

// Regler für die Rallyeautos in Arcade und „echter“ (auch hier ist „echter“ dieselbe Hilfe mit anderen Start-Werten).
// Die ersten Regler sind dieselben wie bei den Supercars, dazu kommt alles, was es nur in der Rallye gibt.
const nimm = (...pfade) => pfade.map(pf => ({ ...ARCADE.find(r => r.pfad === pf), mehr: false }));
const RALLYE = [
  ...nimm('haft', 'hinten', 'lenkMax', 'arcade.lenk', 'bremsGriff', 'schub', 'arcade.frei'),
  { pfad: 'arcade.freiHand', grad: true, von: 0.1, bis: 1.2, schritt: 0.01, name: 'Erlaubter Drift mit Handbremse', text: 'So weit darf das Auto mit gezogener Handbremse quer rutschen.' },
  { pfad: 'arcade.drift.winkel', grad: true, von: 0, bis: 0.9, schritt: 0.01, name: 'Drift im Bild', text: 'So weit stellt sich das Auto in harten Kurven quer (nur fürs Auge, die Reifen halten weiter). 0 = aus.' },
  { pfad: 'arcade.rand', von: 0, bis: 6, schritt: 0.1, name: 'Führung am Wegrand', text: 'Die unsichtbare Hand, die das Auto vom Rand wegdreht. 0 = aus.' },
  { pfad: 'arcade.spur', von: 0, bis: 4, schritt: 0.1, name: 'Spur-Helfer', text: 'Dreht das Auto langsam in Richtung des Wegs. 0 = aus.' },
  ...nimm('arcade.ein', 'arcade.fang', 'arcade.kurve'),
  { pfad: 'arcade.halt', mehr: true, von: 0, bis: 15, schritt: 0.1, name: 'Zurückholen aus dem Drift', text: 'Wie kräftig der Computer das Auto zurückholt, wenn es weiter rutscht als erlaubt.' },
  { pfad: 'arcade.belag', mehr: true, von: 0, bis: 1, schritt: 0.05, name: 'Hilfe auf losem Boden', text: 'So viel vom fehlenden Halt auf Schotter und Wasser gleicht der Computer aus. 0 = der Boden rutscht voll.' },
  { pfad: 'arcade.kreis', mehr: true, von: 3, bis: 12, schritt: 0.1, name: 'Engster Kreis (Meter)', text: 'Kleiner = das Auto dreht beim Fahren enger.' },
  { pfad: 'arcade.unter.ab', mehr: true, von: 0.1, bis: 1, schritt: 0.01, name: 'Bremst von selbst ab so viel Lenkrad', text: 'Zu schnell und das Lenkrad weiter eingeschlagen als das: Das Auto nimmt Gas weg und bremst mit. 1 = praktisch aus.' },
  { pfad: 'arcade.drift.hand', grad: true, mehr: true, von: 0, bis: 1.3, schritt: 0.01, name: 'Drift im Bild mit Handbremse', text: 'So weit stellt sich das Auto mit Handbremse quer (nur fürs Auge).' },
  { pfad: 'arcade.fall', mehr: true, von: 1, bis: 3, schritt: 0.05, name: 'Sprünge: Fallen', text: 'Mehr = das Auto fällt schneller, Sprünge sind kürzer.' },
  ...ARCADE.filter(r => ['arcade.griff', 'arcade.folgen', 'arcade.zug', 'lenkTempo', 'esp.beta', 'zugGriff'].includes(r.pfad)),
];

// Regler für das neue, schlichte Fahrmodell der Rallye (Fahrgefühl „Neu“): echtes Rutschen, keine ziehenden Hilfen
const RALLYE_NEU = [
  { pfad: 'schlicht.haft', von: 0.8, bis: 1.8, schritt: 0.01, name: 'Reifenhaftung', text: 'Mehr = schneller durch die Kurve, das Auto rutscht später.' },
  { pfad: 'schlicht.belag', von: 0, bis: 1, schritt: 0.05, name: 'Loser Boden rutscht', text: 'Mehr = Schotter und Wasser haben spürbar weniger Halt als Asphalt. 0 = überall gleich.' },
  { pfad: 'schlicht.direkt', von: 1, bis: 8, schritt: 0.1, name: 'Lenk-Direktheit', text: 'Mehr = schon wenig Lenkrad bringt die engste Kurve, die die Reifen können.' },
  { pfad: 'schlicht.kreis', von: 4, bis: 12, schritt: 0.1, name: 'Engster Kreis (Meter)', text: 'Kleiner = das Auto dreht bei wenig Tempo enger.' },
  { pfad: 'schlicht.querAb', von: 0.2, bis: 0.95, schritt: 0.01, name: 'Drift beginnt ab so viel Lenkrad', text: 'Erst wer weiter einlenkt als das und Gas gibt, bringt das Heck herum. Kleiner = driftet früher.' },
  { pfad: 'schlicht.dreh', von: 1, bis: 3, schritt: 0.05, name: 'Wie weit das Heck kommt', text: 'Mehr = größerer Drift-Winkel. 1 = kein Drift.' },
  { pfad: 'schlicht.gas', von: 0, bis: 1.5, schritt: 0.05, name: 'Gas drückt das Heck herum', text: 'Mehr = mit Vollgas wird der Drift noch weiter.' },
  { pfad: 'schlicht.stabil', von: 0, bis: 4, schritt: 0.1, name: 'Geradestellen', text: 'Mehr = das Auto stellt sich schneller von selbst wieder gerade.' },
  { pfad: 'schlicht.brems', von: 0.8, bis: 3, schritt: 0.05, name: 'Bremskraft', text: 'Mehr = kürzerer Bremsweg.' },
  { pfad: 'schlicht.zug', von: 1, bis: 3, schritt: 0.05, name: 'Antritt', text: 'Mehr = das Auto beschleunigt stärker (so viel halten die Reifen beim Gasgeben aus).' },
  { pfad: 'schlicht.zugQuer', von: 0, bis: 1, schritt: 0.05, name: 'Zugkraft im Drift', text: 'So viel Motorkraft bleibt, wenn das Auto quer rutscht. Mehr = der Drift kostet weniger Tempo.' },
  { pfad: 'schlicht.kurve', von: 0.8, bis: 1.3, schritt: 0.01, name: 'Bremshilfe: Tempo in der Kurve', text: 'Nur mit Bremshilfe: Mehr = sie lässt dich schneller in die Kurve.' },
  { pfad: 'schlicht.driftAuf', mehr: true, von: 1, bis: 10, schritt: 0.1, name: 'Drift baut sich auf', text: 'Mehr = das Heck kommt schneller.' },
  { pfad: 'schlicht.driftAb', mehr: true, von: 2, bis: 15, schritt: 0.1, name: 'Drift hört auf', text: 'Mehr = das Heck kommt schneller zurück, wenn du gegenlenkst oder vom Gas gehst.' },
  { pfad: 'schlicht.handDreh', mehr: true, von: 1, bis: 3, schritt: 0.05, name: 'Handbremse: Eindrehen', text: 'Mehr = die Handbremse wirft das Heck weiter herum.' },
  { pfad: 'schlicht.handBrems', mehr: true, von: 0, bis: 1, schritt: 0.05, name: 'Handbremse: Bremsen', text: 'So stark bremst die Handbremse dabei.' },
  { pfad: 'schub', mal: true, mehr: true, sonst: 1, von: 0.5, bis: 1.5, schritt: 0.01, name: 'Motorkraft', text: 'Mehr = mehr Kraft bei hohem Tempo.' },
];

// Welche Regler gibt es für welches Fahrzeug und Fahrgefühl?
export const REGLER = {
  f1: { arcade: ARCADE, echt: FORMEL_ECHT },
  super: { arcade: ARCADE, echt: ARCADE },
  rallye: { arcade: RALLYE, echt: RALLYE, neu: RALLYE_NEU },
};

export const GEFUEHL_NAME = { arcade: 'Arcade', echt: 'echter', neu: 'Neu' };
export const FAHRZEUG_NAME = { f1: 'Formel-Rennwagen', super: 'Supercar', rallye: 'Rallye' };

// Fahrgefühl aus den Einstellungen: 'arcade', 'echt' oder 'neu' („Neu“ gibt es nur in der Rallye, sonst zählt es wie Arcade)
export function gefuehlVon(E) {
  if (E.arcade === false) return 'echt';
  if (E.arcade === 'neu' && E.fahrzeug === 'rallye') return 'neu';
  return 'arcade';
}
// Unter diesem Namen stehen die Regler-Werte in E.werkstatt
export const schluessel = E => E.fahrzeug + '.' + gefuehlVon(E);
// Die Liste der Regler für das, was gerade gefahren wird (oder null, wenn es dafür keine gibt)
export function reglerFuer(E) {
  const f = REGLER[E.fahrzeug];
  return f && f[gefuehlVon(E)] || null;
}

// Eine Zahl aus dem Auto lesen: lies(p, 'arcade.rand')
export function lies(p, pfad) {
  let o = p;
  for (const k of pfad.split('.')) { if (o == null) return undefined; o = o[k]; }
  return o;
}
// Die Zahl, wie sie gebaut ist (ohne Werkstatt)
export const grundWert = (p, r) => { const w = lies(p, r.pfad); return typeof w === 'number' ? w : r.sonst; };
// Wo der Regler steht, wenn man ihn nicht bewegt hat: bei einem Faktor auf 1, sonst auf der gebauten Zahl
export const grundStellung = (p, r) => r.mal ? 1 : grundWert(p, r);
// Wo der Regler gerade steht
export function stellung(p, r, werte) {
  const w = werte && werte[r.pfad];
  return typeof w === 'number' && isFinite(w) ? Math.max(r.von, Math.min(r.bis, w)) : grundStellung(p, r);
}
// Die Zahl, die damit im Auto landet
export const wertBei = (p, r, s) => r.mal ? grundWert(p, r) * s : s;

// So steht der Wert neben dem Regler: '112 %', '8°', '3,5'
export function anzeige(p, r, s) {
  const komma = (x, n) => x.toFixed(n).replace('.', ',');
  if (r.mal) return Math.round(s * 100) + ' %';
  if (r.grad) return Math.round(s * 180 / Math.PI) + '°';
  return komma(s, r.schritt >= 1 ? 0 : r.schritt >= 0.1 ? 1 : 2);
}

// Baut aus den gebauten Zahlen p und den Regler-Werten ein neues p. p selbst bleibt, wie es ist
// (wichtig: Die Computerfahrer benutzen dieselben Tabellen).
export function mitWerten(p, liste, werte) {
  const neu = { ...p };
  for (const r of liste) {
    if (!werte || typeof werte[r.pfad] !== 'number') continue;
    if (grundWert(p, r) === undefined) continue;          // dieses Auto hat die Zahl gar nicht
    const teile = r.pfad.split('.');
    let o = neu;
    for (let i = 0; i < teile.length - 1; i++) { o[teile[i]] = { ...o[teile[i]] }; o = o[teile[i]]; }
    o[teile[teile.length - 1]] = wertBei(p, r, stellung(p, r, werte));
  }
  return neu;
}

// Sind für das, was gerade gefahren wird, Regler verstellt?
export function verstellt(E) {
  const liste = reglerFuer(E), werte = E.werkstatt && E.werkstatt[schluessel(E)];
  return !!(liste && werte && liste.some(r => typeof werte[r.pfad] === 'number'));
}

// Legt die Regler-Werte auf dein Auto. Wird beim Bauen des Rennens gerufen (rennbau.js) und jedes Mal, wenn man in der
// Werkstatt einen Regler bewegt. Ohne verstellte Regler bleibt alles genau so, wie das Rennen gebaut wurde.
export function werkstattAnwenden(rennen, E, T) {
  const c = rennen && rennen.ich; if (!c || !c.a) return false;
  const a = c.a;
  if (!a.pGrund) { a.pGrund = a.p; rennen.LSGrund = rennen.LS; }   // einmal merken, wie es gebaut war
  const an = verstellt(E);
  a.p = an ? mitWerten(a.pGrund, reglerFuer(E), E.werkstatt[schluessel(E)]) : a.pGrund;
  // Bremszonen, Kurven-Gang und Bremshilfe rechnen mit einem Tempo-Plan. Der muss zu deinem Auto passen:
  // Mit mehr Haftung oder Bremse darf er schneller sein. Die Linie bleibt dieselbe, die Gegner behalten ihren Plan.
  if (rennen.LSGrund && T) {
    if (!an) rennen.LS = rennen.LSGrund;
    else {
      const X = !a.arcade && !a.schlicht && a.p.echt;
      rennen.LS = { ...rennen.LSGrund, tempo: X ? tempoPlan(T, rennen.LSGrund.kr, a.p, X.sicher, X.bremsen) : tempoPlan(T, rennen.LSGrund.kr, a.p) };
    }
  }
  return an;
}
