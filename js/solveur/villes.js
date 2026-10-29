// File: js/solveur/villes.js
// Desc: Lumières des villes : la partie Terre de la photo comparée à la carte de nuit, pour départager les dates possibles.
// Version 1.1.0
// Date: [October 29, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Les étoiles et le limbe laissent plusieurs instants possibles (instant.js) : l'ISS repasse au même endroit du ciel,
   mais la Terre, elle, a tourné — les villes sous elle ne sont pas les mêmes. Pour un instant candidat :
   chaque pixel de la partie Terre de la photo (sous le limbe, bande d'airglow exclue, étoiles absentes de toute façon)
   devient une direction (étoiles : M, F), le rayon part de l'ISS (TLE du jour), touche la Terre (sphère de 6 371 km) ;
   le point, tourné du temps sidéral, donne latitude (géodésique) et longitude ; on lit les lumières VIIRS de la NASA
   (GIBS « VIIRS_CityLights_2012 », niveau 3 : tuiles de 36°, ~8 km/pixel, chargées à la demande et gardées). La carte
   de nuit embarquée (rendu) ne convient pas : stylisée, décalée d'~1°, Le Caire y est presque noir.
   Note = corrélation entre log(lumière de la photo) et log(lumière VIIRS). Le bon instant sort devant : mêmes villes,
   au même endroit de l'image. Encore faut-il que la photo montre des villes (villesVisibles) — des nuages sous la
   Lune n'en montrent pas, la note n'y est que du bruit — et que la meilleure note se détache du hasard
   (significativiteVilles). */
const VIL = {tuiles:new Map(), Z:3};
const SPAN_VIL = 288/Math.pow(2, VIL.Z);                                // degrés par tuile (512 px)

// Tuile VIIRS (row, col) → Promise de sa luminance 512×512 (null si indisponible).
function tuileVilles(row, col){
  const cle = row + '/' + col;
  if(!VIL.tuiles.has(cle)) VIL.tuiles.set(cle, new Promise(ok => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
      const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, 512, 512).data, L = new Float32Array(512*512);
      for(let i=0;i<L.length;i++) L[i] = 0.3*d[4*i] + 0.59*d[4*i+1] + 0.11*d[4*i+2];
      ok(L);
    };
    im.onerror = () => ok(null);
    im.src = GIBS.url + GIBS.nuit + VIL.Z + '/' + row + '/' + col + '.jpeg';
  }));
  return VIL.tuiles.get(cle);
}

// Points de la Terre dans la photo : grille, luminance moyenne sur un carré (les lumières s'étalent, la carte est floue).
function echantillonsTerre(data, W, H, limbe){
  const pas = Math.max(4, Math.round(W/240)), demi = pas >> 1, marge = H/25, out = [];
  for(let y=demi;y<H-demi;y+=pas) for(let x=demi;x<W-demi;x+=pas){
    if(Math.hypot(x - limbe.cx, y - limbe.cy) > limbe.r - marge) continue;     // ciel, ou bande d'airglow
    let s = 0;
    for(let dy=-demi;dy<demi;dy++) for(let dx=-demi;dx<demi;dx++){ const i = 4*((y + dy)*W + x + dx); s += 0.3*data[i] + 0.59*data[i+1] + 0.11*data[i+2]; }
    out.push({x, y, l:s/(pas*pas)});
  }
  return out;
}

/* La photo montre-t-elle des villes ? Des points nettement plus clairs que le fond (4 fois la médiane, 12 au moins) sur
   3 % de la Terre au moins, et des lumières franches (1 % au-dessus de 50). Non pour des nuages sous la Lune (fond
   clair : 4 fois la médiane dépasse 255), une mer noire (rien au-dessus de 50), une aurore (fond vert uni). Catalogue :
   oui pour les 5 photos de villes, non pour ISS042-E-37847 et l'aurore. */
function villesVisibles(pts){
  const l = pts.map(p => p.l).sort((a, b) => a - b);
  if(!l.length) return false;
  const seuil = 4*Math.max(l[l.length >> 1], 3);
  return l.filter(x => x > seuil).length >= 0.03*l.length && l[Math.floor(0.99*l.length)] >= 50;
}

