// File: js/ui.js
// Desc: Commandes : vues, jauge de vitesse (crans logarithmiques), date (donc β), position sur l'orbite, affichages, pose.
// Version 2.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Crans de vitesse (× temps réel), progression logarithmique ; 0 = pause. */
const VITESSES = [0, 1, 2, 5, 10, 30, 60, 100, 300, 1000, 3000, 10000, 30000, 86400];
const vitLibelle = v => v === 0 ? 'pause' : v === 86400 ? '1 jour/s' : '×' + v.toLocaleString('fr-FR');

function cranVitesse(){
  if(ETAT.pause) return 0;
  let best = 1;
  for(let i=1;i<VITESSES.length;i++) if(Math.abs(Math.log(VITESSES[i]/ETAT.vitesse)) < Math.abs(Math.log(VITESSES[best]/ETAT.vitesse))) best = i;
  return best;
}
// La jauge lit l'état (la pose, le bouton « lever » peuvent le changer) : toujours synchrone.
function majJaugeVitesse(){
  const c = cranVitesse();
  $('sVit').value = c;
  $('oVit').textContent = vitLibelle(c === 0 ? 0 : VITESSES[c]);
}

function marquer(sel, test){
  document.querySelectorAll(sel).forEach(b => b.classList.toggle('on', test(b)));
}
const NOMS_VISEE = {pole:'Pôle', poleSol:'Pôle ☀', nadir:'Nadir', oblique:'Oblique', avant:'Avant', soleil:'Soleil', lune:'Lune'};
// Bouton de la vue embarquée : « satellite → visée » ; le joystick et la focale n'existent que dans la vue ISS.
function majVisee(){
  const t = OBS.nom + ' → ' + (ETAT.preset ? NOMS_VISEE[ETAT.preset] : 'libre');
  const b = $('bVueIss'); if(b.textContent !== t) b.textContent = t;
  $('viseeIss').hidden = ETAT.vue !== 'iss';
}

// Cases « Affichage » : vue Terre seulement, toutes cochées ; ISS et Terre–Lune : toutes décochées et masquées.
let vuePrec = null;
function majAffichage(v){
  $('affichageTerre').hidden = v !== 'ext';
  if(v === vuePrec) return;
  vuePrec = v;
  const on = v === 'ext';
  for(const [id, k] of [['cOrbite','orbite'], ['cReperes','reperes'], ['cTrace','trace'], ['cCone','cone']]){
    $(id).checked = on; ETAT.montrer[k] = on;
  }
}

function majBoutons(){
  majVisee();
  const v = ETAT.vue === 'iss' ? 'iss' : (VUE_EXT.mode === 'lune' ? 'lune' : 'ext');
  marquer('[data-vue]', b => b.dataset.vue === v);
  marquer('[data-sat]', b => b.dataset.sat === OBS.id);
  majAffichage(v);
  majJaugeVitesse();
}

// Position θ du curseur : met à jour t en conservant le cycle courant.
function themeToT(deg){
  const t0 = tTheta(0), base = t0 + Math.floor((ETAT.t - t0)/OBS.T)*OBS.T;     // début du cycle courant (θ = 0)
  return base + deg/360*OBS.T;
}

// Date et β : texte et curseur lisent le même état (date0 + t), toujours synchrones.
function majDateUI(){
  const j = jourDate();
  // la jauge couvre l'année civile EN COURS (365 ou 366 jours) : passé le 31 décembre, elle repart à gauche
  // dans l'année suivante, et la reprendre par la gauche reste dans cette nouvelle année
  const an = new Date(Date.UTC(2021, 0, 1) + j*86400000).getUTCFullYear();
  const debut = (Date.UTC(an, 0, 1) - Date.UTC(2021, 0, 1))/86400000;
  ETAT.debutAnnee = debut;
  $('sDate').max = (Date.UTC(an + 1, 0, 1) - Date.UTC(an, 0, 1))/86400000 - 1/1440;   // droite toute = 31 déc. 23:59 : on y reste
  $('sDate').value = j - debut;
  $('oDate').textContent = libelleDate(j);
  H.lune.textContent = ETAT.lune.croissante ? 'croissante' : 'décroissante';
  dessinerPhase($('hLuneIco'), ETAT.lune.illum, ETAT.lune.croissante);
}

