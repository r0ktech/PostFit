/**
 * X (formerly Twitter) image-post display rules.
 *
 * Everything PostFit knows about how X renders attached images lives here, so
 * when X changes its layout only this file needs to be updated.
 *
 * Current model (approximation, mid-2026 carousel layout):
 *  - A post holds up to 4 media items. More images become a thread.
 *  - A post with a single image shows it uncropped, inside a tall/wide limit.
 *  - A post with 2+ images is a horizontal, swipeable carousel. Every slide
 *    shares the same height (set by the first image); each slide's width
 *    follows its own aspect ratio, clamped to the carousel limits. Anything
 *    outside those limits is center-cropped by X.
 *  - 4:5 portrait is the safest, largest-on-mobile shape for carousels.
 */

export const X_RULES = {
  id: 'x-carousel-2026',
  label: 'X carousel layout (2026)',

  /** Media items X allows on one post. */
  mediaPerPost: 4,

  /** X rejects (or heavily recompresses) still images above this size. */
  maxFileBytes: 5 * 1024 * 1024,

  /** Largest long edge X stores for a still image. */
  maxLongEdge: 4096,

  /** Aspect limits (width / height) before X crops the image in the feed. */
  single: {
    minAspect: 3 / 4,
    maxAspect: 2 / 1,
    /** Shapes Crop / Contain snap to when the frame is "Auto". */
    frames: ['3:4', '4:5', '1:1', '4:3', '16:9', '2:1'],
  },
  carousel: {
    minAspect: 4 / 5,
    maxAspect: 1 / 1,
    frames: ['4:5', '1:1'],
    /** Fraction of the post width taken by the first slide (rest is the peek). */
    slideWidthRatio: 0.86,
  },
};

/** Fixed frame presets a user can force. */
export const FRAME_PRESETS = {
  '4:5': 4 / 5,
  '1:1': 1,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '2:1': 2,
  '9:16': 9 / 16,
};

/** Options shown in the "Frame" control. `auto` lets PostFit pick per image. */
export const FRAME_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: '4:5', label: '4:5' },
  { id: '1:1', label: '1:1' },
  { id: '16:9', label: '16:9' },
];

export const LONG_EDGE_OPTIONS = [
  { id: 1600, label: '1600', hint: 'Fast' },
  { id: 2048, label: '2048', hint: 'Sharp' },
  { id: 4096, label: '4096', hint: 'Max' },
];

/**
 * Split an ordered list into posts according to X's per-post limit.
 * `perPost` lets the user post fewer images per post (e.g. 1 per tweet).
 */
export function groupIntoPosts(items, perPost = X_RULES.mediaPerPost) {
  const size = Math.max(1, Math.min(perPost, X_RULES.mediaPerPost));
  const posts = [];
  for (let i = 0; i < items.length; i += size) posts.push(items.slice(i, i + size));
  return posts;
}

/** Display context for every index: which rule set applies to it. */
export function contextForIndex(index, total, perPost = X_RULES.mediaPerPost) {
  const size = Math.max(1, Math.min(perPost, X_RULES.mediaPerPost));
  const postIndex = Math.floor(index / size);
  const start = postIndex * size;
  const count = Math.min(size, total - start);
  const kind = count > 1 ? 'carousel' : 'single';
  return { kind, postIndex, slot: index - start, count, rules: X_RULES[kind] };
}

export const clampAspect = (aspect, rules) =>
  Math.min(rules.maxAspect, Math.max(rules.minAspect, aspect));

/**
 * How X will display an image with `aspect` in `kind` context.
 * Returns the visible slide aspect and whether X crops it.
 */
export function xDisplay(aspect, kind) {
  const rules = X_RULES[kind];
  const shown = clampAspect(aspect, rules);
  const cropped = Math.abs(Math.log(shown / aspect)) > 0.012;
  return { aspect: shown, cropped };
}

/**
 * Carousel geometry: slide height is driven by the first slide, all slides
 * share it, widths follow each slide's clamped aspect.
 */
export function carouselGeometry(aspects, containerWidth) {
  const rules = X_RULES.carousel;
  const first = clampAspect(aspects[0] ?? 1, rules);
  const height = (containerWidth * rules.slideWidthRatio) / first;
  return {
    height,
    widths: aspects.map((a) => height * clampAspect(a, rules)),
  };
}
