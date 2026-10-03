/**
 * The Library — the whole Bible and every supplementary layer, loaded lazily.
 *
 * Scripture comes only through a TranslationAdapter. Supplementary layers are separate files
 * (public/data/study) and refer to verses by reference or by verse ordinal. Nothing here ever
 * alters Scripture: name spans are character ranges, applied by wrapping, never by rewriting.
 *
 * Loading is per book: opening a chapter loads that book's text and its study layer (names, the
 * connections that touch it, journey anchors, events). Registries (all places, all people, the
 * timeline, the atlas) load only when a view needs them. Components read synchronously and
 * re-render when the library's version changes (see useLibrary).
 */
import curatedChapters from '@content/meta/chapters.json';
import curatedInserts from '@content/meta/inserts.json';
import { fetchJson } from '@/lib/library/base';
import { isEditorialPreview, visibleByStatus } from './editorial';
import { allBooks, canonicalIndex, chapterOf, getBook, ordinalOf, parseRef, refOfOrdinal } from './refs';
import { DEFAULT_TRANSLATION, getTranslation, type TranslationAdapter } from './translation';
import type {
  Chapter,
  ChapterMeta,
  ChapterRef,
  ContextArtifact,
  CrossReference,
  DeepItem,
  DeepStory,
  Editorial,
  EvidenceLevel,
  Genealogy,
  Journey,
  MapBase,
  Measurements,
  Page,
  Person,
  Phrase,
  Place,
  Scale,
  Thread,
  TimelineEvent,
  Verse,
  VerseEntities,
  VerseRef,
} from './types';

/** Split a chapter into pages of roughly equal reading length (layout only, never Scripture). */
export function paginate(verses: Verse[], breaks?: number[]): Page[] {
  if (!verses.length) return [{ index: 0, from: 1, to: 1 }];
  if (breaks) return breaks.map((from, i) => ({ index: i, from, to: (breaks[i + 1] ?? verses.length + 1) - 1 }));
  const TARGET = 1150; // characters per page, tuned for a phone-sized page at the default size
  const total = verses.reduce((n, v) => n + v.text.length, 0);
  const count = Math.max(1, Math.round(total / TARGET));
  const per = total / count;
  const pages: Page[] = [];
  let acc = 0;
  let from = 1;
  verses.forEach((v, i) => {
    acc += v.text.length;
    const boundary = acc >= per * (pages.length + 1) - v.text.length * 0.4;
    if ((boundary && pages.length < count - 1) || i === verses.length - 1) {
      pages.push({ index: pages.length, from, to: v.verse });
      from = v.verse + 1;
    }
  });
  return pages;
}

// Where in the story a chapter sits — used to choose the Atlas layer to open. Curated chapters override.
function eraOf(book: string, ch: number): string {
  if (book === 'Gen') return ch <= 11 ? 'primeval' : ch <= 25 ? 'abraham' : ch <= 36 ? 'jacob' : 'joseph';
  if (['Exod', 'Lev', 'Num', 'Deut'].includes(book)) return book === 'Exod' && ch <= 19 ? 'exodus' : 'wilderness';
  if (book === 'Josh') return 'conquest';
  if (book === 'Judg' || book === 'Ruth') return book === 'Ruth' ? 'ruth' : 'judges';
  if (['1Sam', '2Sam', '1Chr'].includes(book)) return 'david';
  if (['1Kgs', '2Kgs', '2Chr'].includes(book)) return book === '1Kgs' && ch >= 17 ? 'elijah' : 'kings';
  if (['Ezra', 'Neh', 'Esth', 'Hag', 'Zech', 'Mal'].includes(book)) return 'return';
  if (['Jer', 'Lam', 'Ezek', 'Dan'].includes(book)) return 'exile';
  if (['Matt', 'Mark', 'Luke', 'John'].includes(book)) return 'gospel';
  if (book === 'Acts') return 'acts';
  return getBook(book).testament === 'NT' ? 'church' : 'prophets';
}