// Le Soleil dépend de la date : recalculé à chaque trame, la scène n'est touchée que s'il a bougé.
let _bSol = NaN, _tSol = NaN;
function majSoleilDate(){
  calculerSoleil(jourDate());
  if(Math.abs(ETAT.beta - _bSol) < 0.01*DEG && Math.abs(ETAT.thetaSol - _tSol) < 0.01*DEG) return;
  _bSol = ETAT.beta; _tSol = ETAT.thetaSol;
  majSoleil(); colorerOrbite();
}

// Un bouton (logo) par satellite : choisir l'observateur et passer dans sa vue embarquée.
function creerBoutonsSats(){
  for(const sat of SATS){
    const b = document.createElement('button');
    b.className = 'b-ico b-sat'; b.dataset.sat = sat.id; b.title = sat.info; b.innerHTML = sat.logo;
    b.onclick = () => { poseEffacer(); activerSat(sat.id); ETAT.vue = 'iss'; majBoutons(); };
    $('sats').appendChild(b);
  }
}

function creerUI(){
  creerBoutonsSats();
  document.querySelectorAll('[data-vue]').forEach(b => b.onclick = () => {
    const v = b.dataset.vue;
    poseEffacer();                                       // changer de vue : on retire l'empilement pour revoir la vue normale
    if(v === 'lune') vueTerreLune(); else if(v === 'ext') vueTerre(); else ETAT.vue = 'iss';
    majBoutons(); });

  $('sVit').oninput = e => {
    const c = +e.target.value;
    if(c === 0){ ETAT.pause = true; }
    else { ETAT.vitesse = VITESSES[c]; ETAT.pause = false; }
    majJaugeVitesse();
  };

  $('sTheta').oninput = e => { poseInterrompre(); ETAT.t = themeToT(+e.target.value); };
  // coucher de Soleil : vue ISS braquée sur le Soleil encore visible, 45 s avant l'entrée dans l'ombre, au ralenti
  $('bDebutNuit').onclick = () => {
    poseInterrompre();
    ETAT.t = tEntree(cycleNuit(ETAT.t).k + 1) - 45;
    ETAT.vue = 'iss'; choisirPreset('soleil');
    VUE_ISS.decal = -10*DEG; VUE_ISS.fov = 45;           // le Soleil un peu au-dessus du centre, l'horizon dessous
    ETAT.vitesse = 10; ETAT.pause = false; majBoutons();
  };

  // lever de Soleil : vue ISS braquée sur le Soleil juste avant la sortie de l'ombre, au ralenti
  $('bLever').onclick = () => {
    poseInterrompre();
    const c = cycleNuit(ETAT.t), k = c.nuit ? c.k : c.k + 1;
    ETAT.t = tEntree(k) + dureeNuit() - 45;
    ETAT.vue = 'iss'; choisirPreset('soleil');
    VUE_ISS.decal = -10*DEG; VUE_ISS.fov = 45;           // le Soleil un peu au-dessus du centre, l'horizon dessous
    ETAT.vitesse = 10; ETAT.pause = false; majBoutons();
  };
  // éclipses 2021 (instants du maximum, UT) : toujours la vue ISS au téléobjectif, braquée sur la Lune
  $('sEcl').onchange = e => {
    if(!e.target.value) return;
    const j = e.target.value.split('|')[0];
    poseInterrompre();
    ETAT.date0 = +j - ETAT.t/86400; majSoleilDate();
    ETAT.vue = 'iss'; choisirPreset('lune'); VUE_ISS.fov = 2;     // toute éclipse : vue ISS braquée sur la Lune
    e.target.value = ''; majBoutons();
  };
  // glisser la date : on ne touche pas à t (la phase sur l'orbite reste) ; β en découle
  /* Jauge « compteur » : pousser au-delà du bord droit → 1er janv. de l'année suivante (jauge à gauche toute) ;
     pousser au-delà du bord gauche → 31 déc. de l'année précédente (jauge à droite toute). Un seul pas par poussée :
     tant que le pointeur reste dehors, la jauge ne lit plus la souris ; elle se réarme quand il revient dessus. */
  const JD = {glisse:false, dehors:false};
  $('sDate').addEventListener('pointerdown', () => { JD.glisse = true; JD.dehors = false; });
  addEventListener('pointerup', () => { JD.glisse = false; JD.dehors = false; });
  addEventListener('pointermove', e => {
    if(!JD.glisse) return;
    const b = $('sDate').getBoundingClientRect(), marge = 6;
    const sens = e.clientX > b.right + marge ? 1 : e.clientX < b.left - marge ? -1 : 0;
    if(sens === 0){ JD.dehors = false; return; }
    if(JD.dehors) return;
    const j = jourDate(), an = new Date(Date.UTC(2021, 0, 1) + j*86400000).getUTCFullYear();
    const cible = sens > 0 ? (Date.UTC(an + 1, 0, 1) - Date.UTC(2021, 0, 1))/86400000
                           : (Date.UTC(an, 0, 1) - Date.UTC(2021, 0, 1))/86400000 - 1/1440;
    if(CFG.PLUS_1_AN_SEUL && (cible < 0 || cible >= CFG.JOUR_MAX)) return;     // bornes du drapeau : 2021 et 2022
    JD.dehors = true; poseInterrompre();
    ETAT.date0 = cible - ETAT.t/86400; majSoleilDate(); majDateUI();
  });
  $('sDate').oninput = e => { if(JD.dehors) return; poseInterrompre(); ETAT.date0 = ETAT.debutAnnee + +e.target.value - ETAT.t/86400; };

  $('cOrbite').onchange = e => { poseInterrompre(); ETAT.montrer.orbite = e.target.checked; };
  $('cReperes').onchange = e => { poseInterrompre(); ETAT.montrer.reperes = e.target.checked; };
  $('cTrace').onchange = e => { poseInterrompre(); ETAT.montrer.trace = e.target.checked; };
  $('cCone').onchange = e => { poseInterrompre(); ETAT.montrer.cone = e.target.checked; };

  $('bZen').onclick = basculerZen;
  bPose.onclick = () => { poseLancer(); majBoutons(); };
  $('bPoseSave').onclick = poseEnregistrerPNG;
  $('bPoseOff').onclick = poseEffacer;

  majBoutons();
}

