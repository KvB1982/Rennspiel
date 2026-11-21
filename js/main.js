// Rennspiel – Start: Menü, Spiel-Schleife, Anzeige.
// Ist die Adresse ".../?lenkrad=CODE", wird dieses Gerät zum Lenkrad (lenkradseite.js) und lädt gar kein 3D.

const param = new URLSearchParams(location.search);
if (param.get('lenkrad')) {
  const { lenkradStarten } = await import('./lenkradseite.js');
  lenkradStarten(param.get('lenkrad'), param.has('lokal'));
} else {
  const { starteSpiel } = await import('./spiel.js');
  starteSpiel();
}
