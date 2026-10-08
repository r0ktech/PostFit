'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import FramedImage from './FramedImage';
import {
  BookmarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
  InfoIcon,
  MoonIcon,
  ReplyIcon,
  RepostIcon,
  ShareIcon,
  Spinner,
  SunIcon,
  ViewsIcon,
} from './icons';
import { carouselGeometry, groupIntoPosts, X_RULES, xDisplay } from '@/lib/x-rules';
import { slidesToPosts } from '@/lib/strip';

const THEMES = {
  dark: { bg: '#000000', text: '#e7e9ea', muted: '#71767b', line: '#2f3336', skel: '#202327', media: '#16181c' },
  light: { bg: '#ffffff', text: '#0f1419', muted: '#536471', line: '#eff3f4', skel: '#eff3f4', media: '#f7f9f9' },
};

const MAX_MEDIA_H = 520;
const EASE = '220ms cubic-bezier(.2,.8,.2,1)';

function useWidth(ref) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Media box with X's rounded frame. Content decides its own interactivity. */
function MediaBox({ id, width, height, theme, children }) {
  return (
    <div
      data-slide={id}
      className="relative shrink-0 snap-start overflow-hidden rounded-2xl"
      style={{
        width,
        height,
        background: THEMES[theme].media,
        border: `1px solid ${THEMES[theme].line}`,
        transition: `width ${EASE}, height ${EASE}`,
      }}
    >
      {children}
    </div>
  );
}

/** One uploaded image as its own slide (separate mode). */
function ImageSlideContent({ image, entry, background, kind, selected, onSelect }) {
  const ready = image.status !== 'analyzing' && entry?.layout;
  const disp = xDisplay(ready ? entry.layout.outW / entry.layout.outH : 1, kind);
  return (
    <button
      type="button"
      onClick={() => onSelect(image.id)}
      aria-label={`Image ${String(entry.index + 1).padStart(2, '0')}`}
      className="group/slide absolute inset-0 text-left outline-none"
    >
      {ready ? (
        <FramedImage image={image} layout={entry.layout} background={background} viewAspect={disp.aspect} transparentClass="" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#71767b]">
          <Spinner size={18} />
        </div>
      )}
      <SelectRing selected={selected} />
      {ready && disp.cropped && (
        <span className="absolute bottom-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10.5px] font-medium text-warn backdrop-blur">
          X crops edges
        </span>
      )}
    </button>
  );
}

function SelectRing({ selected, rounded = 'rounded-2xl' }) {
  return (
    <span
      className={`pointer-events-none absolute inset-0 ${rounded} transition ${
        selected ? 'ring-2 ring-inset ring-accent' : 'ring-0 group-hover/slide:ring-1 group-hover/slide:ring-inset group-hover/slide:ring-white/30'
      }`}
    />
  );
}

/** One slide of the seamless strip: the parts of every picture that fall inside it. */
function StripSlideContent({ strip, slide, background, selectedId, onSelect }) {
  const cells = strip.cells.filter((c) => slide.cellIds.includes(c.id));
  return (
    <div className="absolute inset-0" style={{ background: background || undefined }}>
      {cells.map((cell) => {
        const left = ((cell.x0 - slide.fx0) / strip.frameW) * 100;
        const width = ((cell.x1 - cell.x0) / strip.frameW) * 100;
        const split = cell.slides[0] !== cell.slides[1];
        return (
          <button
            key={cell.id}
            type="button"
            onClick={() => onSelect(cell.id)}
            aria-label={`Picture ${String(cell.index + 1).padStart(2, '0')}${split ? ' (split across slides)' : ''}`}
            className="group/slide absolute inset-y-0 outline-none"
            style={{ left: `${left}%`, width: `${width}%`, transition: `left ${EASE}, width ${EASE}` }}
          >
            <FramedImage image={cell.image} layout={cell.layout} background={background} transparentClass="" />
            <SelectRing selected={cell.id === selectedId} rounded="" />
          </button>
        );
      })}
    </div>
  );
}

