// File: js/dates.js
// Desc: Toutes les dates de la simulation : bornes (2000 – 2035) et éclipses de la période (menu « Éclipses »).
// Version 1.0.0
// Date: [October 06, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Jours = jours depuis le 1er janvier 2021, 0 h UTC (comme jourDate()). */
const JOUR_DE = (an, mois = 0, jour = 1) => (Date.UTC(an, mois, jour) - Date.UTC(2021, 0, 1))/86400000;

const DATES = {
  AN_MIN: 2000, AN_MAX: 2035,
  min: JOUR_DE(2000),              // 1er janv. 2000 : on ne descend pas plus bas
  max: JOUR_DE(2036),              // 1er janv. 2036 (exclu) : on ne dépasse pas le 31 déc. 2035 à 23:59:59
  anDe: jours => new Date(Date.UTC(2021, 0, 1) + jours*86400000).getUTCFullYear()
};

/* Éclipses 2000–2035 : [instant du maximum, 'S' Soleil | 'L' Lune, type].
   Soleil : T totale, A annulaire, H hybride, P partielle. Lune : T totale, P partielle, N pénombrale.
   On garde l'ÉVÉNEMENT (géométrie Soleil–Terre–Lune), pas sa visibilité : un satellite peut très bien se trouver dans
   la pénombre même si, du sol, l'éclipse passe inaperçue.
   Calculées avec les éphémérides de orbite.js (Meeus), puis comparées au catalogue de la NASA (Espenak, eclipse.gsfc.nasa.gov,
   SEdecade / LEdecade 1991–2040) : les 162 éclipses de 2000 à 2035 y sont toutes, mêmes types, maximum à 2,6 min près
   (écart moyen 1,3 min : ΔT ≈ 65 s). Corrections faites après comparaison : 2003-05-31 et 2014-04-29 annulaires (axe qui
   rase la Terre), 2007-02-17 retirée (partielle limite, absente du catalogue). */
