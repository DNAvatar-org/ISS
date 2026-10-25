// File: js/entrees.js
// Desc: Souris, pavé tactile et écran tactile : orbite autour de la Terre, visée et focale de la caméra embarquée.
// Version 1.8.0
// - v1.8.0: ?glisserGlobe — vue Terre : le glisser ne part que d'un appui sur le globe (pas du ciel autour), la main ne
//   s'affiche qu'en le survolant ; pour une page hôte où la Terre est en plein écran sous son interface (le tamagoshi).
// - v1.7.0: vue Terre — le zoom multiplie l'altitude (plus de saut à la butée), glisser lent jusqu'au plus près.
// - v1.6.0: zoom de la vue Terre jusqu'à 8 km d'altitude (au lieu de 0,2 rayon terrestre).
// - v1.5.0: zoom enchaîné : la vue Terre–Lune en deçà de ×0,8 (R_VERS_LUNE), et retour ; R_LUNE_MAX. Vers le sol, la vue
//   Terre zoome jusqu'au limbe (pas de passage à la caméra de l'ISS).
// - v1.4.0: glisser en vue Terre : rotation proportionnelle à l'altitude de la caméra (de près, beaucoup plus douce).
// - v1.3.0: zoom enchaîné vers le large : vue Terre au plus loin → vue Terre–Lune ; et retour.
// - v1.2.0: zoom enchaîné (ETAT.zoomEnchaine) : vue Terre au plus proche → caméra de l'ISS, horizon sous le Soleil ; et retour.
// Date: [October 23, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Gestes sur le canevas (hors encarts) :
   – un doigt / la souris : glisser = orbiter (vue Terre) ou viser (vue ISS) ;
   – deux doigts : pincer = zoom (distance ou focale) ;
   – toucher bref sans glisser (écran tactile) : masque / remet les encarts, plein écran (basculerZen, ui.js) ;
   – molette, défilement à deux doigts du pavé tactile : zoom proportionnel au défilement (un pavé envoie des dizaines
     de petits événements : un pas fixe par événement zoomait bien trop vite) ;
   – pincer sur le pavé tactile : ctrl+molette (Chrome, Firefox) ou gesture* (Safari) — sinon le navigateur zoome la page. */

const surUI = e => e.target.closest('#panel, #hud, #bZen, #galerie, #pied, #credits, #lEcl, #encartPhoto, #traceLimbe');   // #lEcl : liste du menu Éclipses (hors encart)
const DOIGTS = new Map();                        // pointeurs posés sur le canevas : id → {x, y}
const TAP = {id:null, x:0, y:0, t:0, ok:false};  // toucher bref en cours
let pince = 0;                                   // écart entre deux doigts à la trame précédente

// Zoom multiplicatif : f > 1 éloigne (vue Terre) ou élargit le champ (vue ISS).
const R_EXT_MIN = CFG.R + 0.08;                  // vue Terre au plus proche : 8 km d'altitude (tuiles Sentinel-2, 10 m)
const R_EXT_MAX = 3000;                          // vue Terre au plus loin
const R_LUNE_MIN = 1500;                         // vue Terre–Lune au plus proche
const R_LUNE_MAX = 6000;                         // vue Terre–Lune au plus loin
// Zoom enchaîné (?provenance=CO2) : plus loin que ×0,8 (ui.js niveauZoom : altitude de départ / altitude), la vue Terre–Lune
const R_VERS_LUNE = CFG.R + (250 - CFG.R)/0.8;
function zoomer(f){
  poseInterrompre();
  if(ETAT.vue === 'ext'){
    const lune = VUE_EXT.mode === 'lune';       // en vue Terre–Lune on reste dans la voûte (rayon 9 000)
    // Zoom enchaîné (?provenance=CO2) : vers le large, la vue Terre–Lune au plus proche ; et retour.
    if(ETAT.zoomEnchaine && !lune && VUE_EXT.r*f > R_VERS_LUNE){ poseEffacer(); vueTerreLune(); VUE_EXT.r = R_LUNE_MIN; majBoutons(); return; }
    if(ETAT.zoomEnchaine && lune && VUE_EXT.r*f < R_LUNE_MIN){ poseEffacer(); VUE_EXT.mode = 'terre'; VUE_EXT.r = R_VERS_LUNE; majBoutons(); return; }
    // vue Terre : le zoom multiplie l'altitude (r − R), pas la distance au centre — sinon, près du sol, un cran sautait de
    // centaines de km jusqu'à la butée (le zoom semblait bloqué)
    if(lune) VUE_EXT.r = Math.max(R_LUNE_MIN, Math.min(R_LUNE_MAX, VUE_EXT.r*f));
    else VUE_EXT.r = Math.max(R_EXT_MIN, Math.min(R_EXT_MAX, CFG.R + (VUE_EXT.r - CFG.R)*f));
  }
  else zoomerFocale(f);
}
const zoomerFocale = f => { VUE_ISS.fov = Math.max(0.5, Math.min(FOV_MAX, VUE_ISS.fov*f)); };

