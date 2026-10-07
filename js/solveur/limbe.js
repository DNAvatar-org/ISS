// File: js/solveur/limbe.js
// Desc: Limbe terrestre dans une photo : bord de l'atmosphère (petits points retirés), cercle ajusté (RANSAC) ; Terre masquée.
// Version 1.2.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* La Terre vue de l'ISS a un bord convexe : sous lui, tout est Terre (villes, nuages, éclairs) et ne doit pas entrer
   dans la reconnaissance des étoiles. Méthode :
   1. signal = luminance + chrominance (max − min des canaux), réduit à ~400 px de côté, puis OUVERTURE morphologique
      (minimum puis maximum sur un carré de ~1/60 du petit côté) : étoiles, pixels chauds et petites lumières de villes
      disparaissent, la bande d'airglow (continue, plus large) reste. La luminance la voit même quand elle est peu colorée
      (ciel bleu nuit retouché presque aussi saturé que la bande) ; la chrominance, quand elle est sombre (aurore verte) ;
   2. pour chacun des 4 sens possibles (Terre en bas, en haut, à droite, à gauche), 80 lignes de balayage ; sur chacune,
      les sauts « moyenne après − moyenne avant » (vers la Terre) les plus forts, jusqu'à 4 candidats : le bord du ciel
      n'est pas toujours le plus fort (une ville, un module éclairé de l'ISS peuvent le dépasser), mais il est sur toutes
      les lignes, sur une même courbe ;
   3. cercle par RANSAC (graine fixe : même photo, même résultat) : note = Σ √saut sur les lignes qui ont un point à moins
      de tol du cercle (une ligne compte une fois) ; puis moindres carrés. Le meilleur des 4 sens : la Terre est le disque.
   Sur l'arc visible, le cercle s'écarte de la vraie trace (une conique) de quelques pixels : assez pour masquer la Terre
   et borner la focale ; l'heure (instant.js) utilise les points eux-mêmes.
   Le cercle donne aussi, avec l'altitude, la focale et la verticale (à comparer aux étoiles, cf. ui-solveur.js). */
function detecterLimbe(img){
  const {width:W, height:H, data} = img;
  const k = Math.max(1, Math.round(Math.min(W, H)/400));               // sous-échantillonnage : ~400 px de côté
  const w = Math.floor(W/k), h = Math.floor(H/k), L = new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let s = 0;
    for(let dy=0;dy<k;dy++) for(let dx=0;dx<k;dx++){
      const i = 4*((y*k + dy)*W + x*k + dx), R = data[i], G = data[i+1], Bl = data[i+2];
      s += 0.3*R + 0.59*G + 0.11*Bl + Math.max(R, G, Bl) - Math.min(R, G, Bl);
    }
    L[y*w + x] = s/(k*k);
  }
  const ro = Math.max(1, Math.round(Math.min(w, h)/120));
  const B = flouBoite(extremum(extremum(L, w, h, ro, Math.min), w, h, ro, Math.max), w, h, 1);
  const fen = Math.max(3, Math.round(Math.min(w, h)/30)), NL = 80, tol = Math.max(W, H)/150;
  const sens = [[0, 1], [0, -1], [1, 0], [-1, 0]];                     // direction vers la Terre : bas, haut, droite, gauche
  let meilleur = null;
  for(const [sx, sy] of sens){
    const pts = [], lignes = sx === 0 ? w : h, long = sx === 0 ? h : w, P = new Float64Array(long + 1);
    for(let n=0;n<NL;n++){
      const l = Math.floor((n + 0.5)*lignes/NL);
      for(let t=0;t<long;t++){                                         // profil cumulé, t = 0 côté ciel
        const p = sx + sy > 0 ? t : long - 1 - t;
        P[t + 1] = P[t] + (sx === 0 ? B[p*w + l] : B[l*w + p]);
      }
      const e = t => (P[t + fen] - 2*P[t] + P[t - fen])/fen, cand = [];
      for(let t=fen;t<=long-fen;t++){
        const v = e(t);
        if(v < 8) continue;
        let max = true;
        for(let j=Math.max(fen, t - (fen >> 1));j<=Math.min(long - fen, t + (fen >> 1));j++) if(e(j) > v || (e(j) === v && j < t)){ max = false; break; }
        if(max) cand.push({t, c:v});
      }
      cand.sort((a, b) => b.c - a.c);
      for(const {t, c} of cand.slice(0, 4)){
        const p = sx + sy > 0 ? t : long - 1 - t;
        pts.push(sx === 0 ? {x:(l + 0.5)*k, y:p*k, c, l:n} : {x:p*k, y:(l + 0.5)*k, c, l:n});
      }
    }
    const C = ransacLimbe(pts, tol, sx, sy, Math.min(W, H)/4);
    if(C && (!meilleur || C.note > meilleur.note)) meilleur = Object.assign(C, {sens:[sx, sy]});
  }
  return meilleur && meilleur.inliers.length >= 12 ? meilleur : null;
}

function flouBoite(L, w, h, r){
  const t = new Float32Array(w*h), o = new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s = 0, n = 0; for(let d=-r;d<=r;d++){ const xx = x + d; if(xx >= 0 && xx < w){ s += L[y*w + xx]; n++; } } t[y*w + x] = s/n; }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s = 0, n = 0; for(let d=-r;d<=r;d++){ const yy = y + d; if(yy >= 0 && yy < h){ s += t[yy*w + x]; n++; } } o[y*w + x] = s/n; }
  return o;
}

