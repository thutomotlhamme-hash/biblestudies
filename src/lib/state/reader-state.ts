'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bookmark, ChapterRef, ReaderEncounter, ReaderJourneyHistoryEntry, ReadingHistoryEntry, VerseRef } from '@/lib/content/types';

export type Theme = 'paper' | 'night' | 'contrast';
export type MotionPref = 'system' | 'reduce' | 'full';

export type HighlightColor = 'gold' | 'rose' | 'sage' | 'sky';
export type Layout = 'paragraph' | 'verse';

export interface Settings {
  fontStep: number; // 0..5
  lineStep: number; // 0..2
  theme: Theme;
  motion: MotionPref;
  marginNotes: boolean;
  memoryNotes: boolean;
  sound: boolean;
  ambience: boolean;
  spread: boolean; // two-page spread on wide screens
  /** Scripture translation being read (an adapter id). */
  translation: string;
  /** Paragraph (book-like) or one verse per line. */
  layout: Layout;
  /** Show the words the KJV translators supplied in italics, as the printed KJV does. */
  italics: boolean;
  /** A typeface designed for legibility (Atkinson Hyperlegible) for Scripture and notes. */
  legible: boolean;
  /** Discovery markers: connections up to this evidence level (1 explicit quotation … 4 textual parallel). */
  maxLevel: 1 | 2 | 3 | 4;
  /** Show links found by shared wording (machine-detected, awaiting review). */
  machineLinks: boolean;
  /** Quiet “repeated wording” marks in the margin. */
  discoveries: boolean;
  /** Family reading: larger type, quieter apparatus, shared reading plans. */
  family: boolean;
  audioRate: number;
  audioVoice: string | null;
}

