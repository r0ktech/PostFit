export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export const formatDims = (w, h) => `${w} × ${h}`;

export const pad2 = (n) => String(n).padStart(2, '0');

const RATIOS = [
  [1, 1], [4, 5], [5, 4], [3, 4], [4, 3], [2, 3], [3, 2], [16, 9], [9, 16], [2, 1], [1, 2], [21, 9], [3, 1],
];

/** Human aspect label, e.g. "16:9" or "1.43:1" when it isn't a common ratio. */
export function formatAspect(w, h) {
  const a = w / h;
  for (const [x, y] of RATIOS) if (Math.abs(a / (x / y) - 1) < 0.015) return `${x}:${y}`;
  return a >= 1 ? `${a.toFixed(2)}:1` : `1:${(1 / a).toFixed(2)}`;
}

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
