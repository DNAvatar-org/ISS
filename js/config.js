// File: js/config.js
// Desc: Constantes physiques (échelle : 1 unité = 100 km) et état de la simulation (ETAT).
// Version 1.0.1
// Date: [October 08, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const DEG = Math.PI/180;

const CFG = {
  R: 63.71,                 // rayon de la Terre (6 371 km)
  ALT: 4.2,                 // altitude de l'ISS (420 km)
  INCL: 51.6*DEG,           // inclinaison de l'orbite sur l'équateur
  T_ISS: 5561,              // période orbitale (s) = 92,7 min
  T_TERRE: 86164,           // jour sidéral (s)
  SKY_R: 9000,              // voûte céleste (sphère externe)
  SUN_D: 8000,              // distance de dessin du Soleil DEPUIS L'OBSERVATEUR (à l'infini : direction seule)
  SUN_ANG: 0.265*DEG,       // demi-diamètre apparent du Soleil
  PAS_PX: 2,                // pose longue : écart max (px) entre deux images empilées
  POSE_S: 30,               // durée de chaque photo (s)
  LUNE_D: 3844,             // distance moyenne de la Lune (384 400 km) : cadrage Terre–Lune, cercle d'orbite
  R_LUNE: 17.374,           // rayon de la Lune (1 737 km) = 0,27 rayon terrestre
  JOUR_REF: 169,            // 19 juin 2021 (jours depuis le 1er janv. 2021) : date du tweet, β calé à 49°
  DEPHASAGE_REF: 135*DEG,   // Ω − α à la date de référence (l'une des deux solutions donnant β = 49°)
  DERIVE_NOEUD: -5.0*DEG    // régression du nœud de l'ISS (rad/jour)
};
CFG.R_ORB = CFG.R + CFG.ALT;

/* État mutable. t = temps simulé (s). L'orbite est dans le plan XZ, de normale +Y,
   le Soleil dans le plan XY à l'angle β au-dessus du plan orbital. */
const ETAT = {
  t: 0, vitesse: 60, pause: false,
  date0: 169,               // décalage de date (jours) ; date courante = date0 + t/86400
  debutAnnee: 0,            // 1er janvier de l'année affichée par la jauge Date (jours depuis le 1er janv. 2021)
  S: new THREE.Vector3(1,0,0), beta: 0, thetaSol: 0,   // Soleil, calculés par calculerSoleil()
  M: new THREE.Vector3(0,0,1), Mdist: 3844, Mnord: new THREE.Vector3(0,1,0), vers: null, gmst: 0, rSol: 0.26656*DEG, nuitISS: false, ecl: 0, eclLune: {ombre:-1, penombre:-1}, lune: {illum:0, croissante:true},   // Lune idem
  vue: 'iss', preset: 'pole',   // au départ : dans l'ISS, visée « pôle » (la photo)
  montrer: {orbite:false, reperes:false, trace:false, cone:false, geo:false}
};
