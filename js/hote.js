// File: js/hote.js
// Desc: Page en onglet (?onglet) : la Terre à l'écran — centre et rayon apparent, en px CSS de la page — et l'angle du
//       Soleil à l'écran, envoyés à la page hôte (message 'iss:terre') : elle pose son organigramme autour, son Soleil du
//       côté du vrai, et le suit quand on tourne la caméra (bilan radiatif CO2, onglets_graphe.js). En retour, la place
//       qu'elle demande à gauche de la Terre (iss:marges) : le centre de la Terre se pose là.
// Version 1.7.0
// - v1.7.0: message iss:viser { lat, lon } — la vue extérieure glisse vers un lieu et le suit (jusqu'à un glisser).
// - v1.6.0: message iss:centre { x, y } (fractions de la page) — l'hôte place le centre de la Terre, page en plein écran.
// - v1.5.0: iss:terre porte aussi le Soleil dessiné à l'écran (soleilEcran) et, en vue Terre–Lune, l'orbite de la Lune (orbite).
// - v1.4.1: seule la vue Terre est décalée ; la caméra du satellite reste centrée sur sa visée.
// - v1.4.0: la page hôte donne l'abscisse du centre de la Terre (iss:marges gauche), à gauche du milieu s'il le faut.
// - v1.3.0: iss:terre porte la vue ('ext' / 'iss') : en caméra de l'ISS, l'hôte cache son organigramme.
// - v1.2.0: message iss:cartes — la page hôte change cartes, atmosphère et côté nuit lumineux sans recharger (terre.js poserCartes).
// Date: [October 15, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* xTerre : abscisse du centre de la Terre à l'écran [px] — le milieu de l'image, ou la place que la page hôte demande à
   gauche de la Terre (message iss:marges, url.js) : plus à gauche ou plus à droite que le milieu. */
const HOTE = {cx:NaN, cy:NaN, r:NaN, soleil:NaN, vue:null, xTerre:() => canvas.clientWidth/2, yTerre:() => canvas.clientHeight/2,
              centre:new THREE.Vector3(), oeil:new THREE.Vector3(), sol:new THREE.Vector3()};

/* Vue Terre : centre de la Terre en HOTE.xTerre(), par décalage du cadrage (setViewOffset) ; projections, visées et clics le
   suivent. La caméra du satellite n'est jamais décalée : ses visées (nadir, horizon…) restent au centre de l'image. */
function decalerTerre(){
  const w = canvas.clientWidth, h = canvas.clientHeight, dx = w/2 - HOTE.xTerre(), dy = h/2 - HOTE.yTerre();
  camExt.setViewOffset(w, h, dx, dy, w, h);
}
/* Message générique de la page hôte { type: 'iss:centre', x, y } : le centre de la Terre à l'écran, en fractions de la
   page (0..1) — la page reste en plein écran, la Terre se pose où l'hôte a de la place (ex. DNA Tamagoshi : à droite
   de la créature). Gardé au redimensionnement (fractions). */
addEventListener('message', e => {
  if(!e.data || e.data.type !== 'iss:centre') return;
  HOTE.xTerre = () => e.data.x*canvas.clientWidth;
  HOTE.yTerre = () => e.data.y*canvas.clientHeight;
  decalerTerre();
});

/* Centre : projection de l'origine (la Terre) par la caméra qui dessine. Rayon apparent : demi-angle asin(R/d) sous lequel
   la caméra voit la Terre, rapporté au demi-champ vertical. Soleil : angle à l'écran [rad, y vers le bas] du point de la
   Terre tourné vers lui — projection de R le long de ETAT.S, depuis le centre. soleilEcran : le disque du Soleil tel qu'il
   est dessiné, {x, y} [px], ou null hors de l'image ou caché par la Terre. orbite (vue Terre–Lune) : l'orbite de la Lune à
   l'écran, deux demi-diamètres conjugués [px] depuis le centre — vers la Lune (a) et à 90° dans son plan (b) ; sinon null.
   Envoyé quand l'un d'eux bouge d'un demi-pixel (l'angle d'un centième de radian). */
