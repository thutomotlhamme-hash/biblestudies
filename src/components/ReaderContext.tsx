'use client';
import { createContext, useContext } from 'react';
import type { Library } from '@/lib/content/repository';
import type { Chapter, ChapterRef, VerseRef } from '@/lib/content/types';
import type { ReaderState, Settings } from '@/lib/state/reader-state';

export type Overlay =
  | { kind: 'vellum'; id: string; reverseTarget?: VerseRef }
  | { kind: 'place'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'phrase'; id: string }
  | { kind: 'thread'; id: string; ref?: VerseRef }
  | { kind: 'atlas'; layer?: string; segment?: string; place?: string }
  | { kind: 'insert'; id: string; focus?: string }
  | { kind: 'timeline'; focus?: string }
  | { kind: 'settings' }
  | { kind: 'contents'; tab?: 'books' | 'bookmarks' | 'recent' | 'journey' }
  | { kind: 'search'; q?: string }
  | { kind: 'verse'; ref: VerseRef }
  | { kind: 'compare'; ref: VerseRef }
  | { kind: 'words'; ref: VerseRef }
  | { kind: 'mine'; tab?: 'highlights' | 'notes' | 'favourites' | 'saved' }
  | { kind: 'family' }
  | { kind: 'deep'; chapter: ChapterRef; verse?: number; tab?: 'research' | 'stories' | 'links'; story?: string }
  | null;

export interface AudioCtl {
  playing: boolean;
  ref: VerseRef | null;
  available: boolean;
  start: (from?: VerseRef) => void;
  pause: () => void;
  stop: () => void;
  sleepAt: number | null;
  setSleep: (minutes: number | null) => void;
}

export interface ReaderCtx {
  ed: Library;
  /** Changes whenever more of the library has loaded — include in memo dependencies. */
  version: number;
  chapter: Chapter;
  state: ReaderState;
  reduced: boolean;
  wide: boolean;
  spread: boolean;
  overlay: Overlay;
  open: (o: Overlay) => void;
  close: () => void;
  /** Move the reader. `keepReturn` remembers where they were so they can come back. */
  goTo: (chapter: ChapterRef, verse?: number, opts?: { keepReturn?: boolean; returnAt?: VerseRef }) => void;
  turn: (delta: number) => boolean;
  update: (patch: Partial<ReaderState> | ((s: ReaderState) => Partial<ReaderState>)) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  play: (s: 'page' | 'vellum' | 'unfold' | 'tap') => void;
  encounterVerse: (ref: VerseRef) => void;
  toggleBookmark: () => void;
  audio: AudioCtl;
}

export const ReaderContext = createContext<ReaderCtx | null>(null);

export function useReader() {
  const c = useContext(ReaderContext);
  if (!c) throw new Error('useReader outside ReaderContext');
  return c;
}
