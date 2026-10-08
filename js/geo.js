// File: js/geo.js
// Desc: « Pays et coordonnées » : étiquettes en pancarte (océans, pays, villes), quadrillage lat/lon adapté au zoom, coordonnées du centre et du pointeur.
// Version 1.1.0
// Date: [October 08, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Case « Pays et coordonnées » (ETAT.montrer.geo, ?montrer=geo), dans toutes les vues :
   – étiquettes HTML (#geoEtiquettes) posées chaque trame sur leur point du globe (geo-data.js), cachées derrière la
     Terre ; selon l'étendue au sol visible : océans et grands pays de loin, puis pays moyens, villes, petits pays et
     îles ; celles qui se chevauchent cèdent la place (ordre : grands pays, océans, pays moyens, villes, petits pays) ;
   – quadrillage de latitudes et longitudes, enfant du globe (il tourne avec lui), pas de 30° à 0,01° (~1 km) choisi
     d'après l'étendue au sol ; aux pas fins, seulement autour du point visé. Posé sur le sol même, sans test de
     profondeur (au téléobjectif, quelques km d'écart se verraient) : le shader écarte le côté caché de la Terre ;
   – en bas (#geoInfo) : latitude et longitude du centre de l'image et du point sous le pointeur, largeur au sol.
   Repère local du globe = celui de SphereGeometry : φ = (lon + 180)°, θ = 90° − lat (cf. tuiles-rendu.js). */
const GEO = {etiq:[], grille:null, cle:'', pointeur:null};
const PAS_GEO = [30, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];

const vecGeo = (lat, lon, r, out = new THREE.Vector3()) => {
  const ph = (lon + 180)*DEG, th = (90 - lat)*DEG;
  return out.set(-Math.cos(ph)*Math.sin(th)*r, Math.cos(th)*r, Math.sin(ph)*Math.sin(th)*r);
};
const geoDeLocal = v => ({lat:Math.asin(Math.max(-1, Math.min(1, v.y/v.length())))/DEG,
                          lon:((Math.atan2(v.z, -v.x)/DEG - 180) % 360 + 540) % 360 - 180});

const GLSL_GRILLE_VS = `
varying vec3 vW; varying vec3 vN;
void main(){
  vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix)*position);
  gl_Position = projectionMatrix*viewMatrix*w;
}`;
const GLSL_GRILLE_FS = `
varying vec3 vW; varying vec3 vN;
void main(){
  if(dot(vN, normalize(cameraPosition - vW)) < 0.0) discard;         // côté caché de la Terre
  gl_FragColor = vec4(1.0, 0.92, 0.6, 0.45);
}`;

function creerGeo(){
  const box = $('geoEtiquettes');
  const ajouter = (nom, lat, lon, type, prio) => {
    const d = document.createElement('div');
    d.className = 'geo ' + type; d.textContent = nom; d.hidden = true; box.appendChild(d);
    GEO.etiq.push({d, v:vecGeo(lat, lon, CFG.R), type, prio, w:0, h:0, vu:false});
  };
  for(const [n, la, lo, r] of GEO_PAYS) ajouter(n, la, lo, 'pays r' + r, r === 1 ? 0 : r === 2 ? 2 : 4);
  for(const [n, la, lo] of GEO_MERS) ajouter(n, la, lo, 'mer', 1);
  for(const [n, la, lo] of GEO_VILLES) ajouter(n, la, lo, 'ville', 3);
  GEO.etiq.sort((a, b) => a.prio - b.prio);
  GEO.grille = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    vertexShader:GLSL_GRILLE_VS, fragmentShader:GLSL_GRILLE_FS, transparent:true, depthTest:false, depthWrite:false}));
  GEO.grille.frustumCulled = false; GEO.grille.renderOrder = 5; GEO.grille.visible = false;
  TERRE.globe.add(GEO.grille);
  const cv = renderer.domElement;
  cv.addEventListener('pointermove', e => { GEO.pointeur = {x:e.clientX/innerWidth*2 - 1, y:1 - e.clientY/innerHeight*2}; });
  cv.addEventListener('pointerleave', () => { GEO.pointeur = null; });
}

// Point de la Terre vu dans la direction (nx, ny) de l'écran (coordonnées normalisées) : {lat, lon, d} ou null (ciel).
const _gr = new THREE.Raycaster(), _gs = new THREE.Sphere(), _gp = new THREE.Vector3();
function pointTerre(cam, nx, ny){
  _gr.setFromCamera({x:nx, y:ny}, cam);
  _gs.set(TERRE.globe.getWorldPosition(_gs.center), CFG.R);
  if(!_gr.ray.intersectSphere(_gs, _gp)) return null;
  const d = _gp.distanceTo(cam.getWorldPosition(new THREE.Vector3()));
  return Object.assign(geoDeLocal(TERRE.globe.worldToLocal(_gp)), {d});
}

// Quadrillage au pas p : tout le globe aux grands pas, sinon une fenêtre de ±12 pas autour de (lat0, lon0).
function construireGrille(p, lat0, lon0){
  const pos = [], R = CFG.R, v = new THREE.Vector3();
  const local = p < 5, n = 12;
  const la0 = local ? Math.max(-90, (Math.floor(lat0/p) - n)*p) : -90, la1 = local ? Math.min(90, (Math.ceil(lat0/p) + n)*p) : 90;
  const lo0 = local ? (Math.floor(lon0/p) - n)*p : -180, lo1 = local ? (Math.ceil(lon0/p) + n)*p : 180;
  const seg = Math.min(p/4, 2);                                       // les lignes suivent la courbure
  const trait = (f, a, b) => { for(let t=a;t<b-1e-9;t+=seg){ f(t).toArray(pos, pos.length); f(Math.min(b, t + seg)).toArray(pos, pos.length); } };
  for(let lo=lo0;lo<=lo1+1e-9;lo+=p) trait(la => vecGeo(la, lo, R, v), Math.max(-89.9, la0), Math.min(89.9, la1));   // méridiens
  for(let la=la0;la<=la1+1e-9;la+=p) if(Math.abs(la) < 89.9) trait(lo => vecGeo(la, lo, R, v), lo0, lo1);              // parallèles
  const g = GEO.grille.geometry;
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
}

