// File: js/geo-data.js
// Desc: Noms sur la Terre : océans et mers, pays (point central approximatif, rang), capitales et grandes villes (lat, lon en degrés).
// Version 1.0.0
// Date: [October 08, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Positions à ~1° près pour les pays (là où le nom se lit bien, pas le centroïde exact), à quelques km pour les villes.
   Rang (pays) : 1 = vaste, lisible de loin ; 2 = moyen ; 3 = petit (ne paraît qu'en zoomant). Est = longitude positive. */
const GEO_MERS = [
  ['Océan Pacifique Nord', 25, -150], ['Océan Pacifique Sud', -25, -130], ['Océan Atlantique Nord', 32, -42],
  ['Océan Atlantique Sud', -22, -15], ['Océan Indien', -20, 78], ['Océan Austral', -62, 30], ['Océan Arctique', 82, 0],
  ['Mer Méditerranée', 35, 18], ['Mer des Caraïbes', 15, -75], ['Golfe du Mexique', 25, -90], ['Mer de Chine méridionale', 13, 114],
  ['Mer d\'Arabie', 15, 63], ['Golfe du Bengale', 15, 88], ['Mer du Nord', 56, 3], ['Mer Baltique', 58, 19], ['Mer Noire', 43, 34],
  ['Mer Caspienne', 42, 51], ['Mer Rouge', 20, 38.5], ['Mer de Tasman', -40, 160], ['Mer de Béring', 58, -178], ['Mer du Japon', 40, 135],
  ['Golfe de Guinée', 2, 3], ['Baie d\'Hudson', 60, -85], ['Mer de Corail', -16, 155], ['Mer d\'Okhotsk', 53, 150], ['Golfe Persique', 27, 51]
];
const GEO_PAYS = [
  ['Russie', 61, 96, 1], ['Canada', 58, -103, 1], ['États-Unis', 39.5, -99, 1], ['Brésil', -10, -53, 1], ['Australie', -25, 134, 1],
  ['Chine', 35, 103, 1], ['Inde', 22, 79, 1], ['Argentine', -35, -65, 1], ['Kazakhstan', 48, 67, 1], ['Algérie', 28, 2.5, 1],
  ['Rép. dém. du Congo', -3, 23.5, 1], ['Groenland', 72, -40, 1], ['Arabie saoudite', 24, 45, 1], ['Mexique', 23.5, -102, 1],
  ['Indonésie', -2, 117, 1], ['Soudan', 15, 30, 1], ['Libye', 27, 17, 1], ['Iran', 32.5, 54, 1], ['Mongolie', 46.5, 103, 1],
  ['Pérou', -9.5, -75, 1], ['Tchad', 15.5, 18.5, 1], ['Niger', 17.5, 9, 1], ['Angola', -12.5, 17.5, 1], ['Mali', 17.5, -2.5, 1],
  ['Afrique du Sud', -29, 24.5, 1], ['Colombie', 4, -73, 1], ['Éthiopie', 9, 39.5, 1], ['Bolivie', -16.5, -64.5, 1],
  ['Mauritanie', 20.5, -10.5, 1], ['Égypte', 26.5, 30, 1], ['Tanzanie', -6.5, 35, 1], ['Nigeria', 9.5, 8, 1], ['Venezuela', 7.5, -66, 1],
  ['Antarctique', -82, 30, 1],
  ['Namibie', -22.5, 17.5, 2], ['Mozambique', -17.5, 35.5, 2], ['Pakistan', 30, 69.5, 2], ['Turquie', 39, 35, 2], ['Chili', -30, -71, 2],
  ['Zambie', -14, 27.5, 2], ['Birmanie', 21, 96, 2], ['Afghanistan', 34, 66, 2], ['Somalie', 6, 46, 2], ['Rép. centrafricaine', 6.5, 20.5, 2],
  ['Soudan du Sud', 7.5, 30.5, 2], ['Ukraine', 49, 31.5, 2], ['Madagascar', -19.5, 46.7, 2], ['Botswana', -22.3, 24, 2], ['Kenya', 0.5, 38, 2],
  ['France', 46.5, 2.5, 2], ['Yémen', 15.8, 47.5, 2], ['Thaïlande', 15.5, 101, 2], ['Espagne', 40, -3.7, 2], ['Turkménistan', 39, 59.5, 2],
  ['Cameroun', 5.7, 12.5, 2], ['Papouasie-N.-Guinée', -6.5, 145, 2], ['Suède', 63, 16, 2], ['Ouzbékistan', 41.5, 64, 2], ['Maroc', 32, -6.5, 2],
  ['Irak', 33, 43.5, 2], ['Paraguay', -23.3, -58.5, 2], ['Zimbabwe', -19, 29.8, 2], ['Japon', 36.5, 138.5, 2], ['Allemagne', 51, 10.4, 2],
  ['Congo', -0.8, 15.5, 2], ['Finlande', 64, 26, 2], ['Vietnam', 15.5, 107.8, 2], ['Malaisie', 3.5, 102, 2], ['Norvège', 64.5, 12.5, 2],
  ['Côte d\'Ivoire', 7.6, -5.5, 2], ['Pologne', 52, 19.4, 2], ['Oman', 21, 57, 2], ['Italie', 42.8, 12.6, 2], ['Philippines', 12.5, 122.5, 2],
  ['Équateur', -1.5, -78.3, 2], ['Burkina Faso', 12.3, -1.7, 2], ['Nouvelle-Zélande', -42, 172.5, 2], ['Gabon', -0.7, 11.7, 2],
  ['Guinée', 10.4, -10.9, 2], ['Royaume-Uni', 54, -2.3, 2], ['Ouganda', 1.3, 32.4, 2], ['Ghana', 7.9, -1.1, 2], ['Roumanie', 45.9, 24.9, 2],
  ['Laos', 19, 103, 2], ['Guyana', 5, -59, 2], ['Biélorussie', 53.6, 28, 2], ['Kirghizistan', 41.3, 74.7, 2], ['Sénégal', 14.4, -14.5, 2],
  ['Syrie', 35, 38.5, 2], ['Cambodge', 12.6, 105, 2], ['Uruguay', -32.8, -56, 2], ['Tunisie', 34, 9.5, 2], ['Suriname', 4, -56, 2],
  ['Bangladesh', 23.8, 90.3, 2], ['Népal', 28.3, 84, 2], ['Tadjikistan', 38.8, 71, 2], ['Grèce', 39.3, 22, 2], ['Nicaragua', 12.9, -85, 2],
  ['Corée du Nord', 40.2, 127.2, 2], ['Malawi', -13.3, 34, 2], ['Érythrée', 15.6, 38.8, 2], ['Bénin', 9.5, 2.3, 2], ['Honduras', 14.8, -86.6, 2],
  ['Liberia', 6.4, -9.4, 2], ['Bulgarie', 42.7, 25.3, 2], ['Cuba', 21.8, -79.3, 2], ['Guatemala', 15.6, -90.3, 2], ['Islande', 64.9, -18.6, 2],
  ['Corée du Sud', 36.4, 127.9, 2], ['Hongrie', 47.1, 19.4, 2], ['Portugal', 39.6, -8, 2], ['Jordanie', 31.2, 36.5, 2], ['Serbie', 44, 20.8, 2],
  ['Azerbaïdjan', 40.3, 47.6, 2], ['Autriche', 47.6, 14.1, 2], ['Émirats arabes unis', 23.6, 54, 2], ['Tchéquie', 49.8, 15.5, 2],
  ['Panama', 8.5, -80.2, 2], ['Sierra Leone', 8.5, -11.8, 2], ['Irlande', 53.2, -8, 2], ['Géorgie', 42.2, 43.5, 2], ['Sri Lanka', 7.8, 80.7, 2],
  ['Lituanie', 55.3, 23.9, 2], ['Lettonie', 56.9, 24.7, 2], ['Togo', 8.6, 0.9, 2], ['Croatie', 45.3, 16, 2], ['Bosnie-Herzégovine', 44.2, 17.8, 2],
  ['Costa Rica', 9.9, -84.2, 2], ['Slovaquie', 48.7, 19.7, 2], ['Rép. dominicaine', 18.9, -70.4, 2], ['Estonie', 58.6, 25.5, 2],
  ['Danemark', 56, 9.5, 2], ['Pays-Bas', 52.2, 5.5, 2], ['Suisse', 46.8, 8.2, 2], ['Bhoutan', 27.4, 90.4, 2], ['Taïwan', 23.7, 121, 2],
  ['Guinée-Bissau', 12, -15, 2], ['Moldavie', 47.2, 28.5, 2], ['Belgique', 50.6, 4.6, 2], ['Lesotho', -29.6, 28.2, 2], ['Arménie', 40.2, 45,  2],
  ['Albanie', 41.1, 20.1, 2], ['Guinée équatoriale', 1.6, 10.5, 2], ['Burundi', -3.4, 29.9, 2], ['Haïti', 19, -72.7, 2], ['Rwanda', -2, 29.9, 2],
  ['Macédoine du Nord', 41.6, 21.7, 2], ['Djibouti', 11.8, 42.6, 2], ['Belize', 17.2, -88.7, 2], ['Salvador', 13.8, -88.9, 2], ['Israël', 31.4, 35, 2],
  ['Slovénie', 46.1, 14.8, 2], ['Koweït', 29.3, 47.6, 2], ['Eswatini', -26.5, 31.5, 2], ['Monténégro', 42.8, 19.3, 2], ['Gambie', 13.4, -15.4, 2],
  ['Qatar', 25.3, 51.2, 2], ['Jamaïque', 18.1, -77.3, 2], ['Liban', 33.9, 35.9, 2], ['Chypre', 35, 33.2, 2], ['Brunei', 4.5, 114.7, 2],
  ['Timor oriental', -8.8, 125.9, 2], ['Bahamas', 24.5, -77.5, 2], ['Fidji', -17.8, 178, 2], ['Vanuatu', -16, 167.5, 2],
  ['Îles Salomon', -9.4, 160, 2], ['Nouvelle-Calédonie', -21.3, 165.5, 2], ['Sahara occidental', 24.5, -13, 2], ['Kosovo', 42.6, 20.9, 2],
  ['Polynésie française', -17.6, -149.5, 2], ['Luxembourg', 49.8, 6.1, 3], ['Trinité-et-Tobago', 10.5, -61.3, 3], ['Cap-Vert', 16, -24, 3],
  ['Maurice', -20.3, 57.6, 3], ['Comores', -11.9, 43.9, 3], ['Bahreïn', 26.1, 50.6, 3], ['Singapour', 1.35, 103.8, 3], ['Malte', 35.9, 14.4, 3],
  ['Maldives', 3.2, 73.2, 3], ['Barbade', 13.2, -59.5, 3], ['Sao Tomé-et-Principe', 0.3, 6.7, 3], ['Samoa', -13.8, -172.1, 3],
  ['Tonga', -21.2, -175.2, 3], ['Seychelles', -4.7, 55.5, 3], ['Andorre', 42.5, 1.6, 3], ['Monaco', 43.74, 7.42, 3], ['Liechtenstein', 47.15, 9.55, 3],
  ['Saint-Marin', 43.94, 12.46, 3], ['Vatican', 41.9, 12.45, 3], ['Porto Rico', 18.2, -66.5, 3], ['Guadeloupe', 16.2, -61.6, 3],
  ['Martinique', 14.65, -61, 3], ['La Réunion', -21.1, 55.5, 3], ['Guyane', 4, -53, 2], ['Mayotte', -12.8, 45.15, 3], ['Hawaï', 20.5, -157, 3],
  ['Îles Turques-et-Caïques', 21.7, -71.8, 3], ['Îles Caïmans', 19.3, -81.2, 3], ['Bermudes', 32.3, -64.8, 3], ['Açores', 38.5, -28, 3],
  ['Madère', 32.75, -16.95, 3], ['Canaries', 28.3, -16, 3], ['Baléares', 39.6, 2.9, 3], ['Corse', 42.15, 9.1, 3], ['Sardaigne', 40.1, 9, 3],
  ['Sicile', 37.5, 14.2, 3], ['Crète', 35.2, 24.9, 3], ['Hokkaido', 43.3, 142.8, 3], ['Tasmanie', -42, 146.6, 3], ['Sumatra', 0, 101.5, 3],
  ['Bornéo', 0.5, 114, 3], ['Java', -7.3, 110.5, 3], ['Sulawesi', -2, 121, 3], ['Galápagos', -0.6, -90.5, 3], ['Malouines', -51.7, -59.5, 3],
  ['Svalbard', 78.5, 17, 3], ['Kerguelen', -49.3, 69.5, 3], ['Île de Pâques', -27.1, -109.35, 3], ['Zanzibar', -6.1, 39.3, 3]
];
const GEO_VILLES = [
  // Europe
  ['Paris', 48.857, 2.352], ['Londres', 51.507, -0.128], ['Madrid', 40.417, -3.704], ['Berlin', 52.52, 13.405], ['Rome', 41.903, 12.496],
  ['Moscou', 55.756, 37.617], ['Lisbonne', 38.722, -9.139], ['Dublin', 53.35, -6.26], ['Bruxelles', 50.85, 4.352], ['Amsterdam', 52.37, 4.895],
  ['Berne', 46.948, 7.447], ['Vienne', 48.208, 16.373], ['Prague', 50.075, 14.438], ['Varsovie', 52.23, 21.012], ['Budapest', 47.498, 19.04],
  ['Bucarest', 44.427, 26.103], ['Sofia', 42.698, 23.322], ['Athènes', 37.984, 23.728], ['Belgrade', 44.787, 20.457], ['Zagreb', 45.815, 15.982],
  ['Copenhague', 55.676, 12.568], ['Oslo', 59.914, 10.752], ['Stockholm', 59.329, 18.069], ['Helsinki', 60.17, 24.938], ['Reykjavik', 64.147, -21.94],
  ['Kiev', 50.45, 30.523], ['Minsk', 53.905, 27.559], ['Riga', 56.95, 24.105], ['Vilnius', 54.687, 25.28], ['Tallinn', 59.437, 24.754],
  ['Barcelone', 41.385, 2.173], ['Marseille', 43.296, 5.37], ['Lyon', 45.764, 4.836], ['Milan', 45.464, 9.19], ['Munich', 48.135, 11.582],
  ['Hambourg', 53.551, 9.994], ['Istanbul', 41.008, 28.978], ['Saint-Pétersbourg', 59.934, 30.336], ['Naples', 40.852, 14.268],
  // Afrique, Moyen-Orient
  ['Le Caire', 30.044, 31.236], ['Alger', 36.754, 3.059], ['Rabat', 34.02, -6.842], ['Casablanca', 33.573, -7.59], ['Tunis', 36.806, 10.182],
  ['Tripoli', 32.887, 13.191], ['Dakar', 14.716, -17.467], ['Bamako', 12.639, -8.003], ['Niamey', 13.512, 2.112], ['Abidjan', 5.36, -4.008],
  ['Accra', 5.604, -0.187], ['Lagos', 6.524, 3.379], ['Abuja', 9.076, 7.399], ['Kinshasa', -4.441, 15.266], ['Luanda', -8.839, 13.289],
  ['Nairobi', -1.292, 36.822], ['Addis-Abeba', 9.03, 38.74], ['Khartoum', 15.5, 32.56], ['Dar es Salam', -6.792, 39.208], ['Johannesburg', -26.204, 28.047],
  ['Le Cap', -33.925, 18.424], ['Pretoria', -25.747, 28.229], ['Antananarivo', -18.879, 47.508], ['Maputo', -25.969, 32.573], ['Harare', -17.829, 31.052],
  ['Mogadiscio', 2.047, 45.318], ['Riyad', 24.713, 46.675], ['Djeddah', 21.485, 39.193], ['Téhéran', 35.689, 51.389], ['Bagdad', 33.315, 44.366],
  ['Damas', 33.513, 36.292], ['Beyrouth', 33.894, 35.502], ['Jérusalem', 31.769, 35.216], ['Amman', 31.945, 35.928], ['Ankara', 39.934, 32.86],
  ['Dubaï', 25.205, 55.271], ['Doha', 25.285, 51.531], ['Koweït', 29.376, 47.977], ['Mascate', 23.588, 58.383], ['Sanaa', 15.369, 44.191],
  // Asie, Océanie
  ['Pékin', 39.904, 116.407], ['Shanghai', 31.23, 121.474], ['Hong Kong', 22.319, 114.169], ['Canton', 23.129, 113.264], ['Tokyo', 35.676, 139.65],
  ['Osaka', 34.694, 135.502], ['Séoul', 37.566, 126.978], ['Pyongyang', 39.039, 125.762], ['Taipei', 25.033, 121.565], ['Manille', 14.6, 120.984],
  ['Hanoï', 21.028, 105.854], ['Hô Chi Minh-Ville', 10.823, 106.63], ['Bangkok', 13.756, 100.502], ['Rangoun', 16.84, 96.173], ['Kuala Lumpur', 3.139, 101.687],
  ['Singapour', 1.352, 103.82], ['Jakarta', -6.208, 106.846], ['New Delhi', 28.614, 77.209], ['Bombay', 19.076, 72.878], ['Calcutta', 22.573, 88.364],
  ['Madras', 13.083, 80.271], ['Bangalore', 12.972, 77.595], ['Karachi', 24.861, 67.01], ['Islamabad', 33.684, 73.048], ['Dacca', 23.811, 90.413],
  ['Katmandou', 27.717, 85.324], ['Colombo', 6.927, 79.861], ['Kaboul', 34.555, 69.207], ['Tachkent', 41.299, 69.24], ['Almaty', 43.238, 76.946],
  ['Astana', 51.169, 71.449], ['Oulan-Bator', 47.886, 106.906], ['Novossibirsk', 55.008, 82.935], ['Vladivostok', 43.116, 131.885],
  ['Sydney', -33.869, 151.209], ['Melbourne', -37.814, 144.963], ['Brisbane', -27.47, 153.026], ['Perth', -31.95, 115.861], ['Canberra', -35.281, 149.13],
  ['Auckland', -36.848, 174.763], ['Wellington', -41.287, 174.776], ['Nouméa', -22.276, 166.458], ['Papeete', -17.535, -149.569], ['Honolulu', 21.307, -157.858],
  // Amériques
  ['Washington', 38.907, -77.037], ['New York', 40.713, -74.006], ['Los Angeles', 34.052, -118.244], ['Chicago', 41.878, -87.63], ['Houston', 29.76, -95.37],
  ['Miami', 25.762, -80.192], ['San Francisco', 37.775, -122.419], ['Seattle', 47.606, -122.332], ['Denver', 39.739, -104.99], ['Atlanta', 33.749, -84.388],
  ['Dallas', 32.777, -96.797], ['Boston', 42.36, -71.059], ['Las Vegas', 36.17, -115.14], ['Phoenix', 33.448, -112.074], ['Anchorage', 61.218, -149.9],
  ['Ottawa', 45.421, -75.697], ['Toronto', 43.653, -79.383], ['Montréal', 45.502, -73.567], ['Vancouver', 49.283, -123.121], ['Québec', 46.814, -71.208],
  ['Mexico', 19.433, -99.133], ['Guadalajara', 20.659, -103.35], ['Monterrey', 25.686, -100.316], ['Guatemala', 14.634, -90.507], ['San José', 9.928, -84.091],
  ['Panama', 8.983, -79.517], ['La Havane', 23.113, -82.366], ['Saint-Domingue', 18.486, -69.931], ['Port-au-Prince', 18.594, -72.307], ['Kingston', 17.997, -76.794],
  ['San Juan', 18.466, -66.106], ['Nassau', 25.044, -77.35], ['Cockburn Town', 21.461, -71.142], ['Fort-de-France', 14.616, -61.059], ['Pointe-à-Pitre', 16.241, -61.533],
  ['Bogota', 4.711, -74.072], ['Caracas', 10.481, -66.904], ['Quito', -0.18, -78.468], ['Lima', -12.046, -77.043], ['La Paz', -16.5, -68.15],
  ['Santiago', -33.449, -70.669], ['Buenos Aires', -34.604, -58.382], ['Montevideo', -34.901, -56.165], ['Asuncion', -25.264, -57.576],
  ['Brasilia', -15.794, -47.882], ['São Paulo', -23.551, -46.633], ['Rio de Janeiro', -22.907, -43.173], ['Manaus', -3.119, -60.022], ['Cayenne', 4.922, -52.313],
  ['Salvador', -12.978, -38.501], ['Recife', -8.048, -34.877], ['Fortaleza', -3.732, -38.527], ['Ushuaïa', -54.802, -68.303]
];
