// File: js/solveur/catalogue-data.js
// Desc: Catalogue de Check Photo : photos prises depuis l'ISS, publiées avec le site (catalogue/), titre, crédit, limbe tracé si besoin.
// Version 1.0.0
// Date: [October 08, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* f : fichier dans catalogue/ (vignette dans catalogue/vignettes/, même nom) ; credit : affiché sous la photo et dans la
   liste (les droits restent à leurs auteurs : ESA/NASA pour les photos de Thomas Pesquet, NASA pour celles de ses
   équipages, domaine public) ; limbe : bord de l'atmosphère tracé à la main (x,y;… en pixels du fichier) quand la
   détection automatique se trompe (côte très lumineuse prise pour le limbe…). */
const CATALOGUE = [
  {f:'aurore-bras-robotique-2021-08-07.jpg', titre:'Aurore boréale et bras robotique (7 août 2021, date EXIF)', credit:'ESA/NASA – Thomas Pesquet'},
  {f:'italie-eclair-2021-09-09.jpg', titre:'Italie et Adriatique de nuit, un éclair, Orion', credit:'ESA/NASA – Thomas Pesquet',
   limbe:'82,1026;573,738;1065,522;1618,349;1987,262'},
  {f:'orion-soyouz-europe.jpg', titre:'Europe de nuit, Orion et un vaisseau amarré', credit:'ESA/NASA – Thomas Pesquet'},
  {f:'europe-nuit-airglow-vert.jpg', titre:'Europe de nuit sous la bande verte de l\'airglow', credit:'ESA/NASA – Thomas Pesquet'},
  {f:'eclair-pleiades.jpg', titre:'Orage, Pléiades et airglow vert', credit:'ESA/NASA – Thomas Pesquet'},
  {f:'voie-lactee-airglow-orange.jpg', titre:'Voie lactée au-dessus de l\'airglow orange', credit:'ESA/NASA – Thomas Pesquet'},
  {f:'iss042e037847.jpg', titre:'Nuages sous la Lune, airglow orange (expédition 42)', credit:'NASA'}
];
