// File: js/ui.js
// Desc: Commandes : vues, jauge de vitesse (crans logarithmiques), date (donc β), position sur l'orbite, affichages, pose.
// Version 2.1.0
// Date: [October 06, 2026]
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
  for(const b of $('reperes').children) b.classList.toggle('on', b.dataset.preset === ETAT.preset);   // le repère choisi est allumé
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

// Point de vue et satellite sélectionnés : seulement quand on regarde la vue en direct (pas une capture ou une photo).
function majSelections(){
  const direct = photoVue.hidden;
  const v = ETAT.vue === 'iss' ? 'iss' : (VUE_EXT.mode === 'lune' ? 'lune' : 'ext');
  marquer('[data-vue]', b => direct && b.dataset.vue === v);
  marquer('[data-sat]', b => direct && b.dataset.sat === OBS.id);
}

function majBoutons(){
  majVisee();
  const v = ETAT.vue === 'iss' ? 'iss' : (VUE_EXT.mode === 'lune' ? 'lune' : 'ext');
  majSelections();
  majAffichage(v);
  majJaugeVitesse();
}

/* Jauge « compteur » : pousser le pointeur au-delà d'un bord fait passer à l'unité suivante (sens = +1) ou précédente (−1),
   via deborder(sens) qui renvoie false hors des bornes. Un seul pas par poussée : tant que le pointeur reste dehors,
   la jauge ne lit plus la souris (dehors = true) ; elle se réarme quand il revient dessus. */
function jaugeCompteur(el, deborder){
  const J = {glisse:false, dehors:false};
  el.addEventListener('pointerdown', () => { J.glisse = true; J.dehors = false; });
  addEventListener('pointerup', () => { J.glisse = false; J.dehors = false; });
  addEventListener('pointermove', e => {
    if(!J.glisse) return;
    const b = el.getBoundingClientRect(), marge = 6;
    const sens = e.clientX > b.right + marge ? 1 : e.clientX < b.left - marge ? -1 : 0;
    if(sens === 0){ J.dehors = false; return; }
    if(J.dehors) return;
    if(deborder(sens)) J.dehors = true;
  });
  return J;
}

/* Petit écran : les crédits des cartes se posent AU-DESSUS de la signature quand l'encart Temps leur laisse la place
   (priorité : ne rien superposer) ; sinon tout en bas, par-dessus la signature. Rappelé au redimensionnement. */
function placerCredits(){
  const c = $('credits');
  document.documentElement.style.setProperty('--bas-hud', Math.round($('hud').getBoundingClientRect().bottom) + 'px');   // portrait : l'encart du bas s'arrête sous celui du haut
  c.style.bottom = '';                                             // retour à la CSS (bureau : déjà au-dessus du pied)
  if(!matchMedia('(max-width:760px), (max-height:500px)').matches || getComputedStyle(c).display === 'none') return;   // (offsetParent vaut toujours null en position fixed)
  const h = $('hud').getBoundingClientRect(), p = $('pied').getBoundingClientRect(), ch = c.getBoundingClientRect().height;
  const bas = innerHeight - p.top + 4;                             // juste au-dessus de la signature
  if(innerHeight - bas - ch >= h.bottom + 6) c.style.bottom = bas + 'px';
  document.documentElement.style.setProperty('--haut-credits', Math.round(innerHeight - c.getBoundingClientRect().top) + 'px');   // portrait : l'encart du bas s'arrête dessous
}

/* Joystick : couche séparée, dessous (voir css « ZONE DE VISÉE »). Son diamètre = la hauteur de la zone (rangée « point de vue »
   → Focale, ou jusqu'aux boutons de capture très bas), borné par la largeur disponible ; en paysage bas au plus ×1,8 (346 px),
   et l'encart de gauche s'élargit d'autant (--jd). Il ne change jamais la hauteur de l'encart : pas de boucle de mise en page. */
