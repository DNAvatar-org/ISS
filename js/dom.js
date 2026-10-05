// File: js/dom.js
// Desc: Références DOM (crash-first : un id manquant plante ici, visiblement).
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const $ = id => { const e = document.getElementById(id); if(!e) throw new Error('DOM : #'+id+' absent'); return e; };
const canvas   = $('gl');
const poseCv   = $('pose');
const erreurEl = $('erreur');
const galerieEl = $('galerie');
const photoVue = $('photoVue');
const bPose = $('bPose');
const H = {lune:$('hLune')};
