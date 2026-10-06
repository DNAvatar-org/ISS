// File: js/hubble.js
// Desc: Télescope spatial Hubble : éléments orbitaux (28,5°, ~540 km), modèle simple, logo.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Éléments réalistes (inclinaison, altitude, période, régression du nœud par J2) ; le nœud et la phase sont choisis,
   ce ne sont pas des TLE de la date affichée. */
const _alt_hubble = 5.4;
enregistrerSat({
  id:'hubble', nom:'Hubble', info:'Hubble : 28,5°, 540 km, 95,5 min',
  incl:28.47*DEG, alt:_alt_hubble, T:5727, phi:1.0, dOm:40*DEG, derive:deriveNoeud(28.47*DEG, CFG.R + _alt_hubble),
  jour:[1.0, 0.72, 0.25], nuit:[0.70, 0.30, 0.15],
  logo:'<svg class="ico" viewBox="0 0 24 18" aria-hidden="true"><rect x="5" y="5.5" width="14" height="7" rx="1.2" fill="#d9dde4"/><rect x="17" y="5.5" width="2" height="7" fill="#2a2f3a"/>'
     + '<rect x="7.5" y="5.5" width="2" height="7" fill="#c9a24a"/><g fill="#2f6bff"><rect x="9.5" y="0.5" width="5" height="4.2"/><rect x="9.5" y="13.3" width="5" height="4.2"/></g></svg>',
  creerModele(g){
    const tube  = new THREE.MeshStandardMaterial({color:0xd9dde4, metalness:.3, roughness:.5, emissive:0x2c2f36});
    const dore  = new THREE.MeshStandardMaterial({color:0xc9a24a, metalness:.4, roughness:.5, emissive:0x3a2c0c});
    const aile  = new THREE.MeshStandardMaterial({color:0x2f6bff, metalness:.3, roughness:.4, emissive:0x0a2a80});
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.3, 16), tube);
    t.rotation.x = Math.PI/2; g.add(t);                                  // le tube, dans le sens du vol
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.3, 16), dore);
    c.rotation.x = Math.PI/2; c.position.z = 0.35; g.add(c);
    for(const sy of [-1, 1]){
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 0.35), aile);
      p.position.set(0, sy*0.62, -0.05); g.add(p);                       // deux ailes solaires
    }
  }
});