function dimensionnerJoystick(){
  if($('viseeIss').hidden) return;
  const j = $('joy'), wrap = $('joyWrap');
  const bas = matchMedia('(max-height:500px) and (orientation:landscape)').matches;
  let D = wrap.clientHeight;
  if(bas){
    D = Math.min(D, 346, innerWidth - $('hud').offsetWidth - 24 - 66);                 // largeur laissée à gauche de l'encart Temps
    document.documentElement.style.setProperty('--jd', Math.max(96, Math.round(D)) + 'px');
  }else{
    document.documentElement.style.removeProperty('--jd');
    D = Math.min(D, wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingLeft), 420);
  }
  D = Math.max(96, Math.round(D));
  j.style.width = j.style.height = D + 'px';
}

/* Filet de sécurité : si, sur CET appareil (polices, barre d'adresse…), l'encart de gauche déborde malgré les calculs de la CSS,
   les boutons carrés rétrécissent (paysage) et la zone de visée raccourcit (portrait) plutôt que de faire apparaître une barre
   de défilement. */
function ajusterPanneau(){
  const p = $('panel'), r = document.documentElement.style;
  r.setProperty('--ic-moins', '0px'); r.setProperty('--zm', '0px');
  const trop = p.scrollHeight - p.clientHeight;
  if(trop > 0 && !$('viseeIss').hidden){
    r.setProperty('--ic-moins', Math.min(10, Math.ceil(trop/7)) + 'px');
    r.setProperty('--zm', trop + 'px');
  }
  dimensionnerJoystick();
}

// Position θ du curseur : met à jour t en conservant le cycle courant.
function themeToT(deg){
  const t0 = tTheta(0), base = t0 + Math.floor((ETAT.t - t0)/OBS.T)*OBS.T;     // début du cycle courant (θ = 0)
  return base + deg/360*OBS.T;
}

// Date et β : texte et curseur lisent le même état (date0 + t), toujours synchrones.
// Menu « Éclipses » : celles de l'année affichée ; reconstruit quand la date change d'année.
let anMenuEcl = null;
function majMenuEclipses(an){
  if(an === anMenuEcl) return;
  anMenuEcl = an;
  $('bEclTxt').textContent = 'Éclipses ' + an + '…';
  const l = $('lEcl');
  l.textContent = '';
  for(const e of eclipsesAnnee(an)){
    const b = document.createElement('button'); b.type = 'button'; b.dataset.jour = e[0]; b.textContent = libelleEclipse(e); l.appendChild(b);
  }
}
// La liste s'ouvre sous le bouton, alignée à droite, bornée par le bas de l'écran (défile au besoin).
function ouvrirMenuEclipses(ouvrir){
  const l = $('lEcl');
  l.hidden = !ouvrir;
  $('bEcl').classList.toggle('on', ouvrir);
  if(!ouvrir) return;
  const r = $('bEcl').getBoundingClientRect();
  l.style.top = (r.bottom + 4) + 'px';
  l.style.right = (innerWidth - r.right) + 'px';
  l.style.minWidth = r.width + 'px';
  l.style.maxHeight = (innerHeight - r.bottom - 12) + 'px';
}

function majDateUI(){
  const j = jourDate();
  // la jauge couvre l'année civile EN COURS (365 ou 366 jours) : passé le 31 décembre, elle repart à gauche
  // dans l'année suivante, et la reprendre par la gauche reste dans cette nouvelle année
  const an = new Date(Date.UTC(2021, 0, 1) + j*86400000).getUTCFullYear();
  const debut = (Date.UTC(an, 0, 1) - Date.UTC(2021, 0, 1))/86400000;
  ETAT.debutAnnee = debut;
  majMenuEclipses(an);
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
    // fond = les couleurs de la trajectoire, coupées en diagonale : partie au jour / partie à l'ombre
    const rgba = (c, a) => 'rgba(' + c.map(v => Math.round(v*255)).join(',') + ',' + a + ')';
    b.style.background = 'linear-gradient(135deg, ' + rgba(sat.jour, .6) + ' 0 50%, ' + rgba(sat.nuit, .6) + ' 50% 100%)';
    b.onclick = () => {
      if(ETAT.vue === 'iss' || VUE_EXT.mode === 'lune') poseEffacer();   // l'empilement appartient au satellite ; les captures de la vue Terre restent
      activerSat(sat.id);
      if(ETAT.vue === 'ext' && VUE_EXT.mode === 'lune') ETAT.vue = 'iss';   // Terre–Lune : on passe dans le satellite ; Terre et vue embarquée : on y reste
      majBoutons();
    };
    const w = document.createElement('div'), nom = document.createElement('span');
    w.className = 'sat'; nom.textContent = sat.nom;
    w.append(b, nom);
    $('sats').appendChild(w);
  }
}

