// File: js/solveur/encart.js
// Desc: Encart « Photo » (à droite, sous Temps) : la photo analysée et ce que le solveur y a trouvé ; clic = calque sur la vue.
// Version 1.1.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Vignette : étoiles reconnues (cercle vert, nom des plus brillantes), autres détections (point gris), limbe ajusté
   (arc cyan, Terre masquée teintée). Un clic superpose la photo à la vue 3D (#calque, semi-transparente), centrée et
   à l'échelle de la caméra : focale de la photo (pixels de l'image) → focale de l'écran, rotation (roulis) et miroir
   compris ; re-clic ou ✕ : retirée. Elle suit le zoom (majCalque, à chaque trame). */
const ENC = {url:null, W:0, H:0, F:0, roulis:0, miroir:false};

function creerEncart(){
  $('encFermer').onclick = () => { $('encartPhoto').hidden = true; montrerCalque(false); };
  $('encVue').onclick = () => montrerCalque($('calque').hidden);
}

function montrerCalque(oui){
  $('calque').hidden = !(oui && ENC.url);
  $('encartPhoto').classList.toggle('calque', !$('calque').hidden);
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

// src : canevas de la photo (taille de travail) ; url : la photo d'origine ; det : détections ; res : solution (ou null).
function afficherEncart(src, url, det, res, limbe){
  const cv = $('encCv'), W = src.width, H = src.height, cx = cv.getContext('2d');
  if(ENC.url) URL.revokeObjectURL(ENC.url);
  Object.assign(ENC, {url, W, H, F:res ? res.F : 0, roulis:0, miroir:res ? res.miroir : false});
  $('calque').src = url;
  cv.width = W; cv.height = H;
  cx.drawImage(src, 0, 0);
  const t = Math.max(1, W/400);                                         // épaisseur des traits (lisible une fois réduit)
  if(limbe){
    cx.save(); cx.beginPath(); cx.arc(limbe.cx, limbe.cy, limbe.r, 0, 2*Math.PI);
    cx.fillStyle = 'rgba(0,200,255,.12)'; cx.fill();
    cx.lineWidth = 2*t; cx.strokeStyle = '#3cf'; cx.stroke(); cx.restore();
  }
  cx.fillStyle = 'rgba(200,200,200,.8)';
  for(const p of det.slice(0, 300)) cx.fillRect(p.x - t, p.y - t, 2*t, 2*t);
  if(res){
    cx.lineWidth = 1.5*t; cx.strokeStyle = '#4f8'; cx.fillStyle = '#4f8'; cx.font = (11*t) + 'px sans-serif';
    for(const a of res.appariees){
      const p = res.miroir ? {x:W - 1 - res.det[a.j].x, y:res.det[a.j].y} : res.det[a.j];
      cx.beginPath(); cx.arc(p.x, p.y, 7*t, 0, 2*Math.PI); cx.stroke();
      if(ETOILES_NOMS[a.i] && AST.cat.V[a.i] < 2.5) cx.fillText(ETOILES_NOMS[a.i], p.x + 9*t, p.y - 6*t);
    }
  }
  $('encVue').style.aspectRatio = W + ' / ' + H;
  $('encartPhoto').hidden = false;
  montrerCalque(false);
}
