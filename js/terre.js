// File: js/terre.js
// Desc: Terre jour/nuit (geoview.jpg + steamNight.jpg), atmosphère, trace de l'ISS au sol.
// Version 2.0.0
// Date: [October 07, 2026]
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

/* Atmosphère PHYSIQUE, rien de calé sur une photo. Pour chaque pixel : le rayon issu de la caméra, son paramètre
   d'impact p (distance minimale au centre de la Terre). Le long du rayon, la variable u = √(r² − p²) (distance au point
   tangent) donne l'altitude h = √(p² + u²) − R sans singularité au point tangent. Unités : 100 km.
   NUIT — luminescence (airglow) : raies d'émission en couches gaussiennes, altitude du pic, écart-type σ, intensité
   zénithale I (rayleighs) — valeurs typiques de la littérature (Leinert et al. 1998, A&AS 127 ; Broadfoot & Kendall 1968),
   variables d'une nuit à l'autre (×2–3, Na saisonnier). Émissivité ε(h) = I/(σ√2π)·exp(−(h−h0)²/2σ²), intégrée le long du
   rayon (deux traversées si le rayon manque la Terre, une s'il la touche) : au limbe, ~45× la valeur zénithale.
     OH, bandes de Meinel visibles (λ < 700 nm) : 87 km, σ 3,5 km, ~300 R
     Na D 589 nm  : 92 km, σ 4 km,   ~60 R
     O₂ Herzberg/Chamberlain (bleu) : 95 km, σ 4 km, ~60 R
     OI 557,7 nm (vert) : 97 km, σ 4,5 km, ~250 R
     OI 630,0 nm (rouge) : 250 km, σ 35 km, ~60 R
   Couleur de chaque raie : fonctions colorimétriques CIE 1931 → sRGB linéaire (D65), photons → énergie, hors gamut
   ramené à 0 (calcul fait une fois, valeurs ci-dessous). On obtient de lui-même, vu de côté : rouge-orangé (OH, Na)
   en bas, vert (OI) au-dessus, voile rouge très haut (OI 630).
   JOUR — diffusion Rayleigh, diffusion simple : densité ∝ exp(−h/H), H = 8 km ; épaisseur optique zénithale au niveau de
   la mer 0,050 / 0,098 / 0,225 (650 / 550 / 450 nm) ; lumière du Soleil atténuée sur son trajet jusqu'au point (Chapman
   au-dessus de l'horizon, passage rasant sinon, ombre de la Terre) ; atténuation le long de la vue ; phase de Rayleigh.
   Le bleu du limbe, sa base blanche et le rougissement au terminateur en découlent. Luminance rapportée à celle du sol
   (réflectance lambertienne, en E/π) : phase normalisée sur 4π → facteur π/4π = 1/4.
   Seul réglage non physique : l'exposition, comme celle d'un appareil photo. Le jour (ISS au Soleil), un appareil
   exposé pour la Terre éclairée ne voit pas la luminescence (~10⁵ fois plus faible) : son exposition baisse (majAtmo). */
