// File: js/terre.js
// Desc: Terre jour/nuit (geoview.jpg + steamNight.jpg), atmosphère, trace de l'ISS au sol.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const TERRE = {};

/* Ombre de la Lune (éclipse de Soleil), partagée par le sol, les tuiles et l'atmosphère. */
const GLSL_ECLIPSE = `
uniform vec3 uLune; uniform float uRL; uniform float uRS;
// Part de la lumière solaire reçue en P (ombre de la Lune) : recouvrement des disques Soleil / Lune vus de P.
// Écart angulaire calculé par le produit vectoriel (précis aux petits angles, en flottants 32 bits).
float lumiereSoleil(vec3 P){
  vec3 m = uLune - P; float dm = length(m); m /= dm;
  if(dot(m, uSun) <= 0.0) return 1.0;
  float rs = uRS, rm = asin(min(1.0, uRL/dm));
  float sep = asin(min(1.0, length(cross(m, uSun))));
  if(sep >= rs + rm) return 1.0;
  float k = clamp((rs + rm - sep)/(2.0*min(rs, rm)), 0.0, 1.0);
  return 1.0 - min(1.0, (rm*rm)/(rs*rs)) * smoothstep(0.0, 1.0, k);
}`;

const GLSL_TERRE_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vUv = uv;
  vN = mat3(modelMatrix) * normal;
  vec4 w = modelMatrix * vec4(position,1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/* Jour : Lambert seul donnait une Terre sombre. Deux choses manquaient :
   – l'exposition : un œil ou un appareil s'adapte à la scène (gain ≈ 1,3, courbe adoucie aux soleils bas) ;
   – la brume du jour : l'air diffuse du bleu et éclaircit la Terre vue de l'espace, d'autant plus qu'on la voit
     en biais (épaisseur d'air traversée). Plus un liseré orange au terminateur. La nuit : lumières des villes. */
const GLSL_TERRE_FS = `
uniform sampler2D uJour, uNuit; uniform vec3 uSun;
${GLSL_ECLIPSE}
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float d = dot(n, uSun);
  float jour = smoothstep(-0.10, 0.18, d);
#ifdef FIN
  if(jour < 0.5) discard;                         // Sentinel-2 : jour seulement, la nuit GIBS reste dessous
#endif
  vec3 tJ = texture2D(uJour, vUv).rgb;
  vec3 cJ = tJ * (0.10 + 1.30*pow(max(d, 0.0), 0.7));
  // reflet du Soleil sur l'eau (l'eau se reconnaît à sa dominante bleue) : tache nette + halo large
  float eau = smoothstep(0.04, 0.14, tJ.b - max(tJ.r, tJ.g));
  float sp = max(dot(reflect(-uSun, n), v), 0.0);
  cJ += vec3(1.0, 0.95, 0.85) * eau * step(0.0, d) * (pow(sp, 300.0)*1.2 + pow(sp, 12.0)*0.18);
  float biais = 1.0 - max(dot(n, v), 0.0);
  cJ += vec3(0.30, 0.48, 0.85) * smoothstep(-0.05, 0.35, d) * (0.07 + 0.40*biais*biais);
  vec3 cN = texture2D(uNuit, vUv).rgb * 1.5;
  cJ *= lumiereSoleil(vW);                          // éclipse de Soleil : l'ombre de la Lune court sur la Terre
  vec3 c = mix(cN, cJ, jour);
  c += vec3(1.0, 0.45, 0.15) * exp(-pow(d/0.07, 2.0)) * 0.18;
  gl_FragColor = vec4(c, 1.0);
}`;

const GLSL_ATMO_VS = `
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position,1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vW = w.xyz;
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/* Le limbe vu de côté : l'altitude se lit dans |n·v| (0 au bord extérieur de la coque, ~0,18 au bord du globe).
   hh = 1 → bas de l'atmosphère, hh → 0 → haut. Le Soleil (lit = n·S, sa hauteur au limbe) colore par couches :
   de jour bleu ; au lever / coucher, du bas vers le haut rouge, orange, jaune-blanc, bleu (la fameuse « rainure » des photos) ;
   de nuit, la raie verte de la luminescence atmosphérique. */
const GLSL_ATMO_FS = `
uniform vec3 uSun;
${GLSL_ECLIPSE}
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  float rim = abs(dot(vN, vV));
  float hh  = rim/0.177;
  float dens = hh < 1.0 ? pow(hh, 2.0) : mix(1.0, 0.22, smoothstep(1.0, 2.2, hh));
  float lit  = dot(vN, uSun);

  float tw   = smoothstep(-0.28, 0.0, lit) * (1.0 - smoothstep(0.0, 0.40, lit));          // crépuscule : pic au terminateur
  float low  = smoothstep(0.55, 0.97, hh);
  float mid  = smoothstep(0.25, 0.65, hh) * (1.0 - low);
  float high = 1.0 - smoothstep(0.10, 0.50, hh);
  vec3 cTw  = low*vec3(1.0, 0.22, 0.04) + mid*vec3(1.0, 0.70, 0.28) + high*vec3(0.28, 0.52, 1.0);
  vec3 cJour = vec3(0.34, 0.60, 1.0) * (0.55 + 0.45*hh);
  float vert = exp(-pow((hh - 0.78)/0.12, 2.0));                                           // raie verte de nuit
  vec3 cNuit = vec3(0.20, 0.95, 0.35) * vert * 0.55;

  float jour = smoothstep(0.0, 0.45, lit);
  float nuit = 1.0 - smoothstep(-0.30, 0.0, lit);
  vec3 col = cJour*jour*(1.0 - tw) + cTw*tw + cNuit*nuit;

  // diffusion vers l'avant : plus chaud quand on regarde vers le Soleil
  float glare = pow(max(dot(-vV, uSun), 0.0), 6.0);
  col += vec3(1.0, 0.55, 0.15) * glare * 0.30 * (0.3 + 0.7*hh);

  col *= lumiereSoleil(vW);                       // dans l'ombre de la Lune, l'air n'est plus éclairé
  gl_FragColor = vec4(col * dens * 1.25, dens);
}`;

const TRACE_MAX = 4000, TRACE_PAS = 20;   // points, secondes simulées entre deux points

function creerTerre(tex){
  TERRE.uSun = {value:new THREE.Vector3(1,0,0)};
  TERRE.uLune = {value:new THREE.Vector3(0,0,CFG.LUNE_D)};
  TERRE.uRL = {value:CFG.R_LUNE};
  TERRE.uRS = {value:ETAT.rSol};               // rayon apparent du Soleil (varie avec la date)

  // axe de la Terre : incliné de l'inclinaison de l'orbite par rapport à la normale orbitale (+Y)
  TERRE.axe = new THREE.Group();
  // (l'orientation du globe est calculée à chaque trame : axe incliné + rotation au temps sidéral, cf. orienterTerre)
  scene.add(TERRE.axe);

  TERRE.globe = new THREE.Mesh(new THREE.SphereGeometry(CFG.R, 128, 64),
    new THREE.ShaderMaterial({vertexShader:GLSL_TERRE_VS, fragmentShader:GLSL_TERRE_FS,
      uniforms:{uJour:{value:tex.jour}, uNuit:{value:tex.nuit}, uSun:TERRE.uSun, uLune:TERRE.uLune, uRL:TERRE.uRL, uRS:TERRE.uRS}}));
  TERRE.axe.add(TERRE.globe);

  TERRE.atmo = new THREE.Mesh(new THREE.SphereGeometry(CFG.R*1.016, 96, 48),
    new THREE.ShaderMaterial({vertexShader:GLSL_ATMO_VS, fragmentShader:GLSL_ATMO_FS,
      uniforms:{uSun:TERRE.uSun, uLune:TERRE.uLune, uRL:TERRE.uRL, uRS:TERRE.uRS}, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
  scene.add(TERRE.atmo);

  // trace au sol de l'ISS : enfant du globe, donc fixe sur la carte
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRACE_MAX*3), 3));
  g.setDrawRange(0, 0);
  TERRE.trace = new THREE.Line(g, new THREE.LineBasicMaterial({color:0xb8651b}));   // marron
  TERRE.trace.frustumCulled = false;
  TERRE.globe.add(TERRE.trace);
  TERRE.nTrace = 0; TERRE.tTrace = -1e12;
}

const _tp = new THREE.Vector3();
function majTrace(posWorld, t){
  if(t < TERRE.tTrace || t - TERRE.tTrace > 4*CFG.T_ISS || TERRE.nTrace >= TRACE_MAX){
    TERRE.nTrace = 0; TERRE.tTrace = -1e12;       // saut dans le temps : on repart d'une trace vide
  }
  if(t - TERRE.tTrace < TRACE_PAS) return;
  TERRE.tTrace = t;
  _tp.copy(posWorld).setLength(CFG.R*1.004);
  TERRE.globe.worldToLocal(_tp);
  _tp.toArray(TERRE.trace.geometry.attributes.position.array, TERRE.nTrace*3);
  TERRE.nTrace++;
  TERRE.trace.geometry.attributes.position.needsUpdate = true;
  TERRE.trace.geometry.setDrawRange(0, TERRE.nTrace);
}

/* Orientation réelle du globe : longitude 0 de la carte (+X local, u = 0,5) sur Greenwich, tournée du temps sidéral.
   Repère local → équatorial : x → (cos G, sin G, 0), y → pôle nord (0,0,1), z → (sin G, −cos G, 0) ; puis équatorial → scène.
   La géographie sous l'ISS, le jour et la nuit, l'ombre d'une éclipse tombent ainsi aux bons endroits à la date. */
const _gx = new THREE.Vector3(), _gy = new THREE.Vector3(), _gz = new THREE.Vector3(), _gm = new THREE.Matrix4();
function orienterTerre(){
  const G = ETAT.gmst, c = Math.cos(G), s = Math.sin(G);
  ETAT.vers([c, s, 0], _gx); ETAT.vers([0, 0, 1], _gy); ETAT.vers([s, -c, 0], _gz);
  TERRE.globe.quaternion.setFromRotationMatrix(_gm.makeBasis(_gx, _gy, _gz));
}
