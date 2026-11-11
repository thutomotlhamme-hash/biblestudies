/** Tappable names in every translation, section headings and tribes — supplementary, never Scripture. */
import { describe, expect, it } from 'vitest';
import { mapHits } from '@/lib/content/names';
import { segmentVerse } from '@/lib/content/runs';
import type { Hit } from '@/lib/content/segment';
import { traceTribe } from '@/lib/content/tribe';
import { expandRef } from '@/lib/content/refs';
import { json, studyBooks, text } from './data';

const kjv = text('kjv');
const books = studyBooks();

describe('names carried from the KJV to other translations', () => {
  for (const tr of ['asv', 'ylt']) {
    it(`${tr}: every marked name is the same name, whole, and the verse is unchanged`, () => {
      const other = text(tr);
      let marked = 0;
      for (const b of books)
        for (const [k, spans] of Object.entries<any[]>(b.spans)) {
          const ref = `${b.osis}.${k}`;
          const hits: Hit[] = spans.map(([start, end, kind, id]) => ({ start, end, id, kind: kind === 'p' ? 'person' : 'place' }));
          const t = other.get(ref);
          if (!t) continue;
          const mapped = mapHits(kjv.get(ref)!, hits, t);
          for (const h of mapped) {
            const names = hits.filter((x) => x.id === h.id && x.kind === h.kind).map((x) => kjv.get(ref)!.slice(x.start, x.end));
            expect(names, ref).toContain(t.slice(h.start, h.end));
            expect(/[\p{L}\p{N}]/u.test(t[h.start - 1] ?? ' ') || /[\p{L}\p{N}]/u.test(t[h.end] ?? ' '), ref).toBe(false);
          }
          expect(segmentVerse(t, mapped).map((r) => r.text).join(''), ref).toBe(t);
          marked += mapped.length;
        }
      expect(marked).toBeGreaterThan(20000);
    });
  }
  it('a name spelt differently is left unmarked, never altered', () => {
    const k = 'And Abram went down into Egypt';
    const hits: Hit[] = [{ start: 4, end: 9, id: 'abraham', kind: 'person' }, { start: 25, end: 30, id: 'egypt' }];
    expect(mapHits(k, hits, 'And Abraham went down to Egypt')).toEqual([{ start: 25, end: 30, id: 'egypt' }]);
  });
});

describe('section headings', () => {
  const h = json('study/headings.json');
  it('are supplementary, credited, drafts, and sit on real verses in order', () => {
    expect(h.source).toMatch(/Theographic/);
    expect(h.editorial.status === 'draft' || !!h.editorial.reviewedBy).toBe(true);
    const tl = new Map(json('study/timeline.json').items.map((i: any) => [i.id, i]));
    for (const [ref, x] of Object.entries<any>(h.headings)) {
      expect(kjv.has(ref), ref).toBe(true);
      expect(expandRef(x.to).every((r) => kjv.has(r)), ref).toBe(true);
      expect(x.label.trim().length).toBeGreaterThan(2);
      expect((tl.get(x.event) as any)?.label, ref).toBe(x.label);
    }
    expect(h.headings['Gen.11.1'].label).toBe('Tower of Babel');
    expect(Object.keys(h.headings).filter((r) => r.startsWith('Gen.5.')).every((r) => !/^(Lifetime|Death|Birth) of/.test(h.headings[r].label))).toBe(true);
  });
});

describe('tribes traced through the family links', () => {
  const people = new Map<string, any>(json('study/people.json').people.map((p: any) => [p.id, p]));
  it('David of Judah, Moses of Levi; every step is a father link the dataset records', () => {
    expect(traceTribe('david', people)?.tribe).toBe('Judah');
    expect(traceTribe('moses', people)?.tribe).toBe('Levi');
    for (const id of ['david', 'moses']) {
      const t = traceTribe(id, people)!;
      t.steps.slice(1).forEach((s, i) => expect(people.get(t.steps[i].id).relationships.some((r: any) => r.type === 'father' && r.to === s.id)).toBe(true));
    }
    expect(traceTribe('abraham', people)).toBeNull();
  });
});

describe('journeys of the major figures', () => {
  const journeys: any[] = json('study/journeys.json').journeys;
  const people = new Map<string, any>(json('study/people.json').people.map((p: any) => [p.id, p]));
  const byId = new Map(journeys.map((j) => [j.id, j]));
  it('Moses, Jesus, David and others: whole lives, every person real, every stage cited', () => {
    for (const id of ['moses-life', 'jesus-life', 'david-life', 'samuel', 'elisha', 'jonah', 'jeremiah', 'daniel', 'nehemiah', 'peter', 'philip', 'paul-early', 'abraham-later']) {
      const j = byId.get(id);
      expect(j, id).toBeTruthy();
      expect(j.people.length, id).toBeGreaterThan(0);
      for (const p of j.people) expect(people.has(p), `${id} ${p}`).toBe(true);
      expect(j.editorial.status === 'draft' || !!j.editorial.reviewedBy).toBe(true);
    }
    expect(byId.get('moses-life').segments.length).toBeGreaterThanOrEqual(12);
    const gospels = new Set(byId.get('jesus-life').segments.flatMap((s: any) => s.verses.map((r: string) => r.split('.')[0])));
    for (const b of ['Matt', 'Mark', 'Luke', 'John']) expect(gospels.has(b), b).toBe(true);
    // every journey of a person can be found from that person
    expect(journeys.filter((j) => j.people?.includes('moses')).map((j) => j.id)).toEqual(expect.arrayContaining(['exodus', 'wilderness', 'moses-life']));
  });
});
