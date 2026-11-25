// Rennspiel – den Spielstand (js/stand.js) prüfen, ohne Browser.
//   node tools/stand.mjs
// Geprüft wird: alter Spielstand wird übernommen, Profile anlegen/wechseln/löschen, Bestzeiten je Profil,
// voller Speicher (der älteste Geist fliegt raus, Bestzeiten bleiben), als Datei sichern und wieder laden.
import { Stand, SCHLUESSEL, PROFILE_MAX } from '../js/stand.js';

// Ein nachgemachter Speicher wie im Browser, mit einer Obergrenze in Zeichen
function speicher(grenze = Infinity) {
  const m = new Map();
  const voll = () => [...m].reduce((s, [k, v]) => s + k.length + v.length, 0);
  return { m, getItem: k => m.has(k) ? m.get(k) : null, removeItem: k => { m.delete(k); }, key: i => [...m.keys()][i], get length() { return m.size; },
    setItem: (k, v) => { v = String(v); const alt = m.get(k); m.set(k, v); if (voll() > grenze) { if (alt === undefined) m.delete(k); else m.set(k, alt); throw new Error('Speicher voll'); } } };
}
let fehler = 0;
const P = (name, gut) => { console.log((gut ? 'OK     ' : 'FEHLER ') + name); if (!gut) fehler++; };

// 1. Alter Spielstand (einzelne Einträge) wird zum ersten Profil
{
  const sp = speicher();
  sp.setItem('rennspiel.einst', JSON.stringify({ fahrzeug: 'super', supercar: 'taurino', grafik: 'mittel' }));
  sp.setItem('rennspiel.best.kueste.f1', '81.5');
  sp.setItem('rennspiel.geist.kueste.f1', JSON.stringify({ zeit: 83, punkte: [[0, 1, 2, 3, 0]] }));
  sp.setItem('rennspiel.geist.landstrasse.super.falkner', JSON.stringify({ zeit: 140, punkte: [] }));   // ganz alter Stand: Zeit nur im Geist
  sp.setItem('rennspiel.best.wohnzimmer.modell.mittel.3', '13.4');
  sp.setItem('rennspiel.drift2.drift_matte.mittel', '12000');
  sp.setItem('rennspiel.ton', 'aus'); sp.setItem('rennspiel.code', 'AB12');
  const s = new Stand(sp);
  P('alter Stand: ein Profil „Fahrer 1“', s.profile.length === 1 && s.aktiv.name === 'Fahrer 1' && s.neuUebernommen);
  P('alter Stand: Einstellungen da', s.einst().supercar === 'taurino');
  P('alter Stand: Bestzeit (die bessere aus Zeit und Geist)', s.best('kueste', 'f1') === 81.5);
  P('alter Stand: Bestzeit nur aus dem Geist', s.best('landstrasse', 'super.falkner') === 140);
  P('alter Stand: Art mit Punkten im Namen', s.best('wohnzimmer', 'modell.mittel.3') === 13.4);
  P('alter Stand: Geist da', s.geist('kueste', 'f1').zeit === 83);
  P('alter Stand: Drift-Rekord', s.drift('drift_matte', 'mittel') === 12000);
  P('alte Einträge aufgeräumt, Ton und Code bleiben', ![...sp.m.keys()].some(k => /^rennspiel\.(best|geist|drift2|einst)/.test(k)) && sp.getItem('rennspiel.ton') === 'aus' && sp.getItem('rennspiel.code') === 'AB12');
  const s2 = new Stand(sp);
  P('zweiter Start: nichts doppelt, alles noch da', !s2.neuUebernommen && s2.best('kueste', 'f1') === 81.5 && s2.geist('kueste', 'f1').zeit === 83);
}

