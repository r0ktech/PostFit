# PostFit

Make your images ready for X. Resize, crop and prepare up to 20 images for X’s current image-post format, entirely in the browser.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm start
```

No backend, database, or account. Images never leave the device: decoding, resizing, encoding, and ZIP creation all run client-side (Canvas + `createImageBitmap` + JSZip).

## How it works

| File | Role |
| --- | --- |
| `lib/x-rules.js` | **All X display rules** — media per post, aspect limits for single images and carousels, carousel geometry, file-size limit. Update this file when X changes its layout. |
| `lib/fit.js` | Pure layout math: Smart Fit / Crop / Contain → output size, source crop rect, destination rect. Never stretches, never upscales. |
| `lib/smartcrop.js` | Saliency map (edges, saturation, skin tones) and best crop-window search; honours a user focal point. |
| `lib/analyze.js` | Header sniffing (real type + dimensions), validation, decode, preview generation, photo vs. text/UI classification. |
| `lib/render.js` | Full-resolution export: decode → high-quality resample of only the crop rect → compose → encode. |
| `lib/canvas.js` | Canvas helpers; stepped downscaling fallback; frees canvases for iOS Safari. |
| `hooks/usePostFit.js` | App state, analysis/processing queues, object-URL lifecycle. |
| `components/XPreview.js` | The “X preview” approximation: thread of posts, swipeable carousel, single images. |

### Current X model (approximation)

- Up to 4 images per post; more images become a thread (1–4 per post is configurable).
- 2+ images display as a horizontal carousel; slides share a height set by the first image and are cropped by X outside **4:5–1:1**.
- Single images display uncropped between **3:4 and 2:1**.

### Seamless layout (default)

All pictures are placed side by side in one strip, which is cut into equal carousel slides. With **2.5 pictures per slide**, picture 3 is split: its left half ends slide 1 and its right half starts slide 2, so swiping reads as one continuous image. 10 pictures → 4 slides → one X post. Pictures per slide (1.5 / 2 / 2.5 / 3), slide shape (4:5 / 1:1) and gap are configurable. Cell edges are whole pixels and every picture is resampled once, so split pictures join without a seam (`lib/strip.js`, `createStripRenderer` in `lib/render.js`). Export is one file per slide: `slide-01.jpg`, `slide-02.jpg`, …

“Separate” layout keeps the original behaviour: one image per slide, sized for X.

### Smart Fit

1. Read dimensions and aspect ratio; classify the image as photo or text/UI (screenshots, memes, posters, designs; flat-colour and palette analysis, transparency).
2. Pick the target shape: the image’s own aspect, clamped to what X shows uncropped in that slot.
3. If the shape already fits, only resize (long edge 1600/2048/4096, never upscaled).
4. Otherwise: **text/UI is never cropped**, it is padded. Photos may lose at most 12% of their area to a content-aware trim; beyond that they are padded too.

Crop mode always fills the frame using the saliency crop (adjustable focal point). Contain always pads.

## Limits & errors

JPG, PNG, and WebP only. GIF, animated WebP, HEIC, and AVIF are rejected with an explanation. Files are capped at 60 MB and 120 MP (50 MP on phones/low-memory devices). Corrupted files, decode failures, and out-of-memory encodes each show a specific message.
