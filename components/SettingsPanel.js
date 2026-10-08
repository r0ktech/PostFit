'use client';

import { useRef } from 'react';
import { FORMATS } from '@/lib/render';
import { FRAME_OPTIONS, LONG_EDGE_OPTIONS, X_RULES, xDisplay } from '@/lib/x-rules';
import { STRATEGY_LABEL, isGraphic } from '@/lib/fit';
import { formatAspect, formatBytes, formatDims, pad2 } from '@/lib/format';
import { ContainIcon, CropIcon, SmartIcon, TargetIcon } from './icons';
import { GAP_OPTIONS, PER_SLIDE_OPTIONS, SLIDE_SHAPES } from '@/lib/strip';

export function Section({ title, aside, children, className = '' }) {
  return (
    <section className={`border-b border-line px-4 py-4 last:border-b-0 ${className}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-faint">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Segmented({ value, onChange, options, label, size = 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-lg border border-line bg-bg p-0.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.id)}
            className={`flex flex-1 flex-col items-center justify-center rounded-md px-2 transition ${size === 'sm' ? 'h-7' : 'h-8'} ${
              on ? 'bg-raised text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-muted hover:text-ink'
            } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-muted`}
          >
            <span className="text-[12.5px] font-medium leading-none">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const MODES = [
  { id: 'smart', icon: SmartIcon, title: 'Smart Fit', tag: 'Recommended', desc: 'Keeps text and screenshots whole. Fits each image to X’s safe shape.', seamlessDesc: 'Photos fill their space with a smart crop; screenshots and text stay whole.' },
  { id: 'crop', icon: CropIcon, title: 'Crop', desc: 'Fills the frame. Content-aware crop keeps the subject in view.', seamlessDesc: 'Every picture fills its space. Content-aware crop keeps the subject in view.' },
  { id: 'contain', icon: ContainIcon, title: 'Contain', desc: 'Keeps the entire image and pads to the frame.', seamlessDesc: 'Every picture is shown whole, padded with the background.' },
];

const BACKGROUNDS = [
  { id: 'white', label: 'White', swatch: '#ffffff' },
  { id: 'black', label: 'Black', swatch: '#000000' },
  { id: 'transparent', label: 'Transparent', swatch: null },
  { id: 'custom', label: 'Custom', swatch: 'custom' },
];

function Row({ k, children, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-[12.5px] text-muted">{k}</dt>
      <dd className={`min-w-0 truncate text-right font-mono text-[12px] tabular-nums ${tone || 'text-ink'}`}>{children}</dd>
    </div>
  );
}

function FocusPicker({ image, entry, onFocus }) {
  const ref = useRef(null);
  const { crop } = entry.layout;
  const pick = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onFocus({ x, y });
  };
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
          <TargetIcon size={13} /> Crop focus
        </span>
        {image.focus ? (
          <button type="button" onClick={() => onFocus(null)} className="text-[12px] text-accent hover:text-accent-strong">
            Reset to auto
          </button>
        ) : (
          <span className="text-[11.5px] text-faint">Auto · click to adjust</span>
        )}
      </div>
      <div
        ref={ref}
        onPointerDown={pick}
        className="relative cursor-crosshair overflow-hidden rounded-lg border border-line bg-raised"
        style={{ aspectRatio: `${image.width} / ${image.height}`, maxHeight: 220, marginInline: 'auto' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.previewUrl} alt="" draggable={false} className="h-full w-full select-none object-contain opacity-40" />
        <div
          className="absolute overflow-hidden border border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-all duration-200"
          style={{
            left: `${(crop.sx / image.width) * 100}%`,
            top: `${(crop.sy / image.height) * 100}%`,
            width: `${(crop.sw / image.width) * 100}%`,
            height: `${(crop.sh / image.height) * 100}%`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              left: `${(-crop.sx / crop.sw) * 100}%`,
              top: `${(-crop.sy / crop.sh) * 100}%`,
              width: `${(image.width / crop.sw) * 100}%`,
              height: `${(image.height / crop.sh) * 100}%`,
            }}
          />
        </div>
        {image.focus && (
          <span
            className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow"
            style={{ left: `${image.focus.x * 100}%`, top: `${image.focus.y * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function ContentControl({ image, onPatch, seamless }) {
  const graphic = isGraphic(image);
  const detected = image.analysis?.kind === 'graphic' ? 'Graphic' : 'Photo';
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12.5px] text-muted">Content</span>
        <span className="text-[11.5px] text-faint">Detected: {detected}</span>
      </div>
      <Segmented
        size="sm"
        label="Content type"
        value={image.contentOverride || 'auto'}
        onChange={(v) => onPatch(image.id, { contentOverride: v === 'auto' ? null : v })}
        options={[
          { id: 'auto', label: 'Auto' },
          { id: 'photo', label: 'Photo' },
          { id: 'graphic', label: 'Text / UI' },
        ]}
      />
      <p className="mt-1.5 text-[11.5px] leading-snug text-faint">
        {graphic
          ? 'Treated as text/UI — Smart Fit never crops it.'
          : seamless
            ? 'Treated as a photo — Smart Fit fills its space with a content-aware crop.'
            : 'Treated as a photo — Smart Fit may trim a sliver to fit.'}
      </p>
    </div>
  );
}

function SeamlessDetails({ image, entry, settings, onPatch }) {
  const { cell, layout } = entry;
  const [a, b] = cell.slides;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 text-[12.5px]">
        <span className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] text-ink">{pad2(entry.index + 1)}</span>
        <span className="truncate text-ink" title={image.name}>
          {image.name}
        </span>
      </p>
      <dl>
        <Row k="Original">
          {formatDims(image.width, image.height)} · {formatAspect(image.width, image.height)}
        </Row>
        <Row k="File">
          {image.type?.split('/')[1]?.toUpperCase().replace('JPEG', 'JPG')} · {formatBytes(image.size)}
        </Row>
        <Row k="Space in strip">{formatDims(layout.outW, layout.outH)}</Row>
        <Row k="Handling">{layout.strategy === 'crop' ? 'Fills its space' : 'Shown whole'}</Row>
        <Row k="Slides" tone={a !== b ? 'text-accent' : undefined}>
          {a === b ? `Slide ${a + 1}` : `Split: slide ${a + 1} → ${b + 1}`}
        </Row>
        <Row k="Post">
          Post {Math.floor(a / X_RULES.mediaPerPost) + 1}
          {Math.floor(a / X_RULES.mediaPerPost) !== Math.floor(b / X_RULES.mediaPerPost) ? ` → ${Math.floor(b / X_RULES.mediaPerPost) + 1}` : ''}
        </Row>
      </dl>
      {Math.floor(a / X_RULES.mediaPerPost) !== Math.floor(b / X_RULES.mediaPerPost) && (
        <p className="mt-2 rounded-md bg-warn/10 px-2.5 py-1.5 text-[12px] leading-snug text-warn">
          This picture is split between two posts (X allows {X_RULES.mediaPerPost} slides per post), so the halves won’t
          sit side by side. Change “Pictures per slide” or reorder to avoid it.
        </p>
      )}
      <ContentControl image={image} onPatch={onPatch} seamless />
      {layout.strategy === 'crop' && <FocusPicker image={image} entry={entry} onFocus={(focus) => onPatch(image.id, { focus })} />}
    </div>
  );
}

