# File: outils/ephemerides-iss.py
# Desc: Construit js/iss-ephem-data.js : position et vitesse réelles de l'ISS toutes les 4 h, d'après les éphémérides
#       officielles de la NASA (OEM, JSC/FOD/TOPO, archivées depuis le 10 septembre 2020).
# Version 1.0.0
# Date: [October 07, 2026]
# Copyright 2026 DNAvatar.org - Arnaud Maignan
# Licensed under Apache License 2.0 with Commons Clause. See LICENSE.
#
# Usage (depuis site/Pesquet) :   python3 outils/ephemerides-iss.py [dossier-cache]
#   Télécharge les OEM manquants dans le cache (par défaut ~/.cache/iss-oem, ~0,7 Mo par fichier), puis réécrit
#   js/iss-ephem-data.js. À relancer de temps en temps (avant une publication) pour prolonger les données jusqu'à
#   aujourd'hui + ~15 jours (chaque OEM contient la prévision des deux semaines suivantes, manœuvres prévues comprises).
#
# Chaque point de la grille (pas de 4 h) vient de l'OEM le plus récent qui le couvre : pour une date passée, c'est la
# trajectoire reconstituée après coup, pas une vieille prévision. L'échantillon OEM le plus proche (pas de 4 min) est
# propagé jusqu'au point de grille avec le même intégrateur que la page (RK4, J2) : la page fait ensuite au plus ±2 h
# de propagation, ~1 km d'écart avec l'OEM.

import os, sys, re, json, bisect, datetime as dt, urllib.request, urllib.parse, concurrent.futures as cf
from math import sqrt

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, '..', 'js', 'iss-ephem-data.js')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/.cache/iss-oem')
S3 = 'https://nasa-public-data.s3.amazonaws.com'
PAS = 4*3600

MU = 398600.4418; RE = 6378.137; J2 = 1.08262668e-3     # km, s (mêmes constantes que js/ephemerides.js)

def acc(x, y, z):
    r2 = x*x + y*y + z*z; r = sqrt(r2); zr2 = z*z/r2
    k = -MU/(r2*r); j = 1.5*J2*MU*RE*RE/(r2*r2*r)
    return (k*x + j*x*(5*zr2 - 1), k*y + j*y*(5*zr2 - 1), k*z + j*z*(5*zr2 - 3))

def propager(s, duree, h=30.0):
    n = max(1, int(abs(duree)/h + 0.999)); h = duree/n
    x, y, z, u, v, w = s
    for _ in range(n):
        a1 = acc(x, y, z)
        a2 = acc(x + h/2*u, y + h/2*v, z + h/2*w)
        u2, v2, w2 = u + h/2*a1[0], v + h/2*a1[1], w + h/2*a1[2]
        a3 = acc(x + h/2*u2, y + h/2*v2, z + h/2*w2)
        u3, v3, w3 = u + h/2*a2[0], v + h/2*a2[1], w + h/2*a2[2]
        a4 = acc(x + h*u3, y + h*v3, z + h*w3)
        u4, v4, w4 = u + h*a3[0], v + h*a3[1], w + h*a3[2]
        x += h/6*(u + 2*u2 + 2*u3 + u4); y += h/6*(v + 2*v2 + 2*v3 + v4); z += h/6*(w + 2*w2 + 2*w3 + w4)
        u += h/6*(a1[0] + 2*a2[0] + 2*a3[0] + a4[0]); v += h/6*(a1[1] + 2*a2[1] + 2*a3[1] + a4[1]); w += h/6*(a1[2] + 2*a2[2] + 2*a3[2] + a4[2])
    return (x, y, z, u, v, w)

def secondes(iso):
    return dt.datetime.fromisoformat(iso).replace(tzinfo=dt.timezone.utc).timestamp()

def lister():
    """Toutes les clés « …OEM_J2K_EPH.txt » du bucket (le chemin varie : ISS_OEM/, ISS.OEM_J2K_EPH/…), pages de 1000."""
    cles = []; jeton = ''
    while True:
        url = S3 + '/?list-type=2&prefix=iss-coords/' + ('&continuation-token=' + urllib.parse.quote(jeton) if jeton else '')
        r = urllib.request.urlopen(url, timeout=60).read().decode()
        cles += [k for k in re.findall(r'<Key>([^<]+)</Key>', r) if k.endswith('OEM_J2K_EPH.txt')]
        m = re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>', r)
        if not m: return sorted(cles)
        jeton = m.group(1)

