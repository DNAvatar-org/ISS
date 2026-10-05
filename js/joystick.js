// File: js/joystick.js
// Desc: Joystick de visée : un point sur un disque (cap/site), visées prédéfinies illustrées, molette = focale.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Même esprit que le joystick de jpp/topology-v4 (anneau, pastille rouge), mais en position absolue :
   le point EST la direction de visée. Le disque est la carte de toutes les directions autour de l'ISS
   (voir joystick-fond.js) ; les anciens boutons de point de vue sont ici des repères sur cette carte. */
const JOY = {cv:$('joy'), R:JFOND.R, drag:false};
JOY.cx = JOY.cv.getContext('2d');
JOY.cv.width = JOY.cv.height = 2*JOY.R;

const JOY_REPERES = [
  {nom:'pole',    court:'Pôle',   titre:'Pôle (photo) : pôle orbital côté nuit, la Terre en bas'},
  {nom:'poleSol', court:'Pôle ☀', titre:'Pôle orbital côté Soleil'},
  {nom:'nadir',   court:'',       titre:'Terre (nadir) : droit vers le bas, puis zoomer pour le détail'},
  {nom:'oblique', court:'Obl.',   titre:'Terre oblique : vers l\'avant et le bas, que de la Terre'},
  {nom:'avant',   court:'Avant',  titre:'Avant : vers l\'horizon, dans le sens du vol'},
  {nom:'soleil',  court:'☀',      titre:'Soleil : la visée le suit'},
  {nom:'lune',    court:'☾',      titre:'Lune : la visée la suit'}
];

const _jd = new THREE.Vector3(), _jf = new THREE.Vector3(), _ju = new THREE.Vector3(), _jr = new THREE.Vector3(), _jp = new THREE.Vector3();

// (ρ = angle depuis le nadir, ψ = cap) → pixel du disque ; centre = nadir, haut = sens du vol, gauche = +Y.
function joyXY(rho, psi){
  const r = JOY.R*rho/Math.PI;
  return [JOY.R - r*Math.sin(psi), JOY.R - r*Math.cos(psi)];
}
const joyDeCapSite = (cap, site) => joyXY(Math.PI/2 + site, cap);

function reperePos(nom){
  if(nom === 'soleil' || nom === 'lune'){ (nom === 'soleil' ? solISS : luneISS)(_jd); return joyDeCapSite(capDe(_jd), siteDe(_jd)); }
  const v = viseePreset(nom);
  return joyDeCapSite(v.cap*DEG, v.site*DEG);
}

// Empreinte du cône (champ carré) projetée sur le disque.
function empreinte(){
  baseVisee(VUE_ISS.cap, VUE_ISS.site, _jf, _ju, _jr);
  const t = Math.tan(VUE_ISS.fov*DEG/2), pts = [];
  const n = 12;
  for(let k=0;k<4*n;k++){
    const a = (k%n)/n*2 - 1, c = Math.floor(k/n);
    const [x, y] = c === 0 ? [a, -1] : c === 1 ? [1, a] : c === 2 ? [-a, 1] : [-1, -a];
    _jp.copy(_jf).addScaledVector(_jr, x*t).addScaledVector(_ju, y*t).normalize();
    pts.push(joyXY(Math.acos(Math.max(-1, Math.min(1, -_jp.x))), capDe(_jp)));
  }
  return pts;
}