export interface Note {
  text: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReadingPlan {
  id: string;
  startedAt: number;
  done: ChapterRef[];
}

export interface Position {
  chapter: ChapterRef;
  page: number;
  verse: number;
}

export interface ReaderState {
  v: 3;
  position: Position;
  focus: boolean;
  settings: Settings;
  /** Private memory of the biblical world, kept only on this device. */
  places: Record<string, ReaderEncounter>;
  people: Record<string, ReaderEncounter>;
  phrases: Record<string, ReaderEncounter>;
  journeyHistory: ReaderJourneyHistoryEntry[];
  bookmarks: Bookmark[];
  history: ReadingHistoryEntry[];
  threadProgress: Record<string, VerseRef[]>;
  followThread: string | null;
  returnTo: (Position & { label: string }) | null;
  /** Personal tools — private by default, kept on this device unless the reader turns sync on. */
  highlights: Record<VerseRef, HighlightColor>;
  notes: Record<VerseRef, Note>;
  favourites: VerseRef[];
  saved: { places: string[]; journeys: string[]; threads: string[]; discoveries: string[] };
  plans: ReadingPlan[];
  /** Where listening stopped, to resume. */
  audio: { ref: VerseRef | null };
  sync: { provider: 'local' | 'remote'; lastSyncedAt: number | null };
  updatedAt: number;
}

export const FONT_SIZES = [17, 18, 19.5, 21, 23, 26];
export const LINE_HEIGHTS = [1.5, 1.62, 1.8];

export const DEFAULT_SETTINGS: Settings = {
  fontStep: 2,
  lineStep: 1,
  theme: 'paper',
  motion: 'system',
  marginNotes: true,
  memoryNotes: true,
  sound: false,
  ambience: false,
  spread: true,
  translation: 'kjv',
  layout: 'paragraph',
  italics: false,
  legible: false,
  maxLevel: 4,
  machineLinks: true,
  discoveries: true,
  family: false,
  audioRate: 1,
  audioVoice: null,
};

export const DEFAULT_STATE: ReaderState = {
  v: 3,
  position: { chapter: 'Gen.1', page: 0, verse: 1 },
  focus: false,
  settings: DEFAULT_SETTINGS,
  places: {},
  people: {},
  phrases: {},
  journeyHistory: [],
  bookmarks: [],
  history: [],
  threadProgress: {},
  followThread: null,
  returnTo: null,
  highlights: {},
  notes: {},
  favourites: [],
  saved: { places: [], journeys: [], threads: [], discoveries: [] },
  plans: [],
  audio: { ref: null },
  sync: { provider: 'local', lastSyncedAt: null },
  updatedAt: 0,
};

export const STORAGE_KEY = 'holy-bible.reader.v3';
const V2_KEY = 'holy-bible.reader.v2';
const LEGACY_KEY = 'holy-bible.reader.v1';

/** Bring any saved state (v2 or v3) up to the current shape. Nothing the reader made is dropped. */
export function migrate(parsed: Partial<ReaderState> & { v?: number }): ReaderState {
  return {
    ...DEFAULT_STATE,
    ...parsed,
    v: 3,
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    saved: { ...DEFAULT_STATE.saved, ...(parsed.saved ?? {}) },
    audio: { ...DEFAULT_STATE.audio, ...(parsed.audio ?? {}) },
    sync: { ...DEFAULT_STATE.sync, ...(parsed.sync ?? {}) },
  };
}

function read(): ReaderState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(V2_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.v === 3) return migrate(parsed);
      // An earlier edition's state keeps its memory, ribbons and settings, but the complete Bible
      // opens at Genesis 1 rather than at the old curated journey's place.
      if (parsed?.v === 2) return migrate({ ...parsed, position: DEFAULT_STATE.position, returnTo: null, focus: false, updatedAt: 0 });
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = JSON.parse(legacy);
      return { ...DEFAULT_STATE, settings: { ...DEFAULT_STATE.settings, ...p.settings } };
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

function record(map: Record<string, ReaderEncounter>, id: string, ref: VerseRef, now: number) {
  const e = map[id];
  if (!e) return { ...map, [id]: { first: ref, firstAt: now, refs: [ref] } };
  if (e.refs.includes(ref)) return map;
  return { ...map, [id]: { ...e, refs: [...e.refs, ref] } };
}

/** Reading state persisted locally; an optional SyncProvider (lib/sync) mirrors it across devices. */
export function useReaderState() {
  const [state, setState] = useState<ReaderState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [hadSaved, setHadSaved] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const saved = read();
    if (saved) {
      setState(saved);
      setHadSaved(saved.updatedAt > 0);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage unavailable: state lives in memory only */
      }
    }, 120);
  }, [state, hydrated]);

  // flush on page hide so "close the Bible" never loses the place
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
      } catch {}
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = useCallback((patch: Partial<ReaderState> | ((s: ReaderState) => Partial<ReaderState>)) => {
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch), updatedAt: Date.now() }));
  }, []);
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch }, updatedAt: Date.now() }));
  }, []);

  /** Record what a verse mentions, the moment it is read. */
  const encounter = useCallback((ref: VerseRef, e: { places: string[]; people: string[]; phrases: string[] }) => {
    setState((s) => {
      const now = Date.now();
      let places = s.places;
      let journeyHistory = s.journeyHistory;
      for (const id of e.places) {
        if (!places[id]) journeyHistory = [...journeyHistory, { placeId: id, ref, at: now }];
        places = record(places, id, ref, now);
      }
      let people = s.people;
      for (const id of e.people) people = record(people, id, ref, now);
      let phrases = s.phrases;
      for (const id of e.phrases) phrases = record(phrases, id, ref, now);
      if (places === s.places && people === s.people && phrases === s.phrases) return s;
      return { ...s, places, people, phrases, journeyHistory };
    });
  }, []);

  /** Replace the whole state (used by sync and by import). */
  const replace = useCallback((next: ReaderState) => setState(migrate(next)), []);

  return { state, update, updateSettings, encounter, hydrated, hadSaved, replace };
}
