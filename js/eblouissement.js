// File: js/eblouissement.js
// Desc: Éblouissement du Soleil : diffusion dans l'objectif, image floutée de la partie VISIBLE du disque solaire.
// Version 1.0.1
// Date: [October 06, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Le halo ne se forme pas autour du Soleil mais dans l'instrument, APRÈS la Lune sur le trajet de la lumière.
   C'est donc la convolution de ce qui reste visible du disque (croissant, anneau…) par la tache de diffusion de l'objectif :
   – son intensité suit la part visible du disque (aire exacte des disques apparents Lune et Terre) ;
   – près du limbe, il est plus fort du côté du croissant ; loin, il redevient rond, centré sur le croissant ;
   – il passe devant la Lune (pas de test de profondeur) : le bord de la Lune côté croissant est voilé ;
   – aucune lumière visible, aucun halo : à la totalité il s'éteint et laisse voir la couronne (couronne.js).
   Le disque est découpé en ECL.N cellules (1 au centre, 12 puis 36 secteurs vers le bord). Chaque cellule devient
   une source ponctuelle placée au barycentre de sa partie VISIBLE, pesant sa lumière visible (sous-échantillons,
   assombrissement centre-bord) : un fin croissant donne des sources serrées sur le croissant, pas sur tout le pourtour.
   Unités : le rayon apparent du Soleil (rs), dans le plan du panneau (axes droite / haut de la caméra). */

const ECL = {N:49, DEMI:18, sous:[], cellules:[]};   // DEMI : demi-côté du carré dessiné, en rs (le halo s'éteint à ~17 rs ≈ 4,5°)

// Tache de diffusion E(u) (exposition, avant saturation), u = distance au point source en rs :
//   aile large u^-1,5 (le halo d'avant, ~9° de large) + cœur raide u^-6 (anneau de diamant juste avant la totalité).
const GLSL_ECL_VS = `
uniform float uDemi; varying vec2 vP;
void main(){
  vP = position.xy * ${ECL.DEMI.toFixed(1)};
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);    // panneau face à la caméra, centré sur le Soleil
  c.xy += position.xy * uDemi;
  gl_Position = projectionMatrix * c;
}`;
const GLSL_ECL_FS = `
uniform vec3 uEch[${ECL.N}]; uniform vec3 uTeinte; uniform float uAile; varying vec2 vP;
void main(){
  float E = 0.0;
  for(int i = 0; i < ${ECL.N}; i++){
    vec3 s = uEch[i];
    if(s.z <= 0.0) continue;
    vec2 d = vP - s.xy; float u2 = dot(d, d);
    float xa = 0.09 + u2, xc = 0.0036 + u2;
    float aile = 2.23 * inversesqrt(xa) * inversesqrt(sqrt(xa)) * (1.0 - smoothstep(9.0, 17.5, sqrt(u2)));
    float coeur = 0.2 / (xc*xc*xc);
    E += s.z * (aile*uAile + coeur);
  }
  // saturation de la pellicule par canal : blanc là où c'est fort, orangé dans les ailes
  gl_FragColor = vec4(1.0 - exp(-E * uTeinte * vec3(1.0, 0.75, 0.45)), 1.0);
}`;

function creerEblouissement(){
  // bandes : [r0, r1, secteurs, sous-pas radiaux, sous-pas angulaires par secteur]
  for(const [r0, r1, n, nr, na] of [[0, 0.4, 1, 4, 16], [0.4, 0.75, 12, 4, 4], [0.75, 1, 36, 4, 3]]){
    for(let k = 0; k < n; k++){
      const c = ECL.cellules.length;
      ECL.cellules.push({x:0, y:0, w:0, xP:0, yP:0, wP:0});
      for(let i = 0; i < nr; i++) for(let j = 0; j < na; j++){
        const r = r0 + (r1 - r0)*(i + 0.5)/nr, a = 2*Math.PI*(k + (j + 0.5)/na)/n;
        const L = 1 - 0.6*(1 - Math.sqrt(Math.max(0, 1 - r*r)));          // assombrissement centre-bord
        ECL.sous.push({x:r*Math.cos(a), y:r*Math.sin(a), w:r*L*(r1 - r0)/nr/(na*n), c});
      }
    }
  }
  if(ECL.cellules.length !== ECL.N) throw new Error('Éblouissement : ' + ECL.cellules.length + ' cellules au lieu de ' + ECL.N);
  // disque entier visible : barycentres et poids pleins, calculés une fois (cas de presque toutes les trames)
  let tot = 0;
  for(const s of ECL.sous){ const c = ECL.cellules[s.c]; c.xP += s.w*s.x; c.yP += s.w*s.y; c.wP += s.w; tot += s.w; }
  for(const c of ECL.cellules){ c.xP /= c.wP; c.yP /= c.wP; c.wP /= tot; }
  ECL.uEch = {value:ECL.cellules.map(() => new THREE.Vector3())};
  ECL.uDemi = {value:1};
  ECL.uTeinte = {value:new THREE.Vector3(1, 1, 1)};
  ECL.uAile = {value:1};
  ECL.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader:GLSL_ECL_VS, fragmentShader:GLSL_ECL_FS,
    uniforms:{uEch:ECL.uEch, uDemi:ECL.uDemi, uTeinte:ECL.uTeinte, uAile:ECL.uAile},
    blending:THREE.AdditiveBlending, depthTest:false, depthWrite:false, transparent:true}));
  ECL.mesh.frustumCulled = false;
  ECL.mesh.renderOrder = 20;                                // par-dessus tout : il naît dans l'objectif
  SOL.groupe.add(ECL.mesh);
}

