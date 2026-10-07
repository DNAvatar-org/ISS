// File: js/ephemerides.js
// Desc: Position RÉELLE des satellites à un instant UTC : SGP4 (satellite.js) et le TLE du jour (historique ou CelesTrak).
// Version 2.0.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Une équation, ses paramètres du jour : la position vient de SGP4, le modèle standard des TLE (gravité avec
   l'aplatissement, freinage atmosphérique, Lune, Soleil), appliqué au TLE le plus proche de l'instant.
     – passé : TLE_HIST (tle-data.js), un TLE par jour depuis 2000 (space-track.org) ;
     – maintenant : le TLE du jour chargé à l'ouverture chez CelesTrak (public), utilisé à ±15 jours de son époque ;
   écart avec la trajectoire NASA : ~2,5 km (6 km au pire). Hors de ces dates, pas de position réelle : le modèle
   (orbite.js) prend le relais et url.js le signale.
   SGP4 rend du TEME (équinoxe moyen de la date) : c'est le repère du Soleil, de la Lune et du temps sidéral (orbite.js).
   Latitude passée en géodésique (Terre sphérique, cartes géodésiques), cf. planReel. De l'état on tire le plan (nœud,
   normale), l'argument de latitude u, la période et le rayon : satellites.js cale la phase dessus à chaque trame.
   precession() sert au ciel (catalogue J2000 → équateur de la date, ciel.js) et à Check Photo. */
const EPH = {sats:{}, src:'modele', plan:null};
const MU_T = 398600.4418;
const TLE_JOURS = 15, HIST_JOURS = 4;                                  // TLE du jour : ±15 j ; historique : ±4 j du plus proche
const CELESTRAK = norad => 'https://celestrak.org/NORAD/elements/gp.php?CATNR=' + norad + '&FORMAT=TLE';
const T2000 = Date.UTC(2000, 0, 1)/1000;

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

/* Historique décodé : époques (s Unix) et 8 entiers par TLE ; les lignes TLE ne sont recomposées (puis données à
   twoline2satrec) qu'à l'usage, et gardées. Colonnes fixes du format TLE, celles que lit satellite.js. */
function decoderHist(id){
  const H = TLE_HIST[id], ep = new Float64Array(H.n);
  let e = 0;
  for(let i=0;i<H.n;i++){ e += H.v[8*i]; ep[i] = T2000 + e/1e8*86400; }
  return {norad:H.norad, ep, v:H.v, rec:new Map()};
}
const fx = (x, w, d) => x.toFixed(d).padStart(w, ' ');
function lignesTLE(norad, unix, k, v){
  const d = new Date(unix*1000), an = d.getUTCFullYear(), jour = (unix - Date.UTC(an, 0, 1)/1000)/86400 + 1;
  const b = v[k+7], a = Math.abs(b), bs = (b < 0 ? '-' : ' ') + String(Math.floor(a/100)).padStart(5, '0') + ((a % 100) - 50 < 0 ? '-' : '+') + Math.abs((a % 100) - 50);
  const no = String(norad).padStart(5, '0');
  const l1 = '1 ' + no + 'U 00000A   ' + String(an % 100).padStart(2, '0') + fx(jour, 12, 8) + '  .00000000  00000-0 ' + bs + ' 0  9990';
  const l2 = '2 ' + no + ' ' + fx(v[k+1]/1e4, 8, 4) + ' ' + fx(v[k+2]/1e4, 8, 4) + ' ' + String(v[k+3]).padStart(7, '0') + ' '
           + fx(v[k+4]/1e4, 8, 4) + ' ' + fx(v[k+5]/1e4, 8, 4) + ' ' + fx(v[k+6]/1e8, 11, 8) + '000000';
  return [l1, l2];
}
function satrecHist(S, i){
  if(!S.rec.has(i)){ const [l1, l2] = lignesTLE(S.norad, S.ep[i], 8*i, S.v); S.rec.set(i, satellite.twoline2satrec(l1, l2)); }
  return S.rec.get(i);
}

// TLE le plus proche de l'instant (historique, ou celui du jour) → satrec, ou null.
function satrecA(id, unix){
  const S = EPH.sats[id];
  if(!S) return null;
  const live = S.live && Math.abs(unix - S.liveEpoque) <= TLE_JOURS*86400 ? S.live : null;
  if(S.hist){
    const ep = S.hist.ep;
    let lo = 0, hi = ep.length - 1;
    while(hi - lo > 1){ const m = (lo + hi) >> 1; if(ep[m] <= unix) lo = m; else hi = m; }
    const i = Math.abs(ep[lo] - unix) < Math.abs(ep[hi] - unix) ? lo : hi;
    const dh = Math.abs(ep[i] - unix);
    if(live && Math.abs(unix - S.liveEpoque) < dh) return live;        // le TLE du jour est plus proche
    if(dh <= HIST_JOURS*86400) return satrecHist(S.hist, i);
  }
  return live;
}

// État (km, km/s ; équateur moyen de la date) du satellite id à l'instant, ou null.
function etatSat(id, unix){
  const s = satrecA(id, unix);
  if(!s) return null;
  const pv = satellite.propagate(s, new Date(unix*1000));
  if(!pv.position) return null;
  const p = pv.position, w = pv.velocity;
  return {r:[p.x, p.y, p.z], v:[w.x, w.y, w.z]};
}

