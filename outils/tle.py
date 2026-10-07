# File: outils/tle.py
# Desc: Construit js/tle-data.js : un jeu de paramètres orbitaux (TLE) par jour et par satellite, encodé en entiers.
# Version 1.0.0
# Date: [October 07, 2026]
# Copyright 2026 DNAvatar.org - Arnaud Maignan
# Licensed under Apache License 2.0 with Commons Clause. See LICENSE.
#
# Usage (depuis site/Pesquet) : python3 outils/tle.py
# Entrée : outils/space-track/<NORAD>.tle — historique « gp_history » de space-track.org, format TLE (deux lignes) :
#   https://www.space-track.org/basicspacedata/query/class/gp_history/NORAD_CAT_ID/<NORAD>/EPOCH/2000-01-01--<aujourd'hui>/orderby/EPOCH%20asc/format/tle/emptyresult/show
# La page recompose les deux lignes de chaque TLE (ephemerides.js) et calcule la position par SGP4 (satellite.js) :
# une équation et ses paramètres du jour, pas un tableau de positions. Un TLE par jour suffit : l'écart propre des TLE
# (~2,5 km, mesuré contre les éphémérides NASA) ne baisse pas en en gardant davantage.
import os, json, datetime as dt
ICI = os.path.dirname(os.path.abspath(__file__))
SATS = {'iss': 25544, 'hubble': 20580}
T2000 = dt.datetime(2000, 1, 1, tzinfo=dt.timezone.utc)

def lire(norad):
    L = [l.rstrip() for l in open(os.path.join(ICI, 'space-track', f'{norad}.tle'))]
    for i in range(len(L) - 1):
        a, b = L[i], L[i+1]
        if a.startswith('1 ') and b.startswith('2 ') and len(a) >= 61 and len(b) >= 63:
            y = int(a[18:20]); y += 2000 if y < 57 else 1900
            ep = (dt.datetime(y, 1, 1, tzinfo=dt.timezone.utc) - T2000).total_seconds()/86400 + float(a[20:32]) - 1
            yield ep, a, b

def encoder(ep, a, b):
    bs = a[53:61]                                            # B* : signe, mantisse (5 chiffres), exposant
    sg = -1 if bs[0] == '-' else 1
    mant, ex = int(bs[1:6]), int(bs[6:8].replace(' ', '0') if bs[6] in '+-' else bs[6:8])
    return [round(ep*1e8), round(float(b[8:16])*1e4), round(float(b[17:25])*1e4), int(b[26:33]),
            round(float(b[34:42])*1e4), round(float(b[43:51])*1e4), round(float(b[52:63])*1e8), sg*(mant*100 + ex + 50)]

out = {}
for nom, norad in SATS.items():
    v = []; prec = 0; suivant = -1e9; n = 0
    for ep, a, b in lire(norad):
        if ep < suivant: continue
        r = encoder(ep, a, b); e0 = r[0]; r[0] -= prec; prec = e0
        v += r; suivant = ep + 1 - 1/24; n += 1
    out[nom] = {'norad': norad, 'n': n, 'v': v}
    print(nom, norad, n, 'TLE')
with open(os.path.join(ICI, '..', 'js', 'tle-data.js'), 'w') as f:
    f.write('// File: js/tle-data.js\n'
            '// Desc: Données : un TLE par jour (ISS, Hubble), 2000 → aujourd\'hui, en entiers. GÉNÉRÉ par outils/tle.py.\n'
            '// Version 1.0.0\n'
            f'// Date: [{dt.datetime.now().strftime("%B %d, %Y")}]\n'
            '// Copyright 2026 DNAvatar.org - Arnaud Maignan\n'
            '// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.\n\n'
            '/* Source : space-track.org (gp_history). 8 entiers par TLE : époque (jours depuis le 1er janv. 2000 0 h UTC × 1e8,\n'
            '   écart au précédent), inclinaison, ascension droite du nœud, argument du périgée, anomalie moyenne (degrés × 1e4),\n'
            '   excentricité (× 1e7, rangée après le nœud), mouvement moyen (tours/jour × 1e8), B* (signe × (mantisse×100 + exposant + 50)).\n'
            '   Ordre : époque, i, Ω, e, ω, M, n, B*. */\n')
    f.write('const TLE_HIST = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print(os.path.getsize(os.path.join(ICI, '..', 'js', 'tle-data.js'))//1024, 'Ko')
