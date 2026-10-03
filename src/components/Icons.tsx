import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const IconType = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 18 8 6l5 12M4.8 14h6.4M14 18l3.5-8 3.5 8M15 15.6h5" />
  </svg>
);
export const IconMap = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z" />
    <path d="M8.5 4v13.5M15.5 6.5V20" />
  </svg>
);
export const IconThread = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 17c3 0 3-10 6-10s3 10 6 10 3-10 6-10" />
    <circle cx="9" cy="7" r="1.4" fill="currentColor" />
    <circle cx="15" cy="17" r="1.4" fill="currentColor" />
  </svg>
);
export const IconFocus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    <path d="M9 10h6M9 12.5h6M9 15h4" />
  </svg>
);
export const IconSound = ({ on, ...p }: SVGProps<SVGSVGElement> & { on?: boolean }) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
    {on ? <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7.5a6.5 6.5 0 0 1 0 9" /> : <path d="m16 10 4 4m0-4-4 4" />}
  </svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconChevron = ({ dir = 'right', ...p }: SVGProps<SVGSVGElement> & { dir?: 'left' | 'right' | 'down' | 'up' }) => {
  const r = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return (
    <svg {...base(p)} style={{ transform: `rotate(${r}deg)` }}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
};
export const IconInsert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="5" y="3.5" width="14" height="17" rx="0.5" />
    <path d="M8.5 8h7M8.5 11h7M8.5 14h4.5" />
  </svg>
);

/* Margin glyphs — deliberately tiny, drawn like printers' marks */
export const GlyphConnection = (p: SVGProps<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden {...p}>
    <path d="M7 1.2 12.8 7 7 12.8 1.2 7z" fill="none" stroke="currentColor" strokeWidth="1.1" />
    <path d="M7 4.4 9.6 7 7 9.6 4.4 7z" fill="currentColor" />
  </svg>
);
export const GlyphThread = (p: SVGProps<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden {...p}>
    <path d="M1.5 7c0-2.6 3.6-2.6 5.5 0s5.5 2.6 5.5 0-3.6-2.6-5.5 0-5.5 2.6-5.5 0z" fill="none" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);
export const GlyphDiscovery = (p: SVGProps<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden {...p}>
    <circle cx="7" cy="3.6" r="1.25" fill="currentColor" />
    <circle cx="3.8" cy="9.6" r="1.25" fill="currentColor" />
    <circle cx="10.2" cy="9.6" r="1.25" fill="currentColor" />
  </svg>
);
export const GlyphCompass = (p: SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden {...p}>
    <circle cx="9" cy="9" r="7.4" fill="none" stroke="currentColor" strokeWidth="0.9" />
    <path d="M9 2.8 10.4 9 9 15.2 7.6 9z" fill="currentColor" opacity="0.9" />
    <path d="M2.8 9 9 7.9 15.2 9 9 10.1z" fill="currentColor" opacity="0.4" />
  </svg>
);

/** Pencil mark: a hand-drawn ring, as a reader marks a margin. */
export const GlyphMemory = (p: SVGProps<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden {...p}>
    <path d="M11.6 5.2C11 2.9 8.6 1.6 6.2 2.1 3.5 2.7 1.8 5.4 2.4 8.1c.6 2.6 3.3 4.2 5.9 3.6 1.7-.4 3-1.6 3.5-3.1" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    <circle cx="7" cy="7" r="1.3" fill="currentColor" />
  </svg>
);
export const IconBookmark = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <svg {...base(p)}>
    <path d="M7 3.5h10v17l-5-4-5 4z" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5.5 5.5" />
  </svg>
);
export const IconContents = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 5.5c2.8-1 5.6-1 8 .6 2.4-1.6 5.2-1.6 8-.6v13c-2.8-1-5.6-1-8 .6-2.4-1.6-5.2-1.6-8-.6z" />
    <path d="M12 6.1v13" />
  </svg>
);
export const IconTimeline = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 12h18" />
    <path d="M6 9v6M11 10v4M15 8v8M19 10.5v3" />
  </svg>
);
export const IconReturn = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 7 4 12l5 5" />
    <path d="M4 12h10a6 6 0 0 1 6 6" />
  </svg>
);

export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </svg>
);
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 5.5v13M16 5.5v13" />
  </svg>
);
export const IconListen = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3.5" y="13.5" width="4" height="6" rx="1.2" />
    <rect x="16.5" y="13.5" width="4" height="6" rx="1.2" />
  </svg>
);
export const IconHeart = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <svg {...base(p)}>
    <path d="M12 19.5s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.2-7 9.6-7 9.6z" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);
export const IconPencil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 19.5 5.6 15 16 4.6a1.6 1.6 0 0 1 2.3 0l1.1 1.1a1.6 1.6 0 0 1 0 2.3L9 18.4z" />
  </svg>
);
export const IconBooks = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 4.5h3.5v15H5zM10 4.5h3.5v15H10zM15.2 5.3l3.3-.9 3.7 14.4-3.3.9z" />
  </svg>
);
