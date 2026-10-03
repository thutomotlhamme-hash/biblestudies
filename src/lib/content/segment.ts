/**
 * Name spans in the text. Spans are character ranges produced by the content pipeline
 * (scripts/pipeline/study_entities.py) against the KJV text; they are applied by wrapping only.
 * Joining every run's text always reproduces the verse exactly (unit-tested for every verse).
 */
export type Hit = { start: number; end: number; id: string };
export type Run = { text: string; placeId?: string };

export function segmentByHits(text: string, hits: Hit[]): Run[] {
  const runs: Run[] = [];
  let cursor = 0;
  for (const h of [...hits].sort((a, b) => a.start - b.start)) {
    if (h.start < cursor) continue;
    if (h.start > cursor) runs.push({ text: text.slice(cursor, h.start) });
    runs.push({ text: text.slice(h.start, h.end), placeId: h.id });
    cursor = h.end;
  }
  if (cursor < text.length || !runs.length) runs.push({ text: text.slice(cursor) });
  return runs;
}
