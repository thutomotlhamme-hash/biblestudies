'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { formatChapter } from '@/lib/content/refs';
import { pageForVerse } from '@/lib/content/repository';
import { GlyphCompass, GlyphDeep, IconBookmark, IconChevron, IconContents, IconFocus, IconHeart, IconMap, IconOriginal, IconSearch, IconThread, IconTimeline, IconType } from './Icons';
import { useReader } from './ReaderContext';

/** Top and bottom chrome. Hidden while reading; a single tap on the page reveals it. */
export function ReadingControls({ visible, onHide }: { visible: boolean; onHide: () => void }) {
  const { ed, chapter, state, open, update, turn, reduced, toggleBookmark, spread } = useReader();
  const fade = reduced ? { duration: 0.12 } : { duration: 0.28, ease: [0.3, 0, 0.2, 1] as const };
  const marked = state.bookmarks.some((b) => b.chapter === chapter.ref && pageForVerse(chapter.pages, b.verse) === state.position.page);
  const atStart = chapter.index === 0 && state.position.page === 0;
  const atEnd = chapter.index === ed.chapters.length - 1 && state.position.page >= chapter.pages.length - 1;

  if (state.focus) {
    return (
      <AnimatePresence>
        {visible && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={fade} className="fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-30 flex justify-center">
            <button type="button" className="chrome btn-quiet border px-4 text-[14px] italic shadow-sm" onClick={() => { update({ focus: false }); onHide(); }} data-testid="exit-focus">
              Leave Focus
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  const page = chapter.pages[state.position.page] ?? chapter.pages[0];
  const pageTo = (spread ? chapter.pages[Math.floor(state.position.page / 2) * 2 + 1]?.to : undefined) ?? page.to;
  const deepHere = ed.deepFor(chapter.ref);
  const hasDeep = deepHere.items.length + deepHere.stories.length > 0;

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.header key="top" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={fade} className="chrome fixed inset-x-0 top-0 z-30 border-b pt-[env(safe-area-inset-top)]" data-testid="chrome-top">
            <div className="mx-auto flex h-[60px] max-w-[1000px] items-center justify-between px-2">
              <button type="button" className="btn-quiet px-3 font-display text-[17px] text-ink" onClick={() => open({ kind: 'contents' })} aria-label={`${formatChapter(chapter.ref)}. Open contents`} data-testid="open-navigator">
                <IconContents width={18} height={18} />
                {formatChapter(chapter.ref)} <IconChevron dir="down" width={14} height={14} />
              </button>
              <span className="running-head hidden md:block">The Holy Bible</span>
              <div className="flex items-center">
                <NavButton label="Yours" aria="Your highlights, notes and favourites" onClick={() => open({ kind: 'mine' })} testId="open-mine" icon={<IconHeart />} />
                <NavButton label="Search" aria="Search" onClick={() => open({ kind: 'search' })} testId="open-search" icon={<IconSearch />} />
                <NavButton label="Settings" aria="Reading settings" onClick={() => open({ kind: 'settings' })} testId="open-settings" icon={<IconType />} />
              </div>
            </div>
          </motion.header>
          <motion.nav key="bottom" aria-label="Reading tools" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={fade} className="chrome fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)]" data-testid="chrome-bottom">
            <div className="mx-auto flex h-[64px] max-w-[1000px] items-center justify-between px-0.5">
              <div className="flex items-center">
                <button type="button" className="btn-quiet !min-w-[36px] !px-1" aria-label="Previous page" disabled={atStart} style={{ opacity: atStart ? 0.3 : 1 }} onClick={() => turn(-1)}>
                  <IconChevron dir="left" />
                </button>
                <span className="hidden font-display text-[12px] tabular-nums tracking-[0.12em] text-[var(--ink-muted)] md:inline" aria-live="polite">
                  {state.position.page + 1} / {chapter.pages.length}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 items-start justify-center">
                <NavButton label="Atlas" aria="Unfold the atlas" onClick={() => open({ kind: 'atlas' })} testId="open-map" icon={<IconMap />} />
                <NavButton label="Timeline" aria="Timeline" onClick={() => open({ kind: 'timeline' })} testId="open-timeline" icon={<IconTimeline />} />
                <NavButton label="Threads" aria="Threads" onClick={() => open({ kind: 'thread', id: state.followThread ?? 'shepherd', ref: undefined })} testId="open-threads" icon={<IconThread />} />
                <NavButton label="Original" aria="Original language: the Hebrew, Aramaic or Greek of this page, and what each word means" onClick={() => open({ kind: 'original', chapter: chapter.ref, from: page.from, to: pageTo })} testId="open-original" icon={<IconOriginal />} />
                {hasDeep && <NavButton label="Deep" aria="Deep Made Simple: research, stories and links for this chapter (supplementary)" onClick={() => open({ kind: 'deep', chapter: chapter.ref })} testId="open-deep-chapter" icon={<GlyphDeep width={20} height={20} />} />}
                <NavButton label="Ribbon" aria={marked ? 'Remove the ribbon from this page' : 'Mark this page with a ribbon'} pressed={marked} onClick={toggleBookmark} testId="toggle-bookmark" icon={<IconBookmark filled={marked} />} />
                <NavButton label="Focus" aria="Enter Focus Mode" onClick={() => { update({ focus: true }); onHide(); }} testId="enter-focus" icon={<IconFocus />} />
              </div>
              <button type="button" className="btn-quiet !min-w-[36px] !px-1" aria-label="Next page" disabled={atEnd} style={{ opacity: atEnd ? 0.3 : 1 }} onClick={() => turn(1)} data-testid="next-page">
                <IconChevron dir="right" />
              </button>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}

/** An icon with its name beneath it, so every tool says what it is — on a phone as on a laptop. */
function NavButton({ label, aria, icon, onClick, testId, pressed }: { label: string; aria: string; icon: ReactNode; onClick: () => void; testId?: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      className="flex min-h-[52px] min-w-[44px] max-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[3px] px-0.5 text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
      aria-label={aria}
      aria-pressed={pressed}
      title={aria}
      onClick={onClick}
      data-testid={testId}
    >
      {icon}
      <span className="font-display text-[10.5px] leading-none tracking-[0.02em]" aria-hidden>
        {label}
      </span>
    </button>
  );
}

/** MapIndicator — a small folded map that follows the narrative: the last place named. */
export function MapIndicator({ lifted }: { lifted: boolean }) {
  const { ed, version, chapter, state, open, reduced } = useReader();
  const current = useMemo(() => {
    for (let v = state.position.verse; v >= 1; v--) {
      const hits = (ed.entities.get(`${chapter.ref}.${v}`)?.places ?? []).filter((h) => {
        const p = ed.placeById.get(h.id);
        return p && p.lon != null && p.certainty !== 'UNKNOWN';
      });
      if (hits.length) return { id: hits[hits.length - 1].id, verse: v };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ed, version, chapter.ref, state.position.verse]);
  if (!current || state.focus) return null;
  const place = ed.placeById.get(current.id)!;
  const layer = ed.journeys.find((j) => j.segments.some((s) => s.anchor.startsWith(chapter.ref + '.'))) ?? ed.journeys.find((j) => j.era === chapter.era);
  const seg = layer?.segments.filter((s) => s.anchor.startsWith(chapter.ref + '.') && Number(s.anchor.split('.')[2]) <= state.position.verse).pop();
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open(seg ? { kind: 'atlas', layer: layer!.id, segment: seg.id } : { kind: 'atlas', place: current.id, layer: layer?.id });
      }}
      className="fixed left-3 z-20 flex min-h-[40px] items-center gap-2 rounded-full border border-[var(--rule)] bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] py-1.5 pl-2 pr-3.5 text-[var(--ink-muted)] shadow-[0_4px_14px_-6px_rgba(0,0,0,0.3)] backdrop-blur md:left-6"
      style={{ bottom: `calc(${lifted ? 76 : 14}px + env(safe-area-inset-bottom))`, transition: 'bottom 280ms cubic-bezier(.3,0,.2,1)' }}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={`Atlas: ${place.name}, ${chapter.book.name} ${chapter.number}:${current.verse}`}
      data-testid="map-indicator"
    >
      <span className="text-[var(--bronze)]">
        <GlyphCompass />
      </span>
      <motion.span key={current.id} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="font-display text-[13.5px] leading-none">
        {place.name}
      </motion.span>
      <span className="font-display text-[11px] tabular-nums text-[var(--ink-faint)]">
        {chapter.number}:{current.verse}
      </span>
    </motion.button>
  );
}