type Mini = Record<string, [string, string, string, number | null, number | null]>;
interface StudyBook {
  book: string;
  spans: Record<string, [number, number, 'l' | 'p', string][]>;
  places: Mini;
  people: Record<string, [string, string | null]>;
  connections: CrossReference[];
  machineProvenance: { evidenceLevel: EvidenceLevel; source: string; notes: string; editorial: Editorial };
  journeys: { journey: string; segment: string; ref: VerseRef }[];
  events: { id: string; ref: VerseRef; label: string; year: number; certainty: string }[];
  chronology: Record<string, number>;
}
type WithV<T> = T & { v?: number[] };
export interface DeepIndex {
  name: string;
  tagline: string;
  label: string;
  note: string;
  levels: Record<string, string>;
  books: Record<string, string[]>;
  stories: string[];
}

export interface BookEvent {
  id: string;
  ref: VerseRef;
  label: string;
  year: number;
  certainty: string;
}

export class Library {
  version = 0;
  chapters: Chapter[] = [];
  chapterByRef = new Map<ChapterRef, Chapter>();
  places: Place[] = [];
  placeById = new Map<string, Place>();
  people: Person[] = [];
  personById = new Map<string, Person>();
  journeys: Journey[] = [];
  certaintyLegend: Record<string, string> = {};
  distanceNote = '';
  connections: CrossReference[] = [];
  private connectionIds = new Set<string>();
  phrases: Phrase[] = [];
  threads: Thread[] = [];
  threadPassages = new Map<string, VerseRef[]>();
  timeline: TimelineEvent[] = [];
  timelineLabels: string[] = [];
  traditionalNote = '';
  genealogy!: Genealogy;
  genealogies: Genealogy[] = [];
  measurements!: Measurements;
  scale: Scale | null = null;
  inserts: ContextArtifact[] = [];
  map: MapBase | null = null;
  chronologyModel = '';
  translation: TranslationAdapter;
  /** Name spans are character ranges in the KJV text, so the KJV is always loaded alongside. */
  readonly kjv: TranslationAdapter;
  entities = new Map<VerseRef, VerseEntities>();
  occurrences = { places: new Map<string, VerseRef[]>(), people: new Map<string, VerseRef[]>(), phrases: new Map<string, VerseRef[]>() };
  events = new Map<string, BookEvent[]>();
  segmentsByRef = new Map<VerseRef, { journey: string; segment: string }[]>();
  /** Deep Made Simple — supplementary layer for the covered chapters (study/deep/). */
  deep = { index: null as DeepIndex | null, items: new Map<ChapterRef, DeepItem[]>(), stories: [] as DeepStory[], storiesByChapter: new Map<ChapterRef, string[]>() };
  ready = false;
  registries = { places: false, people: false, timeline: false, map: false };
  errors: string[] = [];

  private listeners = new Set<() => void>();
  private study = new Map<string, StudyBook>();
  private bookLoads = new Map<string, Promise<void>>();
  private phraseByOrdinal = new Map<number, string[]>();
  private threadOrdinals = new Map<string, number[]>();
  private initP: Promise<void> | null = null;
  private regP = new Map<string, Promise<void>>();

  constructor(translationId = DEFAULT_TRANSLATION) {
    this.translation = getTranslation(translationId);
    this.kjv = getTranslation('kjv');
    const metas = new Map((curatedChapters as ChapterMeta[]).map((m) => [m.ref, m]));
    for (const b of allBooks()) {
      b.verses!.forEach((count, i) => {
        const ref = `${b.osis}.${i + 1}`;
        const m = metas.get(ref);
        const c: Chapter = {
          ref,
          era: m?.era ?? eraOf(b.osis, i + 1),
          chrono: m?.chrono ?? 0,
          pageBreaks: m?.pageBreaks,
          book: b,
          number: i + 1,
          verses: [],
          pages: [{ index: 0, from: 1, to: count }],
          index: this.chapters.length,
          verseCount: count,
          loaded: false,
          year: null,
        };
        this.chapters.push(c);
        this.chapterByRef.set(ref, c);
      });
    }
    this.genealogy = { id: 'matthew-1', title: '', evidence: 'Matt.1.1', nodes: [], edges: [], evidenceLevel: 'A', source: '', editorial: { author: '', status: 'draft', reviewedBy: null, reviewedAt: null } };
    this.measurements = { cubit: { common: 0.4572, long: 0.524, note: '' }, items: [], evidenceLevel: 'A', source: '', editorial: this.genealogy.editorial };
  }