function SelectedDetails({ image, entry, output, settings, onPatch }) {
  if (!image) {
    return <p className="text-[12.5px] text-faint">Select an image to see its details.</p>;
  }
  if (image.status === 'error') {
    return (
      <div className="text-[12.5px]">
        <p className="truncate font-medium text-ink">{image.name}</p>
        <p className="mt-1 leading-relaxed text-bad">{image.error}</p>
      </div>
    );
  }
  if (image.status === 'analyzing' || !entry?.layout) {
    return <p className="text-[12.5px] text-faint">Reading {image.name}…</p>;
  }
  if (entry.cell) return <SeamlessDetails image={image} entry={entry} settings={settings} onPatch={onPatch} />;
  const { layout, ctx } = entry;
  const disp = xDisplay(layout.outW / layout.outH, ctx.kind);
  const bytes = output ? output.size : entry.estimate;
  const over = bytes > X_RULES.maxFileBytes;
  const fmt = FORMATS[settings.format];
  const alphaLost = image.analysis?.hasAlpha && !fmt.alpha;

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 text-[12.5px]">
        <span className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] text-ink">{pad2(entry.index + 1)}</span>
        <span className="truncate text-ink" title={image.name}>
          {image.name}
        </span>
      </p>
      <dl>
        <Row k="Original">
          {formatDims(image.width, image.height)} · {formatAspect(image.width, image.height)}
        </Row>
        <Row k="File">
          {image.type?.split('/')[1]?.toUpperCase().replace('JPEG', 'JPG')} · {formatBytes(image.size)}
        </Row>
        <Row k="Output">
          {formatDims(layout.outW, layout.outH)} · {formatAspect(layout.outW, layout.outH)}
        </Row>
        <Row k="Handling">{STRATEGY_LABEL[layout.strategy]}</Row>
        <Row k={output ? 'File size' : 'Est. size'} tone={over ? 'text-warn' : undefined}>
          {output ? '' : '≈ '}
          {formatBytes(bytes)} {fmt.label}
        </Row>
        <Row k="On X" tone={disp.cropped ? 'text-warn' : 'text-good'}>
          {disp.cropped ? 'Edges cropped by X' : 'Shown in full'}
        </Row>
        <Row k="Position">
          Post {ctx.postIndex + 1} · {ctx.kind === 'single' ? 'single image' : `slide ${ctx.slot + 1} of ${ctx.count}`}
        </Row>
      </dl>
      {over && (
        <p className="mt-2 rounded-md bg-warn/10 px-2.5 py-1.5 text-[12px] leading-snug text-warn">
          Over X’s 5 MB image limit. Lower the quality, use JPG/WebP, or pick a smaller size.
        </p>
      )}
      {alphaLost && (
        <p className="mt-2 rounded-md bg-raised px-2.5 py-1.5 text-[12px] leading-snug text-muted">
          JPG has no transparency — transparent areas will be filled with the background colour. Choose PNG or WebP to keep it.
        </p>
      )}

      <ContentControl image={image} onPatch={onPatch} />

      {layout.strategy === 'crop' && <FocusPicker image={image} entry={entry} onFocus={(focus) => onPatch(image.id, { focus })} />}
    </div>
  );
}

