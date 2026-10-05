// File: js/lune.js
// Desc: Lune : sphère à la direction calculée pour la date, carte réelle (lune.jpg), éclairée par le Soleil (phase), face visible vers la Terre.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const LUNE = {};

/* Éclairage propre : la Lune n'a pas d'ombre de la Terre dans cette scène et ne doit pas s'éteindre quand l'ISS passe
   dans l'ombre (la lumière directionnelle est coupée de nuit pour assombrir la station) ; on éclaire donc
   par un shader, avec la direction du Soleil seule : c'est ce qui dessine la phase. */
const GLSL_LUNE_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GLSL_LUNE_FS = `
uniform sampler2D uTex; uniform vec3 uSun; uniform float uRT; uniform float uRS;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
// Éclipse de Lune : part du Soleil visible depuis ce point de la Lune, la Terre (au centre de la scène) faisant écran.
float lumiereSoleilLune(vec3 Q){
  float dq = length(Q); vec3 e = -Q/dq;                   // direction de la Terre
  if(dot(e, uSun) <= 0.0) return 1.0;
  float rs = uRS, re = asin(min(1.0, 1.02*uRT/dq));   // 1,02 : l'atmosphère agrandit l'ombre
  float sep = asin(min(1.0, length(cross(e, uSun))));
  if(sep >= rs + re) return 1.0;
  return 1.0 - smoothstep(0.0, 1.0, clamp((rs + re - sep)/(2.0*rs), 0.0, 1.0));
}
void main(){
  vec3 n = normalize(vN);
  float d = dot(n, uSun);
  float lit = smoothstep(0.0, 0.06, d);                                  // terminateur net : pas d'atmosphère
  vec3 t = clamp((texture2D(uTex, vUv).rgb - 0.22) / 0.48, 0.0, 1.0);   // contraste : mers ≈ ½ des hautes terres, comme à l'œil
  float s = lumiereSoleilLune(vW);
  // dans l'ombre, la Lune n'est pas noire : la lumière réfractée par l'atmosphère terrestre (tous les couchers de Soleil
  // de la Terre) la teinte en rouge cuivré — la « Lune de sang »
  vec3 eclairage = vec3(s) + (1.0 - s) * vec3(0.42, 0.13, 0.05) * 0.55;
  vec3 c = t * (lit * (0.35 + 0.85*max(d, 0.0)) * eclairage + 0.025);      // + lumière cendrée très faible
  gl_FragColor = vec4(c, 1.0);
}`;

function creerLune(texture){
  LUNE.mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.R_LUNE, 64, 40),          // taille réelle : 0,27 × la Terre
    new THREE.ShaderMaterial({vertexShader:GLSL_LUNE_VS, fragmentShader:GLSL_LUNE_FS,
      uniforms:{uTex:{value:texture}, uSun:{value:new THREE.Vector3(1,0,0)}, uRT:{value:CFG.R}, uRS:TERRE.uRS}}));
  scene.add(LUNE.mesh);

  // vue éloignée : à l'échelle, la Lune est minuscule ; un anneau de taille d'écran constante la signale
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d'); cx.strokeStyle = '#d8dde6'; cx.lineWidth = 3; cx.beginPath(); cx.arc(32, 32, 26, 0, 2*Math.PI); cx.stroke();
  LUNE.marque = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv), sizeAttenuation:false, depthTest:false, transparent:true}));
  LUNE.marque.scale.setScalar(0.035); LUNE.marque.renderOrder = 10;
  scene.add(LUNE.marque);

  // orbite de la Lune : cercle de rayon LUNE_D dans le plan de l'écliptique (à 5° près), visible en vue Terre–Lune
  const pts = [];
  for(let i=0;i<=180;i++){ const a = i/180*2*Math.PI; pts.push(new THREE.Vector3(Math.cos(a)*CFG.LUNE_D, 0, Math.sin(a)*CFG.LUNE_D)); }
  LUNE.orbite = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:0x5b6a90}));
  scene.add(LUNE.orbite);
}

const _lx = new THREE.Vector3(), _ly = new THREE.Vector3(), _lz = new THREE.Vector3(), _lm = new THREE.Matrix4();
// À chaque trame : la date peut défiler (13°/jour).
function majLune(){
  LUNE.mesh.position.copy(ETAT.M).multiplyScalar(ETAT.Mdist);                 // distance du jour (356 000 à 407 000 km)
  LUNE.mesh.material.uniforms.uSun.value.copy(ETAT.S);
  // face visible (longitude 0, +X du maillage) vers la Terre ; nord de la Lune = nord écliptique
  _lx.copy(ETAT.M).negate();
  _ly.copy(ETAT.Mnord).addScaledVector(_lx, -ETAT.Mnord.dot(_lx)).normalize();
  _lz.crossVectors(_lx, _ly);
  LUNE.mesh.quaternion.setFromRotationMatrix(_lm.makeBasis(_lx, _ly, _lz));

  const iss = ETAT.vue === 'iss', lune = !iss && VUE_EXT.mode === 'lune';
  LUNE.marque.visible = !iss; LUNE.marque.position.copy(LUNE.mesh.position);
  LUNE.orbite.visible = lune;
  LUNE.orbite.quaternion.setFromUnitVectors(_ly.set(0, 1, 0), ETAT.Mnord);
}
