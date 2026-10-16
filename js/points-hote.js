// File: js/points-hote.js
// Desc: Points posés sur la Terre par la page hôte (message iss:points) — ex. les créatures de DNA Tamagoshi
//       (site/creatures/tamagoshi, « recherche partenaire ») : un disque de couleur par point, de taille fixe à l'écran,
//       enfant du globe (il tourne avec lui), caché par la Terre de l'autre côté ; son texte au survol.
// Version 1.0.0
// Date: [October 16, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Message { type: 'iss:points', groupes: [{ taille, points: [{ lat, lon, couleur, texte }] }] } — remplace les précédents.
   taille : diamètre en px CSS ; couleur : '#rrggbb' ; lat / lon en degrés ; texte : montré au survol (#pointsInfo).
   Un THREE.Points par groupe (une taille par groupe), posé juste au-dessus du sol (R × 1,003). Survol : le point visible
   le plus proche du pointeur, à moins de sa taille, dans la caméra qui dessine (ISS ou vue extérieure). */
const PTS_HOTE = {objets:[], liste:[], info:null, disque:null};

/* Disque blanc doux (texture des points) : les points sont des carrés sinon. */
function disquePointsHote(){
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, '#fff'); d.addColorStop(0.7, '#fff'); d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function poserPointsHote(groupes){
  PTS_HOTE.objets.forEach(o => { TERRE.globe.remove(o); o.geometry.dispose(); o.material.dispose(); });
  PTS_HOTE.objets = [];
  PTS_HOTE.liste = [];
  if(PTS_HOTE.disque === null) PTS_HOTE.disque = disquePointsHote();
  const c = new THREE.Color();
  for(const gr of groupes){
    const n = gr.points.length, pos = new Float32Array(3*n), coul = new Float32Array(3*n), v = new THREE.Vector3();
    gr.points.forEach((p, i) => {
      vecGeo(p.lat, p.lon, CFG.R*1.003, v).toArray(pos, 3*i);
      c.set(p.couleur).toArray(coul, 3*i);
      PTS_HOTE.liste.push({v:v.clone(), taille:gr.taille, texte:p.texte});
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(coul, 3));
    const o = new THREE.Points(g, new THREE.PointsMaterial({size:gr.taille*renderer.getPixelRatio(), sizeAttenuation:false,
      vertexColors:true, map:PTS_HOTE.disque, transparent:true, alphaTest:0.3}));
    TERRE.globe.add(o);
    PTS_HOTE.objets.push(o);
  }
}

/* Survol : projection de chaque point (repère du globe → monde → écran) ; caché si la Terre est entre lui et la caméra
   (normale au sol tournée à l'opposé de l'œil). */
const _phW = new THREE.Vector3(), _phO = new THREE.Vector3();
function survolerPointsHote(e){
  if(PTS_HOTE.liste.length === 0) return;
  const cam = ETAT.vue === 'iss' ? camIss : camExt, r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  cam.getWorldPosition(_phO);
  let best = null, dBest = Infinity;
  for(const p of PTS_HOTE.liste){
    TERRE.globe.localToWorld(_phW.copy(p.v));
    const n = _phW.clone().normalize();
    if(n.dot(_phO.clone().sub(_phW)) <= 0) continue;                       // de l'autre côté de la Terre
    _phW.project(cam);
    if(_phW.z < -1 || _phW.z > 1) continue;
    const d = Math.hypot((_phW.x + 1)/2*r.width - x, (1 - _phW.y)/2*r.height - y);
    if(d < Math.max(p.taille, 6) && d < dBest){ dBest = d; best = p; }
  }
  const info = PTS_HOTE.info;
  info.hidden = best === null;
  if(best === null) return;
  info.textContent = best.texte;
  info.style.left = (e.clientX + 14) + 'px';
  info.style.top = (e.clientY + 14) + 'px';
}

/* Étiquette de survol : créée ici (pas dans index.html) pour que ce fichier se suffise ; style minimal en ligne. */
PTS_HOTE.info = document.createElement('div');
PTS_HOTE.info.id = 'pointsInfo';
PTS_HOTE.info.hidden = true;
PTS_HOTE.info.style.cssText = 'position:fixed;z-index:5;pointer-events:none;padding:4px 8px;border-radius:6px;' +
  'background:rgba(0,0,0,0.7);color:#fff;font:12px system-ui,sans-serif;white-space:pre';
document.body.appendChild(PTS_HOTE.info);
canvas.addEventListener('pointermove', survolerPointsHote);
canvas.addEventListener('pointerleave', () => { PTS_HOTE.info.hidden = true; });

addEventListener('message', e => {
  if(!e.data || e.data.type !== 'iss:points') return;
  poserPointsHote(e.data.groupes);
});