// Défilement → facteur de zoom : un cran de molette (100 px) ≈ ×1,16 ; pincer (ctrl) est plus sensible.
function facteurMolette(e){
  const px = e.deltaY*(e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
  return Math.max(0.5, Math.min(2, Math.exp(px*(e.ctrlKey ? 0.01 : 0.0015))));
}

const ecartDoigts = () => { const [a, b] = [...DOIGTS.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

// ?glisserGlobe : en vue Terre, le glisser ne part que du globe — le ciel autour reste à la page hôte (le tamagoshi : la
// Terre en plein écran sous son interface, un appui à côté ne doit pas la faire tourner)
const GLISSER_GLOBE = new URLSearchParams(location.search).has('glisserGlobe');
const surGlobe = e => ETAT.vue !== 'ext' || pointTerre(camExt, e.clientX/innerWidth*2 - 1, 1 - e.clientY/innerHeight*2) !== null;
if(GLISSER_GLOBE) addEventListener('pointermove', e => {
  if(DOIGTS.size === 0) document.documentElement.style.cursor = !surUI(e) && ETAT.vue === 'ext' && surGlobe(e) ? 'grab' : '';
});

addEventListener('pointerdown', e => {
  if(surUI(e)) return;
  if(GLISSER_GLOBE && !surGlobe(e)) return;
  poseInterrompre(); if(ETAT.vue !== 'iss') fermerPhoto();     // capture ouverte : on la referme
  DOIGTS.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(DOIGTS.size === 1) Object.assign(TAP, {id:e.pointerId, x:e.clientX, y:e.clientY, t:performance.now(), ok:e.pointerType === 'touch'});
  else { TAP.ok = false; pince = ecartDoigts(); }               // deux doigts : ce n'est plus un toucher bref
});
addEventListener('pointermove', e => {
  const p = DOIGTS.get(e.pointerId);
  if(!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if(TAP.ok && Math.hypot(e.clientX - TAP.x, e.clientY - TAP.y) > 10) TAP.ok = false;
  if(DOIGTS.size >= 2){                                         // pincer : seul l'écart compte
    const d = ecartDoigts();
    if(pince > 0 && d > 0) zoomer(pince/d);
    pince = d;
    return;
  }
  if(ETAT.vue === 'ext'){
    // vue Terre : rotation proportionnelle à l'altitude de la caméra (r − R), le point saisi suit à peu près le doigt —
    // inchangée à la distance par défaut (250), bien plus douce de près ; vue Terre–Lune : comme avant
    const k = VUE_EXT.mode === 'lune' ? 1 : Math.max(0.0002, (VUE_EXT.r - CFG.R)/(250 - CFG.R));   // de près : lent
    VUE_EXT.th -= dx*0.006*k;
    VUE_EXT.ph = Math.max(-1.5, Math.min(1.5, VUE_EXT.ph + dy*0.005*k));
  }else{
    const k = VUE_ISS.fov*DEG/innerHeight;          // rad par pixel : le point saisi suit le doigt
    // horizon vertical (cameras.js) : la droite de l'image est le bas, son haut la droite — le cap suit le glisser vertical
    if(ETAT.horizonVertical) viser(VUE_ISS.cap - dy*k, VUE_ISS.site + dx*k);
    else viser(VUE_ISS.cap + dx*k, VUE_ISS.site + dy*k);
  }
});
function lacher(e, annule){
  if(!DOIGTS.delete(e.pointerId)) return;
  if(DOIGTS.size < 2) pince = 0;
  if(!annule && TAP.ok && e.pointerId === TAP.id && DOIGTS.size === 0 && performance.now() - TAP.t < 400) basculerZen();
  if(e.pointerId === TAP.id) TAP.ok = false;
}
addEventListener('pointerup', e => lacher(e, false));
addEventListener('pointercancel', e => lacher(e, true));

addEventListener('wheel', e => {
  if(surUI(e)) return;
  e.preventDefault();                               // pincer au pavé (ctrl+molette) ne doit pas zoomer la page
  zoomer(facteurMolette(e));
}, {passive:false});
// Safari (macOS) : le pincement du pavé arrive en gesturestart / gesturechange (e.scale), pas en ctrl+molette.
// Sur iPhone / iPad ces événements doublent les deux doigts déjà suivis ci-dessus : on les ignore alors.
let echelleGeste = 1;
addEventListener('gesturestart', e => { e.preventDefault(); echelleGeste = e.scale; });
addEventListener('gesturechange', e => {
  e.preventDefault();
  if(DOIGTS.size < 2 && !surUI(e)) zoomer(echelleGeste/e.scale);
  echelleGeste = e.scale;
});
addEventListener('gestureend', e => e.preventDefault());

// Espace : pause / reprise
addEventListener('keydown', e => {
  if(e.code !== 'Space' || e.target.closest('input, button')) return;
  e.preventDefault(); ETAT.pause = !ETAT.pause; majBoutons();
});