// 2. Profile
{
  const sp = speicher(), s = new Stand(sp);
  P('leerer Start: ein Profil', s.profile.length === 1 && !s.neuUebernommen);
  s.bestSetzen('kueste', 'f1', 90); s.einstMerken({ fahrzeug: 'rallye' });
  const b = s.profilNeu('  Jonas der Schnelle Fahrer  ');
  P('neues Profil ist dran, Name gekürzt, andere Farbe', s.aktiv.id === b.id && b.name === 'Jonas der Schn' && b.farbe !== s.profile[0].farbe);
  P('neues Profil fängt leer an', s.best('kueste', 'f1') === null && Object.keys(s.einst()).length === 0);
  s.bestSetzen('kueste', 'f1', 85); s.geistSetzen('kueste', 'f1', { zeit: 85, punkte: [] });
  P('langsamere Zeit überschreibt nicht', !s.bestSetzen('kueste', 'f1', 86) && s.best('kueste', 'f1') === 85);
  s.wechseln('p1');
  P('zurück gewechselt: eigene Zeit und Einstellungen', s.best('kueste', 'f1') === 90 && s.einst().fahrzeug === 'rallye' && s.geist('kueste', 'f1') === null);
  P('umbenennen', s.umbenennen('p1', 'Papa') && new Stand(sp).profile[0].name === 'Papa');
  P('löschen räumt den Geist weg', s.loeschen(b.id) && s.profile.length === 1 && ![...sp.m.keys()].some(k => k.startsWith('rennspiel.g.' + b.id)));
  P('das letzte Profil bleibt', !s.loeschen('p1'));
  while (s.profilNeu('x')) ;
  P('höchstens ' + PROFILE_MAX + ' Profile', s.profile.length === PROFILE_MAX);
}

// 3. Voller Speicher: der älteste Geist fliegt raus, die Bestzeiten bleiben
{
  const sp = speicher(6000), s = new Stand(sp);
  const dick = n => ({ zeit: n, punkte: 'x'.repeat(1500) });
  let ok = true;
  for (let n = 1; n <= 8; n++) { s.bestSetzen('s' + n, 'f1', 100 - n); ok = s.geistSetzen('s' + n, 'f1', dick(100 - n)) && ok; if (n < 8) { const t = Date.now(); while (Date.now() === t) ; } }
  P('alle acht Geister ließen sich speichern (ältere flogen raus)', ok);
  P('der neueste Geist ist da, der älteste weg', s.geist('s8', 'f1') !== null && s.geist('s1', 'f1') === null);
  P('alle acht Bestzeiten sind noch da', [1, 2, 3, 4, 5, 6, 7, 8].every(n => s.best('s' + n, 'f1') === 100 - n));
  P('ein Geist, der allein nicht passt, macht nichts kaputt', !s.geistSetzen('riesig', 'f1', { zeit: 1, punkte: 'x'.repeat(9000) }) && s.best('s8', 'f1') === 92 && new Stand(sp).best('s3', 'f1') === 97);
}

// 4. Sichern als Datei und Laden auf einem anderen Gerät
{
  const a = new Stand(speicher());
  a.umbenennen('p1', 'Papa'); a.bestSetzen('kueste', 'f1', 80); a.geistSetzen('kueste', 'f1', { zeit: 80, punkte: [1, 2] }); a.driftSetzen('drift_matte', 'mittel', 500);
  a.profilNeu('Jonas'); a.bestSetzen('wp_pass', 'rallye.quadra', 200); a.einstMerken({ fahrzeug: 'rallye' });
  const text = a.paket();
  const spB = speicher(), b = new Stand(spB);
  b.bestSetzen('kueste', 'f1', 70); b.geistSetzen('hafen', 'f1', { zeit: 1, punkte: [] });
  P('Laden klappt', b.einspielen(text));
  P('danach: beide Fahrer, Jonas ist dran', b.profile.map(p => p.name).join() === 'Papa,Jonas' && b.aktiv.name === 'Jonas' && b.best('wp_pass', 'rallye.quadra') === 200 && b.einst().fahrzeug === 'rallye');
  b.wechseln('p1');
  P('danach: Papas Zeit, Geist und Drift-Rekord aus der Datei', b.best('kueste', 'f1') === 80 && b.geist('kueste', 'f1').punkte.length === 2 && b.drift('drift_matte', 'mittel') === 500 && b.geist('hafen', 'f1') === null);
  P('Unsinn wird abgelehnt und ändert nichts', !b.einspielen('{"hallo":1}') && !b.einspielen('kein json') && b.best('kueste', 'f1') === 80);
  spB.setItem(SCHLUESSEL, 'kaputt');
  P('kaputter Eintrag: Spiel startet mit einem frischen Stand', new Stand(spB).profile.length === 1);
}
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles in Ordnung');
process.exit(fehler ? 1 : 0);