const GLSL_ATMO_FS = `
uniform vec3 uSun;
uniform float uR, uExpoJour, uExpoNuit;
${GLSL_ECLIPSE}
varying vec3 vN; varying vec3 vV; varying vec3 vW;
// couche gaussienne : intégrale le long du rayon (rayleighs vus) ; k = 2 traversées (rayon libre) ou 1 (il touche la Terre)
float couche(float p, float h0, float s, float I, float k){
  float ra = uR + max(h0 - 4.0*s, 0.0), rb = uR + h0 + 4.0*s;
  if(p >= rb) return 0.0;
  float ua = sqrt(max(ra*ra - p*p, 0.0)), ub = sqrt(rb*rb - p*p), du = (ub - ua)/24.0, acc = 0.0;
  for(int i=0;i<24;i++){
    float u = ua + (float(i) + 0.5)*du, x = (sqrt(p*p + u*u) - uR - h0)/s;
    acc += exp(-0.5*x*x);
  }
  return k*I/(s*2.5066)*acc*du;
}
// colonne d'air (× H, à multiplier par β) sur le trajet de la lumière du Soleil jusqu'au point x ; −1 dans l'ombre
float chapman(float h, float c, float H){                         // colonne de x vers l'espace, c = cos(angle au zénith) ≥ 0
  return H*exp(-h/H)/(c + 0.15*pow(max(93.885 - degrees(acos(c)), 0.5), -1.253));
}
float colonneSoleil(vec3 x, float H){
  float r = length(x), h = r - uR, c = dot(x, uSun)/r;
  if(c >= 0.0) return chapman(h, c, H);                           // Soleil au-dessus de l'horizon du point
  float q = r*sqrt(1.0 - c*c);                                    // sinon la lumière est passée plus bas, au plus près en q
  if(q < uR) return -1.0;                                          // ombre de la Terre
  return max(H*exp(-(q - uR)/H)*sqrt(6.2832*q/H) - chapman(h, -c, H), 0.0);   // colonne tangente − partie au-delà de x
}
void main(){
  vec3 o = cameraPosition, d = normalize(vW - cameraPosition);
  float tc = -dot(o, d);
  if(tc < 0.0){ gl_FragColor = vec4(0.0); return; }                // le rayon s'éloigne de la Terre
  vec3 pc = o + tc*d;
  float p = length(pc), k = p >= uR ? 2.0 : 1.0;

  // --- nuit : luminescence (rayleighs vus × couleur CIE→sRGB par rayleigh)
  vec3 glow = couche(p, 0.87, 0.035, 300.0, k)*vec3(0.905, 0.0, 0.0)       // OH (Meinel, visible)
            + couche(p, 0.92, 0.040,  60.0, k)*vec3(2.000, 0.433, 0.0)     // Na D 589 nm
            + couche(p, 0.95, 0.040,  60.0, k)*vec3(0.183, 0.0, 2.335)     // O2 Herzberg/Chamberlain
            + couche(p, 0.97, 0.045, 250.0, k)*vec3(0.268, 1.332, 0.0)     // OI 557,7 nm
            + couche(p, 2.50, 0.350,  60.0, k)*vec3(1.482, 0.0, 0.0);      // OI 630,0 nm

  // --- jour : diffusion Rayleigh simple le long du rayon (côté caméra → fond)
  const float H = 0.08;                                            // hauteur d'échelle : 8 km
  vec3 beta = vec3(0.050, 0.098, 0.225)/H;                         // coefficient au niveau de la mer (par 100 km)
  float top = uR + 0.8;                                            // au-delà de 80 km : négligeable
  vec3 diff = vec3(0.0);
  if(p < top){
    float u0 = sqrt(top*top - p*p), u1 = p < uR ? sqrt(uR*uR - p*p) : -u0, du = (u0 - u1)/48.0;
    vec3 trans = vec3(1.0);
    float mu = dot(-d, uSun);                                      // angle de diffusion
    float phase = 0.75*(1.0 + mu*mu);
    for(int i=0;i<48;i++){
      float u = u0 - (float(i) + 0.5)*du;
      vec3 x = pc - u*d;
      float h = length(x) - uR, n = exp(-h/H);
      float cs = colonneSoleil(x, H);
      vec3 sol = cs < 0.0 ? vec3(0.0) : exp(-beta*cs);
      vec3 dn = beta*n*du;
      diff += trans*sol*dn*phase;
      trans *= exp(-dn);
    }
    diff *= lumiereSoleil(vW);                                     // dans l'ombre de la Lune, l'air n'est plus éclairé
  }
  vec3 col = 1.0 - exp(-(diff*uExpoJour + glow*uExpoNuit));        // saturation douce (capteur)
  gl_FragColor = vec4(col, 1.0);
}`;

const ATMO_EXPO_NUIT = 1/25000;           // exposition de nuit (par rayleigh vu) ; au Soleil : × 0,02

// Exposition de l'« appareil » : de nuit, la luminescence ; l'ISS au Soleil, le jour (cf. GLSL_ATMO_FS).
function majAtmo(){
  TERRE.atmo.material.uniforms.uExpoNuit.value = ATMO_EXPO_NUIT*(ETAT.nuitISS ? 1 : 0.02);
}

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

  // coque jusqu'à 390 km : couche OI 630 nm comprise (250 km ± 4σ) ; l'ISS (≈ 420 km) reste au-dessus
  TERRE.atmo = new THREE.Mesh(new THREE.SphereGeometry(CFG.R + 3.9, 128, 64),
    new THREE.ShaderMaterial({vertexShader:GLSL_ATMO_VS, fragmentShader:GLSL_ATMO_FS,
      uniforms:{uSun:TERRE.uSun, uLune:TERRE.uLune, uRL:TERRE.uRL, uRS:TERRE.uRS,
                uR:{value:CFG.R}, uExpoJour:{value:0.25}, uExpoNuit:{value:ATMO_EXPO_NUIT}},
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
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
  if(t < TERRE.tTrace || t - TERRE.tTrace > 4*OBS.T || TERRE.nTrace >= TRACE_MAX){
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
