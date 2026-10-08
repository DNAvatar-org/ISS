// File: js/url.js
// Desc: Paramètres d'URL : ?sat=ISS&vue=avant&focale=58&date=30.07.21&heure=22:20:46 (satellite, visée, focale, date et heure UT) ; avis si mal formés ; l'URL suit la vue.
// Version 1.3.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* sat   : id ou nom d'un satellite (iss, hubble, iridium ; casse indifférente). Absent : ISS.
   vue   : visée de la caméra embarquée : pole, antipole (pôle côté Soleil), soleil, obl (Terre oblique), lune, avant,
           nadir (casse indifférente) ; ou vue extérieure : terre, terrelune. Absent : pole.
   decal : avec vue=soleil ou vue=lune, décalage de la visée en hauteur (degrés) : l'astre au-dessus ou au-dessous du centre.
   cam   : vue extérieure, position de la caméra : longitude, latitude (degrés), distance (unités de la scène), ex. 51.6,31.5,250.
   cap   : direction de visée en degrés, 0 = sens du vol, +90 = vers la gauche (normale orbitale), ±180 = vers l'arrière ;
   site  : hauteur en degrés (0 = horizontale, −90 = nadir). Les deux ensemble remplacent vue= (visée libre).
   focale: focale en mm, équivalent 24×36 (ex. 58 ; « 58mm » accepté). Absent : celle de la vue choisie.
   date  : JJ.MM.AA ou JJ.MM.AAAA (format français ; séparateurs . / ou -), entre 2000 et 2035.
   heure : HH:MM, HH:MM:SS ou HH:MM:SS.s, temps universel (UT, comme l'affichage). Sans date : ignorée, avec un avis.
   montrer : orbite, reperes, trace, cone (séparés par des virgules) : cases cochées.
   limbe : bord de l'atmosphère pour la prochaine photo de Check Photo, au lieu de la détection automatique : au moins
           3 points x,y séparés par des points-virgules, en pixels de la photo d'origine (ex. limbe=10,960;910,741;
           1630,711;2380,803), ou en fractions de sa largeur et de sa hauteur si toutes les valeurs sont ≤ 1. Un limbe
           tracé à la main s'y écrit (limbe-manuel.js).
   Date + heure = un instant précis : la simulation démarre en pause. Les autres paramètres ne mettent pas en pause.
   L'ISS est placée à sa position RÉELLE à cet instant UTC (ephemerides.js) quand une source la donne ; sinon un avis
   prévient qu'elle est simulée.
   En retour, l'URL SUIT la vue (majURL, à chaque trame) : satellite, visée (prédéfinie ou cap/site), focale, vue
   extérieure, instant au dixième de seconde, cases. Copier l'adresse et la recoller redonne la même vue, en pause à cet
   instant. */
const URL_P = new URLSearchParams(location.search);
const FORMAT_DATE = 'date=JJ.MM.AA (ex. date=13.02.24 pour le 13 février 2024)';
const FORMAT_HEURE = 'heure=HH:MM:SS en temps universel (ex. heure=04:29:51)';

// Petite fenêtre d'avis (non bloquante), fermée par ✕ ou au premier clic ailleurs.
function avis(lignes){
  const boite = $('avis');
  const txt = $('avisTxt');
  for(const l of lignes){ const p = document.createElement('p'); p.textContent = l; txt.appendChild(p); }
  boite.hidden = false;
  const fermer = () => { boite.hidden = true; removeEventListener('pointerdown', ailleurs, true); };
  const ailleurs = e => { if(!e.target.closest('#avis')) fermer(); };
  $('avisOk').onclick = fermer;
  addEventListener('pointerdown', ailleurs, true);
}

// « 13.02.24 » → jours depuis le 1er janv. 2021 (0 h UT), ou null si mal formée ou hors 2000 – 2035.
function lireDateURL(s){
  const m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/.exec(s.trim());
  if(!m) return null;
  const j = +m[1], mo = +m[2], an = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const d = new Date(Date.UTC(an, mo - 1, j));
  if(d.getUTCDate() !== j || d.getUTCMonth() !== mo - 1) return null;   // 31.02, 00.13…
  if(an < DATES.AN_MIN || an > DATES.AN_MAX) return null;
  return JOUR_DE(an, mo - 1, j);
}

// « 04:29:51 », « 04:29:51.4 » ou « 04:29 » → fraction de jour, ou null.
function lireHeureURL(s){
  const m = /^(\d{1,2})[:h](\d{2})(?:[:m](\d{2}(?:[.,]\d+)?))?$/.exec(s.trim());
  if(!m) return null;
  const h = +m[1], mi = +m[2], se = m[3] ? +m[3].replace(',', '.') : 0;
  if(h > 23 || mi > 59 || se >= 60) return null;
  return (h*3600 + mi*60 + se)/86400;
}

