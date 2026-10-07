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
   Tout s'affiche dans l'encart Photo (encart.js) ; corriger la date ou l'heure (saisie ou ◀ ▶ 1 s) recommence. */
const CHK = {res:null, img:null, data:null, limbe:null, exif:null, lignes:[]};
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
  $('solMoins').onclick = () => decalerHeure(-1);
  $('solPlus').onclick = () => decalerHeure(+1);
  $('solDate').onchange = $('solHeure').onchange = () => appliquerSolution(false);   // saisie validée (Entrée / sortie du champ)
  $('solChercher').onclick = chercherDates;
  $('solAn').oninput = e => e.target.classList.toggle('attente', !e.target.value);
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

async function analyserPhoto(fichier){
  $('encartPhoto').hidden = false; $('solChamps').hidden = true; $('solDates').hidden = true; $('solListe').textContent = '';
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
  const res = resoudreCiel({W, H}, det, Fl, limbe);
  Object.assign(CHK, {res, img:{W, H}, data:img.data, limbe, exif});
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
              : limbe ? 'Pas de date dans l\'image : les étoiles ne la donnent pas. « Dates possibles » cherche les instants où l\'ISS voyait ce limbe sous ces étoiles (une année, ou toutes).'
                      : 'Pas de date dans l\'image ni de limbe : indique le jour et l\'heure UT.'
  ];
  $('solChamps').hidden = false;
  if(exif.date){
    $('solDate').value = texteDate(exif.date); $('solHeure').value = texteHeure(exif.date);
    appliquerSolution(false);
  }else{
    $('solDate').value = ''; $('solHeure').value = '';                // pas la date du jour : la photo est d'une autre époque
    $('solDates').hidden = !limbe;
    $('solAn').classList.toggle('attente', !$('solAn').value);         // contour qui clignote : il faut une année
    lignesSolveur(CHK.lignes);
  }
}

// « Dates possibles » : instants de l'année (ou de 2000 à aujourd'hui) où l'ISS, de nuit, voyait ce limbe sous ces étoiles ;
// chacun noté sur les lumières des villes (villes.js), le mieux noté sélectionné (cadre rouge) et appliqué.
function chercherDates(){
  const v = $('solAn').value.trim(), an = /^\d{2}$/.test(v) ? 2000 + +v : /^\d{4}$/.test(v) ? +v : null;
  const debut = an ? Date.UTC(an, 0, 1)/1000 : Date.UTC(DATES.AN_MIN, 0, 1)/1000, fin = an ? Date.UTC(an + 1, 0, 1)/1000 : Date.now()/1000;
  const l = $('solListe'); l.textContent = 'Recherche…';
  setTimeout(async () => {                                              // laisser s'afficher « Recherche… »
    const c = datesPossibles(CHK.res, CHK.img, CHK.limbe, debut, fin);
    const pts = echantillonsTerre(CHK.data, CHK.img.W, CHK.img.H, CHK.limbe);
    l.textContent = '';
    const p = document.createElement('p');
    p.textContent = c.length ? c.length + ' instant' + (c.length > 1 ? 's' : '') + (an ? ' en ' + an : ' de ' + DATES.AN_MIN + ' à aujourd\'hui')
                               + ' ; note = accord des lumières de villes avec la carte VIIRS de la NASA. Le meilleur est appliqué ; clic sur un autre pour comparer (calque).'
                             : 'Aucun instant' + (an ? ' en ' + an : '') + ' : autre année ?';
    l.appendChild(p);
    const choisir = (m, b) => {
      l.querySelectorAll('button.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
      $('solDate').value = texteDate(m.unix); $('solHeure').value = texteHeure(m.unix); appliquerSolution(false);
    };
    const libelle = m => texteDate(m.unix) + ' ' + texteHeure(m.unix) + ' UT · villes ' + (m.note === undefined ? '…' : m.note === null ? '—' : Math.round(m.note*100) + ' %');
    const boutons = c.slice(0, 200).map(m => {
      const b = document.createElement('button');
      b.textContent = libelle(m); b.onclick = () => choisir(m, b);
      l.appendChild(b);
      return b;
    });
    // notes une par une (tuiles VIIRS chargées au fil de l'eau), puis le meilleur choisi
    for(let i=0;i<boutons.length;i++){ c[i].note = await noteVilles(CHK.res, CHK.img, pts, c[i].unix); boutons[i].textContent = libelle(c[i]); }
    let ib = -1;
    c.slice(0, 200).forEach((m, i) => { if(m.note !== null && (ib < 0 || m.note > c[ib].note)) ib = i; });
    if(ib >= 0){ choisir(c[ib], boutons[ib]); boutons[ib].scrollIntoView({block:'nearest'}); }
  }, 30);
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
  const {res, img, limbe, exif} = CHK;
  const jour = lireDateURL($('solDate').value), frac = lireHeureURL($('solHeure').value);
  if(jour === null || frac === null){ lignesSolveur([...CHK.lignes, 'Date ou heure illisible (JJ.MM.AA, HH:MM:SS).']); return; }
  let unix = unixDeJour(jour + frac);
  const l = [];
  const h = limbe ? heureParLimbe(res, img, limbe, unix, 2400) : null;
  // limbe concordant : points bien sur un même cône autour du nadir, bord vu entre le sol et le haut de l'airglow
  // l'heure saisie est appliquée telle quelle ; celle du limbe est proposée (bouton) si elle diffère
  let hLimbe = null;
  if(h && h.sdDeg < 0.08 && h.alt > -20 && h.alt < 150){
    l.push('Heure par le limbe : ' + texteHeure(h.unix) + ' UT (' + (h.ecart >= 0 ? '+' : '') + h.ecart + ' s ; bord à ' + h.alt.toFixed(0) + ' km)');
    if(h.ecart) hLimbe = h.unix;
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
         + (Math.abs(roulis) > 2 ? ' (roulis de ' + roulis.toFixed(0) + '° non reproduit)' : '') + ' — dans l\'URL.');
  lignesSolveur([...CHK.lignes.filter(x => !x.startsWith('Pas de date')), ...l]);   // appliqué : l'invite à dater est caduque
  if(hLimbe){
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = 'Prendre l\'heure du limbe (' + texteHeure(hLimbe) + ')';
    b.onclick = () => { $('solHeure').value = texteHeure(hLimbe); appliquerSolution(false); };
    $('solTxt').appendChild(b);
  }
  ENC.roulis = roulis;
  majCalque();
}
