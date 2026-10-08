import { FRAME_PRESETS, X_RULES } from './x-rules';
import { findBestCrop } from './smartcrop';
import { isGraphic } from './fit';

/**
 * Seamless carousel layout.
 *
 * All pictures sit side by side in one long strip that is then cut into
 * equal slides. With 2.5 pictures per slide, picture 3 is split: its left
 * half ends slide 1 and its right half starts slide 2, so swiping through the
 * X carousel reads as one continuous image.
 *
 * Cell boundaries are integer pixels and slide edges are multiples of the
 * slide width, so the two halves of a split picture line up exactly.
 */

export const PER_SLIDE_OPTIONS = [1.5, 2, 2.5, 3];
export const SLIDE_SHAPES = ['4:5', '1:1'];
export const GAP_OPTIONS = [
  { id: 'none', label: 'None', ratio: 0 },
  { id: 'thin', label: 'Thin', ratio: 0.012 },
  { id: 'wide', label: 'Wide', ratio: 0.03 },
];

/** Where one picture's pixels go inside its cell (cover or contain). */
export function cellLayout(image, cw, ch, mode) {
  const W = image.width;
  const H = image.height;
  const contain = mode === 'contain' || (mode === 'smart' && isGraphic(image));
  if (contain) {
    const s = Math.min(cw / W, ch / H);
    const dw = Math.max(1, Math.round(W * s));
    const dh = Math.max(1, Math.round(H * s));
    return {
      strategy: 'pad',
      outW: cw,
      outH: ch,
      crop: { sx: 0, sy: 0, sw: W, sh: H },
      draw: { dx: Math.round((cw - dw) / 2), dy: Math.round((ch - dh) / 2), dw, dh },
    };
  }
  const T = cw / ch;
  const a = W / H;
  const sw = T < a ? H * T : W;
  const sh = T < a ? H : W / T;
  const { x, y } = findBestCrop(image.analysis?.saliency, W, H, sw, sh, image.focus);
  return {
    strategy: 'crop',
    outW: cw,
    outH: ch,
    crop: { sx: x, sy: y, sw, sh },
    draw: { dx: 0, dy: 0, dw: cw, dh: ch },
  };
}

/**
 * @param images ready images in display order
 * @returns null when there is nothing to lay out
 */
export function computeStrip(images, settings) {
  const n = images.length;
  if (!n) return null;
  const k = settings.perSlide;
  const A = FRAME_PRESETS[settings.slideShape];
  const L = Math.min(settings.longEdge, X_RULES.maxLongEdge);
  const frameH = A <= 1 ? L : Math.round(L / A);
  const frameW = Math.round(frameH * A);
  const cellW = frameW / k;
  const frames = Math.max(1, Math.ceil(n / k - 1e-9));
  const gap = Math.round(frameW * (GAP_OPTIONS.find((g) => g.id === settings.gap)?.ratio ?? 0));

  const cells = images.map((image, i) => {
    const x0 = Math.round(i * cellW) + (i > 0 ? Math.floor(gap / 2) : 0);
    const x1 = Math.round((i + 1) * cellW) - (i < n - 1 ? Math.ceil(gap / 2) : 0);
    const cw = Math.max(1, x1 - x0);
    const layout = cellLayout(image, cw, frameH, settings.mode);
    const first = Math.floor(x0 / frameW);
    const last = Math.floor((x0 + cw - 1) / frameW);
    return { id: image.id, image, index: i, x0, x1: x0 + cw, layout, slides: [first, last] };
  });

  // Unused space at the end of the last slide, in pictures.
  const missing = Math.round((frames * k - n) * 100) / 100;

  const slides = Array.from({ length: frames }, (_, f) => {
    const fx0 = f * frameW;
    const fx1 = fx0 + frameW;
    const parts = cells.filter((c) => c.x1 > fx0 && c.x0 < fx1);
    return { index: f, fx0, fx1, cellIds: parts.map((c) => c.id) };
  });

  return { frameW, frameH, aspect: frameW / frameH, perSlide: k, gap, frames, cells, slides, missing };
}

/** Group slides into posts (X allows 4 media per post). */
export function slidesToPosts(strip) {
  const posts = [];
  for (let i = 0; i < strip.slides.length; i += X_RULES.mediaPerPost) {
    posts.push(strip.slides.slice(i, i + X_RULES.mediaPerPost));
  }
  return posts;
}

export function cellKey(cell) {
  const { crop, draw } = cell.layout;
  return [cell.x0, cell.x1, crop.sx, crop.sy, crop.sw, crop.sh, draw.dx, draw.dy, draw.dw, draw.dh]
    .map((v) => Math.round(v))
    .join(',');
}
