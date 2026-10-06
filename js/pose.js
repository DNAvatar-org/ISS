// File: js/pose.js
// Desc: Enregistrement de la nuit : une image de 30 s par tranche de 30 s (galerie) et leur empilement « plus clair ».
// Version 1.1.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Comme Thomas Pesquet : chaque photo accumule 30 s de lumière (pixel le plus clair des images
   rendues pendant ces 30 s), puis toutes les photos sont empilées de la même façon.
   Une nuit de 29 min 56 s donne 59 photos. */
const POSE = {
  actif:false, visible:false, vuNuit:false, t0:0, finies:0, urls:[],
  cx:poseCv.getContext('2d'), photoCv:document.createElement('canvas')
};
POSE.photoCx = POSE.photoCv.getContext('2d');

// Redimensionner la fenêtre ne doit pas effacer l'empilement : on le recopie, mis à l'échelle.
function poseDimensionner(){
  const w = renderer.domElement.width, h = renderer.domElement.height;
  for(const cv of [poseCv, POSE.photoCv]){
    if(cv.width === w && cv.height === h) continue;
    const garde = POSE.visible && cv.width > 0 && cv.height > 0;
    let copie = null;
    if(garde){ copie = document.createElement('canvas'); copie.width = cv.width; copie.height = cv.height; copie.getContext('2d').drawImage(cv, 0, 0); }
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h);
    if(copie) cx.drawImage(copie, 0, 0, w, h);
  }
}
function noir(cx, cv){
  cx.globalCompositeOperation = 'source-over';
  cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
}
function poseVider(){ noir(POSE.cx, poseCv); noir(POSE.photoCx, POSE.photoCv); }

function poseEffacer(){
  POSE.actif = false; POSE.visible = false; POSE.finies = 0; POSE.urls = [];
  poseCv.classList.remove('on'); galerieEl.hidden = true; galerieEl.textContent = '';
  photoVue.hidden = true;
}

/* REC, obturateur ouvert : on accumule ce que la caméra voit à partir de maintenant. Aucun saut dans le temps,
   aucun changement de vue ni de visée, et en pause rien ne s'accumule (le temps ne passe pas) : la lecture reste
   comme l'utilisateur l'a laissée. Une photo de 30 s est terminée à chaque tranche de 30 s simulées ;
   la prise s'arrête au clic suivant, ou à la sortie de l'ombre si elle a vu la nuit. */
function poseLancer(){
  if(POSE.actif){ POSE.actif = false; return; }          // 2e clic : on arrête la prise
  poseEffacer();
  POSE.t0 = ETAT.t; POSE.actif = true; POSE.visible = true; POSE.vuNuit = false;
  poseVider();
  galerieEl.hidden = false;
  const s = document.createElement('button'); s.textContent = 'Σ empilement';
  s.onclick = () => { photoVue.hidden = true; marquerVignette(s); };
  galerieEl.appendChild(s);
}

function marquerVignette(el){
  galerieEl.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
  el.classList.add('sel');
}

// Fin d'une photo de 30 s : miniature dans la galerie, puis on repart d'un cadre noir.
function poseFinirPhoto(){
  const w = 960, h = Math.round(w*POSE.photoCv.height/POSE.photoCv.width);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(POSE.photoCv, 0, 0, w, h);
  const url = c.toDataURL('image/jpeg', 0.85);
  POSE.urls.push(url);
  const im = document.createElement('img');
  im.src = url; im.title = 'Photo ' + (POSE.urls.length) + ' · ' + CFG.POSE_S + ' s';
  im.onclick = () => { photoVue.src = url; photoVue.hidden = false; marquerVignette(im); };
  galerieEl.appendChild(im);
  galerieEl.scrollTop = galerieEl.scrollHeight;
  POSE.finies++;
  noir(POSE.photoCx, POSE.photoCv);
}

// Pas de temps entre deux images empilées : une étoile ne doit pas bouger de plus de PAS_PX
// entre deux images (vitesse angulaire max = vitesse de rotation de l'ISS).
function posePas(){
  const fpx = poseCv.height/2/Math.tan(VUE_ISS.fov*DEG/2);
  return Math.max(0.5, CFG.PAS_PX/(2*Math.PI/OBS.T*fpx));
}

function poseAjouter(){
  for(const [cx, cv] of [[POSE.photoCx, POSE.photoCv], [POSE.cx, poseCv]]){
    cx.globalCompositeOperation = 'lighten';
    cx.drawImage(renderer.domElement, 0, 0);
  }
  poseCv.classList.add('on');                              // l'empilement couvre la vue dès la première image
  if(Math.floor((ETAT.t - POSE.t0)/CFG.POSE_S) > POSE.finies) poseFinirPhoto();
  if(cycleNuit(ETAT.t).nuit) POSE.vuNuit = true;
  else if(POSE.vuNuit) POSE.actif = false;                 // sortie de l'ombre : fin de la nuit
}

function poseEnregistrerPNG(){
  poseCv.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'iss-empilement-nuit.png'; a.click();
    URL.revokeObjectURL(a.href);
  });
}

// Bouton REC : vert pendant la prise, avec le nombre de photos de 30 s terminées.
function majBoutonRec(){
  bPose.classList.toggle('rec', POSE.actif);
  const t = POSE.actif ? '⏺️ ' + POSE.finies : '⏺️';
  if(bPose.textContent !== t) bPose.textContent = t;
}

// Tout zoom ou clic dans la vue efface l'empilement (et arrête une prise) : SAVE avant pour le garder.
function poseInterrompre(){
  if(POSE.visible || POSE.actif) poseEffacer();
}
