// File: js/cameras.js
// Desc: Deux caméras : orbitale autour de la Terre (vue éloignée) et embarquée dans l'ISS (visée cap / site).
// Version 2.8.0
// - v2.8.0: vue Terre dans le repère équatorial (Y = axe des pôles) : (th, ph) = ascension droite et déclinaison de la caméra,
//   glisser en X la fait tourner autour de l'axe de la Terre, en Y règle l'assiette ; haut = tangente au méridien (pôle Nord
//   en haut, Sud si hautCamera = −1). Vue Terre–Lune : repère de la scène, comme avant. dirVueExt, poserVueExt, changerModeExt.
// - v2.7.0: vue Terre — haut de la caméra = tangente au méridien (vers les ph croissants) : continu par-dessus les pôles, la
//   vue passe à l'envers au lieu de buter (entrees.js).
// - v2.6.1: FOV_VUE_TERRE (champ de la vue Terre), lu aussi par hote.js.
// - v2.6.0: ETAT.horizonVertical : caméra de l'ISS tournée d'un quart de tour, la Terre à droite de l'image.
// - v2.5.0: plan proche de la vue Terre à la mesure de l'altitude (zoom jusqu'à 8 km).
// - v2.4.0: vue Terre–Lune : la visée glisse avec le zoom, du milieu Terre–Lune (au plus large) à la Terre (au plus près).
// - v2.2.0: vueEclaireeDeBiais ((drapeaux de l'hôte, url.js)) : le Soleil à 75° de l'axe de visée, un bord de nuit visible.
// - v2.1.0: suivis « soleil » et « lune » = l'horizon sous l'astre (horizon.js) : son cap, le site du limbe.
// Date: [November 03, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const camExt = new THREE.PerspectiveCamera(40, 1, 0.5, 30000);
const camIss = new THREE.PerspectiveCamera(60, 1, 0.01, 30000);
const VUE_EXT = {th:0.9, ph:0.55, r:250, mode:'terre', cible:new THREE.Vector3()};   // mode 'lune' : cadre Terre + Lune

/* Visée de la caméra ISS, en repère local (+X zénith, +Y normale orbitale, −Z sens du vol) :
   cap  = direction horizontale, 0 = vers l'avant, +90° = vers +Y ;
   site = hauteur, 0 = horizon, −90° = nadir (la Terre), +90° = zénith.
   Direction visée d = (sin site, cos site·sin cap, −cos site·cos cap) ; le haut de l'image est toujours le zénith
   (horizon horizontal), sauf au nadir où c'est le sens du vol. */
const VUE_ISS = {cap:0, site:-17*DEG, fov:60, suivi:null, decal:0};   // suivi = 'soleil' ou 'lune' : l'horizon sous l'astre

const ZENITH = new THREE.Vector3(1,0,0);

// Visées prédéfinies (degrés). « Pôle » regarde le pôle orbital du côté opposé au Soleil : le sol vu de côté reste dans l'ombre.
function viseePreset(nom){
  const cote = ETAT.S.y >= 0 ? 1 : -1;
  switch(nom){
    case 'pole':    return {cap:-90*cote, site:-17};
    case 'poleSol': return {cap: 90*cote, site:-17};
    case 'nadir':   return {cap:0, site:-90};
    case 'oblique': return {cap:0, site:-55};     // vers l'avant et le bas : que de la Terre
    case 'avant':   return {cap:0, site:0};
  }
  throw new Error('Visée inconnue : ' + nom);
}

const _qi = new THREE.Quaternion();
// Direction d'un astre (vecteur monde unitaire) dans le repère local de l'ISS.
const localDe = (dirMonde, out) => out.copy(dirMonde).applyQuaternion(_qi.copy(OBS.groupe.quaternion).invert());
const solISS  = out => localDe(SOL.dir, out);
const _dl = new THREE.Vector3();
const luneISS = out => localDe(_dl.copy(LUNE.mesh.position).sub(OBS.groupe.position).normalize(), out);   // parallaxe incluse
// (cap, site) en radians d'un vecteur unitaire local.
const capDe  = d => Math.atan2(d.y, -d.z);
const siteDe = d => Math.asin(Math.max(-1, Math.min(1, d.x)));

function choisirPreset(nom){
  ETAT.preset = nom;
  VUE_ISS.decal = 0;
  if(nom === 'soleil' || nom === 'lune'){ VUE_ISS.suivi = nom; return; }
  VUE_ISS.suivi = null;
  const v = viseePreset(nom);
  VUE_ISS.cap = v.cap*DEG; VUE_ISS.site = v.site*DEG;
}