function Carousel({ slides, theme, selectedSlideId }) {
  const wrapRef = useRef(null);
  const scrollerRef = useRef(null);
  const width = useWidth(wrapRef);
  const [pos, setPos] = useState({ index: 0, canPrev: false, canNext: false });

  let { height, widths } = carouselGeometry(
    slides.map((s) => s.aspect),
    width || 1
  );
  if (height > MAX_MEDIA_H) {
    const k = MAX_MEDIA_H / height;
    height = MAX_MEDIA_H;
    widths = widths.map((w) => w * k);
  }

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll('[data-slide]'));
    let index = 0;
    nodes.forEach((s, i) => {
      if (s.offsetLeft - el.offsetLeft <= el.scrollLeft + 8) index = i;
    });
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) index = nodes.length - 1;
    setPos({ index, canPrev: el.scrollLeft > 4, canNext: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
  }, [update, width, slides.length, widths.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring the selected slide into view when it's chosen elsewhere.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !selectedSlideId) return;
    const node = el.querySelector(`[data-slide="${selectedSlideId}"]`);
    if (!node) return;
    const left = node.offsetLeft - el.offsetLeft;
    const right = left + node.offsetWidth;
    if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }, [selectedSlideId]);

  const step = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll('[data-slide]'));
    const target = nodes[Math.min(nodes.length - 1, Math.max(0, pos.index + dir))];
    if (target) el.scrollTo({ left: target.offsetLeft - el.offsetLeft, behavior: 'smooth' });
  };

  return (
    <div ref={wrapRef} className="group/car relative mt-3">
      <div ref={scrollerRef} onScroll={update} className="no-scrollbar flex snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth">
        {width > 0 &&
          slides.map((s, i) => (
            <MediaBox key={s.id} id={s.id} width={widths[i]} height={height} theme={theme}>
              {s.node}
            </MediaBox>
          ))}
      </div>
      {width > 0 && (
        <>
          <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white backdrop-blur">
            {pos.index + 1}/{slides.length}
          </span>
          {pos.canPrev && (
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition hover:bg-black/85 sm:opacity-0 sm:group-hover/car:opacity-100"
            >
              <ChevronLeftIcon />
            </button>
          )}
          {pos.canNext && (
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition hover:bg-black/85 sm:opacity-0 sm:group-hover/car:opacity-100"
            >
              <ChevronRightIcon />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Single({ slide, theme }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const aspect = xDisplay(slide.aspect, 'single').aspect;
  let w = width;
  let h = width / aspect;
  if (h > MAX_MEDIA_H) {
    h = MAX_MEDIA_H;
    w = h * aspect;
  }
  return (
    <div ref={wrapRef} className="mt-3">
      {width > 0 && (
        <MediaBox id={slide.id} width={w} height={h} theme={theme}>
          {slide.node}
        </MediaBox>
      )}
    </div>
  );
}

function Post({ slides, postIndex, postCount, theme, selectedSlideId }) {
  const t = THEMES[theme];
  const last = postIndex === postCount - 1;
  return (
    <article className="relative grid grid-cols-[40px_1fr] gap-3 px-4 pt-3" style={{ paddingBottom: last ? 12 : 4 }}>
      <div className="relative flex flex-col items-center">
        <div className="size-10 shrink-0 rounded-full" style={{ background: t.skel }} />
        {!last && <div className="mt-1 w-0.5 flex-1 rounded-full" style={{ background: t.line }} />}
      </div>
      <div className="min-w-0 pb-1">
        <div className="flex items-center gap-1 text-[15px] leading-5">
          <span className="font-bold" style={{ color: t.text }}>
            Your Name
          </span>
          <span className="truncate" style={{ color: t.muted }}>
            @yourhandle · now
          </span>
        </div>
        <div className="mt-2 space-y-1.5" aria-hidden>
          <div className="h-2.5 w-[88%] rounded-full" style={{ background: t.skel }} />
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-[52%] rounded-full" style={{ background: t.skel }} />
            {postCount > 1 && (
              <span className="text-[13px] leading-none" style={{ color: t.muted }}>
                {postIndex + 1}/{postCount}
              </span>
            )}
          </div>
        </div>
        {slides.length === 1 ? (
          <Single slide={slides[0]} theme={theme} />
        ) : (
          <Carousel slides={slides} theme={theme} selectedSlideId={selectedSlideId} />
        )}
        <div className="mt-2.5 flex max-w-[425px] items-center justify-between pr-1" style={{ color: t.muted }} aria-hidden>
          <ReplyIcon size={17} />
          <RepostIcon size={17} />
          <HeartIcon size={17} />
          <ViewsIcon size={17} />
          <div className="flex gap-3">
            <BookmarkIcon size={17} />
            <ShareIcon size={17} />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Build the posts (arrays of slide descriptors) for either layout. */
function buildPosts({ items, plan, settings, selectedId, onSelect }) {
  if (plan.seamless) {
    const strip = plan.strip;
    if (!strip) return { posts: [], selectedSlideId: null };
    const cell = strip.cells.find((c) => c.id === selectedId);
    const posts = slidesToPosts(strip).map((group) =>
      group.map((slide) => ({
        id: `slide-${slide.index}`,
        aspect: strip.aspect,
        node: <StripSlideContent strip={strip} slide={slide} background={plan.background} selectedId={selectedId} onSelect={onSelect} />,
      }))
    );
    return { posts, selectedSlideId: cell ? `slide-${cell.slides[0]}` : null };
  }
  const posts = groupIntoPosts(items, settings.perPost).map((group) =>
    group.map((image) => {
      const entry = plan.byId[image.id];
      const l = entry?.layout;
      return {
        id: image.id,
        aspect: l ? l.outW / l.outH : 1,
        node: (
          <ImageSlideContent
            image={image}
            entry={entry}
            background={plan.background}
            kind={group.length > 1 ? 'carousel' : 'single'}
            selected={image.id === selectedId}
            onSelect={onSelect}
          />
        ),
      };
    })
  );
  return { posts, selectedSlideId: selectedId };
}

export default function XPreview({ items, plan, settings, selectedId, onSelect }) {
  const [theme, setTheme] = useState('dark');
  const [showInfo, setShowInfo] = useState(false);
  const { posts, selectedSlideId } = buildPosts({ items, plan, settings, selectedId, onSelect });
  const t = THEMES[theme];
  const strip = plan.seamless ? plan.strip : null;
  const waiting = plan.seamless && items.some((i) => i.status === 'analyzing');

  return (
    <section aria-label="X preview" className="flex min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[13px] font-medium text-ink">X preview</h2>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted transition hover:border-line-strong hover:text-ink"
            aria-expanded={showInfo}
          >
            <InfoIcon size={12} /> Approximation
          </button>
          <span className="hidden truncate text-[12px] text-faint sm:inline">
            {strip ? `${strip.frames} slide${strip.frames === 1 ? '' : 's'} · ` : ''}
            {posts.length} post{posts.length === 1 ? '' : 's'}
            {posts.length > 1 ? ' · thread' : ''}
          </span>
        </div>
        <div className="flex rounded-lg border border-line bg-panel p-0.5" role="group" aria-label="Preview theme">
          {[
            ['dark', MoonIcon, 'Dark'],
            ['light', SunIcon, 'Light'],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              aria-label={`${label} preview`}
              className={`flex size-7 items-center justify-center rounded-md transition ${
                theme === id ? 'bg-hover text-ink' : 'text-faint hover:text-muted'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {showInfo && (
        <p className="animate-fade-in mb-3 rounded-lg border border-line bg-panel px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
          This is an approximation of how X currently displays image posts, not an official X renderer. X shows multiple
          images as a swipeable carousel ({X_RULES.mediaPerPost} per post max), so larger sets continue as a thread.
          {strip && ' In Seamless mode your pictures form one continuous strip cut into slides, so pictures on a slide edge continue on the next slide.'}{' '}
          Exact sizes vary by app, screen and X’s ongoing changes.
        </p>
      )}

      {strip && strip.missing > 0.01 && !waiting && (
        <p className="mb-3 rounded-lg border border-line bg-panel px-3 py-2 text-[12.5px] text-muted">
          The last slide has room for {strip.missing} more picture{strip.missing === 1 ? '' : 's'} — it’s filled with the
          background colour. Add {Math.ceil(strip.missing)} more or change “Pictures per slide” for a perfect fit.
        </p>
      )}

      {posts.length ? (
        <div
          className="mx-auto w-full max-w-[598px] overflow-hidden rounded-2xl transition-colors duration-300"
          style={{ background: t.bg, border: `1px solid ${t.line}` }}
        >
          {posts.map((slides, i) => (
            <Post key={i} slides={slides} postIndex={i} postCount={posts.length} theme={theme} selectedSlideId={selectedSlideId} />
          ))}
        </div>
      ) : (
        <div className="flex h-60 items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-[13px] text-muted">
          <Spinner size={14} /> Reading images…
        </div>
      )}
    </section>
  );
}
