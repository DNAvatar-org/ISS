// File: js/solveur/instant.js
// Desc: Heure de la photo par le limbe : instant où la verticale de l'ISS est l'axe du cône de l'horizon photographié.
// Version 1.1.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Grâce aux étoiles (M, F), chaque point du limbe photographié devient une direction du ciel. L'horizon vu de l'ISS est un
   cône d'axe le nadir : tous ces points sont à la même distance angulaire du nadir. À l'instant juste, l'écart-type de
   ces distances est minimal (leur moyenne donne l'altitude du bord vu : sol, ou haut de la bande d'airglow ~100 km).
   On balaie autour de l'heure annoncée (EXIF ou saisie) à 10 s, puis à 1 s. Pas au-delà de ±40 min : l'ISS repasse
   presque au même endroit du ciel à chaque orbite (le plan ne tourne que de ~0,3° par tour), seule une heure
   approximative lève l'ambiguïté. */

// Directions J2000 des points du limbe (Mᵀ·c).
function dirsLimbe(res, img, limbe){
  const cx = img.W/2, cy = img.H/2;
  return limbe.inliers.map(p => {
    const c = camDe(res.miroir ? {x:img.W - 1 - p.x, y:p.y} : p, res.F, cx, cy);
    return [0, 1, 2].map(k => res.M[0][k]*c[0] + res.M[1][k]*c[1] + res.M[2][k]*c[2]);
  });
}

/* Tolérance du limbe. Le meilleur cône possible (axe libre, axeLimbe) a déjà une dispersion : nulle pour un objectif
   parfait, ~0,2° pour un 16 mm sur un arc de 95° (distorsion non modélisée). L'axe imposé par l'ISS ne peut faire mieux ;
   on accepte jusqu'à 1,6 fois cette dispersion (au moins 0,08°). L'altitude du bord vu (39 km par degré d'angle de
   cône) est biaisée par la même distorsion : fourchette élargie de ~3 fois l'excès de tolérance, ±60 km au plus. */
function toleranceLimbe(res, img, limbe){
  const n = axeLimbe(res, img, limbe), a = dirsLimbe(res, img, limbe).map(v => Math.acos(Math.max(-1, Math.min(1, dot3(v, n)))));
  const m = a.reduce((s, x) => s + x, 0)/a.length, sdLibre = Math.sqrt(a.reduce((s, x) => s + (x - m)**2, 0)/a.length)/DEG;
  const sd = Math.max(0.08, 1.6*sdLibre);
  return {sdLibre, sd, alt:Math.min(60, 39*3*(sd - 0.08))};
}

function heureParLimbe(res, img, limbe, unix0, demi = 2400){
  const dirs = dirsLimbe(res, img, limbe);                             // directions J2000 des points du limbe
  const P = precession(unix0), d = dirs.map(v => mulMat(P, v));        // vers l'équateur de la date
  const mesure = unix => {
    const e = etatSat('iss', unix);
    if(!e) return null;
    const rn = Math.hypot(...e.r), n = e.r.map(x => -x/rn);
    const a = d.map(v => Math.acos(Math.max(-1, Math.min(1, dot3(v, n)))));
    const m = a.reduce((s, x) => s + x, 0)/a.length, sd = Math.sqrt(a.reduce((s, x) => s + (x - m)**2, 0)/a.length);
    return {unix, sd, alt:rn*Math.sin(m) - 6371};                       // altitude (km) du bord vu
  };
  let best = null;
  for(let t=unix0-demi;t<=unix0+demi;t+=10){ const m = mesure(t); if(m && (!best || m.sd < best.sd)) best = m; }
  if(!best) return null;
  for(let t=best.unix-10;t<=best.unix+10;t+=1){ const m = mesure(t); if(m && m.sd < best.sd) best = m; }
  return Object.assign(best, {ecart:best.unix - unix0, sdDeg:best.sd/DEG});
}