function dessinerJoystick(ms){
  rafraichirFond(ms);
  const c = JOY.cx, R = JOY.R;
  c.clearRect(0, 0, 2*R, 2*R);
  c.save(); c.beginPath(); c.arc(R, R, R-1, 0, 2*Math.PI); c.clip();
  const ciel = c.createRadialGradient(R, R, 0, R, R, R);
  ciel.addColorStop(0, '#0a1020'); ciel.addColorStop(1, '#02040a');
  c.fillStyle = ciel; c.fillRect(0, 0, 2*R, 2*R);
  c.drawImage(JFOND.cv, 0, 0);                                           // la Terre sous l'ISS

  // limbe de la Terre et horizon (ρ = 90°)
  const rE = R*Math.asin(CFG.R/CFG.R_ORB)/Math.PI;
  c.lineWidth = 2; c.strokeStyle = 'rgba(110,170,255,.85)'; c.beginPath(); c.arc(R, R, rE, 0, 2*Math.PI); c.stroke();
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.28)'; c.setLineDash([3, 4]);
  c.beginPath(); c.arc(R, R, R/2, 0, 2*Math.PI); c.stroke(); c.setLineDash([]);
  c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '9px sans-serif'; c.textAlign = 'center';
  c.fillText('horizon', R, R + R/2 + 11); c.fillText('zénith ▸ bord', R, 2*R - 5); c.fillText('vol ▲', R, 11);

  // empreinte du cône (champ de la caméra)
  const e = empreinte();
  c.beginPath(); e.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = 'rgba(255,210,74,.16)'; c.fill();
  c.lineWidth = 1.5; c.strokeStyle = '#ffd24a'; c.stroke();

  // repères (anciens boutons)
  for(const rp of JOY_REPERES){
    const [x, y] = reperePos(rp.nom), actif = ETAT.preset === rp.nom;
    c.beginPath(); c.arc(x, y, actif ? 5 : 3.5, 0, 2*Math.PI);
    c.fillStyle = rp.nom === 'soleil' ? '#ffd24a' : rp.nom === 'lune' ? '#d8dde6' : (actif ? '#ffffff' : 'rgba(255,255,255,.75)'); c.fill();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.7)'; c.stroke();
    if(rp.court){
      c.font = (actif ? '600 ' : '') + '9.5px sans-serif'; c.textAlign = 'left';
      c.fillStyle = '#000'; c.fillText(rp.court, x + 7, y + 4);
      c.fillStyle = actif ? '#fff' : 'rgba(255,255,255,.9)'; c.fillText(rp.court, x + 6, y + 3);
    }
  }

  // la pastille rouge : la visée courante
  const [vx, vy] = joyDeCapSite(VUE_ISS.cap, VUE_ISS.site);
  const g = c.createRadialGradient(vx - 2, vy - 2, 1, vx, vy, 8);
  g.addColorStop(0, '#ff6666'); g.addColorStop(1, '#cc0000');
  c.beginPath(); c.arc(vx, vy, 7, 0, 2*Math.PI); c.fillStyle = g; c.fill();
  c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  c.restore();
}

// Souris : un clic sur un repère le choisit, sinon le point suit le pointeur.
function joyPointeur(ev){
  const b = JOY.cv.getBoundingClientRect(), k = JOY.cv.width/b.width;
  return [(ev.clientX - b.left)*k, (ev.clientY - b.top)*k];
}
function joyRepereSous(x, y){
  for(const rp of JOY_REPERES){ const [rx, ry] = reperePos(rp.nom); if(Math.hypot(x - rx, y - ry) < 9) return rp; }
  return null;
}
function joyViser(x, y){
  const dx = x - JOY.R, dy = y - JOY.R, r = Math.min(Math.hypot(dx, dy), JOY.R);
  viser(Math.atan2(-dx, -dy), r/JOY.R*Math.PI - Math.PI/2);
}

function creerJoystick(){
  JOY.cv.addEventListener('pointerdown', ev => {
    if(POSE.visible && !POSE.actif) poseEffacer();      // on revient à la vue normale
    const [x, y] = joyPointeur(ev), rp = joyRepereSous(x, y);
    if(rp){ choisirPreset(rp.nom); return; }
    JOY.drag = true; JOY.cv.setPointerCapture(ev.pointerId); joyViser(x, y);
  });
  JOY.cv.addEventListener('pointermove', ev => {
    const [x, y] = joyPointeur(ev);
    if(JOY.drag){ joyViser(x, y); return; }
    const rp = joyRepereSous(x, y);
    JOY.cv.style.cursor = rp ? 'pointer' : 'crosshair';
    JOY.cv.title = rp ? rp.titre : 'Glisser : viser. Molette : focale (zoom).';
  });
  JOY.cv.addEventListener('pointerup', () => { JOY.drag = false; });
  // survol + molette = focale : on zoome sans quitter le joystick
  JOY.cv.addEventListener('wheel', ev => {
    ev.preventDefault();
    VUE_ISS.fov = Math.max(0.5, Math.min(110, VUE_ISS.fov*(1 + Math.sign(ev.deltaY)*0.1)));
  }, {passive:false});
}
