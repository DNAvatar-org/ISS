// File: js/entrees.js
// Desc: Souris, pavé tactile et écran tactile : orbite autour de la Terre, visée et focale de la caméra embarquée.
// Version 1.6.0
// - v1.6.0: zoom de la vue Terre jusqu'à 8 km d'altitude (au lieu de 0,2 rayon terrestre).
// - v1.5.0: zoom enchaîné : la caméra de l'ISS au-delà de ×1,8 (elle s'ouvre à ×5), la vue Terre–Lune en deçà de ×0,8
//   (R_VERS_ISS, ZOOM_ENTREE_ISS, R_VERS_LUNE) ; R_LUNE_MAX.
// - v1.4.0: glisser en vue Terre : rotation proportionnelle à l'altitude de la caméra (de près, beaucoup plus douce).
// - v1.3.0: zoom enchaîné vers le large : vue Terre au plus loin → vue Terre–Lune ; et retour.
// - v1.2.0: zoom enchaîné (ETAT.zoomEnchaine) : vue Terre au plus proche → caméra de l'ISS, horizon sous le Soleil ; et retour.
// Date: [October 19, 2026]
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
// Zoom enchaîné (?provenance=CO2) : bascules aux niveaux de zoom ×1,8 et ×0,8 (ui.js niveauZoom : 250 / distance) ; la
// caméra de l'ISS s'ouvre, au champ le plus large, à ×5
const R_VERS_ISS = 250/1.8;                      // plus près : la caméra de l'ISS
const ZOOM_ENTREE_ISS = 5;
const R_VERS_LUNE = 250/0.8;                     // plus loin : la vue Terre–Lune
function zoomer(f){
  poseInterrompre();
  if(ETAT.vue === 'ext'){
    const lune = VUE_EXT.mode === 'lune';       // en vue Terre–Lune on reste dans la voûte (rayon 9 000)
    // Zoom enchaîné (?provenance=CO2) : plus près que le plus proche de la vue Terre, la caméra de l'ISS, au champ le plus large,
    // sur l'horizon sous le Soleil.
    if(ETAT.zoomEnchaine && !lune && VUE_EXT.r*f < R_VERS_ISS){
      poseEffacer(); ETAT.vue = 'iss'; choisirPreset('soleil'); VUE_ISS.fov = FOV_MAX; majBoutons(); return;
    }
    // Et vers le large : plus loin que le plus loin de la vue Terre, la vue Terre–Lune au plus proche ; et retour.
    if(ETAT.zoomEnchaine && !lune && VUE_EXT.r*f > R_VERS_LUNE){ poseEffacer(); vueTerreLune(); VUE_EXT.r = R_LUNE_MIN; majBoutons(); return; }
    if(ETAT.zoomEnchaine && lune && VUE_EXT.r*f < R_LUNE_MIN){ poseEffacer(); VUE_EXT.mode = 'terre'; VUE_EXT.r = R_VERS_LUNE; majBoutons(); return; }
    VUE_EXT.r = Math.max(lune ? R_LUNE_MIN : R_EXT_MIN, Math.min(lune ? R_LUNE_MAX : R_EXT_MAX, VUE_EXT.r*f));
  }
  else if(ETAT.zoomEnchaine && VUE_ISS.fov*f > FOV_MAX){   // plus large que l'ISS : la vue Terre, au plus proche
    poseEffacer(); vueTerre(); VUE_EXT.r = R_VERS_ISS; majBoutons();
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

addEventListener('pointerdown', e => {
  if(surUI(e)) return;
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
    const k = VUE_EXT.mode === 'lune' ? 1 : Math.max(0.01, (VUE_EXT.r - CFG.R)/(250 - CFG.R));
    VUE_EXT.th -= dx*0.006*k;
    VUE_EXT.ph = Math.max(-1.5, Math.min(1.5, VUE_EXT.ph + dy*0.005*k));
  }else{
    const k = VUE_ISS.fov*DEG/innerHeight;          // rad par pixel : le point saisi suit le doigt
    viser(VUE_ISS.cap + dx*k, VUE_ISS.site + dy*k);
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
