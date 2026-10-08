/**
 * Small canvas helpers shared by analysis and export.
 * All canvases are released (width/height = 0) after use: iOS Safari keeps
 * canvas memory alive until it is explicitly shrunk.
 */

export class MemoryError extends Error {
  constructor(message = 'Your browser ran out of memory for this image.') {
    super(message);
    this.name = 'MemoryError';
  }
}

export function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function releaseCanvas(c) {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

export function get2d(canvas, opts) {
  const ctx = canvas.getContext('2d', opts);
  if (!ctx) throw new MemoryError();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new MemoryError('The browser could not encode this image (likely out of memory).'))),
      type,
      quality
    );
  });
}

/**
 * High-quality resample of a source rectangle into a target size.
 * Halves repeatedly before the final draw so large downscales stay sharp and
 * alias-free. Never upscales beyond the requested size; callers guarantee the
 * target aspect equals the source-rect aspect (no distortion).
 * Returns a canvas the caller must release.
 */
export async function resampleRect(source, sx, sy, sw, sh, tw, th) {
  // Fast path: the browser's own high-quality resizer.
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(source, sx, sy, sw, sh, {
        resizeWidth: tw,
        resizeHeight: th,
        resizeQuality: 'high',
      });
      if (bmp.width === tw && bmp.height === th) {
        const c = createCanvas(tw, th);
        get2d(c).drawImage(bmp, 0, 0);
        bmp.close();
        return c;
      }
      bmp.close();
    } catch {
      // fall through to the stepped canvas path
    }
  }

  let cur = source;
  let cx = sx;
  let cy = sy;
  let cw = sw;
  let ch = sh;
  let tmp = null;
  while (cw / 2 >= tw && ch / 2 >= th) {
    const nw = Math.max(tw, Math.round(cw / 2));
    const nh = Math.max(th, Math.round(ch / 2));
    const next = createCanvas(nw, nh);
    get2d(next).drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
    if (tmp) releaseCanvas(tmp);
    tmp = next;
    cur = next;
    cx = 0;
    cy = 0;
    cw = nw;
    ch = nh;
  }
  const out = createCanvas(tw, th);
  get2d(out).drawImage(cur, cx, cy, cw, ch, 0, 0, tw, th);
  if (tmp) releaseCanvas(tmp);
  return out;
}

let webpSupport;
/** Whether canvas can actually encode WebP (Safari < 17 silently falls back to PNG). */
export function canEncodeWebP() {
  if (webpSupport !== undefined) return webpSupport;
  try {
    const c = createCanvas(1, 1);
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
    releaseCanvas(c);
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}