// Visée libre (joystick, glisser) : on quitte le suivi du Soleil et tout preset.
function viser(cap, site){
  ETAT.preset = null; VUE_ISS.suivi = null; VUE_ISS.decal = 0;
  VUE_ISS.cap = Math.atan2(Math.sin(cap), Math.cos(cap));
  VUE_ISS.site = Math.max(-Math.PI/2, Math.min(Math.PI/2, site));
}

const _H = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Matrix4();
// Base de la caméra pour (cap, site) : f = visée, u = haut, r = droite = f × u.
function baseVisee(cap, site, f, u, r){
  _H.set(0, Math.sin(cap), -Math.cos(cap));
  f.copy(_H).multiplyScalar(Math.cos(site)).addScaledVector(ZENITH, Math.sin(site));
  u.copy(_H).multiplyScalar(-Math.sin(site)).addScaledVector(ZENITH, Math.cos(site));
  r.crossVectors(f, u);
}

/* Repère de (th, ph) : vue Terre, l'équatorial céleste — Y = axe des pôles, X = point vernal (la Terre à la date 0 h sidérale,
   terre.js orienterTerre) : th, ph = ascension droite et déclinaison de la caméra, le glisser horizontal tourne autour de l'axe
   de la Terre et le vertical règle l'assiette (entrees.js). Vue Terre–Lune : le repère de la scène (Y = normale de l'orbite). */
const _eqX = new THREE.Vector3(), _eqY = new THREE.Vector3(), _eqZ = new THREE.Vector3(), _qExt = new THREE.Quaternion();
function repereVueExt(){
  if(VUE_EXT.mode === 'lune') return _qExt.identity();
  ETAT.vers([1, 0, 0], _eqX); ETAT.vers([0, 0, 1], _eqY); ETAT.vers([0, -1, 0], _eqZ);
  return _qExt.setFromRotationMatrix(_m.makeBasis(_eqX, _eqY, _eqZ));
}
// Direction (monde, unitaire) de la caméra extérieure vue de sa cible.
const dirVueExt = out =>
  out.set(Math.cos(VUE_EXT.ph)*Math.sin(VUE_EXT.th), Math.sin(VUE_EXT.ph), Math.cos(VUE_EXT.ph)*Math.cos(VUE_EXT.th)).applyQuaternion(repereVueExt());
/* (th, ph) d'une direction monde dans le repère du mode courant ; garderCote : vue passée par-dessus un pôle (cos ph < 0,
   entrees.js), le même point pris de ce côté-là — sinon l'image ferait un demi-tour. */
const _dvExt = new THREE.Vector3(), _dmExt = new THREE.Vector3();
function anglesVueExt(dirMonde, garderCote){
  _dvExt.copy(dirMonde).applyQuaternion(repereVueExt().invert());
  let th = Math.atan2(_dvExt.x, _dvExt.z), ph = Math.asin(Math.max(-1, Math.min(1, _dvExt.y)));
  if(garderCote && Math.cos(VUE_EXT.ph) < 0){ th += Math.PI; ph = Math.sign(VUE_EXT.ph)*Math.PI - ph; }
  return {th, ph};
}
const poserVueExt = (dirMonde, garderCote) => Object.assign(VUE_EXT, anglesVueExt(dirMonde, garderCote));
// Vue Terre ↔ Terre–Lune : les repères diffèrent, la caméra garde sa direction (pas de saut de position) ; son haut passe de
// la normale de l'orbite à l'axe de la Terre (roulis de l'image au changement, accepté).
function changerModeExt(mode){ dirVueExt(_dmExt); VUE_EXT.mode = mode; poserVueExt(_dmExt, true); }

const _hautExt = new THREE.Vector3();
function majCamExt(){
  const {th, ph, r, cible} = VUE_EXT;
  // vue Terre–Lune : visée sur l'axe Terre → Lune, à la fraction que donne le zoom — la Terre au plus près (R_LUNE_MIN), le
  // milieu Terre–Lune au plus large (R_LUNE_MAX) : zoomer va vers la Terre (entrees.js)
  if(VUE_EXT.mode === 'lune') cible.copy(ETAT.M).multiplyScalar(CFG.LUNE_D/2*(r - R_LUNE_MIN)/(R_LUNE_MAX - R_LUNE_MIN));
  else cible.set(0, 0, 0);
  camExt.position.copy(dirVueExt(_dmExt)).multiplyScalar(r).add(cible);
  // haut = tangente au méridien vers les ph croissants, dans le repère (repereVueExt) : vue Terre, l'axe de la Terre projeté
  // (un astre fixe à l'infini court en ligne droite horizontale) tant que |ph| < 90°, et continu au-delà — passé un pôle,
  // la vue est à l'envers sans saut ; hautCamera = −1 (aube au sol, hote.js) : le pôle Sud en haut
  _hautExt.set(-Math.sin(ph)*Math.sin(th), Math.cos(ph), -Math.sin(ph)*Math.cos(th)).applyQuaternion(repereVueExt());
  camExt.up.copy(_hautExt).multiplyScalar(ETAT.hautCamera === -1 ? -1 : 1);
  camExt.lookAt(cible);
  const fov = VUE_EXT.mode === 'lune' ? 50 : FOV_VUE_TERRE;
  // plan proche à la mesure de l'altitude : de près (zoom jusqu'à 8 km), 0,5 unité (50 km) coupait le sol
  const near = Math.max(0.002, Math.min(0.5, (r - CFG.R)*0.25));
  if(camExt.fov !== fov || camExt.near !== near){ camExt.fov = fov; camExt.near = near; camExt.updateProjectionMatrix(); }
}

