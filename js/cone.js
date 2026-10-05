// File: js/cone.js
// Desc: Cône d'ouverture de la caméra : pyramide à base carrée, sommet à l'ISS, angle donné par la focale.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Pyramide unitaire (sommet à l'origine, base carrée de demi-côté 1 à z = −1), enfant de camIss :
   elle suit donc l'orientation de la caméra. On l'étire à chaque trame :
   demi-côté de base = L·tan(fov/2), longueur L. */
const CONE = {L:90};
const FOC_REF = 12;            // demi-hauteur du capteur 24×36 mm (mm)
const FOV_MAX = 160;           // champ maximal en vue ISS (≈ 2 mm) : très grand angle, sans passer en vue Terre

const focaleDepuisFov = fov => FOC_REF/Math.tan(fov*DEG/2);
const fovDepuisFocale = f   => 2*Math.atan(FOC_REF/f)/DEG;

function creerCone(){
  const A = new THREE.Vector3(0,0,0);
  const c = [[1,1],[-1,1],[-1,-1],[1,-1]].map(([x,y]) => new THREE.Vector3(x,y,-1));
  const pts = [];
  for(let i=0;i<4;i++) pts.push(A, c[i], c[(i+1)%4]);       // 4 faces latérales
  pts.push(c[0], c[1], c[2], c[0], c[2], c[3]);              // base carrée
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  CONE.groupe = new THREE.Group();
  CONE.groupe.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({color:0xffd24a, transparent:true, opacity:0.10,
    side:THREE.DoubleSide, depthWrite:false})));
  CONE.groupe.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 1),
    new THREE.LineBasicMaterial({color:0xffd24a})));
  camIss.add(CONE.groupe);
  // frontière du champ sur la Terre : le contour du champ carré projeté sur le globe (au limbe quand le rayon rate la Terre)
  CONE.nb = 12;
  CONE.sol = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:4*CONE.nb}, () => new THREE.Vector3())),
    new THREE.LineBasicMaterial({color:0xffa14a, depthTest:false, transparent:true}));
  CONE.sol.renderOrder = 8; CONE.sol.frustumCulled = false;
  scene.add(CONE.sol);
}

const _co = new THREE.Vector3(), _cd = new THREE.Vector3();
function majFrontiereCone(){
  camIss.updateMatrixWorld(true);
  _co.setFromMatrixPosition(camIss.matrixWorld);
  const t = Math.tan(VUE_ISS.fov*DEG/2), n = CONE.nb, pos = CONE.sol.geometry.attributes.position, R = CFG.R;
  for(let k=0;k<4*n;k++){
    const a = (k%n)/n*2 - 1, c = Math.floor(k/n);
    const [x, y] = c === 0 ? [a, -1] : c === 1 ? [1, a] : c === 2 ? [-a, 1] : [-1, -a];
    _cd.set(x*t, y*t, -1).transformDirection(camIss.matrixWorld);          // direction monde, unitaire
    const b = _co.dot(_cd), disc = b*b - (_co.lengthSq() - R*R);
    const pt = disc >= 0 && -b - Math.sqrt(disc) > 0
      ? _co.clone().addScaledVector(_cd, -b - Math.sqrt(disc))             // le rayon touche la Terre
      : _co.clone().addScaledVector(_cd, Math.max(0, -b));                 // sinon : point du limbe le plus proche
    pt.setLength(R*1.003);
    pos.setXYZ(k, pt.x, pt.y, pt.z);
  }
  pos.needsUpdate = true;
}

function majCone(){
  const w = Math.tan(VUE_ISS.fov*DEG/2)*CONE.L;
  CONE.groupe.scale.set(w, w, CONE.L);
  CONE.groupe.visible = ETAT.montrer.cone && ETAT.vue !== 'iss';   // en vue ISS, on est dedans
  CONE.sol.visible = CONE.groupe.visible;
  if(CONE.sol.visible) majFrontiereCone();
}