// Satellite demandé (avant le calcul du t de départ, qui dépend de l'observateur).
function appliquerSatURL(){
  const v = URL_P.get('sat');
  if(!v) return [];                                       // absent : ISS (premier enregistré)
  const s = SATS.find(x => x.id === v.toLowerCase() || x.nom.toLowerCase() === v.toLowerCase());
  if(!s) return ['Satellite inconnu : « ' + v + ' ». Choix possibles : ' + SATS.map(x => x.nom).join(', ') + '. ISS affiché.'];
  activerSat(s.id);
  return [];
}

// Visée demandée (vue embarquée, presets de joystick.js).
const VUES_URL = {pole:'pole', antipole:'poleSol', soleil:'soleil', obl:'oblique', oblique:'oblique', lune:'lune', avant:'avant', nadir:'nadir'};
function appliquerVueURL(){
  const v = URL_P.get('vue');
  if(!v) return [];                                       // absent : pôle (la photo)
  if(v.toLowerCase() === 'terre'){ vueTerre(); return []; }
  if(v.toLowerCase() === 'terrelune'){ vueTerreLune(); return []; }   // recadrée après la date (appliquerCamURL)
  const nom = VUES_URL[v.toLowerCase()];
  if(!nom) return ['Vue inconnue : « ' + v + ' ». Choix possibles : pole, antipole, soleil, obl, lune, avant, nadir, terre, terrelune. Pôle affiché.'];
  ETAT.vue = 'iss'; choisirPreset(nom);
  const d = URL_P.get('decal');
  if(d !== null && VUE_ISS.suivi){
    const x = parseFloat(d.replace(',', '.'));
    if(!isFinite(x)) return ['Décalage illisible : decal=' + d + ' (degrés, ex. decal=-10).'];
    VUE_ISS.decal = x*DEG;
  }
  return [];
}

// Vue extérieure : position de la caméra (après la date : sans cam=, la vue Terre–Lune se recadre sur la Lune du jour).
function appliquerCamURL(){
  if(ETAT.vue !== 'ext') return [];
  const c = URL_P.get('cam');
  if(c === null){ if(VUE_EXT.mode === 'lune') vueTerreLune(); return []; }
  const v = c.split(',').map(Number);
  if(v.length !== 3 || !v.every(isFinite) || !(v[2] > 0)) return ['Caméra illisible : cam=' + c + '. Format attendu : cam=51.6,31.5,250 (longitude, latitude en degrés, distance).'];
  VUE_EXT.th = v[0]*DEG; VUE_EXT.ph = Math.max(-1.5, Math.min(1.5, v[1]*DEG)); VUE_EXT.r = v[2];
  return [];
}

// Limbe donné dans l'URL (points de la photo d'origine), lu au démarrage ; appliqué à la photo chargée ensuite.
const LIMBE_URL = {pts:null};
function appliquerLimbeURL(){
  const v = URL_P.get('limbe');
  if(v === null) return [];
  const pts = v.split(';').filter(t => t.trim()).map(t => t.split(',').map(x => parseFloat(x)));
  if(pts.length < 3 || !pts.every(p => p.length === 2 && p.every(isFinite) && p[0] >= 0 && p[1] >= 0))
    return ['Limbe illisible : limbe=' + v + '.', 'Format attendu : au moins 3 points x,y séparés par des points-virgules, en pixels de la photo (ex. limbe=10,960;910,741;1630,711).'];
  LIMBE_URL.pts = pts;
  return [];
}

// Cases cochées : orbite, repères, trace au sol, cône.
const CASES_URL = {orbite:'cOrbite', reperes:'cReperes', trace:'cTrace', cone:'cCone'};
function appliquerMontrerURL(){
  const v = URL_P.get('montrer');
  if(v === null) return [];
  const inconnus = [];
  for(const k of v.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)){
    if(!CASES_URL[k]){ inconnus.push(k); continue; }
    ETAT.montrer[k] = true; $(CASES_URL[k]).checked = true;
  }
  return inconnus.length ? ['Affichage inconnu : ' + inconnus.join(', ') + '. Choix possibles : ' + Object.keys(CASES_URL).join(', ') + '.'] : [];
}

// Visée libre demandée (cap, site en degrés) : prioritaire sur vue=.
function appliquerViseeURL(){
  const c = URL_P.get('cap'), s = URL_P.get('site');
  if(c === null && s === null) return [];
  const cap = parseFloat(String(c).replace(',', '.')), site = parseFloat(String(s).replace(',', '.'));
  if(!isFinite(cap) || !isFinite(site) || site < -90 || site > 90)
    return ['Visée illisible : cap=' + c + ', site=' + s + '. Format attendu : cap=-46.4&site=-16.9 (degrés, site entre −90 et 90).'];
  ETAT.vue = 'iss'; viser(cap*DEG, site*DEG);
  return [];
}

