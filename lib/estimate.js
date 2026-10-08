/**
 * Output size estimates before export.
 *
 * Bytes-per-pixel heuristics by format, quality and detected content type.
 * Padding compresses to almost nothing, so only image pixels count fully.
 * Shown with a "≈" — the real number replaces it after processing.
 */

function jpegBpp(q, graphic) {
  const t = Math.max(0, (q - 60) / 40);
  const base = 0.045 + 0.32 * Math.pow(t, 2.4);
  return graphic ? base * 0.3 : base;
}

function bpp(format, quality, graphic) {
  switch (format) {
    case 'png':
      return graphic ? 0.25 : 1.9;
    case 'webp':
      return jpegBpp(quality, graphic) * 0.72;
    case 'jpg':
    default:
      return jpegBpp(quality, graphic);
  }
}

export function estimateBytes(layout, settings, graphic) {
  const contentPx = layout.draw.dw * layout.draw.dh;
  const padPx = layout.outW * layout.outH - contentPx;
  const b = bpp(settings.format, settings.quality, graphic);
  return Math.round(contentPx * b + padPx * 0.004 + 600);
}
