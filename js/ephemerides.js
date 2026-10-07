// File: js/ephemerides.js
// Desc: Position RÉELLE de l'ISS à un instant UTC : éphémérides NASA (iss-ephem-data.js) ou TLE CelesTrak du jour (SGP4).
// Version 1.0.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Sources, par ordre de préférence pour l'instant demandé :
     1. NASA (OEM JSC, EPHEM_ISS) : un état (position, vitesse) toutes les 4 h, propagé jusqu'à l'instant (RK4, J2,
        ±2 h au plus : ~1 km d'écart). Trajectoire reconstituée pour le passé, prévision (manœuvres prévues comprises)
        au-delà de EPHEM_ISS.fiable ;
     2. TLE CelesTrak chargé à l'ouverture (SGP4, satellite.js) : préféré à la prévision NASA, utilisable à ±15 jours
        de son époque — c'est lui qui sert pour « maintenant » quand les données NASA embarquées ont vieilli ;
     3. sinon le MODÈLE (orbite.js : plan calé sur le 19 juin 2021, phase arbitraire) : villes et sol ne sont pas les vrais.
   Repères : OEM en EME2000 (J2000) → précession vers l'équateur moyen de la date, celui du Soleil, de la Lune et du
   temps sidéral (orbite.js). SGP4 donne du TEME (équinoxe moyen de la date) : utilisé tel quel (nutation < 1 km).
   Latitude passée en géodésique (Terre sphérique, cartes géodésiques), cf. planReelISS.
   De l'état on tire le plan (nœud, normale), l'argument de latitude u, la période et le rayon : satellites.js cale
   la phase de l'ISS dessus à chaque trame. */
const EPH = {tle:null, tleEpoque:0, tleEtat:'chargement', src:'modele', plan:null};
const MU_T = 398600.4418, RE_T = 6378.137, J2_T = 1.08262668e-3;   // km, s (mêmes que outils/ephemerides-iss.py)
const TLE_JOURS = 15;
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';

// jours depuis le 1er janv. 2021 (jourDate) ↔ secondes Unix
const unixDeJour = jours => Date.UTC(2021, 0, 1)/1000 + jours*86400;

// Précession IAU 1976 : J2000 → équateur et équinoxe moyens de la date (0,3° en 2021).
function precession(unix){
  const T = (unix/86400 + 2440587.5 - 2451545.0)/36525, as = Math.PI/648000;
  const ze = (2306.2181*T + 0.30188*T*T + 0.017998*T*T*T)*as;
  const z  = (2306.2181*T + 1.09468*T*T + 0.018203*T*T*T)*as;
  const th = (2004.3109*T - 0.42665*T*T - 0.041833*T*T*T)*as;
  const cz = Math.cos(ze), sz = Math.sin(ze), cZ = Math.cos(z), sZ = Math.sin(z), ct = Math.cos(th), st = Math.sin(th);
  return [[cz*ct*cZ - sz*sZ, -sz*ct*cZ - cz*sZ, -st*cZ],
          [cz*ct*sZ + sz*cZ, -sz*ct*sZ + cz*cZ, -st*sZ],
          [cz*st,            -sz*st,             ct   ]];
}
const mulMat = (P, v) => [P[0][0]*v[0] + P[0][1]*v[1] + P[0][2]*v[2], P[1][0]*v[0] + P[1][1]*v[1] + P[1][2]*v[2], P[2][0]*v[0] + P[2][1]*v[1] + P[2][2]*v[2]];

// Gravité terrestre avec l'aplatissement (J2), en km/s².
function accJ2(x, y, z){
  const r2 = x*x + y*y + z*z, r = Math.sqrt(r2), zr2 = z*z/r2;
  const k = -MU_T/(r2*r), j = 1.5*J2_T*MU_T*RE_T*RE_T/(r2*r2*r);
  return [k*x + j*x*(5*zr2 - 1), k*y + j*y*(5*zr2 - 1), k*z + j*z*(5*zr2 - 3)];
}
// RK4, pas ≤ 30 s : état [x, y, z, vx, vy, vz] (km, km/s) propagé de « duree » secondes (négatif : vers le passé).
function propagerJ2(s, duree){
  const n = Math.max(1, Math.ceil(Math.abs(duree)/30)), h = duree/n;
  let [x, y, z, u, v, w] = s;
  for(let i=0;i<n;i++){
    const a1 = accJ2(x, y, z);
    const u2 = u + h/2*a1[0], v2 = v + h/2*a1[1], w2 = w + h/2*a1[2];
    const a2 = accJ2(x + h/2*u, y + h/2*v, z + h/2*w);
    const u3 = u + h/2*a2[0], v3 = v + h/2*a2[1], w3 = w + h/2*a2[2];
    const a3 = accJ2(x + h/2*u2, y + h/2*v2, z + h/2*w2);
    const u4 = u + h*a3[0], v4 = v + h*a3[1], w4 = w + h*a3[2];
    const a4 = accJ2(x + h*u3, y + h*v3, z + h*w3);
    x += h/6*(u + 2*u2 + 2*u3 + u4); y += h/6*(v + 2*v2 + 2*v3 + v4); z += h/6*(w + 2*w2 + 2*w3 + w4);
    u += h/6*(a1[0] + 2*a2[0] + 2*a3[0] + a4[0]); v += h/6*(a1[1] + 2*a2[1] + 2*a3[1] + a4[1]); w += h/6*(a1[2] + 2*a2[2] + 2*a3[2] + a4[2]);
  }
  return [x, y, z, u, v, w];
}

// Données NASA : état à l'instant (équateur moyen de la date), ou null hors couverture / dans un trou.
function etatNasa(unix){
  const E = EPHEM_ISS, i = Math.round((unix - E.debut)/E.pas);
  if(i < 0 || i >= E.n) return null;
  const v = E.v, k = 6*i;
  if(v[k] === 0 && v[k+1] === 0 && v[k+2] === 0) return null;
  const s = propagerJ2([v[k]/1000, v[k+1]/1000, v[k+2]/1000, v[k+3]/1e6, v[k+4]/1e6, v[k+5]/1e6], unix - (E.debut + i*E.pas));
  const P = precession(unix);
  return {r:mulMat(P, s.slice(0, 3)), v:mulMat(P, s.slice(3))};
}

// TLE du jour : état à l'instant (TEME ≈ équateur moyen de la date), ou null si trop loin de l'époque du TLE.
function etatTle(unix){
  if(!EPH.tle || Math.abs(unix - EPH.tleEpoque) > TLE_JOURS*86400) return null;
  const pv = satellite.propagate(EPH.tle, new Date(unix*1000));
  if(!pv.position) return null;
  const p = pv.position, w = pv.velocity;
  return {r:[p.x, p.y, p.z], v:[w.x, w.y, w.z]};
}

// Plan réel de l'ISS à la date : nœud ascendant, normale, argument de latitude u, période et rayon ; null = modèle.
function planReelISS(jours){
  const unix = unixDeJour(jours);
  let e = null, src = 'modele';
  if(unix > EPHEM_ISS.fiable){ e = etatTle(unix); src = 'tle'; }        // au-delà des données reconstituées : le TLE d'abord
  if(!e){ e = etatNasa(unix); src = unix > EPHEM_ISS.fiable ? 'prevision' : 'nasa'; }
  if(!e){ e = etatTle(unix); src = 'tle'; }
  if(!e) return null;
  // Terre sphérique, cartes en latitude GÉODÉSIQUE : on relève la latitude de l'ISS d'autant (tan φg = tan φc / K),
  // sinon le sol sous elle serait décalé jusqu'à 0,19° (20 km). Même étirement sur la vitesse, rayon conservé.
  const K = 1 - 0.00669438*6380/(6380 + 420), rn = Math.hypot(...e.r);
  const rz = [e.r[0], e.r[1], e.r[2]/K], kr = rn/Math.hypot(...rz);
  const r = rz.map(c => c*kr), v = [e.v[0]*kr, e.v[1]*kr, e.v[2]/K*kr];
  const h = [r[1]*v[2] - r[2]*v[1], r[2]*v[0] - r[0]*v[2], r[0]*v[1] - r[1]*v[0]];
  const hn = Math.hypot(...h), N = h.map(c => c/hn);
  const ndn = Math.hypot(N[0], N[1]), nd = [-N[1]/ndn, N[0]/ndn, 0];  // pôle × normale : vers le nœud ascendant
  const b = [N[1]*nd[2] - N[2]*nd[1], N[2]*nd[0] - N[0]*nd[2], N[0]*nd[1] - N[1]*nd[0]];   // normale × nœud : 90° plus loin
  const v2 = v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
  const a = 1/(2/rn - v2/MU_T);                                         // demi-grand axe (vis-viva)
  return {nd, N, u:Math.atan2(dot3(r, b), dot3(r, nd)), T:2*Math.PI*Math.sqrt(a*a*a/MU_T), R:rn/100, src};
}

// Plan de l'ISS à la date : réel si une source le donne, sinon le modèle. Mémorisé dans EPH (satellites.js, ui.js).
function planISS(jours){
  EPH.plan = planReelISS(jours);
  EPH.src = EPH.plan ? EPH.plan.src : 'modele';
  return EPH.plan || planModeleISS(jours);
}

// TLE du jour (seul accès réseau de la page, hors tuiles) : sans lui, « maintenant » reste servi par la prévision NASA.
fetch(TLE_URL)
  .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
  .then(txt => {
    const l = txt.split('\n').map(s => s.trim()).filter(s => /^[12] /.test(s));
    if(l.length < 2) throw new Error('TLE illisible');
    EPH.tle = satellite.twoline2satrec(l[0], l[1]);
    EPH.tleEpoque = (EPH.tle.jdsatepoch - 2440587.5)*86400;
    EPH.tleEtat = 'ok';
  })
  .catch(err => { EPH.tleEtat = 'indisponible (' + err.message + ')'; });
