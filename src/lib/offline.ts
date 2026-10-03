'use client';
import { allBooks } from '@/lib/content/refs';
import { dataUrl } from '@/lib/library/base';

export interface OfflineProgress {
  loaded: number;
  total: number;
  done: boolean;
  failed: number;
}

/**
 * Keep the whole Bible on the device: the chosen translation's text and the study layer, book by
 * book. The service worker stores every data file it serves, so fetching is enough.
 */
export async function downloadForOffline(translation: string, onProgress: (p: OfflineProgress) => void) {
  const files = [
    ...allBooks().flatMap((b) => [`text/${translation}/${b.osis}.json`, `study/books/${b.osis}.json`]),
    'study/places.json',
    'study/people.json',
    'study/timeline.json',
    'study/atlas.json',
    'study/threads.json',
    'study/journeys.json',
    'study/phrases.json',
    'study/genealogies.json',
    'study/scale.json',
    'study/chronology.json',
  ];
  const p: OfflineProgress = { loaded: 0, total: files.length, done: false, failed: 0 };
  onProgress({ ...p });
  const queue = [...files];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      try {
        const r = await fetch(dataUrl(f), { cache: 'reload' });
        if (!r.ok) throw new Error(String(r.status));
        await r.arrayBuffer();
        p.loaded++;
      } catch {
        p.failed++;
      }
      onProgress({ ...p });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  p.done = true;
  onProgress({ ...p });
}
