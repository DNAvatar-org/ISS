// File: js/main.js
// Desc: Point d'entrée : chargement des textures (seul asynchrone), puis boucle de rendu.
// Version 1.0.2
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const TEX = {};
const _pos = new THREE.Vector3();
let dernier = 0;

function redimensionner(){
  const w = innerWidth, h = innerHeight;
  document.documentElement.style.setProperty('--alt', h + 'px');   // hauteur visible : 100vh dépasse l'écran sur mobile (barre d'adresse)
  renderer.setSize(w, h);
  camExt.aspect = camIss.aspect = w/h;
  camExt.updateProjectionMatrix();
  poseDimensionner();
}

// Place tout selon ETAT.t.
function majScene(){
  majSats(ETAT.t);                                 // position et orientation de chaque satellite, anneaux compris
  orienterTerre();                                 // rotation réelle (temps sidéral de la date)
  majLune();
  TERRE.uLune.value.copy(LUNE.mesh.position);
  TERRE.uRS.value = ETAT.rSol;
  scene.updateMatrixWorld();

  // éclipses : part du Soleil cachée par la Lune vue de l'ISS, part cachée par la Terre vue de la Lune
  ETAT.ecl = 1 - partSoleil(OBS.groupe.position, LUNE.mesh.position, CFG.R_LUNE);
  ETAT.eclLune = eclipseLune();
  const nuit = enNuit(OBS.groupe.position);
  ETAT.nuitISS = nuit;
  SOL.lumiere.intensity = nuit ? 0 : 2.5*(1 - ETAT.ecl);
  if(ETAT.montrer.trace) majTrace(OBS.groupe.position, ETAT.t);

  const iss = ETAT.vue === 'iss', m = ETAT.montrer;
  for(const sat of SATS){
    const dedans = iss && sat === OBS;             // caméra à l'intérieur : pas de modèle devant l'objectif
    sat.modele.visible = !dedans; sat.marque.visible = !dedans;
    sat.anneau.visible = m.orbite;
  }
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
  SOL.groupe.position.copy(ETAT.vue === 'iss' ? OBS.groupe.position : camExt.position).addScaledVector(ETAT.S, CFG.SUN_D);
  const fLune = majEblouissement(ETAT.vue === 'iss' ? camIss : camExt);   // vu de la caméra qui dessine
  majCouronne(fLune);
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
  // bornes 2000 – 2035 (dates.js) : le temps s'arrête au 31 déc. 2035 à 23:59:59 ; on ne descend pas sous le 1er janv. 2000
  if(jourDate() >= DATES.max){
    ETAT.t -= (jourDate() - DATES.max + 1/86400)*86400; ETAT.pause = true;
  }else if(jourDate() < DATES.min){
    ETAT.t += (DATES.min - jourDate())*86400; ETAT.pause = true;
  }
  if(ms - TUILES.derniere > GIBS.periode){ TUILES.derniere = ms; majTuiles(); }
  majBoutonRec(); majVisee(); majSelections(); majCurseurTheta(); majCurseurFocale(); majDateUI(); majJaugeVitesse(); dessinerJoystick(ms); majCalque();
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
  creerEblouissement(); creerCouronne();
  creerSats();
  OBS.groupe.add(camIss);
  creerCone();
  creerReperes();
  preparerFond(); creerJoystick();
  creerUI();
  creerSolveur(); creerEncart();                   // « Check Photo » (js/solveur/)
  choisirPreset('pole');
  const avisURL = appliquerSatURL();               // ?sat= (url.js) : avant t, qui dépend de l'observateur
  ETAT.t = tEntree(0) - 300;                       // cinq minutes avant l'entrée dans l'ombre
  avisURL.push(...appliquerVueURL());              // ?vue= : visée prédéfinie
  avisURL.push(...appliquerViseeURL());            // ?cap=&site= : visée libre (après vue=, prioritaire)
  avisURL.push(...appliquerFocaleURL());           // ?focale= (mm)
  avisURL.push(...appliquerDateURL());             // ?date=&heure= : date + heure → en pause
  if(avisURL.length) avis(avisURL);
  addEventListener('resize', redimensionner); redimensionner();
  requestAnimationFrame(boucle);
}

// Chargement des cartes : jour (geoview) et nuit (steamNight), comme dans jpp/topology-v4.
const mgr = new THREE.LoadingManager();
mgr.onError = url => {
  erreurEl.hidden = false;
  erreurEl.appendChild(document.createTextNode('Texture illisible : ' + String(url).slice(0, 60)));
  throw new Error('Texture introuvable : ' + url);
};
mgr.onLoad = demarrer;
const chargeur = new THREE.TextureLoader(mgr);
TEX.jour = chargeur.load(CARTES.jour);
TEX.nuit = chargeur.load(CARTES.nuit);
TEX.lune = chargeur.load(CARTES.lune);
