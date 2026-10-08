// File: js/entrees.js
// Desc: Souris, pavé tactile et écran tactile : orbite autour de la Terre, visée et focale de la caméra embarquée.
// Version 1.1.2
// Date: [October 08, 2026]
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
function zoomer(f){
  poseInterrompre();
  if(ETAT.vue === 'ext'){
    const lune = VUE_EXT.mode === 'lune';       // en vue Terre–Lune on reste dans la voûte (rayon 9 000)
    VUE_EXT.r = Math.max(lune ? 1500 : CFG.R*1.2, Math.min(lune ? 6000 : 3000, VUE_EXT.r*f));
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
    VUE_EXT.th -= dx*0.006;
    VUE_EXT.ph = Math.max(-1.5, Math.min(1.5, VUE_EXT.ph + dy*0.005));
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