// Points du sol vus à l'instant unix : luminance de la photo, latitude géodésique, longitude (°) ; null sans TLE.
function solVu(res, img, pts, unix){
  const e = etatSat('iss', unix);
  if(!e) return null;
  const P = precession(unix), G = gmst((unix - unixDeJour(0))/86400);
  const r = e.r, rr = dot3(r, r), R2 = 6371*6371, cx = img.W/2, cy = img.H/2, sol = [];
  for(const p of pts){
    const c = camDe(res.miroir ? {x:img.W - 1 - p.x, y:p.y} : p, res.F, cx, cy);
    const d = mulMat(P, [0, 1, 2].map(k => res.M[0][k]*c[0] + res.M[1][k]*c[1] + res.M[2][k]*c[2]));
    const bd = dot3(r, d), disc = bd*bd - (rr - R2);
    if(disc < 0) continue;                                              // le rayon manque la Terre
    const s = -bd - Math.sqrt(disc), q = [r[0] + s*d[0], r[1] + s*d[1], r[2] + s*d[2]];
    sol.push({l:p.l, lat:Math.atan(Math.tan(Math.asin(q[2]/6371))/(1 - 0.00669438))/DEG,   // géodésique (celle des cartes)
              lon:(Math.atan2(q[1], q[0]) - G)/DEG});
  }
  return sol;
}

// Corrélation photo ↔ lumières VIIRS sur les points du sol (−1 → 1), ou null ; decalage : la Terre tournée d'autant
// (degrés de longitude), pour les notes de hasard.
async function correlationVilles(sol, decalage = 0){
  if(!sol || sol.length < 50) return null;
  const loc = sol.map(o => {
    const lon = ((o.lon + decalage) % 360 + 540) % 360 - 180, row = Math.floor((90 - o.lat)/SPAN_VIL), col = Math.floor((lon + 180)/SPAN_VIL);
    return {l:o.l, row, col, x:((lon + 180)/SPAN_VIL - col)*512, y:((90 - o.lat)/SPAN_VIL - row)*512};
  });
  const T = new Map();
  await Promise.all([...new Set(loc.map(o => o.row + '/' + o.col))].map(k => { const [rw, cl] = k.split('/').map(Number); return tuileVilles(rw, cl).then(L => T.set(k, L)); }));
  const a = [], b = [];
  for(const o of loc){
    const L = T.get(o.row + '/' + o.col);
    if(!L) continue;
    let m = 0, n = 0;                                                   // moyenne 3×3 (~24 km, l'étalement de la photo)
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const X = Math.floor(o.x) + dx, Y = Math.floor(o.y) + dy;
      if(X >= 0 && Y >= 0 && X < 512 && Y < 512){ m += L[Y*512 + X]; n++; }
    }
    a.push(Math.log(1 + o.l)); b.push(Math.log(1 + m/n));
  }
  if(a.length < 50) return null;
  const n = a.length, ma = a.reduce((s, x) => s + x, 0)/n, mb = b.reduce((s, x) => s + x, 0)/n;
  let sab = 0, saa = 0, sbb = 0;
  for(let i=0;i<n;i++){ const x = a[i] - ma, y = b[i] - mb; sab += x*y; saa += x*x; sbb += y*y; }
  return saa && sbb ? sab/Math.sqrt(saa*sbb) : null;
}

// Note de l'instant unix : corrélation photo ↔ lumières VIIRS sur les points de la Terre (−1 → 1), ou null.
async function noteVilles(res, img, pts, unix){
  return correlationVilles(solVu(res, img, pts, unix));
}

/* La meilleure de N notes est haute de toute façon : le maximum de N corrélations de hasard vaut ~σ·√(2 ln N). Le
   hasard, ici : les notes des autres dates (autres), et celles de la meilleure avec la Terre tournée de 40°, 60°…
   320° (mêmes points de la photo, autres régions aux mêmes latitudes). z = (note − moyenne)/écart-type ; concluant si
   z ≥ √(2 ln N) + 1, et 3 au moins. Pas d'écart médian : la plupart des dates visent la mer (notes ~0, serrées), il
   ferait passer pour exceptionnelle une note de terre ordinaire. Photos de Pesquet cherchées de 2000 à 2026 : Italie
   z = 8,0, Europe 5,0, orage 4,5 (seuils 4,1 à 4,2) ; Voie lactée, peu de villes, 3,7 pour 4,4 ; Orion et Soyouz 2,9. */
async function significativiteVilles(res, img, pts, m, autres){
  const sol = solVu(res, img, pts, m.unix), nul = autres.slice();
  for(let k=2;k<=16;k++){ const n = await correlationVilles(sol, 20*k); if(n !== null) nul.push(n); }
  const moy = nul.reduce((s, x) => s + x, 0)/nul.length, sd = Math.sqrt(nul.reduce((s, x) => s + (x - moy)**2, 0)/(nul.length - 1));
  const z = (m.note - moy)/sd, seuil = Math.max(3, Math.sqrt(2*Math.log(autres.length + 1)) + 1);
  return {z, seuil, ok:z >= seuil};
}
