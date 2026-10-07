// File: js/solveur/detection.js
// Desc: Détection des étoiles dans une photo : maxima locaux nets au-dessus du fond, triés par éclat.
// Version 1.0.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Luminance légèrement lissée (boîte 3×3), fond = moyenne sur une boîte de 51 px (images intégrales), puis maxima
   locaux dans un carré de 11 px (étoiles serrées des amas), au moins 25 niveaux au-dessus du fond. Éclat = somme de l'excès dans 11×11
   (les étoiles brillantes saturent : leur halo, plus large, les classe quand même devant). Position au barycentre.
   Pixels chauds (capteur vidéo, pose longue) rejetés : un seul pixel allumé, sans voisin à 25 % de son excès. Une étoile,
   même fine, s'étale (optique, dématriçage, compression) ; le bruit non.
   Points non ponctuels rejetés : sur un anneau de rayon 8 px, une étoile laisse le fond (au plus quelques voisines) ;
   un bord de module, de panneau ou de nuage en allume la moitié. Critère : la médiane de l'anneau sous 25 % du pic (dans
   un amas ou la Voie lactée, quelques voisines tombent dans l'anneau sans rejeter l'étoile).
   Points d'une seule couleur rejetés : le bruit d'un capteur vidéo à fort gain fait des taches rouges, vertes ou bleues
   (étalées sur 2×2 par la compression) ; une étoile, même frangée de violet, mêle les trois canaux.
   Les lumières de villes passent aussi : le masque (limbe.js) et l'appariement (astrometrie.js) les écartent. */
function detecterEtoiles(img){
  const {width:W, height:H, data} = img;
  const L = new Float32Array(W*H);
  for(let i=0;i<W*H;i++) L[i] = 0.3*data[4*i] + 0.59*data[4*i+1] + 0.11*data[4*i+2];
  const moy = (src, r) => {                                             // moyenne sur une boîte (2r+1)², image intégrale
    const I = new Float64Array((W + 1)*(H + 1));
    for(let y=0;y<H;y++){ let s = 0; for(let x=0;x<W;x++){ s += src[y*W + x]; I[(y + 1)*(W + 1) + x + 1] = I[y*(W + 1) + x + 1] + s; } }
    const out = new Float32Array(W*H);
    for(let y=0;y<H;y++){
      const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
      for(let x=0;x<W;x++){
        const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
        out[y*W + x] = (I[y1*(W + 1) + x1] - I[y0*(W + 1) + x1] - I[y1*(W + 1) + x0] + I[y0*(W + 1) + x0])/((y1 - y0)*(x1 - x0));
      }
    }
    return out;
  };
  const G = moy(L, 1), F = moy(L, 25);
  const res = [], R = 5, B = 5;                                        // maximum local sur 11×11 : amas serrés compris
  for(let y=R;y<H-R;y++) for(let x=R;x<W-R;x++){
    const g = G[y*W + x];
    if(g - F[y*W + x] < 25) continue;
    if(G[y*W + x - 1] > g || G[y*W + x + 1] > g || G[(y - 1)*W + x] > g || G[(y + 1)*W + x] > g) continue;   // tri rapide
    let max = true;
    for(let dy=-R;dy<=R && max;dy++) for(let dx=-R;dx<=R;dx++){
      const o = G[(y + dy)*W + x + dx];
      if(o > g || (o === g && (dy < 0 || (dy === 0 && dx < 0)))){ max = false; break; }   // égalité : le premier seulement
    }
    if(!max) continue;
    let voisins = 0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if((dx || dy) && L[(y + dy)*W + x + dx] - F[y*W + x] > 0.25*(L[y*W + x] - F[y*W + x])) voisins++;
    if(voisins < 2) continue;                                          // pixel chaud isolé
    const anneau = [];
    for(let a=0;a<24;a++){
      const xx = Math.round(x + 8*Math.cos(a*Math.PI/12)), yy = Math.round(y + 8*Math.sin(a*Math.PI/12));
      if(xx >= 0 && yy >= 0 && xx < W && yy < H) anneau.push(G[yy*W + xx] - F[yy*W + xx]);
    }
    anneau.sort((p, q) => p - q);
    if(anneau[Math.floor(anneau.length*0.5)] > 0.25*(g - F[y*W + x])) continue;    // pas ponctuel : bord, surface (médiane : des voisines ne suffisent pas)
    let cr = 0, cg = 0, cb = 0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const i = 4*((y + dy)*W + x + dx); cr += data[i]; cg += data[i+1]; cb += data[i+2]; }
    const cmax = Math.max(cr, cg, cb);
    if(cmax > 0 && (cmax - Math.min(cr, cg, cb))/cmax > 0.7) continue;   // une seule couleur : bruit du capteur
    let s = 0, sx = 0, sy = 0;
    for(let dy=-B;dy<=B;dy++) for(let dx=-B;dx<=B;dx++){
      const e = G[(y + dy)*W + x + dx] - F[(y + dy)*W + x + dx];
      if(e > 0){ s += e; sx += e*(x + dx); sy += e*(y + dy); }
    }
    res.push({x:sx/s, y:sy/s, eclat:s});
  }
  res.sort((a, b) => b.eclat - a.eclat);
  return res;
}
