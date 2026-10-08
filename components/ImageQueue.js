'use client';

import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ACCEPT, MAX_IMAGES } from '@/lib/analyze';
import { formatBytes, formatDims, pad2 } from '@/lib/format';
import { STRATEGY_LABEL } from '@/lib/fit';
import { X_RULES } from '@/lib/x-rules';
import { AlertIcon, CheckIcon, DownloadIcon, PlusIcon, ReplaceIcon, Spinner, TrashIcon } from './icons';

function Status({ image, entry, output, jobItem }) {
  if (image.status === 'analyzing')
    return (
      <span className="inline-flex items-center gap-1 text-faint">
        <Spinner size={11} /> Reading
      </span>
    );
  if (image.status === 'error')
    return (
      <span className="inline-flex items-center gap-1 text-bad">
        <AlertIcon size={11} /> Failed
      </span>
    );
  if (jobItem?.status === 'processing')
    return (
      <span className="inline-flex items-center gap-1 text-accent">
        <Spinner size={11} /> {Math.round(jobItem.progress * 100)}%
      </span>
    );
  if (jobItem?.status === 'waiting') return <span className="text-faint">Waiting</span>;
  if (jobItem?.status === 'error') return <span className="text-bad">Error</span>;
  if (output)
    return (
      <span className="inline-flex items-center gap-1 text-good">
        <CheckIcon size={11} /> Done
      </span>
    );
  if (entry?.cell) return <span className="text-faint">{entry.slides[0] !== entry.slides[1] ? 'Split across slides' : entry.layout.strategy === 'crop' ? 'Fills space' : 'Shown whole'}</span>;
  return <span className="text-faint">{STRATEGY_LABEL[entry?.layout?.strategy] || 'Ready'}</span>;
}

export function ImageCard({ image, entry, output, jobItem, selected, onSelect, onRemove, onReplace, onDownload, dragging, overlay, handleProps }) {
  const replaceRef = useRef(null);
  const layout = entry?.layout;
  const errored = image.status === 'error';
  const seam = entry?.cell ? entry.slides : null; // [firstSlide, lastSlide] in seamless mode
  const sizeAfter = output ? formatBytes(output.size) : entry?.estimate ? `≈${formatBytes(entry.estimate)}` : null;
  const overLimit = (output?.size ?? entry?.estimate ?? 0) > X_RULES.maxFileBytes;

  return (
    <div
      className={`group/card relative flex h-full flex-col overflow-hidden rounded-xl border bg-panel transition-[border-color,box-shadow,opacity] duration-150 ${
        selected ? 'border-accent/70 shadow-[0_0_0_1px_var(--color-accent)]' : 'border-line hover:border-line-strong'
      } ${dragging ? 'opacity-30' : ''} ${overlay ? 'rotate-[1.5deg] scale-[1.03] shadow-2xl shadow-black/60' : ''}`}
    >
      <button
        type="button"
        onClick={() => onSelect?.(image.id)}
        className="relative block aspect-[4/3] w-full cursor-grab touch-manipulation overflow-hidden bg-raised active:cursor-grabbing"
        aria-label={`Select ${image.name}`}
        {...handleProps}
      >
        {image.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.previewUrl} alt="" draggable={false} className="h-full w-full select-none object-cover" />
        ) : errored ? (
          <div className="flex h-full w-full items-center justify-center text-bad/80">
            <AlertIcon size={20} />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint">
            <Spinner size={16} />
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white backdrop-blur">
          {errored ? '—' : pad2(entry ? entry.index + 1 : 0)}
        </span>
        {image.replacing && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
            <Spinner size={16} />
          </span>
        )}
        {jobItem?.status === 'processing' && (
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-black/40">
            <span className="block h-full bg-accent transition-[width] duration-300" style={{ width: `${jobItem.progress * 100}%` }} />
          </span>
        )}
      </button>

      {!overlay && (
        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:opacity-100">
          {output && (
            <button
              type="button"
              onClick={() => onDownload(image.id)}
              className="flex size-6 items-center justify-center rounded-md bg-black/70 text-white backdrop-blur hover:bg-black/90"
              aria-label="Download image"
              title="Download"
            >
              <DownloadIcon size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => replaceRef.current?.click()}
            className="flex size-6 items-center justify-center rounded-md bg-black/70 text-white backdrop-blur hover:bg-black/90"
            aria-label="Replace image"
            title="Replace"
          >
            <ReplaceIcon size={13} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(image.id)}
            className="flex size-6 items-center justify-center rounded-md bg-black/70 text-white backdrop-blur hover:bg-bad"
            aria-label="Remove image"
            title="Remove"
          >
            <TrashIcon size={13} />
          </button>
          <input
            ref={replaceRef}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onReplace(image.id, f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => onSelect?.(image.id)}
        className="flex flex-1 flex-col gap-0.5 px-2 py-1.5 text-left font-mono text-[10.5px] leading-[1.45] tabular-nums"
      >
        {errored ? (
          <span className="line-clamp-3 font-sans text-[11px] leading-snug text-bad/90" title={image.error}>
            {image.error}
          </span>
        ) : (
          <>
            <span className="truncate text-muted">{image.width ? formatDims(image.width, image.height) : '— × —'}</span>
            {seam ? (
              <>
                <span className={`truncate ${seam[0] !== seam[1] ? 'text-accent' : 'text-ink'}`}>
                  {seam[0] === seam[1] ? `→ slide ${pad2(seam[0] + 1)}` : `→ slides ${pad2(seam[0] + 1)}–${pad2(seam[1] + 1)}`}
                </span>
                <span className="truncate text-muted">{formatBytes(image.size)}</span>
              </>
            ) : (
              <>
                <span className="truncate text-ink">{layout ? `→ ${formatDims(layout.outW, layout.outH)}` : '→'}</span>
                <span className={`truncate ${overLimit ? 'text-warn' : 'text-muted'}`}>
                  {formatBytes(image.size)}
                  {sizeAfter ? ` → ${sizeAfter}` : ''}
                </span>
              </>
            )}
          </>
        )}
        <span className="mt-0.5 truncate font-sans text-[11px]">
          <Status image={image} entry={entry} output={output} jobItem={jobItem} />
        </span>
      </button>
    </div>
  );
}

function SortableCard(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.image.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={props.itemClassName}
    >
      <ImageCard {...props} dragging={isDragging} handleProps={{ ...attributes, ...listeners }} />
    </li>
  );
}

