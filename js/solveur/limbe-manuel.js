// File: js/solveur/limbe-manuel.js
// Desc: Limbe vérifié ou tracé à la main : question sous la photo, puis tracé (clics sur le bord de l'atmosphère) et nouvelle résolution.
// Version 1.2.0
// Date: [October 08, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* La détection automatique (limbe.js) se trompe sur certaines photos : reflet de l'atmosphère sur un module, Terre
   retouchée, objectif très grand-angle. Après chaque analyse, une question sous la photo (#limbeQ) : le trait bleu
   suit-il le bord de l'atmosphère ? « Non, le tracer » ouvre la photo en grand (#traceLimbe) : un clic par point sur
   le bord (le haut de la bande colorée), 3 au moins, le cercle passe par eux (moindres carrés, kasa de limbe.js) et se
   dessine à chaque clic. « Valider » : ce limbe remplace l'autre, et tout est recalculé (ui-solveur.js, resoudrePhoto) :
   Terre masquée, focale, étoiles, heure et dates ; ses points vont dans l'URL (?limbe=, pixels de la photo d'origine).
   Un ?limbe= déjà dans l'URL (url.js : tracé précédent, ou points donnés par un autre outil) remplace la détection
   automatique pour la photo chargée. */
const TRACE = {pts:[], k:1};

function creerTraceLimbe(){
  $('limbeOui').onclick = () => { $('limbeQ').hidden = true; };
  $('limbeNon').onclick = ouvrirTraceLimbe;
  $('traceRetirer').onclick = () => { TRACE.pts.pop(); dessinerTrace(); };
  $('traceAnnuler').onclick = fermerTraceLimbe;
  $('traceValider').onclick = validerTraceLimbe;
  $('traceCv').onclick = e => {
    const b = e.target.getBoundingClientRect();
    TRACE.pts.push({x:(e.clientX - b.left)*CHK.cv.width/b.width, y:(e.clientY - b.top)*CHK.cv.height/b.height});
    dessinerTrace();
  };
  addEventListener('keydown', e => { if(e.key === 'Escape' && !$('traceLimbe').hidden) fermerTraceLimbe(); });
}

// Sous la photo, après chaque analyse.
function demanderLimbe(limbe){
  $('limbeQTxt').textContent = limbe ? 'Le trait bleu suit-il le bord de l\'atmosphère ?' : 'Pas de bord de l\'atmosphère trouvé.';
  $('limbeOui').hidden = !limbe;
  $('limbeNon').textContent = limbe ? 'Non, le tracer' : 'Le tracer';
  $('limbeQ').hidden = false;
}

function ouvrirTraceLimbe(){
  TRACE.pts = [];
  const cv = $('traceCv');
  cv.width = CHK.cv.width; cv.height = CHK.cv.height;
  $('traceLimbe').hidden = false;
  dessinerTrace();
}
function fermerTraceLimbe(){ $('traceLimbe').hidden = true; }

// Cercle par des points de la photo de travail (null s'il y en a moins de 3 ou si la Terre serait minuscule).
function cercleDePoints(P){
  if(P.length < 3) return null;
  const C = kasa(P), W = CHK.cv.width, H = CHK.cv.height;
  return C && C.r > Math.min(W, H)/4 ? C : null;
}
const cercleTrace = () => cercleDePoints(TRACE.pts);