// La focale suit le champ (molette sur le disque ou dans la vue ISS) ; le cône se déduit du même champ.
function majCurseurFocale(){
  $('oFoc').textContent = Math.round(focaleDepuisFov(VUE_ISS.fov)) + ' mm · ' + VUE_ISS.fov.toFixed(0) + '°';
}

// Le curseur θ suit le temps (sauf pendant la manipulation).
function majCurseurTheta(){
  const th = ((thetaObs(ETAT.t)/DEG) % 360 + 360) % 360;
  $('sTheta').value = th;
  const sec = Math.floor(((jourDate() % 1) + 1) % 1 * 86400), p2 = n => String(n).padStart(2, '0');   // heure de Greenwich (UT)
  $('oTheta').textContent = p2(Math.floor(sec/3600)) + ':' + p2(Math.floor(sec/60) % 60) + ':' + p2(sec % 60);
}

/* Icône de phase, comme sur les calendriers (hémisphère nord) : la Lune croissante est éclairée à droite.
   Le terminateur est une demi-ellipse de demi-largeur r·|1 − 2·fraction éclairée|. */
function dessinerPhase(cv, illum, croissante){
  const c = cv.getContext('2d'), w = cv.width, r = w/2 - 2, x0 = w/2, y0 = w/2;
  c.clearRect(0, 0, w, w);
  c.fillStyle = '#2a2f3a'; c.beginPath(); c.arc(x0, y0, r, 0, 2*Math.PI); c.fill();          // face sombre
  const s = croissante ? 1 : -1;                                                            // côté éclairé : +1 droite
  const e = r*Math.abs(1 - 2*illum);
  c.fillStyle = '#f2efe4'; c.beginPath();
  c.arc(x0, y0, r, -Math.PI/2, Math.PI/2, s < 0);                                           // limbe éclairé
  // retour par le terminateur : bombé vers le côté sombre si gibbeuse, vers le côté éclairé si croissant
  // (canvas : sens horaire = angles croissants, donc de π/2 vers −π/2 « horaire » passe par la gauche)
  c.ellipse(x0, y0, Math.max(e, 0.01), r, 0, Math.PI/2, -Math.PI/2, (illum > 0.5) !== (s > 0));
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.beginPath(); c.arc(x0, y0, r, 0, 2*Math.PI); c.stroke();
}

/* Un seul bouton : masque les fenêtres ET passe en plein écran (F11), ou revient. Échap (sortie du plein écran par le
   navigateur) rétablit aussi les fenêtres. Sans API plein écran (iframe…), il masque seulement les fenêtres. */
function basculerZen(){
  const zen = !document.body.classList.contains('zen');
  document.body.classList.toggle('zen', zen);
  if(zen && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  if(!zen && document.fullscreenElement) document.exitFullscreen();
}
document.addEventListener('fullscreenchange', () => {
  if(!document.fullscreenElement) document.body.classList.remove('zen');
});
