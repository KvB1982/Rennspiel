// Hilfe zum Ansehen: SVG-Datei als PNG speichern (node tools/svgpng.cjs ein.svg aus.png)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1700, height: 440 } }); await p.setContent('<html><body style="margin:0">' + fs.readFileSync(process.argv[2], 'utf8') + '</body></html>'); await p.screenshot({ path: process.argv[3] }); await b.close(); })();
