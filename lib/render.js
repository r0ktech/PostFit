import { MemoryError, canvasToBlob, createCanvas, get2d, releaseCanvas, resampleRect } from './canvas';
import { decode, ImageError } from './analyze';

export const FORMATS = {
  jpg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPG', alpha: false, lossy: true },
  png: { mime: 'image/png', ext: 'png', label: 'PNG', alpha: true, lossy: false },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', alpha: true, lossy: true },
};

/** Colour (or null for transparent) used behind the image and in padding. */
export function resolveBackground(settings) {
  const fmt = FORMATS[settings.format];
  switch (settings.background) {
    case 'black':
      return '#000000';
    case 'custom':
      return settings.customColor || '#ffffff';
    case 'transparent':
      return fmt.alpha ? null : '#ffffff';
    case 'white':
    default:
      return '#ffffff';
  }
}

/**
 * Render one image to its final blob.
 * Decodes the original at full resolution, resamples only the crop rect,
 * composes onto the output canvas and encodes. Every intermediate is freed.
 */
export async function renderImage(image, layout, settings, onStage = () => {}) {
  const fmt = FORMATS[settings.format];
  const bg = resolveBackground(settings);
  let bmp = null;
  let scaled = null;
  let out = null;
  try {
    onStage('decode');
    bmp = await decode(image.file);
    const { crop, draw, outW, outH } = layout;

    onStage('resize');
    scaled = await resampleRect(bmp, crop.sx, crop.sy, crop.sw, crop.sh, draw.dw, draw.dh);
    bmp.close?.();
    bmp = null;

    out = createCanvas(outW, outH);
    const ctx = get2d(out, { alpha: bg === null });
    if (bg !== null) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.drawImage(scaled, draw.dx, draw.dy);
    releaseCanvas(scaled);
    scaled = null;

    onStage('encode');
    const blob = await canvasToBlob(out, fmt.mime, fmt.lossy ? settings.quality / 100 : undefined);
    return { blob, width: outW, height: outH, size: blob.size, mime: blob.type || fmt.mime };
  } catch (err) {
    if (err instanceof ImageError) throw err;
    if (err instanceof MemoryError) throw new ImageError('memory', err.message);
    throw new ImageError('memory', 'Processing failed — the browser may be out of memory. Try a smaller size.');
  } finally {
    bmp?.close?.();
    releaseCanvas(scaled);
    releaseCanvas(out);
  }
}

export function outputName(image, index, format) {
  const base = image.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const n = String(index + 1).padStart(2, '0');
  return `${n}-${base || 'image'}.${FORMATS[format].ext}`;
}

/**
 * Seamless-carousel export. Slides are rendered in order; each picture is
 * decoded and resampled to its cell once, then copied (whole pixels only)
 * into every slide it touches, so split pictures join without a seam.
 * A cell is freed as soon as the last slide using it is done.
 */
export function createStripRenderer(strip, settings) {
  const fmt = FORMATS[settings.format];
  const bg = resolveBackground(settings);
  const cache = new Map(); // cell id -> canvas (cw × ch)

  async function cellCanvas(cell) {
    if (cache.has(cell.id)) return cache.get(cell.id);
    const { crop, draw, outW, outH } = cell.layout;
    let bmp = null;
    let scaled = null;
    try {
      bmp = await decode(cell.image.file);
      scaled = await resampleRect(bmp, crop.sx, crop.sy, crop.sw, crop.sh, draw.dw, draw.dh);
      bmp.close?.();
      bmp = null;
      let c = scaled;
      if (draw.dx || draw.dy || draw.dw !== outW || draw.dh !== outH) {
        c = createCanvas(outW, outH);
        get2d(c).drawImage(scaled, draw.dx, draw.dy);
        releaseCanvas(scaled);
      }
      scaled = null;
      cache.set(cell.id, c);
      return c;
    } finally {
      bmp?.close?.();
      releaseCanvas(scaled);
    }
  }

  async function renderSlide(f, onStage = () => {}) {
    const slide = strip.slides[f];
    const cells = strip.cells.filter((c) => slide.cellIds.includes(c.id));
    let out = null;
    try {
      onStage('decode');
      out = createCanvas(strip.frameW, strip.frameH);
      const ctx = get2d(out, { alpha: bg === null });
      if (bg !== null) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, strip.frameW, strip.frameH);
      }
      for (const cell of cells) {
        const c = await cellCanvas(cell);
        onStage('resize');
        const from = Math.max(cell.x0, slide.fx0);
        const to = Math.min(cell.x1, slide.fx1);
        ctx.drawImage(c, from - cell.x0, 0, to - from, strip.frameH, from - slide.fx0, 0, to - from, strip.frameH);
        if (cell.x1 <= slide.fx1) {
          releaseCanvas(cache.get(cell.id));
          cache.delete(cell.id);
        }
      }
      onStage('encode');
      const blob = await canvasToBlob(out, fmt.mime, fmt.lossy ? settings.quality / 100 : undefined);
      return { blob, width: strip.frameW, height: strip.frameH, size: blob.size, mime: blob.type || fmt.mime };
    } catch (err) {
      if (err instanceof ImageError) throw err;
      if (err instanceof MemoryError) throw new ImageError('memory', err.message);
      throw new ImageError('memory', 'Processing failed — the browser may be out of memory. Try a smaller size.');
    } finally {
      releaseCanvas(out);
    }
  }

  function dispose() {
    cache.forEach((c) => releaseCanvas(c));
    cache.clear();
  }

  return { renderSlide, dispose };
}

export function slideName(index, format) {
  return `slide-${String(index + 1).padStart(2, '0')}.${FORMATS[format].ext}`;
}
