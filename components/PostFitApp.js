'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePostFit } from '@/hooks/usePostFit';
import { MAX_IMAGES } from '@/lib/analyze';
import { downloadBlob, downloadSequential, downloadZip } from '@/lib/download';
import { formatBytes } from '@/lib/format';
import EmptyState from './EmptyState';
import ImageQueue from './ImageQueue';
import ProcessingSheet from './ProcessingSheet';
import SettingsPanel from './SettingsPanel';
import XPreview from './XPreview';
import { ToastProvider, useNotify } from './Toasts';
import { useWindowFileDrop } from './useFileDrop';
import { ArchiveIcon, DownloadIcon, LockIcon, Logo, Spinner, UploadIcon } from './icons';

function Header({ hasImages, onClear }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur sm:px-5">
      <div className="flex items-center gap-2.5">
        <Logo />
        <span className="text-[14.5px] font-semibold tracking-[-0.01em]">PostFit</span>
        <span className="hidden rounded border border-line px-1.5 py-px font-mono text-[10.5px] text-faint sm:inline">for X</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted"
          title="PostFit processes your images locally in your browser. Nothing is uploaded."
        >
          <LockIcon size={12} className="text-good" />
          <span className="hidden sm:inline">Your images stay on your device</span>
          <span className="sm:hidden">Local only</span>
        </span>
        {hasImages && (
          <button
            onClick={onClear}
            className="rounded-md px-2 py-1 text-[12.5px] text-muted transition hover:bg-hover hover:text-ink"
          >
            Clear all
          </button>
        )}
      </div>
    </header>
  );
}