DATES.ECLIPSES = [
  [-7650.8030,'L','T'],[-7635.4650,'S','P'],[-7488.1848,'S','P'],[-7473.4188,'L','T'],[-7458.9066,'S','P'],[-7311.2663,'S','P'],
  [-7296.1512,'L','T'],[-7133.4964,'S','T'],[-7119.3776,'L','P'],[-6957.1298,'S','A'],[-6941.5613,'L','N'],[-6794.4962,'L','N'],
  [-6779.0096,'S','A'],[-6765.1053,'L','N'],[-6616.9253,'L','N'],[-6602.6858,'S','T'],[-6439.8463,'L','T'],[-6424.8270,'S','A'],
  [-6262.9445,'L','T'],[-6248.0474,'S','T'],[-6100.4337,'S','P'],[-6085.1447,'L','T'],[-5922.8747,'S','P'],[-5908.8716,'L','T'],
  [-5746.1407,'S','H'],[-5730.5856,'L','N'],[-5568.5605,'S','A'],[-5554.4971,'L','P'],[-5406.0076,'L','N'],[-5391.5749,'S','T'],
  [-5229.2134,'L','P'],[-5214.5129,'S','A'],[-5052.0260,'L','T'],[-5036.8942,'S','P'],[-4874.5567,'L','T'],
  [-4860.4774,'S','P'],[-4711.8361,'S','A'],[-4697.8567,'L','T'],[-4535.5677,'S','T'],[-4520.1171,'L','P'],[-4357.6668,'S','A'],
  [-4343.3904,'L','N'],[-4195.5972,'L','N'],[-4180.8914,'S','T'],[-4165.9720,'L','N'],[-4018.1909,'L','P'],[-4003.7026,'S','A'],
  [-3841.5142,'L','P'],[-3826.1846,'S','T'],[-3663.6533,'L','T'],[-3649.6305,'S','P'],[-3501.1130,'S','P'],[-3487.1573,'L','T'],
  [-3471.6395,'S','P'],[-3324.7346,'S','P'],[-3309.3937,'L','T'],[-3147.0041,'S','A'],[-3132.5383,'L','P'],[-2970.0735,'S','T'],
  [-2955.3932,'L','N'],[-2807.1598,'L','P'],[-2792.9812,'S','A'],[-2777.8249,'L','N'],[-2631.0060,'L','N'],[-2615.4663,'S','H'],
  [-2452.6751,'L','T'],[-2438.7461,'S','A'],[-2276.5447,'L','T'],[-2261.0935,'S','P'],[-2113.5927,'S','T'],[-2098.4987,'L','T'],
  [-1936.7111,'S','P'],[-1921.8826,'L','T'],[-1758.9181,'S','T'],[-1744.5080,'L','N'],[-1582.6190,'S','A'],[-1567.2109,'L','N'],
  [-1419.9691,'L','N'],[-1404.3785,'S','A'],[-1242.2345,'L','P'],[-1228.2314,'S','T'],[-1065.4377,'L','T'],[-1050.1302,'S','P'],
  [-902.8733,'S','P'],[-888.1504,'L','T'],[-873.5918,'S','P'],[-725.9286,'S','P'],[-710.7825,'L','T'],[-548.1918,'S','T'],
  [-534.1031,'L','P'],[-371.7785,'S','A'],[-356.1998,'L','N'],[-209.1900,'L','N'],[-193.7212,'S','A'],[-179.8118,'L','N'],
  [-31.5944,'L','N'],[-17.3231,'S','T'],[145.4724,'L','T'],[160.4467,'S','A'],[322.3781,'L','P'],[337.3167,'S','T'],
  [484.8629,'S','P'],[500.1754,'L','T'],[662.4594,'S','P'],[676.4585,'L','T'],[839.1796,'S','H'],[854.7255,'L','N'],
  [1016.7504,'S','A'],[1030.8438,'L','P'],[1179.3019,'L','N'],[1193.7630,'S','T'],[1356.1154,'L','P'],[1370.7823,'S','A'],
  [1533.2925,'L','T'],[1548.4506,'S','P'],[1710.7587,'L','T'],[1724.8211,'S','P'],[1873.5097,'S','A'],[1887.4829,'L','T'],
  [2049.7410,'S','T'],[2065.1762,'L','P'],[2227.6673,'S','A'],[2241.9671,'L','N'],[2389.6700,'L','N'],[2404.4221,'S','T'],
  [2419.3023,'L','N'],[2567.1771,'L','P'],[2581.6316,'S','A'],[2743.7649,'L','P'],[2759.1227,'S','T'],[2921.7040,'L','T'],
  [2935.7177,'S','P'],[3084.1718,'S','P'],[3098.1419,'L','T'],[3113.6515,'S','P'],[3260.6279,'S','P'],[3275.9464,'L','T'],
  [3438.2703,'S','A'],[3452.7742,'L','P'],[3615.2869,'S','T'],[3629.9367,'L','N'],[3778.1616,'L','N'],[3792.3027,'S','A'],
  [3807.4900,'L','N'],[3954.3243,'L','N'],[3969.8811,'S','H'],[4132.6356,'L','T'],[4146.5606,'S','A'],[4308.7948,'L','T'],
  [4324.2324,'S','P'],[4471.7516,'S','T'],[4486.8014,'L','T'],[4648.5796,'S','P'],[4663.4564,'L','T'],[4826.4299,'S','T'],
  [4840.7969,'L','N'],[5002.6799,'S','A'],[5018.1166,'L','P'],[5165.3791,'L','N'],[5180.9628,'S','A'],[5343.0502,'L','P'],
  [5357.0810,'S','T']
];

const TYPES_ECLIPSE = {
  S:{astre:'Soleil', T:'totale', A:'annulaire', H:'hybride', P:'partielle'},
  L:{astre:'Lune',   T:'totale', P:'partielle', N:'pénombrale'}
};

// Éclipses d'une année civile (UTC), dans l'ordre du temps.
const eclipsesAnnee = an => DATES.ECLIPSES.filter(e => DATES.anDe(e[0]) === an);

// « 26 mai — Lune, totale »
function libelleEclipse(e){
  const t = TYPES_ECLIPSE[e[1]];
  const jour = new Date(Date.UTC(2021, 0, 1) + e[0]*86400000).toLocaleDateString('fr-FR', {day:'numeric', month:'long', timeZone:'UTC'});
  return jour + ' — ' + t.astre + ', ' + t[e[2]];
}