// Focale demandée (mm) → champ vertical (cone.js), dans les bornes du zoom.
function appliquerFocaleURL(){
  const v = URL_P.get('focale');
  if(v === null) return [];
  const f = parseFloat(v.replace(',', '.'));
  if(!/^\s*\d+([.,]\d+)?\s*(mm)?\s*$/i.test(v) || !(f > 0))
    return ['Focale illisible : « ' + v + ' ». Format attendu : focale=58 (en mm, équivalent 24×36).'];
  VUE_ISS.fov = Math.max(0.5, Math.min(FOV_MAX, fovDepuisFocale(f)));
  return [];
}

// Date et heure demandées (après le t de départ : date0 en découle).
function appliquerDateURL(){
  const ds = URL_P.get('date'), hs = URL_P.get('heure');
  const msg = [];
  if(hs !== null && ds === null){
    msg.push('Heure fournie sans date : elle est ignorée.', 'Ajouter la date : ' + FORMAT_DATE + '.');
    return msg;
  }
  if(ds === null) return msg;
  const jour = lireDateURL(ds);
  if(jour === null){
    msg.push('Date illisible : « ' + ds + ' ».', 'Format attendu : ' + FORMAT_DATE + ', entre ' + DATES.AN_MIN + ' et ' + DATES.AN_MAX + '.');
    return msg;
  }
  let frac = 0;
  if(hs !== null){
    frac = lireHeureURL(hs);
    if(frac === null){
      msg.push('Heure illisible : « ' + hs + ' » ; date prise à 00:00:00 UT.', 'Format attendu : ' + FORMAT_HEURE + '.');
      frac = 0;
    }else ETAT.pause = true;                                // instant précis : en pause
  }
  ETAT.date0 = jour + frac - ETAT.t/86400;
  majSoleilDate(); majDateUI();
  const tleAttendu = EPH.sats.iss.etat === 'chargement' && Math.abs(unixDeJour(jourDate()) - Date.now()/1000) < TLE_JOURS*86400;
  if(EPH.src === 'modele' && !tleAttendu)                 // près de maintenant, le TLE (en route) la donnera
    msg.push('Position réelle de l\'ISS inconnue à cette date : elle est simulée (sol et villes ne sont pas les vrais).',
             'Positions réelles : de 2000 à aujourd\'hui + 15 jours (un TLE par jour, et celui du jour chez CelesTrak).');
  return msg;
}

/* L'URL suit la vue : recalculée à chaque trame, réécrite (replaceState, sans entrée d'historique) quand elle change,
   au plus deux fois par seconde (Safari refuse plus de 100 réécritures en 10 s). Les paramètres inconnus sont gardés. */
const URL_SUIVI = {quand:0, txt:location.search};
const CLES_URL = ['sat', 'vue', 'decal', 'cap', 'site', 'focale', 'cam', 'date', 'heure', 'montrer'];
function texteURL(){
  const q = new URLSearchParams(location.search);
  for(const k of CLES_URL) q.delete(k);
  if(OBS !== SATS[0]) q.set('sat', OBS.id);
  if(ETAT.vue === 'iss'){
    const nom = ETAT.preset && Object.keys(VUES_URL).find(k => VUES_URL[k] === ETAT.preset);
    if(nom){
      q.set('vue', nom);
      if(VUE_ISS.suivi && VUE_ISS.decal) q.set('decal', (VUE_ISS.decal/DEG).toFixed(1));
    }else{
      q.set('cap', (VUE_ISS.cap/DEG).toFixed(2)); q.set('site', (VUE_ISS.site/DEG).toFixed(2));
    }
    const f = focaleDepuisFov(VUE_ISS.fov);
    q.set('focale', f.toFixed(2));
  }else{
    q.set('vue', VUE_EXT.mode === 'lune' ? 'terrelune' : 'terre');
    q.set('cam', (VUE_EXT.th/DEG).toFixed(1) + ',' + (VUE_EXT.ph/DEG).toFixed(1) + ',' + Math.round(VUE_EXT.r));
  }
  const ds = Math.round(unixDeJour(jourDate())*10), d = new Date(ds*100), p2 = n => String(n).padStart(2, '0');
  q.set('date', p2(d.getUTCDate()) + '.' + p2(d.getUTCMonth() + 1) + '.' + p2(d.getUTCFullYear() % 100));
  q.set('heure', p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()) + (ds % 10 ? '.' + ds % 10 : ''));
  const m = Object.keys(CASES_URL).filter(k => ETAT.montrer[k]);
  if(m.length) q.set('montrer', m.join(','));
  return '?' + q.toString().replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%3B/g, ';');   // lisible : 22:21:03, 51.6,31.5,250, 10,960;910,741
}
function majURL(ms, force = false){
  if(!force && ms - URL_SUIVI.quand < 500) return;
  const t = texteURL();
  if(t === URL_SUIVI.txt) return;
  URL_SUIVI.quand = ms; URL_SUIVI.txt = t;
  history.replaceState(null, '', t);
}
