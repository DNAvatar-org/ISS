// File: js/ciel.js
// Desc: Voûte céleste à l'infini : vraies étoiles (catalogue BSC) de taille fixe à l'écran + lueur de la Voie lactée, à leur place réelle.
// Version 3.0.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Une étoile est un point : vue de près ou au téléobjectif, elle reste un point (1 à 3 pixels), elle ne grossit pas.
   Les peindre dans une texture leur donnait une taille angulaire (≈ 0,1°) : au zoom, elles devenaient des taches
   plus grosses que la Lune. Elles sont donc dessinées en THREE.Points à taille constante en pixels.
   La sphère ne garde que la lueur diffuse de la Voie lactée (qui, elle, a une étendue et peut se flouter au zoom).
   Tout le groupe suit la caméra : la voûte est à l'infini, sans parallaxe, quelle que soit la vue.
   Le ciel est le VRAI : les 8 400 étoiles du Yale Bright Star Catalogue (etoiles-data.js, J2000) à leur place, et la
   Voie lactée sur le plan galactique réel. Étoiles et lueur sont dans un sous-groupe « équatorial » (repère J2000)
   tourné à chaque trame vers la scène : précession jusqu'à la date, puis ETAT.vers. Une photo prise depuis l'ISS se
   retrouve donc étoile pour étoile (et c'est ce qui permet d'en déduire la visée). */
const CIEL = {groupe:null, equat:null, sphere:null, points:null, uExpo:{value:1}, uPx:{value:1}, uCalque:{value:0}, testees:null};

// uCalque = 1 quand une photo est superposée (Check Photo) : étoiles ×2 et plus vives, dans leur couleur (la photo, posée
// longtemps à f/1,2 et 12 800 ISO, montre des étoiles jusqu'à la magnitude ~9, en taches). Les marques vertes sont sur la
// photo (cercles autour de ses étoiles reconnues, encart.js) : une étoile de la simulation doit tomber dans chaque cercle.
const GLSL_ETOILES_VS = `
attribute float aTaille; attribute vec3 aCouleur;
uniform float uPx, uCalque;
varying vec3 vC;
void main(){
  vC = aCouleur;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aTaille * uPx * (1.0 + uCalque);
}`;
const GLSL_ETOILES_FS = `
uniform float uExpo, uCalque;
varying vec3 vC;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.35, 1.0, r);           // cœur net, bord doux
  vec3 c = vC * (1.0 + 0.8*uCalque);
  gl_FragColor = vec4(c * a * uExpo, 1.0);
}`;

const TEINTES = [[0.61,0.69,1.0],[0.79,0.84,1.0],[0.97,0.97,1.0],[1.0,0.96,0.92],[1.0,0.82,0.63],[1.0,0.71,0.42]];

// Équatorial J2000 (x vers γ, z vers le pôle Nord) d'une direction (RA, Dec en degrés).
const dirEquat = (ra, de, v) => v.set(Math.cos(de*DEG)*Math.cos(ra*DEG), Math.cos(de*DEG)*Math.sin(ra*DEG), Math.sin(de*DEG));
// Plan galactique réel (J2000) : pôle nord galactique (RA 192,859°, Dec +27,128°), centre galactique (266,405°, −28,936°).
const VL_G = dirEquat(192.85948, 27.12825, new THREE.Vector3());
const VL_A = dirEquat(266.40500, -28.93617, new THREE.Vector3());
const VL_B = new THREE.Vector3().crossVectors(VL_G, VL_A);
// Direction au hasard dans la bande, plus dense et plus épaisse vers le centre galactique (bulbe du Sagittaire).
function dirVoieLactee(v, ecart){
  const psi = Math.random() < 0.5 ? Math.random()*2*Math.PI : (Math.random()+Math.random()+Math.random()-1.5)*1.6;
  const h = (Math.random()+Math.random()+Math.random()-1.5)*ecart*(1 + 1.2*Math.exp(-psi*psi/0.5));
  return v.copy(VL_A).multiplyScalar(Math.cos(psi)).addScaledVector(VL_B, Math.sin(psi)).addScaledVector(VL_G, h).normalize();
}
// Teinte d'après la température (K) : bleues chaudes → orangées froides.
const teinteK = K => TEINTES[K > 20000 ? 0 : K > 10000 ? 1 : K > 7500 ? 2 : K > 6000 ? 3 : K > 4500 ? 4 : 5];

