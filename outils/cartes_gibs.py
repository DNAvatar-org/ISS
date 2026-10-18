# File: outils/cartes_gibs.py
# Desc: Construit les cartes de base de la Terre — cartes/geoview.jpg (jour) et cartes/steamNight.jpg (nuit) — depuis les
#       tuiles NASA GIBS que la page charge déjà au zoom (js/tuiles.js) : Blue Marble Next Generation et VIIRS City
#       Lights 2012, EPSG:4326, donc de vraies équirectangulaires (±90° × ±180°), niveau 2 (tuiles de 72°, 512 px),
#       assemblées en 2560 × 1280 puis réduites à LARGEUR × LARGEUR/2. Les anciennes (1024 × 491 et 2942 × 1433)
#       n'étaient pas des 2:1 : côtes décalées jusqu'à ~5° en latitude sur le globe.
#       Puis régénère js/cartes-data.js (les trois cartes en data: URI, pour file://), la Lune reprise telle quelle.
# Version 1.0.0
# Date: [October 18, 2026]
# Copyright 2026 DNAvatar.org - Arnaud Maignan
# Licensed under Apache License 2.0 with Commons Clause. See LICENSE.
#
# Usage (depuis site/Pesquet) : python3 outils/cartes_gibs.py     (Internet : 30 tuiles d'environ 20 Ko ; Pillow)
# Source : NASA GIBS (crédit dans la page, #credits).

import base64, io, os, re, urllib.request
from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, '..'))
CARTES = os.path.join(RACINE, 'cartes')
DATA = os.path.join(RACINE, 'js', 'cartes-data.js')
GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/%s/default/500m/%d/%d/%d.jpeg'
NIVEAU, TUILE = 2, 512
LARGEUR, QUALITE = 2048, 85
COUCHES = {'geoview.jpg': 'BlueMarble_NextGeneration', 'steamNight.jpg': 'VIIRS_CityLights_2012'}


def monde(couche):
    """La couche GIBS en équirectangulaire LARGEUR × LARGEUR/2."""
    pas = 288.0 / 2 ** NIVEAU
    cols, rangs = int(round(360 / pas)), int(-(-180 // pas))
    grand = Image.new('RGB', (cols * TUILE, rangs * TUILE))
    for r in range(rangs):
        for c in range(cols):
            with urllib.request.urlopen(GIBS % (couche, NIVEAU, r, c), timeout=60) as rep:
                grand.paste(Image.open(io.BytesIO(rep.read())).convert('RGB'), (c * TUILE, r * TUILE))
    grand = grand.crop((0, 0, cols * TUILE, int(round(180 / pas * TUILE))))   # la dernière rangée déborde le pôle Sud
    return grand.resize((LARGEUR, LARGEUR // 2), Image.LANCZOS)


def uri(chemin):
    return 'data:image/jpeg;base64,' + base64.b64encode(open(chemin, 'rb').read()).decode('ascii')


def main():
    for nom, couche in COUCHES.items():
        chemin = os.path.join(CARTES, nom)
        monde(couche).save(chemin, quality=QUALITE, optimize=True)
        print('[cartes] %s ← %s : %d Ko' % (nom, couche, os.path.getsize(chemin) // 1024))
    ancien = open(DATA, encoding='utf-8').read()
    lune = re.search(r"\n  lune: '([^']*)'", ancien).group(1)
    tete = ancien[:ancien.index('const CARTES = {')]
    tete = re.sub(r'// Desc: Cartes jour \(geoview\.jpg\), nuit \(steamNight\.jpg\)',
                  '// Desc: Cartes jour (geoview.jpg), nuit (steamNight.jpg) — NASA GIBS, outils/cartes_gibs.py —', tete, count=1)
    with open(DATA, 'w', encoding='utf-8') as f:
        f.write(tete)
        f.write("const CARTES = {\n  jour: '%s',\n  nuit: '%s',\n  lune: '%s'\n};\n" %
                (uri(os.path.join(CARTES, 'geoview.jpg')), uri(os.path.join(CARTES, 'steamNight.jpg')), lune))
    print('[cartes] js/cartes-data.js : %d Ko' % (os.path.getsize(DATA) // 1024))


if __name__ == '__main__':
    main()
