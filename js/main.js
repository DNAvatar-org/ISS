// File: js/main.js
// Desc: Point d'entrée : chargement des textures (seul asynchrone), puis boucle de rendu.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const TEX = {};
const _pos = new THREE.Vector3();
let dernier = 0;

function redimensionner(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camExt.aspect = camIss.aspect = w/h;
  camExt.updateProjectionMatrix();
  poseDimensionner();
}

// Place tout selon ETAT.t.
function majScene(){
  const th = thetaISS(ETAT.t);
  posISS(th, ISS.groupe.position);
  ISS.groupe.rotation.y = th;
  orienterTerre();                                 // rotation réelle (temps sidéral de la date)
  majLune();
  TERRE.uLune.value.copy(LUNE.mesh.position);
  TERRE.uRS.value = ETAT.rSol;
  scene.updateMatrixWorld();

  // éclipses : part du Soleil cachée par la Lune vue de l'ISS, part cachée par la Terre vue de la Lune
  ETAT.ecl = 1 - partSoleil(ISS.groupe.position, LUNE.mesh.position, CFG.R_LUNE);
  ETAT.eclLune = eclipseLune();
  const nuit = enNuit(ISS.groupe.position);
  ETAT.nuitISS = nuit;
  SOL.lumiere.intensity = nuit ? 0 : 2.5*(1 - ETAT.ecl);
  if(ETAT.montrer.trace) majTrace(ISS.groupe.position, ETAT.t);

  const iss = ETAT.vue === 'iss', m = ETAT.montrer;
  ISS.modele.visible = !iss;                       // caméra à l'intérieur : pas de modèle devant l'objectif
  ISS.marque.visible = !iss;
  ISS.anneau.visible = m.orbite;
  TERRE.trace.visible = m.trace;
  REP.lignes.forEach(l => l.visible = m.reperes && !iss);
  REP.pastilles.forEach(p => p.visible = m.reperes && iss);
  // taille apparente constante quel que soit le zoom (sinon, à 2° de champ, la pastille déborde de l'écran)
  const kz = Math.tan(VUE_ISS.fov*DEG/2)/Math.tan(30*DEG);
  REP.pastilles.forEach(p => p.scale.set(1400*kz, 350*kz, 1));
  REP.lune.scale.set(1400*kz, 350*kz, 1);
  REP.lune.visible = m.reperes && iss;
  SOL.groupe.visible = true;

  majCamExt(); majCamIss(); majCone(); colorerSoleil();
  // Soleil et voûte à l'infini : posés relativement à l'observateur, quelle que soit la vue (aucune parallaxe).
  // Le Soleil réel est 390 fois plus loin que la Lune ; dessiné à distance fixe du centre, il semblait sur son orbite.
  SOL.groupe.position.copy(ETAT.vue === 'iss' ? ISS.groupe.position : camExt.position).addScaledVector(ETAT.S, CFG.SUN_D);
  majCiel();
  // pastille « Lune » : direction vue de l'observateur (la parallaxe de ~1° depuis l'ISS est réelle)
  REP.lune.position.copy(LUNE.mesh.position).sub(CIEL.groupe.position).setLength(CFG.SKY_R*0.93).add(CIEL.groupe.position);
}

function dessiner(){
  renderer.render(scene, ETAT.vue === 'iss' ? camIss : camExt);
}

function boucle(ms){
  requestAnimationFrame(boucle);
  const dtReel = Math.min(0.1, (ms - dernier)/1000); dernier = ms;
  majSoleilDate();
  const dtSim = ETAT.pause ? 0 : dtReel*ETAT.vitesse;

  if(POSE.actif && dtSim > 0){
    // plusieurs sous-images par trame, pour que les traînées soient continues
    const n = Math.min(80, Math.max(1, Math.ceil(dtSim/posePas())));
    for(let i=0;i<n && POSE.actif;i++){
      ETAT.t += dtSim/n; majScene(); dessiner(); poseAjouter();
    }
  }else{
    ETAT.t += dtSim; majScene(); dessiner();
  }
  // drapeau « +1 an seulement » : la date ne dépasse pas la fin de l'année suivant 2021 (le temps s'arrête au 31 déc. 2022)
  if(CFG.PLUS_1_AN_SEUL && jourDate() >= CFG.JOUR_MAX){
    ETAT.t -= (jourDate() - CFG.JOUR_MAX + 1/86400)*86400;   
    ETAT.pause = true;                                       // arrêt à 23:59:59 le 31 déc.
  }
  if(ms - TUILES.derniere > GIBS.periode){ TUILES.derniere = ms; majTuiles(); }
  majBoutonRec(); majVisee(); majCurseurTheta(); majCurseurFocale(); majDateUI(); majJaugeVitesse(); dessinerJoystick(ms);
}

function demarrer(){
  for(const t of [TEX.jour, TEX.nuit]){
    t.wrapS = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  creerCiel();
  creerTerre(TEX);
  creerTuiles();
  ETAT.date0 = CFG.JOUR_REF;                       // jour du tweet ; t ≈ 0
  calculerSoleil(jourDate());
  creerSoleil();
  TEX.lune.anisotropy = 4;
  creerLune(TEX.lune);
  creerISS();
  ISS.groupe.add(camIss);
  creerCone();
  creerReperes();
  preparerFond(); creerJoystick();
  creerUI();
  choisirPreset('pole');
  ETAT.t = tEntree(0) - 300;                       // cinq minutes avant l'entrée dans l'ombre
  addEventListener('resize', redimensionner); redimensionner();
  requestAnimationFrame(boucle);
}

// Chargement des cartes : jour (geoview) et nuit (steamNight), comme dans jpp/topology-v4.
const mgr = new THREE.LoadingManager();
mgr.onError = url => {
  erreurEl.hidden = false;
  erreurEl.textContent = 'Texture illisible : ' + String(url).slice(0, 60);
  throw new Error('Texture introuvable : ' + url);
};
mgr.onLoad = demarrer;
const chargeur = new THREE.TextureLoader(mgr);
TEX.jour = chargeur.load(CARTES.jour);
TEX.nuit = chargeur.load(CARTES.nuit);
TEX.lune = chargeur.load(CARTES.lune);