function LayoutSection({ settings, update, plan }) {
  const seamless = settings.layout === 'seamless';
  const strip = plan?.strip;
  const n = plan?.valid.length || 0;
  return (
    <Section title="Layout">
      <Segmented
        label="Layout"
        value={settings.layout}
        onChange={(layout) => update({ layout })}
        options={[
          { id: 'seamless', label: 'Seamless' },
          { id: 'separate', label: 'Separate' },
        ]}
      />
      <p className="mt-2 text-[11.5px] leading-snug text-faint">
        {seamless
          ? 'Pictures sit side by side in one strip that’s cut into slides. Swiping on X reads as one continuous image.'
          : 'Each picture becomes its own slide, sized for X.'}
      </p>
      {seamless && (
        <>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-muted">Pictures per slide</span>
            <div className="w-[176px]">
              <Segmented
                size="sm"
                label="Pictures per slide"
                value={settings.perSlide}
                onChange={(perSlide) => update({ perSlide })}
                options={PER_SLIDE_OPTIONS.map((k) => ({ id: k, label: String(k) }))}
              />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-muted">Slide shape</span>
            <div className="w-[176px]">
              <Segmented
                size="sm"
                label="Slide shape"
                value={settings.slideShape}
                onChange={(slideShape) => update({ slideShape })}
                options={SLIDE_SHAPES.map((k) => ({ id: k, label: k }))}
              />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-muted">Gap</span>
            <div className="w-[176px]">
              <Segmented
                size="sm"
                label="Gap between pictures"
                value={settings.gap}
                onChange={(gap) => update({ gap })}
                options={GAP_OPTIONS.map((g) => ({ id: g.id, label: g.label }))}
              />
            </div>
          </div>
          {strip && (
            <p className="mt-3 rounded-md bg-raised px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-muted">
              {n} picture{n === 1 ? '' : 's'} ÷ {settings.perSlide} = <span className="text-ink">{strip.frames} slide{strip.frames === 1 ? '' : 's'}</span>
              {strip.frames > X_RULES.mediaPerPost
                ? ` · ${Math.ceil(strip.frames / X_RULES.mediaPerPost)} posts`
                : ' · 1 post'}
              <br />
              {formatDims(strip.frameW, strip.frameH)} each
            </p>
          )}
        </>
      )}
    </Section>
  );
}

