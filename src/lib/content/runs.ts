import type { Hit } from './segment';

export type Run = { text: string; placeId?: string; italic?: boolean };

/**
 * Split a verse into runs at place names and supplied (italic) words — WITHOUT changing a single
 * character: joining every run's text always reproduces the verse exactly (unit-tested).
 */
export function segmentVerse(text: string, hits: Hit[], italics: [number, number][] = []): Run[] {
  const cuts = new Set<number>([0, text.length]);
  for (const h of hits) {
    cuts.add(h.start);
    cuts.add(h.end);
  }
  for (const [a, b] of italics) {
    cuts.add(a);
    cuts.add(b);
  }
  const points = [...cuts].filter((n) => n >= 0 && n <= text.length).sort((x, y) => x - y);
  const runs: Run[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const hit = hits.find((h) => h.start <= a && h.end >= b);
    const it = italics.some(([x, y]) => x <= a && y >= b);
    const prev = runs[runs.length - 1];
    if (prev && prev.placeId === hit?.id && !!prev.italic === it) prev.text += text.slice(a, b);
    else runs.push({ text: text.slice(a, b), ...(hit ? { placeId: hit.id } : {}), ...(it ? { italic: true } : {}) });
  }
  return runs;
}

