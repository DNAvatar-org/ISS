// File: js/entrees.js
// Desc: Souris et molette : orbite autour de la Terre, orientation de la caméra embarquée.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

let drag = null;
const surUI = e => e.target.closest('#panel, #hud, #bZen');

addEventListener('pointerdown', e => { if(surUI(e)) return; poseInterrompre(); drag = {x:e.clientX, y:e.clientY}; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', e => {
  if(!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if(ETAT.vue === 'ext'){
    VUE_EXT.th -= dx*0.006;
    VUE_EXT.ph = Math.max(-1.5, Math.min(1.5, VUE_EXT.ph + dy*0.005));
  }else{
    const k = VUE_ISS.fov*DEG/innerHeight;          // rad par pixel : le point saisi suit la souris
    viser(VUE_ISS.cap + dx*k, VUE_ISS.site + dy*k);
  }
});
addEventListener('wheel', e => {
  if(surUI(e)) return;
  poseInterrompre();
  const f = 1 + Math.sign(e.deltaY)*0.1;
  if(ETAT.vue === 'ext'){
    const lune = VUE_EXT.mode === 'lune';       // en vue Terre–Lune on reste dans la voûte (rayon 9 000)
    VUE_EXT.r = Math.max(lune ? 1500 : CFG.R*1.2, Math.min(lune ? 6000 : 3000, VUE_EXT.r*f));
  }
  else VUE_ISS.fov = Math.max(0.5, Math.min(110, VUE_ISS.fov*f));
}, {passive:true});
// Espace : pause / reprise
addEventListener('keydown', e => {
  if(e.code !== 'Space' || e.target.closest('input, button')) return;
  e.preventDefault(); ETAT.pause = !ETAT.pause; majBoutons();
});
