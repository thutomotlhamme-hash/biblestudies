'use client';
import { allBooks } from '@/lib/content/refs';
import { appBase, fetchJson } from '@/lib/library/base';
import { buildIndex, search, type SearchIndex, type SearchQuery, type SearchResult } from './engine';

/**
 * Scripture search runs off the main thread in a Web Worker, over the same per-book files the
 * reader uses (so it works offline once they are cached). If workers are unavailable it runs here.
 */
let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (r: { ok: boolean; total: number; results: SearchResult[] }) => void>();
const fallback = new Map<string, Promise<SearchIndex>>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./search.worker.ts', import.meta.url));
    worker.onmessage = (e) => {
      const cb = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      cb?.(e.data);
    };
    worker.onerror = () => {
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

export async function searchScripture(translation: string, query: SearchQuery): Promise<{ total: number; results: SearchResult[] }> {
  const books = allBooks().map((b) => ({ osis: b.osis, testament: b.testament }));
  const w = getWorker();
  if (w) {
    const id = ++seq;
    const r = await new Promise<{ ok: boolean; total: number; results: SearchResult[] }>((res) => {
      waiting.set(id, res);
      w.postMessage({ type: 'search', id, base: appBase(), translation, books, query });
    });
    if (r.ok) return r;
  }
  let p = fallback.get(translation);
  if (!p) {
    p = Promise.all(books.map((b) => fetchJson<{ chapters: string[][] }>(`text/${translation}/${b.osis}.json`).then((f) => ({ ...b, chapters: f.chapters })))).then(buildIndex);
    fallback.set(translation, p);
  }
  return search(await p, query);
}
