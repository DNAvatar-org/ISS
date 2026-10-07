// File: js/solveur/exif.js
// Desc: Lecture minimale des EXIF d'un JPEG : date de prise de vue, focale (réelle et équivalent 24×36).
// Version 1.0.0
// Date: [October 07, 2026]
// Copyright 2026 DNAvatar.org - Arnaud Maignan
// Licensed under Apache License 2.0 with Commons Clause. See LICENSE.

/* Segment APP1 « Exif » → en-tête TIFF → IFD0 → sous-IFD Exif (0x8769) : DateTimeOriginal (0x9003),
   FocalLength (0x920A), FocalLengthIn35mmFilm (0xA405). Les images passées par un réseau social n'en ont plus
   (null partout) ; les originaux (Flickr, appareil) les gardent. Les appareils de l'ISS sont réglés en GMT (UTC). */
function lireExif(buf){
  const r = {date:null, focale:null, focale35:null};
  const v = new DataView(buf);
  if(v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return r;                  // pas un JPEG
  let p = 2;
  while(p + 4 < v.byteLength){
    const m = v.getUint16(p), n = v.getUint16(p + 2);
    if(m === 0xFFE1 && v.getUint32(p + 4) === 0x45786966) return lireTiff(v, p + 10, r);   // « Exif »
    if((m & 0xFF00) !== 0xFF00 || m === 0xFFDA) break;                         // début de l'image : plus d'en-têtes
    p += 2 + n;
  }
  return r;
}

function lireTiff(v, t, r){
  const le = v.getUint16(t) === 0x4949;                                         // « II » : petit-boutiste
  const u16 = o => v.getUint16(t + o, le), u32 = o => v.getUint32(t + o, le);
  const rationnel = o => u32(o + 4) ? u32(o)/u32(o + 4) : null;
  const texte = (o, n) => { let s = ''; for(let i=0;i<n-1;i++) s += String.fromCharCode(v.getUint8(t + o + i)); return s; };
  const ifd = (o, f) => { const n = u16(o); for(let i=0;i<n;i++){ const e = o + 2 + 12*i; f(u16(e), u16(e + 2), u32(e + 4), e + 8); } };
  let exif = 0;
  ifd(u32(4), (tag, type, n, val) => { if(tag === 0x8769) exif = u32(val - 0); });
  if(!exif) return r;
  ifd(exif, (tag, type, n, val) => {
    if(tag === 0x9003){                                                         // « 2021:07:30 22:20:46 »
      const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(texte(u32(val), n));
      if(m) r.date = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])/1000;
    }
    if(tag === 0x920A) r.focale = rationnel(u32(val));
    if(tag === 0xA405) r.focale35 = u16(val) || null;
  });
  return r;
}
