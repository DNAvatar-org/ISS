// File: js/reperes.js
// Desc: Repères pédagogiques : axes de la Terre et de l'orbite (lignes en vue éloignée, pastilles dans le ciel).
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Pôle orbital = centre des cercles d'étoiles quand la caméra regarde le long de la normale orbitale.
   Pôle terrestre = autour duquel la Terre tourne sur elle-même. Ils sont à 51,6° l'un de l'autre. */
const REP = {lignes:[], pastilles:[]};

function etiquette(texte, couleur){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const cx = cv.getContext('2d');
  cx.strokeStyle = couleur; cx.fillStyle = couleur; cx.lineWidth = 6;
  cx.beginPath(); cx.arc(64,64,30,0,2*Math.PI); cx.stroke();
  cx.beginPath(); cx.arc(64,64,4,0,2*Math.PI); cx.fill();
  cx.font = '600 34px sans-serif'; cx.textBaseline = 'middle'; cx.fillText(texte, 110, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv), depthTest:false, transparent:true}));
  s.scale.set(1400, 350, 1); s.center.set(0.125, 0.5);
  s.renderOrder = 9;
  return s;
}

function creerReperes(){
  const axeTerre = new THREE.Vector3(0, Math.cos(CFG.INCL), Math.sin(CFG.INCL));
  const defs = [
    {v:new THREE.Vector3(0,1,0), c:0x6fd3ff, css:'#6fd3ff', nom:'pôle orbital'},   // +Y : côté Soleil
    {v:axeTerre,                 c:0xffa14a, css:'#ffa14a', nom:'pôle de la Terre'}
  ];
  for(const d of defs){
    const L = CFG.R*2.4;
    const g = new THREE.BufferGeometry().setFromPoints([d.v.clone().multiplyScalar(-L), d.v.clone().multiplyScalar(L)]);
    const ligne = new THREE.Line(g, new THREE.LineBasicMaterial({color:d.c}));
    scene.add(ligne); REP.lignes.push(ligne);
    for(const s of [1, -1]){
      const p = etiquette((s>0?'N ':'S ')+d.nom, d.css);
      p.position.copy(d.v).multiplyScalar(s*CFG.SKY_R*0.93);
      CIEL.groupe.add(p); REP.pastilles.push(p);      // sur la voûte, à l'infini (suit l'observateur)
    }
  }
  REP.lune = etiquette('Lune', '#d8dde6');       // suit la Lune (voir majLune)
  scene.add(REP.lune);
}
