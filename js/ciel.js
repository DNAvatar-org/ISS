// File: js/ciel.js
// Desc: Voûte céleste à l'infini : sphère externe (lueur diffuse de la Voie lactée) + étoiles ponctuelles de taille fixe à l'écran.
// Version 2.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Une étoile est un point : vue de près ou au téléobjectif, elle reste un point (1 à 3 pixels), elle ne grossit pas.
   Les peindre dans une texture leur donnait une taille angulaire (≈ 0,1°) : au zoom, elles devenaient des taches
   plus grosses que la Lune. Elles sont donc dessinées en THREE.Points à taille constante en pixels.
   La sphère ne garde que la lueur diffuse de la Voie lactée (qui, elle, a une étendue et peut se flouter au zoom).
   Tout le groupe suit la caméra : la voûte est à l'infini, sans parallaxe, quelle que soit la vue. */
const CIEL = {groupe:null, sphere:null, points:null, uExpo:{value:1}, uPx:{value:1}};

const GLSL_ETOILES_VS = `
attribute float aTaille; attribute vec3 aCouleur;
uniform float uPx;
varying vec3 vC;
void main(){
  vC = aCouleur;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aTaille * uPx;
}`;
const GLSL_ETOILES_FS = `
uniform float uExpo;
varying vec3 vC;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.35, 1.0, r);           // cœur net, bord doux
  gl_FragColor = vec4(vC * a * uExpo, 1.0);
}`;

const TEINTES = [[0.61,0.69,1.0],[0.79,0.84,1.0],[0.97,0.97,1.0],[1.0,0.96,0.92],[1.0,0.82,0.63],[1.0,0.71,0.42]];

function aleaDir(v){
  do v.set(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1); while(v.lengthSq() > 1 || v.lengthSq() < 1e-4);
  return v.normalize();
}

// Bande de Voie lactée : grand cercle incliné (repère inertiel), même définition pour la lueur et les étoiles.
const VL_G = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
const VL_A = new THREE.Vector3().crossVectors(VL_G, new THREE.Vector3(1,0,0)).normalize();
const VL_B = new THREE.Vector3().crossVectors(VL_G, VL_A);
function dirVoieLactee(v, ecart){
  const psi = Math.random()*2*Math.PI, h = (Math.random()+Math.random()+Math.random()-1.5)*ecart;
  return v.copy(VL_A).multiplyScalar(Math.cos(psi)).addScaledVector(VL_B, Math.sin(psi)).addScaledVector(VL_G, h).normalize();
}

function creerCiel(){
  CIEL.groupe = new THREE.Group();
  scene.add(CIEL.groupe);

  // --- lueur diffuse (texture équirectangulaire, même paramétrage que SphereGeometry)
  const W = 4096, Ht = 2048, cv = document.createElement('canvas'); cv.width = W; cv.height = Ht;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#000005'; cx.fillRect(0, 0, W, Ht);
  const d = new THREE.Vector3();
  for(let i=0;i<40000;i++){
    dirVoieLactee(d, 0.30);
    const th = Math.acos(Math.max(-1, Math.min(1, d.y)));
    let ph = Math.atan2(d.z, -d.x); if(ph < 0) ph += 2*Math.PI;
    const r = 2 + Math.random()*4, etire = Math.min(8, 1/Math.max(0.12, Math.sin(th)));
    cx.globalAlpha = 0.006 + 0.008*Math.random();             // lueur faible : à peine visible, comme à l'œil
    cx.fillStyle = '#c8cfe6';
    cx.beginPath(); cx.ellipse(ph/(2*Math.PI)*W, th/Math.PI*Ht, r*etire, r, 0, 0, 2*Math.PI); cx.fill();
  }
  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  CIEL.sphere = new THREE.Mesh(new THREE.SphereGeometry(CFG.SKY_R, 64, 32),
    new THREE.MeshBasicMaterial({map:tex, side:THREE.BackSide, depthWrite:false}));
  CIEL.sphere.renderOrder = -10;
  CIEL.groupe.add(CIEL.sphere);

  // --- étoiles : 9 000 de fond + 6 000 dans la bande ; peu de brillantes, beaucoup de faibles
  const N1 = 9000, N2 = 6000, N = N1 + N2;
  const pos = new Float32Array(N*3), col = new Float32Array(N*3), taille = new Float32Array(N);
  const R = CFG.SKY_R*0.94;
  for(let i=0;i<N;i++){
    if(i < N1) aleaDir(d); else dirVoieLactee(d, 0.22);
    d.multiplyScalar(R).toArray(pos, i*3);
    const b = Math.pow(Math.random(), i < N1 ? 4 : 6);          // éclat : distribution très inégale
    const t = TEINTES[(Math.random()*TEINTES.length)|0], lum = 0.35 + 0.65*b;
    col[i*3] = t[0]*lum; col[i*3+1] = t[1]*lum; col[i*3+2] = t[2]*lum;
    taille[i] = 1.4 + 2.6*b;                                      // pixels CSS
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCouleur', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aTaille',  new THREE.BufferAttribute(taille, 1));
  CIEL.uPx.value = renderer.getPixelRatio();
  CIEL.points = new THREE.Points(g, new THREE.ShaderMaterial({vertexShader:GLSL_ETOILES_VS, fragmentShader:GLSL_ETOILES_FS,
    uniforms:{uExpo:CIEL.uExpo, uPx:CIEL.uPx}, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
  CIEL.points.frustumCulled = false;
  CIEL.points.renderOrder = -9;
  CIEL.groupe.add(CIEL.points);
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
