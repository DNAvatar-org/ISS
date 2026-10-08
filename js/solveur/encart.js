// File: js/solveur/encart.js
// Desc: Encart « Photo » (à droite, sous Temps) : la photo analysée et ce que le solveur y a trouvé ; clic = calque sur la vue.
// Version 1.3.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* La photo s'affiche dès qu'elle est lue (afficherPhoto), avant l'analyse ; les marques viennent ensuite (marquerPhoto).
   Vignette : étoiles reconnues (cercle vert, nom des plus brillantes), autres détections (point gris), limbe ajusté
   (arc bleu, Terre masquée teintée). Un clic superpose à la vue 3D le calque (#calque, canevas semi-transparent) : la
   photo AVEC ses marques — cercles verts autour de SES étoiles reconnues, trait bleu du limbe —, centrée et à l'échelle
   de la caméra : focale de la photo (pixels de l'image) → focale de l'écran, rotation (roulis) et miroir compris. Dans la
   simulation, les étoiles du catalogue appariées sont des points rouges (ciel.js) : un point rouge dans chaque cercle
   vert, et le trait bleu sur l'horizon de la vue, si la solution est bonne. Re-clic ou ✕ : retirée. Elle suit le zoom (majCalque, à chaque trame). */
const ENC = {W:0, H:0, F:0, roulis:0, miroir:false, pliAvantZen:false};

function creerEncart(){
  $('encFermer').onclick = () => { $('encartPhoto').hidden = true; montrerCalque(false); };
  $('encPlier').onclick = () => plierEncart(!$('encartPhoto').classList.contains('plie'));
  $('encVue').onclick = () => montrerCalque($('calque').hidden);
}

// Replié : le titre seul (bouton + pour déplier) ; rien n'est retiré.
function plierEncart(oui){
  $('encartPhoto').classList.toggle('plie', oui);
  $('encPlier').textContent = oui ? '+' : '−';
  $('encPlier').title = oui ? 'Déplier' : 'Replier (la photo et le calque restent)';
}
// Plein écran (ui.js, basculerZen) : l'encart se replie ; en sortant, il reprend l'état d'avant.
function encartZen(zen){
  if(zen){ ENC.pliAvantZen = $('encartPhoto').classList.contains('plie'); plierEncart(true); }
  else plierEncart(ENC.pliAvantZen);
}

function montrerCalque(oui){
  $('calque').hidden = !(oui && ENC.W);
  $('encartPhoto').classList.toggle('calque', !$('calque').hidden);
  CIEL.uCalque.value = $('calque').hidden ? 0 : 1;                     // étoiles de l'app grossies (ciel.js)
  if(CIEL.testees) CIEL.testees.visible = !$('calque').hidden;          // et les appariées en rouge
  majCalque();
}

// Taille et orientation du calque (à chaque trame : la focale de la vue peut changer).
function majCalque(){
  const c = $('calque');
  if(c.hidden) return;
  const Fe = innerHeight/2/Math.tan(VUE_ISS.fov*DEG/2);                // focale de l'écran (px CSS)
  const k = ENC.F ? Fe/ENC.F : innerHeight/ENC.H;                       // sans solution : la hauteur de la vue
  c.style.width = (ENC.W*k) + 'px'; c.style.height = (ENC.H*k) + 'px';
  c.style.transform = 'translate(-50%,-50%) rotate(' + ENC.roulis + 'deg)' + (ENC.miroir ? ' scaleX(-1)' : '');
}

// src : canevas de la photo (taille de travail). Affichée tout de suite, sans marques ; le calque n'est pas montré.
function afficherPhoto(src){
  Object.assign(ENC, {W:src.width, H:src.height, F:0, roulis:0, miroir:false});
  for(const cv of [$('encCv'), $('calque')]){ cv.width = ENC.W; cv.height = ENC.H; cv.getContext('2d').drawImage(src, 0, 0); }
  marquerEtoilesTestees([]);
  $('encVue').style.aspectRatio = ENC.W + ' / ' + ENC.H;
  $('encartPhoto').hidden = false;
  montrerCalque(false);
}

// Marques de l'analyse, sur la vignette et sur le calque. det : détections ; res : solution (ou null) ; limbe (ou null).
function marquerPhoto(src, det, res, limbe){
  Object.assign(ENC, {F:res ? res.F : 0, miroir:res ? res.miroir : false});
  dessinerMarques($('encCv'), src, det, res, limbe, Math.max(1, src.width/400), true);
  dessinerMarques($('calque'), src, det, res, limbe, Math.max(1, src.width/900), false);
  marquerEtoilesTestees(res ? res.appariees.map(a => a.i) : []);
  montrerCalque(!$('calque').hidden);
}

// t : épaisseur des traits (lisible une fois réduit) ; vignette : Terre teintée, détections grises, noms.
function dessinerMarques(cv, src, det, res, limbe, t, vignette){
  const W = src.width, cx = cv.getContext('2d');
  cx.drawImage(src, 0, 0);
  if(limbe){
    cx.save(); cx.beginPath(); cx.arc(limbe.cx, limbe.cy, limbe.r, 0, 2*Math.PI);
    if(vignette){ cx.fillStyle = 'rgba(0,200,255,.12)'; cx.fill(); }
    cx.lineWidth = 2*t; cx.strokeStyle = '#3cf'; cx.stroke(); cx.restore();
  }
  if(vignette){
    cx.fillStyle = 'rgba(200,200,200,.8)';
    for(const p of det.slice(0, 300)) cx.fillRect(p.x - t, p.y - t, 2*t, 2*t);
  }
  if(!res) return;
  cx.lineWidth = 1.5*t; cx.strokeStyle = '#4f8'; cx.fillStyle = '#4f8'; cx.font = (11*t) + 'px sans-serif';
  for(const a of res.appariees){
    const p = res.miroir ? {x:W - 1 - res.det[a.j].x, y:res.det[a.j].y} : res.det[a.j];
    cx.beginPath(); cx.arc(p.x, p.y, 7*t, 0, 2*Math.PI); cx.stroke();
    if(vignette && ETOILES_NOMS[a.i] && AST.cat.V[a.i] < 2.5) cx.fillText(ETOILES_NOMS[a.i], p.x + 9*t, p.y - 6*t);
  }
}
