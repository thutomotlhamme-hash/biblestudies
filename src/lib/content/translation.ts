/**
 * Translation adapters.
 *
 * Every piece of Scripture shown in the app comes through a TranslationAdapter. Supplementary data
 * refers to verses only by reference, so an authorised licensed translation is one new adapter
 * (for example an API-backed one) plus an entry in translations.json — no component changes.
 *
 * Adapters return exact text or nothing. They never paraphrase, fill gaps, or merge translations.
 */
import translationsJson from '@data/translations.json';
import { fetchJson } from '@/lib/library/base';
import { allBooks, expandRef, parseRef } from './refs';
import type { Book, Verse, VerseRef } from './types';

export interface TranslationMeta {
  id: string;
  abbreviation: string;
  name: string;
  language: string;
  year: number;
  edition: string;
  copyright: string;
  licence: string;
  attribution: string;
  source: string;
  role: 'development' | 'authorised';
  verses: number;
  canon: string;
  normalisation: string;
  knownGaps?: string[];
  /** Filled from the translation's manifest once loaded. */
  checksums?: Record<string, string>;
  version?: string;
}

export interface ScriptureSearchOptions {
  books?: string[];
  testament?: 'OT' | 'NT';
  exact?: boolean;
  limit?: number;
}

export interface TranslationAdapter {
  readonly translation: TranslationMeta;
  getTranslationMetadata(): TranslationMeta;
  getBooks(): Book[];
  getChapter(book: string, chapter: number): Promise<Verse[]>;
  getVerse(ref: VerseRef): Promise<Verse>;
  /** Scripture search runs in a worker over the same book files; see lib/search. */
  searchScripture?(query: string, options?: ScriptureSearchOptions): Promise<VerseRef[]>;

  // Synchronous access to what has already been loaded (for rendering).
  loadBook(book: string): Promise<void>;
  hasBook(book: string): boolean;
  /** Exact verse text — throws if the book has not been loaded or the verse does not exist. */
  verse(ref: VerseRef): Verse;
  passage(ref: VerseRef): Verse[];
  chapterVerses(book: string, chapter: number): Verse[];
  /** Words the translators supplied (printed in italics in the KJV), as character ranges. */
  italics(ref: VerseRef): [number, number][] | undefined;
}

interface BookFile {
  translation: string;
  book: string;
  chapters: string[][];
  italics?: Record<string, [number, number][]>;
}

/** Reads the static per-book JSON files produced by scripts/pipeline/scripture.py. */
export class StaticFileTranslationAdapter implements TranslationAdapter {
  private books = new Map<string, BookFile>();
  private pending = new Map<string, Promise<void>>();

  constructor(readonly translation: TranslationMeta) {}

  getTranslationMetadata() {
    return this.translation;
  }

  getBooks() {
    return allBooks();
  }

  hasBook(book: string) {
    return this.books.has(book);
  }

  loadBook(book: string): Promise<void> {
    if (this.books.has(book)) return Promise.resolve();
    let p = this.pending.get(book);
    if (!p) {
      p = fetchJson<BookFile>(`text/${this.translation.id}/${book}.json`).then((f) => {
        this.books.set(book, f);
      });
      p.catch(() => this.pending.delete(book));
      this.pending.set(book, p);
    }
    return p;
  }

  async getChapter(book: string, chapter: number) {
    await this.loadBook(book);
    return this.chapterVerses(book, chapter);
  }

  async getVerse(ref: VerseRef) {
    await this.loadBook(parseRef(ref).book);
    return this.verse(ref);
  }

  verse(ref: VerseRef): Verse {
    const p = parseRef(ref);
    const f = this.books.get(p.book);
    if (!f) throw new Error(`${p.book} is not loaded in ${this.translation.abbreviation}`);
    const text = f.chapters[p.chapter - 1]?.[p.from - 1];
    if (text === undefined) throw new Error(`Verse ${ref} is not available in ${this.translation.abbreviation}`);
    return { ref: `${p.book}.${p.chapter}.${p.from}`, book: p.book, chapter: p.chapter, verse: p.from, text };
  }

  passage(ref: VerseRef): Verse[] {
    return expandRef(ref).map((r) => this.verse(r));
  }

  chapterVerses(book: string, chapter: number): Verse[] {
    const f = this.books.get(book);
    if (!f) throw new Error(`${book} is not loaded in ${this.translation.abbreviation}`);
    return (f.chapters[chapter - 1] ?? []).map((text, i) => ({ ref: `${book}.${chapter}.${i + 1}`, book, chapter, verse: i + 1, text }));
  }

  italics(ref: VerseRef) {
    const p = parseRef(ref);
    return this.books.get(p.book)?.italics?.[`${p.chapter}:${p.from}`];
  }
}

export const TRANSLATIONS = translationsJson as TranslationMeta[];
const adapters = new Map<string, TranslationAdapter>();

export function getTranslation(id: string): TranslationAdapter {
  let a = adapters.get(id);
  if (!a) {
    const meta = TRANSLATIONS.find((t) => t.id === id) ?? TRANSLATIONS[0];
    a = new StaticFileTranslationAdapter(meta);
    adapters.set(meta.id, a);
  }
  return a;
}

/** The translation the edition is typeset in; readers may switch or compare. */
export const DEFAULT_TRANSLATION = 'kjv';
