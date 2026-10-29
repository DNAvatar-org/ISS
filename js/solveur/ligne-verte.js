// File: js/solveur/ligne-verte.js
// Desc: Ligne verte de l'airglow dans une photo de nuit : le limbe posé dessus, repère d'altitude (~92 km) pour l'heure.
// Version 1.0.0
// Date: [October 29, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* La nuit, le bord de l'atmosphère est la bande d'airglow. Vu par la tranche, l'oxygène atomique (557,7 nm) y trace
   une ligne verte fine à altitude presque fixe : le seul repère d'altitude d'une photo (le bas de la bande dépend de la
   Lune, des nuages, de la pose). Le limbe ajusté (limbe.js) tombe près d'elle sans être dessus : le saut de lumière
   commence au-dessus (de 1 à 9 px sur le catalogue). On la cherche le long de l'arc, en 8 secteurs : dans chacun, le
   rayon où « G − (R + B)/2 » culmine, de 110 km sous le limbe ajusté à 110 km au-dessus (≈ F/2100 px par km : l'ISS
   est à ~2 100 km de son horizon). Un secteur compte si son pic n'est pas au bord de la fenêtre et dépasse la médiane
   de son profil de 2 niveaux ; il en faut 5, d'accord à 8 km près — une aurore (verte aussi, de 100 à 250 km, en
   draperies) échoue là. Résultat : le limbe posé sur la ligne (même centre, rayon r + d ; d médian), ou null. */
function ligneVerte(data, W, H, limbe, F){
  const kpx = F/2100, d0 = Math.round(-110*kpx), d1 = Math.round(110*kpx), NS = 8;
  const ang = limbe.inliers.map(p => Math.atan2(p.y - limbe.cy, p.x - limbe.cx));
  const amin = Math.min(...ang), amax = Math.max(...ang), pics = [];
  for(let s=0;s<NS;s++){
    const a0 = amin + (amax - amin)*s/NS, a1 = amin + (amax - amin)*(s + 1)/NS, g = [];
    for(let d=d0;d<=d1;d++){
      let v = 0, n = 0;
      for(let a=a0;a<a1;a+=0.7/limbe.r){
        const x = limbe.cx + (limbe.r + d)*Math.cos(a), y = limbe.cy + (limbe.r + d)*Math.sin(a);
        if(x < 2 || y < 2 || x > W - 3 || y > H - 3) continue;
        const i = 4*((y|0)*W + (x|0));
        v += data[i+1] - (data[i] + data[i+2])/2; n++;
      }
      g.push(n > 20 ? v/n : NaN);
    }
    let im = -1;
    for(let k=0;k<g.length;k++) if(!isNaN(g[k]) && (im < 0 || g[k] > g[im])) im = k;
    const tri = g.filter(x => !isNaN(x)).sort((p, q) => p - q);
    if(im >= 2 && im <= g.length - 3 && g[im] - tri[tri.length >> 1] >= 2) pics.push(d0 + im);
  }
  pics.sort((p, q) => p - q);
  if(pics.length < 5 || (pics[pics.length - 2] - pics[1])/kpx > 8) return null;
  const d = pics[pics.length >> 1];
  const inliers = limbe.inliers.map(p => {
    const a = Math.atan2(p.y - limbe.cy, p.x - limbe.cx), q = Math.hypot(p.x - limbe.cx, p.y - limbe.cy) + d;
    return Object.assign({}, p, {x:limbe.cx + q*Math.cos(a), y:limbe.cy + q*Math.sin(a)});
  });
  return Object.assign({}, limbe, {r:limbe.r + d, inliers, decalage:d});
}