function creerUI(){
  creerBoutonsSats();
  // une image affichée (capture ou photo) : tout clic sur un bouton, une case ou un menu ramène à la vue en direct
  document.addEventListener('click', e => {
    if(e.target.closest('#galerie')) return;
    if(e.target.closest('button, input, select, label')) fermerPhoto();
  }, true);
  document.querySelectorAll('[data-vue]').forEach(b => b.onclick = () => {
    const v = b.dataset.vue;
    if(ETAT.vue === 'iss' || v === 'iss') poseEffacer();   // entrer ou sortir de la vue embarquée : on retire l'empilement ; Terre ↔ Terre–Lune garde les captures
    if(v === 'lune') vueTerreLune(); else if(v === 'ext') vueTerre(); else ETAT.vue = 'iss';
    majBoutons(); });

  // cran c de la jauge (0 = pause) ; les doubles flèches de « Vit. » passent au cran voisin
  const reglerCran = c => {
    c = Math.max(0, Math.min(VITESSES.length - 1, c));
    if(c === 0){ ETAT.pause = true; }
    else { ETAT.vitesse = VITESSES[c]; ETAT.pause = false; }
    majJaugeVitesse();
  };
  $('sVit').oninput = e => reglerCran(+e.target.value);
  $('bVitMoins').onclick = () => reglerCran(cranVitesse() - 1);
  $('bVitPlus').onclick  = () => reglerCran(cranVitesse() + 1);

  // coucher de Soleil : vue ISS braquée sur le Soleil encore visible, 45 s avant l'entrée dans l'ombre, au ralenti
  $('bDebutNuit').onclick = () => {
    poseInterrompre();
    ETAT.t = tEntree(cycleNuit(ETAT.t).k + 1) - 45;
    ETAT.vue = 'iss'; choisirPreset('soleil');
    VUE_ISS.decal = -10*DEG; VUE_ISS.fov = 45;           // le Soleil un peu au-dessus du centre, l'horizon dessous
    ETAT.vitesse = 10; ETAT.pause = false; majBoutons();
  };

  // aujourd'hui : date et heure réelles (UT) lues sur l'horloge de l'appareil, en temps réel (×1). La phase de l'ISS
  // sur son orbite (t) ne change pas : seule la date, donc le Soleil et le plan de l'orbite, saute à maintenant.
  $('bAuj').onclick = () => {
    poseInterrompre();
    const jour = (Date.now() - Date.UTC(2021, 0, 1))/86400000;
    if(jour < DATES.min || jour >= DATES.max) return;                       // bornes 2000 – 2035 (dates.js)
    ETAT.date0 = jour - ETAT.t/86400; majSoleilDate();
    ETAT.vitesse = 1; ETAT.pause = false; majBoutons(); majDateUI();
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
  $('bEcl').onclick = () => ouvrirMenuEclipses($('lEcl').hidden);
  $('lEcl').onclick = e => {
    const b = e.target.closest('button');
    if(!b) return;
    ouvrirMenuEclipses(false);
    poseInterrompre();
    ETAT.date0 = +b.dataset.jour - ETAT.t/86400; majSoleilDate();
    ETAT.vue = 'iss'; choisirPreset('lune'); VUE_ISS.fov = 2;     // toute éclipse : vue ISS braquée sur la Lune
    majBoutons();
  };
  // ailleurs (canevas, encarts, Échap, redimensionnement) : la liste se ferme
  addEventListener('pointerdown', e => { if(!e.target.closest('#lEcl, #bEcl')) ouvrirMenuEclipses(false); });
  addEventListener('keydown', e => { if(e.key === 'Escape') ouvrirMenuEclipses(false); });
  addEventListener('resize', () => ouvrirMenuEclipses(false));
  addEventListener('resize', placerCredits);
  addEventListener('resize', ajusterPanneau);
  new ResizeObserver(ajusterPanneau).observe($('panel'));
  new ResizeObserver(dimensionnerJoystick).observe($('joyWrap'));          // la zone de visée change de hauteur (vue, Focale masquée…)
  ajusterPanneau();
  new ResizeObserver(placerCredits).observe($('hud'));         // la hauteur de l'encart Temps change (galerie, vues)
  placerCredits();
  // glisser la date : on ne touche pas à t (la phase sur l'orbite reste) ; β en découle.
  // Bord droit → 1er janv. de l'année suivante (jauge à gauche toute) ; bord gauche → 31 déc. de l'année précédente.
  const JD = jaugeCompteur($('sDate'), sens => {
    const j = jourDate(), an = new Date(Date.UTC(2021, 0, 1) + j*86400000).getUTCFullYear();
    const cible = sens > 0 ? (Date.UTC(an + 1, 0, 1) - Date.UTC(2021, 0, 1))/86400000
                           : (Date.UTC(an, 0, 1) - Date.UTC(2021, 0, 1))/86400000 - 1/1440;
    if(cible < DATES.min || cible >= DATES.max) return false;               // bornes 2000 – 2035 (dates.js)
    poseInterrompre();
    ETAT.date0 = cible - ETAT.t/86400; majSoleilDate(); majDateUI();
    return true;
  });
  $('sDate').oninput = e => { if(JD.dehors) return; poseInterrompre(); ETAT.date0 = ETAT.debutAnnee + +e.target.value - ETAT.t/86400; };

  // curseur gris = position sur l'orbite courante. Bord droit → orbite suivante, θ = 0 (curseur à gauche toute) ;
  // bord gauche → orbite précédente, θ juste sous 360° (curseur à droite toute).
  const JT = jaugeCompteur($('sTheta'), sens => {
    const t = sens > 0 ? themeToT(0) + OBS.T : themeToT(0) - 0.5;
    const j = ETAT.date0 + t/86400;
    if(j < DATES.min || j >= DATES.max) return false;
    poseInterrompre();
    ETAT.t = t; majSoleilDate(); majCurseurTheta();
    return true;
  });
  // 359,9° au plus : à 360°, themeToT donnerait déjà θ = 0 de l'orbite suivante
  $('sTheta').oninput = e => { if(JT.dehors) return; poseInterrompre(); ETAT.t = themeToT(Math.min(+e.target.value, 359.9)); };

  $('cOrbite').onchange = e => { poseInterrompre(); ETAT.montrer.orbite = e.target.checked; };
  $('cReperes').onchange = e => { poseInterrompre(); ETAT.montrer.reperes = e.target.checked; };
  $('cTrace').onchange = e => { poseInterrompre(); ETAT.montrer.trace = e.target.checked; };
  $('cCone').onchange = e => { poseInterrompre(); ETAT.montrer.cone = e.target.checked; };

  $('bZen').onclick = basculerZen;
  $('bCapture').onclick = capturer;
  bPose.onclick = () => { poseLancer(); majBoutons(); };
  $('bPoseSave').onclick = enregistrerImage;
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
  if(zen && document.documentElement.requestFullscreen && !document.fullscreenElement)
    document.documentElement.requestFullscreen().catch(() => {});   // iPhone : pas d'API plein écran, les encarts se masquent seulement
  if(!zen && document.fullscreenElement) document.exitFullscreen();
}
document.addEventListener('fullscreenchange', () => {
  if(!document.fullscreenElement) document.body.classList.remove('zen');
});
