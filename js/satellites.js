// File: js/satellites.js
// Desc: Satellites : registre, orbite de chacun (plan, position, orientation), anneaux, satellite observateur (OBS).
// Version 1.1.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Chaque satellite (iss.js, hubble.js, iridium.js) s'enregistre avec ses éléments orbitaux :
     incl (rad), alt (unités de 100 km), T (période, s), phi (phase à t = 0, rad), dOm (écart du nœud ascendant avec
     celui de l'ISS à la date de référence, rad), derive (régression du nœud, rad/jour), couleurs d'anneau jour / nuit.
   Repère de la scène = celui de l'ISS (son plan orbital est XZ). Pour un satellite s, à la date j :
     Ω_s = Ω_ISS(j) + dOm + (derive_s − derive_ISS)·(j − JOUR_REF),
     position = r·(cos θ·e1 + sin θ·e2) avec e1 = −(direction du nœud), e2 = nœud × normale, θ = 2π t/T + phi,
   exprimés en équatorial puis passés dans la scène par ETAT.vers. Pour l'ISS (dOm = 0) on retrouve exactement
   pos = r·(cos θ, 0, −sin θ).
   Le repère local d'un satellite est celui de l'ISS : +X zénith, +Y normale orbitale, −Z sens du vol. */
const SATS = [];
let OBS = null;                  // satellite observateur : la caméra embarquée est dedans (le premier enregistré au départ)

// Régression du nœud due à l'aplatissement de la Terre (J2) : −9,964°/jour·(Re/a)^3,5·cos i
const deriveNoeud = (incl, R) => -9.964*DEG*Math.pow(6378/(R*100), 3.5)*Math.cos(incl);

function enregistrerSat(d){
  d.R = CFG.R + d.alt;
  d.e1 = new THREE.Vector3(1,0,0); d.e2 = new THREE.Vector3(0,0,-1); d.N = new THREE.Vector3(0,1,0);
  d.beta = 0; d.thetaSol = 0;
  d.T0 = d.T; d.R0 = d.R;          // valeurs du modèle (l'ISS les quitte quand sa position réelle est connue)
  SATS.push(d);
  if(!OBS) OBS = d;
  return d;
}

const omegaISS = jours => REF.alpha + CFG.DEPHASAGE_REF + CFG.DERIVE_NOEUD*(jours - CFG.JOUR_REF);

// Plan de chaque satellite dans la scène à la date (à rappeler quand ETAT.vers change : calculerSoleil).
// ISS à position réelle (EPH.plan, ephemerides.js) : son plan, sa période, son rayon, et sa phase calée pour que
// thetaSat(ISS, ETAT.t) = u + π (θ = 0 au nœud DESCENDANT, cf. e1) ; tEntree, cycleNuit, jauges en découlent.
function majPlansSat(jours){
  for(const s of SATS){
    let nd, N;
    if(s.id === 'iss' && EPH.plan){
      const p = EPH.plan;
      nd = p.nd; N = p.N; s.T = p.T; s.R = p.R;
      s.phi = p.u + Math.PI - 2*Math.PI*ETAT.t/s.T;
    }else{
      if(s.id === 'iss'){ s.T = s.T0; s.R = s.R0; }   // modèle : la phase reste, pour ne pas sauter
      const om = omegaISS(jours) + s.dOm + (s.derive - CFG.DERIVE_NOEUD)*(jours - CFG.JOUR_REF);
      const si = Math.sin(s.incl), ci = Math.cos(s.incl);
      nd = [Math.cos(om), Math.sin(om), 0]; N = [Math.sin(om)*si, -Math.cos(om)*si, ci];
    }
    const nxN = [nd[1]*N[2]-nd[2]*N[1], nd[2]*N[0]-nd[0]*N[2], nd[0]*N[1]-nd[1]*N[0]];
    ETAT.vers([-nd[0], -nd[1], -nd[2]], s.e1); ETAT.vers(nxN, s.e2); ETAT.vers(N, s.N);
    s.beta = Math.asin(Math.max(-1, Math.min(1, ETAT.S.dot(s.N))));
    s.thetaSol = Math.atan2(ETAT.S.dot(s.e2), ETAT.S.dot(s.e1));
  }
  ETAT.beta = OBS.beta; ETAT.thetaSol = OBS.thetaSol;
}

const thetaSat = (s, t) => 2*Math.PI*t/s.T + s.phi;
const thetaObs = t => thetaSat(OBS, t);

// Halo blanc flou de taille d'écran constante : retrouver un satellite même minuscule. Texture partagée, teinte par satellite.
let HALO_TEX = null;
function texHalo(){
  if(HALO_TEX) return HALO_TEX;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d'), halo = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  halo.addColorStop(0, 'rgba(255,255,255,.95)'); halo.addColorStop(.3, 'rgba(255,255,255,.55)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = halo; cx.fillRect(0, 0, 64, 64);
  return HALO_TEX = new THREE.CanvasTexture(cv);
}

function creerSats(){
  for(const s of SATS){
    s.groupe = new THREE.Group();
    s.modele = new THREE.Group();
    s.groupe.add(s.modele);
    s.creerModele(s.modele);
    s.marque = new THREE.Sprite(new THREE.SpriteMaterial({map:texHalo(), color:new THREE.Color(...s.jour), sizeAttenuation:false, depthWrite:false, transparent:true}));
    s.marque.scale.setScalar(0.035); s.marque.renderOrder = -1;
    s.groupe.add(s.marque);
    scene.add(s.groupe);

    // anneau d'orbite dans le plan du satellite (orienté à chaque trame, cf. majSats), arc à l'ombre coloré
    const N = 360, pos = new Float32Array((N+1)*3);
    for(let i=0;i<=N;i++){ const a = i/N*2*Math.PI; pos.set([Math.cos(a)*s.R, 0, -Math.sin(a)*s.R], i*3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array((N+1)*3), 3));
    s.anneau = new THREE.Line(g, new THREE.LineBasicMaterial({vertexColors:true}));
    s.anneau.frustumCulled = false;
    scene.add(s.anneau);
  }
  colorerOrbite();
}

// Arc d'ombre de chaque anneau, centré sur l'anti-solaire θs + π. À rappeler quand le Soleil ou un plan bouge.
function colorerOrbite(){
  for(const s of SATS){
    const col = s.anneau.geometry.attributes.color, N = col.count - 1, d = demiNuit(s), c = s.thetaSol + Math.PI;
    for(let i=0;i<=N;i++){
      const a = i/N*2*Math.PI, ecart = ((a - c + 3*Math.PI) % (2*Math.PI)) - Math.PI, nuit = Math.abs(ecart) < d;
      const k = nuit ? s.nuit : s.jour;
      col.setXYZ(i, k[0], k[1], k[2]);
    }
    col.needsUpdate = true;
  }
}

const _sx = new THREE.Vector3(), _sz = new THREE.Vector3(), _sm = new THREE.Matrix4();
// Place chaque satellite et son anneau selon ETAT.t (les plans viennent de majPlansSat).
function majSats(t){
  for(const s of SATS){
    const th = thetaSat(s, t);
    s.groupe.position.copy(s.e1).multiplyScalar(Math.cos(th)).addScaledVector(s.e2, Math.sin(th)).multiplyScalar(s.R);
    _sx.copy(s.groupe.position).normalize();                       // zénith
    _sz.crossVectors(_sx, s.N);                                    // −sens du vol
    s.groupe.quaternion.setFromRotationMatrix(_sm.makeBasis(_sx, s.N, _sz));
    _sz.crossVectors(s.e1, s.N);
    s.anneau.quaternion.setFromRotationMatrix(_sm.makeBasis(s.e1, s.N, _sz));
    s.anneau.scale.setScalar(s.R/s.R0);                            // anneau construit au rayon du modèle
  }
}

// Change de satellite observateur : la caméra embarquée passe dedans, la trace au sol repart de zéro.
function activerSat(id){
  const s = SATS.find(x => x.id === id);
  if(!s) throw new Error('Satellite inconnu : ' + id);
  if(s === OBS) return;
  OBS = s;
  s.groupe.add(camIss);
  ETAT.beta = s.beta; ETAT.thetaSol = s.thetaSol;
  TERRE.nTrace = 0; TERRE.tTrace = -1e12;
  colorerOrbite();
}
