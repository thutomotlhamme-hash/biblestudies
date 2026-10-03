/**
 * Every supplementary claim is checked against the wording of Scripture. Nothing here may assert
 * more than the text says; where the data cannot show its evidence, it must say so.
 */
import { describe, expect, it } from 'vitest';
import { expandRef, parseRef, refOfOrdinal } from '@/lib/content/refs';
import { fold, json, kjvHas, studyBooks, text } from './data';

const kjv = text();
const books = studyBooks();
const places: any[] = json('study/places.json').places;
const placeById = new Map(places.map((p) => [p.id, p]));
const people: any[] = json('study/people.json').people;
const personById = new Map(people.map((p) => [p.id, p]));
const atlas = json('study/atlas.json');
const connections = new Map<string, any>();
for (const b of books) for (const c of b.connections) connections.set(c.id, c);
const all = [...connections.values()];
const has = (ref: string) => expandRef(ref).every((r) => kjv.has(r));
const namesOf = (p: any) => [p.name, ...(p.names ?? []), ...(p.also ?? [])];

describe('Places', () => {
  it('every certainty is one of the five, and UNKNOWN places have no coordinates and are never drawn', () => {
    for (const p of places) {
      expect(['HIGH', 'PROBABLE', 'POSSIBLE', 'DISPUTED', 'UNKNOWN']).toContain(p.certainty);
      if (p.certainty === 'UNKNOWN') {
        expect(p.lat, p.id).toBeNull();
        expect(atlas.places[p.id], p.id).toBeUndefined();
      }
    }
    for (const id of Object.keys(atlas.places)) expect(placeById.get(id)?.certainty, id).not.toBe('UNKNOWN');
  });
  it('disputed places show their other proposals', () => {
    for (const p of places.filter((p) => p.certainty === 'DISPUTED' && p.modern)) expect(p.alternatives.length > 0 || !!p.identification, p.id).toBe(true);
  });
  it('every place span covers one of the place’s names', () => {
    for (const b of books)
      for (const [k, spans] of Object.entries<any[]>(b.spans))
        for (const [s, e, kind, id] of spans) {
          if (kind !== 'l') continue;
          const t = kjv.get(`${b.osis}.${k}`)!.slice(s, e).replace(/æ/g, 'ae').replace(/Æ/g, 'Ae');
          const p = placeById.get(id);
          expect(p, id).toBeTruthy();
          expect(namesOf(p).some((n: string) => n.toLowerCase() === t.toLowerCase()), `${b.osis}.${k} “${t}” ${id}`).toBe(true);
        }
  });
  it('every verse listed for a place names it', () => {
    for (const p of places) for (const n of p.v.slice(0, 40)) expect(namesOf(p).some((x: string) => kjv.get(refOfOrdinal(n))!.replace(/æ/g, 'ae').replace(/Æ/g, 'Ae').toLowerCase().includes(x.toLowerCase())), `${p.id} ${refOfOrdinal(n)}`).toBe(true);
  });
  it('same-place evidence is quoted from its verse', () => {
    for (const p of places) for (const s of p.curated?.samePlace ?? []) expect(kjvHas(s.evidence, s.phrase), p.id).toBe(true);
  });
  it('shared names are kept apart: Haran the man and Haran the place; the two Ramahs', () => {
    const spans = books.find((b) => b.osis === 'Gen')!.spans['11.31'];
    const t = kjv.get('Gen.11.31')!;
    const harans = spans.filter((s: any[]) => t.slice(s[0], s[1]) === 'Haran');
    expect(harans.map((s: any[]) => s[2])).toEqual(['p', 'l']);
    expect(books.find((b) => b.osis === '1Sam')!.spans['16.13'].some((s: any[]) => s[3] === 'ramah-samuel')).toBe(true);
    expect(books.find((b) => b.osis === 'Jer')!.spans['31.15'].some((s: any[]) => s[3] === 'ramah')).toBe(true);
    expect(books.find((b) => b.osis === 'Matt')!.spans['1.16'].some((s: any[]) => s[3] === 'jacob')).toBe(false);
  });
});

