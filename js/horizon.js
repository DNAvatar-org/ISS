// File: js/horizon.js
// Desc: Horizons du Soleil et de la Lune vus de l'ISS : le point du limbe de la Terre dans l'azimut de l'astre (sur le
//       trait bleu du joystick), qui le suit. Pastilles posées à la surface — orange-rouge : le coucher du Soleil ; grise :
//       l'horizon de la Lune ; les visées « soleil » (☀️, ?vue=soleil) et « lune » (🌙, ?vue=lune) les visent.
// Version 1.0.0
// Date: [October 15, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Par astre : sa direction en repère local de l'ISS (cameras.js : Soleil lointain, Lune avec sa parallaxe) et les
   couleurs de sa pastille (centre, milieu, bord). */
const HORIZON = {
  d:new THREE.Vector3(), f:new THREE.Vector3(), u:new THREE.Vector3(), r:new THREE.Vector3(),
  astres:{
    soleil:{direction:solISS,  couleurs:['rgba(255,190,70,1)', 'rgba(255,90,30,1)', 'rgba(200,20,10,0)']},
    lune:  {direction:luneISS, couleurs:['rgba(235,238,242,1)', 'rgba(150,155,165,1)', 'rgba(90,95,105,0)']}
  }
};

/* Visée (cap, site) de l'horizon sous un astre, en repère local de l'ISS : le cap de l'astre, le site du limbe — l'angle
   asin(R/r) depuis le nadir, celui du trait bleu du joystick. */
function viseeHorizon(nom){
  HORIZON.astres[nom].direction(HORIZON.d);
  return {cap:capDe(HORIZON.d), site:Math.asin(CFG.R/OBS.R) - Math.PI/2};
}

// Pastilles rondes, taille fixe à l'écran (quel que soit le zoom).
function creerHorizons(){
  for(const astre of Object.values(HORIZON.astres)){
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, astre.couleurs[0]); g.addColorStop(0.55, astre.couleurs[1]); g.addColorStop(1, astre.couleurs[2]);
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    astre.point = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv), sizeAttenuation:false, transparent:true}));
    astre.point.scale.set(0.03, 0.03, 1);
    scene.add(astre.point);
  }
}

/* Point du limbe : depuis l'ISS, le long de la visée de l'horizon (rayon tangent à la Terre), posé à la surface et levé
   de 10 km pour que la Terre ne le cache pas. */
function majHorizons(){
  for(const nom of Object.keys(HORIZON.astres)){
    const v = viseeHorizon(nom);
    baseVisee(v.cap, v.site, HORIZON.f, HORIZON.u, HORIZON.r);
    HORIZON.f.applyQuaternion(OBS.groupe.quaternion);                    // local → monde
    HORIZON.astres[nom].point.position.copy(OBS.groupe.position)
      .addScaledVector(HORIZON.f, Math.sqrt(OBS.R*OBS.R - CFG.R*CFG.R))
      .setLength(CFG.R + 0.1);                                           // Terre centrée à l'origine ; 0,1 = 10 km
  }
}
