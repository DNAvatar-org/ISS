// File: js/solveur/ui-solveur.js
// Desc: « Check Photo » : une photo prise depuis l'ISS (bouton ou glisser-déposer) → visée, focale, heure ; appliquées à la vue.
// Version 1.0.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Tout se fait dans le navigateur, sans serveur ni IA : limbe (limbe.js) → Terre masquée → étoiles (detection.js) →
   catalogue (astrometrie.js) → direction, rotation, focale. La date vient des EXIF s'il y en a (originaux Flickr,
   appareil), sinon on la saisit (l'heure peut être approximative : le limbe l'affine, instant.js). « Appliquer » place
   l'ISS à cet instant (pause), braque la caméra, règle la focale et met les paramètres dans l'URL. */
const CHK = {res:null, img:null, limbe:null, exif:null};
const LARGEUR_MAX = 2400;                                               // au-delà, l'image est réduite (vitesse)

function creerSolveur(){
  $('bCheck').onclick = () => $('fPhoto').click();
  $('fPhoto').onchange = e => { if(e.target.files[0]) analyserPhoto(e.target.files[0]); e.target.value = ''; };
  addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('depot'); });
  addEventListener('dragleave', e => { if(!e.relatedTarget) document.body.classList.remove('depot'); });
  addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('depot');
    const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
    if(f) analyserPhoto(f);
  });
  $('solFermer').onclick = () => { $('solveur').hidden = true; };
  $('solAppliquer').onclick = appliquerSolution;
}

const p2 = n => String(n).padStart(2, '0');
const fr = (x, n) => x.toFixed(n).replace('.', ',');                    // affichage : virgule décimale (l'URL garde le point)
const texteDate = unix => { const d = new Date(unix*1000); return p2(d.getUTCDate()) + '.' + p2(d.getUTCMonth() + 1) + '.' + p2(d.getUTCFullYear() % 100); };
const texteHeure = unix => { const d = new Date(unix*1000); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()); };
function lignesSolveur(l){
  const t = $('solTxt'); t.textContent = '';
  for(const s of l){ const p = document.createElement('p'); p.textContent = s; t.appendChild(p); }
}

async function analyserPhoto(fichier){
  $('solveur').hidden = false; $('solChamps').hidden = true; $('solAppliquer').hidden = true;
  lignesSolveur(['Analyse de « ' + fichier.name + ' »…']);
  const buf = await fichier.arrayBuffer();
  const exif = lireExif(buf), bmp = await createImageBitmap(new Blob([buf]));
  const k = Math.min(1, LARGEUR_MAX/bmp.width), W = Math.round(bmp.width*k), H = Math.round(bmp.height*k);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0, W, H);
  const img = cx.getImageData(0, 0, W, H);
  await new Promise(r => setTimeout(r, 30));                            // laisser s'afficher « Analyse… »
  const limbe = detecterLimbe(img);
  const det = horsTerre(detecterEtoiles(img), limbe, H/100);
  const res = resoudreCiel({W, H}, det);
  Object.assign(CHK, {res, img:{W, H}, limbe, exif});
  afficherEncart(cv, det, res, limbe);
  if(!res){
    lignesSolveur(['Étoiles non reconnues (' + det.length + ' points détectés hors de la Terre).',
                   'Il faut une photo de nuit, nette, avec au moins une dizaine d\'étoiles visibles (le bruit coloré',
                   'd\'une caméra vidéo à fort gain ne compte pas). Points détectés : en gris dans l\'encart Photo.']);
    return;
  }
  const ra = res.centre.ra/15, l = [
    '✓ ' + res.appariees.length + ' étoiles reconnues (écart moyen ' + fr(res.rms, 1) + ' px)' + (res.miroir ? ' — image retournée (miroir)' : ''),
    'Centre : RA ' + Math.floor(ra) + ' h ' + fr((ra % 1)*60, 1) + ' min, Dec ' + fr(res.centre.dec, 2) + '° · focale ' + fr(res.F*36/W, 1) + ' mm (équiv. 24×36)',
    limbe ? 'Limbe de la Terre détecté : elle est masquée pour la recherche des étoiles.' : 'Pas de limbe détecté : toute l\'image a servi.'
  ];
  if(exif.date) l.push('EXIF : ' + texteDate(exif.date) + ' ' + texteHeure(exif.date) + ' UT' + (exif.focale ? ', ' + exif.focale + ' mm' : ''));
  else l.push('Pas de date dans l\'image : indique le jour et l\'heure UT (approximative, à ±40 min : le limbe l\'affine).');
  lignesSolveur(l);
  const u = exif.date || unixDeJour(jourDate());
  $('solDate').value = texteDate(u); $('solHeure').value = texteHeure(u);
  $('solChamps').hidden = false; $('solAppliquer').hidden = false;
}

