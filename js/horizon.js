// File: js/horizon.js
// Desc: Horizons du Soleil et de la Lune vus de l'ISS : le point du limbe de la Terre dans l'azimut de l'astre (sur le
//       trait bleu du joystick, joystick.js : ☀️ orange-rouge, 🌙 gris), qui le suit ; les visées « soleil » (☀️,
//       ?vue=soleil) et « lune » (🌙, ?vue=lune) le visent (cameras.js).
// Version 1.0.0
// Date: [October 15, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

// Direction de chaque astre en repère local de l'ISS (cameras.js : Soleil lointain, Lune avec sa parallaxe).
const HORIZON = {d:new THREE.Vector3(), direction:{soleil:solISS, lune:luneISS}};

/* Visée (cap, site) de l'horizon sous un astre, en repère local de l'ISS : le cap de l'astre, le site du limbe — l'angle
   asin(R/r) depuis le nadir, celui du trait bleu du joystick. */
function viseeHorizon(nom){
  HORIZON.direction[nom](HORIZON.d);
  return {cap:capDe(HORIZON.d), site:Math.asin(CFG.R/OBS.R) - Math.PI/2};
}