// Nom le plus proche d'un point : la ville à moins de 400 km (« Rome, 120 km »), sinon le pays ou la mer la plus proche.
function lieuProche(lat, lon){
  const dist = (la, lo) => Math.acos(Math.min(1, Math.sin(lat*DEG)*Math.sin(la*DEG) + Math.cos(lat*DEG)*Math.cos(la*DEG)*Math.cos((lon - lo)*DEG)))*6371;
  const proche = l => l.reduce((b, [n, la, lo]) => { const d = dist(la, lo); return !b || d < b.d ? {n, d} : b; }, null);
  const v = proche(GEO_VILLES);
  return v.d < 400 ? v.n + ', ' + Math.round(v.d) + ' km' : proche([...GEO_PAYS, ...GEO_MERS]).n;
}

const fmtDeg = (x, d, pos, neg) => Math.abs(x).toFixed(d).replace('.', ',') + '° ' + (x >= 0 ? pos : neg);
const fmtLatLon = (g, d) => fmtDeg(g.lat, d, 'N', 'S') + ' · ' + fmtDeg(g.lon, d, 'E', 'O');

const _gc = new THREE.Vector3(), _gk = new THREE.Vector3(), _gw = new THREE.Vector3(), _gn = new THREE.Vector3(), _gv = new THREE.Vector3();
function majGeo(){
  const on = ETAT.montrer.geo;
  $('geoEtiquettes').hidden = !on; $('geoInfo').hidden = !on; GEO.grille.visible = on;
  if(!on) return;
  const cam = ETAT.vue === 'iss' ? camIss : camExt;
  // étendue au sol (degrés, demi-largeur) : distance au sol visé × tan(demi-champ), ou altitude si le centre est le ciel
  const c = pointTerre(cam, 0, 0), centre = TERRE.globe.getWorldPosition(_gc), camW = cam.getWorldPosition(_gk);
  const dist = c ? c.d : Math.max(0.01, camW.distanceTo(centre) - CFG.R);
  const etendue = Math.min(90, Math.atan(dist*Math.tan(cam.fov*DEG/2)*Math.max(1, cam.aspect)/CFG.R)/DEG);
  // quadrillage
  const p = PAS_GEO.find(x => x <= etendue/2.5) || PAS_GEO[PAS_GEO.length - 1];
  const ref = c || {lat:0, lon:0}, cle = p < 5 ? p + ':' + Math.round(ref.lat/(3*p)) + ':' + Math.round(ref.lon/(3*p)) : String(p);
  if(cle !== GEO.cle){ GEO.cle = cle; construireGrille(p, ref.lat, ref.lon); }
  // coordonnées
  const d = p >= 5 ? 1 : p >= 0.5 ? 2 : p >= 0.05 ? 3 : 4, larg = 2*etendue*DEG*6371;
  const q = GEO.pointeur && pointTerre(cam, GEO.pointeur.x, GEO.pointeur.y);
  $('geoInfo').textContent = (c ? 'Centre : ' + fmtLatLon(c, d) : 'Centre : ciel') + (q ? '   ·   Pointeur : ' + fmtLatLon(q, d) : '')
    + '   ·   largeur au sol ≈ ' + (larg >= 10 ? Math.round(larg).toLocaleString('fr') : larg.toFixed(1).replace('.', ',')) + ' km';
  // étiquettes : visibles selon l'étendue, côté visible de la Terre, dans l'écran, sans chevauchement
  const montre = e => e.type === 'mer' ? etendue >= 12 : e.prio === 0 ? true : e.prio === 2 ? etendue <= 50 : e.prio === 3 ? etendue <= 12 : etendue <= 15;
  const pris = [], W = innerWidth, H = innerHeight;
  for(const e of GEO.etiq){
    let vu = false;
    if(montre(e)){
      _gw.copy(e.v).applyMatrix4(TERRE.globe.matrixWorld);
      _gn.copy(_gw).sub(centre);
      if(_gn.dot(_gv.copy(camW).sub(_gw)) > 0){                     // face à la caméra
        _gw.project(cam);
        const x = (_gw.x + 1)/2*W, y = (1 - _gw.y)/2*H;
        if(_gw.z < 1 && x > -50 && x < W + 50 && y > -20 && y < H + 20){
          if(!e.w){ e.d.hidden = false; e.w = e.d.offsetWidth; e.h = e.d.offsetHeight; e.d.hidden = !e.vu; }   // taille mesurée une fois
          const mer = e.type === 'mer', bx = mer ? x - e.w/2 : x - 4, by = mer ? y - e.h/2 : y - e.h/2;
          if(!pris.some(b => bx < b[2] && bx + e.w > b[0] && by < b[3] && by + e.h > b[1])){
            pris.push([bx - 3, by - 2, bx + e.w + 3, by + e.h + 2]);
            e.d.style.transform = 'translate(' + Math.round(bx) + 'px,' + Math.round(by) + 'px)';
            vu = true;
          }
        }
      }
    }
    if(vu !== e.vu){ e.d.hidden = !vu; e.vu = vu; }
  }
}
