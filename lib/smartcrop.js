/**
 * Content-aware crop placement.
 *
 * Analysis produces a small saliency map (edges + saturation + skin tones +
 * faces-ish warm regions). Because PostFit crops only along one axis (the
 * crop always spans the full other dimension), the best window is the one
 * maximising the summed saliency of the rows/columns it covers.
 */

const SAMPLE = 160; // long edge of the analysis sample

/** Build a saliency map from RGBA pixels of a small sample. */
export function computeSaliency(rgba, w, h) {
  const n = w * h;
  const lum = new Float32Array(n);
  const sat = new Float32Array(n);
  const skin = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const alpha = rgba[p + 3] / 255;
    const r = rgba[p] / 255;
    const g = rgba[p + 1] / 255;
    const b = rgba[p + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) * alpha;
    sat[i] = max === 0 ? 0 : ((max - min) / max) * alpha;
    // Simple skin-tone detector in normalised rgb space.
    const sum = r + g + b || 1;
    const rn = r / sum;
    const gn = g / sum;
    skin[i] = rn > 0.36 && rn < 0.5 && gn > 0.28 && gn < 0.36 && max > 0.2 ? alpha : 0;
  }

  const data = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // Sobel edge magnitude
      const xl = x > 0 ? x - 1 : x;
      const xr = x < w - 1 ? x + 1 : x;
      const yu = y > 0 ? y - 1 : y;
      const yd = y < h - 1 ? y + 1 : y;
      const tl = lum[yu * w + xl];
      const tc = lum[yu * w + x];
      const tr = lum[yu * w + xr];
      const ml = lum[y * w + xl];
      const mr = lum[y * w + xr];
      const bl = lum[yd * w + xl];
      const bc = lum[yd * w + x];
      const br = lum[yd * w + xr];
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);
      const edge = Math.min(1, Math.sqrt(gx * gx + gy * gy));
      data[i] = edge * 1.0 + sat[i] * 0.35 + skin[i] * 0.9;
    }
  }
  return { w, h, data };
}

export const SALIENCY_SAMPLE = SAMPLE;

/**
 * Find where a crop of (sw × sh) source pixels should sit inside W × H.
 * `focus` ({x, y} in 0..1) is a user-set focal point and wins when present.
 */
export function findBestCrop(saliency, W, H, sw, sh, focus) {
  const freeX = W - sw > 0.5;
  const freeY = H - sh > 0.5;
  if (!freeX && !freeY) return { x: 0, y: 0 };

  if (focus) {
    const x = freeX ? clamp(focus.x * W - sw / 2, 0, W - sw) : 0;
    const y = freeY ? clamp(focus.y * H - sh / 2, 0, H - sh) : 0;
    return { x, y };
  }

  if (!saliency) {
    return { x: freeX ? (W - sw) / 2 : 0, y: freeY ? (H - sh) / 2 : 0 };
  }

  const { w, h, data } = saliency;
  // Collapse the map onto the free axis.
  const len = freeX ? w : h;
  const profile = new Float64Array(len);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      profile[freeX ? x : y] += data[y * w + x];
    }
  }
  const prefix = new Float64Array(len + 1);
  for (let i = 0; i < len; i++) prefix[i + 1] = prefix[i] + profile[i];
  const total = prefix[len] || 1;

  const win = Math.max(1, Math.round((freeX ? sw / W : sh / H) * len));
  const span = len - win;
  let bestStart = Math.round(span / 2);
  let bestScore = -Infinity;
  for (let s = 0; s <= span; s++) {
    const covered = (prefix[s + win] - prefix[s]) / total;
    // Gentle bias toward the centre, plus slight top bias for portraits
    // (heads and headlines tend to sit high).
    const off = span === 0 ? 0 : s / span - 0.5;
    const bias = freeY ? -0.04 * Math.abs(off + 0.12) : -0.05 * Math.abs(off);
    const score = covered + bias;
    if (score > bestScore) {
      bestScore = score;
      bestStart = s;
    }
  }
  const frac = span === 0 ? 0.5 : bestStart / span;
  return {
    x: freeX ? frac * (W - sw) : 0,
    y: freeY ? frac * (H - sh) : 0,
  };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
