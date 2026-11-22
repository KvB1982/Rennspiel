// Rennspiel – Bühne: Zeichner (Renderer), Himmel, Sonne, Schatten, Autos im Bild.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { baueWelt, gummiAuftragen, linieZeigen, stimmung, istDunkel } from './streckebau.js';
import { baueAuto, autoStellen } from './autobau.js';
import { baueRallye } from './rallyebau.js';
import { MASSSTAB } from './strecke.js';
import { baueSupercar } from './supercarbau.js';
import { AUTOS } from './physik.js';
import { VerkehrBild } from './verkehrbau.js';
import { baueWpWelt } from './wpbau.js';
import { Spritzer } from './partikel.js';
import { Funken, baueTurboFelder } from './funken.js';

// Sternenhimmel für die Nacht: viele kleine helle Punkte auf einer großen Kugel um die Kamera
function baueSterne() {
  const pos = [], n = 1400; let a = 12345;
  const zufall = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let k = 0; k < n; k++) {
    const hoch = 0.06 + zufall() * 0.94, w = zufall() * Math.PI * 2, rr = Math.sqrt(1 - hoch * hoch);   // nur über dem Horizont
    pos.push(Math.cos(w) * rr * 3000, hoch * 3000, Math.sin(w) * rr * 3000);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
  p.frustumCulled = false;
  return p;
}