function creerCiel(){
  CIEL.groupe = new THREE.Group();
  scene.add(CIEL.groupe);
  CIEL.equat = new THREE.Group();                  // repère J2000, orienté à chaque trame (majCiel)
  CIEL.groupe.add(CIEL.equat);

  // --- lueur diffuse de la Voie lactée, calculée pixel par pixel en coordonnées galactiques (b, l) : bande lisse,
  // plus large et plus brillante vers le centre (bulbe du Sagittaire). Paramétrage = celui de SphereGeometry :
  // d = (−cos φ sin θ, cos θ, sin φ sin θ), θ = colatitude, φ = longitude de la texture ; repère local = J2000.
  const W = 1024, Ht = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = Ht;
  const cx = cv.getContext('2d'), img = cx.createImageData(W, Ht), px = img.data;
  const d = new THREE.Vector3();
  for(let j=0;j<Ht;j++){
    const th = (j + 0.5)/Ht*Math.PI;
    for(let i=0;i<W;i++){
      const ph = (i + 0.5)/W*2*Math.PI;
      d.set(-Math.cos(ph)*Math.sin(th), Math.cos(th), Math.sin(ph)*Math.sin(th));
      const b = Math.asin(Math.max(-1, Math.min(1, d.dot(VL_G)))), l = Math.atan2(d.dot(VL_B), d.dot(VL_A));
      const centre = Math.exp(-l*l/0.8), larg = 0.10 + 0.12*centre;
      const v = (0.35 + 0.65*centre)*Math.exp(-b*b/(larg*larg)) + 0.04*Math.exp(-b*b/0.3);
      const k = 4*(j*W + i), c = 4 + 26*v;                         // fond #000005 → lueur gris bleuté faible
      px[k] = c*0.78; px[k+1] = c*0.81; px[k+2] = 5 + c*0.9; px[k+3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  CIEL.sphere = new THREE.Mesh(new THREE.SphereGeometry(CFG.SKY_R, 64, 32),
    new THREE.MeshBasicMaterial({map:tex, side:THREE.BackSide, depthWrite:false}));
  CIEL.sphere.renderOrder = -10;
  CIEL.equat.add(CIEL.sphere);

  // --- étoiles : le catalogue (V ≤ 6,5), plus 6 000 très faibles dans la bande pour le grain de la Voie lactée
  const NC = ETOILES.length/4, NB = 6000, N = NC + NB;
  const pos = new Float32Array(N*3), col = new Float32Array(N*3), taille = new Float32Array(N);
  const R = CFG.SKY_R*0.94;
  for(let i=0;i<N;i++){
    let b, t;
    if(i < NC){
      const k = 4*i;
      dirEquat(ETOILES[k]/1000, ETOILES[k+1]/1000, d);
      b = Math.pow(Math.max(0, Math.min(1, (6.8 - ETOILES[k+2]/100)/8)), 1.6);   // V = −1,5 (Sirius) → 1 ; V = 6,5 → ~0
      t = teinteK(ETOILES[k+3]*100);
    }else{
      dirVoieLactee(d, 0.22);
      b = 0; t = TEINTES[(Math.random()*TEINTES.length)|0];
    }
    d.multiplyScalar(R).toArray(pos, i*3);
    const lum = i < NC ? 0.45 + 0.55*b : 0.15 + 0.15*Math.random();
    col[i*3] = t[0]*lum; col[i*3+1] = t[1]*lum; col[i*3+2] = t[2]*lum;
    taille[i] = i < NC ? 1.6 + 4.4*b : 1.2;                       // pixels CSS
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCouleur', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aTaille',  new THREE.BufferAttribute(taille, 1));
  CIEL.uPx.value = renderer.getPixelRatio();
  CIEL.points = new THREE.Points(g, new THREE.ShaderMaterial({vertexShader:GLSL_ETOILES_VS, fragmentShader:GLSL_ETOILES_FS,
    uniforms:{uExpo:CIEL.uExpo, uPx:CIEL.uPx, uCalque:CIEL.uCalque}, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
  CIEL.points.frustumCulled = false;
  CIEL.points.renderOrder = -9;
  CIEL.equat.add(CIEL.points);
}

// Étoiles du catalogue appariées aux étoiles de la photo (Check Photo, astrometrie.js) : points rouges ronds, montrés
// avec le calque (encart.js), dont les cercles verts entourent les étoiles de la photo : un point rouge dans chaque cercle.
const GLSL_TESTEES_VS = `uniform float uPx; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 6.0 * uPx; }`;
const GLSL_TESTEES_FS = `void main(){ if(length(gl_PointCoord - 0.5) > 0.5) discard; gl_FragColor = vec4(1.0, 0.15, 0.1, 1.0); }`;
function marquerEtoilesTestees(indices){
  if(CIEL.testees){ CIEL.equat.remove(CIEL.testees); CIEL.testees.geometry.dispose(); CIEL.testees.material.dispose(); CIEL.testees = null; }
  if(!indices.length) return;
  const pos = new Float32Array(indices.length*3), d = new THREE.Vector3();
  indices.forEach((i, n) => dirEquat(ETOILES[4*i]/1000, ETOILES[4*i+1]/1000, d).multiplyScalar(CFG.SKY_R*0.93).toArray(pos, n*3));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  CIEL.testees = new THREE.Points(g, new THREE.ShaderMaterial({vertexShader:GLSL_TESTEES_VS, fragmentShader:GLSL_TESTEES_FS,
    uniforms:{uPx:CIEL.uPx}, depthWrite:false}));
  CIEL.testees.frustumCulled = false;
  CIEL.testees.renderOrder = -8;
  CIEL.testees.visible = CIEL.uCalque.value > 0;
  CIEL.equat.add(CIEL.testees);
}

// Repère J2000 → scène à la date : colonnes = images des axes J2000 (précession, puis équatorial de la date → scène).
const _ex = new THREE.Vector3(), _ey = new THREE.Vector3(), _ez = new THREE.Vector3(), _em = new THREE.Matrix4();
function orienterCiel(){
  const P = precession(unixDeJour(jourDate()));
  ETAT.vers([P[0][0], P[1][0], P[2][0]], _ex); ETAT.vers([P[0][1], P[1][1], P[2][1]], _ey); ETAT.vers([P[0][2], P[1][2], P[2][2]], _ez);
  CIEL.equat.quaternion.setFromRotationMatrix(_em.makeBasis(_ex, _ey, _ez));
}

/* Exposition : face au Soleil, l'éblouissement noie les étoiles (une caméra réglée pour le Soleil ne les voit pas).
   Dans la vue ISS seulement, et seulement si le Soleil est réellement visible : pas quand l'ISS est dans l'ombre
   de la Terre (il est derrière elle), ni pendant une éclipse totale. Il éblouit s'il est dans le cadre (demi-diagonale
   du champ) ; l'effet s'éteint 25° au-delà. Au grand-angle de nuit, les étoiles restent donc toutes là. */
const _cf = new THREE.Vector3(), _cp = new THREE.Vector3();
const lisseCiel = (a, b, x) => { const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };
function majCiel(){
  const cam = ETAT.vue === 'iss' ? camIss : camExt;
  CIEL.groupe.position.copy(cam.getWorldPosition(_cp));          // à l'infini : la voûte suit l'observateur
  orienterCiel();
  let k = 1;
  const visible = ETAT.nuitISS ? 0 : 1 - ETAT.ecl;
  if(ETAT.vue === 'iss' && visible > 0){
    camIss.getWorldDirection(_cf);
    const ang = Math.acos(Math.max(-1, Math.min(1, _cf.dot(SOL.dir))))/DEG;
    const demi = Math.atan(Math.tan(VUE_ISS.fov*DEG/2)*Math.hypot(1, camIss.aspect))/DEG;
    k = 1 - 0.98*(1 - lisseCiel(demi, demi + 25, ang))*visible;
  }
  CIEL.sphere.material.color.setScalar(k);
  CIEL.uExpo.value = k;
}
