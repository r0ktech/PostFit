import { MemoryError, createCanvas, get2d, releaseCanvas, resampleRect, canvasToBlob, canEncodeWebP } from './canvas';
import { computeSaliency, SALIENCY_SAMPLE } from './smartcrop';

export const MAX_IMAGES = 20;
export const MAX_FILE_BYTES = 60 * 1024 * 1024;
export const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

const PREVIEW_EDGE = 1200;
const CLASSIFY_EDGE = 256;

export class ImageError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function isConstrainedDevice() {
  if (typeof navigator === 'undefined') return false;
  const touch = navigator.maxTouchPoints > 1;
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  return touch || lowMem;
}

/** Max decoded pixels we attempt; mobile Safari is far stricter than desktop. */
export function maxPixels() {
  return isConstrainedDevice() ? 50e6 : 120e6;
}

/* ------------------------------------------------------------------ */
/* Header sniffing: real type + dimensions without decoding the image. */
/* ------------------------------------------------------------------ */

const u16be = (b, o) => (b[o] << 8) | b[o + 1];
const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u24le = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const ascii = (b, o, n) => String.fromCharCode(...b.subarray(o, o + n));

export async function sniff(file) {
  const head = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
  if (head.length < 16) return { type: 'unknown' };

  // PNG
  if (head[0] === 0x89 && ascii(head, 1, 3) === 'PNG') {
    const colorType = head[25];
    let alpha = colorType === 4 || colorType === 6;
    if (!alpha) {
      // look for a tRNS chunk before IDAT
      let o = 8;
      while (o + 8 < head.length) {
        const len = u32be(head, o);
        const t = ascii(head, o + 4, 4);
        if (t === 'tRNS') alpha = true;
        if (t === 'IDAT' || t === 'IEND') break;
        o += 12 + len;
      }
    }
    return { type: 'image/png', width: u32be(head, 16), height: u32be(head, 20), alpha };
  }

  // JPEG
  if (head[0] === 0xff && head[1] === 0xd8) {
    let o = 2;
    while (o + 9 < head.length) {
      if (head[o] !== 0xff) {
        o++;
        continue;
      }
      const marker = head[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
        o += marker === 0xff ? 1 : 2;
        continue;
      }
      const len = u16be(head, o + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        return { type: 'image/jpeg', height: u16be(head, o + 5), width: u16be(head, o + 7), alpha: false };
      }
      o += 2 + len;
    }
    return { type: 'image/jpeg', alpha: false };
  }

  // WebP
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') {
    const chunk = ascii(head, 12, 4);
    if (chunk === 'VP8X') {
      return {
        type: 'image/webp',
        alpha: (head[20] & 0x10) !== 0,
        animated: (head[20] & 0x02) !== 0,
        width: u24le(head, 24) + 1,
        height: u24le(head, 27) + 1,
      };
    }
    if (chunk === 'VP8L') {
      const b = head.subarray(21);
      const width = 1 + (((b[1] & 0x3f) << 8) | b[0]);
      const height = 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6));
      return { type: 'image/webp', alpha: (b[3] & 0x10) !== 0, width, height };
    }
    if (chunk === 'VP8 ') {
      return { type: 'image/webp', alpha: false, width: (head[26] | (head[27] << 8)) & 0x3fff, height: (head[28] | (head[29] << 8)) & 0x3fff };
    }
    return { type: 'image/webp' };
  }

  if (ascii(head, 0, 4) === 'GIF8') return { type: 'image/gif' };
  if (ascii(head, 4, 4) === 'ftyp') {
    const brand = ascii(head, 8, 4);
    if (/hei|hev|mif1|msf1/.test(brand)) return { type: 'image/heic' };
    if (/avi/.test(brand)) return { type: 'image/avif' };
  }
  return { type: 'unknown' };
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

export async function validate(file) {
  if (file.size === 0) throw new ImageError('corrupt', 'This file is empty.');
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageError('too-large', `File is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${MAX_FILE_BYTES / 1048576} MB.`);
  }
  const info = await sniff(file);
  switch (info.type) {
    case 'image/jpeg':
    case 'image/png':
    case 'image/webp':
      break;
    case 'image/gif':
      throw new ImageError('unsupported', 'GIFs aren’t supported. Upload GIFs to X directly to keep the animation.');
    case 'image/heic':
      throw new ImageError('unsupported', 'HEIC isn’t supported by browsers. Export it as JPG first.');
    case 'image/avif':
      throw new ImageError('unsupported', 'AVIF isn’t supported. Use JPG, PNG or WebP.');
    default:
      if (/^image\/(jpe?g|png|webp)$/.test(file.type)) {
        throw new ImageError('corrupt', 'This file looks damaged — its header can’t be read.');
      }
      throw new ImageError('unsupported', 'Unsupported file type. Use JPG, PNG or WebP.');
  }
  if (info.animated) {
    throw new ImageError('unsupported', 'Animated WebP isn’t supported. Upload it to X directly.');
  }
  if (info.width && info.height && info.width * info.height > maxPixels()) {
    const mp = Math.round((info.width * info.height) / 1e6);
    throw new ImageError('too-large', `${info.width} × ${info.height} (${mp} MP) is too large for this device. Max ${Math.round(maxPixels() / 1e6)} MP.`);
  }
  return info;
}

