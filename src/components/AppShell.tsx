'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deviceVoice, recorded } from '@/lib/audio/audio';
import { chapterOf, formatRef, parseRef } from '@/lib/content/refs';
import { pageForVerse, type PageFit } from '@/lib/content/repository';
import type { ChapterRef, VerseRef } from '@/lib/content/types';
import { useLibrary } from '@/lib/library/useLibrary';
import { setAmbience, sounds } from '@/lib/sound';
import { useReaderState } from '@/lib/state/reader-state';
import { useSync } from '@/lib/sync/sync';
import { useMedia, useViewportWidth } from '@/lib/useMedia';
import { Atlas } from './Atlas';
import { AudioBar } from './AudioBar';
import { BibleCover } from './BibleCover';
import { CompareSheet } from './CompareSheet';
import { DeepSheet } from './DeepSheet';
import { Contents } from './Contents';
import { ContextInsert } from './ContextInsert';
import { PersonSheet, PhraseSheet, PlaceSheet } from './Evidence';
import { FamilyPanel } from './FamilyPanel';
import { GenealogyGatefold } from './GenealogyGatefold';
import { IconReturn } from './Icons';
import { MyBible } from './MyBible';
import { MapIndicator, ReadingControls } from './ReadingControls';
import { ReaderContext, type AudioCtl, type Overlay, type ReaderCtx } from './ReaderContext';
import { ReadingPage } from './ReadingPage';
import { ScaleInsert } from './ScaleInsert';
import { SearchSheet } from './SearchSheet';
import { SettingsPanel } from './SettingsPanel';
import { ThreadDrawer } from './ThreadDrawer';
import { TimelineStrip } from './TimelineStrip';
import { VellumOverlay } from './VellumOverlay';
import { VerseSheet } from './VerseSheet';
import { WordStudy } from './WordStudy';

