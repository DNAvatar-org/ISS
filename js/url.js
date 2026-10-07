// File: js/url.js
// Desc: Paramètres d'URL : ?sat=ISS&vue=avant&focale=58&date=30.07.21&heure=22:20:46 (satellite, visée, focale, date et heure UT) ; avis si mal formés.
// Version 1.1.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* sat   : id ou nom d'un satellite (iss, hubble, iridium ; casse indifférente). Absent : ISS.
   vue   : visée de la caméra embarquée : pole, antipole (pôle côté Soleil), soleil, obl (Terre oblique), lune, avant,
           nadir (casse indifférente). Absent : pole.
   cap   : direction de visée en degrés, 0 = sens du vol, +90 = vers la gauche (normale orbitale), ±180 = vers l'arrière ;
   site  : hauteur en degrés (0 = horizontale, −90 = nadir). Les deux ensemble remplacent vue= (visée libre).
   focale: focale en mm, équivalent 24×36 (ex. 58 ; « 58mm » accepté). Absent : celle de la vue choisie.
   date  : JJ.MM.AA ou JJ.MM.AAAA (format français ; séparateurs . / ou -), entre 2000 et 2035.
   heure : HH:MM ou HH:MM:SS, temps universel (UT, comme l'affichage). Sans date : ignorée, avec un avis.
   Date + heure = un instant précis : la simulation démarre en pause. Les autres paramètres ne mettent pas en pause.
   L'ISS est placée à sa position RÉELLE à cet instant UTC (ephemerides.js) quand une source la donne ; sinon un avis
   prévient qu'elle est simulée. */
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

// « 04:29:51 » ou « 04:29 » → fraction de jour, ou null.
function lireHeureURL(s){
  const m = /^(\d{1,2})[:h](\d{2})(?:[:m](\d{2}))?$/.exec(s.trim());
  if(!m) return null;
  const h = +m[1], mi = +m[2], se = m[3] ? +m[3] : 0;
  if(h > 23 || mi > 59 || se > 59) return null;
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
  const nom = VUES_URL[v.toLowerCase()];
  if(!nom) return ['Vue inconnue : « ' + v + ' ». Choix possibles : pole, antipole, soleil, obl, lune, avant, nadir. Pôle affiché.'];
  ETAT.vue = 'iss'; choisirPreset(nom);
  return [];
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
