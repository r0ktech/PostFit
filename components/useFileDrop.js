'use client';

import { useEffect, useRef, useState } from 'react';

const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

/**
 * Window-wide file drop + clipboard paste.
 * Returns whether files are currently being dragged over the window.
 */
export function useWindowFileDrop(onFiles, enabled = true) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onFiles);
  cb.current = onFiles;

  useEffect(() => {
    if (!enabled) return;
    const enter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setActive(true);
    };
    const over = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };
    const leave = (e) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      if (e.dataTransfer.files?.length) cb.current(e.dataTransfer.files);
    };
    const paste = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        cb.current(files);
      }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, [enabled]);

  return active;
}
