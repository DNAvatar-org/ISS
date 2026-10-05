// File: js/cameras.js
// Desc: Deux caméras : orbitale autour de la Terre (vue éloignée) et embarquée dans l'ISS (visée cap / site).
// Version 2.0.0
// Date: [October 05, 2026]
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
const VUE_ISS = {cap:0, site:-17*DEG, fov:60, suivi:null, decal:0};   // suivi = 'soleil' ou 'lune' : la visée suit l'astre

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

const _qi = new THREE.Quaternion(), _sd = new THREE.Vector3();
// Direction d'un astre (vecteur monde unitaire) dans le repère local de l'ISS.
const localDe = (dirMonde, out) => out.copy(dirMonde).applyQuaternion(_qi.copy(ISS.groupe.quaternion).invert());
const solISS  = out => localDe(SOL.dir, out);
const _dl = new THREE.Vector3();
const luneISS = out => localDe(_dl.copy(LUNE.mesh.position).sub(ISS.groupe.position).normalize(), out);   // parallaxe incluse
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

function majCamExt(){
  const {th, ph, r, cible} = VUE_EXT;
  if(VUE_EXT.mode === 'lune') cible.copy(ETAT.M).multiplyScalar(CFG.LUNE_D/2);   // milieu Terre–Lune
  else cible.set(0, 0, 0);
  camExt.position.set(r*Math.cos(ph)*Math.sin(th), r*Math.sin(ph), r*Math.cos(ph)*Math.cos(th)).add(cible);
  camExt.lookAt(cible);
  const fov = VUE_EXT.mode === 'lune' ? 50 : 40;
  if(camExt.fov !== fov){ camExt.fov = fov; camExt.updateProjectionMatrix(); }
}

// Vue de profil de l'ensemble Terre–Lune (la Lune est à 60 rayons terrestres : invisible depuis la vue éloignée normale).
const _o = new THREE.Vector3(), _on = new THREE.Vector3();
function vueTerreLune(){
  ETAT.vue = 'ext'; VUE_EXT.mode = 'lune'; VUE_EXT.r = 5200;
  _on.crossVectors(ETAT.Mnord, ETAT.M).normalize();                       // perpendiculaire à l'axe Terre–Lune, dans le plan de l'orbite
  _o.copy(ETAT.Mnord).multiplyScalar(0.5).addScaledVector(_on, 0.85).normalize();   // un peu au-dessus : on voit l'orbite en perspective
  VUE_EXT.th = Math.atan2(_o.x, _o.z); VUE_EXT.ph = Math.asin(_o.y);
}
function vueTerre(){
  ETAT.vue = 'ext';
  if(VUE_EXT.mode === 'lune'){ VUE_EXT.mode = 'terre'; VUE_EXT.r = 250; }
}

function majCamIss(){
  if(VUE_ISS.suivi){
    (VUE_ISS.suivi === 'soleil' ? solISS : luneISS)(_sd);
    VUE_ISS.cap = capDe(_sd);
    VUE_ISS.site = Math.max(-Math.PI/2, Math.min(Math.PI/2, siteDe(_sd) + VUE_ISS.decal));
  }
  baseVisee(VUE_ISS.cap, VUE_ISS.site, _f, _u, _r);
  _m.makeBasis(_r, _u, _f.negate());                    // la caméra regarde −z
  camIss.quaternion.setFromRotationMatrix(_m);
  camIss.fov = VUE_ISS.fov;
  camIss.updateProjectionMatrix();
}
