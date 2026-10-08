'use client';

import { useRef, useState } from 'react';
import { ACCEPT, MAX_IMAGES } from '@/lib/analyze';
import { LockIcon, UploadIcon } from './icons';

export default function EmptyState({ onFiles, windowDragging }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const active = over || windowDragging;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
      <div className="animate-rise">
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[44px]">
          Make your images ready for X.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
          Resize, crop and prepare up to {MAX_IMAGES} images for X’s current image-post format.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload images"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={() => setOver(false)}
        className={`animate-rise group relative mt-8 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center transition-all duration-200 [animation-delay:60ms] sm:py-20 ${
          active
            ? 'scale-[1.01] border-accent bg-accent/[0.06]'
            : 'border-line-strong bg-panel hover:border-faint hover:bg-raised/60'
        }`}
      >
        <div
          className={`flex size-12 items-center justify-center rounded-xl border transition-all duration-200 ${
            active ? '-translate-y-1 border-accent/50 bg-accent/15 text-accent' : 'border-line-strong bg-raised text-muted group-hover:text-ink'
          }`}
        >
          <UploadIcon size={20} />
        </div>
        <p className="mt-5 text-[15px] font-medium text-ink">{active ? 'Release to add images' : 'Drop images here'}</p>
        <p className="mt-1 text-[13px] text-faint">or</p>
        <span className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-[14px] font-medium text-bg transition group-hover:bg-white">
          Upload images
        </span>
        <p className="mt-5 text-[12.5px] text-muted">
          Up to {MAX_IMAGES} images <span className="px-1 text-faint">•</span> Processed locally{' '}
          <span className="px-1 text-faint">•</span> No account required
        </p>
        <p className="mt-2 font-mono text-[11px] tracking-wider text-faint">JPG • PNG • WEBP</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <section className="animate-rise mt-6 flex items-start gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 [animation-delay:120ms]">
        <LockIcon className="mt-0.5 shrink-0 text-good" />
        <div>
          <p className="text-[13.5px] font-medium text-ink">Your images stay on your device.</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
            PostFit processes your images locally in your browser. Nothing needs to be uploaded to a server.
          </p>
        </div>
      </section>

      <dl className="animate-rise mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line text-[13px] [animation-delay:180ms] sm:grid-cols-3">
        {[
          ['Smart Fit', 'Keeps screenshots, memes and text whole. Never stretches, never upscales.'],
          ['Built for the carousel', 'Previews X’s swipeable layout. 4 images per post, threads beyond that.'],
          ['Ready to post', 'JPG, PNG or WebP under X’s 5 MB limit. Download one by one or as a ZIP.'],
        ].map(([t, d]) => (
          <div key={t} className="bg-panel px-4 py-3.5">
            <dt className="font-medium text-ink">{t}</dt>
            <dd className="mt-1 leading-relaxed text-muted">{d}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[12px] text-faint">Tip: you can also paste screenshots with ⌘V / Ctrl+V.</p>
    </main>
  );
}
