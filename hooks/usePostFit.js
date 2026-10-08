'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeFile, ImageError, MAX_IMAGES } from '@/lib/analyze';
import { computeLayout, isGraphic, layoutKey } from '@/lib/fit';
import { estimateBytes } from '@/lib/estimate';
import { createStripRenderer, outputName, renderImage, resolveBackground, slideName } from '@/lib/render';
import { cellKey, computeStrip } from '@/lib/strip';
import { contextForIndex, X_RULES } from '@/lib/x-rules';
import { canEncodeWebP } from '@/lib/canvas';
import { uid } from '@/lib/format';

export const DEFAULT_SETTINGS = {
  mode: 'smart', // smart | crop | contain
  format: 'jpg', // jpg | png | webp
  quality: 90,
  background: 'white', // white | black | transparent | custom
  customColor: '#1d9bf0',
  frame: 'auto', // auto | 4:5 | 1:1 | 16:9
  longEdge: 2048,
  perPost: X_RULES.mediaPerPost,
  layout: 'seamless', // seamless | separate
  perSlide: 2.5, // pictures per slide in seamless mode
  slideShape: '1:1', // 4:5 | 1:1
  gap: 'none', // none | thin | wide
};

function limiter(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

const lowPower = () =>
  typeof navigator !== 'undefined' &&
  (navigator.maxTouchPoints > 1 || (navigator.deviceMemory && navigator.deviceMemory <= 4));

export function usePostFit({ notify }) {
  const [images, setImages] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [selectedId, setSelectedId] = useState(null);
  const [outputs, setOutputs] = useState({}); // id -> { key, blob, url, size, width, height }
  const [job, setJob] = useState(null); // { running, order, items: { id: {status, progress, error} }, cancelled }
  const [webp, setWebp] = useState(true);

  const imagesRef = useRef(images);
  imagesRef.current = images;
  const outputsRef = useRef(outputs);
  outputsRef.current = outputs;
  const analyzeQueue = useRef(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    analyzeQueue.current = limiter(lowPower() ? 1 : 2);
    setWebp(canEncodeWebP());
  }, []);

  const patchImage = useCallback((id, patch) => {
    setImages((list) => list.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  }, []);

  /* ---------------------------- analysis ---------------------------- */

  // Failed files are reported together, so a bad batch is one toast, not ten.
  const failures = useRef([]);
  const failTimer = useRef(null);
  const reportFailure = useCallback(
    (name, message) => {
      failures.current.push({ name, message });
      clearTimeout(failTimer.current);
      failTimer.current = setTimeout(() => {
        const list = failures.current;
        failures.current = [];
        if (list.length === 1) {
          notify({ tone: 'error', title: `${list[0].name} wasn’t added`, body: list[0].message });
        } else {
          const lines = list.slice(0, 3).map((f) => `${f.name} — ${f.message}`);
          if (list.length > 3) lines.push(`…and ${list.length - 3} more`);
          notify({ tone: 'error', title: `${list.length} files weren’t added`, body: lines.join('\n'), duration: 8000 });
        }
      }, 300);
    },
    [notify]
  );

  const dropImage = useCallback((id) => {
    imagesRef.current = imagesRef.current.filter((i) => i.id !== id);
    setImages((list) => list.filter((i) => i.id !== id));
    setSelectedId((cur) => (cur === id ? imagesRef.current[0]?.id ?? null : cur));
  }, []);

  const runAnalysis = useCallback(
    (id, file) =>
      analyzeQueue.current(async () => {
        try {
          const res = await analyzeFile(file);
          // The image may have been removed/replaced while we worked.
          const still = imagesRef.current.find((i) => i.id === id && i.file === file);
          if (!still) return;
          const previewUrl = URL.createObjectURL(res.previewBlob);
          patchImage(id, {
            status: 'ready',
            width: res.width,
            height: res.height,
            type: res.type,
            previewUrl,
            analysis: res.analysis,
            error: null,
          });
        } catch (err) {
          const still = imagesRef.current.find((i) => i.id === id && i.file === file);
          if (!still) return;
          dropImage(id);
          reportFailure(file.name, err instanceof ImageError ? err.message : 'This image couldn’t be opened.');
        }
      }),
    [dropImage, patchImage, reportFailure]
  );

  const addFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList || []).filter((f) => f && f.size !== undefined);
      if (!files.length) return;
      const room = MAX_IMAGES - imagesRef.current.length;
      if (room <= 0) {
        notify({ tone: 'error', title: 'Limit reached', body: `PostFit handles up to ${MAX_IMAGES} images at once. Remove some to add more.` });
        return;
      }
      const accepted = files.slice(0, room);
      if (files.length > room) {
        notify({
          tone: 'warn',
          title: `Only ${room} more image${room === 1 ? '' : 's'} added`,
          body: `${files.length - room} file${files.length - room === 1 ? ' was' : 's were'} skipped — the limit is ${MAX_IMAGES} images.`,
        });
      }
      const entries = accepted.map((file) => ({
        id: uid(),
        file,
        name: file.name || 'image',
        size: file.size,
        status: 'analyzing',
        width: 0,
        height: 0,
        previewUrl: null,
        analysis: null,
        contentOverride: null,
        focus: null,
        error: null,
      }));
      setImages((list) => [...list, ...entries]);
      imagesRef.current = [...imagesRef.current, ...entries];
      setSelectedId((cur) => cur ?? entries[0].id);
      entries.forEach((e) => runAnalysis(e.id, e.file));
    },
    [notify, runAnalysis]
  );

  const revokeFor = useCallback((img) => {
    if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
    const out = outputsRef.current[img?.id];
    if (out?.url) URL.revokeObjectURL(out.url);
  }, []);

  const removeImage = useCallback(
    (id) => {
      const img = imagesRef.current.find((i) => i.id === id);
      if (!img) return;
      revokeFor(img);
      setOutputs((o) => {
        if (!o[id]) return o;
        const { [id]: _, ...rest } = o;
        return rest;
      });
      setImages((list) => list.filter((i) => i.id !== id));
      setSelectedId((cur) => {
        if (cur !== id) return cur;
        const list = imagesRef.current;
        const idx = list.findIndex((i) => i.id === id);
        const next = list[idx + 1] || list[idx - 1];
        return next ? next.id : null;
      });
    },
    [revokeFor]
  );

  const replaceImage = useCallback(
    (id, file) => {
      const img = imagesRef.current.find((i) => i.id === id);
      if (!img || !file) return;
      patchImage(id, { replacing: true });
      analyzeQueue.current(async () => {
        try {
          const res = await analyzeFile(file);
          const current = imagesRef.current.find((i) => i.id === id);
          if (!current) return;
          revokeFor(current);
          setOutputs((o) => {
            if (!o[id]) return o;
            const { [id]: _, ...rest } = o;
            return rest;
          });
          patchImage(id, {
            file,
            name: file.name || 'image',
            size: file.size,
            status: 'ready',
            replacing: false,
            width: res.width,
            height: res.height,
            type: res.type,
            previewUrl: URL.createObjectURL(res.previewBlob),
            analysis: res.analysis,
            contentOverride: null,
            focus: null,
            error: null,
          });
        } catch (err) {
          patchImage(id, { replacing: false });
          notify({
            tone: 'error',
            title: `Couldn’t replace with ${file.name}`,
            body: `${err instanceof ImageError ? err.message : 'This image couldn’t be opened.'} The original was kept.`,
          });
        }
      });
    },
    [notify, patchImage, revokeFor]
  );

  const moveImage = useCallback((fromId, toId) => {
    setImages((list) => {
      const from = list.findIndex((i) => i.id === fromId);
      const to = list.findIndex((i) => i.id === toId);
      if (from < 0 || to < 0 || from === to) return list;
      const next = list.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    cancelRef.current = true;
    imagesRef.current.forEach(revokeFor);
    setImages([]);
    setOutputs({});
    setJob(null);
    setSelectedId(null);
  }, [revokeFor]);

  const updateSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  /* --------------------------- derived plan -------------------------- */

  const plan = useMemo(() => {
    const valid = images.filter((i) => i.status !== 'error' && i.status !== 'analyzing');
    const ordered = images.filter((i) => i.status !== 'error');
    const total = ordered.length;
    const bg = resolveBackground(settings);
    const suffix = `${settings.format}|${settings.quality}|${bg}`;
    const byId = {};
    let units = [];
    let strip = null;

    if (settings.layout === 'seamless') {
      strip = computeStrip(valid, settings);
      const cellById = {};
      strip?.cells.forEach((c) => (cellById[c.id] = c));
      ordered.forEach((img, index) => {
        const cell = cellById[img.id];
        byId[img.id] = cell
          ? { index, cell, layout: cell.layout, graphic: isGraphic(img), slides: cell.slides }
          : { index };
      });
      units = (strip?.slides || []).map((slide) => {
        const cells = strip.cells.filter((c) => slide.cellIds.includes(c.id));
        const graphic = cells.every((c) => isGraphic(c.image));
        const frame = { outW: strip.frameW, outH: strip.frameH, draw: { dw: strip.frameW, dh: strip.frameH } };
        return {
          id: `slide-${slide.index}`,
          kind: 'slide',
          index: slide.index,
          slide,
          name: slideName(slide.index, settings.format),
          thumbId: cells[0]?.id,
          key: `${strip.frameW}x${strip.frameH}|${slide.fx0}|${cells.map((c) => `${c.id}:${cellKey(c)}`).join(';')}|${suffix}`,
          estimate: estimateBytes(frame, settings, graphic),
        };
      });
    } else {
      ordered.forEach((img, index) => {
        const ctx = contextForIndex(index, total, settings.perPost);
        if (img.status === 'analyzing') {
          byId[img.id] = { index, ctx };
          return;
        }
        const layout = computeLayout(img, ctx, settings);
        const graphic = isGraphic(img);
        byId[img.id] = {
          index,
          ctx,
          layout,
          graphic,
          key: `${layoutKey(layout)}|${suffix}`,
          estimate: estimateBytes(layout, settings, graphic),
        };
      });
      units = valid
        .map((img) => ({
          id: img.id,
          kind: 'image',
          index: byId[img.id].index,
          image: img,
          name: outputName(img, byId[img.id].index, settings.format),
          thumbId: img.id,
          key: byId[img.id].key,
          estimate: byId[img.id].estimate,
        }))
        .sort((a, b) => a.index - b.index);
    }
    const unitById = Object.fromEntries(units.map((u) => [u.id, u]));
    return { byId, ordered, valid, total, background: bg, strip, units, unitById, seamless: settings.layout === 'seamless' };
  }, [images, settings]);

  // Drop outputs that no longer match the current plan (order/settings changed).
  useEffect(() => {
    const stale = Object.entries(outputs).filter(([id, out]) => plan.unitById[id]?.key !== out.key);
    if (!stale.length) return;
    stale.forEach(([, out]) => URL.revokeObjectURL(out.url));
    setOutputs((o) => {
      const next = { ...o };
      stale.forEach(([id]) => delete next[id]);
      return next;
    });
  }, [plan, outputs]);

  // Revoke everything on unmount.
  useEffect(
    () => () => {
      imagesRef.current.forEach((img) => img.previewUrl && URL.revokeObjectURL(img.previewUrl));
      Object.values(outputsRef.current).forEach((o) => URL.revokeObjectURL(o.url));
    },
    []
  );

  /* ---------------------------- processing --------------------------- */

  const processAll = useCallback(async () => {
    const targets = plan.units;
    if (!targets.length) return;
    cancelRef.current = false;
    const snapshotSettings = settings;
    const items = {};
    targets.forEach((u) => {
      const fresh = outputsRef.current[u.id]?.key === u.key;
      items[u.id] = { status: fresh ? 'done' : 'waiting', progress: fresh ? 1 : 0 };
    });
    setJob({ running: true, order: targets.map((t) => t.id), items, startedAt: Date.now() });

    const setItem = (id, patch) =>
      setJob((j) => (j ? { ...j, items: { ...j.items, [id]: { ...j.items[id], ...patch } } } : j));
    const stageProgress = { decode: 0.2, resize: 0.55, encode: 0.85 };

    const runUnit = async (u, render) => {
      if (cancelRef.current || items[u.id].status === 'done') return;
      setItem(u.id, { status: 'processing', progress: 0.06 });
      try {
        const res = await render((stage) => setItem(u.id, { progress: stageProgress[stage] ?? 0.5 }));
        if (cancelRef.current) return;
        const url = URL.createObjectURL(res.blob);
        setOutputs((o) => {
          if (o[u.id]?.url) URL.revokeObjectURL(o[u.id].url);
          return { ...o, [u.id]: { ...res, url, key: u.key } };
        });
        setItem(u.id, { status: 'done', progress: 1 });
      } catch (err) {
        const message = err?.message || 'Processing failed.';
        setItem(u.id, { status: 'error', progress: 1, error: message });
        notify({ tone: 'error', title: u.kind === 'slide' ? `Slide ${u.index + 1}` : u.image.name, body: message });
      }
    };

    if (plan.seamless) {
      // Slides share split pictures, so render them in order with one cache.
      const renderer = createStripRenderer(plan.strip, snapshotSettings);
      try {
        for (const u of targets) await runUnit(u, (onStage) => renderer.renderSlide(u.index, onStage));
      } finally {
        renderer.dispose();
      }
    } else {
      const run = limiter(lowPower() ? 1 : 2);
      await Promise.all(
        targets.map((u) =>
          run(() => runUnit(u, (onStage) => renderImage(u.image, plan.byId[u.id].layout, snapshotSettings, onStage)))
        )
      );
    }
    setJob((j) => (j ? { ...j, running: false, cancelled: cancelRef.current } : j));
  }, [notify, plan, settings]);

  const cancelJob = useCallback(() => {
    cancelRef.current = true;
    setJob((j) => {
      if (!j) return j;
      const items = {};
      for (const [id, it] of Object.entries(j.items)) {
        items[id] = it.status === 'done' || it.status === 'error' ? it : { ...it, status: 'skipped', progress: 0 };
      }
      return { ...j, items, running: false, cancelled: true };
    });
  }, []);

  const closeJob = useCallback(() => setJob(null), []);

  return {
    images,
    settings,
    updateSettings,
    selectedId,
    setSelectedId,
    outputs,
    plan,
    job,
    webp,
    addFiles,
    removeImage,
    replaceImage,
    moveImage,
    patchImage,
    clearAll,
    processAll,
    cancelJob,
    closeJob,
  };
}
