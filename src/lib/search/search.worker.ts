/// <reference lib="webworker" />
import { buildIndex, search, type SearchIndex, type SearchQuery } from './engine';

type Msg = { type: 'search'; id: number; base: string; translation: string; books: { osis: string; testament: 'OT' | 'NT' }[]; query: SearchQuery };

const indexes = new Map<string, Promise<SearchIndex>>();

function indexFor(base: string, translation: string, books: Msg['books']) {
  let p = indexes.get(translation);
  if (!p) {
    p = Promise.all(
      books.map((b) =>
        fetch(`${base}data/text/${translation}/${b.osis}.json`)
          .then((r) => r.json())
          .then((f: { chapters: string[][] }) => ({ osis: b.osis, testament: b.testament, chapters: f.chapters })),
      ),
    ).then(buildIndex);
    p.catch(() => indexes.delete(translation));
    indexes.set(translation, p);
  }
  return p;
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const m = e.data;
  try {
    const idx = await indexFor(m.base, m.translation, m.books);
    (self as unknown as Worker).postMessage({ id: m.id, ok: true, ...search(idx, m.query) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: m.id, ok: false, error: String(err) });
  }
};
