// File: js/solveur/catalogue.js
// Desc: « Check Photo » : choisir une photo du catalogue (vignettes) ou de son ordinateur ; ?photo= dans l'URL.
// Version 1.0.0
// Date: [October 08, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Le bouton Check Photo ouvre #catalogue : les vignettes du catalogue (catalogue-data.js), et « Depuis mon
   ordinateur… » (le sélecteur de fichier ; le glisser-déposer marche toujours). Une photo du catalogue est lue comme un
   fichier, avec son crédit et, s'il y en a un, son limbe tracé ; son nom va dans l'URL (?photo=, sans .jpg) : un
   copier-coller la recharge. Une photo de l'ordinateur retire ?photo=. */
function creerCatalogue(){
  const grille = $('catGrille');
  for(const p of CATALOGUE){
    const b = document.createElement('button'), im = document.createElement('img'), t = document.createElement('span'), c = document.createElement('small');
    b.type = 'button'; im.src = 'catalogue/vignettes/' + p.f; im.alt = ''; im.loading = 'lazy';
    t.textContent = p.titre; c.textContent = '© ' + p.credit;
    b.append(im, t, c);
    b.onclick = () => { fermerCatalogue(); chargerCatalogue(p); };
    grille.appendChild(b);
  }
  $('catDisque').onclick = () => { fermerCatalogue(); $('fPhoto').click(); };
  $('catFermer').onclick = fermerCatalogue;
  $('catalogue').onclick = e => { if(e.target === $('catalogue')) fermerCatalogue(); };   // clic à côté
  addEventListener('keydown', e => { if(e.key === 'Escape' && !$('catalogue').hidden) fermerCatalogue(); });
}
function ouvrirCatalogue(){ $('catalogue').hidden = false; }
function fermerCatalogue(){ $('catalogue').hidden = true; }

async function chargerCatalogue(p){
  const blob = await fetch('catalogue/' + p.f).then(r => { if(!r.ok) throw new Error('Photo du catalogue introuvable : ' + p.f); return r.blob(); });
  const limbe = p.limbe ? p.limbe.split(';').map(t => t.split(',').map(Number)) : null;
  ecrirePhotoURL(p.f.replace(/\.jpg$/, ''));
  analyserPhoto(new File([blob], p.f, {type:'image/jpeg'}), {credit:p.credit, limbe});
}

// ?photo=nom (url.js le lit au démarrage) ; null : retiré.
function ecrirePhotoURL(nom){
  const q = new URLSearchParams(location.search);
  if(nom) q.set('photo', nom); else q.delete('photo');
  history.replaceState(null, '', '?' + q.toString().replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%3B/g, ';'));
}

// Au démarrage : la photo du catalogue nommée dans l'URL, ou un avis si elle n'y est pas.
function photoDeLURL(){
  const v = URL_P.get('photo');
  if(v === null) return [];
  const p = CATALOGUE.find(x => x.f.replace(/\.jpg$/, '') === v.replace(/\.jpg$/, ''));
  if(!p) return ['Photo inconnue : « ' + v + ' ». Celles du catalogue : ' + CATALOGUE.map(x => x.f.replace(/\.jpg$/, '')).join(', ') + '.'];
  chargerCatalogue(p);
  return [];
}