// Aire commune de deux disques (rayons a, b, centres distants de d), formule exacte.
function aireLentille(a, b, d){
  if(d >= a + b) return 0;
  if(d <= Math.abs(a - b)) return Math.PI*Math.min(a, b)**2;
  const ca = Math.max(-1, Math.min(1, (d*d + a*a - b*b)/(2*d*a)));
  const cb = Math.max(-1, Math.min(1, (d*d + b*b - a*a)/(2*d*b)));
  return a*a*Math.acos(ca) + b*b*Math.acos(cb) - 0.5*Math.sqrt(Math.max(0, (-d+a+b)*(d+a-b)*(d-a+b)*(d+a+b)));
}

const _ePos = new THREE.Vector3(), _eR = new THREE.Vector3(), _eU = new THREE.Vector3();
const _eM = new THREE.Vector3(), _eT = new THREE.Vector3(), _eX = new THREE.Vector3();
const angleEntre = (a, b) => Math.atan2(_eX.crossVectors(a, b).length(), a.dot(b));
const lisseEcl = (a, b, x) => { const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };

/* À chaque trame, pour la caméra qui dessine : part visible du disque, et source équivalente de chaque cellule.
   Renvoie la part du Soleil laissée par la seule Lune (la couronne en dépend). */
function majEblouissement(cam){
  cam.updateMatrixWorld();
  const P = cam.getWorldPosition(_ePos), S = ETAT.S, rs = ETAT.rSol, trs = Math.tan(rs);
  ECL.uDemi.value = CFG.SUN_D*trs*ECL.DEMI;

  // Lune et Terre vues de l'observateur : direction, rayon apparent, écart au Soleil
  _eM.copy(LUNE.mesh.position).sub(P); const rm = Math.asin(Math.min(1, CFG.R_LUNE/_eM.length())); _eM.normalize();
  const dp = P.length(); _eT.copy(P).negate().divideScalar(dp); const rt = Math.asin(Math.min(1, CFG.R/dp));
  const sepM = angleEntre(S, _eM), sepT = angleEntre(S, _eT);
  const fLune  = 1 - aireLentille(rs, rm, sepM)/(Math.PI*rs*rs);
  const fTerre = 1 - aireLentille(rs, rt, sepT)/(Math.PI*rs*rs);
  const part = fLune*fTerre;                                 // les deux à la fois : rare, produit approché
  ECL.mesh.visible = part > 0;
  // le voile large (aile) sur le disque lunaire s'atténue quand l'éclipse avance : plein hors éclipse, ~35 % à l'approche de la
  // totalité (sinon il noie la Lune d'un beige uniforme). Le cœur raide (anneau de diamant) n'est pas touché.
  ECL.uAile.value = 0.35 + 0.65*part*part;
  if(part <= 0) return fLune;

  if(fLune >= 1 && fTerre >= 1){                             // rien devant le Soleil
    ECL.cellules.forEach((c, i) => ECL.uEch.value[i].set(c.xP, c.yP, c.wP));
    return fLune;
  }

  // base du panneau : axes droite / haut de la caméra, rendus perpendiculaires au Soleil
  const e = cam.matrixWorld.elements;
  _eR.set(e[0], e[1], e[2]); _eR.addScaledVector(S, -S.dot(_eR));
  if(_eR.lengthSq() < 1e-8) _eR.crossVectors(S, _eU.set(e[4], e[5], e[6]));
  _eR.normalize(); _eU.crossVectors(_eR, S);
  // dans ce plan (en rs) : la Lune est un disque, le limbe terrestre (≈ 70° de rayon) une droite
  const kM = 1/(_eM.dot(S)*trs), mx = _eM.dot(_eR)*kM, my = _eM.dot(_eU)*kM, mr2 = (rm/rs)**2;
  const tl = Math.hypot(_eT.dot(_eR), _eT.dot(_eU)) || 1, tx = _eT.dot(_eR)/tl, ty = _eT.dot(_eU)/tl, td = (sepT - rt)/rs;

  for(const c of ECL.cellules){ c.x = c.y = c.w = 0; }
  let somme = 0;
  for(const s of ECL.sous){
    if(fLune < 1 && (s.x - mx)**2 + (s.y - my)**2 < mr2) continue;
    if(fTerre < 1 && s.x*tx + s.y*ty > td) continue;
    const c = ECL.cellules[s.c]; c.x += s.w*s.x; c.y += s.w*s.y; c.w += s.w; somme += s.w;
  }
  if(somme > 0){
    const k = part/somme;                                    // la part exacte, répartie comme les sous-échantillons visibles
    ECL.cellules.forEach((c, i) => c.w > 0 ? ECL.uEch.value[i].set(c.x/c.w, c.y/c.w, c.w*k) : ECL.uEch.value[i].set(0, 0, 0));
  }else{
    // croissant plus fin que les sous-échantillons (anneau de diamant) : toute la lumière au point du limbe le plus éloigné du masque
    let px = -mx, py = -my;
    if(fTerre < 1 && fLune >= 1){ px = -tx; py = -ty; }
    const l = Math.hypot(px, py) || 1;
    ECL.uEch.value.forEach(v => v.set(0, 0, 0));
    ECL.uEch.value[0].set(px/l, py/l, part);
  }
  return fLune;
}
