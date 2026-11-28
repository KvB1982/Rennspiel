// Rennspiel – aus den Einstellungen ein Rennen oder eine Rallye-Prüfung bauen (ohne three.js).
// Das Spiel (spiel.js) und das Werkzeug zum Nachfahren (tools/nachfahren.mjs) benutzen beide diese Datei.
// So ist sicher: Eine aufgenommene Fahrt wird mit genau denselben Hilfen und demselben Auto nachgefahren.

import { Rennen } from './rennen.js';
import { Etappe } from './rallye.js';
import { LACKE } from './supercars.js';
import { linieFuer } from './ki.js';
import { werkstattAnwenden } from './werkstatt.js';

// Höchsttempo der kleinen Autos in Metern pro Sekunde. 1,8 m/s sehen beim Maßstab 1:30 aus wie knapp 200 km/h.
// (Ferngesteuertes Auto: Das ist das Tempo auf der Geraden – in den Kurven bestimmt die Haftung, wie schnell es geht.)
// Drift-Rallye (Maßstab 1:43): 1,2 m/s sehen aus wie gut 180 km/h – langsam genug, um das Auto quer zu halten.
export const TEMPO = { modell: { langsam: 1.2, mittel: 1.8, schnell: 2.4 }, slot: { langsam: 2.6, mittel: 3.5, schnell: 4.5 }, drift: { langsam: 0.7, mittel: 0.9, schnell: 1.15 } };
// Wie viel Verkehr: Zahl für verkehr.js (0 = keiner)
export const VERKEHR = { aus: 0, wenig: 0.5, normal: 1, viel: 1.6 };

// E = die Einstellungen aus dem Menü, T = die Strecke, rallyeNr = Nummer der Prüfung in der ganzen Rallye (0 = einzelne Prüfung)
export function baueRennen(E, T, rallyeNr = 0) {
  const rallye = E.fahrzeug === 'rallye', slot = E.fahrzeug === 'slot', sup = E.fahrzeug === 'super', drift = E.fahrzeug === 'drift';
  const modell = E.fahrzeug === 'modell' || slot || drift;
  const rennen = rallye ? new Etappe(T, { auto: E.rallyeauto, lack: LACKE[E.lack_rallye] ? LACKE[E.lack_rallye].farbe : null, staerke: E.staerke, nr: rallyeNr, sport: E.arcade === false })
    : new Rennen(T, { modus: E.modus, runden: Math.min(T.def.rundenMax || 99, sup ? E.runden_super : E.runden), gegner: sup ? E.gegner_super : modell ? Math.min(3, E.gegner) : E.gegner, staerke: E.staerke, art: E.fahrzeug, spielerFarbe: E.farbe, tempo: modell ? TEMPO[E.fahrzeug][E.tempo] || 0 : 0, boxen: modell && !drift && E.boxen,
      auto: E.supercar, lack: sup && LACKE[E.lack] ? LACKE[E.lack].farbe : null, verkehr: sup ? VERKEHR[E.verkehr] ?? 1 : 0 });
  // Fahrgefühl „echter“: eigener, vorsichtigerer Tempo-Plan für dich (Bremszonen, Kurven-Gang, Bremshilfe)
  if (rennen.L && !modell && !rallye && !rennen.ich.a.p.echtHilfe) rennen.LS = linieFuer(T, rennen.L, rennen.ich.a.p, E.arcade === false);
  // … und die Computerfahrer fahren dann nach demselben Plan (mal ihrer Stärke). Sie behalten ihre Arcade-Hilfe und bleiben
  // sauber auf der Bahn – aber sie sind nicht mehr schneller, als dein Auto im Fahrgefühl „echter“ überhaupt kann.
  if (rennen.LS && rennen.LS !== rennen.L) rennen.LG = rennen.LS;
  rennen.hilfe.bremsen = E.bremshilfe && !slot; rennen.hilfe.lenken = E.lenkhilfe && !slot;
  if (rennen.ich) { rennen.ich.a.tc = E.traktion ? true : false; rennen.ich.a.arcade = E.arcade !== false; }
  // Fahrgefühl „Neu“: das schlichte Fahrmodell ohne ziehende Hilfen (nur Autos, die Werte dafür haben: die Rallyeautos).
  // Für alle anderen Autos zählt „Neu“ wie Arcade.
  if (rennen.ich && E.arcade === 'neu' && rennen.ich.a.p.schlicht) { rennen.ich.a.arcade = false; rennen.ich.a.schlicht = true; }
  // Rallye: „echter“ heißt hier nicht „ganz ohne Hilfe“ (dann rutscht das Auto auf Schotter nur noch), sondern „weniger Hilfe“:
  // Das Auto bekommt die Arcade-Hilfe mit den Werten aus echtHilfe darüber.
  if (rennen.ich && E.arcade === false && rennen.ich.a.p.echtHilfe) {
    const a = rennen.ich.a;
    a.p = { ...a.p, arcade: { ...a.p.arcade, ...a.p.echtHilfe } }; a.arcade = true; a.sport = true;
  }
  // Werkstatt: Hat man für dieses Fahrzeug und Fahrgefühl Regler verstellt (E.werkstatt), bekommt dein Auto diese Werte.
  // Ohne verstellte Regler ändert das nichts (siehe js/werkstatt.js).
  werkstattAnwenden(rennen, E, T);
  return rennen;
}