  // ------------------------------------------------------------------ subscription
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private bump() {
    this.version++;
    for (const l of this.listeners) l();
  }

  // ------------------------------------------------------------------ core
  init(): Promise<void> {
    if (this.initP) return this.initP;
    this.initP = (async () => {
      const [journeys, threads, phrases, gens, scale, chron, deepIndex, deepStories] = await Promise.all([
        fetchJson<{ certaintyLegend: Record<string, string>; distanceNote: string; journeys: Journey[] }>('study/journeys.json'),
        fetchJson<{ threads: WithV<Thread>[] }>('study/threads.json'),
        fetchJson<{ phrases: WithV<Phrase>[] }>('study/phrases.json'),
        fetchJson<{ genealogies: Genealogy[] }>('study/genealogies.json'),
        fetchJson<Scale & { sets: { id: string; items: Measurements['items'] }[] }>('study/scale.json'),
        fetchJson<{ model: string; chapters: Record<string, number> }>('study/chronology.json'),
        // Deep Made Simple is optional: the Bible reads without it.
        fetchJson<DeepIndex>('study/deep/index.json').catch(() => null),
        fetchJson<{ stories: DeepStory[] }>('study/deep/stories.json').catch(() => ({ stories: [] })),
      ]);
      this.deep.index = deepIndex;
      this.deep.stories = visibleByStatus(deepStories.stories);
      this.journeys = visibleByStatus(journeys.journeys);
      this.certaintyLegend = journeys.certaintyLegend;
      this.distanceNote = journeys.distanceNote;
      for (const j of this.journeys) for (const s of j.segments) for (const v of s.verses) {
        const list = this.segmentsByRef.get(v) ?? [];
        list.push({ journey: j.id, segment: s.id });
        this.segmentsByRef.set(v, list);
      }
      this.threads = visibleByStatus(threads.threads);
      for (const t of threads.threads) this.threadOrdinals.set(t.id, t.v ?? []);
      this.phrases = visibleByStatus(phrases.phrases);
      for (const p of phrases.phrases) {
        const refs = (p.v ?? []).map(refOfOrdinal);
        this.occurrences.phrases.set(p.id, refs);
        for (const n of p.v ?? []) this.phraseByOrdinal.set(n, [...(this.phraseByOrdinal.get(n) ?? []), p.id]);
      }
      this.genealogies = visibleByStatus(gens.genealogies);
      this.genealogy = this.genealogies.find((g) => g.id === 'matthew-1') ?? this.genealogy;
      this.scale = scale;
      const tab = scale.sets.find((s) => s.id === 'tabernacle');
      this.measurements = { cubit: { common: scale.units.cubit.common!, long: scale.units.cubit.long!, note: scale.units.cubit.note }, items: tab?.items ?? [], evidenceLevel: scale.evidenceLevel, source: scale.source, editorial: scale.editorial };
      this.chronologyModel = chron.model;
      for (const [k, y] of Object.entries(chron.chapters)) {
        const c = this.chapterByRef.get(k);
        if (c) c.year = y;
      }
      // chronological rank for every chapter: curated journey chapters first by their curated rank,
      // then by traditional year, then canonical order
      this.inserts = [...visibleByStatus(curatedInserts as ContextArtifact[]), ...this.generatedInserts()];
      this.ready = true;
      this.bump();
    })();
    this.initP.catch((e) => {
      this.errors.push(String(e));
      this.initP = null;
      this.bump();
    });
    return this.initP;
  }