describe('People', () => {
  it('divine names are never marked as people, and no title is read as a person', () => {
    expect(people.some((p) => /^god$|holy.spirit/i.test(p.id))).toBe(false);
    for (const b of books)
      for (const [k, spans] of Object.entries<any[]>(b.spans))
        for (const [s, e, kind, id] of spans) {
          if (kind !== 'p') continue;
          const word = kjv.get(`${b.osis}.${k}`)!.slice(s, e);
          expect(['LORD', 'Lord', 'God', 'GOD', 'Lamb', 'Branch', 'Shiloh', 'Son'].includes(word), `${b.osis}.${k} ${word}`).toBe(false);
          const p = personById.get(id);
          expect(p, id).toBeTruthy();
          expect(namesOf(p).some((n: string) => n.replace(/-/g, '') === word.replace(/-/g, '')), `${b.osis}.${k} “${word}” ${id}`).toBe(true);
        }
  });
  it('a family link marked “stated” is in a verse that names both people', () => {
    for (const p of people)
      for (const r of p.relationships) {
        if (r.basis === 'not-identified') expect(r.ref).toBeNull();
        else {
          expect(has(r.ref), `${p.id} ${r.ref}`).toBe(true);
          const other = personById.get(r.to);
          // unnamed people carry descriptive labels ("the daughter of Lot"); only proper names can be checked
          if (!other || /\s[a-z(]/.test(other.name + ' ' + p.name)) continue;
          const t = fold(kjv.get(r.ref)!);
          expect(namesOf(p).some((n: string) => t.includes(fold(n))) && namesOf(other).some((n: string) => t.includes(fold(n))), `${p.id}→${r.to} ${r.ref}`).toBe(true);
        }
      }
  });
  it('curated relationships quote their verse', () => {
    for (const p of people) for (const r of p.curatedRelationships ?? []) expect(kjvHas(r.evidence, r.phrase), `${p.id} ${r.phrase}`).toBe(true);
  });
});

const FORMULA = /(written|scripture|spoken (by|of)|by the (mouth of )?(the )?prophets?|saith|said|spake|in the book of)/i;
describe('Connections', () => {
  it('have unique ids, existing verses and an evidence level 1–4', () => {
    expect(all.length).toBeGreaterThan(1000);
    for (const c of all) {
      expect([1, 2, 3, 4], c.id).toContain(c.level);
      for (const r of [...c.sourceVerses, c.anchorVerse, c.evidence.verse, ...c.targets.map((t: any) => t.ref)]) expect(has(r), `${c.id} ${r}`).toBe(true);
      expect(['curated', 'text-match']).toContain(c.method);
    }
  });
  it('shared wording really is in both passages', () => {
    for (const c of all)
      for (const t of c.targets) {
        if (t.nameForms) continue;
        expect(kjvHas(t.ref, t.sharedPhrase), `${c.id} target`).toBe(true);
        expect(c.sourceVerses.some((r: string) => kjvHas(r, t.sharedPhrase)), `${c.id} source`).toBe(true);
        if (t.anchorSpan) expect(kjv.get(c.anchorVerse)!.slice(t.anchorSpan[0], t.anchorSpan[1])).toBe(t.sharedPhrase);
        if (t.targetSpan) expect(fold(kjv.get(t.ref)!.slice(t.targetSpan[0], t.targetSpan[1]))).toBe(fold(t.sharedPhrase));
      }
  });
  it('level 1 only where the passage says it is quoting; level 2 only where it says “fulfilled”', () => {
    for (const c of all.filter((c) => c.method === 'text-match')) {
      const p = parseRef(c.anchorVerse);
      const ctx = (kjv.get(`${p.book}.${p.chapter}.${p.from - 1}`) ?? '') + ' ' + kjv.get(c.anchorVerse);
      if (c.level === 1) expect(FORMULA.test(ctx), c.id).toBe(true);
      if (c.level === 2) expect(/fulfil/i.test(ctx), c.id).toBe(true);
      if (c.level <= 2) expect(parseRef(c.targets[0].ref).book !== p.book).toBe(true);
    }
    for (const c of all.filter((c) => c.method === 'curated')) {
      if (c.types.includes('FULFILLED')) expect(c.sourceVerses.some((r: string) => kjvHas(r, 'fulfilled')), c.id).toBe(true);
      if (c.types.includes('AS_WRITTEN')) expect(c.sourceVerses.some((r: string) => kjvHas(r, 'written')), c.id).toBe(true);
    }
  });
  it('machine-found links are drafts that say how they were found', () => {
    const prov = books[0].machineProvenance;
    expect(prov.editorial.status).toBe('draft');
    expect(prov.editorial.author).toMatch(/pipeline/i);
    expect(prov.notes).toMatch(/not interpreted/);
  });
  it('the prophet is identified from Scripture itself (Phase 1 & 2 curated links)', () => {
    for (const c of all.filter((c) => c.prophet)) {
      const p = c.prophet;
      expect(c.sourceVerses.some((r: string) => kjvHas(r, p.attribution)), `${c.id} attribution`).toBe(true);
      if (p.name) {
        expect(kjvHas(p.identifiedBy, p.identifiedPhrase), `${c.id} identified`).toBe(true);
        expect(kjvHas(p.identifiedBy, p.name), `${c.id} name`).toBe(true);
      } else expect(c.targets.length).toBe(0);
    }
  });
});

describe('Threads, phrases, journeys, timeline, genealogies, scale', () => {
  it('every thread passage matches its wording (or names its place)', () => {
    for (const t of json('study/threads.json').threads) {
      expect(t.v.length, t.id).toBeGreaterThanOrEqual(3);
      if (t.match) {
        const re = new RegExp(t.match, 'i');
        for (const n of t.v) expect(re.test(kjv.get(refOfOrdinal(n))!), `${t.id} ${refOfOrdinal(n)}`).toBe(true);
      } else expect(t.v).toEqual(placeById.get(t.place).v);
    }
  });
  it('each repeated phrase stands, word for word, in every passage listed', () => {
    for (const ph of json('study/phrases.json').phrases) {
      expect(ph.v.length, ph.id).toBeGreaterThanOrEqual(2);
      for (const n of ph.v) expect(kjv.get(refOfOrdinal(n))!.toLowerCase(), `${ph.id}`).toContain(ph.phrase.toLowerCase());
    }
  });
  it('journeys: verses exist, places exist, the destination is named, and lines are honest', () => {
    for (const j of json('study/journeys.json').journeys)
      for (const s of j.segments) {
        for (const r of s.verses) expect(has(r), `${s.id} ${r}`).toBe(true);
        for (const id of [s.from, s.to]) if (id) expect(placeById.has(id), `${s.id} ${id}`).toBe(true);
        expect(['explicit', 'approximate', 'reconstructed']).toContain(s.certainty);
        if (s.path && s.path.length > 2) expect(s.certainty).not.toBe('explicit');
        if (s.certainty === 'explicit') for (const id of [s.from, s.to]) if (id) expect(['HIGH', 'PROBABLE'], `${s.id} ${id}`).toContain(placeById.get(id).certainty);
        const drawable = [s.from, s.to].every((id) => !id || atlas.places[id]);
        if (!s.path) expect(!!atlas.segments[s.id], s.id).toBe(drawable && !!s.from && !!s.to);
        if (j.origin === 'pipeline') {
          const to = placeById.get(s.to);
          const joined = s.verses.map((r: string) => fold(kjv.get(r)!)).join(' ');
          expect(namesOf(to).some((n: string) => joined.includes(fold(n)) || joined.includes(fold(n.replace(/^Mount /, '')))), `${s.id} → ${s.to}`).toBe(true);
        }
      }
  });
  it('timeline items carry a certainty label and verses; traditional dates say so', () => {
    const tl = json('study/timeline.json');
    for (const t of tl.items) {
      expect(tl.certaintyLabels).toContain(t.certainty);
      for (const r of t.refs) expect(has(r), `${t.id} ${r}`).toBe(true);
      if (t.origin === 'theographic') expect(t.certainty).toBe('Traditional chronology');
    }
    expect(tl.traditionalNote).toMatch(/model-dependent/);
  });
  it('genealogies quote every link from its verse and contain no loops', () => {
    for (const g of json('study/genealogies.json').genealogies) {
      expect(g.edges.length, g.id).toBeGreaterThan(5);
      for (const e of g.edges) expect(kjvHas(e.evidence, e.phrase), `${g.id} ${e.phrase}`).toBe(true);
      // acyclic: following parent → child never returns to a node
      const kids = new Map<string, string[]>();
      for (const e of g.edges) kids.set(e.parentId, [...(kids.get(e.parentId) ?? []), e.childId]);
      const state = new Map<string, number>();
      const visit = (n: string): boolean => {
        if (state.get(n) === 1) return false;
        if (state.get(n) === 2) return true;
        state.set(n, 1);
        const ok = (kids.get(n) ?? []).every(visit);
        state.set(n, 2);
        return ok;
      };
      for (const n of kids.keys()) expect(visit(n), `${g.id} loop at ${n}`).toBe(true);
    }
    const gens = json('study/genealogies.json').genealogies;
    const luke = gens.find((g: any) => g.id === 'luke-3');
    expect(luke.nodes[0].name).toBe('Jesus');
    expect(luke.nodes.map((n: any) => n.name)).toContain('Adam');
    expect(luke.note).toMatch(/does not reconcile/);
    expect(gens.find((g: any) => g.id === 'genesis-5').nodes.map((n: any) => n.name)).toContain('Methuselah');
  });
  it('measurements quote the verse that gives them; conversions are labelled as estimates', () => {
    const sc = json('study/scale.json');
    for (const set of sc.sets) for (const m of set.items) expect(kjvHas(m.evidence, m.phrase), `${set.id} ${m.id}`).toBe(true);
    for (const u of Object.values<any>(sc.units)) expect(u.note).toBeTruthy();
  });
});

describe('Original-language study aid', () => {
  it('covers every book and is labelled as a study aid, not a translation', () => {
    const gen = json('original/Gen.json');
    expect(gen.words['1.1']).toHaveLength(7);
    expect(gen.words['1.1'][0][3]).toBe('H7225G');
    expect(gen.note).toMatch(/not a translation/);
    const matt = json('original/Matt.json');
    expect(matt.words['2.6'].some((w: any[]) => w[2] === 'Bethlehem')).toBe(true);
    expect(matt.source).toMatch(/CC BY/);
  });
});
