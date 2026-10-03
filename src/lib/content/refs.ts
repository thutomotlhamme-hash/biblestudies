import canon from '@data/canon/protestant-66.json';
import type { Book, ChapterRef, VerseRef } from './types';

/** The canon is configuration, not code: another canon is another file. */
type CanonBook = { osis: string; name: string; testament: 'OT' | 'NT'; order: number; division: string; verses: number[]; title: { pre: string; main: string; post: string }; poetry: boolean };
export const CANON = { id: canon.id, name: canon.name };
const books: Book[] = (canon.books as CanonBook[]).map((b) => ({
  osis: b.osis,
  name: b.name,
  testament: b.testament,
  order: b.order,
  division: b.division,
  verses: b.verses,
  poetry: b.poetry,
  chapterCount: b.verses.length,
  titleParts: b.title,
  title: [b.title.pre, b.title.main, b.title.post].filter(Boolean).join(' '),
}));
const byOsis = new Map<string, Book>(books.map((b) => [b.osis, b]));

/** Verse ordinal (0-based position in the canon) ⇄ reference. Supplementary files store verse lists as ordinals. */
const ordinalStart = new Map<string, number>();
const ordinalIndex: { osis: string; chapter: number; start: number; count: number }[] = [];
{
  let n = 0;
  for (const b of books) {
    b.verses!.forEach((count, i) => {
      ordinalStart.set(`${b.osis}.${i + 1}`, n);
      ordinalIndex.push({ osis: b.osis, chapter: i + 1, start: n, count });
      n += count;
    });
  }
}
export const TOTAL_VERSES = ordinalIndex.reduce((n, c) => n + c.count, 0);
export function ordinalOf(ref: VerseRef): number {
  const p = parseRef(ref);
  return (ordinalStart.get(`${p.book}.${p.chapter}`) ?? 0) + p.from - 1;
}
export function refOfOrdinal(n: number): VerseRef {
  let lo = 0;
  let hi = ordinalIndex.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ordinalIndex[mid].start <= n) lo = mid;
    else hi = mid - 1;
  }
  const c = ordinalIndex[lo];
  return `${c.osis}.${c.chapter}.${n - c.start + 1}`;
}

export function getBook(osis: string): Book {
  const b = byOsis.get(osis);
  if (!b) throw new Error(`Unknown book ${osis}`);
  return b;
}

export const allBooks = () => books;

export interface ParsedRef {
  book: string;
  chapter: number;
  from: number;
  to: number;
}

/** "Gen.46.3-4" -> { book: 'Gen', chapter: 46, from: 3, to: 4 } */
export function parseRef(ref: VerseRef): ParsedRef {
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) throw new Error(`Bad reference ${ref}`);
  const from = Number(m[3]);
  return { book: m[1], chapter: Number(m[2]), from, to: m[4] ? Number(m[4]) : from };
}

export const chapterOf = (ref: VerseRef): ChapterRef => {
  const p = parseRef(ref);
  return `${p.book}.${p.chapter}`;
};

export function parseChapter(ref: ChapterRef) {
  const [book, n] = ref.split('.');
  return { book, number: Number(n) };
}

/** Expand a range reference into single verse refs. */
export function expandRef(ref: VerseRef): VerseRef[] {
  const p = parseRef(ref);
  const out: VerseRef[] = [];
  for (let v = p.from; v <= p.to; v++) out.push(`${p.book}.${p.chapter}.${v}`);
  return out;
}

/** "Gen.46.3-4" -> "Genesis 46:3–4" */
export function formatRef(ref: VerseRef): string {
  const p = parseRef(ref);
  const name = getBook(p.book).name;
  return `${name} ${p.chapter}:${p.from}${p.to !== p.from ? `–${p.to}` : ''}`;
}

export function formatChapter(ref: ChapterRef): string {
  const { book, number } = parseChapter(ref);
  return `${getBook(book).name} ${number}`;
}

/** Format consecutive refs from the same chapter: ["Matt.2.5","Matt.2.6"] -> "Matthew 2:5–6" */
export function formatRefs(refs: VerseRef[]): string {
  if (refs.length === 1) return formatRef(refs[0]);
  const a = parseRef(refs[0]);
  const b = parseRef(refs[refs.length - 1]);
  if (a.book !== b.book || a.chapter !== b.chapter) return refs.map(formatRef).join('; ');
  return `${getBook(a.book).name} ${a.chapter}:${a.from}–${b.to}`;
}

export function testamentOf(ref: VerseRef): 'OT' | 'NT' {
  return getBook(parseRef(ref).book).testament;
}