// Vue de profil de l'ensemble Terre–Lune (la Lune est à 60 rayons terrestres : invisible depuis la vue éloignée normale).
const _o = new THREE.Vector3(), _on = new THREE.Vector3();
function vueTerreLune(){
  ETAT.vue = 'ext'; VUE_EXT.mode = 'lune'; VUE_EXT.r = 5200;
  _on.crossVectors(ETAT.Mnord, ETAT.M).normalize();                       // perpendiculaire à l'axe Terre–Lune, dans le plan de l'orbite
  _o.copy(ETAT.Mnord).multiplyScalar(0.5).addScaledVector(_on, 0.85).normalize();   // un peu au-dessus : on voit l'orbite en perspective
  poserVueExt(_o, false);
}
/* Vue Terre éclairée de biais ((drapeaux de l'hôte, url.js)) : la caméra extérieure placée pour que le Soleil (ETAT.S) soit à 75° de son
   axe de visée — un peu derrière la Terre : environ 60 % du disque éclairé, un bord de nuit visible — et à GAUCHE de l'écran
   (là où la page hôte pose son Soleil et son organigramme). La caméra reste à 20° au-dessus du plan de l'orbite (pas de vue
   d'un pôle) ; son azimut est cherché au degré, parmi ceux qui ont le Soleil à gauche : S · droite < 0, la droite de la
   caméra étant A × z (A : axe de la Terre, haut de la vue Terre ; z : direction de la caméra depuis la Terre). 20° au-dessus
   de l'équateur. La Terre reste libre à la souris. */
function vueEclaireeDeBiais(){
  // dans le repère de la vue Terre (repereVueExt) : le haut de l'image est l'axe de la Terre A, la droite A × z
  const angle = 75*DEG, ph = 20*DEG, z = new THREE.Vector3(), A = ETAT.vers([0, 0, 1], new THREE.Vector3()), droite = new THREE.Vector3();
  let ecartMin = Infinity, thMeilleur = 0;
  for(let th = 0; th < 360; th++){
    z.set(Math.cos(ph)*Math.sin(th*DEG), Math.sin(ph), Math.cos(ph)*Math.cos(th*DEG)).applyQuaternion(repereVueExt());
    const aGauche = ETAT.S.dot(droite.crossVectors(A, z)) < 0;
    const ecart = aGauche ? Math.abs(Math.acos(ETAT.S.dot(z)) - angle) : Infinity;
    if(ecart < ecartMin){ ecartMin = ecart; thMeilleur = th*DEG; }
  }
  VUE_EXT.th = thMeilleur; VUE_EXT.ph = ph;
}
function vueTerre(){
  ETAT.vue = 'ext';
  if(VUE_EXT.mode === 'lune'){ changerModeExt('terre'); VUE_EXT.r = 250; }
}

const FOV_VUE_TERRE = 40;                          // [°] champ vertical de la vue Terre (Terre–Lune : 50)
function majCamIss(){
  if(VUE_ISS.suivi){                                    // pas l'astre lui-même : l'horizon sous lui, sur le limbe (horizon.js)
    const v = viseeHorizon(VUE_ISS.suivi);
    VUE_ISS.cap = v.cap;
    VUE_ISS.site = Math.max(-Math.PI/2, Math.min(Math.PI/2, v.site + VUE_ISS.decal));
  }
  baseVisee(VUE_ISS.cap, VUE_ISS.site, _f, _u, _r);
  // la caméra regarde −z ; horizon vertical : un quart de tour autour de la visée — la droite de l'image est le bas (la
  // Terre), son haut l'ancienne droite
  if(ETAT.horizonVertical) _m.makeBasis(_u.negate(), _r, _f.negate());
  else _m.makeBasis(_r, _u, _f.negate());
  camIss.quaternion.setFromRotationMatrix(_m);
  camIss.fov = VUE_ISS.fov;
  camIss.updateProjectionMatrix();
}