def telecharger(cle):
    f = os.path.join(CACHE, cle.replace('iss-coords/', '').replace('/', '_'))
    if os.path.exists(f) and os.path.getsize(f) > 0: return f
    try:
        data = urllib.request.urlopen(S3 + '/' + cle, timeout=120).read()
    except Exception as e:
        print('  illisible :', cle, e); return None
    open(f, 'wb').write(data)
    return f

def lire(f):
    creation = None; t = []; s = []
    for l in open(f):
        if l.startswith('CREATION_DATE'): creation = secondes(l.split('=')[1].strip())
        elif l[:2] == '20':
            p = l.split()
            t.append(secondes(p[0])); s.append(tuple(map(float, p[1:7])))
    return {'creation': creation, 't': t, 's': s} if t else None

def main():
    os.makedirs(CACHE, exist_ok=True)
    cles = lister()
    print(len(cles), 'OEM listés ;', cles[0].split('/')[1], '→', cles[-1].split('/')[1])
    with cf.ThreadPoolExecutor(8) as ex: fichiers = [f for f in ex.map(telecharger, cles) if f]
    oem = sorted(filter(None, map(lire, fichiers)), key=lambda o: o['creation'])
    debut = (int(min(o['t'][0] for o in oem)) // PAS + 1)*PAS
    fin = int(max(o['t'][-1] for o in oem)) // PAS*PAS
    vals = []; trous = 0; i0 = 0
    for g in range(debut, fin + 1, PAS):
        src = None
        for o in reversed(oem):                                  # le plus récent qui couvre g
            if o['t'][0] <= g <= o['t'][-1]: src = o; break
        if not src:
            vals += [0]*6; trous += 1; continue
        k = bisect.bisect_left(src['t'], g)
        if k == len(src['t']) or (k > 0 and g - src['t'][k-1] < src['t'][k] - g): k -= 1
        x = propager(src['s'][k], g - src['t'][k])
        vals += [round(x[0]*1000), round(x[1]*1000), round(x[2]*1000), round(x[3]*1e6), round(x[4]*1e6), round(x[5]*1e6)]
    fiable = max(o['creation'] for o in oem)
    jour = lambda s: dt.datetime.fromtimestamp(s, dt.timezone.utc).strftime('%Y-%m-%d %H:%M')
    n = len(vals)//6
    print(n, 'points de', jour(debut), 'à', jour(fin), '; trous :', trous, '; dernier OEM créé le', jour(fiable))
    with open(SORTIE, 'w') as f:
        f.write('// File: js/iss-ephem-data.js\n'
                '// Desc: Données : position et vitesse réelles de l\'ISS toutes les 4 h (NASA OEM, EME2000). GÉNÉRÉ par outils/ephemerides-iss.py.\n'
                '// Version 1.0.0\n'
                f'// Date: [{dt.datetime.now().strftime("%B %d, %Y")}]\n'
                '// Copyright 2026 DNAvatar.org - Arnaud Maignan\n'
                '// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.\n\n'
                '/* Source : NASA JSC/FOD/TOPO, éphémérides ISS (OEM), nasa-public-data.s3.amazonaws.com/iss-coords.\n'
                f'   {n} points de {jour(debut)} à {jour(fin)} UTC. debut, pas, fiable : secondes Unix (UTC) ;\n'
                '   fiable = création du dernier OEM (au-delà : prévision). v : x, y, z (m), vx, vy, vz (mm/s) par point ;\n'
                '   six zéros = pas de données. */\n')
        f.write('const EPHEM_ISS = ' + json.dumps({'debut': debut, 'pas': PAS, 'fiable': int(fiable), 'n': n}) [:-1]
                + ', "v":[' + ','.join(map(str, vals)) + ']};\n')
    print('écrit :', os.path.relpath(SORTIE), os.path.getsize(SORTIE)//1024, 'Ko')

main()