export class Buehne {
  constructor(canvas, qualitaet = 'hoch') {
    this.qualitaet = qualitaet;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: qualitaet !== 'niedrig', powerPreference: 'high-performance', preserveDrawingBuffer: false });
    // Bildpunkte pro Bildschirm-Punkt: höchstens so viele, wie der Bildschirm hat
    this.punkteMax = Math.min(window.devicePixelRatio || 1, qualitaet === 'hoch' ? 2 : qualitaet === 'mittel' ? 1.5 : 1);
    this.punkteMin = Math.min(this.punkteMax, qualitaet === 'niedrig' ? 0.6 : 0.75);
    this.punkte = this.punkteMax;
    this.bildZeit = 1 / 60; this.pruefUhr = 0; this.ruhig = 0;
    r.setPixelRatio(this.punkte);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = qualitaet !== 'niedrig';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.kamera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 9000);
    this.szene = null;
    this.autos = [];
  }

  groesse(w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.kamera.aspect = w / h; this.kamera.updateProjectionMatrix();
  }

  // Wie lange dauert ein Bild? Unter etwa 50 Bildern pro Sekunde werden die Bildpunkte weniger
  // (das Bild wird etwas unschärfer, aber flüssig). Läuft es lange ruhig mit 60, gibt es wieder mehr.
  // roh = echte Zeit seit dem letzten Bild in Sekunden
  tempoPruefen(roh) {
    if (!(roh > 0) || roh > 0.25) return;          // Tab war weg oder Strecke wurde gebaut: nicht mitzählen
    this.bildZeit += (roh - this.bildZeit) * 0.05;
    this.pruefUhr += roh;
    if (this.pruefUhr < 1.5) return;
    this.pruefUhr = 0;
    let neu = this.punkte;
    // grenze = so viele Bildpunkte waren schon einmal zu viel: dorthin nicht wieder zurück (sonst ginge es ewig hin und her)
    if (this.bildZeit > 1 / 48 && this.punkte > this.punkteMin) { this.grenze = this.punkte; neu = Math.max(this.punkteMin, this.punkte - 0.25); this.ruhig = 0; }
    else if (this.bildZeit < 1 / 57) {
      const hoch = Math.min(this.punkteMax, this.punkte + 0.25);
      if (++this.ruhig >= 4 && hoch > this.punkte && !(hoch >= this.grenze)) { neu = hoch; this.ruhig = 0; }
    }
    else this.ruhig = 0;
    if (neu !== this.punkte) {
      this.punkte = neu;
      this.renderer.setPixelRatio(neu);
      if (this.w) this.renderer.setSize(this.w, this.h, false);
    }
  }

  // Strecke T laden und Autos (Liste aus dem Rennen) hinstellen
  // verkehr = der Verkehr aus dem Rennen (Supercar-Strecken), sonst null
  laden(T, autos, L, { linie = false, verkehr = null, etappe = null, felder = [] } = {}) {
    if (this.szene) this.aufraeumen();
    this.sterne = null;
    const s = this.szene = new THREE.Scene();
    const def = T.def, st = stimmung(def), modell = !!def.modell;
    this.T = T; this.modell = modell;
    const r = this.renderer;
    r.toneMappingExposure = st.belicht;

    // Sonne: Richtung aus Höhe und Himmelsrichtung
    const phi = THREE.MathUtils.degToRad(90 - st.hoehe), theta = THREE.MathUtils.degToRad(st.richtung);
    const sonne = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    this.sonnenRichtung = sonne;
    const pmrem = new THREE.PMREMGenerator(r);
    if (!modell) {
      const himmel = this.himmel = new Sky(); himmel.scale.setScalar(T.strasse ? 14000 : 8000);
      const u = himmel.material.uniforms;
      u.turbidity.value = st.truebe; u.rayleigh.value = st.rayleigh; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.85;
      u.sunPosition.value.copy(sonne);
      // trüber Tag (Rallye im Nebelwald): grauer Himmel statt Sonne und Blau
      if (st.grau) s.background = new THREE.Color(st.nebel);
      else if (st.nacht) {
        // Nacht: dunkler Himmel mit Sternen. Für die Spiegelungen im Lack steht die Sonne knapp unter dem Horizont (letztes Dämmerlicht).
        s.background = new THREE.Color(st.nebel);
        u.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(91.5), theta);
        this.sterne = baueSterne(); s.add(this.sterne);
      }
      else s.add(himmel);
      // Spiegelungen im Lack kommen vom Himmel
      const hs = new THREE.Scene(); const h2 = new Sky(); h2.scale.setScalar(1000); h2.material = himmel.material; hs.add(h2);
      this.umgebung = pmrem.fromScene(hs, 0, 0.1, 2000).texture;
      s.environment = this.umgebung;
      s.fog = new THREE.Fog(st.nebel, st.nebelNah ?? 400, st.nebelWeit);
      this.kamera.near = 0.1; this.kamera.far = 9000;
    } else {
      s.background = new THREE.Color(0x8a7a6a);
      this.umgebung = pmrem.fromScene(new RoomEnvironment(r), 0.04).texture;
      s.environment = this.umgebung;
      this.kamera.near = 0.01; this.kamera.far = 40;
    }
    this.kamera.updateProjectionMatrix();
    pmrem.dispose();

    // Licht: Sonne (mit Schatten) und Himmelslicht
    const hemi = new THREE.HemisphereLight(modell ? 0xfff4e6 : st.nacht ? 0x8fa6d8 : 0xcfe3ff, modell ? 0x6a5040 : st.nacht ? 0x3a3a48 : 0x4a5a3a, modell ? 0.9 : 0.55 * st.himmel);
    s.add(hemi);
    const licht = this.licht = new THREE.DirectionalLight(def.welt.zeit === 'abend' ? 0xffb27a : st.nacht ? 0xdfe8ff : 0xfff3e0, st.licht);
    licht.castShadow = r.shadowMap.enabled;
    const sm = this.qualitaet === 'hoch' ? 2048 : 1024;
    licht.shadow.mapSize.set(sm, sm);
    const sc = modell ? 6 : 70;
    Object.assign(licht.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, near: modell ? 0.5 : 10, far: modell ? 30 : 600 });
    licht.shadow.bias = -0.0004; licht.shadow.normalBias = modell ? 0.002 : 0.05;
    s.add(licht, licht.target);
    if (modell) {
      // Deckenlampe
      const pl = new THREE.PointLight(0xffe2b8, 8, 14, 1.4); pl.position.set(0, 2.5, 0); s.add(pl); this.decke = pl;
    }

    // Strecke und Landschaft
    // Rallye: eigene Landschaft (Waldweg, Zuschauer, Start und Ziel), dazu Staub und Wasser hinter den Rädern
    this.welt = def.rallye ? baueWpWelt(T, s, { qualitaet: this.qualitaet, etappe }) : baueWelt(T, s, { qualitaet: this.qualitaet });
    this.etappe = etappe;
    this.spritzer = def.rallye ? new Spritzer(s, { staubFarbe: def.welt.wald === 'laub' ? 0x8f7a5c : def.welt.wald === 'berg' ? 0xb0aa9c : 0xcbb894, viel: this.qualitaet === 'hoch' ? 1 : this.qualitaet === 'mittel' ? 0.65 : 0.35 }) : null;
    if (def.rallye) { L = null; s.fog.near = st.nebelNah ?? 150; }
    if (T.strasse) {
      // Straßen-Strecken sind riesig: weiter sehen, die Berge am Horizont nur leicht im Dunst
      const weit = Math.max(9000, (this.welt.weit || 6000) + 2500);
      s.fog = new THREE.Fog(st.nebel, 900, weit * 0.95);
      this.kamera.far = weit; this.kamera.updateProjectionMatrix();
    }
    this.verkehrBild = verkehr ? new VerkehrBild(s, verkehr, { abend: istDunkel(def), kamera: this.kamera }) : null;
    if (L) gummiAuftragen(this.welt, T, L);
    if (L && linie && !modell) linieZeigen(this.welt, T, L);
    if (modell) {
      const g = this.welt.grenzen;
      this.decke.position.set(g.mx, 2.6, g.mz);
      licht.position.set(g.mx + sonne.x * 10, sonne.y * 10, g.mz + sonne.z * 10 - 3);
      licht.target.position.set(g.mx, 0, g.mz);
    }

    // Autos
    this.autos = autos.map(c => {
      const sup = AUTOS[c.a.art] && AUTOS[c.a.art].super;
      const m = sup ? baueSupercar(c.a.art, { farbe: c.farbe }) : c.a.art === 'drift' ? baueRallye({ farbe: c.farbe, zweit: c.zweit, num: c.nummer, massstab: T.sc })
        : baueAuto({ farbe: c.farbe, zweit: c.zweit, num: c.nummer, massstab: T.sc });
      if (m.auge) c.a.auge = m.auge;   // für die Cockpit-Kamera
      if (m.scheinwerfer) m.scheinwerfer.emissiveIntensity = istDunkel(def) ? 3 : 1.2;
      s.add(m.gruppe);
      return { c, m };
    });
    // Geist (durchsichtiges Auto der Bestrunde)
    const ichC = autos.find(c => c.ich);
    const g = this.geist = ichC && AUTOS[ichC.a.art] && AUTOS[ichC.a.art].super ? baueSupercar(ichC.a.art, { farbe: 0x9fe8ff })
      : ichC && ichC.a.art === 'drift' ? baueRallye({ farbe: 0x9fe8ff, zweit: 0xffffff, num: 0, massstab: T.sc })
      : baueAuto({ farbe: 0x9fe8ff, zweit: 0xffffff, num: 0, massstab: T.sc });
    g.gruppe.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.32; o.material.depthWrite = false; o.castShadow = false; } });
    g.gruppe.visible = false;
    s.add(g.gruppe);
    // Drift-Matte: Reifenspuren. Rutscht ein Auto quer, bleiben hinter den Hinterrädern dunkle Striche liegen
    // (bis zu SPUREN Stück, dann werden die ältesten wiederverwendet).
    this.spuren = null;
    if (def.drift) {
      const SPUREN = 3000;
      const geo = new THREE.PlaneGeometry(0.008, 0.012); geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
      const im = new THREE.InstancedMesh(geo, mat, SPUREN);
      im.count = 0; im.frustumCulled = false; s.add(im);
      this.spuren = { im, n: 0, max: SPUREN, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), achse: new THREE.Vector3(0, 1, 0), v: new THREE.Vector3(), eins: new THREE.Vector3(1, 1, 1) };
    }
    // Turbo der kleinen Autos: Funken, Flamme und die leuchtenden Turbo-Felder auf der Bahn
    this.funken = modell && !def.slot ? new Funken(s, T.sc) : null;
    this.turboFelder = baueTurboFelder(s, T, felder);
    this.uhr = 0;
  }

  // Jedes Bild (auch wenn nicht gemalt wird, z. B. beim Vorspulen): Zuschauer, Staub und Wasser weiterrechnen
  schritt(dt, ziel) {
    if (!this.szene) return;
    if (this.welt.update) this.welt.update(dt, ziel, this.etappe);
    if (this.funken && dt > 0) { if (ziel) this.funken.auto(ziel, dt); this.funken.update(dt); }
    if (this.turboFelder) this.turboFelder(dt);
    if (this.spritzer && dt > 0) {
      for (const { c } of this.autos) this.spritzer.auto(c.a, dt);
      this.spritzer.update(dt, this.kamera, this.h || 720, this.licht.intensity / 3 * 1.2 + 0.35);
    }
  }

  // Ein Bild malen. ziel = wohin das Schattenlicht schauen soll (das eigene Auto)
  malen(dt, ziel, geistLage, ampel = 0, ampelGruen = false, ichSicht = null) {
    this.uhr += dt;
    for (const { c, m } of this.autos) {
      autoStellen(m, c.a, this.uhr);
      const imAuto = ichSicht === c;
      m.helm[0].visible = m.helm[1].visible = !imAuto;
      for (const h of m.halo) h.visible = !imAuto;   // der Bügel wäre sonst genau vor den Augen
      if (m.innen) m.innen.visible = imAuto;
      if (m.dachHaut) m.dachHaut.visible = !imAuto;
      if (m.sicht) m.sicht(imAuto);                    // fertiges Modell von außen, selbst gebautes Auto im Cockpit           // Supercar: Armaturenbrett und Lenkrad nur von innen
    }
    if (this.verkehrBild) this.verkehrBild.update();
    if (this.spuren) for (const { c } of this.autos) this.spurSetzen(c.a);

    // Himmel wandert mit der Kamera mit (die Straßen-Strecken sind größer als der Himmel)
    if (this.himmel && this.T.strasse) this.himmel.position.copy(this.kamera.position);
    if (this.sterne && this.szene === this.sterne.parent) this.sterne.position.copy(this.kamera.position);
    // Geist
    if (geistLage) {
      const g = this.geist; g.gruppe.visible = true;
      g.gruppe.position.set(geistLage.x, geistLage.y, geistLage.z); g.gruppe.rotation.set(0, geistLage.h, 0);
    } else this.geist.gruppe.visible = false;
    // Startampel
    this.welt.ampel.forEach((mat, k) => { mat.emissiveIntensity = k < ampel ? 4 : 0; });
    // Wasser bewegt sich
    for (const w of this.welt.wasser) { w.offset.x += dt * 0.004; w.offset.y += dt * 0.0025; }
    // Schatten folgen dem eigenen Auto (bei großen Strecken)
    if (!this.modell && ziel) {
      const l = this.licht, d = this.sonnenRichtung;
      l.target.position.set(ziel.x, ziel.y, ziel.z);
      l.position.set(ziel.x + d.x * 250, ziel.y + d.y * 250, ziel.z + d.z * 250);
    }
    this.renderer.render(this.szene, this.kamera);
  }

  // Reifenspur eines Drift-Autos: zwei Striche hinter den Hinterrädern, wenn es schräg genug rutscht
  spurSetzen(a) {
    const S = this.spuren, au = Math.abs(a.u);
    if (au < 0.15 || Math.abs(Math.atan2(a.v, au)) < 0.2 && !a.handbremse) return;
    const sc = this.T.sc, sh = Math.sin(a.h), ch = Math.cos(a.h);
    // nur alle paar Millimeter einen Strich (sonst sind die Spuren nach ein paar Runden "voll")
    const weg = Math.hypot(a.x - (a.spurX ?? 1e9), a.z - (a.spurZ ?? 1e9));
    if (weg < 0.009) return;
    a.spurX = a.x; a.spurZ = a.z;
    const bewegung = Math.atan2(sh * a.u + ch * a.v, ch * a.u - sh * a.v);   // Richtung, in die das Auto wirklich rutscht
    S.q.setFromAxisAngle(S.achse, bewegung);
    for (const seite of [-1, 1]) {
      const vor = -1.33 * sc, link = seite * 0.78 * sc;
      S.v.set(a.x + sh * vor + ch * link, a.y + 0.0006, a.z + ch * vor - sh * link);
      S.m4.compose(S.v, S.q, S.eins);
      S.im.setMatrixAt(S.n % S.max, S.m4); S.n++;
    }
    S.im.count = Math.min(S.n, S.max); S.im.instanceMatrix.needsUpdate = true;
  }

  aufraeumen() {
    this.szene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of [].concat(o.material)) m.dispose();
    });
    if (this.umgebung) this.umgebung.dispose();
    this.szene = null;
  }
}