const _he = new THREE.Vector3(), _hd = new THREE.Vector3(), _hp = new THREE.Vector3(), _hv = new THREE.Vector3();
function ecranDe(v, cam, w, h){ _hp.copy(v).project(cam); return {x:(_hp.x + 1)/2*w, y:(1 - _hp.y)/2*h, z:_hp.z}; }
function soleilAEcran(cam, w, h){
  const p = ecranDe(SOL.groupe.position, cam, w, h);
  if(p.z < -1 || p.z > 1 || p.x < 0 || p.x > w || p.y < 0 || p.y > h) return null;
  cam.getWorldPosition(_he);
  _hd.copy(SOL.groupe.position).sub(_he);
  const l = _hd.length(); _hd.divideScalar(l);
  const t = -_he.dot(_hd);                          // point de la visée le plus proche du centre de la Terre
  if(t > 0 && t < l && _hv.copy(_he).addScaledVector(_hd, t).length() < CFG.R) return null;
  return {x:p.x, y:p.y};
}
function orbiteAEcran(cam, w, h, cx, cy){
  const a = ecranDe(_hv.copy(ETAT.M).multiplyScalar(CFG.LUNE_D), cam, w, h);
  const b = ecranDe(_hv.crossVectors(ETAT.Mnord, ETAT.M).normalize().multiplyScalar(CFG.LUNE_D), cam, w, h);
  return {ax:a.x - cx, ay:a.y - cy, bx:b.x - cx, by:b.y - cy};
}
/* Message générique de la page hôte { type: 'iss:viser', lat, lon } : la vue extérieure glisse vers ce lieu et le garde
   face à la caméra pendant que la Terre tourne — jusqu'à ce que l'utilisateur la fasse tourner (glisser : VUE_EXT changé
   ailleurs que par ce suivi). */
const VISEE_HOTE = {lat:NaN, lon:NaN, th:NaN, ph:NaN, actif:false};
const _vh = new THREE.Vector3();
addEventListener('message', e => {
  if(!e.data || e.data.type !== 'iss:viser') return;
  ETAT.vue = 'ext'; VUE_EXT.mode = 'terre';
  Object.assign(VISEE_HOTE, {lat:e.data.lat, lon:e.data.lon, th:VUE_EXT.th, ph:VUE_EXT.ph, actif:true});
});
function suivreVisee(){
  if(!VISEE_HOTE.actif) return;
  if(VUE_EXT.th !== VISEE_HOTE.th || VUE_EXT.ph !== VISEE_HOTE.ph){ VISEE_HOTE.actif = false; return; }   // glissé à la main
  TERRE.globe.localToWorld(vecGeo(VISEE_HOTE.lat, VISEE_HOTE.lon, 1, _vh)).normalize();
  const th = Math.atan2(_vh.x, _vh.z), ph = Math.asin(_vh.y);
  const dth = Math.atan2(Math.sin(th - VUE_EXT.th), Math.cos(th - VUE_EXT.th));
  VUE_EXT.th += dth*0.08; VUE_EXT.ph += (ph - VUE_EXT.ph)*0.08;   // glisse vers le lieu (≈ 1 s), puis le suit
  VISEE_HOTE.th = VUE_EXT.th; VISEE_HOTE.ph = VUE_EXT.ph;
}

let HOTE_DERNIER = '';
function majHote(){
  suivreVisee();
  if(!URL_P.has('onglet')) return;
  const cam = ETAT.vue === 'iss' ? camIss : camExt;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  HOTE.centre.set(0, 0, 0).project(cam);
  cam.getWorldPosition(HOTE.oeil);
  const demiAngle = Math.asin(Math.min(1, CFG.R/HOTE.oeil.length()));
  const cx = (HOTE.centre.x + 1)/2*w, cy = (1 - HOTE.centre.y)/2*h;
  const r = Math.tan(demiAngle)/Math.tan(cam.fov*DEG/2)*h/2;
  HOTE.sol.copy(ETAT.S).multiplyScalar(CFG.R).project(cam);
  const soleil = Math.atan2((1 - HOTE.sol.y)/2*h - cy, (HOTE.sol.x + 1)/2*w - cx);
  const vue = ETAT.vue;                             // 'ext' (Terre vue de loin) ou 'iss' (caméra de l'ISS : l'hôte cache son organigramme)
  const soleilEcran = soleilAEcran(cam, w, h);
  const orbite = vue === 'ext' && VUE_EXT.mode === 'lune' ? orbiteAEcran(cam, w, h, cx, cy) : null;
  // signature au demi-pixel (angle au centième) : rien n'est envoyé tant qu'elle ne change pas
  const px = (v) => Math.round(2*v);
  const sig = [px(cx), px(cy), px(r), Math.round(100*soleil), vue, JSON.stringify(soleilEcran && [px(soleilEcran.x), px(soleilEcran.y)]),
               JSON.stringify(orbite && [px(orbite.ax), px(orbite.ay), px(orbite.bx), px(orbite.by)])].join(' ');
  if(sig === HOTE_DERNIER) return;
  HOTE_DERNIER = sig;
  HOTE.cx = cx; HOTE.cy = cy; HOTE.r = r; HOTE.soleil = soleil; HOTE.vue = vue;
  window.parent.postMessage({type:'iss:terre', cx, cy, r, soleil, vue, soleilEcran, orbite}, '*');
}

/* La page hôte change d'époque : nouvelles cartes, atmosphère, côté nuit lumineux, sans recharger la page (sa vue et son Soleil
   restent, donc l'organigramme posé autour aussi). */
addEventListener('message', e => {
  if(e.data.type !== 'iss:cartes') return;
  poserCartes(e.data);
  poserPays(e.data.pays);                          // une Terre d'avant les frontières : pas de pays (geo.js)
});
