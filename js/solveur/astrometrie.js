// File: js/solveur/astrometrie.js
// Desc: Astrométrie d'une photo : triangles d'étoiles détectées ↔ catalogue, puis rotation (méthode q) et focale ajustées.
// Version 1.0.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Aucune date n'est nécessaire : les étoiles sont fixes, elles donnent la direction de visée (RA, Dec), la rotation
   de l'image et la focale. Modèle : sténopé (gnomonique), centre optique au centre de l'image.
   Repère caméra DIRECT (r, u, b) = (droite, haut, arrière) : la caméra regarde vers −b. M (3×3, lignes r, u, b en J2000)
   envoie une direction J2000 v sur c = M·v ; pixel = (cx + F·c_r/(−c_b), cy − F·c_u/(−c_b)).
   1. Index des triangles du catalogue (V ≤ 4, ~500 étoiles, côtés ≤ 40°, ~250 000 triangles) par les rapports de côtés (petit/grand, moyen/grand),
      insensibles à l'échelle donc à la focale.
   2. Pour chaque focale essayée (autour de celle que donne la courbure du limbe, limbe.js, sinon de 4° à 130° de champ) :
      les 30 détections les plus brillantes deviennent des directions, leurs triangles sont comparés en ANGLES (rapports
      et taille) à ceux du catalogue ; sommets associés par côtés opposés ; M par la méthode q de Davenport ;
      note = étoiles du catalogue (V ≤ 5) retrouvées sur une détection × part retrouvée.
   3. Meilleure hypothèse affinée : appariements, M (méthode q), F (section dorée), plusieurs passes. */
const AST = {cat:null, tri:null};
const _sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const _det3 = (a, b, c) => a[0]*(b[1]*c[2]-b[2]*c[1]) - a[1]*(b[0]*c[2]-b[2]*c[0]) + a[2]*(b[0]*c[1]-b[1]*c[0]);
const _ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0]*b[0] + a[1]*b[1] + a[2]*b[2])));

function preparerCatalogue(){
  if(AST.cat) return;
  const n = ETOILES.length/4, v = [], V = [];
  for(let i=0;i<n;i++){
    const ra = ETOILES[4*i]/1000*DEG, de = ETOILES[4*i+1]/1000*DEG;
    v.push([Math.cos(de)*Math.cos(ra), Math.cos(de)*Math.sin(ra), Math.sin(de)]); V.push(ETOILES[4*i+2]/100);
  }
  const ordre = v.map((_, i) => i).sort((a, b) => V[a] - V[b]);     // du plus brillant au plus faible
  AST.cat = {v, V, ordre};
  const sel = []; for(let i=0;i<n;i++) if(V[i] <= 4.0) sel.push(i);
  const cmax = Math.cos(40*DEG), idx = new Map();
  for(let a=0;a<sel.length;a++){
    const nb = [];
    for(let b=a+1;b<sel.length;b++) if(dot3(v[sel[a]], v[sel[b]]) > cmax) nb.push(sel[b]);
    for(let j=0;j<nb.length;j++) for(let k=j+1;k<nb.length;k++){
      if(dot3(v[nb[j]], v[nb[k]]) <= cmax) continue;
      const t = trianglOrdonne([sel[a], nb[j], nb[k]], (p, q) => _ang(v[p], v[q]));
      const cle = Math.round(t.r1*100) + ',' + Math.round(t.r2*100);
      if(!idx.has(cle)) idx.set(cle, []);
      idx.get(cle).push(t);
    }
  }
  AST.tri = idx;
}

// Sommets rangés A, B, C = opposés au petit, au moyen, au grand côté ; r1 = petit/grand, r2 = moyen/grand.
function trianglOrdonne(s, dist){
  const c = [[dist(s[1], s[2]), s[0]], [dist(s[0], s[2]), s[1]], [dist(s[0], s[1]), s[2]]].sort((x, y) => x[0] - y[0]);
  return {A:c[0][1], B:c[1][1], C:c[2][1], r1:c[0][0]/c[2][0], r2:c[1][0]/c[2][0], grand:c[2][0]};
}

