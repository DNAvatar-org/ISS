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
// Bouton ISS : « ISS → visée » ; le joystick et la focale n'existent que dans la vue ISS.
function majVisee(){
  const t = 'ISS → ' + (ETAT.preset ? NOMS_VISEE[ETAT.preset] : 'libre');
  const b = $('bVueIss'); if(b.textContent !== t) b.textContent = t;
  $('viseeIss').hidden = ETAT.vue !== 'iss';
}

function majBoutons(){
  majVisee();
  const v = ETAT.vue === 'iss' ? 'iss' : (VUE_EXT.mode === 'lune' ? 'lune' : 'ext');
  marquer('[data-vue]', b => b.dataset.vue === v);
  majJaugeVitesse();
}

// Position θ du curseur : met à jour t en conservant le cycle courant.
function themeToT(deg){
  const base = Math.floor(ETAT.t/CFG.T_ISS)*CFG.T_ISS;
  return base + deg/360*CFG.T_ISS;
}

// Date et β : texte et curseur lisent le même état (date0 + t), toujours synchrones.
function majDateUI(){
  const j = jourDate();
  // la jauge couvre l'année civile EN COURS (365 ou 366 jours) : passé le 31 décembre, elle repart à gauche
  // dans l'année suivante, et la reprendre par la gauche reste dans cette nouvelle année
  const an = new Date(Date.UTC(2021, 0, 1) + j*86400000).getUTCFullYear();
  const debut = (Date.UTC(an, 0, 1) - Date.UTC(2021, 0, 1))/86400000;
  ETAT.debutAnnee = debut;
  $('sDate').max = (Date.UTC(an + 1, 0, 1) - Date.UTC(an, 0, 1))/86400000;
  $('sDate').value = j - debut;
  $('oDate').textContent = libelleDate(j);
  H.beta.textContent = (ETAT.beta/DEG).toFixed(1) + '°';
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

function creerUI(){
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

  $('sTheta').oninput = e => { ETAT.t = themeToT(+e.target.value); };
  $('bDebutNuit').onclick = () => { const k = cycleNuit(ETAT.t).k; ETAT.t = tEntree(k + (cycleNuit(ETAT.t).nuit ? 0 : 1)); };

  // lever de Soleil : vue ISS braquée sur le Soleil juste avant la sortie de l'ombre, au ralenti
  $('bLever').onclick = () => {
    const c = cycleNuit(ETAT.t), k = c.nuit ? c.k : c.k + 1;
    ETAT.t = tEntree(k) + dureeNuit() - 45;
    ETAT.vue = 'iss'; choisirPreset('soleil');
    VUE_ISS.decal = -10*DEG; VUE_ISS.fov = 45;           // le Soleil un peu au-dessus du centre, l'horizon dessous
    ETAT.vitesse = 10; ETAT.pause = false; majBoutons();
  };
  // éclipses 2021 (instants du maximum, UT) : Soleil → vue éloignée côté Soleil, on voit l'ombre de la Lune sur la Terre ;
  // Lune → vue ISS au téléobjectif sur la Lune
  $('sEcl').onchange = e => {
    if(!e.target.value) return;
    const [j, type] = e.target.value.split('|');
    poseEffacer();
    ETAT.date0 = +j - ETAT.t/86400; majSoleilDate();
    if(type === 'soleil'){
      ETAT.vue = 'ext'; VUE_EXT.mode = 'terre'; VUE_EXT.r = 230;
      VUE_EXT.th = Math.atan2(ETAT.S.x, ETAT.S.z); VUE_EXT.ph = Math.asin(ETAT.S.y);
    }else{
      ETAT.vue = 'iss'; choisirPreset('lune'); VUE_ISS.fov = 2;
    }
    e.target.value = ''; majBoutons();
  };
  // glisser la date : on ne touche pas à t (la phase sur l'orbite reste) ; β en découle
  $('sDate').oninput = e => { ETAT.date0 = ETAT.debutAnnee + +e.target.value - ETAT.t/86400; };

  $('cOrbite').onchange  = e => ETAT.montrer.orbite = e.target.checked;
  $('cReperes').onchange = e => ETAT.montrer.reperes = e.target.checked;
  $('cTrace').onchange   = e => ETAT.montrer.trace = e.target.checked;
  $('cCone').onchange    = e => ETAT.montrer.cone = e.target.checked;

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
  const th = ((thetaISS(ETAT.t)/DEG) % 360 + 360) % 360;
  $('sTheta').value = th;
  $('oTheta').textContent = th.toFixed(0) + '°';
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
