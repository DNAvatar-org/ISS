// File: js/points-hote.js
// Desc: Points posés sur la Terre par la page hôte (message iss:points) — ex. les créatures de DNA Tamagoshi
//       (site/creatures/tamagoshi, « recherche partenaire ») : un disque de couleur par point, de taille fixe à l'écran,
//       enfant du globe (il tourne avec lui), caché par la Terre de l'autre côté ; son texte au survol ; survol et clic
//       renvoyés à la page hôte (iss:pointSurvol, iss:pointClic) qui peut montrer davantage ; un anneau autour des points
//       d'un groupe, à distance, s'il le demande ; une image à la place du disque, s'il la donne.
// Version 1.9.1
// - v1.9.1: carton neuf né à taille nulle, matrice refaite après sa taille (plus de flash géant d'une image).
// - v1.9.0: zoomMin / zoomMax par groupe (px d'écran par km de sol au point) : dessiné et survolable seulement dans cette plage.
// - v1.8.0: cartons orientés selon la verticale du lieu (pieds vers le centre de la Terre).
// - v1.7.0: plus de contour blanc ; cartons sans test de profondeur (le sol en cachait la moitié), cachés de l'autre côté de la Terre.
// - v1.6.0: (contour blanc des pyramides, retiré en 1.7.0)
// - v1.5.0: points en petites pyramides à base carrée posées sur le sol (plus de disques enfoncés) ; groupes
//           « carton » : l'image de chaque point debout sur le sol, face à la caméra (à la Doom).
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
   (#pointsInfo) ; id (facultatif) : renvoyé à la page hôte ; carton (groupe, facultatif) : chaque point porte son image
   (image : URL), dessinée sur un carton debout face à la caméra (taille : sa hauteur en px) ; zoomMin / zoomMax (groupe,
   facultatifs) : le groupe n'est dessiné (et survolable) qu'à une échelle, au point, d'au moins zoomMin et de moins de
   zoomMax pixels d'écran par km de sol — ex. des cartons de près, des pyramides de loin —
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
  PTS_HOTE.objets.forEach(o => {                    // anneaux compris (textures et géométries partagées gardées)
    TERRE.globe.remove(o);
    if(o.geometry !== PTS_HOTE.pyramide && !o.isSprite) o.geometry.dispose();
    o.material.dispose();
    if(o.dispose) o.dispose();
  });
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
      PTS_HOTE.liste.push({v:v.clone(), taille:gr.taille, texte:p.texte, id:p.id, lat:p.lat, lon:p.lon, gr:gr});
    });
    if(gr.carton){ poserCartons(gr); continue; }
    if(gr.image){ poserImages(gr, pos, coul); continue; }
    poserPyramides(gr, pos, coul);
    if(gr.anneau) poserAnneaux(gr, pos, coul);
  }
}

/* Taille à l'écran : unités de la scène par pixel à la distance d de la caméra qui dessine */
function unitesParPixel(cam, d){ return 2*d*Math.tan(cam.fov*DEG/2)/canvas.clientHeight; }
/** km de sol par unité de la scène (CFG.R : le rayon de la Terre, 6 371 km) */
const KM_PAR_UNITE = 6371/CFG.R;
/** Le groupe gr est-il à dessiner à la distance d de la caméra cam (zoomMin / zoomMax : px d'écran par km au point) ? */
function dansZoom(gr, cam, d){
  if(gr.zoomMin === undefined && gr.zoomMax === undefined) return true;
  const z = 1/(unitesParPixel(cam, d)*KM_PAR_UNITE);
  return (gr.zoomMin === undefined || z >= gr.zoomMin) && (gr.zoomMax === undefined || z < gr.zoomMax);
}
const _pyQ = new THREE.Quaternion(), _pyS = new THREE.Vector3(), _pyM = new THREE.Matrix4(), _pyP = new THREE.Vector3(),
  _pyW = new THREE.Vector3(), _pyU = new THREE.Vector3(0, 1, 0);

/* Points d'un groupe : de petites pyramides à base carrée posées sur le sol, pointe en l'air (à la place des disques à
   plat, que le sol bombé enfonçait à moitié), de taille constante à l'écran (gr.taille px de haut), couleur de chaque
   point, faces ombrées (une claire, une sombre) — une InstancedMesh, ses matrices refaites à chaque image. */
