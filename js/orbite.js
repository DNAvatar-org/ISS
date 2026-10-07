// File: js/orbite.js
// Desc: Mécanique : position de l'ISS, Soleil à une date donnée (donc β), géométrie de l'éclipse, rotation de la Terre.
// Version 1.2.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Repère de la scène : orbite dans le plan XZ, pos(θ) = r·(cos θ, 0, −sin θ), moment cinétique N = +Y,
   axe de la Terre A = (0, cos i, sin i). Le Soleil n'est plus posé à la main : on le calcule pour une date.
   β = angle entre le Soleil et le plan de l'orbite = asin(S·N). Il bouge parce que :
   – le Soleil avance de ~1°/jour sur l'écliptique,
   – le plan de l'orbite pivote de ~−5°/jour (régression des nœuds, due à l'aplatissement de la Terre),
   d'où un cycle de β d'environ 60 jours, modulé par la saison. */

const dirSoleil = out => out.copy(ETAT.S);

/* Éphéméride solaire basse précision (Astronomical Almanac). jours = jours depuis le 1er janvier 2021, 0 h UTC. */
function ephemSoleil(jours){
  const n = 2459215.5 + jours - 2451545.0;                       // jours depuis J2000
  const L = 280.460 + 0.9856474*n, g = (357.528 + 0.9856003*n)*DEG;
  const lam = (L + 1.915*Math.sin(g) + 0.020*Math.sin(2*g))*DEG;  // longitude écliptique
  const eps = (23.439 - 4e-7*n)*DEG;
  const ua = 1.00014 - 0.01671*Math.cos(g) - 0.00014*Math.cos(2*g);   // distance Terre–Soleil (ua)
  return {alpha:Math.atan2(Math.cos(eps)*Math.sin(lam), Math.cos(lam)), delta:Math.asin(Math.sin(eps)*Math.sin(lam)), lam, eps, ua};
}

/* Lune : théorie de Meeus (Astronomical Algorithms, chap. 47), termes principaux — quelques secondes d'arc,
   assez pour les éclipses (le Soleil fait 0,27° de rayon). La distance compte : Lune loin = disque trop petit
   pour couvrir le Soleil = éclipse annulaire (10 juin 2021), Lune proche = totale (4 décembre 2021). */
const MEEUS_LR = [   // D, M, M', F, Σl (1e-6 °), Σr (1e-3 km)
  [0,0,1,0, 6288774,-20905355],[2,0,-1,0, 1274027,-3699111],[2,0,0,0, 658314,-2955968],[0,0,2,0, 213618,-569925],
  [0,1,0,0,-185116, 48888],[0,0,0,2,-114332,-3149],[2,0,-2,0, 58793, 246158],[2,-1,-1,0, 57066,-152138],
  [2,0,1,0, 53322,-170733],[2,-1,0,0, 45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720, 108743],
  [0,1,1,0,-30383, 104755],[2,0,0,-2, 15327, 10321],[0,0,1,2,-12528, 0],[0,0,1,-2, 10980, 79661],
  [4,0,-1,0, 10675,-34782],[0,0,3,0, 10034,-23210],[4,0,-2,0, 8548,-21636],[2,1,-1,0,-7888, 24208],
  [2,1,0,0,-6766, 30824],[1,0,-1,0,-5163,-8379],[1,1,0,0, 4987,-16675],[2,-1,1,0, 4036,-12831],
  [2,0,2,0, 3994,-10445],[4,0,0,0, 3861,-11650],[2,0,-3,0, 3665, 14403],[0,1,-2,0,-2689,-7003],
  [2,0,-1,2,-2602, 0],[2,-1,-2,0, 2390, 10056],[1,0,1,0,-2348, 6322],[2,-2,0,0, 2236,-9884]
];
const MEEUS_B = [    // D, M, M', F, Σb (1e-6 °)
  [0,0,0,1, 5128122],[0,0,1,1, 280602],[0,0,1,-1, 277693],[2,0,0,-1, 173237],[2,0,-1,1, 55413],
  [2,0,-1,-1, 46271],[2,0,0,1, 32573],[0,0,2,1, 17198],[2,0,1,-1, 9266],[0,0,2,-1, 8822],
  [2,-1,0,-1, 8216],[2,0,-2,-1, 4324],[2,0,1,1, 4200],[2,1,0,-1,-3359],[2,-1,-1,1, 2463],
  [2,-1,0,1, 2211],[2,-1,-1,-1, 2065],[0,1,-1,-1,-1870],[4,0,-1,-1, 1828],[0,1,0,1,-1794]
];
function ephemLune(jours){
  const T = (2459215.5 + jours - 2451545.0)/36525;                 // siècles depuis J2000
  const deg = x => (x % 360)*DEG;
  const Lp = deg(218.3164477 + 481267.88123421*T), D = deg(297.8501921 + 445267.1114034*T);
  const M  = deg(357.5291092 + 35999.0502909*T),   Mp = deg(134.9633964 + 477198.8675055*T);
  const F  = deg(93.2720950 + 483202.0175233*T),   E = 1 - 0.002516*T;
  let sl = 0, sr = 0, sb = 0;
  for(const [d, m, mp, f, l, r] of MEEUS_LR){
    const arg = d*D + m*M + mp*Mp + f*F, e = Math.pow(E, Math.abs(m));
    sl += l*e*Math.sin(arg); sr += r*e*Math.cos(arg);
  }
  for(const [d, m, mp, f, b] of MEEUS_B) sb += b*Math.pow(E, Math.abs(m))*Math.sin(d*D + m*M + mp*Mp + f*F);
  const A1 = deg(119.75 + 131.849*T), A2 = deg(53.09 + 479264.290*T), A3 = deg(313.45 + 481266.484*T);
  sl += 3958*Math.sin(A1) + 1962*Math.sin(Lp - F) + 318*Math.sin(A2);
  sb += -2235*Math.sin(Lp) + 382*Math.sin(A3) + 175*Math.sin(A1 - F) + 175*Math.sin(A1 + F) + 127*Math.sin(Lp - Mp) - 115*Math.sin(Lp + Mp);
  const lam = Lp + sl*1e-6*DEG, bet = sb*1e-6*DEG;
  const dist = (385000.56 + sr/1000)/100;                            // unités de la scène (100 km)
  const eps = (23.439 - 4e-7*(T*36525))*DEG;
  const x = Math.cos(bet)*Math.cos(lam);
  const y = Math.cos(bet)*Math.sin(lam)*Math.cos(eps) - Math.sin(bet)*Math.sin(eps);
  const z = Math.cos(bet)*Math.sin(lam)*Math.sin(eps) + Math.sin(bet)*Math.cos(eps);
  return {eq:[x, y, z], lam, dist};
}

