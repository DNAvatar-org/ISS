// File: js/solveur/limbe.js
// Desc: Limbe terrestre dans une photo : bord coloré de l'atmosphère, cercle ajusté (RANSAC) ; Terre masquée.
// Version 1.1.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* La Terre vue de l'ISS a un bord convexe : sous lui, tout est Terre (villes, nuages, éclairs) et ne doit pas entrer
   dans la reconnaissance des étoiles. Méthode :
   1. signal = chrominance (max − min des canaux), très floutée (boîte de H/40 : étoiles et pixels chauds disparaissent) :
      l'atmosphère est colorée (airglow vert ou rouge-orangé la nuit, bleu-cyan le jour), le ciel noir, les étoiles et la
      structure de l'ISS (gris, blanc) sont neutres — un bord de module ou de panneau n'est donc pas pris pour l'horizon ;
   2. pour chacun des 4 sens possibles (Terre en bas, en haut, à droite, à gauche), le long de chaque ligne de balayage,
      la position où l'écart « moyenne après − moyenne avant » est le plus grand : premier bord brillant vers la Terre ;
   3. cercle ajusté sur ces points par RANSAC (le meilleur des 4 sens) : la Terre est le disque.
   Le cercle donne aussi, avec l'altitude, la focale et la verticale (à comparer aux étoiles, cf. ui-solveur.js). */
function detecterLimbe(img){
  const {width:W, height:H, data} = img;
  const k = Math.max(1, Math.round(Math.min(W, H)/400));               // sous-échantillonnage : ~400 px de côté
  const w = Math.floor(W/k), h = Math.floor(H/k), L = new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let s = 0;
    for(let dy=0;dy<k;dy++) for(let dx=0;dx<k;dx++){
      const i = 4*((y*k + dy)*W + x*k + dx), R = data[i], G = data[i+1], Bl = data[i+2];
      s += Math.max(R, G, Bl) - Math.min(R, G, Bl);
    }
    L[y*w + x] = s/(k*k);
  }
  const r = Math.max(2, Math.round(Math.min(w, h)/40));
  const B = flouBoite(L, w, h, r), fen = Math.max(3, Math.round(Math.min(w, h)/30));
  const sens = [[0, 1], [0, -1], [1, 0], [-1, 0]];                     // direction vers la Terre : bas, haut, droite, gauche
  let meilleur = null;
  for(const [sx, sy] of sens){
    const pts = [], lignes = sx === 0 ? w : h, long = sx === 0 ? h : w;
    for(let l=0;l<lignes;l+=Math.max(1, Math.floor(lignes/60))){
      const val = t => { const p = sx + sy > 0 ? t : long - 1 - t; return sx === 0 ? B[p*w + l] : B[l*w + p]; };
      let best = 0, tb = -1;
      for(let t=fen;t<long-fen;t++){
        let av = 0, ap = 0;
        for(let j=1;j<=fen;j++){ av += val(t - j); ap += val(t + j - 1); }
        const e = (ap - av)/fen;
        if(e > best){ best = e; tb = t; }
      }
      if(tb < 0 || best < 10) continue;
      const p = sx + sy > 0 ? tb : long - 1 - tb;
      pts.push(sx === 0 ? {x:(l + 0.5)*k, y:p*k, c:best} : {x:p*k, y:(l + 0.5)*k, c:best});
    }
    if(pts.length < 8) continue;
    const c = ransacCercle(pts, Math.max(W, H)/150);
    if(!c) continue;
    // la Terre doit être du côté du centre (vers où le balayage allait)
    const mx = pts.reduce((s, p) => s + p.x, 0)/pts.length, my = pts.reduce((s, p) => s + p.y, 0)/pts.length;
    if((c.cx - mx)*sx + (c.cy - my)*sy <= 0) continue;
    const note = c.inliers.length*c.inliers.reduce((s, p) => s + p.c, 0)/c.inliers.length;
    if(!meilleur || note > meilleur.note) meilleur = Object.assign(c, {note, sens:[sx, sy]});
  }
  return meilleur && meilleur.inliers.length >= 12 ? meilleur : null;
}

function flouBoite(L, w, h, r){
  const t = new Float32Array(w*h), o = new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s = 0, n = 0; for(let d=-r;d<=r;d++){ const xx = x + d; if(xx >= 0 && xx < w){ s += L[y*w + xx]; n++; } } t[y*w + x] = s/n; }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s = 0, n = 0; for(let d=-r;d<=r;d++){ const yy = y + d; if(yy >= 0 && yy < h){ s += t[yy*w + x]; n++; } } o[y*w + x] = s/n; }
  return o;
}

// Cercle par 3 points tirés au hasard, garde celui qui explique le plus de points (à tol près), puis moindres carrés.
function ransacCercle(pts, tol){
  let best = null;
  for(let it=0;it<400;it++){
    const a = pts[(Math.random()*pts.length)|0], b = pts[(Math.random()*pts.length)|0], c = pts[(Math.random()*pts.length)|0];
    const C = cercle3(a, b, c);
    if(!C) continue;
    const inl = pts.filter(p => Math.abs(Math.hypot(p.x - C.cx, p.y - C.cy) - C.r) < tol);
    if(!best || inl.length > best.inliers.length) best = Object.assign(C, {inliers:inl});
  }
  if(!best || best.inliers.length < 3) return null;
  // affinage algébrique (Kåsa) sur les points retenus
  const P = best.inliers; let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sz = 0, sxz = 0, syz = 0;
  for(const p of P){ const z = p.x*p.x + p.y*p.y; sx += p.x; sy += p.y; sxx += p.x*p.x; syy += p.y*p.y; sxy += p.x*p.y; sz += z; sxz += p.x*z; syz += p.y*z; }
  const n = P.length, A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], bb = [sxz, syz, sz];
  const s = resoudre3(A, bb);
  if(!s) return best;
  const cx = s[0]/2, cy = s[1]/2, r = Math.sqrt(s[2] + cx*cx + cy*cy);
  return {cx, cy, r, inliers:P};
}
function cercle3(a, b, c){
  const d = 2*(a.x*(b.y - c.y) + b.x*(c.y - a.y) + c.x*(a.y - b.y));
  if(Math.abs(d) < 1e-9) return null;
  const a2 = a.x*a.x + a.y*a.y, b2 = b.x*b.x + b.y*b.y, c2 = c.x*c.x + c.y*c.y;
  const cx = (a2*(b.y - c.y) + b2*(c.y - a.y) + c2*(a.y - b.y))/d, cy = (a2*(c.x - b.x) + b2*(a.x - c.x) + c2*(b.x - a.x))/d;
  return {cx, cy, r:Math.hypot(a.x - cx, a.y - cy)};
}
function resoudre3(A, b){                                               // Cramer
  const D = M => M[0][0]*(M[1][1]*M[2][2] - M[1][2]*M[2][1]) - M[0][1]*(M[1][0]*M[2][2] - M[1][2]*M[2][0]) + M[0][2]*(M[1][0]*M[2][1] - M[1][1]*M[2][0]);
  const d = D(A); if(Math.abs(d) < 1e-12) return null;
  return [0, 1, 2].map(i => D(A.map((row, j) => row.map((v, k) => k === i ? b[j] : v)))/d);
}

// Détections hors de la Terre (avec une marge au-dessus du limbe : bande d'airglow).
function horsTerre(det, limbe, marge){
  if(!limbe) return det;
  return det.filter(p => Math.hypot(p.x - limbe.cx, p.y - limbe.cy) > limbe.r + marge);
}