function geometriePyramide(){
  if(PTS_HOTE.pyramide) return PTS_HOTE.pyramide;
  const s = 0.5, h = 1, A = [-s, 0, -s], Bv = [s, 0, -s], C = [s, 0, s], D = [-s, 0, s], P = [0, h, 0];
  const faces = [[A, Bv, P, 0.62], [Bv, C, P, 1.0], [C, D, P, 0.82], [D, A, P, 0.5], [A, D, C, 0.35], [A, C, Bv, 0.35]];
  const pos = [], col = [];
  for(const [a, b, c, l] of faces){ pos.push(...a, ...b, ...c); for(let k = 0; k < 3; k++) col.push(l, l, l); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return PTS_HOTE.pyramide = g;
}
function poserPyramides(gr, pos, coul){
  const n = pos.length/3, im = new THREE.InstancedMesh(geometriePyramide(), new THREE.MeshBasicMaterial({vertexColors:true}), n);
  const quats = [], c = new THREE.Color();
  for(let i = 0; i < n; i++){
    _pyP.fromArray(pos, 3*i);
    quats.push(new THREE.Quaternion().setFromUnitVectors(_pyU, _pyP.clone().normalize()));   // pointe vers le ciel
    im.setColorAt(i, c.setRGB(coul[3*i], coul[3*i + 1], coul[3*i + 2]));
  }
  im.frustumCulled = false;
  im.onBeforeRender = (r, sc, cam) => {
    cam.getWorldPosition(_pyW);
    for(let i = 0; i < n; i++){
      _pyP.fromArray(pos, 3*i);
      TERRE.globe.localToWorld(_pyS.copy(_pyP));
      const d = _pyS.distanceTo(_pyW), k = dansZoom(gr, cam, d) ? unitesParPixel(cam, d)*gr.taille : 0;   // hors zoom : rien
      _pyM.compose(_pyP, quats[i], _pyS.set(k*0.8, k, k*0.8));
      im.setMatrixAt(i, _pyM);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  TERRE.globe.add(im);
  PTS_HOTE.objets.push(im);
}

/* Cartons d'un groupe (gr.carton) : chaque point porte son image (p.image : la créature en pied, fond transparent),
   debout sur le sol, son pied au point — toujours face à la caméra (à la Doom ; et lisible aussi vu d'en haut, la vue
   Terre regardant le sol à la verticale) ; gr.taille px de haut à l'écran ; caché derrière la Terre (profondeur). */
const _caA = new THREE.Vector3(), _caB = new THREE.Vector3();
function poserCartons(gr){
  for(const p of gr.points){
    const tex = imagePointsHote(p.image);
    // sans test de profondeur : le sol (bombé, tuiles en relief) en cachait la moitié ; caché seulement de l'autre côté
    // de la Terre (onBeforeRender), dessiné par-dessus le sol, pieds sur le point
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, sizeAttenuation:false, alphaTest:0.25, transparent:true,
      depthTest:false, depthWrite:false}));
    sp.center.set(0.5, 0);                          // ancré par le pied
    sp.scale.set(0, 0, 1);                          // né invisible : sa taille vient au premier rendu (onBeforeRender)
    vecGeo(p.lat, p.lon, SOL_POINTS, sp.position);
    sp.renderOrder = 6;
    const pied = sp.position.clone();
    sp.onBeforeRender = (r, sc, cam) => {           // taille constante à l'écran : gr.taille px de haut
      const k = 2*Math.tan(cam.fov*DEG/2)/canvas.clientHeight*gr.taille, img = tex.image;
      sp.scale.set(k*(img && img.width ? img.width/img.height : 1), k, 1);
      cam.getWorldPosition(_phC);
      TERRE.globe.worldToLocal(_phC);
      sp.material.opacity = (_phC.x - pied.x)*pied.x + (_phC.y - pied.y)*pied.y + (_phC.z - pied.z)*pied.z > 0 &&
        dansZoom(gr, cam, _phC.distanceTo(pied)) ? 1 : 0;
      // debout sur le sol : la tête vers le ciel du lieu, les pieds vers le centre de la Terre — la verticale du lieu
      // projetée à l'écran donne l'angle du carton (tourné autour de ses pieds) ; vue d'aplomb, le rayon de la Terre à
      // l'écran la remplace
      const a = TERRE.globe.localToWorld(_caA.copy(pied)).project(cam);
      const b = TERRE.globe.localToWorld(_caB.copy(pied).multiplyScalar(1.001)).project(cam);
      const asp = canvas.clientWidth/canvas.clientHeight;
      let dx = (b.x - a.x)*asp, dy = b.y - a.y;
      if(dx*dx + dy*dy < 1e-10){ const o = TERRE.globe.localToWorld(_caB.set(0, 0, 0)).project(cam); dx = (a.x - o.x)*asp; dy = a.y - o.y; }
      sp.material.rotation = Math.atan2(dy, dx) - Math.PI/2;
      // la matrice du rendu en cours a été calculée avant cette taille : la refaire, sinon un carton neuf se dessine une
      // image à l'échelle 1 (géant) — le flash au survol
      sp.updateMatrixWorld();
    };
    TERRE.globe.add(sp);
    PTS_HOTE.objets.push(sp);
  }
}

/* Images d'un groupe : grandes, le sol bombé les rognait près du bord de la Terre — dessinées comme les anneaux (sans
   test de profondeur, seulement du côté visible), sur les points et sous les anneaux. */
function poserImages(gr, pos, coul){
  const a = pointsFaceVisible(pos, coul, new THREE.PointsMaterial({size:gr.taille*renderer.getPixelRatio(),
    sizeAttenuation:false, vertexColors:true, map:imagePointsHote(gr.image), transparent:true, alphaTest:0.1,
    depthTest:false, depthWrite:false}), gr);
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
    alphaTest:0.3, depthTest:false, depthWrite:false}), gr);
  a.renderOrder = 10;
  TERRE.globe.add(a);
  PTS_HOTE.objets.push(a);
}
/* THREE.Points des positions pos (couleurs coul) dont, à chaque image, seuls ceux du côté visible de la Terre sont dessinés
   (copiés en tête, setDrawRange) : pour un matériau sans test de profondeur. */
function pointsFaceVisible(pos, coul, mat, gr){
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
      if(!dansZoom(gr, cam, Math.hypot(_phC.x - x, _phC.y - y, _phC.z - z))) continue;   // hors de son zoom
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
    if(!dansZoom(p.gr, cam, _phW.distanceTo(_phO))) continue;               // pas dessiné à ce zoom
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
