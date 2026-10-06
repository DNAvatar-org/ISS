// File: js/joystick-fond.js
// Desc: Fond du joystick : la Terre réellement sous l'ISS (jour/nuit), en projection azimutale centrée sur le nadir.
// Version 1.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Le disque du joystick = toutes les directions de visée depuis l'ISS : centre = nadir (la Terre), bord = zénith,
   distance au centre = angle depuis le nadir ρ (équidistant, 0..180°), azimut ψ = cap, haut du disque = sens du vol,
   droite = −Y. La Terre occupe le disque central de rayon ρ = asin(R/r) ≈ 69,7° (39 % du rayon). Chaque pixel de ce
   disque est le sol vu dans cette direction : on lance le rayon, on lit la carte jour ou nuit selon l'éclairement. */
const JFOND = {R:96, cv:document.createElement('canvas'), jour:null, nuit:null, derniere:-1e9, periode:350};
JFOND.cv.width = JFOND.cv.height = 2*JFOND.R;
JFOND.cx = JFOND.cv.getContext('2d');
const JF_W = 1024, JF_H = 512;

// Pixels des deux cartes (data: URI, donc lisibles même en file://).
function preparerFond(){
  const lire = img => {
    const c = document.createElement('canvas'); c.width = JF_W; c.height = JF_H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, JF_W, JF_H);
    return x.getImageData(0, 0, JF_W, JF_H).data;
  };
  JFOND.jour = lire(TEX.jour.image); JFOND.nuit = lire(TEX.nuit.image);
}

const _jq = new THREE.Matrix4(), _jg = new THREE.Matrix4();
const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };

function rafraichirFond(ms){
  if(ms - JFOND.derniere < JFOND.periode) return;
  JFOND.derniere = ms;
  const R = JFOND.R, N = 2*R;
  const rhoE = Math.asin(CFG.R/OBS.R), rE = R*rhoE/Math.PI;
  const img = JFOND.cx.createImageData(N, N), out = img.data;
  _jq.makeRotationFromQuaternion(OBS.groupe.quaternion); const q = _jq.elements;            // repère ISS → monde
  _jg.copy(TERRE.globe.matrixWorld).invert(); const g = _jg.elements;                        // monde → repère du globe
  const p = OBS.groupe.position, S = ETAT.S, p2 = p.lengthSq() - CFG.R*CFG.R;
  for(let j=0;j<N;j++) for(let i=0;i<N;i++){
    const dx = i + 0.5 - R, dy = j + 0.5 - R, r = Math.hypot(dx, dy);
    if(r > rE) continue;
    const rho = r/R*Math.PI, psi = Math.atan2(-dx, -dy);
    const lx = -Math.cos(rho), ly = Math.sin(rho)*Math.sin(psi), lz = -Math.sin(rho)*Math.cos(psi);   // direction, repère ISS
    const wx = q[0]*lx + q[4]*ly + q[8]*lz, wy = q[1]*lx + q[5]*ly + q[9]*lz, wz = q[2]*lx + q[6]*ly + q[10]*lz;
    const b = p.x*wx + p.y*wy + p.z*wz, disc = b*b - p2;
    if(disc <= 0) continue;
    const s = -b - Math.sqrt(disc);
    const Px = p.x + s*wx, Py = p.y + s*wy, Pz = p.z + s*wz;                                          // point du sol
    const e = (Px*S.x + Py*S.y + Pz*S.z)/CFG.R;                                                       // éclairement
    const gx = g[0]*Px + g[4]*Py + g[8]*Pz, gy = g[1]*Px + g[5]*Py + g[9]*Pz, gz = g[2]*Px + g[6]*Py + g[10]*Pz;
    let ph = Math.atan2(gz, -gx); if(ph < 0) ph += 2*Math.PI;
    const u = (ph/(2*Math.PI))*JF_W|0, v = (0.5 - Math.asin(gy/CFG.R)/Math.PI)*JF_H|0;
    const k = (Math.min(JF_H-1, Math.max(0, v))*JF_W + Math.min(JF_W-1, u))*4;
    const jour = lisse(-0.10, 0.18, e), lum = 0.10 + 1.30*Math.pow(Math.max(e, 0), 0.7);   // même exposition que la Terre 3D
    const o = (j*N + i)*4;
    out[o]   = (JFOND.nuit[k]  *1.5*(1-jour) + JFOND.jour[k]  *lum*jour);
    out[o+1] = (JFOND.nuit[k+1]*1.5*(1-jour) + JFOND.jour[k+1]*lum*jour);
    out[o+2] = (JFOND.nuit[k+2]*1.5*(1-jour) + JFOND.jour[k+2]*lum*jour);
    out[o+3] = 255;
  }
  JFOND.cx.putImageData(img, 0, 0);
}
