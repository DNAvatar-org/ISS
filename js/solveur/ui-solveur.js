// File: js/solveur/ui-solveur.js
// Desc: « Check Photo » : une photo prise depuis l'ISS (bouton ou glisser-déposer) → visée, focale, heure ; appliquées à la vue.
// Version 1.8.0
// Date: [October 29, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Tout se fait dans le navigateur, sans serveur ni IA : limbe (limbe.js) → Terre masquée → étoiles (detection.js) →
   catalogue (astrometrie.js) → direction, rotation, focale. La date vient des EXIF s'il y en a (originaux Flickr,
   appareil), sinon on part de la date affichée (le limbe affine l'heure à ±40 min près, instant.js). Dès que les étoiles
   sont reconnues, c'est appliqué : l'ISS à cet instant (pause), la caméra braquée, la focale, les paramètres dans l'URL.
   Sans date, la recherche des dates possibles (recherche-dates.js) part du nom du fichier (photo NASA : l'expédition).
   Tout s'affiche dans l'encart Photo (encart.js) ; corriger la date ou l'heure (saisie ou ◀ ▶ 1 s) recommence. */
// nom : du fichier ; verte : le limbe posé sur la ligne verte (ligne-verte.js) ; focalePosee : la focale de la photo a été donnée à la vue
const CHK = {res:null, img:null, data:null, limbe:null, verte:null, exif:null, cv:null, image:null, nom:'', echelle:1, lignes:[], focalePosee:false, recherche:null};
const LARGEUR_MAX = 2400;                                               // au-delà, l'image est réduite (vitesse)

function creerSolveur(){
  $('bCheck').onclick = ouvrirCatalogue;                               // catalogue ou ordinateur (catalogue.js)
  creerCatalogue();
  creerTraceLimbe();                                                   // limbe vérifié ou tracé à la main
  $('fPhoto').onchange = e => { if(e.target.files[0]){ ecrirePhotoURL(null); analyserPhoto(e.target.files[0]); } e.target.value = ''; };
  addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('depot'); });
  addEventListener('dragleave', e => { if(!e.relatedTarget) document.body.classList.remove('depot'); });
  addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('depot');
    const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
    if(f){ ecrirePhotoURL(null); analyserPhoto(f); }
  });
  $('solMoins').onclick = () => decalerHeure(-1);
  $('solPlus').onclick = () => decalerHeure(+1);
  $('solDate').onchange = $('solHeure').onchange = () => appliquerSolution(false);   // saisie validée (Entrée / sortie du champ)
  $('solChercher').onclick = chercherDates;
  $('solAn').onkeydown = e => { if(e.key === 'Enter') chercherDates(); };         // (pas l'événement : il passerait pour « prudent »)
}

const p2 = n => String(n).padStart(2, '0');
const fr = (x, n) => x.toFixed(n).replace('.', ',');                    // affichage : virgule décimale (l'URL garde le point)
const texteDate = unix => { const d = new Date(unix*1000); return p2(d.getUTCDate()) + '.' + p2(d.getUTCMonth() + 1) + '.' + p2(d.getUTCFullYear() % 100); };
const texteHeure = unix => { const d = new Date(unix*1000); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()); };
function lignesSolveur(l){
  const t = $('solTxt'); t.textContent = '';
  for(const s of l){ const p = document.createElement('p'); p.textContent = s; t.appendChild(p); }
}

// laisser le navigateur peindre (photo, message) avant un calcul qui bloque ; onglet caché : pas de trame, la minuterie suffit
const peindre = () => new Promise(r => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 100); });

// La photo s'affiche dès qu'elle est lue ; puis limbe et points (rapide, dessinés) ; puis la reconnaissance (jusqu'à 10 s).
// opt (catalogue.js) : credit (affiché sous la photo), limbe ([[x, y], …] en pixels du fichier, tracé d'avance).
async function analyserPhoto(fichier, opt = {}){
  CHK.recherche = null;                                                 // une recherche de dates en cours s'arrête
  $('encartPhoto').hidden = false; $('solChamps').hidden = true; $('solDates').hidden = true; $('solListe').textContent = '';
  lignesSolveur(['Lecture de « ' + fichier.name + ' »…']);
  const buf = await fichier.arrayBuffer();
  const exif = lireExif(buf), bmp = await createImageBitmap(new Blob([buf]));
  const k = Math.min(1, LARGEUR_MAX/bmp.width), W = Math.round(bmp.width*k), H = Math.round(bmp.height*k);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0, W, H);
  afficherPhoto(cv);
  $('encCredit').textContent = opt.credit ? 'Photo © ' + opt.credit : ''; $('encCredit').hidden = !opt.credit;
  lignesSolveur(['Analyse de « ' + fichier.name + ' » : limbe, étoiles…']);
  await peindre();
  const img = cx.getImageData(0, 0, W, H);
  Object.assign(CHK, {cv, image:img, exif, nom:fichier.name, echelle:k});
  // ?limbe= sert à UNE photo : la première chargée après l'ouverture de la page (ou celle pour qui il a été tracé)
  if(LIMBE_URL.pts && LIMBE_URL.utilise){ LIMBE_URL.pts = null; LIMBE_URL.utilise = false; ecrireLimbeURL(null); }
  const L = opt.limbe ? limbeDePointsOrigine(opt.limbe, bmp.width, bmp.height, 'catalogue')
          : LIMBE_URL.pts ? limbeDePointsOrigine(LIMBE_URL.pts, bmp.width, bmp.height, 'url') : null;
  if(LIMBE_URL.pts) LIMBE_URL.utilise = true;
  await resoudrePhoto(L || detecterLimbe(img));                        // tracé d'avance (catalogue, ?limbe=), sinon automatique
}