export function canonicalIndex(ref: VerseRef): number {
  const p = parseRef(ref);
  return getBook(p.book).order * 1e6 + p.chapter * 1e3 + p.from;
}

/** Does `ref` fall inside any of the scopes (verse refs, ranges or chapter refs)? */
export function inScope(ref: VerseRef, scopes: string[] | undefined): boolean {
  if (!scopes?.length) return false;
  const p = parseRef(ref);
  return scopes.some((s) => {
    if (/^[1-3]?[A-Za-z]+\.\d+$/.test(s)) return s === `${p.book}.${p.chapter}`;
    const q = parseRef(s);
    return q.book === p.book && q.chapter === p.chapter && p.from >= q.from && p.from <= q.to;
  });
}

const EXTRA_ALIASES: Record<string, string> = {
  gn: 'Gen', ex: 'Exod', exo: 'Exod', lv: 'Lev', nm: 'Num', dt: 'Deut', jos: 'Josh', jdg: 'Judg', jg: 'Judg', rt: 'Ruth',
  '1sa': '1Sam', '2sa': '2Sam', '1ki': '1Kgs', '2ki': '2Kgs', '1kings': '1Kgs', '2kings': '2Kgs', '1ch': '1Chr', '2ch': '2Chr',
  ne: 'Neh', es: 'Esth', jb: 'Job', ps: 'Ps', psa: 'Ps', psalm: 'Ps', pss: 'Ps', pr: 'Prov', prv: 'Prov', ec: 'Eccl', qoh: 'Eccl',
  so: 'Song', sos: 'Song', song: 'Song', songofsongs: 'Song', canticles: 'Song', is: 'Isa', je: 'Jer', la: 'Lam', eze: 'Ezek', ezk: 'Ezek',
  dn: 'Dan', ho: 'Hos', jl: 'Joel', am: 'Amos', ob: 'Obad', jon: 'Jonah', jnh: 'Jonah', mi: 'Mic', na: 'Nah', hb: 'Hab', zep: 'Zeph',
  hg: 'Hag', zec: 'Zech', ml: 'Mal', mt: 'Matt', mat: 'Matt', mk: 'Mark', mr: 'Mark', mrk: 'Mark', lk: 'Luke', luk: 'Luke', jn: 'John', jhn: 'John',
  ac: 'Acts', act: 'Acts', ro: 'Rom', rm: 'Rom', '1co': '1Cor', '2co': '2Cor', ga: 'Gal', ep: 'Eph', php: 'Phil', pp: 'Phil', co: 'Col',
  '1th': '1Thess', '2th': '2Thess', '1ti': '1Tim', '2ti': '2Tim', ti: 'Titus', tit: 'Titus', phm: 'Phlm', philemon: 'Phlm', he: 'Heb',
  jas: 'Jas', jm: 'Jas', '1pe': '1Pet', '2pe': '2Pet', '1jn': '1John', '2jn': '2John', '3jn': '3John', jud: 'Jude', jude: 'Jude', re: 'Rev', rv: 'Rev',
  revelations: 'Rev', apocalypse: 'Rev',
};

/** Find a book from what a reader types: "gen", "1 sam", "Song of Solomon", "ps", "revelation". */
export function findBook(input: string): Book | null {
  const key = input.replace(/[\s.]+/g, '').toLowerCase().replace(/^(i{1,3})(?=[a-z])/, (r) => String(r.length));
  if (!key) return null;
  if (EXTRA_ALIASES[key]) return byOsis.get(EXTRA_ALIASES[key]) ?? null;
  return (
    books.find((b) => b.osis.toLowerCase() === key || b.name.replace(/\s+/g, '').toLowerCase() === key) ??
    books.find((b) => key.length >= 3 && b.name.replace(/\s+/g, '').toLowerCase().startsWith(key)) ??
    null
  );
}

/** Parse what a reader types: "gen 12", "Genesis 12:4", "1 sam 16:13", "Matthew 2", "ps 23:1-4". */
export function parseHumanRef(input: string): { book: string; chapter?: number; verse?: number; verseEnd?: number } | null {
  const m = /^\s*((?:[1-3]|i{1,3})?\s*[a-z][a-z .]*?)\.?\s*(\d+)?(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/i.exec(input);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = m[2] ? Number(m[2]) : undefined;
  if (chapter !== undefined && (chapter < 1 || chapter > (book.chapterCount ?? 999))) return null;
  const verse = m[3] ? Number(m[3]) : undefined;
  if (verse !== undefined && chapter !== undefined && (verse < 1 || verse > (book.verses?.[chapter - 1] ?? 999))) return null;
  return { book: book.osis, chapter, verse, verseEnd: m[4] ? Number(m[4]) : undefined };
}
