// File: js/soleil.js
// Desc: Soleil : disque, halo et lumière directionnelle (direction fixe dans le repère inertiel).
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const SOL = {dir:new THREE.Vector3(1,0,0)};

function creerSoleil(){
  SOL.groupe = new THREE.Group();
  const rayon = CFG.SUN_D*Math.tan(CFG.SUN_ANG);
  SOL.disque = new THREE.Mesh(new THREE.SphereGeometry(rayon, 24, 16),
    new THREE.MeshBasicMaterial({color:0xfff3c4}));
  SOL.groupe.add(SOL.disque);

  // halo : dégradé radial additif
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const cx = cv.getContext('2d');
  const g = cx.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(255,250,230,1)'); g.addColorStop(.05,'rgba(255,240,200,.95)'); g.addColorStop(.14,'rgba(255,215,140,.45)');
  g.addColorStop(.4,'rgba(255,170,80,.12)'); g.addColorStop(1,'rgba(255,150,50,0)');
  cx.fillStyle = g; cx.fillRect(0,0,256,256);
  SOL.halo = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),
    blending:THREE.AdditiveBlending, depthWrite:false, transparent:true}));
  SOL.halo.scale.setScalar(rayon*34);          // éblouissement : environ 9° de large
  SOL.groupe.add(SOL.halo);
  scene.add(SOL.groupe);

  SOL.lumiere = new THREE.DirectionalLight(0xffffff, 2.5);
  scene.add(SOL.lumiere);
  scene.add(new THREE.AmbientLight(0x404858, 0.5));
  majSoleil();
}

// Le Soleil rougit en rasant l'atmosphère : teinte selon sa hauteur au-dessus du limbe vu de la caméra ISS.
const _nad = new THREE.Vector3();
function colorerSoleil(){
  let chaud = 0;
  if(ETAT.vue === 'iss'){
    _nad.copy(ISS.groupe.position).negate().normalize();
    const hauteur = Math.acos(Math.max(-1, Math.min(1, _nad.dot(SOL.dir))))/DEG - Math.asin(CFG.R/CFG.R_ORB)/DEG;   // ° au-dessus du limbe
    chaud = Math.max(0, Math.min(1, 1 - hauteur/6));
  }
  SOL.disque.material.color.setRGB(1, 1.0 - 0.25*chaud, 0.92 - 0.45*chaud);   // blanc-chaud, un peu rouge au ras de l'horizon
  SOL.halo.material.color.setRGB(1, 1 - 0.45*chaud, 1 - 0.8*chaud);
}

// À rappeler quand le Soleil bouge.
function majSoleil(){
  dirSoleil(SOL.dir);
  SOL.groupe.position.copy(SOL.dir).multiplyScalar(CFG.SUN_D);
  SOL.lumiere.position.copy(SOL.dir).multiplyScalar(CFG.SUN_D);
  SOL.lumiere.target.position.set(0,0,0); SOL.lumiere.target.updateMatrixWorld();
  if(TERRE.uSun) TERRE.uSun.value.copy(SOL.dir);
}

/* Part de la lumière solaire reçue en P quand un corps sphérique (centre C, rayon Rc) s'interpose :
   recouvrement des disques apparents (Soleil 0,265°, corps asin(Rc/d)). Même formule que les shaders de la Terre et de la Lune. */
const ORIGINE = new THREE.Vector3();
const _pv = new THREE.Vector3(), _pc = new THREE.Vector3();
function partSoleil(P, C, Rc){
  _pv.copy(C).sub(P); const d = _pv.length(); _pv.divideScalar(d);
  if(_pv.dot(ETAT.S) <= 0) return 1;
  const rs = ETAT.rSol, rc = Math.asin(Math.min(1, Rc/d));
  const sep = Math.asin(Math.min(1, _pc.crossVectors(_pv, ETAT.S).length()));
  if(sep >= rs + rc) return 1;
  const k = Math.min(1, Math.max(0, (rs + rc - sep)/(2*Math.min(rs, rc)))), l = k*k*(3 - 2*k);
  return 1 - Math.min(1, rc*rc/(rs*rs))*l;
}

/* Éclipse de Lune : magnitude d'ombre = part du diamètre lunaire plongée dans l'ombre de la Terre (≥ 1 : totale).
   Rayon de l'ombre à la distance de la Lune ≈ 1,02·R − d·(rayon apparent du Soleil) ; le 1,02 est l'agrandissement
   dû à l'atmosphère terrestre (règle de Danjon). Pénombre : 1,02·R + d·(rayon du Soleil). */
const _ax = new THREE.Vector3();
function eclipseLune(){
  const M = LUNE.mesh.position, d = M.length();
  if(M.dot(ETAT.S) >= 0) return {ombre:-1, penombre:-1};                 // la Lune n'est pas du côté nuit
  const D = _ax.crossVectors(M, ETAT.S).length();                          // distance de la Lune à l'axe de l'ombre
  const U = 1.02*CFG.R - d*ETAT.rSol, P = 1.02*CFG.R + d*ETAT.rSol, r = CFG.R_LUNE;
  return {ombre:(U + r - D)/(2*r), penombre:(P + r - D)/(2*r)};
}
