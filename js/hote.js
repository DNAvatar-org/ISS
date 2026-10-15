// File: js/hote.js
// Desc: Page en onglet (?onglet) : la Terre à l'écran — centre et rayon apparent, en px CSS de la page — envoyée à la page
//       hôte (message 'iss:terre'), pour qu'elle pose son organigramme autour (bilan radiatif CO2, onglets_graphe.js).
// Version 1.0.0
// Date: [October 15, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const HOTE = {cx:NaN, cy:NaN, r:NaN, centre:new THREE.Vector3(), oeil:new THREE.Vector3()};

/* Centre : projection de l'origine (la Terre) par la caméra qui dessine. Rayon apparent : demi-angle asin(R/d) sous lequel
   la caméra voit la Terre, rapporté au demi-champ vertical. Envoyé quand l'un bouge d'un demi-pixel. */
function majHote(){
  if(!URL_P.has('onglet')) return;
  const cam = ETAT.vue === 'iss' ? camIss : camExt;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  HOTE.centre.set(0, 0, 0).project(cam);
  cam.getWorldPosition(HOTE.oeil);
  const demiAngle = Math.asin(Math.min(1, CFG.R/HOTE.oeil.length()));
  const cx = (HOTE.centre.x + 1)/2*w, cy = (1 - HOTE.centre.y)/2*h;
  const r = Math.tan(demiAngle)/Math.tan(cam.fov*DEG/2)*h/2;
  if(Math.abs(cx - HOTE.cx) < 0.5 && Math.abs(cy - HOTE.cy) < 0.5 && Math.abs(r - HOTE.r) < 0.5) return;
  HOTE.cx = cx; HOTE.cy = cy; HOTE.r = r;
  window.parent.postMessage({type:'iss:terre', cx, cy, r}, '*');
}
