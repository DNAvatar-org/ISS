// File: js/solveur/instant.js
// Desc: Heure de la photo par le limbe : instant où la verticale de l'ISS est l'axe du cône de l'horizon photographié.
// Version 1.0.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Grâce aux étoiles (M, F), chaque point du limbe photographié devient une direction du ciel. L'horizon vu de l'ISS est un
   cône d'axe le nadir : tous ces points sont à la même distance angulaire du nadir. À l'instant juste, l'écart-type de
   ces distances est minimal (leur moyenne donne l'altitude du bord vu : sol, ou haut de la bande d'airglow ~100 km).
   On balaie autour de l'heure annoncée (EXIF ou saisie) à 10 s, puis à 1 s. Pas au-delà de ±40 min : l'ISS repasse
   presque au même endroit du ciel à chaque orbite (le plan ne tourne que de ~0,3° par tour), seule une heure
   approximative lève l'ambiguïté. */

function heureParLimbe(res, img, limbe, unix0, demi = 2400){
  const cx = img.W/2, cy = img.H/2;
  const dirs = limbe.inliers.map(p => {                                 // directions J2000 des points du limbe
    const c = camDe(res.miroir ? {x:img.W - 1 - p.x, y:p.y} : p, res.F, cx, cy);
    return [0, 1, 2].map(k => res.M[0][k]*c[0] + res.M[1][k]*c[1] + res.M[2][k]*c[2]);   // Mᵀ·c
  });
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