export default function ImageQueue({
  images,
  plan,
  outputs,
  job,
  selectedId,
  onSelect,
  onRemove,
  onReplace,
  onMove,
  onAdd,
  onDownload,
  layout = 'grid', // grid | strip
}) {
  const addRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const active = images.find((i) => i.id === activeId);
  const canAdd = images.length < MAX_IMAGES;
  const strip = layout === 'strip';
  const itemClassName = strip ? 'w-[132px] shrink-0' : '';

  const cardProps = (image) => ({
    image,
    entry: plan.byId[image.id],
    output: outputs[image.id],
    jobItem: job?.items?.[image.id],
    selected: image.id === selectedId,
    onSelect,
    onRemove,
    onReplace,
    onDownload,
    itemClassName,
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragEnd={(e) => {
        setActiveId(null);
        if (e.over && e.active.id !== e.over.id) onMove(e.active.id, e.over.id);
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
        <ul
          className={
            strip
              ? 'no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1'
              : 'grid grid-cols-2 gap-2'
          }
          aria-label="Image queue. Drag to reorder."
        >
          {images.map((image) => (
            <SortableCard key={image.id} {...cardProps(image)} />
          ))}
          {canAdd && (
            <li className={itemClassName}>
              <button
                type="button"
                onClick={() => addRef.current?.click()}
                className="flex h-full min-h-[150px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-[12px] text-muted transition hover:border-faint hover:bg-raised/50 hover:text-ink"
              >
                <PlusIcon size={18} />
                Add images
                <span className="font-mono text-[10.5px] text-faint">
                  {images.length}/{MAX_IMAGES}
                </span>
              </button>
              <input
                ref={addRef}
                type="file"
                accept={ACCEPT}
                multiple
                hidden
                onChange={(e) => {
                  onAdd(e.target.files);
                  e.target.value = '';
                }}
              />
            </li>
          )}
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {active ? (
          <div className={strip ? 'w-[132px]' : ''}>
            <ImageCard {...cardProps(active)} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
