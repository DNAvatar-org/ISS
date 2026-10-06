// File: js/iss.js
// Desc: ISS : éléments orbitaux, modèle simple (repère local : +X zénith, +Y normale orbitale, −Z sens du vol), logo.
// Version 2.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Le repère de la scène est celui de l'ISS (plan XZ, dOm = 0). Voir satellites.js pour le sens des éléments. */
enregistrerSat({
  id:'iss', nom:'ISS', info:'ISS : 51,6°, 420 km, 92,7 min',
  incl:CFG.INCL, alt:CFG.ALT, T:CFG.T_ISS, phi:0, dOm:0, derive:CFG.DERIVE_NOEUD,
  jour:[0.30, 0.85, 1.0], nuit:[0.70, 0.45, 1.0],
  logo:'<svg class="ico" viewBox="0 0 24 18" aria-hidden="true"><rect x="2" y="8.2" width="20" height="1.6" fill="#ff9a2e"/><rect x="9.5" y="7" width="5" height="4" rx="1" fill="#f4f4f4"/>'
     + '<g fill="#2f6bff"><rect x="2" y="2" width="4.5" height="5"/><rect x="2" y="11" width="4.5" height="5"/><rect x="17.5" y="2" width="4.5" height="5"/><rect x="17.5" y="11" width="4.5" height="5"/></g></svg>',
  creerModele(g){
    // colorée de jour (la lumière est coupée dans l'ombre) : poutre orange, modules blancs, ailes bleues, radiateurs rouges
    const poutre  = new THREE.MeshStandardMaterial({color:0xff9a2e, metalness:.2, roughness:.5, emissive:0x4a2400});
    const gris    = new THREE.MeshStandardMaterial({color:0xf4f4f4, metalness:.2, roughness:.5, emissive:0x303030});
    const panneau = new THREE.MeshStandardMaterial({color:0x2f6bff, metalness:.3, roughness:.4, emissive:0x0a2a80});
    const radiat  = new THREE.MeshStandardMaterial({color:0xe5483a, metalness:.1, roughness:.6, emissive:0x501410});
    const boite = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), mat); m.position.set(x,y,z); g.add(m); return m; };
    boite(poutre, 0.10, 2.6, 0.10, 0, 0, 0);               // poutre (perpendiculaire à l'orbite)
    boite(radiat, 0.02, 0.5, 0.9, 0, 0.55, 0.0);           // radiateurs
    boite(radiat, 0.02, 0.5, 0.9, 0, -0.55, 0.0);
    const mod = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 16), gris);
    mod.rotation.x = Math.PI/2; g.add(mod);                // modules, dans le sens du vol
    for(const sy of [-1, 1]) for(const sz of [-0.28, 0.28])
      boite(panneau, 0.02, 0.9, 0.5, 0, sy*1.7, sz);       // ailes solaires
  }
});
