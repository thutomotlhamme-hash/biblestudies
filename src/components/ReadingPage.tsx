'use client';
import { motion, type PanInfo } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { mapHits } from '@/lib/content/names';
import { chapterOf, formatChapter, formatRef as fmtRef, parseRef } from '@/lib/content/refs';
import type { Chapter, Leaf } from '@/lib/content/types';
import type { Hit } from '@/lib/content/segment';
import { FONT_SIZES, LINE_HEIGHTS } from '@/lib/state/reader-state';
import { useMedia } from '@/lib/useMedia';
import { buildMarginItems, MarginRail } from './MarginRail';
import { useReader } from './ReaderContext';
import { ScriptureText } from './ScriptureText';

interface Props {
  onToggleChrome: () => void;
  onVerseInView: (ref: string) => void;
  scrollRequest: { chapter: string; verse: number; nonce: number } | null;
  dir: number;
  /** Increases with each turn or jump the reader makes; only those animate. */
  moves: number;
}

type View = { book: string; left: number; right: number | null };
type Flip = { from: View; to: View; dir: number; id: number };

const FLIP_MS = 520;
const EASE = [0.45, 0.05, 0.25, 1] as const;

/**
 * ReadingPage — the book. Leaves run through a book from chapter to chapter, as a printed Bible does,
 * and the book runs on into the next. A turn lifts the leaf from the spine and lays it over: on a
 * phone the page curls away to the left; on a wide screen the right-hand leaf swings over the spine,
 * the next page printed on its back. Turn by swipe/drag, arrow keys or the controls.
 */