// Temps sidéral de Greenwich (rad) : l'angle de rotation de la Terre à l'heure UT de la date.
function gmst(jours){
  const n = 2459215.5 + jours - 2451545.0;
  return (((280.46061837 + 360.98564736629*n) % 360) + 360) % 360 * DEG;
}

/* Plan orbital de l'ISS : le vrai quand ephemerides.js a une source pour la date (NASA, TLE). Sinon le MODÈLE :
   ascension droite du nœud (Ω) CALÉE pour que β = 49° (≈ 30 min de nuit) à la date de référence, puis −5°/jour. */
const REF = ephemSoleil(CFG.JOUR_REF);

function planModeleISS(jours){
  const om = REF.alpha + CFG.DEPHASAGE_REF + CFG.DERIVE_NOEUD*(jours - CFG.JOUR_REF);   // Ω
  const si = Math.sin(CFG.INCL), ci = Math.cos(CFG.INCL);
  return {nd:[Math.cos(om), Math.sin(om), 0], N:[Math.sin(om)*si, -Math.cos(om)*si, ci]};   // nœud ascendant, normale
}

const dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

function calculerSoleil(jours){
  const e = ephemSoleil(jours);
  const cd = Math.cos(e.delta);
  const Seq = [cd*Math.cos(e.alpha), cd*Math.sin(e.alpha), Math.sin(e.delta)];          // Soleil, repère équatorial
  const {nd, N} = planISS(jours);                                                       // nœud ascendant, normale (réels ou modèle)
  const nxN = [nd[1]*N[2]-nd[2]*N[1], nd[2]*N[0]-nd[0]*N[2], nd[0]*N[1]-nd[1]*N[0]];
  // repère de la scène : x = −nœud, y = normale orbitale, z = −(nœud × normale) (l'axe de la Terre y vaut (0, cos i, sin i))
  const vers = (v, out) => out.set(-dot3(v, nd), dot3(v, N), -dot3(v, nxN));
  ETAT.vers = vers;                                       // équatorial → scène (orientation de la Terre, cf. terre.js)
  ETAT.gmst = gmst(jours);
  vers(Seq, ETAT.S);
  ETAT.rSol = 0.26656*DEG/e.ua;                           // rayon apparent : 0,262° en juillet, 0,271° en janvier

  // Lune dans le même repère ; pôle nord écliptique (celui de son axe, à 1,5° près) ; phase
  const m = ephemLune(jours);
  vers(m.eq, ETAT.M);
  ETAT.Mdist = m.dist;
  vers([0, -Math.sin(e.eps), Math.cos(e.eps)], ETAT.Mnord);
  const elong = Math.acos(Math.max(-1, Math.min(1, ETAT.M.dot(ETAT.S))));
  const dlam = (((m.lam - e.lam)/DEG % 360) + 360) % 360;
  ETAT.lune.illum = (1 - Math.cos(elong))/2;
  ETAT.lune.croissante = dlam < 180;
  majPlansSat(jours);                                     // plan de chaque satellite ; β et direction du Soleil dans le plan de l'observateur
}

// Demi-arc d'ombre (rad) du satellite s (observateur par défaut), centré sur l'anti-solaire θ = θs + π.
function demiNuit(s = OBS){
  const k = Math.sqrt(1 - (CFG.R/s.R)**2) / Math.cos(s.beta);
  return k >= 1 ? 0 : Math.acos(k);
}
const dureeNuit = () => OBS.T * demiNuit() / Math.PI;
// instant (s) où l'observateur est à l'angle θ ; t = 0 ↔ θ = phi
const tTheta = th => OBS.T*(th - OBS.phi)/(2*Math.PI);
const tEntree   = k => tTheta(OBS.thetaSol + Math.PI - demiNuit()) + k*OBS.T;

const _perp = new THREE.Vector3();
function enNuit(pos){
  const d = pos.dot(ETAT.S);
  if(d >= 0) return false;
  return _perp.copy(pos).addScaledVector(ETAT.S, -d).length() < CFG.R;
}

// Position dans le cycle jour/nuit : k = n° du cycle (depuis l'entrée dans l'ombre).
function cycleNuit(t){
  const k = Math.floor((t - tEntree(0))/OBS.T);
  const ecoule = t - tEntree(k), duree = dureeNuit();
  return {k, ecoule, duree, nuit: ecoule < duree};
}

const jourDate = () => ETAT.date0 + ETAT.t/86400;                 // date courante (jours depuis le 1er janv. 2021)
function libelleDate(jours){
  return new Date(Date.UTC(2021, 0, 1) + jours*86400000)
    .toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
}
