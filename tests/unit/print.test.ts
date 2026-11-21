/**
 * The KJV as printed, and what stands at the back: Psalm titles (part of the KJV text, checksum-tested),
 * red letters, the 1611 summaries, cross-references, Nave's index and the concordance — all checked
 * against the text. None of them changes a character of Scripture.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { segmentVerse } from '@/lib/content/runs';
import { layoutBook, poetryTurn } from '@/lib/content/repository';
import { BOOKS, json, text } from './data';

const kjv = text('kjv');
const print = Object.fromEntries(BOOKS.map((b) => [b.osis, json(`study/print/${b.osis}.json`)]));
const index = json('study/print/index.json');

// the Psalm titles of the KJV, as recorded when they were first taken in (any change fails here)
const TITLES_SHA = index.titlesChecksums.Ps as string;

describe('Psalm titles — part of the King James text', () => {
  it('116 Psalm titles and 22 letters over Psalm 119, matching their recorded checksum', () => {
    const p = print.Ps;
    expect(Object.keys(p.titles)).toHaveLength(116);
    expect(Object.keys(p.letters)).toHaveLength(22);
    const sum = createHash('sha256').update(canonical({ letters: p.letters, titles: p.titles })).digest('hex');
    expect(sum).toBe(TITLES_SHA);
    expect(sum).toBe('5abd6671c967cc5c7924d66515c94d56a19f1d095db048b670ed93295b1d9af3');
  });
  it('the familiar titles stand where the KJV prints them; no other book has any', () => {
    expect(print.Ps.titles['3']).toBe('A Psalm of David, when he fled from Absalom his son.');
    expect(print.Ps.titles['23']).toBe('A Psalm of David.');
    expect(print.Ps.titles['1']).toBeUndefined();
    expect(print.Ps.letters['119.1']).toBe('א ALEPH.');
    for (const b of BOOKS) if (b.osis !== 'Ps') expect(Object.keys(print[b.osis].titles), b.osis).toHaveLength(0);
  });
  it('titles are not inside the verses: Psalm 3:1 begins with the psalm itself', () => {
    expect(kjv.get('Ps.3.1')!.startsWith('LORD, how are they increased')).toBe(true);
  });
});

describe('red letters — a printing tradition over words already there', () => {
  it('every span lies within its verse, on word boundaries, and only colours the text', () => {
    let n = 0;
    for (const b of BOOKS)
      for (const [k, spans] of Object.entries<[number, number][]>(print[b.osis].red)) {
        const ref = `${b.osis}.${k}`;
        const t = kjv.get(ref)!;
        for (const [a, z] of spans) {
          expect(a >= 0 && z <= t.length && a < z, ref).toBe(true);
          expect(/\s/.test(t[a]) || /\s/.test(t[z - 1]), ref).toBe(false);
        }
        expect(segmentVerse(t, [], [], spans).map((r) => r.text).join(''), ref).toBe(t);
        n++;
      }
    expect(n).toBeGreaterThan(2000);
  });
  it('the Lord’s own words are red, the narrator’s are not', () => {
    const t = kjv.get('Matt.3.15')!;
    const [[a, z]] = print.Matt.red['3.15'];
    expect(t.slice(a, z)).toBe('Suffer it to be so now: for thus it becometh us to fulfil all righteousness.');
    expect(t.slice(0, a)).toContain('Jesus answering said');
    expect(print.John.red['11.35']).toBeUndefined(); // "Jesus wept." is told, not spoken
    expect(print.Gen.red).toEqual({});
  });
});

describe('the 1611 chapter summaries', () => {
  it('stand over the right chapters, in the 1611 spelling', () => {
    expect(print.Gen.summaries['1']).toMatch(/^1 The creation of Heauen and Earth/);
    expect(print.John.summaries['3']).toMatch(/Nicodemus/);
    expect(print.Ps.summaries['23']).toMatch(/confidence in Gods grace/);
    const total = BOOKS.reduce((n, b) => n + Object.keys(print[b.osis].summaries).length, 0);
    expect(total).toBeGreaterThan(1150);
    for (const b of BOOKS) for (const c of Object.keys(print[b.osis].summaries)) expect(Number(c) <= b.chapterCount!, `${b.osis} ${c}`).toBe(true);
  });
});

describe('cross-references (centre column)', () => {
  it('every reference exists, none points to itself, at most six per verse, level 4 drafts', () => {
    let n = 0;
    for (const b of BOOKS) {
      const x = json(`study/xrefs/${b.osis}.json`);
      expect(x.evidenceLevel).toBe(4);
      expect(x.note).toMatch(/Supplementary — not Scripture/);
      for (const [k, list] of Object.entries<[string, number][]>(x.refs)) {
        expect(kjv.has(`${b.osis}.${k}`)).toBe(true);
        expect(list.length).toBeLessThanOrEqual(6);
        for (const [r] of list) {
          for (const end of r.split('-')) expect(kjv.has(end), r).toBe(true);
          expect(r).not.toBe(`${b.osis}.${k}`);
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(50000);
    expect(json('study/xrefs/John.json').refs['3.16'].map((x: [string]) => x[0])).toContain('Rom.5.8');
  });
});

describe("Nave's topical index", () => {
  it('every reference exists in the canon', () => {
    const chapters = new Set([...kjv.keys()].map((r) => r.split('.').slice(0, 2).join('.')));
    const idx = json('study/topics/index.json');
    expect(idx.subjects.length).toBeGreaterThan(5000);
    let n = 0;
    for (const letter of new Set<string>(idx.subjects.map((s: any) => s[2])))
      for (const s of json(`study/topics/${letter}.json`).subjects)
        for (const e of s.entries)
          for (const r of e.r ?? []) {
            const parts = r.split('.');
            if (parts.length === 2) expect(chapters.has(r), r).toBe(true);
            else {
              const [v, end] = parts[2].split('-');
              expect(kjv.has(`${parts[0]}.${parts[1]}.${v}`), r).toBe(true);
              if (end && !end.includes(':')) expect(kjv.has(`${parts[0]}.${parts[1]}.${end}`), r).toBe(true);
            }
            n++;
          }
    expect(n).toBeGreaterThan(70000);
  });
});

describe('the concordance', () => {
  it('counts every word of the KJV', () => {
    const words = json('study/concordance.json').words as [string, number, number][];
    const total = words.reduce((n, w) => n + w[1], 0);
    const counted = [...kjv.values()].reduce((n, t) => n + (t.match(/[A-Za-z]+(?:[’'][A-Za-z]+)*/g)?.length ?? 0), 0);
    expect(total).toBe(counted);
    const jesus = words.find((w) => w[0] === 'jesus')!;
    expect(jesus[2]).toBe([...kjv.values()].filter((t) => /\bJesus\b/i.test(t)).length);
  });
});

