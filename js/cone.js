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
}

function majCone(){
  const w = Math.tan(VUE_ISS.fov*DEG/2)*CONE.L;
  CONE.groupe.scale.set(w, w, CONE.L);
  CONE.groupe.visible = ETAT.montrer.cone && ETAT.vue !== 'iss';   // en vue ISS, on est dedans
}