/* Étoiles et suite, pour un limbe donné : celui de la détection automatique, ou celui tracé à la main (limbe-manuel.js,
   qui relance ici). Une question sous la photo demande si le trait bleu suit bien le bord de l'atmosphère. */
async function resoudrePhoto(limbe){
  const {cv, image:img, exif} = CHK, W = cv.width, H = cv.height;
  CHK.recherche = null;                                                 // une recherche de dates en cours s'arrête
  $('solChamps').hidden = true; $('solDates').hidden = true; $('solListe').textContent = ''; $('limbeQ').hidden = true;
  const det = horsTerre(detecterEtoiles(img), limbe, H/100);
  marquerPhoto(cv, det, null, limbe);
  lignesSolveur([(limbe ? (limbe.source === 'url' ? 'Limbe de l\'URL (trait bleu), ' : limbe.manuel ? 'Limbe tracé (trait bleu), ' : 'Limbe vu (trait bleu), ') : 'Pas de limbe, ') + det.length + ' points dans le ciel : reconnaissance des étoiles (jusqu\'à 10 s)…']);
  await peindre();
  const Fl = limbe ? focaleParLimbe(limbe, W, H) : null;               // la courbure du limbe borne la focale
  const res = resoudreCiel({W, H}, det, Fl, limbe);
  const verte = res && limbe ? ligneVerte(img.data, W, H, limbe, res.F) : null;   // la focale donne l'échelle en km
  Object.assign(CHK, {res, img:{W, H}, data:img.data, limbe, verte, focalePosee:false});
  marquerPhoto(cv, det, res, limbe, verte);
  demanderLimbe(limbe);
  if(!res){
    lignesSolveur(['Étoiles non reconnues (' + det.length + ' points, en gris).',
                   'Il faut une photo de nuit, nette, avec au moins une dizaine d\'étoiles (le bruit coloré d\'une caméra vidéo ne compte pas).']);
    return;
  }
  const ra = res.centre.ra/15, x = expeditionDuNom(CHK.nom);
  CHK.lignes = [
    '✓ ' + res.appariees.length + ' étoiles reconnues (± ' + fr(res.rms, 1) + ' px)' + (res.miroir ? ', image en miroir' : ''),
    'RA ' + Math.floor(ra) + ' h ' + fr((ra % 1)*60, 1) + ' min, Dec ' + fr(res.centre.dec, 2) + '° · ' + fr(res.F*36/W, 1) + ' mm' + (limbe ? (limbe.source === 'url' ? ' · limbe de l\'URL' : limbe.manuel ? ' · limbe tracé' : ' · limbe vu') : '')
      + (verte ? ', ligne verte (tirets roses)' : ''),
    exif.date ? 'EXIF : ' + texteDate(exif.date) + ' ' + texteHeure(exif.date) + ' UT' + (exif.focale ? ', ' + exif.focale + ' mm' : '')
              : limbe ? 'Pas de date dans l\'image : les étoiles ne la donnent pas. Recherche des instants où l\'ISS voyait ce limbe sous ces étoiles, '
                        + (x ? 'dans l\'expédition ' + x.n + ' (nom NASA ; « Année » pour une autre période).' : 'de 2000 à aujourd\'hui (« Année » pour restreindre).')
                      : 'Pas de date dans l\'image ni de limbe : indique le jour et l\'heure UT.'
  ];
  $('solChamps').hidden = false;
  if(exif.date){
    $('solDate').value = texteDate(exif.date); $('solHeure').value = texteHeure(exif.date);
    appliquerSolution(false);
  }else{
    $('solDate').value = ''; $('solHeure').value = '';                // pas la date du jour : la photo est d'une autre époque
    $('solDates').hidden = !limbe;
    lignesSolveur(CHK.lignes);
    if(limbe) chercherDates();                                         // l'expédition du nom NASA, sinon toutes les années, sans attendre un clic
  }
}

