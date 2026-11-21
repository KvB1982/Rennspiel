// Rennspiel – Bühne: Zeichner (Renderer), Himmel, Sonne, Schatten, Autos im Bild.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { baueWelt, gummiAuftragen, linieZeigen, stimmung } from './streckebau.js';
import { baueAuto, autoStellen } from './autobau.js';
import { MASSSTAB } from './strecke.js';
import { baueSupercar } from './supercarbau.js';
import { AUTOS } from './physik.js';
import { VerkehrBild } from './verkehrbau.js';

export class Buehne {
  constructor(canvas, qualitaet = 'hoch') {
    this.qualitaet = qualitaet;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: qualitaet !== 'niedrig', powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualitaet === 'hoch' ? 2 : qualitaet === 'mittel' ? 1.5 : 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = qualitaet !== 'niedrig';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.kamera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 9000);
    this.szene = null;
    this.autos = [];
  }

  groesse(w, h) {
    this.renderer.setSize(w, h, false);
    this.kamera.aspect = w / h; this.kamera.updateProjectionMatrix();
  }

  // Strecke T laden und Autos (Liste aus dem Rennen) hinstellen
  // verkehr = der Verkehr aus dem Rennen (Supercar-Strecken), sonst null
  laden(T, autos, L, { linie = false, verkehr = null } = {}) {
    if (this.szene) this.aufraeumen();
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
      s.add(himmel);
      // Spiegelungen im Lack kommen vom Himmel
      const hs = new THREE.Scene(); const h2 = new Sky(); h2.scale.setScalar(1000); h2.material = himmel.material; hs.add(h2);
      this.umgebung = pmrem.fromScene(hs, 0, 0.1, 2000).texture;
      s.environment = this.umgebung;
      s.fog = new THREE.Fog(st.nebel, 400, st.nebelWeit);
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
    const hemi = new THREE.HemisphereLight(modell ? 0xfff4e6 : 0xcfe3ff, modell ? 0x6a5040 : 0x4a5a3a, modell ? 0.9 : 0.55 * st.himmel);
    s.add(hemi);
    const licht = this.licht = new THREE.DirectionalLight(def.welt.zeit === 'abend' ? 0xffb27a : 0xfff3e0, st.licht);
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
    this.welt = baueWelt(T, s, { qualitaet: this.qualitaet });
    if (T.strasse) {
      // Straßen-Strecken sind riesig: weiter sehen, die Berge am Horizont nur leicht im Dunst
      const weit = Math.max(9000, (this.welt.weit || 6000) + 2500);
      s.fog = new THREE.Fog(st.nebel, 900, weit * 0.95);
      this.kamera.far = weit; this.kamera.updateProjectionMatrix();
    }
    this.verkehrBild = verkehr ? new VerkehrBild(s, verkehr, { abend: def.welt.zeit === 'abend', kamera: this.kamera }) : null;
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
      const m = sup ? baueSupercar(c.a.art, { farbe: c.farbe }) : baueAuto({ farbe: c.farbe, zweit: c.zweit, num: c.nummer, massstab: modell ? MASSSTAB : 1 });
      if (m.auge) c.a.auge = m.auge;   // für die Cockpit-Kamera
      if (m.scheinwerfer) m.scheinwerfer.emissiveIntensity = def.welt.zeit === 'abend' ? 3 : 1.2;
      s.add(m.gruppe);
      return { c, m };
    });
    // Geist (durchsichtiges Auto der Bestrunde)
    const ichC = autos.find(c => c.ich);
    const g = this.geist = ichC && AUTOS[ichC.a.art] && AUTOS[ichC.a.art].super ? baueSupercar(ichC.a.art, { farbe: 0x9fe8ff })
      : baueAuto({ farbe: 0x9fe8ff, zweit: 0xffffff, num: 0, massstab: modell ? MASSSTAB : 1 });
    g.gruppe.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.32; o.material.depthWrite = false; o.castShadow = false; } });
    g.gruppe.visible = false;
    s.add(g.gruppe);
    this.uhr = 0;
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
      if (m.sicht) m.sicht(imAuto);                    // fertiges Modell von außen, selbst gebautes Auto im Cockpit           // Supercar: Armaturenbrett und Lenkrad nur von innen
    }
    if (this.verkehrBild) this.verkehrBild.update();
    // Himmel wandert mit der Kamera mit (die Straßen-Strecken sind größer als der Himmel)
    if (this.himmel && this.T.strasse) this.himmel.position.copy(this.kamera.position);
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

  aufraeumen() {
    this.szene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of [].concat(o.material)) m.dispose();
    });
    if (this.umgebung) this.umgebung.dispose();
    this.szene = null;
  }
}