export default function SettingsPanel({ settings, update, webp, selected, selectedEntry, selectedOutput, onPatchImage, summary, plan }) {
  const fmt = FORMATS[settings.format];
  const fill = ((settings.quality - 60) / 40) * 100;
  const seamless = settings.layout === 'seamless';

  return (
    <div>
      <LayoutSection settings={settings} update={update} plan={plan} />

      <Section title="Image handling">
        <div role="radiogroup" aria-label="Image handling" className="space-y-1.5">
          {MODES.map((m) => {
            const on = settings.mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update({ mode: m.id })}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                  on ? 'border-accent/60 bg-accent/[0.07]' : 'border-line hover:border-line-strong hover:bg-raised/50'
                }`}
              >
                <Icon size={16} className={`mt-0.5 shrink-0 ${on ? 'text-accent' : 'text-muted'}`} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{m.title}</span>
                    {m.tag && <span className="rounded bg-raised px-1.5 py-px text-[10.5px] font-medium text-muted">{m.tag}</span>}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted">{seamless ? m.seamlessDesc : m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={seamless ? 'Size' : 'Frame'}>
        {!seamless && (
          <>
            <Segmented label="Frame" value={settings.frame} onChange={(frame) => update({ frame })} options={FRAME_OPTIONS} />
            <p className="mt-2 text-[11.5px] leading-snug text-faint">
              {settings.frame === 'auto'
                ? 'Auto picks the closest shape X shows uncropped: 4:5–1:1 in carousels, 3:4–2:1 for single images.'
                : settings.frame === '16:9'
                  ? '16:9 shows in full as a single image, but X crops its sides inside a carousel.'
                  : `Every image is output at ${settings.frame}.`}
            </p>
          </>
        )}
        <div className={`${seamless ? '' : 'mt-3 '}flex items-center justify-between gap-3`}>
          <span className="text-[12.5px] text-muted">{seamless ? 'Slide long edge' : 'Long edge'}</span>
          <div className="w-[176px]">
            <Segmented
              size="sm"
              label="Long edge in pixels"
              value={settings.longEdge}
              onChange={(longEdge) => update({ longEdge })}
              options={LONG_EDGE_OPTIONS.map((o) => ({ ...o, title: `${o.hint}: up to ${o.id}px` }))}
            />
          </div>
        </div>
        {!seamless && (
          <>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-muted">Images per post</span>
              <div className="w-[176px]">
                <Segmented
                  size="sm"
                  label="Images per post"
                  value={settings.perPost}
                  onChange={(perPost) => update({ perPost })}
                  options={[1, 2, 3, 4].map((n) => ({ id: n, label: String(n) }))}
                />
              </div>
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-faint">Never upscaled — small images keep their size.</p>
          </>
        )}
      </Section>

      <Section title="Target format">
        <Segmented
          label="Target format"
          value={settings.format}
          onChange={(format) => {
            const patch = { format };
            if (!FORMATS[format].alpha && settings.background === 'transparent') patch.background = 'white';
            update(patch);
          }}
          options={Object.entries(FORMATS).map(([id, f]) => ({
            id,
            label: f.label,
            disabled: id === 'webp' && !webp,
            title: id === 'webp' && !webp ? 'This browser can’t encode WebP' : undefined,
          }))}
        />
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="quality" className="text-[12.5px] text-muted">
              Quality
            </label>
            <span className="font-mono text-[12px] tabular-nums text-ink">{fmt.lossy ? `${settings.quality}%` : 'Lossless'}</span>
          </div>
          <input
            id="quality"
            type="range"
            min={60}
            max={100}
            step={1}
            value={settings.quality}
            disabled={!fmt.lossy}
            onChange={(e) => update({ quality: Number(e.target.value) })}
            className="slider"
            style={{ '--fill': `${fill}%` }}
          />
          <div className="flex justify-between font-mono text-[10.5px] text-faint">
            <span>60</span>
            <span>100</span>
          </div>
          {!fmt.lossy && <p className="mt-1 text-[11.5px] text-faint">PNG is lossless — quality doesn’t apply.</p>}
        </div>
      </Section>

      <Section title="Background">
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Background">
          {BACKGROUNDS.map((b) => {
            const on = settings.background === b.id;
            const disabled = b.id === 'transparent' && !fmt.alpha;
            return (
              <label
                key={b.id}
                className={`relative flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-[11.5px] transition ${
                  on ? 'border-accent/60 bg-accent/[0.07] text-ink' : 'border-line text-muted hover:border-line-strong'
                } ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
                title={disabled ? 'JPG doesn’t support transparency' : undefined}
              >
                <input
                  type="radio"
                  name="background"
                  className="sr-only"
                  checked={on}
                  disabled={disabled}
                  onChange={() => update({ background: b.id })}
                />
                {b.swatch === 'custom' ? (
                  <span className="relative size-5 overflow-hidden rounded-full border border-line-strong" style={{ background: settings.customColor }}>
                    <input
                      type="color"
                      value={settings.customColor}
                      aria-label="Custom background colour"
                      onClick={() => update({ background: 'custom' })}
                      onChange={(e) => update({ background: 'custom', customColor: e.target.value })}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                  </span>
                ) : b.swatch ? (
                  <span className="size-5 rounded-full border border-line-strong" style={{ background: b.swatch }} />
                ) : (
                  <span className="checker size-5 rounded-full border border-line-strong" />
                )}
                {b.label}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-faint">
          Fills padding added by Contain and Smart Fit{fmt.alpha ? '' : ', and transparent areas in JPG'}.
        </p>
      </Section>

      <Section title="Output" aside={<span className="font-mono text-[11px] text-faint">{summary}</span>}>
        <SelectedDetails image={selected} entry={selectedEntry} output={selectedOutput} settings={settings} onPatch={onPatchImage} />
      </Section>
    </div>
  );
}