// Méthode q de Davenport : rotation M qui envoie au mieux les v (J2000) sur les c (caméra).
function rotationQ(c, v){
  const B = [[0,0,0],[0,0,0],[0,0,0]];
  for(let i=0;i<c.length;i++) for(let j=0;j<3;j++) for(let k=0;k<3;k++) B[j][k] += c[i][j]*v[i][k];
  const s = B[0][0] + B[1][1] + B[2][2], z = [B[1][2] - B[2][1], B[2][0] - B[0][2], B[0][1] - B[1][0]];
  const K = [[2*B[0][0]-s, B[0][1]+B[1][0], B[0][2]+B[2][0], z[0]],
             [B[1][0]+B[0][1], 2*B[1][1]-s, B[1][2]+B[2][1], z[1]],
             [B[2][0]+B[0][2], B[2][1]+B[1][2], 2*B[2][2]-s, z[2]],
             [z[0], z[1], z[2], s]];
  const q = vecteurPropreMax(K), [x, y, w, t] = [q[0], q[1], q[2], q[3]];
  return [[t*t + x*x - y*y - w*w, 2*(x*y + t*w), 2*(x*w - t*y)],
          [2*(x*y - t*w), t*t - x*x + y*y - w*w, 2*(y*w + t*x)],
          [2*(x*w + t*y), 2*(y*w - t*x), t*t - x*x - y*y + w*w]];
}
// Jacobi sur une matrice symétrique 4×4 : vecteur propre de la plus grande valeur propre.
function vecteurPropreMax(K){
  const a = K.map(r => r.slice()), e = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
  for(let it=0;it<60;it++){
    let p = 0, q = 1, m = 0;
    for(let i=0;i<4;i++) for(let j=i+1;j<4;j++) if(Math.abs(a[i][j]) > m){ m = Math.abs(a[i][j]); p = i; q = j; }
    if(m < 1e-14) break;
    const th = 0.5*Math.atan2(2*a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
    for(let k=0;k<4;k++){ const x = a[k][p], y = a[k][q]; a[k][p] = c*x - s*y; a[k][q] = s*x + c*y; }
    for(let k=0;k<4;k++){ const x = a[p][k], y = a[q][k]; a[p][k] = c*x - s*y; a[q][k] = s*x + c*y; }
    for(let k=0;k<4;k++){ const x = e[k][p], y = e[k][q]; e[k][p] = c*x - s*y; e[k][q] = s*x + c*y; }
  }
  let b = 0; for(let i=1;i<4;i++) if(a[i][i] > a[b][b]) b = i;
  return [e[0][b], e[1][b], e[2][b], e[3][b]];
}

const camDe = (p, F, cx, cy) => { const x = (p.x - cx)/F, y = -(p.y - cy)/F, n = Math.hypot(x, y, 1); return [x/n, y/n, -1/n]; };
function projeter(M, F, cx, cy, v){
  const r = dot3(M[0], v), u = dot3(M[1], v), b = dot3(M[2], v);
  return b < -0.2 ? {x:cx + F*r/(-b), y:cy - F*u/(-b)} : null;
}

// Étoiles du catalogue (V ≤ vmax) qui tombent dans l'image à moins de tol pixels d'une détection. Seules les étoiles
// du champ sont projetées (cône autour de l'axe), la détection la plus proche est cherchée dans une grille.
function grilleDet(det, tol){
  const g = new Map(), c = Math.max(4, tol);
  det.forEach((p, j) => { const k = Math.floor(p.x/c) + ',' + Math.floor(p.y/c); if(!g.has(k)) g.set(k, []); g.get(k).push(j); });
  return {g, c, det};
}
function apparier(M, F, img, G, tol, vmax){
  const {v, V, ordre} = AST.cat, cx = img.W/2, cy = img.H/2, res = [], pris = new Set();
  let m = 0;                                                           // étoiles prédites dans l'image
  const fwd = M[2], cosR = Math.cos(Math.atan(Math.hypot(img.W, img.H)/2/F));
  for(const i of ordre){
    if(V[i] > vmax) break;
    if(-dot3(fwd, v[i]) < cosR) continue;
    const p = projeter(M, F, cx, cy, v[i]);
    if(!p || p.x < 0 || p.y < 0 || p.x >= img.W || p.y >= img.H) continue;
    m++;
    const gx = Math.floor(p.x/G.c), gy = Math.floor(p.y/G.c);
    let jb = -1, db = tol;
    for(let ix=gx-1;ix<=gx+1;ix++) for(let iy=gy-1;iy<=gy+1;iy++){
      const l = G.g.get(ix + ',' + iy); if(!l) continue;
      for(const j of l){ const d = Math.hypot(G.det[j].x - p.x, G.det[j].y - p.y); if(d < db && !pris.has(j)){ db = d; jb = j; } }
    }
    if(jb >= 0){ pris.add(jb); res.push({i, j:jb, d:db}); }
  }
  res.prevues = m;
  return res;
}

function affiner(M, F, img, det){
  const cx = img.W/2, cy = img.H/2, tolMax = Math.max(6, img.W/150);
  let ap = [], rms = 0;
  for(let passe=0;passe<6;passe++){
    const t = passe < 2 ? 2*tolMax : tolMax;
    ap = apparier(M, F, img, grilleDet(det, t), t, 6.0);
    if(ap.length < 3) break;
    const ecart = (Mx, Fx) => { let s = 0; for(const a of ap){ const p = projeter(Mx, Fx, cx, cy, AST.cat.v[a.i]); s += p ? (p.x - det[a.j].x)**2 + (p.y - det[a.j].y)**2 : 1e6; } return Math.sqrt(s/ap.length); };
    const essai = Fx => { const Mx = rotationQ(ap.map(a => camDe(det[a.j], Fx, cx, cy)), ap.map(a => AST.cat.v[a.i])); return {M:Mx, F:Fx, e:ecart(Mx, Fx)}; };
    let lo = F*0.95, hi = F*1.05;                                       // section dorée sur F
    for(let k=0;k<30;k++){
      const m1 = hi - (hi - lo)*0.618, m2 = lo + (hi - lo)*0.618;
      if(essai(m1).e < essai(m2).e) hi = m2; else lo = m1;
    }
    const best = essai((lo + hi)/2); M = best.M; F = best.F; rms = best.e;
  }
  return {M, F, appariees:ap, rms};
}

/* Résolution complète. img = {W, H}, det = détections triées par éclat. Rend null ou
   {M, F, appariees, rms, miroir, centre:{ra, dec} (degrés J2000), roulis (degrés, nord par rapport au haut)}. */
function resoudreCiel(img, det, Flimbe){
  preparerCatalogue();
  const cx = img.W/2, cy = img.H/2;
  // focales à essayer : autour de celle du limbe (−35 % → +50 %), sinon champ horizontal de 4° à 130° ; pas de 6 %
  const Fs = [];
  if(Flimbe) for(let k=0;k<=14;k++){ for(const s of k ? [-1, 1] : [1]){ const F = Flimbe*Math.pow(1.06, s*k); if(F > 0.65*Flimbe && F < 1.5*Flimbe) Fs.push(F); } }
  else { const F0 = img.W/2/Math.tan(20*DEG); for(let k=0;k<=40;k++) for(const s of k ? [-1, 1] : [1]){ const F = F0*Math.pow(1.06, s*k), h = 2*Math.atan(img.W/2/F)/DEG; if(h > 4 && h < 130) Fs.push(F); } }
  const fin = Date.now() + 8000;                                        // au-delà de 8 s : pas assez d'étoiles sûres
  const tol = Math.max(5, img.W/250);
  // une focale F, une orientation (pts : détections, éventuellement retournées) → meilleure hypothèse, ou null
  const essayer = (pts, F, verif) => {
    const haut = pts.slice(0, 30);
    let best = null;
    {
      // chaque détection devient une direction (focale supposée) : triangles comparés en ANGLES, justes même à grand angle
      const U = haut.map(p => camDe(p, F, cx, cy));
      // triangles des k plus brillantes d'abord (c croissant) : on s'arrête dès qu'une hypothèse est nette
      for(let c=2;c<haut.length;c++) for(let b=1;b<c;b++) for(let a=0;a<b;a++){
        if(Date.now() > fin) return best;
        const d = trianglOrdonne([a, b, c], (p, q) => _ang(U[p], U[q]));
        if(d.grand < 2*DEG) continue;                                  // trop petit : invariants imprécis
        for(let i1=-1;i1<=1;i1++) for(let i2=-1;i2<=1;i2++){
          const l = AST.tri.get((Math.round(d.r1*100) + i1) + ',' + (Math.round(d.r2*100) + i2));
          if(!l) continue;
          for(const t of l){
            if(Math.abs(t.r1 - d.r1) > 0.008 || Math.abs(t.r2 - d.r2) > 0.008) continue;
            if(Math.abs(t.grand/d.grand - 1) > 0.07) continue;         // même taille angulaire (à la focale près)
            const cs = [d.A, d.B, d.C].map(k => U[k]), vs = [t.A, t.B, t.C].map(k => AST.cat.v[k]);
            if(Math.sign(_det3(...cs)) !== Math.sign(_det3(...vs))) continue;   // orientation : sinon image miroir
            // note = retrouvées × part retrouvée : un champ trop large (focale fausse) prédit des centaines d'étoiles,
            // il en retrouve beaucoup par hasard mais une faible part
            const M = rotationQ(cs, vs);
            const ap = apparier(M, F, img, verif, tol, 5.0), n = ap.length, note = n*n/Math.max(1, ap.prevues);
            if(!best || note > best.note) best = {n, note, M, F};
            if(best.n >= 12 && best.note >= 4) return best;             // hypothèse sans ambiguïté (au hasard : note < 1)
          }
        }
      }
    }
    return best;
  };
  // chaque focale, à l'endroit puis en miroir (image retournée) ; arrêt à la première hypothèse nette
  const sens = [det, det.map(p => ({x:img.W - 1 - p.x, y:p.y, eclat:p.eclat}))].map(p => ({pts:p, verif:grilleDet(p.slice(0, 150), tol)}));
  let h = null, miroir = false, pts = det;
  recherche: for(const F of Fs) for(let m=0;m<2;m++){
    if(Date.now() > fin) break recherche;
    const b = essayer(sens[m].pts, F, sens[m].verif);
    if(b && (!h || b.note > h.note)){ h = b; miroir = m === 1; pts = sens[m].pts; }
    if(h && h.n >= 12 && h.note >= 4) break recherche;
  }
  if(!h || h.n < 8 || h.note < 4) return null;
  const det200 = pts.slice(0, 200), r = affiner(h.M, h.F, img, det200);
  const fwd = r.M[2].map(x => -x), up = r.M[1];
  const est = [-fwd[1], fwd[0], 0], en = Math.hypot(est[0], est[1]); est[0] /= en; est[1] /= en;
  const nord = [fwd[1]*est[2] - fwd[2]*est[1], fwd[2]*est[0] - fwd[0]*est[2], fwd[0]*est[1] - fwd[1]*est[0]];
  return Object.assign(r, {miroir, det:det200,
    centre:{ra:((Math.atan2(fwd[1], fwd[0])/DEG) + 360) % 360, dec:Math.asin(fwd[2])/DEG},
    roulis:Math.atan2(dot3(up, est), dot3(up, nord))/DEG});
}
