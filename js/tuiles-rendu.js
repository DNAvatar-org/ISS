// File: js/tuiles-rendu.js
// Desc: Un carreau = une calotte de sphère (maillage lon/lat) texturée par une tuile (GIBS jour+nuit, ou Sentinel-2 jour).
// Version 2.0.0
// Date: [October 05, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Grilles EPSG:4326, origine en haut à gauche (−180°, 90°), lignes vers le sud, colonnes vers l'est :
   – GIBS : tuile de 512 px couvrant 288°/2^z ;  – EOX Sentinel-2 : tuile de 256 px couvrant 180°/2^z.
   Le maillage reprend EXACTEMENT le paramétrage de SphereGeometry (φ = (lon+180)°, θ = 90°−lat),
   donc les carreaux se superposent sans décalage à la Terre de base. */
const SOURCES = {
  gibs:{span:z => 288/Math.pow(2, z), px:512},
  eox: {span:z => 180/Math.pow(2, z), px:256}
};

function geometrieCarreau(src, z, row, col, rayon){
  const s = SOURCES[src].span(z), n = 10;
  const lon0 = -180 + col*s, lat1 = 90 - row*s;
  const a = Math.max(lon0, -180), b = Math.min(lon0 + s, 180);        // bornes utiles en longitude
  const c = Math.max(lat1 - s, -90), d = Math.min(lat1, 90);          // bornes utiles en latitude
  const pos = [], nor = [], uv = [], idx = [];
  for(let j=0;j<=n;j++) for(let i=0;i<=n;i++){
    const lon = a + (b-a)*i/n, lat = d - (d-c)*j/n;
    const ph = (lon+180)*DEG, th = (90-lat)*DEG;
    const x = -Math.cos(ph)*Math.sin(th), y = Math.cos(th), zz = Math.sin(ph)*Math.sin(th);
    pos.push(x*rayon, y*rayon, zz*rayon); nor.push(x, y, zz);
    uv.push((lon - lon0)/s, 1 - (lat1 - lat)/s);
  }
  for(let j=0;j<n;j++) for(let i=0;i<n;i++){
    const A = j*(n+1)+i+1, B = j*(n+1)+i, C = (j+1)*(n+1)+i, D = (j+1)*(n+1)+i+1;
    idx.push(A, B, D, B, C, D);                                       // même sens que SphereGeometry
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* Plus le niveau est fin, plus le carreau passe devant (polygonOffset + léger rayon en plus ; les niveaux
   Sentinel-2, 8 à 14, ne montent que de 60 m chacun pour ne pas décoller de la Terre vue de l'ISS).
   Sentinel-2 n'a que le jour : ses carreaux s'effacent côté nuit (FIN), les lumières GIBS dessous restent visibles. */
function carreauMesh(src, z, row, col, texJour, texNuit){
  const mat = new THREE.ShaderMaterial({
    vertexShader:GLSL_TERRE_VS, fragmentShader:GLSL_TERRE_FS,
    defines: src === 'eox' ? {FIN:''} : {},
    uniforms:{uJour:{value:texJour}, uNuit:{value:texNuit}, uSun:TERRE.uSun, uLune:TERRE.uLune, uRL:TERRE.uRL, uRS:TERRE.uRS},
    polygonOffset:true, polygonOffsetFactor:-z, polygonOffsetUnits:-z});
  const rayon = CFG.R + 0.003*Math.min(z, 7) + 0.0006*Math.max(0, z - 7);
  const m = new THREE.Mesh(geometrieCarreau(src, z, row, col, rayon), mat);
  m.frustumCulled = false;
  return m;
}