describe('poetry and layout', () => {
  it('a verse of poetry turns after its first colon, only when both halves are lines', () => {
    const t = kjv.get('Ps.23.2')!;
    expect(t.slice(0, poetryTurn(t))).toBe('He maketh me to lie down in green pastures: ');
    expect(poetryTurn('The LORD is my shepherd; I shall not want.')).toBe(-1);
  });
  it('room for titles and summaries moves verses on, never drops or repeats one', () => {
    const verses = Array.from({ length: 40 }, (_, i) => ({ ref: `Ps.3.${i + 1}`, verse: i + 1, text: 'x'.repeat(90) }));
    const ch = { ref: 'Ps.3', number: 3, verses, book: { poetry: true } } as any;
    const plain = layoutBook('Ps', [ch], { normal: 1000, opening: 100, title: 100 });
    const roomy = layoutBook('Ps', [ch], { normal: 1000, opening: 100, title: 100 }, () => 300);
    for (const leaves of [plain, roomy]) {
      const seen = leaves.flatMap((l) => l.segments.flatMap((s) => Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i)));
      expect(seen).toEqual(verses.map((v) => v.verse));
    }
    expect(roomy[0].segments[0].to).toBeLessThan(plain[0].segments[0].to);
  });
});

/** JSON with keys in code-point order at every level, as the pipeline writes its checksum input. */
function canonical(v: unknown): string {
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
