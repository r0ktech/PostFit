'use client';

import { useEffect, useState } from 'react';
import { formatBytes, formatDims, pad2 } from '@/lib/format';
import { X_RULES } from '@/lib/x-rules';
import { AlertIcon, ArchiveIcon, CheckIcon, CloseIcon, DownloadIcon, Spinner } from './icons';

function Bar({ progress, status }) {
  const color = status === 'error' ? 'bg-bad' : status === 'done' ? 'bg-good' : 'bg-accent';
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${color} ${status === 'processing' ? 'animate-pulse' : ''}`}
        style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
      />
    </div>
  );
}

const LABEL = { waiting: 'Waiting', processing: 'Processing', done: 'Done', error: 'Failed', skipped: 'Skipped' };

export default function ProcessingSheet({ job, images, outputs, plan, onCancel, onClose, onZip, onDownloadAll, onDownloadOne, zipping }) {
  const [individual, setIndividual] = useState(false);
  useEffect(() => {
    if (!job) setIndividual(false);
  }, [job]);

  useEffect(() => {
    if (!job || job.running) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [job, onClose]);

  if (!job) return null;
  const order = job.order.filter((id) => plan.unitById[id]);
  const items = order.map((id) => {
    const unit = plan.unitById[id];
    return { id, unit, image: images.find((i) => i.id === unit.thumbId), item: job.items[id], output: outputs[id] };
  });
  const what = plan.seamless ? 'slide' : 'image';
  const done = items.filter((x) => x.item?.status === 'done' && x.output).length;
  const failed = items.filter((x) => x.item?.status === 'error').length;
  const finished = !job.running;
  const total = items.reduce((s, x) => s + (x.output?.size || 0), 0);
  const overLimit = items.filter((x) => (x.output?.size || 0) > X_RULES.maxFileBytes).length;
  const overall = items.length ? items.reduce((s, x) => s + (x.item?.progress || 0), 0) / items.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="proc-title">
      <div className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={finished ? onClose : undefined} />
      <div className="animate-rise relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line-strong bg-panel shadow-2xl shadow-black/60 sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {finished ? (
              <h2 id="proc-title" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                {done > 0 ? (
                  <span className="animate-pop flex size-5 items-center justify-center rounded-full bg-good text-bg">
                    <CheckIcon size={13} strokeWidth={2.6} />
                  </span>
                ) : (
                  <AlertIcon className="text-bad" />
                )}
                {job.cancelled ? 'Stopped — ' : ''}
                {done} {what}
                {done === 1 ? '' : 's'} ready
              </h2>
            ) : (
              <h2 id="proc-title" className="text-[15px] font-semibold text-ink">
                {plan.seamless ? 'Building slides…' : 'Preparing images…'}
              </h2>
            )}
            <p className="mt-0.5 font-mono text-[12px] tabular-nums text-muted">
              {finished
                ? `${formatBytes(total)} total${failed ? ` · ${failed} failed` : ''}`
                : `${done} / ${items.length} · ${Math.round(overall * 100)}%`}
            </p>
          </div>
          {finished ? (
            <button onClick={onClose} className="rounded-md p-1.5 text-muted transition hover:bg-hover hover:text-ink" aria-label="Close">
              <CloseIcon />
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="rounded-md border border-line px-2.5 py-1 text-[12.5px] text-muted transition hover:border-line-strong hover:text-ink"
            >
              Cancel
            </button>
          )}
        </header>

        <ol className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto px-5 py-3">
          {items.map(({ id, unit, image, item, output }) => {
            const status = item?.status || 'waiting';
            return (
              <li key={id} className="flex items-center gap-3 py-1">
                <span className="w-5 shrink-0 font-mono text-[12px] tabular-nums text-muted">{pad2(unit.index + 1)}</span>
                {individual && finished ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={output?.url || image?.previewUrl} alt="" className="size-8 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0 flex-1 font-mono text-[11.5px] tabular-nums">
                      <p className="truncate text-ink">{output ? formatDims(output.width, output.height) : '—'}</p>
                      <p className={output?.size > X_RULES.maxFileBytes ? 'text-warn' : 'text-muted'}>{output ? formatBytes(output.size) : item?.error || 'Not ready'}</p>
                    </div>
                    <button
                      disabled={!output}
                      onClick={() => onDownloadOne(id)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] text-ink transition hover:border-line-strong hover:bg-raised disabled:opacity-40"
                    >
                      <DownloadIcon size={13} /> Save
                    </button>
                  </>
                ) : (
                  <>
                    <Bar progress={item?.progress || 0} status={status} />
                    <span
                      className={`flex w-[82px] shrink-0 items-center justify-end gap-1 text-[12px] ${
                        status === 'done' ? 'text-good' : status === 'error' ? 'text-bad' : status === 'processing' ? 'text-accent' : 'text-faint'
                      }`}
                      title={item?.error}
                    >
                      {status === 'processing' && <Spinner size={11} />}
                      {LABEL[status]}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>

        {finished && (
          <footer className="space-y-2 border-t border-line px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {overLimit > 0 && (
              <p className="rounded-md bg-warn/10 px-2.5 py-1.5 text-[12px] text-warn">
                {overLimit} file{overLimit === 1 ? ' is' : 's are'} over X’s 5 MB limit. Lower quality or switch to JPG/WebP.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onZip}
                disabled={!done || zipping}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink text-[13.5px] font-medium text-bg transition hover:bg-white disabled:opacity-50"
              >
                {zipping ? <Spinner size={14} /> : <ArchiveIcon size={15} />}
                {zipping ? 'Zipping…' : 'Download ZIP'}
              </button>
              {individual ? (
                <button
                  onClick={onDownloadAll}
                  disabled={!done}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line-strong text-[13.5px] font-medium text-ink transition hover:bg-raised disabled:opacity-50"
                >
                  <DownloadIcon size={15} /> Download all {done}
                </button>
              ) : (
                <button
                  onClick={() => setIndividual(true)}
                  disabled={!done}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line-strong text-[13.5px] font-medium text-ink transition hover:bg-raised disabled:opacity-50"
                >
                  <DownloadIcon size={15} /> Download individually
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
