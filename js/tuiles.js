// File: js/tuiles.js
// Desc: Détail au zoom : niveaux NASA GIBS (jour Blue Marble 500 m, nuit VIIRS City Lights) puis Sentinel-2 cloudless (10 m, jour).
// Version 2.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Seul asynchrone avec le chargement initial : les tuiles arrivent quand elles arrivent, la Terre de base reste
   dessous. Sans Internet, rien ne change. Fenêtre autour du point visé seulement : le niveau fin n'existe que là.
   Au-delà de la résolution de GIBS (≈ 500 m/pixel, niveau 7), on continue avec Sentinel-2 cloudless d'EOX
   (≈ 10 m/pixel au niveau 13), de jour : de nuit les lumières des villes GIBS restent. */
const GIBS = {
  url:'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/',
  jour:'BlueMarble_NextGeneration/default/500m/',
  nuit:'VIIRS_CityLights_2012/default/500m/',
  zMin:3, zMax:7,
  niveaux:4,        // niveaux superposés sous le niveau cible
  rayon:2,          // fenêtre = ± rayon tuiles autour du point visé
  nouvelles:10,     // tuiles créées au plus par mise à jour
  cache:220,        // carreaux gardés avant éviction
  periode:300       // ms entre deux mises à jour
};
// Sentinel-2 cloudless 2024 (CC BY-NC-SA 4.0, mention obligatoire : voir le crédit dans le panneau)
const EOX = {
  url:'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024/default/WGS84/',
  zMin:8, zMax:14, niveaux:3
};
const TUILES = {map:new Map(), erreurs:0, derniere:0, zg:0, ze:0};
const _tp2 = new THREE.Vector3(), _tl = new THREE.Vector3(), _td = new THREE.Vector3(), _tu = new THREE.Vector3(), _t0 = new THREE.Vector3(), _tq = new THREE.Quaternion();

function creerTuiles(){
  TUILES.chargeur = new THREE.TextureLoader();
  TUILES.chargeur.setCrossOrigin('anonymous');
  TUILES.groupe = new THREE.Group();
  TERRE.globe.add(TUILES.groupe);                  // enfant du globe : tourne avec lui
}

// Niveau d'une source dont le pixel est au moins aussi fin que le pixel d'écran (degrés/pixel demandés).
const niveauPour = (src, degPx) => Math.ceil(Math.log2(SOURCES[src].span(0)/SOURCES[src].px/degPx));

function tuilesVoulues(src, zDe, zA, lon, lat, horizon, voulues){
  for(let z=zDe; z<=zA; z++){
    const s = SOURCES[src].span(z), n = Math.min(GIBS.rayon, Math.ceil(horizon/s));
    const rows = Math.ceil(180/s);
    for(let dr=-n; dr<=n; dr++) for(let dc=-n; dc<=n; dc++){
      const la = lat - dr*s;
      if(la >= 90 || la <= -90) continue;
      const lo = ((lon + dc*s + 540) % 360) - 180;
      const row = Math.floor((90-la)/s), col = Math.floor((lo+180)/s);
      if(row < 0 || row >= rows) continue;
      voulues.set(src+'/'+z+'/'+row+'/'+col, {src, z, row, col});
    }
  }
}

function chargerCarreau(t){
  t.tex = {};
  const urls = t.src === 'gibs'
    ? {jour:GIBS.url + GIBS.jour + t.z + '/' + t.row + '/' + t.col + '.jpeg', nuit:GIBS.url + GIBS.nuit + t.z + '/' + t.row + '/' + t.col + '.jpeg'}
    : {jour:EOX.url + t.z + '/' + t.row + '/' + t.col + '.jpg'};
  const attendues = Object.keys(urls).length;
  for(const k in urls){
    TUILES.chargeur.load(urls[k],
      tex => {
        if(t.mort){ tex.dispose(); return; }
        tex.anisotropy = 4; t.tex[k] = tex;
        if(Object.keys(t.tex).length === attendues){
          t.mesh = carreauMesh(t.src, t.z, t.row, t.col, t.tex.jour, t.tex.nuit || t.tex.jour);
          TUILES.groupe.add(t.mesh);
        }
      },
      undefined,
      () => { TUILES.erreurs++; });
  }
}

