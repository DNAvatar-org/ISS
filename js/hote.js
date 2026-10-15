// File: js/hote.js
// Desc: Page en onglet (?onglet) : la Terre à l'écran — centre et rayon apparent, en px CSS de la page — et l'angle du
//       Soleil à l'écran, envoyés à la page hôte (message 'iss:terre') : elle pose son organigramme autour, son Soleil du
//       côté du vrai, et le suit quand on tourne la caméra (bilan radiatif CO2, onglets_graphe.js). En retour, la place
//       qu'elle demande à gauche de la Terre (iss:marges) : la Terre se décale vers la droite pour la laisser.
// Version 1.1.0
// Date: [October 15, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const HOTE = {cx:NaN, cy:NaN, r:NaN, soleil:NaN, gauche:0, centre:new THREE.Vector3(), oeil:new THREE.Vector3(), sol:new THREE.Vector3()};

/* Place demandée par la page hôte à gauche du centre de la Terre [px] (HOTE.gauche, message iss:marges) : le centre de
   l'image passe à max(milieu, gauche) — quand la fenêtre est trop étroite, la Terre dépasse par la droite. Décalage du
   cadrage des deux caméras (setViewOffset) : projections, visées et clics le suivent. */
function decalerTerre(){
  const w = canvas.clientWidth, h = canvas.clientHeight, dx = w/2 - Math.max(w/2, HOTE.gauche);
  camExt.setViewOffset(w, h, dx, 0, w, h);
  camIss.setViewOffset(w, h, dx, 0, w, h);
}

/* Centre : projection de l'origine (la Terre) par la caméra qui dessine. Rayon apparent : demi-angle asin(R/d) sous lequel
   la caméra voit la Terre, rapporté au demi-champ vertical. Soleil : angle à l'écran [rad, y vers le bas] du point de la
   Terre tourné vers lui — projection de R le long de ETAT.S, depuis le centre. Envoyé quand le centre ou le rayon bouge
   d'un demi-pixel, ou l'angle d'un centième de radian. */
function majHote(){
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
  if(Math.abs(cx - HOTE.cx) < 0.5 && Math.abs(cy - HOTE.cy) < 0.5 && Math.abs(r - HOTE.r) < 0.5
     && Math.abs(soleil - HOTE.soleil) < 0.01) return;
  HOTE.cx = cx; HOTE.cy = cy; HOTE.r = r; HOTE.soleil = soleil;
  window.parent.postMessage({type:'iss:terre', cx, cy, r, soleil}, '*');
}
