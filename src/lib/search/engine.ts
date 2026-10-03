/**
 * Scripture search engine — pure functions, run in a Web Worker (and in tests).
 *
 * Supports: words (all must appear; the last may be a word start), "exact phrases" in quotes,
 * testament and book filters. Matching folds case and punctuation only; results always show the
 * verse exactly as the translation gives it.
 */
export interface IndexedVerse {
  ref: string;
  book: string;
  testament: 'OT' | 'NT';
  text: string;
  norm: string;
}

export interface SearchIndex {
  verses: IndexedVerse[];
  words: Map<string, number[]>;
}

export interface SearchQuery {
  q: string;
  testament?: 'OT' | 'NT' | null;
  books?: string[] | null;
  limit?: number;
}

export interface SearchResult {
  ref: string;
  text: string;
  /** Character ranges to mark in `text`. */
  marks: [number, number][];
}

export const normalise = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9æ\s-]/g, ' ').replace(/-/g, '');
const tokens = (s: string) => normalise(s).split(/\s+/).filter(Boolean);

export function buildIndex(books: { osis: string; testament: 'OT' | 'NT'; chapters: string[][] }[]): SearchIndex {
  const verses: IndexedVerse[] = [];
  const words = new Map<string, number[]>();
  for (const b of books) {
    b.chapters.forEach((ch, ci) =>
      ch.forEach((text, vi) => {
        const i = verses.length;
        const norm = normalise(text);
        verses.push({ ref: `${b.osis}.${ci + 1}.${vi + 1}`, book: b.osis, testament: b.testament, text, norm: ` ${norm.replace(/\s+/g, ' ')} ` });
        for (const w of new Set(norm.split(/\s+/).filter(Boolean))) {
          const list = words.get(w);
          if (list) list.push(i);
          else words.set(w, [i]);
        }
      }),
    );
  }
  return { verses, words };
}

function parse(q: string) {
  const phrases: string[] = [];
  const rest = q.replace(/"([^"]+)"|“([^”]+)”/g, (_, a, b) => {
    phrases.push(a ?? b);
    return ' ';
  });
  return { phrases: phrases.map((p) => tokens(p)).filter((p) => p.length), words: tokens(rest) };
}

function candidates(idx: SearchIndex, word: string, prefix: boolean): Set<number> {
  if (!prefix) return new Set(idx.words.get(word) ?? []);
  const out = new Set<number>();
  for (const [w, list] of idx.words) if (w.startsWith(word)) for (const i of list) out.add(i);
  return out;
}

/** Positions of a folded phrase inside the original text (for marking), found word by word. */
function markRanges(text: string, terms: string[][]): [number, number][] {
  const toks: { w: string; s: number; e: number }[] = [];
  const re = /[A-Za-z0-9’'æÆ-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) toks.push({ w: normalise(m[0]).trim(), s: m.index, e: m.index + m[0].length });
  const out: [number, number][] = [];
  for (const t of terms) {
    for (let i = 0; i + t.length <= toks.length; i++) {
      let ok = true;
      for (let j = 0; j < t.length; j++) {
        const last = j === t.length - 1 && t.length === 1;
        if (!(toks[i + j].w === t[j] || (last && toks[i + j].w.startsWith(t[j])))) ok = false;
      }
      if (ok) out.push([toks[i].s, toks[i + t.length - 1].e]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export function search(idx: SearchIndex, query: SearchQuery): { total: number; results: SearchResult[] } {
  const { phrases, words } = parse(query.q);
  const needed = [...phrases.flat(), ...words];
  if (!needed.length) return { total: 0, results: [] };
  let set = null as Set<number> | null;
  const all = [...phrases.flat().map((w) => [w, false] as const), ...words.map((w, i) => [w, i === words.length - 1 && !phrases.length] as const)];
  for (const [w, prefix] of all) {
    const c = candidates(idx, w, prefix);
    const prev: Set<number> | null = set;
    set = prev ? new Set([...prev].filter((i: number) => c.has(i))) : c;
    if (!set.size) break;
  }
  let hits = [...(set ?? [])].sort((a, b) => a - b).map((i) => idx.verses[i]);
  if (query.testament) hits = hits.filter((v) => v.testament === query.testament);
  if (query.books?.length) hits = hits.filter((v) => query.books!.includes(v.book));
  for (const p of phrases) {
    const needle = ` ${p.join(' ')} `;
    hits = hits.filter((v) => v.norm.includes(needle));
  }
  const limit = query.limit ?? 200;
  return {
    total: hits.length,
    results: hits.slice(0, limit).map((v) => ({ ref: v.ref, text: v.text, marks: markRanges(v.text, [...phrases, ...words.map((w) => [w])]) })),
  };
}