export function ReadingPage({ onToggleChrome, onVerseInView, scrollRequest, dir, moves }: Props) {
  const { ed, chapter, state, turn, reduced, spread } = useReader();
  const tablet = useMedia('(min-width: 768px)');
  const book = chapter.book.osis;
  const leaves = ed.leaves.get(book) ?? [];
  const here = chapter.pages[state.position.page]?.leaf ?? 0;
  const left = spread ? Math.floor(here / 2) * 2 : here;
  const view: View = { book, left, right: spread ? left + 1 : null };
  const viewKey = `${book}:${left}:${spread ? 's' : '1'}`;

  // the flip: remember what was showing, animate from it to what shows now
  const shown = useRef<{ key: string; view: View; moves: number } | null>(null);
  const [flip, setFlip] = useState<Flip | null>(null);
  useLayoutEffect(() => {
    const prev = shown.current;
    shown.current = { key: viewKey, view, moves };
    // a re-layout or a change of screen moves the leaves without the reader turning: no animation
    if (!prev || prev.key === viewKey || prev.moves === moves || reduced || !chapter.loaded) return;
    if (!ed.leaves.get(prev.view.book)?.[prev.view.left]) return;
    // a different book, or a jump: turn in the direction of travel
    setFlip({ from: prev.view, to: view, dir: dir >= 0 ? 1 : -1, id: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, chapter.loaded]);
  useEffect(() => {
    if (!flip) return;
    const t = window.setTimeout(() => setFlip(null), FLIP_MS + 40);
    return () => window.clearTimeout(t);
  }, [flip]);

  const onPanEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (Math.abs(offset.y) > Math.abs(offset.x)) return;
    if (offset.x < -70 || velocity.x < -500) turn(1);
    else if (offset.x > 70 || velocity.x > 500) turn(-1);
  };

  // stacked page edges reflect position in the whole Bible
  const frac = (chapter.index + left / Math.max(1, leaves.length) / Math.max(1, ed.chapters.filter((c) => c.book.osis === book).length)) / ed.chapters.length;
  const readW = 2 + frac * 14;
  const leftW = 2 + (1 - frac) * 14;
  const width = spread ? 1320 : 744;
  const ready = chapter.loaded && leaves.length > 0;
  const leafProps = { onToggleChrome, onVerseInView, scrollRequest };

  const live = (v: View, side: 'single' | 'left' | 'right') => {
    const idx = side === 'right' ? v.right! : v.left;
    const leaf = ed.leaves.get(v.book)?.[idx];
    if (!leaf) return side === 'right' ? <BlankLeaf key={`blank:${v.book}`} book={v.book} /> : null;
    return <PageLeaf key={`${v.book}:${idx}`} leaf={leaf} side={side} {...leafProps} onVerseInView={side === 'right' ? () => {} : onVerseInView} />;
  };
  const ghost = (v: View, side: 'single' | 'left' | 'right') => {
    const idx = side === 'right' ? v.right! : v.left;
    const leaf = ed.leaves.get(v.book)?.[idx];
    return (
      <div className="flex h-full min-w-0 flex-1" data-ghost inert>
        {leaf ? <PageLeaf leaf={leaf} side={side} ghost {...leafProps} onVerseInView={() => {}} /> : <BlankLeaf book={v.book} />}
      </div>
    );
  };

  let stage: React.ReactNode;
  if (!ready) stage = <LoadingLeaf chapter={chapter} />;
  else if (!flip) stage = spread ? (
    <>
      {live(view, 'left')}
      {live(view, 'right')}
    </>
  ) : (
    live(view, 'single')
  );
  else if (!spread) {
    // phone: forward, the old leaf curls away to the left over the new; back, the previous leaf lays back down
    const forward = flip.dir > 0;
    stage = (
      <>
        {forward ? ghost(flip.to, 'single') : ghost(flip.from, 'single')}
        <motion.div
          key={flip.id}
          className="absolute inset-0 z-[5] flex"
          style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d', willChange: 'transform', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          initial={{ rotateY: forward ? 0 : -95 }}
          animate={{ rotateY: forward ? -95 : 0 }}
          transition={{ duration: FLIP_MS / 1000, ease: EASE }}
        >
          {ghost(forward ? flip.from : flip.to, 'single')}
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[3px]" style={{ background: 'linear-gradient(to left, rgba(40,25,5,.38), rgba(40,25,5,.08) 45%, transparent 70%)' }} initial={{ opacity: forward ? 0 : 1 }} animate={{ opacity: forward ? 1 : 0 }} transition={{ duration: FLIP_MS / 1000, ease: EASE }} />
        </motion.div>
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-[4] rounded-[3px] bg-black" initial={{ opacity: forward ? 0.16 : 0 }} animate={{ opacity: forward ? 0 : 0.16 }} transition={{ duration: FLIP_MS / 1000, ease: EASE }} />
      </>
    );
  } else {
    // spread: the turning leaf swings over the spine, the next page printed on its back
    const forward = flip.dir > 0;
    const sideFront = forward ? 'right' : 'left';
    const sideBack = forward ? 'left' : 'right';
    stage = (
      <>
        {/* the incoming pages come alive together when the turn is done, so verses are read in order */}
        {forward ? ghost(flip.from, 'left') : ghost(flip.to, 'left')}
        {forward ? ghost(flip.to, 'right') : ghost(flip.from, 'right')}
        <motion.div
          key={flip.id}
          className="absolute inset-y-0 z-[5] w-1/2"
          style={{ [forward ? 'left' : 'right']: '50%', transformOrigin: forward ? 'left center' : 'right center', transformStyle: 'preserve-3d', willChange: 'transform' } as React.CSSProperties}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: forward ? -180 : 180 }}
          transition={{ duration: (FLIP_MS + 120) / 1000, ease: EASE }}
        >
          <div className="absolute inset-0 flex" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            {ghost(flip.from, sideFront)}
          </div>
          <div className="absolute inset-0 flex" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            {ghost(flip.to, sideBack)}
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="reading-page" data-chapter={chapter.ref}>
      <div aria-hidden className="page-edges-left absolute top-[10px] bottom-[10px] z-0 rounded-l-sm" style={{ width: readW, left: `max(0px, calc(50% - ${width / 2 + readW}px))` }} />
      <div aria-hidden className="page-edges-right absolute top-[10px] bottom-[10px] z-0 rounded-r-sm" style={{ width: leftW, right: `max(0px, calc(50% - ${width / 2 + leftW}px))` }} />
      <motion.div
        drag={flip ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        dragMomentum={false}
        onDragEnd={onPanEnd}
        className={`absolute inset-y-0 left-[6px] right-[8px] ${spread ? 'flex gap-0' : 'flex'}`}
        style={{ touchAction: 'pan-y', perspective: 2400, ...(tablet ? { left: `calc(50% - ${width / 2}px)`, right: 'auto', width } : {}) }}
      >
        {stage}
      </motion.div>
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

/** The blank right-hand leaf at the end of a book, on a two-page spread. */
function BlankLeaf({ book }: { book: string }) {
  const { ed, goTo } = useReader();
  const last = [...ed.chapters].reverse().find((c) => c.book.osis === book);
  const next = last ? ed.chapters[last.index + 1] : undefined;
  return (
    <div className="page grain relative flex h-full flex-1 flex-col items-center justify-center rounded-r-[3px]" style={{ boxShadow: 'inset 18px 0 24px -20px rgba(60,40,10,.35)' }}>
      <div className="relative z-[1] text-center">
        <p className="text-[var(--bronze)] opacity-60" aria-hidden>
          ◆
        </p>
        {next && (
          <button type="button" className="btn-quiet mt-4 px-4 text-[15px] italic" onClick={() => goTo(next.ref, 1)}>
            Continue · {next.book.name} <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </div>
  );
}

interface LeafProps {
  leaf: Leaf;
  onToggleChrome: () => void;
  onVerseInView: (ref: string) => void;
  scrollRequest: { chapter: string; verse: number; nonce: number } | null;
  side: 'single' | 'left' | 'right';
  /** A copy shown only while a leaf turns: no apparatus, not interactive. */
  ghost?: boolean;
}

const INSERT_TAB: Record<string, string> = { context: 'Insert', scale: 'Scale', genealogy: 'Family', timeline: 'Timeline' };

function PageLeaf({ leaf, onToggleChrome, onVerseInView, scrollRequest, side, ghost }: LeafProps) {
  const { ed, version, state, open, overlay, reduced, wide, goTo, turn, encounterVerse, audio } = useReader();
  const scroller = useRef<HTMLDivElement>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const lastRef = useRef('');
  const tablet = useMedia('(min-width: 768px)');
  const segs = leaf.segments.map((s) => ({ ...s, chapter: ed.chapterByRef.get(s.chapter)! }));
  const book = segs[0].chapter.book;
  const leaves = ed.leaves.get(book.osis) ?? [];
  const isLastLeaf = leaf.index === leaves.length - 1;
  const lastChapter = segs[segs.length - 1].chapter;
  const nextBook = isLastLeaf ? ed.chapters[lastChapter.index + 1] : undefined;
  const refsOnLeaf = useMemo(() => segs.flatMap((s) => s.chapter.verses.filter((v) => v.verse >= s.from && v.verse <= s.to).map((v) => v.ref)), [leaf, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const linked = useMemo(() => {
    const s = new Set<string>();
    if (overlay?.kind === 'vellum') {
      const c = ed.connections.find((c) => c.id === overlay.id);
      if (overlay.reverseTarget) s.add(overlay.reverseTarget);
      else c?.sourceVerses.forEach((r) => s.add(r));
    }
    if (overlay?.kind === 'thread' && overlay.ref) s.add(overlay.ref);
    if ((overlay?.kind === 'verse' || overlay?.kind === 'compare' || overlay?.kind === 'words') && overlay.ref) s.add(overlay.ref);
    return s;
  }, [overlay, ed]);

  // Scroll to a requested verse when it lives on this leaf.
  useEffect(() => {
    if (ghost || !scrollRequest) return;
    const ref = `${scrollRequest.chapter}.${scrollRequest.verse}`;
    if (!refsOnLeaf.includes(ref)) return;
    const sc = scroller.current;
    const el = sc?.querySelector<HTMLElement>(`[data-ref="${ref}"].verse`);
    if (!el || !sc) return;
    const id = window.setTimeout(() => {
      // leaves fit the screen, so the verse is normally in view already: scroll only if it is not
      const box = sc.getBoundingClientRect();
      const r = el.getClientRects()[0];
      if (!r || (r.top >= box.top && r.bottom <= box.bottom - 60)) return;
      const top = r.top - box.top + sc.scrollTop - 96;
      sc.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
    }, 60);
    return () => window.clearTimeout(id);
  }, [scrollRequest, refsOnLeaf, reduced, ghost]);

  // Keep the linked verse visible above the vellum.
  useEffect(() => {
    if (ghost || overlay?.kind !== 'vellum' || !linked.size) return;
    const sc = scroller.current;
    const el = [...(sc?.querySelectorAll<HTMLElement>('.verse[data-ref]') ?? [])].find((e) => linked.has(e.dataset.ref!));
    if (!el || !sc) return;
    const top = (el.getClientRects()[0]?.top ?? 0) - sc.getBoundingClientRect().top + sc.scrollTop - 70;
    sc.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }, [overlay, linked, reduced, ghost]);

  // Record what the reader actually reads: a verse counts once it is well inside the page.
  useEffect(() => {
    const sc = scroller.current;
    if (!sc || ghost) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) encounterVerse((en.target as HTMLElement).dataset.ref!);
      },
      { root: sc, threshold: 0.6 },
    );
    sc.querySelectorAll('[data-ref].verse').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [refsOnLeaf, encounterVerse, ghost]);

  const onScroll = useCallback(() => {
    const sc = scroller.current;
    if (!sc || side === 'right' || ghost) return;
    const base = sc.getBoundingClientRect().top + 90;
    let current = refsOnLeaf[0];
    for (const el of sc.querySelectorAll<HTMLElement>('.verse[data-ref]')) {
      if (el.getBoundingClientRect().bottom > base) {
        current = el.dataset.ref!;
        break;
      }
    }
    if (current && current !== lastRef.current) {
      lastRef.current = current;
      onVerseInView(current);
    }
  }, [refsOnLeaf, onVerseInView, side, ghost]);
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
  const showApparatus = !state.focus && state.settings.marginNotes && !ghost;
  const within = (ref: string) => refsOnLeaf.includes(ref);
  const inserts = ghost ? [] : ed.inserts.filter((i) => within(`${chapterOf(i.anchorVerse)}.${parseRef(i.anchorVerse).from}`));
  const ribbons = state.bookmarks.filter((b) => within(`${b.chapter}.${b.verse}`));
  const first = segs[0];
  const last = segs[segs.length - 1];
  const range = first.chapter.ref === last.chapter.ref ? `${first.chapter.number}:${first.from}–${last.to}` : `${first.chapter.number}:${first.from} – ${last.chapter.number}:${last.to}`;

  return (
    <article
      className={`page grain relative h-full min-w-0 flex-1 overflow-hidden ${side === 'left' ? 'rounded-l-[3px]' : side === 'right' ? 'rounded-r-[3px]' : 'rounded-[3px]'}`}
      style={side === 'left' ? { boxShadow: 'inset -18px 0 24px -20px rgba(60,40,10,.35), var(--shadow-page)' } : side === 'right' ? { boxShadow: 'inset 18px 0 24px -20px rgba(60,40,10,.35), var(--shadow-page)' } : undefined}
      aria-label={`${book.name} ${range}. ${ed.translation.translation.name}.`}
      lang="en"
      data-page-side={ghost ? undefined : side}
    >
      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
        onClick={onClick}
        className="scroll-quiet relative z-[1] h-full overflow-y-auto overscroll-contain"
        data-testid={ghost ? undefined : side === 'right' ? 'page-scroller-right' : 'page-scroller'}
        tabIndex={-1}
      >
        <div className={`relative mx-auto ${tablet ? 'px-14' : 'pl-[22px] pr-[40px]'} pb-40 pt-[max(22px,env(safe-area-inset-top))]`}>
          <header
            className={`running-head flex items-baseline justify-between pb-3 transition-opacity duration-500 ${state.focus ? 'opacity-0' : 'opacity-100'}`}
            style={{ paddingRight: railWide ? 60 : 0 }}
            aria-hidden={state.focus}
          >
            <span>{book.name}</span>
            <span className="tabular-nums tracking-[0.12em]">{range}</span>
          </header>
          <div className="h-px w-full bg-[var(--rule)]" style={{ marginRight: railWide ? 60 : 0 }} />

          <div data-leaf-text className="pt-1">
            {segs.map((s, i) => (
              <Segment key={`${s.chapter.ref}:${s.from}`} seg={s} top={i === 0} fontSize={fontSize} linked={linked} showApparatus={showApparatus} railWide={railWide} ghost={!!ghost} reading={s.chapter.ref === state.position.chapter} />
            ))}
          </div>

          <footer className="mt-10 flex flex-col items-center gap-4" style={{ paddingRight: railWide ? 60 : 0 }}>
            {isLastLeaf ? (
              <div className="text-center">
                <div className="mx-auto mb-5 flex items-center justify-center gap-2 text-[var(--bronze)] opacity-70" aria-hidden>
                  <span className="h-px w-10 bg-current" />
                  <span className="text-[9px]">◆</span>
                  <span className="h-px w-10 bg-current" />
                </div>
                {nextBook ? (
                  <button type="button" className="btn-quiet px-4 text-[15px] italic" onClick={() => goTo(nextBook.ref, 1)} data-testid={ghost ? undefined : 'continue-chapter'}>
                    Continue · {formatChapter(nextBook.ref)} <span aria-hidden>→</span>
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
            <p className="font-display text-[12px] tracking-[0.3em] text-[var(--ink-faint)]" aria-label={`Page ${leaf.index + 1} of ${leaves.length} in ${book.name}`}>
              · {leaf.index + 1} ·
            </p>
          </footer>
        </div>
      </div>

      {/* bookmark ribbons */}
      {ribbons.length > 0 && !state.focus && (
        <div aria-hidden className="pointer-events-none absolute right-[18%] top-0 z-[3] flex gap-[5px]">
          {ribbons.map((b) => (
            <span key={b.id} className="ribbon block h-[58px] w-[10px]" data-testid={ghost ? undefined : 'bookmark-ribbon'} style={{ background: b.color === 'crimson' ? undefined : `var(--ribbon-${b.color})` }} />
          ))}
        </div>
      )}

      {/* tipped-in inserts */}
      {!state.focus && inserts.length > 0 && (
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

/** One chapter's run of verses on a leaf — with the chapter's opening where it begins. */
function Segment({ seg, top, fontSize, linked, showApparatus, railWide, ghost, reading }: { seg: { chapter: Chapter; from: number; to: number; opens: boolean }; top: boolean; fontSize: number; linked: Set<string>; showApparatus: boolean; railWide: boolean; ghost: boolean; reading: boolean }) {
  const { ed, version, state, open, audio } = useReader();
  const textRef = useRef<HTMLDivElement>(null);
  const chapter = seg.chapter;
  const verses = useMemo(() => chapter.verses.filter((v) => v.verse >= seg.from && v.verse <= seg.to), [chapter, seg.from, seg.to, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [memorySnapshot] = useState(() => state);
  const items = useMemo(
    () => (showApparatus ? buildMarginItems(ed, chapter, { ...memorySnapshot, followThread: state.followThread, settings: state.settings }).filter((i) => i.verse >= seg.from && i.verse <= seg.to) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ed, version, chapter, memorySnapshot, state.followThread, state.settings, seg.from, seg.to, showApparatus],
  );
  const firstOfBook = chapter.number === 1;
  const tp = chapter.book.titleParts;
  // Name spans are character ranges in the KJV text. In another translation a name is marked only
  // where that translation spells it exactly as the KJV does (mapHits); nothing in the text changes.
  const kjv = ed.translation.translation.id === 'kjv';
  const hitsFor = (ref: string) => {
    const e = ed.entities.get(ref);
    const hits: Hit[] = [
      ...(e?.places ?? []).map((h) => ({ ...h, kind: 'place' as const })),
      ...(state.settings.names ? (e?.names ?? []).map((h) => ({ ...h, kind: 'person' as const })) : []),
      ...(ed.aramaicWordsAt.get(ref) ?? []).map((h) => ({ ...h, kind: 'aramaic' as const })),
    ];
    if (kjv || !hits.length) return hits;
    const k = ed.kjv.hasBook(chapter.book.osis) ? ed.kjv.verse(ref)?.text : undefined;
    const t = ed.translation.verse(ref)?.text;
    return k && t ? mapHits(k, hits, t) : [];
  };
  // a chapter's opening heading is set above the chapter numeral; the rest stand above their verses
  const headingOf = (ref: string) => (state.settings.headings ? ed.headings.get(ref)?.label : undefined);
  const openingHeading = seg.opens ? headingOf(`${chapter.ref}.1`) : undefined;
  const headingFor = (ref: string) => (seg.opens && ref === `${chapter.ref}.1` ? undefined : headingOf(ref));
  const italicsFor = (ref: string) => (kjv && state.settings.italics ? ed.translation.italics(ref) : undefined);
  // Aramaic passages: a mark where one begins (or carries on at the top of a leaf), and a faint wash
  const aramaicFor = (ref: string) => ed.aramaicVerses.has(ref);
  const markFor = (ref: string) => {
    const p = ed.aramaicPassageAt.get(ref);
    if (!p || (p.from !== ref && !(top && ref === `${chapter.ref}.${seg.from}`))) return null;
    const range = p.from === p.to ? fmtRef(p.from) : `${fmtRef(p.from)} – ${fmtRef(p.to).replace(/^.* (?=\d+:)/, '')}`;
    return (
      <button type="button" className="aramaic-mark" onClick={(e) => { e.stopPropagation(); open({ kind: 'aramaic' }); }} data-testid={ghost ? undefined : 'aramaic-mark'} title="Supplementary — not Scripture. Tap to learn about Aramaic.">
        <span className="script" lang="arc">אֲרָמִית</span> {p.from === ref ? 'Written in Aramaic' : 'Aramaic continues'} · {range}
      </button>
    );
  };
  const chapterLinked = useMemo(() => new Set([...linked].filter((r) => chapterOf(r) === chapter.ref).map((r) => parseRef(r).from)), [linked, chapter.ref]);

  return (
    <section data-chapter-segment={chapter.ref}>
      {seg.opens && (
        <div className={`chapter-opening ${top ? (firstOfBook ? 'pt-9' : 'pt-7') : 'pt-8'} text-center`} style={{ paddingRight: railWide ? 60 : 0 }}>
          {firstOfBook ? (
            <div className="book-title">
              {tp?.pre && (
                <p className="running-head mx-auto max-w-[22em]" style={{ letterSpacing: '0.3em', fontSize: 10.5 }}>
                  {tp.pre}
                </p>
              )}
              <h1 className="mt-1 font-display text-[30px] font-medium tracking-[0.14em] text-ink md:text-[36px]" aria-label={chapter.book.name}>
                {tp?.main ?? chapter.book.name.toUpperCase()}
              </h1>
              {tp?.post && (
                <p className="running-head mx-auto mt-1 max-w-[24em] normal-case italic" style={{ letterSpacing: '0.04em', fontSize: 12 }}>
                  {tp.post}
                </p>
              )}
            </div>
          ) : (
            top && <h1 className="font-display text-[15px] font-medium tracking-[0.34em] text-[var(--ink-muted)]">{chapter.book.name.toUpperCase()}</h1>
          )}
          <div className="mx-auto mt-3 flex items-center justify-center gap-2 text-[var(--bronze)] opacity-70" aria-hidden>
            <span className="h-px w-8 bg-current" />
            <span className="text-[9px]">◆</span>
            <span className="h-px w-8 bg-current" />
          </div>
          {openingHeading && (
            <p className="section-heading section-heading-first mt-5" role="heading" aria-level={3} data-testid={ghost ? undefined : 'section-heading'} title="Section heading — supplementary, not Scripture">
              {openingHeading}
            </p>
          )}
        </div>
      )}
      <div className={`relative ${seg.opens ? 'pt-5' : top ? 'pt-6' : 'pt-2'}`} style={{ paddingRight: railWide ? 136 : 0 }}>
        {seg.opens && (
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
            withDropCap={seg.opens && state.settings.layout === 'paragraph'}
            linked={chapterLinked}
            layout={state.settings.layout === 'verse' || (chapter.book.poetry && state.settings.layout !== 'paragraph') ? 'verse' : 'paragraph'}
            highlights={state.highlights}
            notes={state.notes}
            reading={audio.ref}
            onPlace={(id) => open({ kind: 'place', id })}
            onPerson={(id) => open({ kind: 'person', id })}
            onAramaic={(id) => open({ kind: 'aramaic', focus: id })}
            aramaicFor={aramaicFor}
            markFor={markFor}
            headingFor={headingFor}
            onVerse={(ref) => open({ kind: 'verse', ref })}
            numberIds={reading && !ghost ? '' : `${chapter.ref}-`}
          />
        </div>
        {showApparatus && (
          <div className="pointer-events-none absolute inset-0" style={{ right: railWide ? 0 : -40 }}>
            <div className="pointer-events-auto">
              <MarginRail items={items} textRef={textRef} measureKey={`${state.settings.fontStep}-${state.settings.lineStep}-${chapter.ref}-${seg.from}`} wide={railWide} />
            </div>
          </div>
        )}
        <div className="clear-both" />
      </div>
    </section>
  );
}
