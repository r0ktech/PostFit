'use client';

/**
 * Renders the *output* of a layout using the light preview image and CSS
 * only — instant updates, no canvas work. Geometry mirrors lib/render.js.
 *
 * `viewAspect` (optional) is the box this frame is shown in; the frame is
 * "cover"-fitted into it, which is how X crops out-of-range images.
 */
export default function FramedImage({ image, layout, background, viewAspect, transparentClass = 'checker', className = '' }) {
  if (!image?.previewUrl || !layout) {
    return <div className={`h-full w-full animate-pulse bg-raised ${className}`} />;
  }
  const { outW, outH, crop, draw } = layout;
  const W = image.width;
  const H = image.height;
  const clipStyle = {
    position: 'absolute',
    left: `${(draw.dx / outW) * 100}%`,
    top: `${(draw.dy / outH) * 100}%`,
    width: `${(draw.dw / outW) * 100}%`,
    height: `${(draw.dh / outH) * 100}%`,
    overflow: 'hidden',
  };
  // The image is positioned relative to the clip box (the drawn area).
  const innerStyle = {
    position: 'absolute',
    maxWidth: 'none',
    left: `${(-crop.sx / crop.sw) * 100}%`,
    top: `${(-crop.sy / crop.sh) * 100}%`,
    width: `${(W / crop.sw) * 100}%`,
    height: `${(H / crop.sh) * 100}%`,
  };

  const frameAspect = outW / outH;
  let frameStyle = { position: 'absolute', inset: 0 };
  if (viewAspect) {
    if (frameAspect > viewAspect) {
      const w = (frameAspect / viewAspect) * 100;
      frameStyle = { position: 'absolute', top: 0, height: '100%', width: `${w}%`, left: `${(100 - w) / 2}%` };
    } else {
      const h = (viewAspect / frameAspect) * 100;
      frameStyle = { position: 'absolute', left: 0, width: '100%', height: `${h}%`, top: `${(100 - h) / 2}%` };
    }
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div
        style={{ ...frameStyle, background: background || undefined, transition: 'all 220ms cubic-bezier(.2,.8,.2,1)' }}
        className={background ? '' : transparentClass}
      >
        <div style={{ ...clipStyle, transition: 'all 220ms cubic-bezier(.2,.8,.2,1)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt=""
            draggable={false}
            decoding="async"
            style={{ ...innerStyle, transition: 'all 220ms cubic-bezier(.2,.8,.2,1)' }}
            className="select-none"
          />
        </div>
      </div>
    </div>
  );
}
