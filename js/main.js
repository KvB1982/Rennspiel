// Rennspiel – Start: Menü, Spiel-Schleife, Anzeige.
// Ist die Adresse ".../?lenkrad=CODE", wird dieses Gerät zum Lenkrad (lenkradseite.js) und lädt gar kein 3D.
// In der App: "?nahlenkrad" (oder das iPhone war beim letzten Mal schon das Lenkrad) = Lenkrad für ein iPad in der Nähe.

import { inApp } from './native.js';

const param = new URLSearchParams(location.search);
let rolle = null;
try { rolle = localStorage.getItem('rennspiel.rolle'); } catch (e) {}
if (param.get('lenkrad')) {
  const { lenkradStarten } = await import('./lenkradseite.js');
  lenkradStarten(param.get('lenkrad'), param.has('lokal'));
} else if (inApp && (param.has('nahlenkrad') || rolle === 'lenkrad')) {
  const { lenkradStarten } = await import('./lenkradseite.js');
  lenkradStarten('', false, true);
} else {
  const { starteSpiel } = await import('./spiel.js');
  starteSpiel();
}
