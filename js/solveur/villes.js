// File: js/solveur/villes.js
// Desc: Lumières des villes : la partie Terre de la photo comparée à la carte de nuit, pour départager les dates possibles.
// Version 1.0.0
// Date: [October 07, 2026]
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
   au même endroit de l'image. */
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

// Note de l'instant unix : corrélation photo ↔ lumières VIIRS sur les points de la Terre (−1 → 1), ou null.
async function noteVilles(res, img, pts, unix){
  const e = etatSat('iss', unix);
  if(!e) return null;
  const P = precession(unix), G = gmst((unix - unixDeJour(0))/86400);
  const r = e.r, rr = dot3(r, r), R2 = 6371*6371, cx = img.W/2, cy = img.H/2;
  const sol = [];                                                       // point du sol de chaque échantillon
  for(const p of pts){
    const c = camDe(res.miroir ? {x:img.W - 1 - p.x, y:p.y} : p, res.F, cx, cy);
    const d = mulMat(P, [0, 1, 2].map(k => res.M[0][k]*c[0] + res.M[1][k]*c[1] + res.M[2][k]*c[2]));
    const bd = dot3(r, d), disc = bd*bd - (rr - R2);
    if(disc < 0) continue;                                              // le rayon manque la Terre
    const s = -bd - Math.sqrt(disc), q = [r[0] + s*d[0], r[1] + s*d[1], r[2] + s*d[2]];
    const lon = ((Math.atan2(q[1], q[0]) - G)/DEG % 360 + 540) % 360 - 180;
    const lat = Math.atan(Math.tan(Math.asin(q[2]/6371))/(1 - 0.00669438))/DEG;   // géodésique (celle des cartes)
    const row = Math.floor((90 - lat)/SPAN_VIL), col = Math.floor((lon + 180)/SPAN_VIL);
    sol.push({p, row, col, x:((lon + 180)/SPAN_VIL - col)*512, y:((90 - lat)/SPAN_VIL - row)*512});
  }
  if(sol.length < 50) return null;
  const T = new Map();
  await Promise.all([...new Set(sol.map(o => o.row + '/' + o.col))].map(k => { const [rw, cl] = k.split('/').map(Number); return tuileVilles(rw, cl).then(L => T.set(k, L)); }));
  const a = [], b = [];
  for(const o of sol){
    const L = T.get(o.row + '/' + o.col);
    if(!L) continue;
    let m = 0, n = 0;                                                   // moyenne 3×3 (~24 km, l'étalement de la photo)
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const X = Math.floor(o.x) + dx, Y = Math.floor(o.y) + dy;
      if(X >= 0 && Y >= 0 && X < 512 && Y < 512){ m += L[Y*512 + X]; n++; }
    }
    a.push(Math.log(1 + o.p.l)); b.push(Math.log(1 + m/n));
  }
  if(a.length < 50) return null;
  const n = a.length, ma = a.reduce((s, x) => s + x, 0)/n, mb = b.reduce((s, x) => s + x, 0)/n;
  let sab = 0, saa = 0, sbb = 0;
  for(let i=0;i<n;i++){ const x = a[i] - ma, y = b[i] - mb; sab += x*y; saa += x*x; sbb += y*y; }
  return saa && sbb ? sab/Math.sqrt(saa*sbb) : null;
}
