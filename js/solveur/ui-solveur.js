// File: js/solveur/ui-solveur.js
// Desc: « Check Photo » : une photo prise depuis l'ISS (bouton ou glisser-déposer) → visée, focale, heure ; appliquées à la vue.
// Version 1.1.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Tout se fait dans le navigateur, sans serveur ni IA : limbe (limbe.js) → Terre masquée → étoiles (detection.js) →
   catalogue (astrometrie.js) → direction, rotation, focale. La date vient des EXIF s'il y en a (originaux Flickr,
   appareil), sinon on part de la date affichée (le limbe affine l'heure à ±40 min près, instant.js). Dès que les étoiles
   sont reconnues, c'est appliqué : l'ISS à cet instant (pause), la caméra braquée, la focale, les paramètres dans l'URL.
   Tout s'affiche dans l'encart Photo (encart.js) ; corriger la date ou l'heure puis « Appliquer » recommence. */
const CHK = {res:null, img:null, limbe:null, exif:null, lignes:[]};
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
  $('encartPhoto').hidden = false; $('solChamps').hidden = true;
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
  const Fl = limbe ? focaleParLimbe(limbe, W, H) : null;               // la courbure du limbe borne la focale
  const res = resoudreCiel({W, H}, det, Fl);
  Object.assign(CHK, {res, img:{W, H}, limbe, exif});
  afficherEncart(cv, URL.createObjectURL(fichier), det, res, limbe);
  if(!res){
    lignesSolveur(['Étoiles non reconnues (' + det.length + ' points, en gris).',
                   'Il faut une photo de nuit, nette, avec au moins une dizaine d\'étoiles (le bruit coloré d\'une caméra vidéo ne compte pas).']);
    return;
  }
  const ra = res.centre.ra/15;
  CHK.lignes = [
    '✓ ' + res.appariees.length + ' étoiles reconnues (± ' + fr(res.rms, 1) + ' px)' + (res.miroir ? ', image en miroir' : ''),
    'RA ' + Math.floor(ra) + ' h ' + fr((ra % 1)*60, 1) + ' min, Dec ' + fr(res.centre.dec, 2) + '° · ' + fr(res.F*36/W, 1) + ' mm' + (limbe ? ' · limbe vu' : ''),
    exif.date ? 'EXIF : ' + texteDate(exif.date) + ' ' + texteHeure(exif.date) + ' UT' + (exif.focale ? ', ' + exif.focale + ' mm' : '')
              : 'Pas de date dans l\'image : corrige le jour (l\'heure peut être à ±40 min), puis Appliquer.'
  ];
  const u = exif.date || unixDeJour(jourDate());
  $('solDate').value = texteDate(u); $('solHeure').value = texteHeure(u);
  $('solChamps').hidden = false;
  appliquerSolution(!exif.date);                                       // sans EXIF : seulement si le limbe confirme l'heure
}

// prudent : n'appliquer que si le limbe confirme l'instant (date non sûre : celle affichée par défaut, sans EXIF)
function appliquerSolution(prudent = false){
  const {res, img, limbe, exif} = CHK;
  const jour = lireDateURL($('solDate').value), frac = lireHeureURL($('solHeure').value);
  if(jour === null || frac === null){ lignesSolveur([...CHK.lignes, 'Date ou heure illisible (JJ.MM.AA, HH:MM:SS).']); return; }
  let unix = unixDeJour(jour + frac);
  const l = [];
  const h = limbe ? heureParLimbe(res, img, limbe, unix, 2400) : null;
  // limbe concordant : points bien sur un même cône autour du nadir, bord vu entre le sol et le haut de l'airglow
  if(h && h.sdDeg < 0.08 && h.alt > -20 && h.alt < 150){
    l.push('Heure par le limbe : ' + texteHeure(h.unix) + ' UT (' + (h.ecart >= 0 ? '+' : '') + h.ecart + ' s ; bord à ' + h.alt.toFixed(0) + ' km)');
    if(!exif.date) unix = h.unix;                                       // sans EXIF, l'heure saisie n'était qu'une estimation
  }else{
    if(limbe) l.push('Le limbe ne colle pas à l\'ISS à ±40 min de cette heure : vérifie la date.');
    if(prudent){ lignesSolveur([...CHK.lignes, ...l]); return; }     // date inconnue : on attend la bonne
  }

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
  l.push('Appliqué : ' + texteDate(unix) + ' ' + texteHeure(unix) + ' UT, cap ' + fr(cap/DEG, 1) + '°, site ' + fr(site/DEG, 1) + '°, ' + fr(focale, 1) + ' mm'
         + (Math.abs(roulis) > 2 ? ' (roulis de ' + roulis.toFixed(0) + '° non reproduit)' : '') + ' — dans l\'URL. Clic sur la photo : la superposer.');
  lignesSolveur([...CHK.lignes.filter(x => !x.startsWith('Pas de date')), ...l]);   // appliqué : l'invite à dater est caduque
  ENC.roulis = roulis;
  majCalque();
}
