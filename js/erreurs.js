// File: js/erreurs.js
// Desc: Crash-first visible : toute erreur (script, ressource, promesse) s'affiche dans la page, téléphone compris.
// Version 1.0.1
// Date: [October 06, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Chargé AVANT three.js : un téléphone n'a pas de console sous la main ; sans ceci, une erreur y laisse un écran noir muet.
   Les messages s'empilent dans #erreur (en bas de l'écran), avec fichier et ligne. */
(() => {
  const boite = document.getElementById('erreur');
  const vus = new Map();                                    // message → ligne affichée (une erreur répétée à chaque trame : un compteur)
  const afficher = txt => {
    boite.hidden = false;
    const v = vus.get(txt);
    if(v){ v.n++; v.el.textContent = txt + '  (×' + v.n + ')'; return; }
    if(vus.size >= 6) return;                               // les premières erreurs sont les causes ; la suite déborderait l'écran
    const p = document.createElement('div'); p.textContent = txt; boite.appendChild(p);
    vus.set(txt, {n:1, el:p});
  };
  const court = url => String(url || '').split('/').pop();
  addEventListener('error', e => {
    const el = e.target;
    if(el && (el.tagName === 'SCRIPT' || el.tagName === 'LINK')){ afficher('Ressource introuvable : ' + (el.src || el.href)); return; }
    if(el && el !== window) return;                         // images (tuiles GIBS…) : leurs échecs sont gérés par leur code
    if(/^ResizeObserver loop/.test(e.message || '')) return;   // avertissement bénin de Chrome (signature, bulles), pas une panne
    afficher((e.message || 'Erreur') + (e.filename ? ' — ' + court(e.filename) + ':' + e.lineno : ''));
  }, true);
  addEventListener('unhandledrejection', e => afficher('Promesse rejetée : ' + (e.reason && e.reason.message || e.reason)));
})();
