// File: js/solveur/limbe-manuel.js
// Desc: Limbe vérifié ou tracé à la main : question sous la photo, puis tracé (clics sur le bord de l'atmosphère) et nouvelle résolution.
// Version 1.0.0
// Date: [October 08, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* La détection automatique (limbe.js) se trompe sur certaines photos : reflet de l'atmosphère sur un module, Terre
   retouchée, objectif très grand-angle. Après chaque analyse, une question sous la photo (#limbeQ) : le trait bleu
   suit-il le bord de l'atmosphère ? « Non, le tracer » ouvre la photo en grand (#traceLimbe) : un clic par point sur
   le bord (le haut de la bande colorée), 3 au moins, le cercle passe par eux (moindres carrés, kasa de limbe.js) et se
   dessine à chaque clic. « Valider » : ce limbe remplace l'autre, et tout est recalculé (ui-solveur.js, resoudrePhoto) :
   Terre masquée, focale, étoiles, heure et dates. */
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

// Cercle par les points cliqués (null s'il y en a moins de 3 ou si la Terre serait minuscule).
function cercleTrace(){
  if(TRACE.pts.length < 3) return null;
  const C = kasa(TRACE.pts), W = CHK.cv.width, H = CHK.cv.height;
  return C && C.r > Math.min(W, H)/4 ? C : null;
}

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

/* Limbe à partir du cercle tracé, au format de detecterLimbe : cx, cy, r ; inliers = points du cercle sur l'arc
   cliqué (de l'angle du premier à celui du dernier, 60 points, dans l'image), pour l'heure (instant.js) ; sens = côté
   de la Terre (axe dominant du centre vu des points). */
function validerTraceLimbe(){
  const C = cercleTrace();
  if(!C) return;
  const W = CHK.cv.width, H = CHK.cv.height, P = TRACE.pts;
  const a0 = Math.atan2(P[0].y - C.cy, P[0].x - C.cx);
  const da = P.map(p => Math.atan2(Math.sin(Math.atan2(p.y - C.cy, p.x - C.cx) - a0), Math.cos(Math.atan2(p.y - C.cy, p.x - C.cx) - a0)));
  const amin = a0 + Math.min(...da), amax = a0 + Math.max(...da), inliers = [];
  for(let i=0;i<60;i++){
    const a = amin + (amax - amin)*i/59, x = C.cx + C.r*Math.cos(a), y = C.cy + C.r*Math.sin(a);
    if(x >= 0 && y >= 0 && x < W && y < H) inliers.push({x, y, c:1, l:i});
  }
  const mx = P.reduce((s, p) => s + p.x, 0)/P.length, my = P.reduce((s, p) => s + p.y, 0)/P.length;
  const dx = C.cx - mx, dy = C.cy - my;
  const sens = Math.abs(dy) > Math.abs(dx) ? [0, Math.sign(dy)] : [Math.sign(dx), 0];
  fermerTraceLimbe();
  resoudrePhoto(Object.assign(C, {inliers, sens, note:0, manuel:true}));
}
