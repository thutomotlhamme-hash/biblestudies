import type { Hit } from './segment';

const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/**
 * Carry name spans from the KJV text to another translation's text of the same verse. A name is
 * marked only where the translation spells it exactly as the KJV does, standing as a whole word; the
 * n-th time a name appears in the KJV verse is matched to its n-th appearance in the other text.
 * A name spelt differently is simply left unmarked. Nothing in either text is changed.
 */
export function mapHits(kjvText: string, hits: Hit[], target: string): Hit[] {
  if (kjvText === target) return hits;
  const out: Hit[] = [];
  const seen = new Map<string, number>();
  for (const h of [...hits].sort((a, b) => a.start - b.start)) {
    const name = kjvText.slice(h.start, h.end);
    if (!name) continue;
    const nth = seen.get(name) ?? 0;
    seen.set(name, nth + 1);
    let from = 0;
    let found = -1;
    for (let k = 0; k <= nth; k++) {
      let i = target.indexOf(name, from);
      while (i >= 0 && (isWord(target[i - 1]) || isWord(target[i + name.length]))) i = target.indexOf(name, i + 1);
      found = i;
      if (i < 0) break;
      from = i + name.length;
    }
    if (found >= 0 && !out.some((o) => found < o.end && found + name.length > o.start)) out.push({ ...h, start: found, end: found + name.length });
  }
  return out;
}
