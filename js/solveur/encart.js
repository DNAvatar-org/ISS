// File: js/solveur/encart.js
// Desc: Encart « Photo » (à droite, sous Temps) : la photo analysée, avec ce que le solveur y a trouvé ; zoom au clic.
// Version 1.0.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Superposé à la photo : étoiles reconnues (cercle vert, nom des plus brillantes), autres détections (point gris),
   limbe ajusté (arc cyan, la Terre masquée au-delà est teintée). Le canevas garde la résolution de travail (≤ 2400 px) :
   le zoom (CSS) reste net. Clic : ×2 centré sur le point cliqué, jusqu'à ×8, puis retour à l'image entière ;
   molette : zoom autour du pointeur. */
const ENC = {z:1, ox:0, oy:0};

function creerEncart(){
  const vue = $('encVue');
  $('encFermer').onclick = () => { $('encartPhoto').hidden = true; };
  vue.onclick = e => {
    const r = vue.getBoundingClientRect(), z = ENC.z >= 8 ? 1 : ENC.z*2;
    zoomEncart(z, e.clientX - r.left, e.clientY - r.top, true);
  };
  vue.addEventListener('wheel', e => {
    e.preventDefault();
    const r = vue.getBoundingClientRect();
    zoomEncart(Math.max(1, Math.min(16, ENC.z*Math.exp(-e.deltaY*0.002))), e.clientX - r.left, e.clientY - r.top, false);
  }, {passive:false});
}

// z : nouveau zoom ; (px, py) : point de l'encart visé ; centrer : le ramener au milieu (clic) ou le garder sous le pointeur (molette).
function zoomEncart(z, px, py, centrer){
  const vue = $('encVue'), cw = vue.clientWidth, ch = vue.clientHeight;
  const ix = (px - ENC.ox)/ENC.z, iy = (py - ENC.oy)/ENC.z;            // point de l'image (à l'échelle 1 de l'encart)
  ENC.z = z;
  ENC.ox = (centrer ? cw/2 : px) - ix*z; ENC.oy = (centrer ? ch/2 : py) - iy*z;
  ENC.ox = Math.min(0, Math.max(cw - cw*z, ENC.ox)); ENC.oy = Math.min(0, Math.max(ch - ch*z, ENC.oy));   // l'image couvre l'encart
  $('encCv').style.transform = 'translate(' + ENC.ox + 'px,' + ENC.oy + 'px) scale(' + z + ')';
}

// src : canevas de la photo (taille de travail) ; det : détections ; res : solution (ou null) ; limbe (ou null).
function afficherEncart(src, det, res, limbe){
  const cv = $('encCv'), W = src.width, H = src.height, cx = cv.getContext('2d');
  cv.width = W; cv.height = H;
  cx.drawImage(src, 0, 0);
  const t = Math.max(1, W/800);                                         // épaisseur des traits (lisible une fois réduit)
  if(limbe){
    cx.save(); cx.beginPath(); cx.arc(limbe.cx, limbe.cy, limbe.r, 0, 2*Math.PI);
    cx.fillStyle = 'rgba(0,200,255,.12)'; cx.fill();
    cx.lineWidth = 2*t; cx.strokeStyle = '#3cf'; cx.stroke(); cx.restore();
  }
  cx.fillStyle = 'rgba(200,200,200,.8)';
  for(const p of det.slice(0, 300)) cx.fillRect(p.x - t, p.y - t, 2*t, 2*t);
  if(res){
    const noms = typeof ETOILES_NOMS === 'undefined' ? null : ETOILES_NOMS;
    cx.lineWidth = 1.5*t; cx.strokeStyle = '#4f8'; cx.fillStyle = '#4f8'; cx.font = (11*t) + 'px sans-serif';
    for(const a of res.appariees){
      const p = res.miroir ? {x:W - 1 - res.det[a.j].x, y:res.det[a.j].y} : res.det[a.j];
      cx.beginPath(); cx.arc(p.x, p.y, 7*t, 0, 2*Math.PI); cx.stroke();
      if(noms && noms[a.i] && AST.cat.V[a.i] < 3) cx.fillText(noms[a.i], p.x + 9*t, p.y - 6*t);
    }
  }
  $('encartPhoto').hidden = false;
  $('encVue').style.aspectRatio = W + ' / ' + H;
  ENC.z = 1; ENC.ox = 0; ENC.oy = 0; cv.style.transform = '';
}