function Actions({ canProcess, running, readyCount, doneCount, allFresh, analyzing, onProcess, onZip, onFiles, zipping, compact }) {
  return (
    <div className="space-y-2">
      <button
        onClick={onProcess}
        disabled={!canProcess}
        className="relative inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] transition hover:bg-accent-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-raised disabled:text-faint disabled:shadow-none"
      >
        {running ? (
          <>
            <Spinner size={15} /> Resizing…
          </>
        ) : analyzing ? (
          <>
            <Spinner size={15} /> Reading images…
          </>
        ) : (
          <>
            Resize all
            {readyCount > 0 && <span className="rounded bg-white/15 px-1.5 py-px font-mono text-[11.5px]">{readyCount}</span>}
          </>
        )}
      </button>
      {doneCount > 0 && !running && (
        <div className={`animate-rise grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2'}`}>
          <button
            onClick={onZip}
            disabled={zipping}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong text-[12.5px] font-medium text-ink transition hover:bg-raised disabled:opacity-50"
          >
            {zipping ? <Spinner size={13} /> : <ArchiveIcon size={14} />} ZIP{allFresh ? '' : ` (${doneCount})`}
          </button>
          <button
            onClick={onFiles}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong text-[12.5px] font-medium text-ink transition hover:bg-raised"
          >
            <DownloadIcon size={14} /> All files
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const notify = useNotify();
  const pf = usePostFit({ notify });
  const { images, settings, plan, outputs, job, selectedId } = pf;
  const [zipping, setZipping] = useState(false);
  const dragging = useWindowFileDrop(pf.addFiles, !job?.running);

  const ordered = plan.ordered; // valid + analyzing, in display order
  const analyzing = images.some((i) => i.status === 'analyzing' || i.replacing);
  const units = plan.units; // what gets exported: images, or slides in seamless mode
  const readyCount = units.length;
  const fresh = (u) => outputs[u.id]?.key === u.key;
  const doneCount = units.filter(fresh).length;
  const allFresh = readyCount > 0 && doneCount === readyCount;
  const canProcess = readyCount > 0 && !analyzing && !job?.running;
  const noun = plan.seamless ? 'slide' : 'img';

  const selected = images.find((i) => i.id === selectedId) || null;
  const totalEstimate = units.reduce((s, u) => s + (outputs[u.id]?.size ?? u.estimate ?? 0), 0);
  const summary = readyCount ? `${readyCount} ${noun}${readyCount === 1 || noun === 'img' ? '' : 's'} · ≈${formatBytes(totalEstimate)}` : '';

  const entries = useCallback(
    () => plan.units.filter((u) => outputs[u.id]?.key === u.key).map((u) => ({ blob: outputs[u.id].blob, name: u.name })),
    [outputs, plan]
  );

  const downloadOne = useCallback(
    (id) => {
      const u = plan.unitById[id];
      const out = outputs[id];
      if (!u || !out || out.key !== u.key) return;
      downloadBlob(out.blob, u.name);
    },
    [outputs, plan]
  );

  const downloadAll = useCallback(async () => {
    const list = entries();
    if (!list.length) return;
    if (list.length > 1) notify({ tone: 'info', title: `Downloading ${list.length} files`, body: 'If your browser asks, allow multiple downloads.' });
    await downloadSequential(list);
  }, [entries, notify]);

  const zipAll = useCallback(async () => {
    const list = entries();
    if (!list.length) return;
    setZipping(true);
    try {
      await downloadZip(list);
      notify({ tone: 'success', title: 'ZIP downloaded', body: `${list.length} file${list.length === 1 ? '' : 's'} in posting order.` });
    } catch {
      notify({ tone: 'error', title: 'Couldn’t create the ZIP', body: 'The browser ran out of memory. Try “Download individually”.' });
    } finally {
      setZipping(false);
    }
  }, [entries, notify]);

  const queueProps = {
    images,
    plan,
    outputs,
    job,
    selectedId,
    onSelect: pf.setSelectedId,
    onRemove: pf.removeImage,
    onReplace: pf.replaceImage,
    onMove: pf.moveImage,
    onAdd: pf.addFiles,
    onDownload: downloadOne,
  };

  const actionProps = {
    canProcess,
    running: !!job?.running,
    readyCount,
    doneCount,
    allFresh,
    analyzing,
    onProcess: pf.processAll,
    onZip: zipAll,
    onFiles: downloadAll,
    zipping,
  };

  const settingsProps = {
    settings,
    update: pf.updateSettings,
    webp: pf.webp,
    selected,
    selectedEntry: selected ? plan.byId[selected.id] : null,
    selectedOutput: selected && plan.unitById[selected.id] && outputs[selected.id]?.key === plan.unitById[selected.id].key ? outputs[selected.id] : null,
    plan,
    onPatchImage: pf.patchImage,
    summary,
  };

  if (!images.length) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Header hasImages={false} />
        <EmptyState onFiles={pf.addFiles} windowDragging={dragging} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <Header
        hasImages
        onClear={() => {
          if (images.length < 2 || window.confirm(`Remove all ${images.length} images?`)) pf.clearAll();
        }}
      />

      {/* Desktop: queue | preview | settings. Mobile: stacked. */}
      <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(300px,340px)]">
        {/* Preview — first on mobile, centre on desktop */}
        <main className="order-1 min-w-0 px-4 pb-6 pt-4 sm:px-6 lg:order-2 lg:overflow-y-auto lg:px-8 lg:pt-6 lg:scrollbar-thin">
          {ordered.length ? (
            <XPreview items={ordered} plan={plan} settings={settings} selectedId={selectedId} onSelect={pf.setSelectedId} />
          ) : (
            <div className="flex h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-line text-center text-[13px] text-muted">
              None of these files could be opened.
              <span className="mt-1 text-faint">Remove them and add JPG, PNG or WebP images.</span>
            </div>
          )}
        </main>

        {/* Image queue */}
        <aside className="order-2 border-t border-line px-4 py-4 lg:order-1 lg:overflow-y-auto lg:border-r lg:border-t-0 lg:scrollbar-thin">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-medium text-ink">
              Images <span className="ml-1 font-mono text-[11.5px] text-faint">{images.length}/{MAX_IMAGES}</span>
            </h2>
            <span className="text-[11.5px] text-faint">
              <span className="lg:hidden">Hold &amp; drag to reorder</span>
              <span className="hidden lg:inline">Drag to reorder</span>
            </span>
          </div>
          <div className="lg:hidden">
            <ImageQueue {...queueProps} layout="strip" />
          </div>
          <div className="hidden lg:block">
            <ImageQueue {...queueProps} layout="grid" />
          </div>
        </aside>

        {/* Settings */}
        <aside className="order-3 flex min-h-0 flex-col border-t border-line pb-32 lg:border-l lg:border-t-0 lg:pb-0">
          <h2 className="px-4 pt-4 text-[13px] font-medium text-ink lg:sr-only">Settings</h2>
          <div className="min-h-0 flex-1 lg:overflow-y-auto lg:scrollbar-thin">
            <SettingsPanel {...settingsProps} />
          </div>
          <div className="hidden border-t border-line bg-panel p-4 lg:block">
            <Actions {...actionProps} />
          </div>
        </aside>
      </div>

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:hidden">
        <Actions {...actionProps} compact />
      </div>

      {dragging && (
        <div className="animate-fade-in pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-bg/80 p-6 backdrop-blur-sm">
          <div className="animate-pop flex flex-col items-center rounded-2xl border border-dashed border-accent bg-accent/[0.06] px-12 py-10 text-center">
            <UploadIcon size={22} className="text-accent" />
            <p className="mt-3 text-[15px] font-medium text-ink">Drop to add images</p>
            <p className="mt-1 text-[12.5px] text-muted">
              {Math.max(0, MAX_IMAGES - images.length)} of {MAX_IMAGES} slots left
            </p>
          </div>
        </div>
      )}

      <ProcessingSheet
        job={job}
        images={images}
        outputs={outputs}
        plan={plan}
        onCancel={pf.cancelJob}
        onClose={pf.closeJob}
        onZip={zipAll}
        onDownloadAll={downloadAll}
        onDownloadOne={downloadOne}
        zipping={zipping}
      />
    </div>
  );
}

export default function PostFitApp() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