// ±delta secondes sur l'instant saisi (la date suit au passage de minuit), puis on recommence
function decalerHeure(delta){
  const jour = lireDateURL($('solDate').value), frac = lireHeureURL($('solHeure').value);
  if(jour === null || frac === null){ lignesSolveur([...CHK.lignes, 'Date ou heure illisible (JJ.MM.AA, HH:MM:SS).']); return; }
  const unix = Math.round(unixDeJour(jour + frac)) + delta;
  $('solDate').value = texteDate(unix); $('solHeure').value = texteHeure(unix);
  appliquerSolution(false);
}

// prudent : n'appliquer que si le limbe confirme l'instant (date non sûre : celle affichée par défaut, sans EXIF)
function appliquerSolution(prudent = false){
  const {res, img, limbe, verte, exif} = CHK;
  const jour = lireDateURL($('solDate').value), frac = lireHeureURL($('solHeure').value);
  if(jour === null || frac === null){ lignesSolveur([...CHK.lignes, 'Date ou heure illisible (JJ.MM.AA, HH:MM:SS).']); return; }
  let unix = Math.round(unixDeJour(jour + frac));
  const l = [];
  const h = limbe ? heureParLimbe(res, img, verte || limbe, unix, 2400) : null, tl = limbe ? toleranceLimbe(res, img, limbe) : null;
  const hv = h && verte ? heureParLigneVerte(res, img, verte, h.unix, tl) : null;
  // limbe concordant : points bien sur un même cône autour du nadir ; avec une ligne verte, elle vers 92 km (son heure
  // est la plus juste, instant.js), sinon le bord vu entre le sol et le haut de l'airglow.
  // l'heure saisie est appliquée telle quelle ; celle du limbe est proposée (bouton, toujours là quand il y a un limbe :
  // grisé si on y est déjà ou s'il ne colle pas — la mise en page ne saute pas)
  let hLimbe = null;
  const ecart = t => (t >= unix ? '+' : '') + (t - unix) + ' s';
  if(hv && hv.ok){
    l.push('Heure par la ligne verte : ' + texteHeure(hv.unix) + ' UT (' + ecart(hv.unix) + ' ; ligne à ' + hv.alt.toFixed(0) + ' km, attendue vers ' + VERTE.alt + ')');
    hLimbe = hv.unix;
  }else if(h && h.sdDeg < tl.sd && h.alt > -20 - tl.alt && h.alt < 150 + tl.alt){   // tolérance : grand-angle (instant.js)
    l.push('Heure par le limbe : ' + texteHeure(h.unix) + ' UT (' + ecart(h.unix) + ' ; ' + (verte ? 'ligne verte à ' + h.alt.toFixed(0) + ' km, loin des ' + VERTE.alt + ' attendus' : 'bord à ' + h.alt.toFixed(0) + ' km') + ')');
    hLimbe = h.unix;
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
  // la focale de la photo au premier calage seulement : ensuite (± 1 s, date corrigée…) celle que l'utilisateur a choisie reste
  if(!CHK.focalePosee){ VUE_ISS.fov = Math.max(0.5, Math.min(FOV_MAX, fovDepuisFocale(focale))); CHK.focalePosee = true; }
  const bf = new THREE.Vector3(), bu = new THREE.Vector3(), br = new THREE.Vector3(), u = loc(up);
  baseVisee(cap, site, bf, bu, br);
  const roulis = Math.atan2(u.dot(br), u.dot(bu))/DEG;
  majBoutons(); majDateUI();

  majURL(0, true);                                                     // l'URL suit la vue (url.js)
  l.push('Appliqué : ' + texteDate(unix) + ' ' + texteHeure(unix) + ' UT, cap ' + fr(cap/DEG, 1) + '°, site ' + fr(site/DEG, 1) + '°, ' + fr(focale, 1) + ' mm'
         + (Math.abs(roulis) > 2 ? ' (roulis de ' + roulis.toFixed(0) + '° non reproduit)' : '') + ' — dans l\'URL.');
  lignesSolveur([...CHK.lignes.filter(x => !x.startsWith('Pas de date')), ...l]);   // appliqué : l'invite à dater est caduque
  if(limbe){
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = 'Prendre l\'heure du limbe (' + (hLimbe ? texteHeure(hLimbe) : '—') + ')';
    b.disabled = !hLimbe || hLimbe === unix;
    b.onclick = () => { $('solHeure').value = texteHeure(hLimbe); appliquerSolution(false); };
    $('solTxt').appendChild(b);
  }
  ENC.roulis = roulis;
  majCalque();
}
