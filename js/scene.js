// File: js/scene.js
// Desc: Moteur three.js : renderer et scène (les objets sont créés dans main.js, une fois les textures chargées).
//       ?fond=transparent (page hôte qui pose la Terre sur son propre décor) : rendu avec transparence, page sans fond,
//       et pas de ciel étoilé (ciel.js) — la Terre, son atmosphère, le Soleil et la Lune flottent sur la page hôte.
// Version 1.3.0
// - v1.3.0: fond transparent — le halo de l'atmosphère se voit hors de la Terre (opacité = sa lueur).
// - v1.2.0: fond transparent — tout matériau additif (halo du Soleil…) laisse l'opacité, plus seulement l'atmosphère.
// - v1.1.0: ?fond=transparent.
// Date: [October 16, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

THREE.ColorManagement.enabled = false;   // avant toute création de couleur

/** ?fond=transparent : lu ici (url.js vient après), le renderer naît avec ou sans transparence */
const FOND_TRANSPARENT = new URLSearchParams(location.search).get('fond') === 'transparent';
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance', alpha:FOND_TRANSPARENT});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // couleurs littérales, comme soleil/
renderer.setClearColor(0x000000, FOND_TRANSPARENT ? 0 : 1);
if(FOND_TRANSPARENT){ document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; }
const scene = new THREE.Scene();
/* Fond transparent : un mélange additif écrit aussi l'opacité — le voile de l'atmosphère (terre.js), le halo du Soleil
   (couronne.js, eblouissement.js : un carré au fond noir) devenaient opaques sur la page hôte. À chaque image (des objets
   naissent en route), tout matériau additif n'ajoute plus que sa lumière et laisse l'opacité telle quelle : la lueur
   s'ajoute au décor de la page hôte, le noir n'ajoute rien. L'atmosphère, elle, déborde de la Terre : hors du globe le
   canvas est transparent, sa lumière seule n'y laissait rien voir — elle écrit aussi une opacité, celle de sa lueur
   (son plus fort canal) : le halo se pose sur la page hôte, le noir reste transparent (atmoSurFond). */
function lumiereSeule(m, src){
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = src; m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  m.needsUpdate = true;
}
function atmoSurFond(m){
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor;                       // lumière ajoutée (sur la Terre)
  m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;  // opacité = la lueur (hors Terre)
  const i = m.fragmentShader.lastIndexOf('}');
  m.fragmentShader = m.fragmentShader.slice(0, i) +
    '  gl_FragColor.a = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);\n' + m.fragmentShader.slice(i);
  m.needsUpdate = true;
}
if(FOND_TRANSPARENT) scene.onBeforeRender = () => {
  if(typeof TERRE !== 'undefined' && TERRE.atmo && TERRE.atmo.material.blending !== THREE.CustomBlending)
    atmoSurFond(TERRE.atmo.material);
  scene.traverse(o => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for(const m of ms) if(m.blending === THREE.AdditiveBlending) lumiereSeule(m, THREE.SrcAlphaFactor);
  });
};

