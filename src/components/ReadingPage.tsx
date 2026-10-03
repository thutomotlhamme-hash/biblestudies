'use client';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chapterOf, formatChapter, parseRef } from '@/lib/content/refs';
import type { Chapter, Page } from '@/lib/content/types';
import { FONT_SIZES, LINE_HEIGHTS } from '@/lib/state/reader-state';
import { useMedia } from '@/lib/useMedia';
import { buildMarginItems, MarginRail } from './MarginRail';
import { useReader } from './ReaderContext';
import { ScriptureText } from './ScriptureText';

interface Props {
  onToggleChrome: () => void;
  onVerseInView: (verse: number) => void;
  scrollRequest: { chapter: string; verse: number; nonce: number } | null;
  dir: number;
}

const pageVariants = {
  enter: ({ dir, reduced }: { dir: number; reduced: boolean }) =>
    reduced ? { opacity: 0, x: 0 } : { x: dir > 0 ? '100%' : '-28%', opacity: 1, zIndex: dir > 0 ? 2 : 0 },
  center: { x: 0, opacity: 1, zIndex: 1, filter: 'brightness(1)' },
  exit: ({ dir, reduced }: { dir: number; reduced: boolean }) =>
    reduced ? { opacity: 0, x: 0 } : dir > 0 ? { x: '-28%', zIndex: 0, filter: 'brightness(0.86)' } : { x: '100%', zIndex: 2, filter: 'brightness(1)' },
};

/**
 * ReadingPage — the book. Pages turn by swipe/drag, arrow keys or controls, and the book runs on
 * from one chapter of the journey into the next. On wide screens it can open as a two-page spread.
 */