export function AppShell() {
  const { lib: ed, version } = useLibrary();
  const { state, update, updateSettings, encounter, hydrated, hadSaved, replace } = useReaderState();
  const [phase, setPhase] = useState<'cover' | 'reading'>('cover');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [chrome, setChrome] = useState(false);
  const [dir, setDir] = useState(1);
  const [scrollRequest, setScrollRequest] = useState<{ chapter: string; verse: number; nonce: number } | null>(null);
  const systemReduced = useMedia('(prefers-reduced-motion: reduce)');
  const wide = useMedia('(min-width: 900px)');
  const vw = useViewportWidth();
  const spread = state.settings.spread && vw >= 1360;
  const reduced = state.settings.motion === 'reduce' || (state.settings.motion === 'system' && systemReduced);
  const chapter = ed.chapterByRef.get(state.position.chapter) ?? ed.chapters[0];
  useSync(state, replace, hydrated);

  // The translation being read, and the books around the reader, are loaded as needed.
  useEffect(() => {
    if (!hydrated) return;
    ed.setTranslation(state.settings.translation);
    void ed.init();
  }, [ed, hydrated, state.settings.translation]);
  useEffect(() => {
    if (!hydrated) return;
    void ed.ensureChapter(chapter.ref);
    const prev = ed.chapters[chapter.index - 1];
    const next = ed.chapters[chapter.index + 1];
    const t = window.setTimeout(() => {
      if (prev) void ed.ensureChapter(prev.ref);
      if (next) void ed.ensureChapter(next.ref);
    }, 400);
    return () => window.clearTimeout(t);
  }, [ed, hydrated, chapter, version, state.settings.translation]);

  useEffect(() => {
    if (phase !== 'reading') return;
    const warm = () => {
      void ed.ensureMap();
      void ed.ensurePlaces();
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const t = window.setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(warm, { timeout: 4000 }) : warm()), 1500);
    return () => window.clearTimeout(t);
  }, [ed, phase]);

  // Every screen — phone, tablet, laptop: fit each page to the page actually on screen, so a page is
  // read whole rather than scrolled. Start generous whenever the screen or type changes, then measure
  // how much text a line of this page holds and how much room the page has, and paginate to that.
  const fitKey = `${vw}-${state.settings.fontStep}-${state.settings.lineStep}-${state.settings.legible}-${state.settings.layout}-${spread}-${state.settings.family}`;
  const [vh, setVh] = useState(0);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const measured = useRef({ normal: false, first: false });
  const [fitSettled, setFitSettled] = useState(false);
  const FIT_STORE = 'holy-bible.page-fit';
  useEffect(() => {
    if (!hydrated || !vh) return;
    // a screen measured before opens already fitted
    let stored: { key: string; fit: PageFit } | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(FIT_STORE) ?? 'null');
    } catch {}
    const known = stored?.key === `${fitKey}-${vh}` ? stored.fit : null;
    measured.current = { normal: !!known, first: !!known };
    setFitSettled(false);
    ed.setPageFit(known ?? { normal: 2400, first: 2400 });
  }, [ed, hydrated, fitKey, vh]);
  useEffect(() => {
    if (phase !== 'reading' || !chapter.loaded || !ed.pageFit) return;
    let raf = 0;
    let live = true;
    const t = window.setTimeout(() => {
      raf = requestAnimationFrame(async () => {
        await document.fonts?.ready.catch(() => {});
        const fit = ed.pageFit;
        if (!live) return;
        if (!fit) return;
        let { normal, first } = fit;
        for (const el of document.querySelectorAll<HTMLElement>('[data-testid="page-scroller"], [data-testid="page-scroller-right"]')) {
          const text = el.querySelector<HTMLElement>('.scripture');
          const verses = [...el.querySelectorAll<HTMLElement>('.verse[data-verse]')];
          const head = el.querySelector<HTMLElement>('header.running-head');
          if (!text || !head || verses.length < 2) continue; // one verse cannot be split; nothing to learn
          const sc = el.getBoundingClientRect();
          const tr = text.getBoundingClientRect();
          if (tr.height < 60) continue;
          // the page ends above the bottom fade and above any control floating over it
          let limit = sc.height - 56;
          const chip = document.querySelector('[data-testid="map-indicator"]')?.getBoundingClientRect();
          if (chip && chip.top > sc.top && chip.top < sc.bottom && chip.left < tr.right && chip.right > tr.left) limit = Math.min(limit, chip.top - sc.top - 14);
          const top = tr.top - sc.top;
          const density = verses.reduce((n, v) => n + (v.textContent?.length ?? 0), 0) / tr.height;
          const cap = density * (limit - top) * 0.95;
          const overflows = tr.bottom - sc.top > limit + 2;
          // where a page without a chapter heading would start its text
          const plain = head.getBoundingClientRect().bottom - sc.top + 26;
          if (verses[0].dataset.verse === '1') {
            if (!measured.current.first || overflows) first = Math.min(measured.current.first ? first : Infinity, cap);
            if (!measured.current.normal) normal = density * (limit - plain) * 0.95;
            measured.current.first = true;
          } else {
            if (!measured.current.normal || overflows) normal = Math.min(measured.current.normal ? normal : Infinity, cap);
            measured.current.normal = true;
          }
        }
        const changed = ed.setPageFit({ normal, first: Math.min(first, normal) });
        if (!changed) {
          setFitSettled(true);
          try {
            localStorage.setItem(FIT_STORE, JSON.stringify({ key: `${fitKey}-${vh}`, fit: ed.pageFit }));
          } catch {}
        } else if (changed) setFitSettled(false);
      });
    }, 60);
    return () => {
      live = false;
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [ed, phase, version, chapter.ref, chapter.loaded, state.position.page, fitKey, vh]);

  // When a chapter's text arrives, place the reader on the page holding their verse.
  useEffect(() => {
    if (!chapter.loaded) return;
    const page = pageForVerse(chapter.pages, state.position.verse);
    if (page !== state.position.page && !(spread && Math.floor(page / 2) === Math.floor(state.position.page / 2))) update({ position: { ...state.position, page } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.loaded, chapter.ref, version]);

  // On wide screens the vellum lies alongside: the page steps aside so both texts stay readable.
  const sheetW = Math.min(560, Math.round(vw * 0.46));
  const pageW = spread ? 1320 : 744;
  const aside = wide && !spread && overlay?.kind === 'vellum' ? Math.min(0, vw - sheetW + 96 - (vw / 2 + pageW / 2)) : 0;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = state.settings.theme;
    root.dataset.motion = reduced ? 'reduce' : 'full';
    root.dataset.legible = state.settings.legible ? 'on' : 'off';
    root.dataset.family = state.settings.family ? 'on' : 'off';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', phase === 'cover' ? '#1c1714' : state.settings.theme === 'night' ? '#1d1914' : '#f6f0e3');
  }, [state.settings.theme, state.settings.legible, state.settings.family, reduced, phase]);

  useEffect(() => {
    setAmbience(state.settings.sound && state.settings.ambience && phase === 'reading');
  }, [state.settings.sound, state.settings.ambience, phase]);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_NO_SW) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }, []);

  const play = useCallback<ReaderCtx['play']>(
    (s) => {
      if (state.settings.sound) sounds[s]();
    },
    [state.settings.sound],
  );

  const recordHistory = useCallback(
    (chapterRef: ChapterRef, verse: number) =>
      update((s) => {
        const history = [{ chapter: chapterRef, verse, at: Date.now() }, ...s.history.filter((h) => h.chapter !== chapterRef)].slice(0, 30);
        return { history };
      }),
    [update],
  );

  const goTo = useCallback<ReaderCtx['goTo']>(
    (chapterRef, verse = 1, opts) => {
      const c = ed.chapterByRef.get(chapterRef);
      if (!c) return;
      const cur = state.position;
      const move = () => {
        const page = pageForVerse(c.pages, verse);
        setDir(c.index > chapter.index || (c.index === chapter.index && page >= cur.page) ? 1 : -1);
        update((s) => ({
          position: { chapter: chapterRef, page, verse },
          returnTo: opts?.keepReturn
            ? opts.returnAt
              ? { chapter: chapterOf(opts.returnAt), verse: parseRef(opts.returnAt).from, page: s.position.page, label: formatRef(opts.returnAt) }
              : { ...s.position, label: formatRef(`${s.position.chapter}.${s.position.verse}`) }
            : chapterRef === s.returnTo?.chapter
              ? null
              : s.returnTo,
        }));
        setScrollRequest({ chapter: chapterRef, verse, nonce: Date.now() });
        if (chapterRef !== cur.chapter) recordHistory(chapterRef, verse);
        play('page');
      };
      if (c.loaded) move();
      else void ed.ensureChapter(chapterRef).then(move);
    },
    [ed, state.position, chapter.index, update, recordHistory, play],
  );

  /** Turn one page (or one spread). Runs on from one chapter into the next, and from book to book. */
  const turn = useCallback<ReaderCtx['turn']>(
    (delta) => {
      const step = spread ? 2 : 1;
      const cur = spread ? Math.floor(state.position.page / 2) * 2 : state.position.page;
      const nextPage = cur + delta * step;
      setDir(delta);
      if (nextPage >= 0 && nextPage < chapter.pages.length) {
        update({ position: { chapter: chapter.ref, page: nextPage, verse: chapter.pages[nextPage].from } });
        play('page');
        return true;
      }
      const other = ed.chapters[chapter.index + delta];
      if (!other) return false;
      const move = () => {
        const page = delta > 0 ? 0 : spread ? Math.floor((other.pages.length - 1) / 2) * 2 : other.pages.length - 1;
        update({ position: { chapter: other.ref, page, verse: other.pages[page].from } });
        recordHistory(other.ref, other.pages[page].from);
        play('page');
      };
      if (other.loaded) move();
      else void ed.ensureChapter(other.ref).then(move);
      return true;
    },
    [spread, state.position.page, chapter, ed, update, recordHistory, play],
  );

  // While the pages are still being fitted to the screen, the reader's place is the verse they asked for.
  const settledRef = useRef(fitSettled);
  settledRef.current = fitSettled;
  // Only the page (or spread) being read may move the reader's place — never a leaf turning away.
  const onVerseInView = useCallback(
    (verse: number) =>
      settledRef.current &&
      update((s) => {
        const c = ed.chapterByRef.get(s.position.chapter);
        const at = spread ? Math.floor(s.position.page / 2) * 2 : s.position.page;
        const lo = c?.pages[at]?.from ?? 0;
        const hi = c?.pages[spread ? at + 1 : at]?.to ?? c?.pages[at]?.to ?? 0;
        return verse !== s.position.verse && verse >= lo && verse <= hi ? { position: { ...s.position, verse } } : {};
      }),
    [update, ed, spread],
  );

  const encounterVerse = useCallback(
    (ref: VerseRef) => {
      const e = ed.entities.get(ref);
      if (!e) return;
      encounter(ref, { places: e.places.map((h) => h.id), people: e.people, phrases: e.phrases });
    },
    [ed, encounter],
  );

  const toggleBookmark = useCallback(() => {
    update((s) => {
      const { chapter: c, verse, page } = s.position;
      const here = s.bookmarks.find((b) => b.chapter === c && pageForVerse(ed.chapterByRef.get(c)!.pages, b.verse) === page);
      if (here) return { bookmarks: s.bookmarks.filter((b) => b.id !== here.id) };
      const colors = ['crimson', 'green', 'blue'] as const;
      return { bookmarks: [...s.bookmarks, { id: `bm-${Date.now()}`, chapter: c, verse, page, color: colors[s.bookmarks.length % 3], createdAt: Date.now() }] };
    });
    play('tap');
  }, [update, ed, play]);

  const open = useCallback((o: Overlay) => {
    setChrome(false);
    setOverlay(o);
  }, []);
  const close = useCallback(() => setOverlay(null), []);

  // ------------------------------------------------------------------ listening
  const [audioState, setAudioState] = useState<{ playing: boolean; ref: VerseRef | null; sleepAt: number | null }>({ playing: false, ref: null, sleepAt: null });
  const source = recorded.available() ? recorded : deviceVoice;
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  const audio: AudioCtl = {
    ...audioState,
    available: source.available(),
    start: (from) => {
      const start = from ?? `${chapter.ref}.${state.position.verse}`;
      const c = ed.chapterByRef.get(chapterOf(start))!;
      const run = (cc: typeof c, fromVerse: number) => {
        const verses = cc.verses.filter((v) => v.verse >= fromVerse);
        setAudioState((a) => ({ ...a, playing: true, ref: verses[0]?.ref ?? null }));
        source.play(verses, {
          rate: state.settings.audioRate,
          voice: state.settings.audioVoice,
          onVerse: (v) => {
            setAudioState((a) => ({ ...a, ref: v.ref }));
            update({ audio: { ref: v.ref } });
            const pos = ed.chapterByRef.get(chapterOf(v.ref))!;
            const onPage = pos.pages[pageForVerse(pos.pages, v.verse)];
            if (onPage && onPage.from === v.verse && v.verse !== fromVerse) goToRef.current(pos.ref, v.verse);
          },
          onEnd: () => {
            const next = ed.chapters[cc.index + 1];
            if (!next || (audioStateRef.current.sleepAt && Date.now() > audioStateRef.current.sleepAt)) {
              setAudioState((a) => ({ ...a, playing: false, sleepAt: null }));
              return;
            }
            void ed.ensureChapter(next.ref).then(() => {
              goToRef.current(next.ref, 1);
              run(next, 1);
            });
          },
        });
      };
      if (c.loaded) run(c, parseRef(start).from);
      else void ed.ensureChapter(c.ref).then(() => run(c, parseRef(start).from));
    },
    pause: () => {
      source.stop();
      setAudioState((a) => ({ ...a, playing: false }));
    },
    stop: () => {
      source.stop();
      setAudioState({ playing: false, ref: null, sleepAt: null });
    },
    setSleep: (m) => setAudioState((a) => ({ ...a, sleepAt: m ? Date.now() + m * 60000 : null })),
  };
  const audioStateRef = useRef(audioState);
  audioStateRef.current = audioState;
  useEffect(() => {
    if (!audioState.sleepAt || !audioState.playing) return;
    const t = window.setTimeout(() => {
      source.stop();
      setAudioState((a) => ({ ...a, playing: false, sleepAt: null }));
    }, Math.max(0, audioState.sleepAt - Date.now()));
    return () => window.clearTimeout(t);
  }, [audioState.sleepAt, audioState.playing, source]);

  useEffect(() => {
    if (phase !== 'reading') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (overlay && t.closest('input, textarea, select, [role="slider"]')) {
        if (e.key === 'Escape') setOverlay(null);
        return;
      }
      if (e.key === 'Escape') {
        if (overlay) setOverlay(null);
        else if (state.focus) update({ focus: false });
        else setChrome(false);
        return;
      }
      if (overlay || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') turn(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') turn(-1);
      else if (e.key === 'f') update({ focus: !state.focus });
      else if (e.key === 'm') open({ kind: 'atlas' });
      else if (e.key === 't') open({ kind: 'thread', id: state.followThread ?? ed.threads[0]?.id ?? 'shepherd' });
      else if (e.key === 'b') toggleBookmark();
      else if (e.key === '/' || e.key === 's') {
        e.preventDefault();
        open({ kind: 'search' });
      } else if (e.key === 'c') open({ kind: 'contents' });
      else if (e.key === 'n') {
        const next = ed.chapters[chapter.index + 1];
        if (next) goTo(next.ref, 1);
      } else if (e.key === 'p') {
        const prev = ed.chapters[chapter.index - 1];
        if (prev) goTo(prev.ref, 1);
      } else if (e.key === ' ' && t === document.body) setChrome((c) => !c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, overlay, state.focus, state.followThread, turn, update, open, ed, toggleBookmark, chapter.index, goTo]);

  const ctx: ReaderCtx = { ed, version, chapter, state, reduced, wide, spread, overlay, open, close, goTo, turn, update, updateSettings, play, encounterVerse, toggleBookmark, audio };
  const continueLabel = hydrated && hadSaved ? formatRef(`${state.position.chapter}.${state.position.verse}`) : null;
  const insert = overlay?.kind === 'insert' ? ed.inserts.find((i) => i.id === overlay.id) : undefined;
  const focusOf = overlay?.kind === 'insert' ? overlay.focus ?? insert?.focus : undefined;

  return (
    <ReaderContext.Provider value={ctx}>
      <main className="desk fixed inset-0 overflow-hidden" data-phase={phase} data-page-fit={fitSettled ? 'settled' : 'measuring'}>
        {phase === 'reading' && (
          <motion.div
            className="absolute inset-0 pb-[6px] pt-[6px] md:pb-5 md:pt-5"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.992 }}
            animate={{ opacity: 1, scale: 1, x: aside }}
            transition={{ duration: reduced ? 0.15 : 0.38, ease: [0.2, 0, 0, 1] }}
          >
            <ReadingPage onToggleChrome={() => setChrome((c) => !c)} onVerseInView={onVerseInView} scrollRequest={scrollRequest} dir={dir} />
          </motion.div>
        )}

        {phase === 'reading' && state.returnTo && !state.focus && overlay?.kind !== 'vellum' && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              const r = state.returnTo!;
              update({ returnTo: null });
              goTo(r.chapter, r.verse);
            }}
            className="chrome fixed left-1/2 top-[max(12px,env(safe-area-inset-top))] z-20 flex min-h-[40px] items-center gap-2 rounded-full border px-4 font-display text-[14px] italic text-[var(--ink-muted)] shadow-sm"
            style={{ x: '-50%' }}
            data-testid="return-pill"
          >
            <IconReturn width={16} height={16} /> Return to {state.returnTo.label}
          </motion.button>
        )}

        {phase === 'reading' && <MapIndicator lifted={chrome || audio.playing || !!audio.ref} />}
        {phase === 'reading' && <ReadingControls visible={chrome && !overlay} onHide={() => setChrome(false)} />}
        {phase === 'reading' && (audio.playing || audio.ref) && !overlay && <AudioBar lifted={chrome} />}

        <AnimatePresence>
          {overlay?.kind === 'vellum' && <VellumOverlay key={'v' + overlay.id + (overlay.reverseTarget ?? '')} id={overlay.id} reverseTarget={overlay.reverseTarget} wide={wide} />}
          {overlay?.kind === 'atlas' && <Atlas key="atlas" layer={overlay.layer} segment={overlay.segment} focusPlace={overlay.place} />}
          {overlay?.kind === 'place' && <PlaceSheet key={'p' + overlay.id} id={overlay.id} />}
          {overlay?.kind === 'person' && <PersonSheet key={'q' + overlay.id} id={overlay.id} />}
          {overlay?.kind === 'phrase' && <PhraseSheet key={'f' + overlay.id} id={overlay.id} />}
          {overlay?.kind === 'thread' && <ThreadDrawer key="thread" id={overlay.id} startRef={overlay.ref} />}
          {insert?.kind === 'context' && <ContextInsert key="insert" id={insert.id} />}
          {insert?.kind === 'scale' && <ScaleInsert key="scale" focus={focusOf} />}
          {insert?.kind === 'genealogy' && <GenealogyGatefold key={'gen' + insert.id} focus={focusOf} />}
          {(insert?.kind === 'timeline' || overlay?.kind === 'timeline') && <TimelineStrip key="timeline" />}
          {overlay?.kind === 'settings' && <SettingsPanel key="settings" />}
          {overlay?.kind === 'contents' && <Contents key="contents" tab={overlay.tab} />}
          {overlay?.kind === 'search' && <SearchSheet key="search" q={overlay.q} />}
          {overlay?.kind === 'verse' && <VerseSheet key={'vs' + overlay.ref} verseRef={overlay.ref} />}
          {overlay?.kind === 'compare' && <CompareSheet key={'cmp' + overlay.ref} verseRef={overlay.ref} />}
          {overlay?.kind === 'words' && <WordStudy key={'w' + overlay.ref} verseRef={overlay.ref} />}
          {overlay?.kind === 'mine' && <MyBible key="mine" tab={overlay.tab} />}
          {overlay?.kind === 'family' && <FamilyPanel key="family" />}
          {overlay?.kind === 'deep' && <DeepSheet key={'deep' + overlay.chapter + (overlay.verse ?? '')} chapterRef={overlay.chapter} verse={overlay.verse} tab={overlay.tab} story={overlay.story} />}
        </AnimatePresence>

        {phase === 'cover' && (
          <BibleCover
            continueLabel={continueLabel}
            leafTitle={{ ...(chapter.book.titleParts ?? { pre: '', main: chapter.book.name.toUpperCase(), post: '' }), chapter: chapter.number }}
            ready={() => Promise.all([ed.init(), ed.ensureChapter(chapter.ref)])}
            reduced={reduced}
            onOpenStart={() => play('unfold')}
            onOpened={() => {
              setPhase('reading');
              const c = ed.chapterByRef.get(state.position.chapter) ?? ed.chapters[0];
              const page = pageForVerse(c.pages, state.position.verse);
              if (page !== state.position.page || c.ref !== state.position.chapter) update({ position: { chapter: c.ref, page, verse: state.position.verse } });
              recordHistory(state.position.chapter, state.position.verse);
              setScrollRequest({ chapter: state.position.chapter, verse: state.position.verse, nonce: Date.now() });
            }}
          />
        )}
      </main>
    </ReaderContext.Provider>
  );
}
