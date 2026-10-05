// File: js/horloge.js
// Desc: Chronomètre de la nuit et affichage des rotations (HUD).
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

const mmss = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
const hms  = s => { const sg = s < 0 ? 'T−' : 'T+'; s = Math.floor(Math.abs(s)); return sg+String(Math.floor(s/3600)).padStart(2,'0')+':'+mmss(s%3600); };

function majHorloge(){
  const c = cycleNuit(ETAT.t), d = c.duree;
  H.temps.textContent = hms(ETAT.t);
  H.orbite.textContent = Math.floor(ETAT.t/CFG.T_ISS) + 1;

  let ecoule;
  if(d === 0){                                     // β > ~70° : l'orbite longe l'ombre sans y entrer
    ecoule = 0;
    H.etat.textContent = 'JOUR PERMANENT'; H.etat.className = 'jour';
    H.chrono.textContent = '—';
    H.sous.textContent = 'pas de nuit à cette date : β trop grand, l\'ISS reste au soleil';
    H.barre.style.width = '0%';
  }else if(c.nuit){
    ecoule = c.ecoule;
    H.etat.textContent = 'NUIT'; H.etat.className = 'nuit';
    H.chrono.textContent = mmss(ecoule) + ' / ' + mmss(d);
    H.sous.textContent = 'reste ' + mmss(d - ecoule) + ' avant le lever du jour';
    H.barre.style.width = (100*ecoule/d) + '%';
  }else{
    ecoule = d;                                    // la nuit écoulée de ce cycle est complète
    H.etat.textContent = 'JOUR'; H.etat.className = 'jour';
    H.chrono.textContent = mmss(CFG.T_ISS - c.ecoule);
    H.sous.textContent = 'avant la prochaine entrée dans l\'ombre (nuit de ' + mmss(d) + ')';
    H.barre.style.width = '0%';
  }
  // Rotations accumulées depuis l'entrée dans l'ombre : même rotation pour ciel et Terre vus de l'ISS,
  // la rotation propre de la Terre est une autre histoire (et vingt fois plus lente).
  const rotISS = ecoule*360/CFG.T_ISS, rotTerre = ecoule*360/CFG.T_TERRE;
  H.angles.innerHTML =
    'Ciel (et sol vu de l\'ISS) : <b class="e">' + rotISS.toFixed(1) + '°</b> autour du pôle orbital<br>' +
    'Rotation propre de la Terre : <b class="t">' + rotTerre.toFixed(1) + '°</b>';

  const es = ETAT.ecl, el = ETAT.eclLune;
  H.eclLigne.hidden = es < 0.001 && el.penombre <= 0;
  if(es >= 0.001) H.ecl.textContent = 'Soleil caché à ' + Math.round(100*es) + ' % (vu de l\'ISS)';
  else if(el.ombre >= 1) H.ecl.textContent = 'de Lune, totale (magnitude ' + el.ombre.toFixed(2) + ')';
  else if(el.ombre > 0) H.ecl.textContent = 'de Lune, partielle (magnitude ' + el.ombre.toFixed(2) + ')';
  else if(el.penombre > 0) H.ecl.textContent = 'de Lune, pénombrale';

  bPose.classList.toggle('rec', POSE.actif);
  bPose.textContent = POSE.actif ? '● Enregistrement · ' + POSE.finies + ' photo' + (POSE.finies > 1 ? 's' : '') : '▶ Enregistrer la nuit';
  if(POSE.visible){
    H.pose.hidden = false;
    const cours = POSE.actif ? Math.floor((ETAT.t - POSE.t0) % CFG.POSE_S) : 0;
    H.pose.textContent = (POSE.actif ? '● Photo ' + (POSE.finies+1) + ' : ' + cours + ' / ' + CFG.POSE_S + ' s · ' : 'Terminé · ')
      + POSE.finies + ' photo' + (POSE.finies > 1 ? 's' : '');
  }else H.pose.hidden = true;
}
