// File: js/atm-teinte.js
// Desc: Teinte de l'atmosphère (?atmTeinte=RRGGBB) : la couleur que la physique donne à l'air (diffusion Rayleigh,
//       luminescence — terre.js) est remplacée par cette teinte, à même luminosité. Pour une page hôte qui veut une autre
//       Terre (ex. DNA Tamagoshi : atmosphère cyan) ; l'épaisseur, elle, reste celle de ?atm= (url.js : p, H, lum).
//       Absent : l'atmosphère telle quelle. Branché sur creerTerre (terre.js) : le shader est retouché avant sa
//       première compilation.
// Version 1.0.0
// Date: [October 17, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/** ?atmTeinte=RRGGBB (sans #) : la teinte, ou null */
const ATM_TEINTE = (() => {
  const t = new URLSearchParams(location.search).get('atmTeinte');
  return t !== null && /^[0-9a-fA-F]{6}$/.test(t) ? new THREE.Color('#' + t) : null;
})();

if(ATM_TEINTE !== null){
  const creerTerreSansTeinte = creerTerre;
  creerTerre = function(tex){
    creerTerreSansTeinte(tex);
    const m = TERRE.atmo.material;
    // luminosité de la couleur physique, rendue dans la teinte (rapportée à la luminosité de la teinte, plafonnée à 1)
    m.uniforms.uTeinte = {value:new THREE.Vector3(ATM_TEINTE.r, ATM_TEINTE.g, ATM_TEINTE.b)};
    m.fragmentShader = 'uniform vec3 uTeinte;\n' + m.fragmentShader.replace('gl_FragColor = vec4(col, 1.0);',
      'float lum = dot(col, vec3(0.299, 0.587, 0.114));\n' +
      '  gl_FragColor = vec4(min(uTeinte*lum/max(dot(uTeinte, vec3(0.299, 0.587, 0.114)), 0.05), 1.0), 1.0);');
    m.needsUpdate = true;
  };
}
