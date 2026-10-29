// File: js/solveur/recherche-dates.js
// Desc: « Dates possibles » d'une photo sans date : fenêtre (année, nom NASA), passages de l'ISS, ligne verte, Lune, villes.
// Version 1.0.0
// Date: [October 29, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Sans EXIF, les étoiles et le limbe donnent la verticale de l'ISS dans le ciel ; l'ISS la retrouve à chaque orbite des
   jours où son plan la contient (instant.js) : des centaines d'instants de 2000 à aujourd'hui. On les départage dans
   cet ordre :
   1. fenêtre : l'année saisie ; sinon l'expédition lue dans le nom d'une photo NASA (ISS042-E-37847 : du 10.11.14 au
      11.03.15, expeditions-data.js) ; sinon de 2000 à aujourd'hui ;
   2. limbe : le cône de l'horizon autour du nadir et, si la photo a une ligne verte (ligne-verte.js), son altitude
      vers 92 km, qui fixe aussi l'heure à ~2 s ;
   3. éclairage : une Terre claire, ni verte ni piquée de villes (nuages au clair de lune), veut la Lune assez haute et
      pleine (eclairage.js) ;
   4. villes, si la photo en montre : accord avec la carte VIIRS (villes.js), retenu s'il se détache du hasard ; sinon
      les instants restent classés par l'accord du limbe.
   Chacun est listé (« vers » : ce que vise le centre de la photo) ; le premier est appliqué (cadre rouge), un clic sur un
   autre le compare (calque). Une autre recherche ou une autre photo arrête celle-ci.
   Essais du 29 octobre 2026 : ISS042-E-37847 (NASA : 13.12.14 20:42:12, ligne verte alors à 128 km : horloge de
   l'appareil en avance ?) → 13.12.14 20:42:29 en tête, devant les deux orbites voisines. Photos de Pesquet cherchées
   de 2000 à 2026 : Italie, Europe, orage datés par leurs villes (significatif) ; Voie lactée, peu de villes : la bonne
   date a la meilleure note sans se détacher assez — elle est citée, le classement reste au limbe. */

// Expédition d'une photo NASA d'après son nom (ISS042-E-37847, iss042e037847.jpg…) : {n, debut, fin} en s Unix, avec
// 2 jours de marge (fin : aujourd'hui pour l'expédition en cours, ou au-delà de la table) ; du, au : ses dates. Sinon null.
function expeditionDuNom(nom){
  const m = /iss[-_ ]?(\d{3})[-_ ]?e[-_ ]?\d{3,}/i.exec(nom);
  if(!m || +m[1] < 1) return null;
  const n = +m[1], e = EXPEDITIONS[Math.min(n, EXPEDITIONS.length) - 1], au = n <= EXPEDITIONS.length ? e[1] : null;
  return {n, du:e[0], au, debut:Date.parse(e[0])/1000 - 2*86400, fin:au ? Date.parse(au)/1000 + 3*86400 : Date.now()/1000};
}

// Fenêtre de recherche (s Unix) et sa description.
function fenetreDates(){
  const v = $('solAn').value.trim(), an = /^\d{2}$/.test(v) ? 2000 + +v : /^\d{4}$/.test(v) ? +v : null, maintenant = Date.now()/1000;
  if(an) return {debut:Date.UTC(an, 0, 1)/1000, fin:Math.min(Date.UTC(an + 1, 0, 1)/1000, maintenant), texte:'en ' + an};
  const x = expeditionDuNom(CHK.nom);
  if(x) return {debut:x.debut, fin:Math.min(x.fin, maintenant),
                texte:'dans l\'expédition ' + x.n + ' (nom NASA : ' + (x.au ? 'du ' + texteDate(Date.parse(x.du)/1000) + ' au ' + texteDate(Date.parse(x.au)/1000) : 'depuis le ' + texteDate(Date.parse(x.du)/1000)) + ')'};
  return {debut:Date.UTC(DATES.AN_MIN, 0, 1)/1000, fin:maintenant, texte:'de ' + DATES.AN_MIN + ' à aujourd\'hui'};
}

async function chercherDates(){
  const {res, img, limbe, verte, data} = CHK, jeton = CHK.recherche = {}, f = fenetreDates();
  const l = $('solListe'); l.textContent = '';
  const p = document.createElement('p'), pv = document.createElement('p'); l.append(p, pv);
  const a0 = new Date(f.debut*1000).getUTCFullYear(), a1 = new Date(f.fin*1000).getUTCFullYear();
  let c = [];
  for(let a=a0;a<=a1;a++){
    p.textContent = 'Recherche ' + f.texte + '… ' + a + (c.length ? ' : ' + c.length + ' instant' + (c.length > 1 ? 's' : '') : '');
    await peindre();
    if(CHK.recherche !== jeton) return;
    c.push(...datesPossibles(res, img, limbe, Math.max(f.debut, Date.UTC(a, 0, 1)/1000), Math.min(f.fin, Date.UTC(a + 1, 0, 1)/1000), true, verte));
  }
  const n = c.length, phrases = [];
  if(!n){
    p.textContent = 'Aucun instant ' + f.texte + ' : l\'ISS n\'a pas vu ce limbe sous ces étoiles de nuit' + (verte ? ', la ligne verte vers 92 km' : '')
                    + ' (autre satellite, photo retouchée ou montage ?).';
    return;
  }
  c = c.sort((x, y) => x.J - y.J).slice(0, 400);                       // les plus d'accord avec le limbe
  phrases.push(n + ' instant' + (n > 1 ? 's' : '') + ' ' + f.texte + ' où l\'ISS, de nuit, voyait ce limbe sous ces étoiles'
               + (verte ? ', la ligne verte vers 92 km' : '') + (n > c.length ? ' (les ' + c.length + ' plus d\'accord)' : '') + '.');
  // une Terre claire (nuages au clair de lune) écarte les instants où la Lune ne l'éclaire pas assez
  const pts = echantillonsTerre(data, img.W, img.H, limbe), terre = terrePhoto(data, img.W, img.H, pts, verte, res.F);
  if(terre.claire){
    for(const m of c) m.ec = eclairageSol(res, img, pts, m.unix);
    const k = c.filter(m => eclairageCompatible(m.ec, terre));
    if(k.length) c = k;
    phrases.push('Terre claire, sans villes ni aurore : des nuages sous la Lune ? ' + (k.length ? k.length + ' où la Lune l\'éclaire assez.'
                 : 'Aucun où la Lune l\'éclaire assez : tous gardés.'));
  }
  c.sort((x, y) => x.unix - y.unix);
  for(const m of c){ const g = pointVise(res, m.unix); m.lieu = g ? lieuProche(g.lat, g.lon) : null; }   // ce que vise la photo
  const villes = villesVisibles(pts);
  phrases.push('« vers » : ce que vise le centre de la photo ; limbe : accord du limbe' + (verte ? ' et de la ligne verte' : '')
               + (villes ? ' ; villes : accord des lumières avec la carte VIIRS de la NASA.' : '. La photo ne montre pas de villes : classés par le limbe.')
               + ' Le premier est appliqué ; clic sur un autre pour comparer (calque).');
  p.textContent = phrases.join(' ');
  const pc = x => Math.round(100*x) + ' %';
  const libelle = m => texteDate(m.unix) + ' ' + texteHeure(m.unix) + ' UT' + (m.lieu ? ' · vers ' + m.lieu : '') + ' · limbe ' + pc(Math.exp(-m.J/2))
                       + (m.ec ? ' · Lune ' + pc(m.ec.phase) + ' à ' + Math.round(m.ec.hLune) + '°' : '')
                       + (villes ? ' · villes ' + (m.note === undefined ? '…' : m.note === null ? '—' : pc(m.note)) : '');
  const choisir = (m, b) => {
    l.querySelectorAll('button.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    $('solDate').value = texteDate(m.unix); $('solHeure').value = texteHeure(m.unix); appliquerSolution(false);
  };
  const boutons = c.map(m => {
    const b = document.createElement('button');
    b.textContent = libelle(m); b.onclick = () => choisir(m, b);
    l.appendChild(b);
    return b;
  });
  let ordre = c.map((m, i) => i).sort((i, j) => c[i].J - c[j].J);   // par l'accord du limbe
  if(villes){
    // notes une par une (tuiles VIIRS chargées au fil de l'eau), puis : la meilleure se détache-t-elle du hasard ?
    for(let i=0;i<boutons.length;i++){
      c[i].note = await noteVilles(res, img, pts, c[i].unix);
      if(CHK.recherche !== jeton) return;
      boutons[i].textContent = libelle(c[i]);
    }
    const notes = c.map((m, i) => i).filter(i => c[i].note !== null).sort((i, j) => c[j].note - c[i].note);
    if(notes.length){
      const m = c[notes[0]], s = await significativiteVilles(res, img, pts, m, notes.slice(1).map(i => c[i].note));
      if(CHK.recherche !== jeton) return;
      pv.textContent = s.ok ? 'Villes : la meilleure note (' + pc(m.note) + ') se détache du hasard (z = ' + fr(s.z, 1) + ', seuil ' + fr(s.seuil, 1) + ') : classés par les villes.'
                            : 'Villes : la meilleure note (' + pc(m.note) + ', le ' + texteDate(m.unix) + ' à ' + texteHeure(m.unix) + ') ne se détache pas assez du hasard (z = '
                              + fr(s.z, 1) + ', seuil ' + fr(s.seuil, 1) + ') : classés par le limbe.';
      if(s.ok) ordre = [...notes, ...ordre.filter(i => c[i].note === null)];
    }
  }
  for(const i of ordre) l.appendChild(boutons[i]);
  choisir(c[ordre[0]], boutons[ordre[0]]);
  l.scrollTop = 0; l.scrollIntoView({block:'nearest'});                // en haut : l'explication et le premier
}
