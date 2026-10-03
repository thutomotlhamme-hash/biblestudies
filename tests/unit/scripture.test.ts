/**
 * Scripture integrity — these tests block deployment (see .github/workflows/ci.yml).
 * The words are untouchable: every chapter of every translation is checked against its checksum,
 * and every way the app wraps a verse (place names, supplied words, search marks) must give back
 * the verse exactly.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { segmentVerse } from '@/lib/content/runs';
import { CANON, ordinalOf, refOfOrdinal, TOTAL_VERSES } from '@/lib/content/refs';
import { BOOKS, json, studyBooks, text, TRANSLATIONS } from './data';

describe('The canon is configuration', () => {
  it('is the 66-book Protestant canon with 1,189 chapters and 31,102 verses', () => {
    expect(CANON.id).toBe('protestant-66');
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.reduce((n, b) => n + b.chapterCount!, 0)).toBe(1189);
    expect(TOTAL_VERSES).toBe(31102);
    expect(BOOKS[0].osis).toBe('Gen');
    expect(BOOKS[65].osis).toBe('Rev');
    expect(BOOKS.filter((b) => b.testament === 'OT')).toHaveLength(39);
  });
  it('verse ordinals round-trip for every verse', () => {
    for (let n = 0; n < TOTAL_VERSES; n += 7) expect(ordinalOf(refOfOrdinal(n))).toBe(n);
    expect(refOfOrdinal(0)).toBe('Gen.1.1');
    expect(refOfOrdinal(TOTAL_VERSES - 1)).toBe('Rev.22.21');
  });
});

describe.each(TRANSLATIONS.map((t) => [t.id]))('Scripture integrity: %s', (tr) => {
  const manifest = json<{ checksums: Record<string, string>; verses: number }>(`text/${tr}/manifest.json`);
  it('every chapter matches its recorded SHA-256 checksum', () => {
    let chapters = 0;
    for (const b of BOOKS) {
      const f = json<{ translation: string; book: string; chapters: string[][] }>(`text/${tr}/${b.osis}.json`);
      expect(f.translation).toBe(tr);
      f.chapters.forEach((ch, i) => {
        const sum = createHash('sha256').update(ch.map((v) => v + '\n').join('')).digest('hex');
        expect(sum, `${b.osis}.${i + 1}`).toBe(manifest.checksums[`${b.osis}.${i + 1}`]);
        chapters++;
      });
    }
    expect(chapters).toBe(1189);
  });
  it('every verse the canon lists is present, and nothing else', () => {
    for (const b of BOOKS) {
      const f = json<{ chapters: string[][] }>(`text/${tr}/${b.osis}.json`);
      expect(f.chapters.length, b.osis).toBe(b.chapterCount);
      f.chapters.forEach((ch, i) => expect(ch.length, `${b.osis}.${i + 1}`).toBe(b.verses![i]));
    }
  });
  it('the text files hold Scripture only: no markup, no notes, no stray whitespace', () => {
    for (const b of BOOKS) {
      const f = json<Record<string, unknown>>(`text/${tr}/${b.osis}.json`);
      expect(Object.keys(f).sort()).toEqual(tr === 'kjv' ? ['book', 'chapters', 'italics', 'translation'] : ['book', 'chapters', 'translation']);
      for (const ch of f.chapters as string[][]) for (const v of ch) expect(v).not.toMatch(tr === 'kjv' ? /[<>{}[\]]|\s{2,}|^\s|\s$/ : /[<>{}]|\s{2,}|^\s|\s$/);
    }
  });
});

describe('KJV text', () => {
  const kjv = text();
  it('known verses are verbatim', () => {
    expect(kjv.get('Gen.1.1')).toBe('In the beginning God created the heaven and the earth.');
    expect(kjv.get('John.3.16')).toBe('For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.');
    expect(kjv.get('Hos.11.1')).toBe('When Israel was a child, then I loved him, and called my son out of Egypt.');
    expect(kjv.get('Ps.23.1')).toBe('The LORD is my shepherd; I shall not want.');
    expect(kjv.get('Rev.22.21')).toBe('The grace of our Lord Jesus Christ be with you all. Amen.');
  });
  it('every source repair is recorded, and only leaked notes were removed', () => {
    const m = json<{ repairs: { ref: string; source: string; kept: string }[]; knownGaps: string[] }>('text/kjv/manifest.json');
    expect(m.repairs.length).toBeGreaterThan(0);
    for (const r of m.repairs) {
      expect(kjv.get(r.ref), r.ref).toBe(r.kept);
      // a repair only ever removes a trailing note: the kept text is the start of the source text
      expect(r.source.startsWith(r.kept.replace(/[.:;,]$/, '')), r.ref).toBe(true);
    }
    expect(m.knownGaps.join(' ')).toMatch(/Psalm superscriptions/);
  });
  it('supplied-word (italic) ranges fall on word boundaries inside the verse', () => {
    for (const b of BOOKS) {
      const f = json<{ chapters: string[][]; italics: Record<string, [number, number][]> }>(`text/kjv/${b.osis}.json`);
      for (const [k, ranges] of Object.entries(f.italics)) {
        const [c, v] = k.split(':').map(Number);
        const t = f.chapters[c - 1][v - 1];
        for (const [a, z] of ranges) {
          expect(a >= 0 && z <= t.length && a < z, `${b.osis} ${k}`).toBe(true);
          expect(/[A-Za-z]/.test(t[a]) && !/[A-Za-z]/.test(t[a - 1] ?? ' '), `${b.osis} ${k} start`).toBe(true);
        }
      }
    }
  });
});

describe('Wrapping never changes a character', () => {
  it('place spans and supplied words, applied to every verse of the Bible, give back the verse exactly', () => {
    let checked = 0;
    for (const b of studyBooks()) {
      const f = json<{ chapters: string[][]; italics: Record<string, [number, number][]> }>(`text/kjv/${b.osis}.json`);
      f.chapters.forEach((ch, ci) =>
        ch.forEach((t, vi) => {
          const key = `${ci + 1}.${vi + 1}`;
          const spans = (b.spans[key] ?? []) as [number, number, string, string][];
          const hits = spans.filter((s) => s[2] === 'l').map(([start, end, , id]) => ({ start, end, id }));
          const runs = segmentVerse(t, hits, f.italics[`${ci + 1}:${vi + 1}`] ?? []);
          expect(runs.map((r) => r.text).join(''), `${b.osis}.${key}`).toBe(t);
          for (const [s, e] of spans) expect(s >= 0 && e <= t.length && s < e, `${b.osis}.${key} span`).toBe(true);
          checked++;
        }),
      );
    }
    expect(checked).toBe(31102);
  });
});