function retirerCarreau(t){
  t.mort = true;
  if(t.mesh){ TUILES.groupe.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); }
  for(const k in t.tex) t.tex[k].dispose();
}

function majTuiles(){
  const cam = ETAT.vue === 'iss' ? camIss : camExt;
  cam.getWorldPosition(_tp2);
  const dist = _tp2.length();
  let h = dist - CFG.R;
  // point visé : intersection du rayon de visée avec la Terre (viser le sol et zoomer donne le détail là où on regarde).
  // Si le centre de l'image regarde le ciel (ex. horizon en bas du cadre, comme sur les photos depuis l'ISS), on descend
  // le rayon dans l'image jusqu'à toucher la Terre : le détail se charge sur le sol visible, pas sous l'ISS, loin du cadre.
  // Sinon (que du ciel), point sous la caméra.
  cam.getWorldDirection(_t0);
  _tu.set(0, 1, 0).applyQuaternion(cam.getWorldQuaternion(_tq));       // « haut » de l'image (⟂ à l'axe)
  const touche = () => { const b = _tp2.dot(_td), disc = b*b - (dist*dist - CFG.R*CFG.R); return disc > 0 && -b - Math.sqrt(disc) > 0 ? -b - Math.sqrt(disc) : 0; };
  _td.copy(_t0);
  let s = touche();
  const pas = cam.fov*DEG/20;                                           // 1/20 de la hauteur du champ
  for(let k=1;k<=30 && !s;k++){ _td.copy(_t0).multiplyScalar(Math.cos(k*pas)).addScaledVector(_tu, -Math.sin(k*pas)); s = touche(); }
  if(s){
    _tl.copy(_tp2).addScaledVector(_td, s);
    h = s;                                                              // distance de la caméra au sol visé
  }else _tl.copy(_tp2);
  TERRE.globe.worldToLocal(_tl);                                         // repère du globe
  const lat = Math.asin(_tl.y/_tl.length())/DEG;
  let ph = Math.atan2(_tl.z, -_tl.x); if(ph < 0) ph += 2*Math.PI;
  const lon = ph/DEG - 180;
  const horizon = Math.acos(CFG.R/dist)/DEG;

  // résolution demandée : un pixel d'écran, à la distance du sol visé, en degrés
  const degPx = h*2*Math.tan(cam.fov*DEG/2)/innerHeight / (2*Math.PI*CFG.R/360);
  const lent = ETAT.pause || ETAT.vitesse <= 10;
  const zgMax = lent ? GIBS.zMax : (ETAT.vitesse <= 60 ? GIBS.zMax-1 : GIBS.zMax-2);
  const zg = Math.min(zgMax, niveauPour('gibs', degPx));
  const ze = lent ? Math.min(EOX.zMax, niveauPour('eox', degPx)) : 0;    // Sentinel-2 seulement quand le temps va lentement
  TUILES.zg = zg; TUILES.ze = ze >= EOX.zMin ? ze : 0;

  const voulues = new Map();
  // avec Sentinel-2, deux niveaux GIBS suffisent dessous (fond et lumières de nuit) : les tuiles fines arrivent plus vite
  const nG = TUILES.ze ? 2 : GIBS.niveaux;
  if(zg >= GIBS.zMin) tuilesVoulues('gibs', Math.max(GIBS.zMin, zg - nG + 1), zg, lon, lat, horizon, voulues);
  if(TUILES.ze) tuilesVoulues('eox', Math.max(EOX.zMin, ze - EOX.niveaux + 1), ze, lon, lat, horizon, voulues);

  let nouvelles = 0;
  for(const [cle, v] of voulues){
    if(TUILES.map.has(cle)) continue;
    if(nouvelles++ >= GIBS.nouvelles) break;
    const t = {...v, mort:false, tex:{}, mesh:null};
    TUILES.map.set(cle, t); chargerCarreau(t);
  }
  // éviction : les plus anciens parmi ceux qu'on ne demande plus
  if(TUILES.map.size > GIBS.cache){
    for(const [cle, t] of TUILES.map){
      if(TUILES.map.size <= GIBS.cache) break;
      if(!voulues.has(cle)){ retirerCarreau(t); TUILES.map.delete(cle); }
    }
  }
}
