import { FRAME_PRESETS, X_RULES, clampAspect } from './x-rules';
import { findBestCrop } from './smartcrop';

/**
 * Pure layout math: given an analysed image, its display context on X and the
 * user's settings, decide exactly how the output canvas is built.
 *
 * Returns:
 *  outW/outH   output canvas size (px)
 *  crop        source rectangle {sx, sy, sw, sh} in original pixels
 *  draw        destination rectangle {dx, dy, dw, dh} on the output canvas
 *  strategy    'resize' | 'crop' | 'pad'
 *  frameAspect aspect of the output
 *
 * Images are never stretched: crop and draw rectangles always share an aspect
 * ratio, and the source is never scaled above 100%.
 */

const SAME = 0.012; // ~1.2% aspect difference counts as "same shape"
/** Smart Fit may trim photos by at most this fraction of their area. */
const SMART_TRIM_LIMIT = 0.12;

const ratioOf = (key) => FRAME_PRESETS[key];

function nearestFrame(aspect, keys) {
  let best = keys[0];
  let bestD = Infinity;
  for (const k of keys) {
    const d = Math.abs(Math.log(ratioOf(k) / aspect));
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return ratioOf(best);
}

/** Content kind after applying the user's per-image override. */
export function isGraphic(image) {
  if (image.contentOverride) return image.contentOverride === 'graphic';
  return image.analysis?.kind === 'graphic';
}

export function targetAspect(image, ctx, settings) {
  const a = image.width / image.height;
  if (settings.frame !== 'auto') return ratioOf(settings.frame);
  if (settings.mode === 'smart') return clampAspect(a, ctx.rules);
  return nearestFrame(a, ctx.rules.frames);
}

export function computeLayout(image, ctx, settings) {
  const W = image.width;
  const H = image.height;
  const a = W / H;
  const T = targetAspect(image, ctx, settings);
  const longEdge = Math.min(settings.longEdge, X_RULES.maxLongEdge);

  let strategy;
  if (Math.abs(Math.log(T / a)) < SAME) strategy = 'resize';
  else if (settings.mode === 'crop') strategy = 'crop';
  else if (settings.mode === 'contain') strategy = 'pad';
  else {
    // Smart Fit: text/UI never gets cropped. Photos may lose a sliver at most.
    const keep = T > a ? a / T : T / a; // fraction of area kept when cropping
    strategy = !isGraphic(image) && 1 - keep <= SMART_TRIM_LIMIT ? 'crop' : 'pad';
  }

  if (strategy === 'resize') {
    const s = Math.min(1, longEdge / Math.max(W, H));
    const outW = Math.max(1, Math.round(W * s));
    const outH = Math.max(1, Math.round(H * s));
    return {
      strategy,
      outW,
      outH,
      frameAspect: outW / outH,
      crop: { sx: 0, sy: 0, sw: W, sh: H },
      draw: { dx: 0, dy: 0, dw: outW, dh: outH },
    };
  }

  if (strategy === 'crop') {
    let sw;
    let sh;
    if (T < a) {
      sh = H;
      sw = H * T;
    } else {
      sw = W;
      sh = W / T;
    }
    const { x, y } = findBestCrop(image.analysis?.saliency, W, H, sw, sh, image.focus);
    const s = Math.min(1, longEdge / Math.max(sw, sh));
    const outW = Math.max(1, Math.round(sw * s));
    const outH = Math.max(1, Math.round(sh * s));
    return {
      strategy,
      outW,
      outH,
      frameAspect: outW / outH,
      crop: { sx: x, sy: y, sw, sh },
      draw: { dx: 0, dy: 0, dw: outW, dh: outH },
    };
  }

  // pad: frame of aspect T that fully contains the image
  const frameW = Math.max(W, H * T);
  const frameH = frameW / T;
  const s = Math.min(1, longEdge / Math.max(frameW, frameH));
  const outW = Math.max(1, Math.round(frameW * s));
  const outH = Math.max(1, Math.round(frameH * s));
  // Fit the image inside, preserving its exact aspect.
  const fit = Math.min(outW / W, outH / H);
  const dw = Math.max(1, Math.round(W * fit));
  const dh = Math.max(1, Math.round(H * fit));
  return {
    strategy,
    outW,
    outH,
    frameAspect: outW / outH,
    crop: { sx: 0, sy: 0, sw: W, sh: H },
    draw: { dx: Math.round((outW - dw) / 2), dy: Math.round((outH - dh) / 2), dw, dh },
  };
}

/** Stable key for the parts of a layout that affect the rendered pixels. */
export function layoutKey(layout) {
  const { outW, outH, crop, draw } = layout;
  return [outW, outH, crop.sx, crop.sy, crop.sw, crop.sh, draw.dx, draw.dy, draw.dw, draw.dh]
    .map((n) => Math.round(n))
    .join(',');
}

export const STRATEGY_LABEL = {
  resize: 'Resized',
  crop: 'Smart crop',
  pad: 'Padded',
};