  private generatedInserts(): ContextArtifact[] {
    const ed: Editorial = { author: 'Claude (AI draft)', status: 'draft', reviewedBy: null, reviewedAt: null };
    const out: ContextArtifact[] = [];
    for (const s of this.scale?.sets ?? []) {
      if (s.id === 'tabernacle') continue;
      out.push({ id: `insert-scale-${s.id}`, kind: 'scale', anchorVerse: s.anchor, title: s.title, subtitle: 'Measurements as Scripture gives them', focus: s.id, editorial: ed, evidenceLevel: 'A' });
    }
    for (const g of this.genealogies) {
      if (g.kind === 'matthew') continue;
      out.push({ id: `insert-genealogy-${g.id}`, kind: 'genealogy', anchorVerse: g.evidence, title: g.title, subtitle: 'As written', focus: g.id, editorial: ed, evidenceLevel: 'A' });
    }
    return out;
  }

  // ------------------------------------------------------------------ translation
  setTranslation(id: string) {
    if (id === this.translation.translation.id) return;
    this.translation = getTranslation(id);
    for (const c of this.chapters) {
      c.loaded = false;
      c.verses = [];
    }
    this.bookLoads.clear();
    this.bump();
  }

  isBookLoaded(book: string) {
    return this.translation.hasBook(book) && this.kjv.hasBook(book) && this.study.has(book);
  }

  /** Load a book's text (active translation and KJV) and its study layer. */
  ensureBook(book: string): Promise<void> {
    if (this.isBookLoaded(book) && this.chapterByRef.get(`${book}.1`)?.loaded) return Promise.resolve();
    let p = this.bookLoads.get(book);
    if (!p) {
      p = (async () => {
        const [, , study] = await Promise.all([
          this.translation.loadBook(book),
          this.kjv.loadBook(book),
          this.study.has(book) ? Promise.resolve(this.study.get(book)!) : fetchJson<StudyBook>(`study/books/${book}.json`),
        ]);
        this.study.set(book, study);
        this.applyBook(book, study);
        void this.ensureDeep(book);
        this.bump();
      })();
      p.catch((e) => {
        this.bookLoads.delete(book);
        this.errors.push(String(e));
        this.bump();
      });
      this.bookLoads.set(book, p);
    }
    return p;
  }

  ensureChapter(ref: ChapterRef) {
    return this.ensureBook(ref.split('.')[0]);
  }

  ensureRefs(refs: VerseRef[]) {
    return Promise.all([...new Set(refs.map((r) => parseRef(r).book))].map((b) => this.ensureBook(b)));
  }

  hasRefs(refs: VerseRef[]) {
    return refs.every((r) => this.isBookLoaded(parseRef(r).book));
  }

