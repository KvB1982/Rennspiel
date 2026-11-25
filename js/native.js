// Rennspiel – Zusätze für die iPad- und iPhone-App (Capacitor, wie in Frontlinie 3 und Reitturnier).
// Im Browser ist hier alles aus: inApp ist false, nahPlugin() gibt null, ruetteln macht nichts.

const C = window.Capacitor;
export const inApp = !!(C && C.isNativePlatform && C.isNativePlatform());
if (inApp) document.documentElement.classList.add('app');

// Das Plugin "LenkradLink" (ios/App/App/AppDelegate.swift): iPad und iPhone finden sich direkt über WLAN
// oder Bluetooth (Apples Multipeer), ganz ohne Internet.
export const nahPlugin = () => (inApp && C.Plugins && C.Plugins.LenkradLink) || null;

// Das Plugin "Teilen" (auch in AppDelegate.swift): öffnet das Teilen-Fenster von iPad und iPhone mit einer Datei
// (für „Fahrt sichern“: AirDrop, In Dateien sichern, Mail …).
export const teilPlugin = () => (inApp && C.Plugins && C.Plugins.Teilen) || null;

// Kurz rütteln (nur iPhones haben einen Vibrationsmotor, das iPad bleibt still)
let zuletzt = 0;
export function ruetteln(stark = 0.5) {
  const H = inApp && C.Plugins && C.Plugins.Haptics;
  const jetzt = performance.now();
  if (!H || jetzt - zuletzt < 110) return;
  zuletzt = jetzt;
  try { const p = H.impact({ style: stark > 0.7 ? 'HEAVY' : stark > 0.35 ? 'MEDIUM' : 'LIGHT' }); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}

// iPad oder iPhone (auch ein iPad, das sich im Browser als Mac ausgibt)
export const istApfelGeraet = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
