/** Native browser downloads — no server round-trip. */

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start reading before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Several files, spaced out so browsers don't drop rapid-fire downloads. */
export async function downloadSequential(entries, onEach) {
  for (let i = 0; i < entries.length; i++) {
    downloadBlob(entries[i].blob, entries[i].name);
    onEach?.(i);
    if (i < entries.length - 1) await wait(350);
  }
}

/** Zip without recompression — images are already compressed. */
export async function downloadZip(entries, onProgress) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const e of entries) zip.file(e.name, e.blob, { binary: true });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true }, (meta) =>
    onProgress?.(meta.percent / 100)
  );
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(
    d.getHours()
  ).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  downloadBlob(blob, `postfit-${stamp}.zip`);
}
