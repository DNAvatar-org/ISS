// File: js/couronne.js
// Desc: Couronne solaire : atmosphère réelle du Soleil, structurée (jets, plumes polaires), visible seulement à la totalité.
// Version 1.1.0
// Date: [October 06, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Contrairement à l'éblouissement, la couronne est un objet : elle est centrée sur le Soleil, derrière la Lune, qui en
   cache la partie intérieure (davantage du côté où la Lune déborde). Elle est environ un million de fois moins lumineuse
   que le disque : le moindre croissant la noie dans l'éblouissement. Elle ne paraît donc qu'au-delà de ~99,8 %
   de recouvrement par la Lune, en même temps que l'anneau de diamant. Orientation : axe du Soleil ≈ nord écliptique
   (à 7° près). Liseré rose au ras du limbe : la chromosphère, visible quelques secondes aux contacts. */

const COUR = {DEMI:6, PX:512};    // DEMI : demi-côté du carré en rayons solaires ; texture calculée à la 1re totalité

function texCouronne(){
  const n = COUR.PX, cv = document.createElement('canvas'); cv.width = cv.height = n;
  const cx = cv.getContext('2d'), img = cx.createImageData(n, n), px = img.data;
  // jets (streamers) : angle de position depuis le nord, force — cycle 25 passé son maximum : jets à toutes latitudes
  const JETS = [[1.45, 1.0], [1.85, 0.7], [-1.6, 0.9], [-2.05, 0.55], [2.55, 0.45], [-0.9, 0.4], [0.75, 0.35], [-2.7, 0.3]];
  for(let j = 0; j < n; j++){
    for(let i = 0; i < n; i++){
      const x = (i + 0.5 - n/2)/(n/2)*COUR.DEMI, y = (n/2 - j - 0.5)/(n/2)*COUR.DEMI;
      const r = Math.hypot(x, y), o = 4*(j*n + i);
      px[o+3] = 255;
      if(r < 1){ px[o] = px[o+1] = px[o+2] = 0; continue; }
      const phi = Math.atan2(x, y), lat = Math.PI/2 - Math.abs(phi);
      const equateur = 0.55 + 0.6*Math.exp(-((lat/0.5)**2));
      const polaire = lisseEcl(0.9, 1.2, Math.abs(lat));
      const plumes = 1 + polaire*(0.6*Math.cos(46*phi)**4 - 0.25);
      const stries = 1 + 0.12*Math.sin(23*phi + 3*Math.sin(7*phi)) + 0.08*Math.sin(61*phi);
      let jets = 0;
      for(const [a, f] of JETS){
        const da = Math.atan2(Math.sin(phi - a), Math.cos(phi - a)), sig = 0.07 + 0.22/r;   // en casque : large au pied, fin au loin
        jets += f*Math.exp(-((da/sig)**2));
      }
      let B = 1.4*r**-7 + (0.45*equateur*plumes + 0.7*jets)*r**-2.6*stries;
      B *= 1 - lisseEcl(4.5, COUR.DEMI, r);
      const ch = 0.8*(1 - lisseEcl(1.0, 1.035, r));             // chromosphère
      px[o]   = 255*Math.min(1, 1 - Math.exp(-1.5*B) + ch);
      px[o+1] = 255*Math.min(1, 1 - Math.exp(-1.45*B) + 0.35*ch);
      px[o+2] = 255*Math.min(1, 1 - Math.exp(-1.35*B) + 0.45*ch);
    }
  }
  cx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}

function creerCouronne(){
  // texture calculée seulement à la première totalité (majCouronne) : ~0,15 s de calcul, pas au démarrage sur téléphone
  COUR.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
    blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, opacity:0}));   // test de profondeur : la Lune la masque
  SOL.groupe.add(COUR.mesh);
}

const _cx = new THREE.Vector3(), _cy = new THREE.Vector3(), _cz = new THREE.Vector3(), _cm = new THREE.Matrix4();
// fLune : part du disque solaire non couverte par la Lune, vue de la caméra qui dessine (majEblouissement).
function majCouronne(fLune){
  const k = 1 - lisseEcl(2e-4, 2e-3, fLune);
  COUR.mesh.visible = k > 0;
  if(!COUR.mesh.visible) return;
  if(!COUR.mesh.material.map){ COUR.mesh.material.map = texCouronne(); COUR.mesh.material.needsUpdate = true; }
  COUR.mesh.material.opacity = k;
  COUR.mesh.scale.setScalar(CFG.SUN_D*Math.tan(ETAT.rSol)*COUR.DEMI);
  _cz.copy(ETAT.S).negate();                                                  // face à l'observateur
  _cy.copy(ETAT.Mnord).addScaledVector(_cz, -ETAT.Mnord.dot(_cz)).normalize();  // axe solaire ≈ nord écliptique
  _cx.crossVectors(_cy, _cz);
  COUR.mesh.quaternion.setFromRotationMatrix(_cm.makeBasis(_cx, _cy, _cz));
}
