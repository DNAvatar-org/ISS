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
  caps:[], capNoms:[], capSel:-1, satPose:'', actif:false, visible:false, vuNuit:false, t0:0, finies:0, urls:[],
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
  POSE.actif = false; POSE.visible = false; POSE.finies = 0; POSE.urls = []; POSE.caps = []; POSE.capNoms = []; POSE.capSel = -1;
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
  POSE.satPose = nomFichier(OBS.nom, 'empilement');         // le satellite de la prise, pas celui du moment de l'enregistrement
  POSE.t0 = ETAT.t; POSE.actif = true; POSE.visible = true; POSE.vuNuit = false;
  poseVider();
  galerieEl.hidden = false;
  const s = document.createElement('button'); s.textContent = 'Σ empilement';
  s.onclick = () => { photoVue.hidden = true; marquerVignette(s); };
  galerieEl.appendChild(s);
}

// Nom de fichier : satellite observateur AU MOMENT de la prise + date et heure UT simulées.
function nomFichier(sat, type){
  const d = new Date(Date.UTC(2021, 0, 1) + jourDate()*86400000).toISOString();
  return sat + '-' + type + '-' + d.slice(0, 10) + '_' + d.slice(11, 13) + d.slice(14, 16) + 'UT.png';
}

// Retour à la vue en direct : on ferme l'image affichée et on désélectionne la vignette.
function fermerPhoto(){
  photoVue.hidden = true;
  galerieEl.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
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
  im.onclick = () => {                                   // 2e clic sur la même photo : retour à la vue
    if(!photoVue.hidden && photoVue.src === url){ fermerPhoto(); return; }
    photoVue.src = url; photoVue.hidden = false; marquerVignette(im);
  };
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

/* CAPTURE (vues Terre et Terre–Lune) : une image instantanée de la vue, sans pose de 30 s, ajoutée à la galerie.
   Le rendu est refait juste avant la lecture du canevas (le tampon WebGL n'est pas conservé entre deux trames). */
function capturer(){
  dessiner();
  const cv = renderer.domElement, png = cv.toDataURL('image/png');
  const w = 960, h = Math.round(w*cv.height/cv.width);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(cv, 0, 0, w, h);
  const url = c.toDataURL('image/jpeg', 0.85), n = POSE.caps.push(png);
  POSE.capNoms.push(nomFichier(OBS.nom, 'capture'));
  galerieEl.hidden = false;
  const im = document.createElement('img');
  im.src = url; im.title = 'Capture ' + n;
  im.onclick = () => {                                   // la vignette ouvre la capture en grand ; un 2e clic la referme
    POSE.capSel = n - 1;
    if(!photoVue.hidden && photoVue.src === png){ fermerPhoto(); return; }
    marquerVignette(im); photoVue.src = png; photoVue.hidden = false;
  };
  galerieEl.appendChild(im);
  galerieEl.scrollTop = galerieEl.scrollHeight;
  marquerVignette(im); POSE.capSel = n - 1;
  photoVue.src = png; photoVue.hidden = false;           // la capture sélectionnée est affichée à la place de la vue en direct
}

// 💾 : l'image affichée si c'est une capture, sinon l'empilement s'il existe, sinon la dernière capture.
function enregistrerImage(){
  if(!photoVue.hidden && POSE.caps.includes(photoVue.src)) capEnregistrerPNG();
  else if(POSE.visible) poseEnregistrerPNG();
  else capEnregistrerPNG();
}

function capEnregistrerPNG(){
  if(!POSE.caps.length) return;
  const a = document.createElement('a');
  const i = POSE.capSel >= 0 ? POSE.capSel : POSE.caps.length - 1;
  a.href = POSE.caps[i]; a.download = POSE.capNoms[i]; a.click();
}

function poseEnregistrerPNG(){
  poseCv.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = POSE.satPose; a.click();
    URL.revokeObjectURL(a.href);
  });
}

// Bouton REC : seulement dans la vue embarquée ; vert pendant la prise, avec le nombre de photos de 30 s terminées.
// Le bouton 📷 (capture instantanée) est toujours là.
function majBoutonRec(){
  const pose = ETAT.vue === 'iss';
  bPose.hidden = !pose;
  bPose.classList.toggle('rec', pose && POSE.actif);
  const t = POSE.actif ? '⏺️ ' + POSE.finies : '⏺️';
  if(bPose.textContent !== t) bPose.textContent = t;
  const titre = pose ? 'Capture · pose 30 s' : 'Capture';
  if($('titrePose').textContent !== titre) $('titrePose').textContent = titre;
}

// Tout zoom ou clic dans la vue efface l'empilement (et arrête une prise) : SAVE avant pour le garder.
function poseInterrompre(){
  if(POSE.visible || POSE.actif) poseEffacer();
}