export function ReadingPage({ onToggleChrome, onVerseInView, scrollRequest, dir }: Props) {
  const { ed, chapter, state, turn, reduced, spread } = useReader();
  const tablet = useMedia('(min-width: 768px)');
  const pageIndex = spread ? Math.floor(state.position.page / 2) * 2 : state.position.page;
  const page = chapter.pages[pageIndex] ?? chapter.pages[0];
  const right = spread ? chapter.pages[pageIndex + 1] : undefined;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -70 || velocity.x < -500) turn(1);
    else if (offset.x > 70 || velocity.x > 500) turn(-1);
  };

  // stacked page edges reflect position in the whole Bible
  const frac = (chapter.index + pageIndex / Math.max(1, chapter.pages.length)) / ed.chapters.length;
  const readW = 2 + frac * 14;
  const leftW = 2 + (1 - frac) * 14;
  const width = spread ? 1320 : 744;
  const atStart = chapter.index === 0 && pageIndex === 0;
  const atEnd = chapter.index === ed.chapters.length - 1 && pageIndex + (spread ? 2 : 1) >= chapter.pages.length;

  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="reading-page" data-chapter={chapter.ref}>
      <div aria-hidden className="page-edges-left absolute top-[10px] bottom-[10px] z-0 rounded-l-sm" style={{ width: readW, left: `max(0px, calc(50% - ${width / 2 + readW}px))` }} />
      <div aria-hidden className="page-edges-right absolute top-[10px] bottom-[10px] z-0 rounded-r-sm" style={{ width: leftW, right: `max(0px, calc(50% - ${width / 2 + leftW}px))` }} />
      <AnimatePresence initial={false} custom={{ dir, reduced }}>
        <motion.div
          key={`${chapter.ref}:${pageIndex}`}
          custom={{ dir, reduced }}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduced ? { duration: 0.18 } : { duration: 0.46, ease: [0.32, 0.72, 0, 1] }}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: atEnd ? 0.08 : 0.5, right: atStart ? 0.08 : 0.5 }}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          className={`absolute inset-y-0 left-[6px] right-[8px] ${spread ? 'flex gap-0' : ''}`}
          style={{ touchAction: 'pan-y', ...(tablet ? { left: `calc(50% - ${width / 2}px)`, right: 'auto', width } : {}) }}
        >
          {!chapter.loaded ? (
            <LoadingLeaf chapter={chapter} />
          ) : (
          <>
          <PageLeaf chapter={chapter} page={page} onToggleChrome={onToggleChrome} onVerseInView={onVerseInView} scrollRequest={scrollRequest} side={spread ? 'left' : 'single'} />
          {spread &&
            (right ? (
              <PageLeaf chapter={chapter} page={right} onToggleChrome={onToggleChrome} onVerseInView={() => {}} scrollRequest={scrollRequest} side="right" />
            ) : (
              <BlankLeaf chapter={chapter} />
            ))}
          </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Shown for the moment a book is being fetched: the page, the heading, and quiet rules — no text is invented. */
function LoadingLeaf({ chapter }: { chapter: Chapter }) {
  const { ed } = useReader();
  const failed = ed.errors.length > 0;
  return (
    <div className="page grain relative flex h-full flex-1 flex-col items-center justify-center rounded-[3px]" data-testid="loading-leaf" aria-busy={!failed}>
      <div className="relative z-[1] px-8 text-center">
        <p className="running-head">{chapter.book.name.toUpperCase()}</p>
        <p className="chapter-numeral mt-2 text-[64px] opacity-40">{chapter.number}</p>
        <p className="supp mt-4 text-[14px] italic text-[var(--ink-faint)]" role="status">
          {failed ? 'This book could not be opened. Check your connection, or download the Bible for offline reading in Settings.' : 'Opening…'}
        </p>
      </div>
    </div>
  );
}

function BlankLeaf({ chapter }: { chapter: Chapter }) {
  const { ed, goTo } = useReader();
  const next = ed.chapters[chapter.index + 1];
  return (
    <div className="page grain relative flex h-full flex-1 flex-col items-center justify-center rounded-r-[3px]" style={{ boxShadow: 'inset 18px 0 24px -20px rgba(60,40,10,.35)' }}>
      <div className="relative z-[1] text-center">
        <p className="text-[var(--bronze)] opacity-60" aria-hidden>
          ◆
        </p>
        {next && (
          <button type="button" className="btn-quiet mt-4 px-4 text-[15px] italic" onClick={() => goTo(next.ref, 1)}>
            Continue · {formatChapter(next.ref)} →
          </button>
        )}
      </div>
    </div>
  );
}

interface LeafProps {
  chapter: Chapter;
  page: Page;
  onToggleChrome: () => void;
  onVerseInView: (verse: number) => void;
  scrollRequest: { chapter: string; verse: number; nonce: number } | null;
  side: 'single' | 'left' | 'right';
}

const INSERT_TAB: Record<string, string> = { context: 'Insert', scale: 'Scale', genealogy: 'Family', timeline: 'Timeline' };

function PageLeaf({ chapter, page, onToggleChrome, onVerseInView, scrollRequest, side }: LeafProps) {
  const { ed, version, state, open, overlay, reduced, wide, goTo, turn, encounterVerse, audio } = useReader();
  const scroller = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const lastVerse = useRef(0);
  const tablet = useMedia('(min-width: 768px)');

  const verses = useMemo(() => chapter.verses.filter((v) => v.verse >= page.from && v.verse <= page.to), [chapter, page]);
  // Memory notes are computed once for the page as it opens, so they do not flicker while reading.
  const [memorySnapshot] = useState(() => state);
  const items = useMemo(
    () => buildMarginItems(ed, chapter, { ...memorySnapshot, followThread: state.followThread, settings: state.settings }).filter((i) => i.verse >= page.from && i.verse <= page.to),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ed, version, chapter, memorySnapshot, state.followThread, state.settings, page],
  );
  const showApparatus = !state.focus && state.settings.marginNotes;
  const isFirst = page.index === 0;
  const isLast = page.index === chapter.pages.length - 1;
  const next = ed.chapters[chapter.index + 1];

  const linked = useMemo(() => {
    const s = new Set<number>();
    const mark = (r: string) => {
      if (chapterOf(r) === chapter.ref) s.add(parseRef(r).from);
    };
    if (overlay?.kind === 'vellum') {
      const c = ed.connections.find((c) => c.id === overlay.id);
      if (overlay.reverseTarget) mark(overlay.reverseTarget);
      else c?.sourceVerses.forEach(mark);
    }
    if (overlay?.kind === 'thread' && overlay.ref) mark(overlay.ref);
    if ((overlay?.kind === 'verse' || overlay?.kind === 'compare' || overlay?.kind === 'words') && overlay.ref) mark(overlay.ref);
    return s;
  }, [overlay, ed, chapter.ref]);

  // Scroll to a requested verse when it lives on this page.
  useEffect(() => {
    if (!scrollRequest || scrollRequest.chapter !== chapter.ref) return;
    const { verse } = scrollRequest;
    if (verse < page.from || verse > page.to) return;
    const sc = scroller.current;
    const el = sc?.querySelector<HTMLElement>(`[data-verse="${verse}"]`);
    if (!el || !sc) return;
    const id = window.setTimeout(() => {
      const top = (el.getClientRects()[0]?.top ?? 0) - sc.getBoundingClientRect().top + sc.scrollTop - 96;
      sc.scrollTo({ top: verse === page.from ? 0 : Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
    }, 60);
    return () => window.clearTimeout(id);
  }, [scrollRequest, page, reduced, chapter.ref]);

  // Keep the linked verse visible above the vellum.
  useEffect(() => {
    if (overlay?.kind !== 'vellum' || !linked.size) return;
    const first = Math.min(...linked);
    const sc = scroller.current;
    const el = sc?.querySelector<HTMLElement>(`[data-verse="${first}"]`);
    if (!el || !sc) return;
    const top = (el.getClientRects()[0]?.top ?? 0) - sc.getBoundingClientRect().top + sc.scrollTop - 70;
    sc.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }, [overlay, linked, reduced]);

  // Record what the reader actually reads: a verse counts once it is well inside the page.
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) encounterVerse((en.target as HTMLElement).dataset.ref!);
      },
      { root: sc, threshold: 0.6 },
    );
    sc.querySelectorAll('[data-ref].verse').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [page, encounterVerse, verses]);

  const onScroll = useCallback(() => {
    const sc = scroller.current;
    if (!sc || side === 'right') return;
    const base = sc.getBoundingClientRect().top + 90;
    let current = page.from;
    for (const el of sc.querySelectorAll<HTMLElement>('.verse[data-verse]')) {
      if (el.getBoundingClientRect().bottom > base) {
        current = Number(el.dataset.verse);
        break;
      }
    }
    if (current !== lastVerse.current) {
      lastVerse.current = current;
      onVerseInView(current);
    }
  }, [page.from, onVerseInView, side]);
  useEffect(() => onScroll(), [onScroll]);

  const onClick = (e: React.MouseEvent) => {
    const d = down.current;
    if ((e.target as HTMLElement).closest('button, a, [data-interactive]')) return;
    if (d && (Math.abs(e.clientX - d.x) > 8 || Math.abs(e.clientY - d.y) > 8)) return;
    if (window.getSelection()?.toString()) return;
    onToggleChrome();
  };

  const fontSize = Math.round(FONT_SIZES[Math.min(FONT_SIZES.length - 1, state.settings.fontStep + (state.settings.family ? 1 : 0))] * (tablet ? 1.1 : 1) * 10) / 10;
  const railWide = wide;
  const inserts = ed.inserts.filter((i) => chapterOf(i.anchorVerse) === chapter.ref && parseRef(i.anchorVerse).from >= page.from && parseRef(i.anchorVerse).from <= page.to);
  const ribbons = state.bookmarks.filter((b) => b.chapter === chapter.ref && b.verse >= page.from && b.verse <= page.to);
  const firstOfBook = chapter.number === 1;
  const tp = chapter.book.titleParts;
  const eyebrow = tp?.pre ?? '';
  const titleMain = tp?.main ?? chapter.book.name.toUpperCase();
  const titlePost = tp?.post ?? '';
  // Name spans are character ranges in the KJV text, so places are wrapped only when reading the KJV.
  const kjv = ed.translation.translation.id === 'kjv';
  const hitsFor = (ref: string) => (kjv ? ed.entities.get(ref)?.places ?? [] : []);
  const italicsFor = (ref: string) => (kjv && state.settings.italics ? ed.translation.italics(ref) : undefined);

  return (
    <article
      className={`page grain relative h-full min-w-0 flex-1 overflow-hidden ${side === 'left' ? 'rounded-l-[3px]' : side === 'right' ? 'rounded-r-[3px]' : 'rounded-[3px]'}`}
      style={side === 'left' ? { boxShadow: 'inset -18px 0 24px -20px rgba(60,40,10,.35), var(--shadow-page)' } : side === 'right' ? { boxShadow: 'inset 18px 0 24px -20px rgba(60,40,10,.35), var(--shadow-page)' } : undefined}
      aria-label={`${chapter.book.name} chapter ${chapter.number}, verses ${page.from} to ${page.to}. ${ed.translation.translation.name}.`}
      lang="en"
      data-page-side={side}
    >
      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
        onClick={onClick}
        className="scroll-quiet relative z-[1] h-full overflow-y-auto overscroll-contain"
        data-testid={side === 'right' ? 'page-scroller-right' : 'page-scroller'}
        tabIndex={-1}
      >
        <div className={`relative mx-auto ${tablet ? 'px-14' : 'pl-[22px] pr-[40px]'} pb-40 pt-[max(22px,env(safe-area-inset-top))]`}>
          <header
            className={`running-head flex items-baseline justify-between pb-3 transition-opacity duration-500 ${state.focus ? 'opacity-0' : 'opacity-100'}`}
            style={{ paddingRight: railWide ? 60 : 0 }}
            aria-hidden={state.focus}
          >
            <span>{chapter.book.name}</span>
            <span className="tabular-nums tracking-[0.12em]">
              {chapter.number}:{page.from}–{page.to}
            </span>
          </header>
          <div className="h-px w-full bg-[var(--rule)]" style={{ marginRight: railWide ? 60 : 0 }} />

          {isFirst && (
            <div className={`${firstOfBook ? 'pt-9' : 'pt-7'} text-center`} style={{ paddingRight: railWide ? 60 : 0 }}>
              {firstOfBook ? (
                <>
                  {eyebrow && (
                    <p className="running-head mx-auto max-w-[22em]" style={{ letterSpacing: '0.3em', fontSize: 10.5 }}>
                      {eyebrow}
                    </p>
                  )}
                  <h1 className="mt-1 font-display text-[30px] font-medium tracking-[0.14em] text-ink md:text-[36px]" aria-label={chapter.book.name}>{titleMain}</h1>
                  {titlePost && <p className="running-head mx-auto mt-1 max-w-[24em] normal-case italic" style={{ letterSpacing: '0.04em', fontSize: 12 }}>{titlePost}</p>}
                </>
              ) : (
                <h1 className="font-display text-[15px] font-medium tracking-[0.34em] text-[var(--ink-muted)]">{chapter.book.name.toUpperCase()}</h1>
              )}
              <div className="mx-auto mt-3 flex items-center justify-center gap-2 text-[var(--bronze)] opacity-70" aria-hidden>
                <span className="h-px w-8 bg-current" />
                <span className="text-[9px]">◆</span>
                <span className="h-px w-8 bg-current" />
              </div>
            </div>
          )}

          <div className={`relative ${isFirst ? 'pt-7' : 'pt-6'}`} style={{ paddingRight: railWide ? 136 : 0 }}>
            {isFirst && (
              <h2 className="chapter-numeral float-left mr-3 mt-[0.08em]" style={{ fontSize: `${fontSize * 3.6}px` }} aria-label={`Chapter ${chapter.number}`}>
                {chapter.number}
              </h2>
            )}
            <div ref={textRef} className="relative" style={{ fontSize }}>
              <ScriptureText
                verses={verses}
                hitsFor={hitsFor}
                italicsFor={italicsFor}
                linkPlaces={showApparatus}
                withDropCap={isFirst && state.settings.layout === 'paragraph'}
                linked={linked}
                layout={state.settings.layout === 'verse' || (chapter.book.poetry && state.settings.layout !== 'paragraph') ? 'verse' : 'paragraph'}
                highlights={state.highlights}
                notes={state.notes}
                reading={audio.ref}
                onPlace={(id) => open({ kind: 'place', id })}
                onVerse={(ref) => open({ kind: 'verse', ref })}
              />
            </div>
            {showApparatus && (
              <div className="pointer-events-none absolute inset-0" style={{ right: railWide ? 0 : -40 }}>
                <div className="pointer-events-auto">
                  <MarginRail items={items} textRef={textRef} measureKey={`${state.settings.fontStep}-${state.settings.lineStep}-${chapter.ref}-${page.index}`} wide={railWide} />
                </div>
              </div>
            )}
          </div>

          <footer className="mt-10 flex flex-col items-center gap-4" style={{ paddingRight: railWide ? 60 : 0 }}>
            {isLast ? (
              <div className="text-center">
                <div className="mx-auto mb-5 flex items-center justify-center gap-2 text-[var(--bronze)] opacity-70" aria-hidden>
                  <span className="h-px w-10 bg-current" />
                  <span className="text-[9px]">◆</span>
                  <span className="h-px w-10 bg-current" />
                </div>
                {next ? (
                  <button type="button" className="btn-quiet px-4 text-[15px] italic" onClick={() => goTo(next.ref, 1)} data-testid="continue-chapter">
                    Continue · {formatChapter(next.ref)} <span aria-hidden>→</span>
                  </button>
                ) : (
                  <p className="supp text-[14px] italic">The end of the Holy Bible</p>
                )}
              </div>
            ) : (
              side !== 'left' && (
                <button type="button" className="btn-quiet px-4 text-[13px] italic" onClick={() => turn(1)} aria-label="Turn to the next page">
                  <span className="tracking-wide">turn the page</span>
                  <span aria-hidden>→</span>
                </button>
              )
            )}
            <p className="font-display text-[12px] tracking-[0.3em] text-[var(--ink-faint)]" aria-label={`Page ${page.index + 1} of ${chapter.pages.length} in ${chapter.book.name} ${chapter.number}`}>
              · {page.index + 1} ·
            </p>
          </footer>
        </div>
      </div>

      {/* bookmark ribbons */}
      {ribbons.length > 0 && !state.focus && (
        <div aria-hidden className="pointer-events-none absolute right-[18%] top-0 z-[3] flex gap-[5px]">
          {ribbons.map((b) => (
            <span key={b.id} className="ribbon block h-[58px] w-[10px]" data-testid="bookmark-ribbon" style={{ background: b.color === 'crimson' ? undefined : `var(--ribbon-${b.color})` }} />
          ))}
        </div>
      )}

      {/* tipped-in inserts */}
      {!state.focus && (
        <div className="absolute right-0 top-[62px] z-[2] flex flex-col gap-2">
          {inserts.map((ins) => (
            <button
              key={ins.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                open({ kind: 'insert', id: ins.id });
              }}
              className="insert-stock flex h-[88px] w-[26px] items-center justify-center rounded-l-[2px] border border-r-0 border-[var(--rule)]"
              style={{ boxShadow: '-2px 2px 6px rgba(0,0,0,0.12)' }}
              aria-label={`${INSERT_TAB[ins.kind]} insert: ${ins.title}`}
              data-testid={`insert-tab-${ins.id}`}
            >
              <span className="label-caps text-[9px] text-[var(--ink-muted)]" style={{ writingMode: 'vertical-rl', letterSpacing: '0.24em' }}>
                {INSERT_TAB[ins.kind]}
              </span>
            </button>
          ))}
        </div>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-16" style={{ background: 'linear-gradient(to top, var(--paper-deep), transparent)' }} />
      <style>{`.scripture{--read-size:${fontSize}px;--read-leading:${LINE_HEIGHTS[state.settings.lineStep]}}`}</style>
    </article>
  );
}
