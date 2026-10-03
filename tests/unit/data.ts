/** Test helpers: read the published data files exactly as the app receives them. */
import { readFileSync } from 'node:fs';
import { allBooks } from '@/lib/content/refs';

export const D = 'public/data';
export const json = <T = any>(p: string): T => JSON.parse(readFileSync(`${D}/${p}`, 'utf8'));
export const BOOKS = allBooks();
export const TRANSLATIONS: { id: string; abbreviation: string }[] = json('translations.json');

const cache = new Map<string, Map<string, string>>();
/** ref -> exact verse text for a translation. */
export function text(tr = 'kjv'): Map<string, string> {
  let m = cache.get(tr);
  if (m) return m;
  m = new Map();
  for (const b of BOOKS) {
    const f = json<{ chapters: string[][] }>(`text/${tr}/${b.osis}.json`);
    f.chapters.forEach((ch, ci) => ch.forEach((t, vi) => m!.set(`${b.osis}.${ci + 1}.${vi + 1}`, t)));
  }
  cache.set(tr, m);
  return m;
}
export const fold = (s: string) => s.toLowerCase().replace(/[’'-]/g, '').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();
export const kjvHas = (ref: string, phrase: string) => fold(text().get(ref) ?? '').includes(fold(phrase));
export const studyBooks = () => BOOKS.map((b) => ({ osis: b.osis, ...json(`study/books/${b.osis}.json`) }));
