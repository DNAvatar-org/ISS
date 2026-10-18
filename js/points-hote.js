// File: js/points-hote.js
// Desc: Points posés sur la Terre par la page hôte (message iss:points) — ex. les créatures de DNA Tamagoshi
//       (site/creatures/tamagoshi, « recherche partenaire ») : un disque de couleur par point, de taille fixe à l'écran,
//       enfant du globe (il tourne avec lui), caché par la Terre de l'autre côté ; son texte au survol ; survol et clic
//       renvoyés à la page hôte (iss:pointSurvol, iss:pointClic) qui peut montrer davantage ; un anneau autour des points
//       d'un groupe, à distance, s'il le demande ; une image à la place du disque, s'il la donne.
// Version 1.4.0
// - v1.4.0: points au ras du sol affiché (R + 2,8 km au lieu de R × 1,003 = 19 km) : plus de parallaxe de près.
// - v1.3.0: image facultative par groupe (à la place du disque, teintée par la couleur de chaque point), dessinée comme
//           les anneaux : sans test de profondeur, seulement du côté visible.
// - v1.2.0: anneau facultatif par groupe (à distance du point : un vide entre les deux).
// - v1.1.0: id des points ; survol et clic renvoyés à la page hôte ; texte facultatif.
// Date: [October 19, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Message { type: 'iss:points', groupes: [{ taille, anneau, image, points: [{ id, lat, lon, couleur, texte }] }] } — remplace
   les précédents. taille : diamètre en px CSS ; anneau (facultatif) : true (couleur de chaque point) ou '#rrggbb' — un
   cercle autour de chaque point du groupe, de diamètre ANNEAU × taille, séparé du point par un vide ; image (facultative) :
   URL (data: comprise) d'une image dessinée à la place du disque, multipliée par la couleur de chaque point (une image
   grise ou blanche prend la couleur du point) ;
   couleur : '#rrggbb' ; lat / lon en degrés ; texte (facultatif) : montré au survol
   (#pointsInfo) ; id (facultatif) : renvoyé à la page hôte —
     { type: 'iss:pointSurvol', id, x, y } quand le point survolé change (id null : aucun ; x, y : pointeur en px CSS de
       cette page, dont l'iframe occupe l'écran de l'hôte),
     { type: 'iss:pointClic', id, lat, lon, x, y } au clic bref (sans glisser : glisser fait tourner la Terre).
   Un THREE.Points par groupe (une taille par groupe), posé juste au-dessus du sol (R × 1,003). Survol : le point visible
   le plus proche du pointeur, à moins de sa taille, dans la caméra qui dessine (ISS ou vue extérieure). */
/** Rayon des points : au ras du sol affiché — juste au-dessus de la plus fine couche de tuiles (tuiles-rendu.js : R +
    0,025 au niveau 14, 2,5 km). À R × 1,003 (19 km), de près ils flottaient et glissaient sur le sol (parallaxe). */
const SOL_POINTS = CFG.R + 0.028;
const PTS_HOTE = {objets:[], liste:[], info:null, disque:null, cercle:null, images:{}};
/** Diamètre de l'anneau, en tailles de point */
const ANNEAU = 2.4;

/* Cercle blanc (texture des anneaux) : trait près du bord, centre vide — le vide sépare l'anneau du point. */
function cerclePointsHote(){
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(32, 32, 27, 0, 2*Math.PI);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

/* Disque blanc doux (texture des points) : les points sont des carrés sinon. */
function disquePointsHote(){
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, '#fff'); d.addColorStop(0.7, '#fff'); d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* Texture d'une image de groupe, chargée une fois par URL (gardée : la page hôte renvoie les mêmes à chaque message) */
function imagePointsHote(url){
  if(PTS_HOTE.images[url] === undefined) PTS_HOTE.images[url] = new THREE.TextureLoader().load(url);
  return PTS_HOTE.images[url];
}

function poserPointsHote(groupes){
  PTS_HOTE.objets.forEach(o => { TERRE.globe.remove(o); o.geometry.dispose(); o.material.dispose(); });   // anneaux compris (textures gardées)
  PTS_HOTE.objets = [];
  PTS_HOTE.liste = [];
  if(PTS_HOTE.disque === null) PTS_HOTE.disque = disquePointsHote();
  if(PTS_HOTE.cercle === null) PTS_HOTE.cercle = cerclePointsHote();
  const c = new THREE.Color();
  for(const gr of groupes){
    const n = gr.points.length, pos = new Float32Array(3*n), coul = new Float32Array(3*n), v = new THREE.Vector3();
    gr.points.forEach((p, i) => {
      vecGeo(p.lat, p.lon, SOL_POINTS, v).toArray(pos, 3*i);
      c.set(p.couleur).toArray(coul, 3*i);
      PTS_HOTE.liste.push({v:v.clone(), taille:gr.taille, texte:p.texte, id:p.id, lat:p.lat, lon:p.lon});
    });
    if(gr.image){ poserImages(gr, pos, coul); continue; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(coul, 3));
    const o = new THREE.Points(g, new THREE.PointsMaterial({size:gr.taille*renderer.getPixelRatio(), sizeAttenuation:false,
      vertexColors:true, map:PTS_HOTE.disque, transparent:true, alphaTest:0.3}));
    TERRE.globe.add(o);
    PTS_HOTE.objets.push(o);
    if(gr.anneau) poserAnneaux(gr, pos, coul);
  }
}

/* Images d'un groupe : grandes, le sol bombé les rognait près du bord de la Terre — dessinées comme les anneaux (sans
   test de profondeur, seulement du côté visible), sur les points et sous les anneaux. */
function poserImages(gr, pos, coul){
  const a = pointsFaceVisible(pos, coul, new THREE.PointsMaterial({size:gr.taille*renderer.getPixelRatio(),
    sizeAttenuation:false, vertexColors:true, map:imagePointsHote(gr.image), transparent:true, alphaTest:0.1,
    depthTest:false, depthWrite:false}));
  a.renderOrder = 5;
  TERRE.globe.add(a);
  PTS_HOTE.objets.push(a);
}

/* Anneaux d'un groupe : sprite cercle ANNEAU fois plus grand, sans test de profondeur (le sol bombé entre le point et
   l'œil le rognait), donc à chaque image seulement ceux du côté visible de la Terre (onBeforeRender : copiés en tête,
   setDrawRange). */
const _phC = new THREE.Vector3();
function poserAnneaux(gr, pos, coul){
  const uni = typeof gr.anneau === 'string';
  const a = pointsFaceVisible(pos, coul, new THREE.PointsMaterial({size:gr.taille*ANNEAU*renderer.getPixelRatio(),
    sizeAttenuation:false, vertexColors:!uni, color:uni ? gr.anneau : 0xffffff, map:PTS_HOTE.cercle, transparent:true,
    alphaTest:0.3, depthTest:false, depthWrite:false}));
  a.renderOrder = 10;
  TERRE.globe.add(a);
  PTS_HOTE.objets.push(a);
}
/* THREE.Points des positions pos (couleurs coul) dont, à chaque image, seuls ceux du côté visible de la Terre sont dessinés
   (copiés en tête, setDrawRange) : pour un matériau sans test de profondeur. */
function pointsFaceVisible(pos, coul, mat){
  const n = pos.length/3;
  const g = new THREE.BufferGeometry(), vp = new Float32Array(pos.length), vc = new Float32Array(coul.length);
  g.setAttribute('position', new THREE.BufferAttribute(vp, 3));
  g.setAttribute('color', new THREE.BufferAttribute(vc, 3));
  const a = new THREE.Points(g, mat);
  a.frustumCulled = false;
  a.onBeforeRender = (r, sc, cam) => {
    cam.getWorldPosition(_phC);
    TERRE.globe.worldToLocal(_phC);
    let k = 0;
    for(let i = 0; i < n; i++){
      const x = pos[3*i], y = pos[3*i + 1], z = pos[3*i + 2];
      if((_phC.x - x)*x + (_phC.y - y)*y + (_phC.z - z)*z <= 0) continue;   // de l'autre côté de la Terre
      vp[3*k] = x; vp[3*k + 1] = y; vp[3*k + 2] = z;
      vc[3*k] = coul[3*i]; vc[3*k + 1] = coul[3*i + 1]; vc[3*k + 2] = coul[3*i + 2];
      k++;
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.setDrawRange(0, k);
  };
  return a;
}

/* Survol : projection de chaque point (repère du globe → monde → écran) ; caché si la Terre est entre lui et la caméra
   (normale au sol tournée à l'opposé de l'œil). */
const _phW = new THREE.Vector3(), _phO = new THREE.Vector3();
/** Point visible le plus proche du pointeur (à moins de sa taille), ou null */
function pointSousPointeur(e){
  const cam = ETAT.vue === 'iss' ? camIss : camExt, r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  cam.getWorldPosition(_phO);
  let best = null, dBest = Infinity;
  for(const p of PTS_HOTE.liste){
    TERRE.globe.localToWorld(_phW.copy(p.v));
    const n = _phW.clone().normalize();
    if(n.dot(_phO.clone().sub(_phW)) <= 0) continue;                       // de l'autre côté de la Terre
    _phW.project(cam);
    if(_phW.z < -1 || _phW.z > 1) continue;
    const d = Math.hypot((_phW.x + 1)/2*r.width - x, (1 - _phW.y)/2*r.height - y);
    if(d < Math.max(p.taille, 6) && d < dBest){ dBest = d; best = p; }
  }
  return best;
}
PTS_HOTE.survol = null;
function survolerPointsHote(e){
  if(PTS_HOTE.liste.length === 0) return;
  const best = pointSousPointeur(e);
  if(best !== PTS_HOTE.survol || (best !== null && best.id !== undefined))     // changé, ou l'hôte suit le pointeur
    parent.postMessage({type:'iss:pointSurvol', id:best === null ? null : best.id, x:e.clientX, y:e.clientY}, '*');
  PTS_HOTE.survol = best;
  const info = PTS_HOTE.info;
  info.hidden = best === null || !best.texte;
  if(info.hidden) return;
  info.textContent = best.texte;
  info.style.left = (e.clientX + 14) + 'px';
  info.style.top = (e.clientY + 14) + 'px';
}

/* Étiquette de survol : créée ici (pas dans index.html) pour que ce fichier se suffise ; style minimal en ligne. */
PTS_HOTE.info = document.createElement('div');
PTS_HOTE.info.id = 'pointsInfo';
PTS_HOTE.info.hidden = true;
PTS_HOTE.info.style.cssText = 'position:fixed;z-index:5;pointer-events:none;padding:4px 8px;border-radius:6px;' +
  'background:rgba(0,0,0,0.7);color:#fff;font:12px system-ui,sans-serif;white-space:pre';
document.body.appendChild(PTS_HOTE.info);
canvas.addEventListener('pointermove', survolerPointsHote);
canvas.addEventListener('pointerleave', () => {
  PTS_HOTE.info.hidden = true;
  if(PTS_HOTE.survol !== null) parent.postMessage({type:'iss:pointSurvol', id:null, x:0, y:0}, '*');
  PTS_HOTE.survol = null;
});
/* Clic bref : appui et relâché à moins de 5 px l'un de l'autre (au-delà, on faisait tourner la Terre) */
let _phAppui = null;
canvas.addEventListener('pointerdown', e => { _phAppui = {x:e.clientX, y:e.clientY}; });
canvas.addEventListener('pointerup', e => {
  if(_phAppui === null || PTS_HOTE.liste.length === 0) return;
  const bref = Math.hypot(e.clientX - _phAppui.x, e.clientY - _phAppui.y) < 5;
  _phAppui = null;
  if(!bref) return;
  const p = pointSousPointeur(e);
  if(p !== null && p.id !== undefined) parent.postMessage({type:'iss:pointClic', id:p.id, lat:p.lat, lon:p.lon, x:e.clientX, y:e.clientY}, '*');
});

addEventListener('message', e => {
  if(!e.data || e.data.type !== 'iss:points') return;
  poserPointsHote(e.data.groupes);
});