function dessinerTrace(){
  const cv = $('traceCv'), cx = cv.getContext('2d'), t = Math.max(1, cv.width/800);
  cx.drawImage(CHK.cv, 0, 0);
  if(CHK.limbe){                                                       // l'ancien, en pointillés
    cx.save(); cx.setLineDash([8*t, 8*t]); cx.lineWidth = 1.5*t; cx.strokeStyle = 'rgba(60,200,255,.6)';
    cx.beginPath(); cx.arc(CHK.limbe.cx, CHK.limbe.cy, CHK.limbe.r, 0, 2*Math.PI); cx.stroke(); cx.restore();
  }
  const C = cercleTrace();
  if(C){ cx.lineWidth = 2*t; cx.strokeStyle = '#3cf'; cx.beginPath(); cx.arc(C.cx, C.cy, C.r, 0, 2*Math.PI); cx.stroke(); }
  cx.fillStyle = '#ff40ff';
  for(const p of TRACE.pts){ cx.beginPath(); cx.arc(p.x, p.y, 5*t, 0, 2*Math.PI); cx.fill(); }
  const n = TRACE.pts.length;
  $('traceValider').disabled = !C;
  $('traceValider').textContent = 'Valider' + (n ? ' (' + n + ' point' + (n > 1 ? 's' : '') + ')' : '');
  $('traceRetirer').disabled = !n;
}

/* Limbe à partir de points du bord (photo de travail), au format de detecterLimbe : cx, cy, r ; inliers = points du
   cercle sur l'arc couvert (du premier point au dernier en angle, 60 points, dans l'image), pour l'heure (instant.js) ;
   sens = côté de la Terre (axe dominant du centre vu des points). null si le cercle est impossible. */
function limbeDePoints(P){
  const C = cercleDePoints(P);
  if(!C) return null;
  const W = CHK.cv.width, H = CHK.cv.height, ang = p => Math.atan2(p.y - C.cy, p.x - C.cx), a0 = ang(P[0]);
  const da = P.map(p => Math.atan2(Math.sin(ang(p) - a0), Math.cos(ang(p) - a0)));
  const amin = a0 + Math.min(...da), amax = a0 + Math.max(...da), inliers = [];
  for(let i=0;i<60;i++){
    const a = amin + (amax - amin)*i/59, x = C.cx + C.r*Math.cos(a), y = C.cy + C.r*Math.sin(a);
    if(x >= 0 && y >= 0 && x < W && y < H) inliers.push({x, y, c:1, l:i});
  }
  const mx = P.reduce((s, p) => s + p.x, 0)/P.length, my = P.reduce((s, p) => s + p.y, 0)/P.length;
  const dx = C.cx - mx, dy = C.cy - my;
  return Object.assign(C, {inliers, sens:Math.abs(dy) > Math.abs(dx) ? [0, Math.sign(dy)] : [Math.sign(dx), 0], note:0, manuel:true});
}

// Limbe tracé d'avance (?limbe= de l'URL, ou catalogue) pour la photo qui vient d'être lue (W0 × H0 : taille du fichier) :
// points [[x, y], …] en pixels du fichier, ou en fractions si toutes les valeurs sont ≤ 1. source : 'url' ou 'catalogue'.
function limbeDePointsOrigine(pts, W0, H0, source){
  const frac = pts.every(([x, y]) => x <= 1 && y <= 1), k = CHK.echelle;
  const L = limbeDePoints(pts.map(([x, y]) => frac ? {x:x*W0*k, y:y*H0*k} : {x:x*k, y:y*k}));
  return L && Object.assign(L, {source});
}

// Les points tracés, en pixels de la photo d'origine, dans l'URL (copier-coller : le même limbe pour la même photo) ;
// null : retirés. Ils valent pour la photo affichée (utilise), pas pour la suivante.
function ecrireLimbeURL(P){
  const q = new URLSearchParams(location.search), k = CHK.echelle;
  if(P){
    LIMBE_URL.pts = P.map(p => [Math.round(p.x/k), Math.round(p.y/k)]); LIMBE_URL.utilise = true;
    q.set('limbe', LIMBE_URL.pts.map(p => p.join(',')).join(';'));
  }else q.delete('limbe');
  history.replaceState(null, '', '?' + q.toString().replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%3B/g, ';'));
}

function validerTraceLimbe(){
  const L = limbeDePoints(TRACE.pts);
  if(!L) return;
  ecrireLimbeURL(TRACE.pts);
  fermerTraceLimbe();
  resoudrePhoto(L);
}
