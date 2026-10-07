# File: outils/etoiles.py
# Desc: Construit js/etoiles-data.js : étoiles du Yale Bright Star Catalogue (BSC5, ~9 100 étoiles, V ≤ 6,5), J2000.
# Version 1.0.0
# Date: [October 07, 2026]
# Copyright 2026 DNAvatar.org - Arnaud Maignan
# Licensed under Apache License 2.0 with Commons Clause. See LICENSE.
#
# Usage (depuis site/Pesquet) : python3 outils/etoiles.py
# Source : outils/bsc5-short.json (github.com/brettonw/YaleBrightStarCatalog, d'après le BSC5 de Yale / CDS V/50).

import os, re, json
ICI = os.path.dirname(os.path.abspath(__file__))

def hms(s):
    h, m, sec = map(float, re.findall(r'[\d.]+', s)); return (h + m/60 + sec/3600)*15
def dms(s):
    v = list(map(float, re.findall(r'[\d.]+', s))); d = v[0] + v[1]/60 + v[2]/3600
    return -d if s.strip()[0] in '-−' else d

vals = []; noms = {}; n = 0
for e in json.load(open(os.path.join(ICI, 'bsc5-short.json'))):
    if 'V' not in e or 'RA' not in e: continue
    V = float(e['V'])
    if V > 6.5: continue
    K = int(float(e.get('K', 6000)))
    vals += [round(hms(e['RA'])*1000), round(dms(e['Dec'])*1000), round(V*100), K//100]
    if e.get('N'): noms[n] = e['N']
    n += 1

with open(os.path.join(ICI, '..', 'js', 'etoiles-data.js'), 'w') as f:
    f.write('// File: js/etoiles-data.js\n'
            '// Desc: Données : étoiles du Yale Bright Star Catalogue (V ≤ 6,5), J2000. GÉNÉRÉ par outils/etoiles.py.\n'
            '// Version 1.0.0\n// Date: [October 07, 2026]\n'
            '// Copyright 2026 DNAvatar.org - Arnaud Maignan\n'
            '// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.\n\n'
            f'/* {n} étoiles, 4 nombres chacune : RA (milli-degrés), Dec (milli-degrés), V (centièmes de magnitude),\n'
            '   température (centaines de K). Source : BSC5 (Yale, Hoffleit & Warren 1991), CDS V/50. */\n')
    f.write('const ETOILES = [' + ','.join(map(str, vals)) + '];\n')
    f.write('// Noms propres (index d\'étoile → nom), pour légender les étoiles reconnues (Check Photo).\n')
    f.write('const ETOILES_NOMS = ' + json.dumps(noms, ensure_ascii=False) + ';\n')
print(n, 'étoiles ;', os.path.getsize(os.path.join(ICI, '..', 'js', 'etoiles-data.js'))//1024, 'Ko')
