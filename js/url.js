// File: js/url.js
// Desc: Paramètres d'URL : ?sat=ISS&vue=avant&focale=58&date=30.07.21&heure=22:20:46 (satellite, visée, focale, date et heure UT) ; avis si mal formés ; l'URL suit la vue.
// Version 1.16.0
// - v1.16.0: ?vuesAuZoom= — le niveau de zoom choisit la vue (Terre–Lune ↔ Terre ↔ ISS) ; provenance=CO2 l'active, vuesAuZoom=0 l'éteint.
// - v1.15.0: ?provenance=CO2 — la liste des éclipses ouverte est trouée dans l'organigramme de l'hôte (iss:fenetres) : par-dessus tout.
// - v1.14.0: ?lumNuit= — lumières des villes la nuit, de 0 (éteintes) à 1.
// - v1.13.1: ?provenance=CO2 — caméra de l'ISS tournée, la Terre à droite (ETAT.horizonVertical, cameras.js).
// - v1.13.0: ?provenance=CO2 — vitesse ×100 ; Temps et Point de vue à gauche, sous Atmosphère de la page hôte, dépliés vers
//   le bas (iss:marges fenetres { gauche, haut }) ; leurs rectangles à la page hôte (iss:fenetres), qui y troue son organigramme :
//   elles passent par-dessus.
// - v1.12.3: Temps contre la marge de la page hôte, Point de vue 10 px sous lui : repliés, le pas de la pile de titres de l'hôte.
// - v1.12.2: Point de vue posé depuis la marge de la page hôte (Temps et lui glissent quand elle change).
// - v1.12.1: iss:marges gauche = abscisse du centre de la Terre (hote.js xTerre).
// - v1.12.0: ?pays=false ; ?provenance=CO2 : zoom enchaîné, satellites visibles dès que Point de vue est déplié ; montrer=reperes retiré.
// - v1.11.0: ?notIR= — côté nuit lumineux (lave : la carte de jour à notIR % la nuit) ; cartes, atmosphère et notIR
//   changeables par la page hôte sans rechargement (message iss:cartes, terre.js poserCartes).
// - v1.9.0: ?provenance=CO2 — début du mode « bilan radiatif » (vitesse ×1000, fenêtres repliées, pas de Check Photo).
// - v1.8.1: vue=soleil / vue=lune = l'horizon sous l'astre, sur le limbe (horizon.js).
// - v1.8.0: ?atm=p:…,H:…,lum:… — atmosphère d'une autre Terre (pression, hauteur d'échelle, luminescence) ; p:0 = sans atmosphère.
// - v1.7.0: ?onglet (page dans l'onglet d'une page hôte), ?jour= / ?nuit= (cartes de la Terre, ex. paléogéographie).
// Date: [October 15, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* sat   : id ou nom d'un satellite (iss, hubble, iridium ; casse indifférente). Absent : ISS.
   vue   : visée de la caméra embarquée : pole, antipole (pôle côté Soleil), soleil (son coucher : le limbe dans
           l'azimut du Soleil, horizon.js), obl (Terre oblique), lune (l'horizon sous la Lune), avant,
           nadir (casse indifférente) ; ou vue extérieure : terre, terrelune. Absent : pole.
   decal : avec vue=soleil ou vue=lune, décalage de la visée en hauteur (degrés) : l'astre au-dessus ou au-dessous du centre.
   cam   : vue extérieure, position de la caméra : longitude, latitude (degrés), distance (unités de la scène), ex. 51.6,31.5,250.
   cap   : direction de visée en degrés, 0 = sens du vol, +90 = vers la gauche (normale orbitale), ±180 = vers l'arrière ;
   site  : hauteur en degrés (0 = horizontale, −90 = nadir). Les deux ensemble remplacent vue= (visée libre).
   focale: focale en mm, équivalent 24×36 (ex. 58 ; « 58mm » accepté). Absent : celle de la vue choisie.
   date  : JJ.MM.AA ou JJ.MM.AAAA (format français ; séparateurs . / ou -), entre 2000 et 2035.
   heure : HH:MM, HH:MM:SS ou HH:MM:SS.s, temps universel (UT, comme l'affichage). Sans date : ignorée, avec un avis.
   montrer : orbite, trace, cone, geo (pays et coordonnées), séparés par des virgules : cases cochées.
   photo : une photo du catalogue de Check Photo (nom du fichier sans .jpg, cf. catalogue-data.js), chargée au démarrage.
   limbe : bord de l'atmosphère pour la prochaine photo de Check Photo, au lieu de la détection automatique : au moins
           3 points x,y séparés par des points-virgules, en pixels de la photo d'origine (ex. limbe=10,960;910,741;
           1630,711;2380,803), ou en fractions de sa largeur et de sa hauteur si toutes les valeurs sont ≤ 1. Un limbe
           tracé à la main s'y écrit (limbe-manuel.js). Il ne vaut que pour une photo : chargée la suivante, il est retiré.
   onglet: présent (sans valeur), la page est affichée dans l'onglet d'une page hôte (bilan radiatif) : ni signature, ni bouton
           ⛶ — la page hôte porte son plein écran ; elle peut piloter le zen par message (ui.js, 'iss:zen'). ⓒ seul dans le coin.
   jour  : URL de la carte de jour (équirectangulaire, même site ou CORS ouvert), ex. une paléogéographie ; nuit : celle de nuit.
           Une carte de jour sans carte de nuit = pas de lumières des villes. Avec jour=, pas de tuiles de détail au zoom (GIBS,
           Sentinel-2) : elles montrent la Terre d'aujourd'hui.
   atm   : atmosphère, paires clé:valeur séparées par des virgules (ex. atm=p:0.97,H:8.4,lum:1) — p : pression de surface [atm]
           (épaisseur optique Rayleigh ∝ colonne d'air, air de composition actuelle), H : hauteur d'échelle [km], lum : luminescence
           nocturne (airglow) relative à aujourd'hui. Absent : la Terre d'aujourd'hui (p:1, H:8, lum:1). p:0 : pas d'atmosphère.
           Les couleurs ne se donnent pas : elles sortent de la diffusion Rayleigh (terre.js).
   provenance : qui ouvre la page. provenance=CO2 (bilan radiatif, onglet ISS) : début d'un mode « bilan radiatif » —
           vitesse ×100, Temps et Point de vue repliés (+ ou leur titre les rouvre ; dépliée, Point de vue montre les
           satellites), vues au zoom (vuesAuZoom ci-dessous), Temps puis Point de vue
           à gauche, sous les boutons de la page hôte (message iss:marges { gauche, fenetres: { gauche, haut } } en px
           de cette page ; gauche : place laissée à gauche de la Terre, qui se décale vers la droite, hote.js ;
           fenetres : leur bord gauche et le haut de Temps), pas de Check Photo, vue Terre éclairée de biais (un bord de
           nuit). Repliées, les fenêtres n'ont que la largeur de leur titre, + devant lui.
   vuesAuZoom : présent (ou 1) : le niveau de zoom choisit la vue — Terre–Lune au large (en deçà de ×0,8), Terre, caméra de l'ISS
           plus près que son altitude (horizon sous le Soleil), et retour à la vue Terre quand on élargit le champ de l'ISS
           au-delà de celui de la vue Terre. 0 : chaque vue garde son zoom, on en change par les boutons. Actif par défaut
           avec provenance=CO2.
   pays  : false (true par défaut) : pas de pays ni de case « Pays et coordonnées » (une Terre d'avant les frontières).
   zen   : présent (sans valeur), démarre en plein écran : fenêtres, crédits et signature masqués, comme le bouton ⛶ ;
           un toucher bref ou le bouton les remet. Pour une page embarquée (iframe), où le vrai plein écran exige un geste.
   Date + heure = un instant précis : la simulation démarre en pause. Les autres paramètres ne mettent pas en pause.
   L'ISS est placée à sa position RÉELLE à cet instant UTC (ephemerides.js) quand une source la donne ; sinon un avis
   prévient qu'elle est simulée.
   En retour, l'URL SUIT la vue (majURL, à chaque trame) : satellite, visée (prédéfinie ou cap/site), focale, vue
   extérieure, instant au dixième de seconde, cases. Copier l'adresse et la recoller redonne la même vue, en pause à cet
   instant. */
const URL_P = new URLSearchParams(location.search);
const NUIT_NOIRE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
// Cartes de la Terre (main.js) : celles de l'URL, sinon geoview / steamNight (cartes-data.js).
const CARTE_JOUR = URL_P.has('jour') ? URL_P.get('jour') : CARTES.jour;
const CARTE_NUIT = URL_P.has('nuit') ? URL_P.get('nuit') : URL_P.has('jour') ? NUIT_NOIRE : CARTES.nuit;
let TUILES_ACTIVES = !URL_P.has('jour');           // tuiles de détail = Terre d'aujourd'hui (iss:cartes peut le changer)
// Atmosphère (terre.js, créée avant les autres paramètres : lue ici, au chargement) ; avis rendus par appliquerAtmURL.
const ATM = {p:1, H:8, lum:1};
const ATM_AVIS = [];
if(URL_P.has('atm')){
  for(const kv of URL_P.get('atm').split(',')){
    const [k, v] = kv.split(':'), x = parseFloat(v);
    if(!(k in ATM) || !(x >= 0) || (k === 'H' && !(x > 0))) ATM_AVIS.push('Atmosphère illisible : « ' + kv + ' » dans atm=' + URL_P.get('atm') + '. Format : atm=p:0.97,H:8.4,lum:1 (pression en atm, hauteur d\'échelle en km > 0, luminescence ≥ 0).');
    else ATM[k] = x;
  }
}
let ATM_COQUE = Math.max(3.9, ATM.H/10);         // rayon de la coque au-dessus du sol [100 km] : 390 km, ou 10 hauteurs d'échelle
function appliquerAtmURL(){ return ATM_AVIS; }
// ?pays=false : pas de pays (Terre d'avant les frontières, ex. avant 1750) — la case « Pays et coordonnées » disparaît (geo.js).
const PAYS_URL = URL_P.get('pays');
function appliquerPaysURL(){
  if(PAYS_URL === null) return [];
  if(PAYS_URL !== 'true' && PAYS_URL !== 'false') return ['Pays illisible : pays=' + PAYS_URL + ' (true ou false).'];
  poserPays(PAYS_URL === 'true');
  return [];
}
// Côté nuit LUMINEUX [0–1] : une surface qui brille d'elle-même (lave de l'Hadéen) montre sa carte de jour la nuit, à notIR % ;
// 0 par défaut (la nuit n'a que les lumières de la carte de nuit). Avis rendus avec ceux de ?atm=.
let NOT_IR = 0;
if(URL_P.has('notIR')){
  const x = parseFloat(URL_P.get('notIR'));
  if(x >= 0 && x <= 100) NOT_IR = x/100;
  else ATM_AVIS.push('Côté nuit illisible : notIR=' + URL_P.get('notIR') + ' (pourcentage de 0 à 100, ex. notIR=70).');
}
// Lumières des villes, la nuit [0–1] : ?lumNuit=0 les éteint (une page hôte dont les points comptent plus que les villes :
// de près, les grandes villes saturent en taches blanches) ; 1 par défaut.
let LUM_NUIT = 1;
if(URL_P.has('lumNuit')){
  const x = parseFloat(URL_P.get('lumNuit'));
  if(x >= 0 && x <= 1) LUM_NUIT = x;
  else ATM_AVIS.push('Lumières de nuit illisibles : lumNuit=' + URL_P.get('lumNuit') + ' (de 0 à 1, ex. lumNuit=0).');
}
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
const LIMBE_URL = {pts:null, utilise:false};                  // utilise : déjà appliqué à une photo (pas à la suivante)
function appliquerLimbeURL(){
  const v = URL_P.get('limbe');
  if(v === null) return [];
  const pts = v.split(';').filter(t => t.trim()).map(t => t.split(',').map(x => parseFloat(x)));
  if(pts.length < 3 || !pts.every(p => p.length === 2 && p.every(isFinite) && p[0] >= 0 && p[1] >= 0))
    return ['Limbe illisible : limbe=' + v + '.', 'Format attendu : au moins 3 points x,y séparés par des points-virgules, en pixels de la photo (ex. limbe=10,960;910,741;1630,711).'];
  LIMBE_URL.pts = pts;
  return [];
}

// ?zen : démarrage en plein écran (body.zen, comme basculerZen de ui.js), sans l'API plein écran du navigateur, qui
// exige un geste de l'utilisateur.
// ?onglet : page dans l'onglet d'une page hôte (body.onglet : signature et ⛶ masqués, css « PAGE EN ONGLET »).
function appliquerOngletURL(){
  document.body.classList.toggle('onglet', URL_P.has('onglet'));
  if(URL_P.has('onglet')) basculerCredits();   // en onglet : crédits dépliés par défaut (3 lignes à gauche de ⓒ, css « PAGE EN ONGLET »)
}

/* ?vuesAuZoom : le niveau de zoom choisit la vue (entrees.js) ; présent sans valeur ou 1 : oui, 0 : non. Après provenance=CO2,
   qui l'active : vuesAuZoom=0 l'éteint. */
function appliquerVuesAuZoomURL(){
  const v = URL_P.get('vuesAuZoom');
  if(v === null) return [];
  if(v !== '' && v !== '1' && v !== '0') return ['vuesAuZoom : « ' + v + ' » inconnu. Valeurs : 1 (ou sans valeur), 0.'];
  ETAT.vuesAuZoom = v !== '0';
  return [];
}

function appliquerProvenanceURL(){
  const p = URL_P.get('provenance');
  if(p === null) return [];
  if(p !== 'CO2') return ['Provenance inconnue : « ' + p + ' ». Connue : CO2 (bilan radiatif).'];
  ETAT.vitesse = 1000; ETAT.pause = false;          // après allerAujourdhui (main.js), qui remet ×1 ; puis selon la vue (hote.js)
  $('hud').classList.add('plie'); $('panel').classList.add('plie');
  $('bCheck').hidden = true;
  vueEclaireeDeBiais();                            // le Soleil un peu derrière la Terre : un bord de nuit (cameras.js)
  ETAT.zoomEnchaine = true;                         // mode bilan radiatif : point d'horizon fixe, vitesse selon la vue (hote.js)
  ETAT.vuesAuZoom = true;                           // le zoom choisit la vue (entrees.js) ; ?vuesAuZoom=0 l'éteint (appliquerVuesAuZoomURL)
  ETAT.horizonVertical = true;
  // atmosphère grossie au dessin (terre.js) : vue de l'espace en zoomant jusqu'au limbe, la bande bleue se voit
  ATM_AFFICHAGE.epaisseur = 4; ATM_AFFICHAGE.expo = 3;                      // caméra de l'ISS : la Terre à droite, le ciel et l'organigramme à gauche (cameras.js)
  // Temps puis Point de vue à gauche, sous les boutons de la page hôte (message iss:marges) : Temps à leur place, Point de
  // vue 10 px sous lui, replié ou déplié ; dépliés, ils s'ouvrent vers le bas.
  document.body.classList.add('provenance-co2');
  new ResizeObserver(placerPointDeVue).observe($('hud'));
  // leurs rectangles à la page hôte, qui troue son organigramme à leur place (par-dessus tout) : à chaque changement de
  // taille, et à la fin de chaque glissement (transition de top)
  const envoi = new ResizeObserver(envoyerFenetres);
  ['hud', 'panel'].forEach(id => { envoi.observe($(id)); $(id).addEventListener('transitionend', envoyerFenetres); });
  new MutationObserver(envoyerFenetres).observe($('lEcl'), {attributes: true, attributeFilter: ['hidden', 'style']});   // la liste des éclipses s'ouvre, se ferme, se place
  addEventListener('resize', envoyerFenetres);
  addEventListener('message', e => {
    if(e.data.type !== 'iss:marges') return;
    const s = document.documentElement.style;
    s.setProperty('--fenetres-gauche', e.data.fenetres.gauche + 'px');
    s.setProperty('--fenetres-haut', e.data.fenetres.haut + 'px');
    FENETRES_HAUT = e.data.fenetres.haut;
    placerPointDeVue();
    HOTE.xTerre = () => e.data.gauche; decalerTerre();   // la place de son organigramme, à gauche de la Terre (hote.js)
  });
  return [];
}
/* Point de vue 10 px sous Temps : le haut de Temps (css provenance-co2) plus sa hauteur — pas son bas mesuré, qui glisse
   encore (transition) quand la pile bouge. Repliés (titre de 20 px), un titre tous les 30 px, le pas des titres de l'hôte. */
let FENETRES_HAUT = 0;
function placerPointDeVue(){ $('panel').style.top = (FENETRES_HAUT + $('hud').offsetHeight + 10) + 'px'; }
/* Rectangles de Temps, Point de vue et de la liste des éclipses (px de cette page ; fermée : vide) → page hôte (message
   iss:fenetres). */
function envoyerFenetres(){
  const rects = ['hud', 'panel', 'lEcl'].map(id => { const r = $(id).getBoundingClientRect(); return {x:r.left, y:r.top, w:r.width, h:r.height}; });
  parent.postMessage({type:'iss:fenetres', rects}, '*');
}

function appliquerZenURL(){
  if(!URL_P.has('zen')) return;
  document.body.classList.add('zen');
  encartZen(true);
}

// Cases cochées : orbite, repères, trace au sol, cône.
const CASES_URL = {orbite:'cOrbite', trace:'cTrace', cone:'cCone', geo:'cGeo'};
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