// Plan réel à la date : nœud ascendant, normale, argument de latitude u, période et rayon ; null = pas de données.
function planReel(id, jours){
  const e = etatSat(id, unixDeJour(jours));
  if(!e) return null;
  // Terre sphérique, cartes en latitude GÉODÉSIQUE : on relève la latitude d'autant (tan φg = tan φc / K),
  // sinon le sol sous le satellite serait décalé jusqu'à 0,19° (20 km). Même étirement sur la vitesse, rayon conservé.
  const rn = Math.hypot(...e.r), K = 1 - 0.00669438*6380/rn;
  const rz = [e.r[0], e.r[1], e.r[2]/K], kr = rn/Math.hypot(...rz);
  const r = rz.map(c => c*kr), v = [e.v[0]*kr, e.v[1]*kr, e.v[2]/K*kr];
  const h = [r[1]*v[2] - r[2]*v[1], r[2]*v[0] - r[0]*v[2], r[0]*v[1] - r[1]*v[0]];
  const hn = Math.hypot(...h), N = h.map(c => c/hn);
  const ndn = Math.hypot(N[0], N[1]), nd = [-N[1]/ndn, N[0]/ndn, 0];  // pôle × normale : vers le nœud ascendant
  const b = [N[1]*nd[2] - N[2]*nd[1], N[2]*nd[0] - N[0]*nd[2], N[0]*nd[1] - N[1]*nd[0]];   // normale × nœud : 90° plus loin
  const v2 = v[0]*v[0] + v[1]*v[1] + v[2]*v[2], a = 1/(2/rn - v2/MU_T);   // demi-grand axe (vis-viva)
  return {nd, N, u:Math.atan2(dot3(r, b), dot3(r, nd)), T:2*Math.PI*Math.sqrt(a*a*a/MU_T), R:rn/100};
}

// Plan de l'ISS (repère de la scène) : réel si un TLE couvre la date, sinon le modèle. Mémorisé dans EPH.
function planISS(jours){
  EPH.plan = planReel('iss', jours);
  EPH.src = EPH.plan ? 'reel' : 'modele';
  return EPH.plan || planModeleISS(jours);
}

// Historiques embarqués, puis TLE du jour (seul accès réseau de la page, hors tuiles), gardé dans le navigateur
// (localStorage) et redemandé au plus toutes les 2 h. Sources, dans l'ordre : CelesTrak, puis deux miroirs publics qui
// répondent aux pages web (CORS) — tle.ivanstanojevic.me (JSON), wheretheiss.at (ISS seulement). CelesTrak bloque (403)
// une adresse qui le sollicite trop : après un refus, on ne le redemande pas avant 2 h. Faute de tout, l'ancien TLE
// gardé sert encore à ±15 jours de son époque, et l'historique embarqué au-delà.
const lireCache = cle => { try { return JSON.parse(localStorage.getItem(cle)); } catch(e){ return null; } };
const ecrireCache = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch(e){} };
const DEUX_H = 2*3600*1000;
const lignesDe = txt => { const l = txt.split('\n').map(x => x.trim()).filter(x => /^[12] /.test(x)); if(l.length < 2) throw new Error('TLE illisible'); return l; };
const lire = url => fetch(url).then(r => { if(!r.ok) throw new Error(url.split('/')[2] + ' : HTTP ' + r.status); return r; });
const SOURCES_TLE = [
  {nom:'celestrak', url:CELESTRAK, lignes:r => r.text().then(lignesDe)},
  {nom:'ivanstanojevic', url:n => 'https://tle.ivanstanojevic.me/api/tle/' + n, lignes:r => r.json().then(j => [j.line1, j.line2])},
  {nom:'wheretheiss', url:n => n === 25544 ? 'https://api.wheretheiss.at/v1/satellites/25544/tles?format=text' : null, lignes:r => r.text().then(lignesDe)}
];
function poserTle(S, l1, l2, etat){
  S.live = satellite.twoline2satrec(l1, l2);
  S.liveEpoque = (S.live.jdsatepoch - 2440587.5)*86400;
  S.etat = etat;
}
async function chargerTle(S){
  const cle = 'tle-' + S.hist.norad, c = lireCache(cle);
  if(c) poserTle(S, c.l1, c.l2, 'cache');
  if(c && Date.now() - c.lu < DEUX_H){ S.etat = 'ok (cache, ' + c.src + ')'; return; }
  const refus = lireCache('tle-refus') || {};
  const erreurs = [];
  for(const src of SOURCES_TLE){
    const url = src.url(S.hist.norad);
    if(!url || Date.now() - (refus[src.nom] || 0) < DEUX_H) continue;   // source absente, ou refusée il y a moins de 2 h
    try{
      const [l1, l2] = await lire(url).then(src.lignes);
      poserTle(S, l1, l2, 'ok (' + src.nom + ')');
      ecrireCache(cle, {l1, l2, lu:Date.now(), src:src.nom});
      return;
    }catch(e){
      erreurs.push(e.message);
      refus[src.nom] = Date.now(); ecrireCache('tle-refus', refus);
    }
  }
  S.etat = (S.live ? 'cache ancien' : 'indisponible') + (erreurs.length ? ' (' + erreurs.join(' ; ') + ')' : '');
}
for(const id of Object.keys(TLE_HIST)) EPH.sats[id] = {hist:decoderHist(id), live:null, liveEpoque:0, etat:'chargement'};
for(const S of Object.values(EPH.sats)) chargerTle(S);