  private applyBook(book: string, s: StudyBook) {
    const b = getBook(book);
    for (let i = 1; i <= b.chapterCount!; i++) {
      const c = this.chapterByRef.get(`${book}.${i}`)!;
      c.verses = this.translation.chapterVerses(book, i);
      c.pages = paginate(c.verses, c.pageBreaks && this.translation.translation.id === 'kjv' ? c.pageBreaks : c.pageBreaks);
      c.loaded = true;
    }
    for (const [id, [name, kind, certainty, lon, lat]] of Object.entries(s.places)) {
      if (!this.placeById.has(id)) this.setPlace({ id, name, kind, certainty: certainty as Place['certainty'], lon, lat, names: [], modern: null, alternatives: [], partial: true, evidenceLevel: 'B', source: '', editorial: s.machineProvenance.editorial });
    }
    for (const [id, [name, gender]] of Object.entries(s.people)) {
      if (!this.personById.has(id)) this.setPerson({ id, name, gender, also: [], relationships: [], partial: true, evidenceLevel: 'B', source: '', editorial: s.machineProvenance.editorial });
    }
    for (const c of s.connections) {
      if (this.connectionIds.has(c.id)) continue;
      const full: CrossReference = c.method === 'text-match' ? { ...s.machineProvenance, ...c, threadIds: c.threadIds ?? [] } : c;
      if (visibleByStatus([full]).length && full.evidenceLevel !== 'D') {
        this.connections.push(full);
        this.connectionIds.add(c.id);
      }
    }
    this.events.set(book, s.events);
    // Name spans come from the pipeline as drafts. A production build (published material only)
    // shows none of them until they have been reviewed and published.
    const spansFor = isEditorialPreview ? s.spans : {};
    for (const [key, spans] of Object.entries(spansFor)) {
      const ref = `${book}.${key}`;
      this.entities.set(ref, {
        places: spans.filter((x) => x[2] === 'l').map(([start, end, , id]) => ({ start, end, id })),
        people: [...new Set(spans.filter((x) => x[2] === 'p').map((x) => x[3]))],
        phrases: this.phraseByOrdinal.get(ordinalOf(ref)) ?? [],
      });
    }
    // phrases in verses without names
    for (const [n, ids] of this.phraseByOrdinal) {
      const ref = refOfOrdinal(n);
      if (parseRef(ref).book === book && !this.entities.has(ref)) this.entities.set(ref, { places: [], people: [], phrases: ids });
    }
  }

  /** Load the Deep Made Simple layer for a book, when the index says it covers that book. */
  async ensureDeep(book: string): Promise<void> {
    await this.init().catch(() => {});
    if (!this.deep.index?.books[book] || this.deep.items.has(`${book}.${this.deep.index.books[book][0]}`)) return;
    const f = await fetchJson<{ chapters: Record<string, { items: DeepItem[]; stories: string[] }> }>(`study/deep/${book}.json`).catch(() => null);
    if (!f) return;
    const shown = new Set(this.deep.stories.map((s) => s.id));
    for (const [ch, d] of Object.entries(f.chapters)) {
      this.deep.items.set(`${book}.${ch}`, visibleByStatus(d.items));
      this.deep.storiesByChapter.set(`${book}.${ch}`, d.stories.filter((id) => shown.has(id)));
    }
    this.bump();
  }

  /** Deep Made Simple for a chapter: research and links, and the stories that pass through it. */
  deepFor(chapter: ChapterRef): { items: DeepItem[]; stories: DeepStory[] } {
    const ids = this.deep.storiesByChapter.get(chapter) ?? [];
    return { items: this.deep.items.get(chapter) ?? [], stories: this.deep.stories.filter((s) => ids.includes(s.id)) };
  }

  private setPlace(p: Place) {
    const had = this.placeById.has(p.id);
    this.placeById.set(p.id, p);
    if (had) this.places = this.places.map((x) => (x.id === p.id ? p : x));
    else this.places.push(p);
  }

  private setPerson(p: Person) {
    const had = this.personById.has(p.id);
    this.personById.set(p.id, p);
    if (had) this.people = this.people.map((x) => (x.id === p.id ? p : x));
    else this.people.push(p);
  }

  // ------------------------------------------------------------------ registries
  private registry(key: string, fn: () => Promise<void>) {
    let p = this.regP.get(key);
    if (!p) {
      p = fn().then(() => this.bump());
      p.catch((e) => {
        this.regP.delete(key);
        this.errors.push(String(e));
      });
      this.regP.set(key, p);
    }
    return p;
  }

  ensurePlaces() {
    return this.registry('places', async () => {
      const f = await fetchJson<{ places: (Omit<Place, 'verses'> & { v: number[]; curated?: { note?: string; samePlace?: Place['samePlace']; alsoAppears?: VerseRef[] }; provenance?: { evidenceLevel: EvidenceLevel; source: string; editorial: Editorial } })[]; provenance: { evidenceLevel: EvidenceLevel; source: string; editorial: Editorial } }>('study/places.json');
      const list: Place[] = [];
      for (const r of f.places) {
        const verses = r.v.map(refOfOrdinal);
        const { v: _v, curated, provenance, ...rest } = r;
        const p: Place = { ...rest, ...(curated ?? {}), ...(provenance ?? f.provenance), verses };
        list.push(p);
        this.occurrences.places.set(p.id, verses);
      }
      this.places = visibleByStatus(list);
      this.placeById = new Map(this.places.map((p) => [p.id, p]));
      this.registries.places = true;
    });
  }

