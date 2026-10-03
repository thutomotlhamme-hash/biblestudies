import { describe, expect, it } from 'vitest';
import { expandRef, findBook, inScope, parseHumanRef } from '@/lib/content/refs';
import { buildIndex, search } from '@/lib/search/engine';
import { DEFAULT_STATE, migrate } from '@/lib/state/reader-state';
import { BOOKS, json, text } from './data';

const idx = buildIndex(BOOKS.map((b) => ({ osis: b.osis, testament: b.testament, chapters: json(`text/kjv/${b.osis}.json`).chapters })));
const kjv = text();

describe('Scripture search (offline engine)', () => {
  it('finds an exact phrase in quotation marks, in canonical order', () => {
    const r = search(idx, { q: '"in the beginning"' });
    expect(r.results[0].ref).toBe('Gen.1.1');
    expect(r.results.map((x) => x.ref)).toContain('John.1.1');
    for (const x of r.results) expect(x.text.toLowerCase()).toContain('in the beginning');
  });
  it('returns the verse exactly as the translation gives it, with marks inside it', () => {
    const r = search(idx, { q: 'shepherd' });
    expect(r.total).toBeGreaterThan(50);
    for (const x of r.results) {
      expect(x.text).toBe(kjv.get(x.ref));
      for (const [a, b] of x.marks) expect(x.text.slice(a, b).toLowerCase()).toMatch(/^shepherd/);
    }
  });
  it('filters by testament and by book', () => {
    expect(search(idx, { q: 'bethlehem', testament: 'NT' }).results.every((x) => /^(Matt|Mark|Luke|John|Acts)/.test(x.ref))).toBe(true);
    expect(search(idx, { q: 'love', books: ['1John'] }).results.every((x) => x.ref.startsWith('1John.'))).toBe(true);
  });
  it('all words must appear; nothing is invented for nonsense', () => {
    const r = search(idx, { q: 'David Goliath' });
    expect(r.results.every((x) => /David/.test(x.text) && /Goliath/.test(x.text))).toBe(true);
    expect(search(idx, { q: 'xyzzyplugh' }).total).toBe(0);
  });
});

describe('Reference helpers', () => {
  it('parse what readers type', () => {
    expect(parseHumanRef('gen 12')).toMatchObject({ book: 'Gen', chapter: 12 });
    expect(parseHumanRef('1 sam 16:13')).toMatchObject({ book: '1Sam', chapter: 16, verse: 13 });
    expect(parseHumanRef('Song of Solomon 2:4')).toMatchObject({ book: 'Song', chapter: 2, verse: 4 });
    expect(parseHumanRef('ps 23:1-4')).toMatchObject({ book: 'Ps', chapter: 23, verse: 1, verseEnd: 4 });
    expect(parseHumanRef('jn 3:16')).toMatchObject({ book: 'John', chapter: 3, verse: 16 });
    expect(parseHumanRef('Genesis 51')).toBeNull();
    expect(parseHumanRef('Bethlehem')).toBeNull();
    expect(findBook('revelation')?.osis).toBe('Rev');
    expect(findBook('iii john')?.osis).toBe('3John');
  });
  it('scopes and ranges', () => {
    expect(expandRef('Gen.46.3-4')).toEqual(['Gen.46.3', 'Gen.46.4']);
    expect(inScope('Gen.35.23', ['Gen.35'])).toBe(true);
    expect(inScope('Matt.1.3', ['Matt.1.2-3'])).toBe(true);
  });
});

describe('Reader state', () => {
  it('migrates Phase 2 state without losing the reader’s memory', () => {
    const v2 = { v: 2, position: { chapter: 'Gen.12', page: 1, verse: 8 }, places: { bethel: { first: 'Gen.12.8', firstAt: 1, refs: ['Gen.12.8'] } }, bookmarks: [{ id: 'b', chapter: 'Gen.12', verse: 8, page: 1, color: 'green', createdAt: 1 }], settings: { fontStep: 4 }, updatedAt: 5 };
    const s = migrate(v2 as never);
    expect(s.v).toBe(3);
    expect(s.position.chapter).toBe('Gen.12'); // migrate() itself keeps a position; reading an old save resets it (below)
    expect(s.places.bethel.first).toBe('Gen.12.8');
    expect(s.bookmarks).toHaveLength(1);
    expect(s.settings.fontStep).toBe(4);
    expect(s.settings.translation).toBe('kjv');
    expect(s.notes).toEqual({});
    expect(s.saved).toEqual(DEFAULT_STATE.saved);
  });
  it('a new reader opens at Genesis 1', () => {
    expect(DEFAULT_STATE.position.chapter).toBe('Gen.1');
  });
});