/** Decode with EXIF orientation applied. Throws ImageError on failure. */
export async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (err) {
    try {
      // Some browsers reject the options bag; try the plain call.
      return await createImageBitmap(file);
    } catch {
      if (err?.name === 'RangeError' || /memory/i.test(String(err?.message))) {
        throw new ImageError('memory', 'Not enough memory to open this image. Close other tabs or use a smaller image.');
      }
      throw new ImageError('corrupt', 'This image is corrupted or can’t be decoded.');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Content classification                                             */
/* ------------------------------------------------------------------ */

/**
 * Screenshots, UI, slides, memes and posters have large perfectly flat areas
 * and a small palette; photos have sensor noise everywhere. Measure both.
 */
function classify(rgba, w, h, hasAlphaHint) {
  let flat = 0;
  let total = 0;
  let transparent = 0;
  const counts = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (rgba[p + 3] < 250) transparent++;
      const key = ((rgba[p] >> 3) << 10) | ((rgba[p + 1] >> 3) << 5) | (rgba[p + 2] >> 3);
      counts.set(key, (counts.get(key) || 0) + 1);
      if (x < w - 1) {
        const q = p + 4;
        const d = Math.abs(rgba[p] - rgba[q]) + Math.abs(rgba[p + 1] - rgba[q + 1]) + Math.abs(rgba[p + 2] - rgba[q + 2]);
        if (d <= 1) flat++;
        total++;
      }
    }
  }
  const n = w * h;
  const top = [...counts.values()].sort((a, b) => b - a).slice(0, 8).reduce((s, c) => s + c, 0) / n;
  const flatRatio = flat / Math.max(1, total);
  const hasAlpha = transparent / n > 0.001;
  const graphic = flatRatio > 0.42 || top > 0.62 || (hasAlpha && hasAlphaHint);
  return {
    kind: graphic ? 'graphic' : 'photo',
    hasAlpha,
    flatRatio: Math.round(flatRatio * 100) / 100,
    palette: Math.round(top * 100) / 100,
  };
}

/* ------------------------------------------------------------------ */
/* Full analysis                                                      */
/* ------------------------------------------------------------------ */

/**
 * Decode once, produce a light preview blob + analysis, then free the
 * full-resolution bitmap. Only the File (disk-backed) and the small preview
 * stay in memory.
 */
export async function analyzeFile(file) {
  const info = await validate(file);
  const bmp = await decode(file);
  const width = bmp.width;
  const height = bmp.height;
  let preview = null;
  let classSample = null;
  let salSample = null;
  try {
    if (width * height > maxPixels()) {
      throw new ImageError('too-large', `${width} × ${height} is too large for this device.`);
    }
    const ps = Math.min(1, PREVIEW_EDGE / Math.max(width, height));
    const pw = Math.max(1, Math.round(width * ps));
    const ph = Math.max(1, Math.round(height * ps));
    preview = await resampleRect(bmp, 0, 0, width, height, pw, ph);

    const cs = Math.min(1, CLASSIFY_EDGE / Math.max(pw, ph));
    const cw = Math.max(1, Math.round(pw * cs));
    const ch = Math.max(1, Math.round(ph * cs));
    classSample = createCanvas(cw, ch);
    const cctx = get2d(classSample, { willReadFrequently: true });
    cctx.imageSmoothingEnabled = false; // keep exact colours for flatness test
    cctx.drawImage(preview, 0, 0, cw, ch);
    const classData = cctx.getImageData(0, 0, cw, ch).data;
    const cls = classify(classData, cw, ch, info.alpha !== false);

    const ss = Math.min(1, SALIENCY_SAMPLE / Math.max(pw, ph));
    const sw = Math.max(1, Math.round(pw * ss));
    const sh = Math.max(1, Math.round(ph * ss));
    salSample = createCanvas(sw, sh);
    const sctx = get2d(salSample, { willReadFrequently: true });
    sctx.drawImage(preview, 0, 0, sw, sh);
    const saliency = computeSaliency(sctx.getImageData(0, 0, sw, sh).data, sw, sh);

    const previewType = canEncodeWebP() ? 'image/webp' : cls.hasAlpha ? 'image/png' : 'image/jpeg';
    const previewBlob = await canvasToBlob(preview, previewType, 0.86);

    return {
      width,
      height,
      type: info.type,
      previewBlob,
      analysis: { ...cls, saliency },
    };
  } catch (err) {
    if (err instanceof ImageError) throw err;
    if (err instanceof MemoryError) throw new ImageError('memory', err.message);
    throw new ImageError('corrupt', 'This image couldn’t be read.');
  } finally {
    bmp.close?.();
    releaseCanvas(preview);
    releaseCanvas(classSample);
    releaseCanvas(salSample);
  }
}