  ensurePeople() {
    return this.registry('people', async () => {
      const f = await fetchJson<{ people: (Omit<Person, 'verses'> & { v: number[]; provenance?: { evidenceLevel: EvidenceLevel; source: string; editorial: Editorial } })[]; provenance: { evidenceLevel: EvidenceLevel; source: string; editorial: Editorial } }>('study/people.json');
      const list: Person[] = [];
      for (const r of f.people) {
        const verses = r.v.map(refOfOrdinal);
        const { v: _v, provenance, ...rest } = r;
        const p: Person = { ...rest, ...(provenance ?? f.provenance), verses };
        list.push(p);
        this.occurrences.people.set(p.id, verses);
      }
      this.people = visibleByStatus(list);
      this.personById = new Map(this.people.map((p) => [p.id, p]));
      this.registries.people = true;
    });
  }

  ensureTimeline() {
    return this.registry('timeline', async () => {
      const f = await fetchJson<{ certaintyLabels: string[]; traditionalNote: string; items: TimelineEvent[] }>('study/timeline.json');
      this.timeline = visibleByStatus(f.items);
      this.timelineLabels = f.certaintyLabels;
      this.traditionalNote = f.traditionalNote;
      this.registries.timeline = true;
    });
  }

  ensureMap() {
    return this.registry('map', async () => {
      this.map = await fetchJson<MapBase>('study/atlas.json');
      this.registries.map = true;
    });
  }

  /** Thread passages are stored as verse ordinals and expanded on first use. */
  passagesOf(threadId: string): VerseRef[] {
    let refs = this.threadPassages.get(threadId);
    if (!refs) {
      refs = (this.threadOrdinals.get(threadId) ?? []).map(refOfOrdinal);
      this.threadPassages.set(threadId, refs);
    }
    return refs;
  }
}

// ------------------------------------------------------------------ helpers used by components
export type Edition = Library;

export function pageForVerse(pages: Page[], verse: number) {
  return pages.find((p) => verse >= p.from && verse <= p.to)?.index ?? 0;
}

/** Every chapter of the canon is in the library (the name is kept for older call sites). */
export function inEdition(ed: Library, ref: VerseRef) {
  return ed.chapterByRef.has(chapterOf(ref));
}

/** Connections touching a chapter: forward (the chapter quotes/remembers) and reverse (a later passage points here). */
export function connectionsForChapter(ed: Library, chapter: ChapterRef, maxLevel = 4) {
  const forward = ed.connections.filter((c) => chapterOf(c.anchorVerse) === chapter && c.level <= maxLevel);
  const reverse: { connection: CrossReference; targetRef: VerseRef }[] = [];
  for (const c of ed.connections) {
    if (c.level > maxLevel) continue;
    for (const t of c.targets) {
      if (chapterOf(t.ref) === chapter && chapterOf(c.anchorVerse) !== chapter) reverse.push({ connection: c, targetRef: t.ref });
    }
  }
  return { forward, reverse };
}

/** Chronological rank of a verse: traditional-chronology year of its chapter, then canonical order. */
export function chronoIndex(ed: Library, ref: VerseRef) {
  const c = ed.chapterByRef.get(chapterOf(ref));
  const year = c?.year ?? (getBook(parseRef(ref).book).testament === 'NT' ? 40 : -500);
  return (year + 5000) * 1e9 + canonicalIndex(ref);
}

let singleton: Library | null = null;
export function getLibrary(translationId?: string): Library {
  if (!singleton) singleton = new Library(translationId);
  return singleton;
}
