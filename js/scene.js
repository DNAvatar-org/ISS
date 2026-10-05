// File: js/scene.js
// Desc: Moteur three.js : renderer et scène (les objets sont créés dans main.js, une fois les textures chargées).
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

THREE.ColorManagement.enabled = false;   // avant toute création de couleur

const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // couleurs littérales, comme soleil/
renderer.setClearColor(0x000000, 1);
const scene = new THREE.Scene();
