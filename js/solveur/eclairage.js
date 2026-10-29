// File: js/solveur/eclairage.js
// Desc: Éclairage du sol vu : Terre claire au clair de lune (la ligne verte pour étalon) ; Lune et Soleil à un instant.
// Version 1.0.0
// Date: [October 29, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Une photo de nuit (étoiles, ISS dans l'ombre) dont la Terre est claire — des nuages comme en plein jour,
   ISS042-E-37847 — veut la Lune haute et assez pleine au-dessus du sol vu, ou l'aube, le crépuscule. Une aurore
   éclaire aussi, mais en vert : ce n'est pas la Lune.
   Photo (terrePhoto) : la Terre est « claire » si la luminance médiane de ses points dépasse 40 (sur 255) et si le vert
   n'y domine pas (moins de 38 % de R + G + B). Son éclairement se mesure contre la ligne verte, même pose, même
   appareil (son émission varie peu, du simple au double) : luminance linéaire (sRGB → puissance 2,2) du quart le plus
   sombre de la Terre (la mer entre les nuages : estimation prudente), divisée par l'éclat de la ligne au-dessus du ciel
   noir, fois 0,12 — échelle calée sur ISS042-E-37847 (Lune à 56 %, 42° au-dessus du sol vu : E = 0,077).
   Instant (eclairageSol) : éclairement E de la Lune au sol vu, 1 pour la pleine Lune au zénith,
   10^(−0,4 (m + 12,73)) × sin h, moyenné sur les points vus ; m, magnitude de la Lune à l'angle de phase φ :
   −12,73 + 0,026 φ + 4·10⁻⁹ φ⁴ (Allen).
   Une date convient (eclairageCompatible) si la Lune y donne au moins le quart de l'éclairement mesuré (albédo des
   nuages, réglages ; 0,005 au moins, ou sans ligne verte), ou si le Soleil est à moins de 12° sous l'horizon d'un
   cinquième du sol vu. ISS042-E-37847, expédition 42 : 8 dates par le limbe, 3 éclairées, toutes le 13.12.14. */
const ECLAIRAGE = {K:0.12, marge:4, plancher:0.005};
const lineaire = v => Math.pow(Math.max(0, v)/255, 2.2);

// pts : points de la Terre (echantillonsTerre) ; verte : le limbe sur la ligne verte (ou null). → {claire, E (ou null)}
function terrePhoto(data, W, H, pts, verte, F){
  const l = pts.map(p => p.l).sort((a, b) => a - b), med = l[l.length >> 1];
  let G = 0, S = 0;
  for(const p of pts){ const i = 4*(p.y*W + p.x); G += data[i+1]; S += data[i] + data[i+1] + data[i+2]; }
  const claire = med >= 40 && G < 0.38*S;
  if(!claire || !verte) return {claire, E:null};
  // éclat de la ligne : son anneau moins celui du ciel 25 km plus haut (vert linéaire, le long de l'arc vu)
  const ang = verte.inliers.map(p => Math.atan2(p.y - verte.cy, p.x - verte.cx)), amin = Math.min(...ang), amax = Math.max(...ang);
  const anneau = d => {
    let s = 0, n = 0;
    for(let a=amin;a<amax;a+=0.7/verte.r){
      const x = verte.cx + (verte.r + d)*Math.cos(a), y = verte.cy + (verte.r + d)*Math.sin(a);
      if(x < 0 || y < 0 || x >= W || y >= H) continue;
      s += lineaire(data[4*((y|0)*W + (x|0)) + 1]); n++;
    }
    return n ? s/n : 0;
  };
  const eclat = anneau(0) - anneau(Math.round(25*F/2100));
  const q = pts.map(p => { const i = 4*(p.y*W + p.x); return 0.3*lineaire(data[i]) + 0.59*lineaire(data[i+1]) + 0.11*lineaire(data[i+2]); }).sort((a, b) => a - b);
  return {claire, E:eclat > 0 ? ECLAIRAGE.K*q[Math.floor(0.25*q.length)]/eclat : null};
}

// Lune et Soleil au sol vu à l'instant unix (≤ 300 points de la photo, rayons jusqu'à la sphère) :
// {E, hLune (° au-dessus du sol, en moyenne), phase (fraction éclairée), crep (part du sol à moins de 12° de l'aube)}.
function eclairageSol(res, img, pts, unix){
  const e = etatSat('iss', unix);
  if(!e) return null;
  const P = precession(unix), r = e.r, rr = dot3(r, r), j = (unix - unixDeJour(0))/86400;
  const s = ephemSoleil(j), S = [Math.cos(s.delta)*Math.cos(s.alpha), Math.cos(s.delta)*Math.sin(s.alpha), Math.sin(s.delta)];
  const lu = ephemLune(j), L = lu.eq.map(x => x*lu.dist*100);         // km (dist : en 100 km)
  const phi = Math.acos(-dot3(S, lu.eq))/DEG, k0 = Math.pow(10, -0.4*(0.026*phi + 4e-9*phi**4));
  const pas = Math.max(1, Math.floor(pts.length/300));
  let sE = 0, sh = 0, n = 0, crep = 0;
  for(let i=0;i<pts.length;i+=pas){
    const p = pts[i], c = camDe(res.miroir ? {x:img.W - 1 - p.x, y:p.y} : p, res.F, img.W/2, img.H/2);
    const d = mulMat(P, [0, 1, 2].map(k => res.M[0][k]*c[0] + res.M[1][k]*c[1] + res.M[2][k]*c[2]));
    const bd = dot3(r, d), disc = bd*bd - (rr - 6371*6371);
    if(disc < 0) continue;                                              // le rayon manque la Terre
    const t = -bd - Math.sqrt(disc), q = r.map((x, k) => x + t*d[k]), v = L.map((x, k) => x - q[k]);
    const sinL = dot3(q, v)/(6371*Math.hypot(...v)), sinS = dot3(q, S)/6371;
    sE += k0*Math.max(0, sinL); sh += Math.asin(sinL); n++;
    if(sinS > -Math.sin(12*DEG)) crep++;
  }
  return n ? {E:sE/n, hLune:sh/n/DEG, phase:(1 + Math.cos(phi*DEG))/2, crep:crep/n} : null;
}

function eclairageCompatible(ec, terre){
  return ec !== null && (ec.crep >= 0.2 || ec.E >= (terre.E !== null ? Math.max(ECLAIRAGE.plancher, terre.E/ECLAIRAGE.marge) : ECLAIRAGE.plancher));
}