function appliquerSolution(){
  const {res, img, limbe, exif} = CHK;
  const jour = lireDateURL($('solDate').value), frac = lireHeureURL($('solHeure').value);
  if(jour === null || frac === null){ lignesSolveur(['Date ou heure illisible.', 'Formats : ' + FORMAT_DATE + ' ; ' + FORMAT_HEURE + '.']); return; }
  let unix = unixDeJour(jour + frac);
  const l = [];
  const h = limbe ? heureParLimbe(res, img, limbe, unix, 2400) : null;
  if(h && h.sdDeg < 0.15){
    l.push('Heure d\'après le limbe : ' + texteHeure(h.unix) + ' UT (' + (h.ecart >= 0 ? '+' : '') + h.ecart + ' s ; bord vu à ' + h.alt.toFixed(0) + ' km d\'altitude)');
    if(!exif.date) unix = h.unix;                                       // sans EXIF, l'heure saisie n'était qu'une estimation
  }else if(limbe) l.push('Le limbe ne correspond pas à l\'ISS à ±40 min de cette heure : vérifier la date.');

  // l'ISS à cet instant, en pause ; puis la visée dans son repère
  activerSat('iss');
  ETAT.date0 = (unix - unixDeJour(0))/86400 - ETAT.t/86400; ETAT.pause = true; ETAT.vue = 'iss';
  majSoleilDate(); majScene();
  const fwd = res.M[2].map(x => -x), up = res.M[1], P = precession(unix);
  const loc = v => { const w = new THREE.Vector3(); ETAT.vers(mulMat(P, v), w); return localDe(w.normalize(), new THREE.Vector3()); };
  const f = loc(fwd), cap = capDe(f), site = siteDe(f);
  viser(cap, site);
  const focale = res.F*36/img.W;
  VUE_ISS.fov = Math.max(0.5, Math.min(FOV_MAX, fovDepuisFocale(focale)));
  const bf = new THREE.Vector3(), bu = new THREE.Vector3(), br = new THREE.Vector3(), u = loc(up);
  baseVisee(cap, site, bf, bu, br);
  const roulis = Math.atan2(u.dot(br), u.dot(bu))/DEG;
  majBoutons(); majDateUI();

  const q = new URLSearchParams(location.search);
  for(const k of ['vue', 'cap', 'site', 'focale', 'date', 'heure']) q.delete(k);
  q.set('date', texteDate(unix)); q.set('heure', texteHeure(unix));
  q.set('cap', (cap/DEG).toFixed(1)); q.set('site', (site/DEG).toFixed(1)); q.set('focale', focale.toFixed(1));
  history.replaceState(null, '', '?' + q.toString().replace(/%3A/g, ':'));       // heure lisible : 22:21:03
  l.push('Appliqué : ' + texteDate(unix) + ' ' + texteHeure(unix) + ' UT, cap ' + fr(cap/DEG, 1) + '°, site ' + fr(site/DEG, 1) + '°, focale ' + fr(focale, 1) + ' mm'
         + (Math.abs(roulis) > 2 ? ' (roulis de ' + roulis.toFixed(0) + '° non reproduit)' : '') + '. L\'URL de la page les contient.');
  lignesSolveur(l);
}
