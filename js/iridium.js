// File: js/iridium.js
// Desc: Satellite Iridium : éléments orbitaux (86,4°, ~780 km, quasi polaire), modèle simple, logo.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Éléments réalistes ; le nœud est choisi pour que le plan soit orthogonal à celui de l'ISS à la date de référence :
   cos ΔΩ = −cos i₁·cos i₂ / (sin i₁·sin i₂) (≈ 92,9°). Le plan de l'ISS dérive de −5°/jour, celui-ci de −0,4°/jour :
   l'orthogonalité ne tient donc que quelques jours autour de la date de référence. */
const _alt_iridium = 7.8, _i_iridium = 86.4*DEG;
enregistrerSat({
  id:'iridium', nom:'Iridium', info:'Iridium : 86,4°, 780 km, 100 min (plan ⟂ ISS le 19 juin 2021)',
  incl:_i_iridium, alt:_alt_iridium, T:6018, phi:2.2,
  dOm:Math.acos(-Math.cos(CFG.INCL)*Math.cos(_i_iridium)/(Math.sin(CFG.INCL)*Math.sin(_i_iridium))),
  derive:deriveNoeud(_i_iridium, CFG.R + _alt_iridium),
  jour:[0.40, 1.0, 0.50], nuit:[0.15, 0.55, 0.45],
  logo:'<svg class="ico" viewBox="0 0 24 18" aria-hidden="true"><rect x="8.5" y="5" width="7" height="8" rx="1" fill="#9aa3b2"/>'
     + '<g fill="#2f6bff"><rect x="0.5" y="6" width="6.5" height="6"/><rect x="17" y="6" width="6.5" height="6"/></g>'
     + '<g stroke="#e8ecf2" stroke-width="1.4" stroke-linecap="round"><path d="M9.5 13 L7.5 17.2"/><path d="M12 13 V17.6"/><path d="M14.5 13 L16.5 17.2"/></g></svg>',
  creerModele(g){
    const corps = new THREE.MeshStandardMaterial({color:0xaab2c0, metalness:.3, roughness:.5, emissive:0x2c3038});
    const aile  = new THREE.MeshStandardMaterial({color:0x2f6bff, metalness:.3, roughness:.4, emissive:0x0a2a80});
    const ant   = new THREE.MeshStandardMaterial({color:0xe8ecf2, metalness:.2, roughness:.5, emissive:0x3a3d44});
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.5), corps); g.add(m);
    for(const sy of [-1, 1]){
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 0.4), aile);
      p.position.set(0, sy*0.65, 0); g.add(p);                           // deux ailes solaires
    }
    for(let k=0;k<3;k++){                                                // trois antennes planes vers la Terre
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.5), ant);
      a.position.set(-0.3, 0, 0); a.rotation.x = k*2*Math.PI/3 + Math.PI/2; g.add(a);
    }
  }
});
