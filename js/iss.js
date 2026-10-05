// File: js/iss.js
// Desc: ISS (modèle simple, repère local : +X zénith, +Y normale orbitale, −Z sens du vol) et anneau d'orbite.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* La station tourne avec l'orbite : ISS.groupe.rotation.y = θ garde +X vers le zénith,
   donc le nadir (−X) pointe toujours vers la Terre. Un tour par orbite, comme la Lune. */
const ISS = {};

function creerISS(){
  ISS.groupe = new THREE.Group();
  ISS.modele = new THREE.Group();
  ISS.groupe.add(ISS.modele);

  // colorée de jour (la lumière est coupée dans l'ombre) : poutre orange, modules blancs,
  // ailes bleues, radiateurs rouges
  const poutre  = new THREE.MeshStandardMaterial({color:0xff9a2e, metalness:.2, roughness:.5, emissive:0x4a2400});
  const gris    = new THREE.MeshStandardMaterial({color:0xf4f4f4, metalness:.2, roughness:.5, emissive:0x303030});
  const panneau = new THREE.MeshStandardMaterial({color:0x2f6bff, metalness:.3, roughness:.4, emissive:0x0a2a80});
  const radiat  = new THREE.MeshStandardMaterial({color:0xe5483a, metalness:.1, roughness:.6, emissive:0x501410});
  const boite = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), mat); m.position.set(x,y,z); ISS.modele.add(m); return m; };

  boite(poutre, 0.10, 2.6, 0.10, 0, 0, 0);               // poutre (perpendiculaire à l'orbite)
  boite(radiat, 0.02, 0.5, 0.9, 0, 0.55, 0.0);           // radiateurs
  boite(radiat, 0.02, 0.5, 0.9, 0, -0.55, 0.0);
  const mod = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 16), gris);
  mod.rotation.x = Math.PI/2; ISS.modele.add(mod);        // modules, dans le sens du vol
  for(const sy of [-1, 1]) for(const sz of [-0.28, 0.28])
    boite(panneau, 0.02, 0.9, 0.5, 0, sy*1.7, sz);        // ailes solaires

  // marqueur de taille d'écran constante : retrouver l'ISS même minuscule
  // halo blanc flou derrière la station, de taille d'écran constante : on la voit de loin comme de près.
  // Dessiné avant le modèle et sans écrire la profondeur : le modèle passe devant, la Terre le cache (depthTest).
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d'), halo = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  halo.addColorStop(0, 'rgba(255,255,255,.95)'); halo.addColorStop(.3, 'rgba(255,255,255,.55)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = halo; cx.fillRect(0, 0, 64, 64);
  ISS.marque = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv), sizeAttenuation:false, depthWrite:false, transparent:true}));
  ISS.marque.scale.setScalar(0.035); ISS.marque.renderOrder = -1;
  ISS.groupe.add(ISS.marque);
  scene.add(ISS.groupe);

  // anneau d'orbite, la partie à l'ombre colorée en violet
  const N = 360, pos = new Float32Array((N+1)*3), col = new Float32Array((N+1)*3);
  for(let i=0;i<=N;i++){
    const a = i/N*2*Math.PI;
    pos.set([Math.cos(a)*CFG.R_ORB, 0, -Math.sin(a)*CFG.R_ORB], i*3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ISS.anneau = new THREE.Line(g, new THREE.LineBasicMaterial({vertexColors:true}));
  scene.add(ISS.anneau);
  colorerOrbite();
}

// À rappeler quand le Soleil bouge : l'arc d'ombre est centré sur l'anti-solaire θs + π.
function colorerOrbite(){
  const col = ISS.anneau.geometry.attributes.color, N = col.count - 1, d = demiNuit(), c = ETAT.thetaSol + Math.PI;
  for(let i=0;i<=N;i++){
    const a = i/N*2*Math.PI, ecart = ((a - c + 3*Math.PI) % (2*Math.PI)) - Math.PI, nuit = Math.abs(ecart) < d;
    col.setXYZ(i, nuit ? 0.70 : 0.30, nuit ? 0.45 : 0.85, nuit ? 1.0 : 1.0);
  }
  col.needsUpdate = true;
}
