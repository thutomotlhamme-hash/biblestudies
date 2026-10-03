/**
 * Deep Made Simple — supplementary, never Scripture. Every quotation must be the KJV's exact words,
 * every claim must cite a real verse and carry a level, every story link must be shown by the text,
 * and nothing may be published without a named reviewer.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expandRef } from '@/lib/content/refs';
import { json, studyBooks, text } from './data';

const kjv = text();
const index = json('study/deep/index.json');
const stories: any[] = json('study/deep/stories.json').stories;
const items: any[] = Object.keys(index.books).flatMap((b) => Object.values<any>(json(`study/deep/${b}.json`).chapters).flatMap((c) => c.items));
const claims = items.flatMap((i) => i.claims.map((c: any) => ({ ...c, item: i.id })));
const connections = new Map<string, any>();
for (const b of studyBooks()) for (const c of b.connections) connections.set(c.id, c);
const word = (w: string) => new RegExp(`(?<![A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`);
const isRef = (r: string) => expandRef(r).every((x) => kjv.has(x));

describe('Deep Made Simple', () => {
  it('lives in study/deep/, apart from Scripture, and labels itself supplementary', () => {
    const files = readdirSync('public/data/study/deep');
    for (const f of ['Gen.json', 'Matt.json', 'index.json', 'stories.json']) expect(files).toContain(f);
    expect(files.every((f) => f.endsWith('.json'))).toBe(true);
    expect(index.name).toBe('Deep Made Simple');
    expect(index.label).toBe('Supplementary — not Scripture');
    for (const tr of readdirSync('public/data/text')) for (const f of readdirSync(`public/data/text/${tr}`)) expect(readFileSync(`public/data/text/${tr}/${f}`, 'utf8')).not.toMatch(/Deep Made Simple|"deep-[a-z]+-\d|"story-/);
  });

  it('covers the first set: Genesis 1–12 and Matthew 1–2', () => {
    for (let c = 1; c <= 12; c++) expect(index.books.Gen).toContain(String(c));
    expect(index.books.Matt).toEqual(expect.arrayContaining(['1', '2']));
    expect(stories.length).toBeGreaterThanOrEqual(3);
    expect(items.some((i) => i.topic === 'place') && items.some((i) => i.topic === 'person') && items.some((i) => i.topic === 'word') && items.some((i) => i.kind === 'link')).toBe(true);
  });

  it('every quoted verse matches the KJV text exactly', () => {
    const quotes = claims.filter((c) => c.quote);
    expect(quotes.length).toBeGreaterThan(20);
    for (const c of quotes) {
      expect(kjv.has(c.quote.ref), c.item).toBe(true);
      expect(c.quote.text.length, c.item).toBeGreaterThan(0);
      expect(kjv.get(c.quote.ref)!.includes(c.quote.text), `${c.item}: “${c.quote.text}” in ${c.quote.ref}`).toBe(true);
    }
    for (const s of stories) for (const st of s.steps) expect(kjv.get(st.ref)!.includes(st.phrase), `${s.id} ${st.ref}: “${st.phrase}”`).toBe(true);
  });

  it('claims never put words in double quotation marks outside an exact quotation', () => {
    for (const c of claims) {
      if (c.item.includes('-link-x-nazarene')) continue; // curated connection note, quoted from its own verse below
      if (c.text.startsWith('STEPBible’s brief lexicon')) continue; // the lexicon's own wording, attributed to it
      expect(c.text, c.item).not.toMatch(/[“”"]/);
    }
    const naz = claims.find((c) => c.item.includes('-link-x-nazarene') && c.text.includes('Nazarene'));
    expect(kjv.get('Matt.2.23')).toContain('He shall be called a Nazarene');
    expect(naz.text).toContain('He shall be called a Nazarene');
  });

  it('every claim cites real verses and carries a level 1–4; every item a source and its weakest level', () => {
    for (const i of items) {
      expect(['research', 'link']).toContain(i.kind);
      expect(['deep', 'connection']).toContain(i.scale);
      expect(i.source, i.id).toBeTruthy();
      expect(isRef(i.anchor), i.id).toBe(true);
      expect(i.anchor.startsWith(i.chapter + '.') || i.kind === 'link', i.id).toBe(true);
      expect(i.claims.length, i.id).toBeGreaterThan(0);
      for (const c of i.claims) {
        expect([1, 2, 3, 4], i.id).toContain(c.level);
        expect(c.refs.length, i.id).toBeGreaterThan(0);
        for (const r of c.refs) expect(isRef(r), `${i.id} ${r}`).toBe(true);
      }
      if (i.kind === 'research') expect(i.level, i.id).toBe(Math.max(...i.claims.map((c: any) => c.level)));
    }
  });

  it('research about a place or person names it in the verses it cites; words come from the original-language data', () => {
    const books: Record<string, any> = { Gen: json('original/Gen.json'), Matt: json('original/Matt.json') };
    for (const i of items.filter((x) => x.kind === 'research')) {
      const named = i.claims[0];
      if (i.topic === 'word') {
        const strong = i.id.split('-word-')[1].toUpperCase();
        for (const r of named.refs) {
          const [b, c, v] = r.split('.');
          expect(books[b].words[`${c}.${v}`].some((w: any[]) => w[3].toUpperCase() === strong), `${i.id} ${r}`).toBe(true);
        }
      } else {
        const sb = studyBooks().find((b) => b.osis === i.chapter.split('.')[0])!;
        const id = i.object.id;
        for (const r of named.refs) expect(sb.spans[r.split('.').slice(1).join('.')].some((s: any[]) => s[3] === id), `${i.id} ${r}`).toBe(true);
      }
    }
  });

  it('links reuse the connections engine and keep its level', () => {
    for (const i of items.filter((x) => x.kind === 'link')) {
      const c = connections.get(i.object.id);
      expect(c, i.id).toBeTruthy();
      expect(i.level).toBe(c.level);
      expect(i.scale).toBe('connection');
    }
  });

  it('stories link each passage to an earlier one by what the text shows', () => {
    for (const s of stories) {
      expect(s.steps[0].link).toBe('start');
      s.steps.forEach((st: any, n: number) => {
        if (!n) return;
        const [prev, here] = st.why.refs;
        expect(here).toBe(st.ref);
        expect(s.steps.slice(0, n).some((x: any) => x.ref === prev), `${s.id} step ${n + 1}`).toBe(true);
        if (st.link === 'same-chapter') expect(prev.split('.').slice(0, 2)).toEqual(st.ref.split('.').slice(0, 2));
        if (st.link === 'word') {
          expect(kjv.get(prev)!).toMatch(word(st.why.word));
          expect(kjv.get(st.ref)!).toMatch(word(st.why.word));
        }
        if (st.link === 'connection') {
          const c = connections.get(st.why.connection);
          const ends = new Set([c.anchorVerse, ...c.sourceVerses, ...c.targets.map((t: any) => t.ref)]);
          expect(ends.has(prev) && ends.has(st.ref), `${s.id} ${st.why.connection}`).toBe(true);
          expect(st.why.level).toBe(c.level);
        }
      });
      // a quoted story title quotes words that stand in one of its passages
      const q = s.title.match(/“([^”]+)”/);
      if (q) expect(s.steps.some((st: any) => kjv.get(st.ref)!.includes(q[1])), s.id).toBe(true);
    }
  });

  it('AI never publishes: nothing moves past draft without a named reviewer', () => {
    for (const x of [...items, ...stories]) {
      expect(x.editorial.author, x.id).toBeTruthy();
      if (x.editorial.status !== 'draft' || x.editorial.reviewedBy) expect(x.editorial.reviewedBy, x.id).toBeTruthy();
    }
  });

  it('the review ledger accepts Deep Made Simple as an object type', () => {
    const sql = readFileSync('supabase/migrations/0002_hb_deep_made_simple.sql', 'utf8');
    expect(sql).toMatch(/object_type in \([^)]*'deep'/);
  });

  it('video notes credit a catalogued video and a moment in it, in our own words', () => {
    const catalog = new Map(json<any>('../../content/meta/deep-videos.json').videos.map((v: any) => [v.id, v]));
    for (const i of items.filter((x) => x.topic === 'video')) {
      expect(i.object.kind).toBe('video');
      expect(catalog.has(i.object.id), i.id).toBe(true);
      expect(Number.isInteger(i.object.start) && i.object.start >= 0, i.id).toBe(true);
      expect(i.source, i.id).toMatch(/YouTube, @deepmadesimple/);
      expect(i.editorial.status === 'draft' || !!i.editorial.reviewedBy, i.id).toBe(true);
    }
  });
});

describe('deep:sync caption cleaning', () => {
  it('turns rolling auto-captions into clean timestamped lines, without repeats', async () => {
    const { cleanVtt } = await import('../../scripts/pipeline/deep-sync.mjs');
    const vtt = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:03.000 align:start position:0%
in<00:00:01.500><c> the</c><00:00:02.000><c> beginning</c>

00:00:03.000 --> 00:00:03.010 align:start position:0%
in the beginning

00:00:03.010 --> 00:00:06.000 align:start position:0%
in the beginning
God created the heaven

00:01:05.000 --> 00:01:07.000
God created the heaven
and the earth &amp; all
`;
    expect(cleanVtt(vtt)).toBe('[00:01] in the beginning\n[00:03] God created the heaven\n[01:05] and the earth & all\n');
  });
});