/* Dates possibles (sans EXIF). Le limbe donne, grâce aux étoiles, la direction de la verticale de l'ISS dans le ciel
   (axe du cône de l'horizon). L'ISS n'y passe que lorsque le plan de son orbite contient cette direction : environ deux
   fois tous les 60 jours (le plan tourne de ~5°/jour), à chaque orbite de ces jours-là. On parcourt l'historique des
   TLE jour par jour (plan à midi), on garde les jours où le plan est à moins de 6° de la direction, puis chaque passage
   de ces jours, affiné par le limbe (heureParLimbe) ; de nuit (Terre noire, villes), l'ISS doit être dans l'ombre.
   Reste une liste d'instants, à départager à l'œil (villes, Lune) avec le calque. */
function axeLimbe(res, img, limbe){
  const d = dirsLimbe(res, img, limbe);
  // n, c tels que d·n = c pour tous les points : plus petit vecteur propre de Σ [d, −1][d, −1]ᵀ
  const A = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for(const v of d){ const w = [v[0], v[1], v[2], -1]; for(let i=0;i<4;i++) for(let j=0;j<4;j++) A[i][j] += w[i]*w[j]; }
  const tr = A[0][0] + A[1][1] + A[2][2] + A[3][3];
  const q = vecteurPropreMax(A.map((r, i) => r.map((x, j) => (i === j ? tr : 0) - x)));
  const s = Math.hypot(q[0], q[1], q[2]) * (q[3] < 0 ? -1 : 1);
  return [q[0]/s, q[1]/s, q[2]/s];                                     // vers la Terre (cos ρ > 0), J2000
}

function datesPossibles(res, img, limbe, unixDebut, unixFin, nuit = true){
  const n0 = axeLimbe(res, img, limbe), S = EPH.sats.iss, out = [], tl = toleranceLimbe(res, img, limbe);
  for(let jour = Math.floor(unixDebut/86400)*86400 + 43200; jour < unixFin; jour += 86400){
    const e = etatSat('iss', jour);
    if(!e) continue;
    const z = mulMat(precession(jour), n0).map(x => -x);                // direction de l'ISS vue du centre de la Terre
    const h = [e.r[1]*e.v[2] - e.r[2]*e.v[1], e.r[2]*e.v[0] - e.r[0]*e.v[2], e.r[0]*e.v[1] - e.r[1]*e.v[0]];
    const hn = Math.hypot(...h);
    if(Math.abs(dot3(h, z))/hn > Math.sin(6*DEG)) continue;            // plan loin de la direction ce jour-là (3° + 2,5° de rotation en 12 h)
    const rn = Math.hypot(...e.r), r = e.r.map(x => x/rn), b = [h[1]*r[2] - h[2]*r[1], h[2]*r[0] - h[0]*r[2], h[0]*r[1] - h[1]*r[0]].map(x => x/hn);
    const du = (Math.atan2(dot3(z, b), dot3(z, r)) + 2*Math.PI) % (2*Math.PI);   // angle à parcourir sur l'orbite
    const T = 2*Math.PI*Math.sqrt(rn**3/398600.4418);
    let t0 = jour + du/(2*Math.PI)*T;                                  // premier passage du jour (de 0 h à 24 h)
    while(t0 - T >= jour - 43200) t0 -= T;
    for(let t = t0; t < jour + 43200; t += T){
      const m = heureParLimbe(res, img, limbe, Math.round(t), 600);
      // de nuit, le bord vu est le haut de la bande d'airglow (80–120 km) ; de jour, le sol ou la brume (−20–150 km)
      if(!m || m.sdDeg > tl.sd || m.alt < (nuit ? 80 : -20) - tl.alt || m.alt > (nuit ? 120 : 150) + tl.alt) continue;
      if(nuit){
        const es = etatSat('iss', m.unix), sol = ephemSoleil((m.unix - unixDeJour(0))/86400);
        const Sv = [Math.cos(sol.delta)*Math.cos(sol.alpha), Math.cos(sol.delta)*Math.sin(sol.alpha), Math.sin(sol.delta)];
        const p = dot3(es.r, Sv), perp = Math.hypot(es.r[0] - p*Sv[0], es.r[1] - p*Sv[1], es.r[2] - p*Sv[2]);
        if(!(p < 0 && perp < 6371)) continue;                          // au soleil : pas une photo de nuit
      }
      if(!out.some(o => Math.abs(o.unix - m.unix) < 600)) out.push(m);
    }
  }
  return out.sort((a, b) => a.unix - b.unix);
}
