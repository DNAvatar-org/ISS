// File: outils/banc/banc.js
// Desc: Banc du limbe : lance detecterLimbe (js/solveur/limbe.js) sur chaque photo de test, mesure l'écart aux points de référence.
// Version 1.0.0
// Date: [October 08, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.txt.

/* Pour chaque photo de BANC_LIMBE (limbe-ref.js) : image ramenée à la taille de référence, detecterLimbe, puis pour chaque
   point de référence l'écart à la courbe trouvée (cercle : | distance au centre − r | ; conique : |Q| / |∇Q|).
   Réussi si 90 % des points sont à moins de tol = max(W, H)/200 (12 px sur 2400). Vignette : référence en magenta,
   courbe trouvée en cyan, points retenus par le détecteur en jaune. Les résultats restent dans BANC.res (console). */
const BANC = {res:{}};

function ecartCourbe(L, x, y){
  if(L.conique){
    const [a, b, c, d, e, f] = L.conique, q = a*x*x + b*x*y + c*y*y + d*x + e*y + f;
    return Math.abs(q)/Math.max(1e-12, Math.hypot(2*a*x + b*y + d, b*x + 2*c*y + e));
  }
  return Math.abs(Math.hypot(x - L.cx, y - L.cy) - L.r);
}

function tracerCourbe(cx, L, W, H){
  cx.beginPath();
  if(L.conique){                                                     // échantillonnée : points où ecart ≈ 0, colonne par colonne
    let premier = true;
    for(let x=0;x<W;x+=4){
      let yb = -1, eb = 3;
      for(let y=0;y<H;y+=2){ const e = ecartCourbe(L, x, y); if(e < eb){ eb = e; yb = y; } }
      if(yb < 0){ premier = true; continue; }
      if(premier) cx.moveTo(x, yb); else cx.lineTo(x, yb);
      premier = false;
    }
  }else cx.arc(L.cx, L.cy, L.r, 0, 2*Math.PI);
  cx.stroke();
}

async function bancPhoto(nom, ref){
  const bmp = await createImageBitmap(await fetch('../../photos/' + nom).then(r => r.blob()));
  const cv = document.createElement('canvas'); cv.width = ref.W; cv.height = ref.H;
  const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0, ref.W, ref.H);
  const t0 = performance.now(), L = detecterLimbe(cx.getImageData(0, 0, ref.W, ref.H)), ms = performance.now() - t0;
  const tol = Math.max(ref.W, ref.H)/200;
  const ec = L ? ref.pts.map(([x, y]) => ecartCourbe(L, x, y)).sort((a, b) => a - b) : [];
  const p = q => ec.length ? ec[Math.min(ec.length - 1, Math.floor(q*ec.length))] : Infinity;
  const r = {ok:!!L && p(0.9) < tol, med:p(0.5), p90:p(0.9), max:p(1), tol, ms:Math.round(ms), n:L ? L.inliers.length : 0};
  // vignette
  const t = Math.max(1, ref.W/600);
  cx.lineWidth = 2*t; cx.strokeStyle = '#ff40ff';
  for(const [x, y] of ref.pts){ cx.beginPath(); cx.arc(x, y, 4*t, 0, 2*Math.PI); cx.stroke(); }
  if(L){
    cx.strokeStyle = '#3cf'; cx.lineWidth = 1.5*t; tracerCourbe(cx, L, ref.W, ref.H);
    cx.fillStyle = '#ff0';
    for(const q of L.inliers) cx.fillRect(q.x - 2*t, q.y - 2*t, 4*t, 4*t);
  }
  return {r, cv};
}

async function lancerBanc(){
  const tb = document.querySelector('#res tbody'), vign = document.getElementById('vign');
  tb.textContent = ''; vign.textContent = '';
  let reussis = 0, n = 0;
  for(const [nom, ref] of Object.entries(BANC_LIMBE)){
    const tr = document.createElement('tr'); tb.appendChild(tr);
    tr.innerHTML = '<td>' + nom + '</td><td colspan="6">…</td>';
    let r, cv;
    try{ ({r, cv} = await bancPhoto(nom, ref)); }
    catch(e){ tr.lastChild.textContent = 'ERREUR ' + e.message; BANC.res[nom] = {ok:false, err:e.message}; n++; continue; }
    BANC.res[nom] = r; n++; if(r.ok) reussis++;
    tr.innerHTML = '<td>' + nom + '</td><td class="' + (r.ok ? 'ok' : 'ko') + '">' + (r.ok ? '✓' : '✗') + '</td>'
      + [r.med, r.p90, r.max].map(v => '<td>' + (isFinite(v) ? v.toFixed(1) : '—') + '</td>').join('')
      + '<td>' + r.tol.toFixed(0) + '</td><td>' + r.n + ' · ' + r.ms + ' ms</td>';
    const fig = document.createElement('figure'), cap = document.createElement('figcaption');
    cap.textContent = nom + (r.ok ? ' ✓' : ' ✗'); fig.append(cv, cap); vign.appendChild(fig);
  }
  BANC.bilan = reussis + ' / ' + n;
  document.getElementById('bilan').textContent = 'Réussis : ' + BANC.bilan;
}
