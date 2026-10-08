const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const make = (paths) =>
  function Icon({ size = 16, className = '', ...rest }) {
    return (
      <svg {...base} width={size} height={size} className={className} {...rest}>
        {paths}
      </svg>
    );
  };

export const UploadIcon = make(
  <>
    <path d="M12 15V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </>
);
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const CloseIcon = make(<path d="M6 6l12 12M18 6 6 18" />);
export const CheckIcon = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const AlertIcon = make(
  <>
    <path d="M12 8v5" />
    <path d="M12 16.5v.01" />
    <path d="M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </>
);
export const LockIcon = make(
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </>
);
export const DownloadIcon = make(
  <>
    <path d="M12 4v11" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 20h14" />
  </>
);
export const ArchiveIcon = make(
  <>
    <rect x="3" y="4" width="18" height="5" rx="1.2" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
    <path d="M10 13h4" />
  </>
);
export const ReplaceIcon = make(
  <>
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 20v-4h-4" />
  </>
);
export const TrashIcon = make(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V4.5h6V7" />
    <path d="M6.5 7l.9 12a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12" />
  </>
);
export const GripIcon = make(
  <>
    <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
  </>
);
export const ChevronLeftIcon = make(<path d="m15 5-7 7 7 7" />);
export const ChevronRightIcon = make(<path d="m9 5 7 7-7 7" />);
export const InfoIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8v.01" />
  </>
);
export const SunIcon = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </>
);
export const MoonIcon = make(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />);
export const SmartIcon = make(
  <>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="M8 15l2.5-3 2 2 3-4" />
  </>
);
export const CropIcon = make(
  <>
    <path d="M6 2.5V16a2 2 0 0 0 2 2h13.5" />
    <path d="M2.5 6H16a2 2 0 0 1 2 2v13.5" />
  </>
);
export const ContainIcon = make(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <rect x="3" y="7.5" width="18" height="9" rx="0.5" strokeDasharray="2 2" />
  </>
);
export const ImageIcon = make(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m21 16-5-5-9 9" />
  </>
);
export const TargetIcon = make(
  <>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </>
);

/* X-style engagement glyphs (generic outlines, not X's assets). */
export const ReplyIcon = make(<path d="M4 11.5a7.5 7 0 0 1 7.5-7h1a7.5 7 0 0 1 0 15H11l-5 3v-4.2A7 7 0 0 1 4 11.5Z" />);
export const RepostIcon = make(
  <>
    <path d="M7 4 4 7l3 3" />
    <path d="M4 7h11a3 3 0 0 1 3 3v2" />
    <path d="m17 20 3-3-3-3" />
    <path d="M20 17H9a3 3 0 0 1-3-3v-2" />
  </>
);
export const HeartIcon = make(<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />);
export const ViewsIcon = make(<path d="M5 20V12M10 20V6M15 20v-9M20 20V9" />);
export const BookmarkIcon = make(<path d="M6.5 4h11v16.5l-5.5-4-5.5 4Z" />);
export const ShareIcon = make(
  <>
    <path d="M12 15V4" />
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
  </>
);

export function Spinner({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--color-ink)" />
      <rect x="8" y="7.5" width="12.5" height="16.5" rx="2.4" fill="none" stroke="var(--color-bg)" strokeWidth="2.4" />
      <rect x="15" y="12" width="9" height="12.5" rx="2" fill="var(--color-accent)" />
    </svg>
  );
}