// Minimum (ou maximum) sur un carré (2r+1)², en deux passes : érosion (dilatation) en niveaux de gris.
function extremum(L, w, h, r, f){
  const t = new Float32Array(w*h), o = new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let m = L[y*w + x]; for(let xx=Math.max(0, x - r);xx<=Math.min(w - 1, x + r);xx++) m = f(m, L[y*w + xx]); t[y*w + x] = m; }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let m = t[y*w + x]; for(let yy=Math.max(0, y - r);yy<=Math.min(h - 1, y + r);yy++) m = f(m, t[yy*w + x]); o[y*w + x] = m; }
  return o;
}

// Points du cercle (cx, cy, r) à tol près, le plus fort par ligne de balayage ; note = Σ √saut.
function inliersLimbe(pts, C, tol){
  const parLigne = new Map();
  for(const p of pts){
    if(Math.abs(Math.hypot(p.x - C.cx, p.y - C.cy) - C.r) >= tol) continue;
    const q = parLigne.get(p.l);
    if(!q || p.c > q.c) parLigne.set(p.l, p);
  }
  const inl = [...parLigne.values()];
  return {inliers:inl, note:inl.reduce((s, p) => s + Math.sqrt(p.c), 0)};
}

// Cercle du limbe : 3 points de lignes différentes, Terre du côté où allait le balayage (sx, sy), rayon ≥ rMin ;
// le mieux noté, puis affiné (Kåsa) sur ses points, deux fois.
function ransacLimbe(pts, tol, sx, sy, rMin){
  if(new Set(pts.map(p => p.l)).size < 8) return null;
  let graine = 20261007, best = null;
  const alea = () => (graine = (graine*16807) % 2147483647)/2147483647;
  for(let it=0;it<1500;it++){
    const a = pts[(alea()*pts.length)|0], b = pts[(alea()*pts.length)|0], c = pts[(alea()*pts.length)|0];
    if(a.l === b.l || a.l === c.l || b.l === c.l) continue;
    const C = cercle3(a, b, c);
    if(!C || C.r < rMin || (C.cx - (a.x + b.x + c.x)/3)*sx + (C.cy - (a.y + b.y + c.y)/3)*sy <= 0) continue;
    const s = inliersLimbe(pts, C, tol);
    if(!best || s.note > best.note) best = Object.assign(C, s);
  }
  if(!best || best.inliers.length < 3) return null;
  for(let passe=0;passe<2;passe++){
    const C = kasa(best.inliers);
    if(!C || C.r < rMin) break;
    const s = inliersLimbe(pts, C, tol);
    if(s.inliers.length < best.inliers.length) break;
    best = Object.assign(C, s);
  }
  return best;
}

// Cercle algébrique (Kåsa) par moindres carrés sur des points.
function kasa(P){
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sz = 0, sxz = 0, syz = 0;
  for(const p of P){ const z = p.x*p.x + p.y*p.y; sx += p.x; sy += p.y; sxx += p.x*p.x; syy += p.y*p.y; sxy += p.x*p.y; sz += z; sxz += p.x*z; syz += p.y*z; }
  const n = P.length, s = resoudre3([[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], [sxz, syz, sz]);
  if(!s) return null;
  const cx = s[0]/2, cy = s[1]/2;
  return {cx, cy, r:Math.sqrt(s[2] + cx*cx + cy*cy)};
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

/* Focale par la courbure du limbe (idée : l'altitude étant connue, le bord de la Terre est un cône de demi-angle
   ρ = asin((R + hz)/(R + h)) autour du nadir ; sa trace dans l'image dépend de la focale). Le sommet de l'arc est à d px
   du centre de l'image (vers la Terre) ; pour chaque focale F essayée, l'axe est incliné de α = ρ + atan(d/F) ; on
   projette le cône près du sommet et on compare le rayon de courbure à celui du cercle ajusté. hz = altitude du bord vu
   (haut de la bande d'airglow ≈ 100 km la nuit). À ~15 % près : de quoi borner la recherche des étoiles. */
function focaleParLimbe(L, W, H, hz = 98, hISS = 420){
  const d = Math.hypot(L.cx - W/2, L.cy - H/2) - L.r, rho = Math.asin((6371 + hz)/(6371 + hISS));
  const proj = (F, a, phi) => {
    const n = [0, -Math.sin(a), Math.cos(a)], e2 = [0, -Math.cos(a), -Math.sin(a)];   // e1 = (1,0,0), e2 = n × e1 (au signe près)
    const v = [Math.sin(rho)*Math.cos(phi), Math.cos(rho)*n[1] + Math.sin(rho)*Math.sin(phi)*e2[1], Math.cos(rho)*n[2] + Math.sin(rho)*Math.sin(phi)*e2[2]];
    return v[2] > 0 ? {x:F*v[0]/v[2], y:-F*v[1]/v[2], z:v[2]} : null;
  };
  let best = null;
  for(let k=0;k<=300;k++){
    const F = 100*Math.pow(300, k/300), a = rho + Math.atan(d/F);       // F de 100 à 30 000 px
    const s = [Math.PI/2, -Math.PI/2].map(p => proj(F, a, p)).filter(Boolean).sort((p, q) => q.z - p.z)[0];
    if(!s) continue;
    const ph0 = Math.abs(proj(F, a, Math.PI/2)?.z - s.z) < 1e-12 ? Math.PI/2 : -Math.PI/2;
    const p1 = proj(F, a, ph0 - 0.03), p2 = proj(F, a, ph0 + 0.03);
    if(!p1 || !p2) continue;
    const c = cercle3(p1, s, p2);
    if(!c) continue;
    const e = Math.abs(Math.log(c.r/L.r));
    if(!best || e < best.e) best = {F, e};
  }
  return best && best.e < 0.1 ? best.F : null;
}
