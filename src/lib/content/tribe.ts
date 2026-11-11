import type { Person, VerseRef } from './types';

export interface TribeLine {
  tribe: string;
  /** From the person up to the son of Jacob, each step with the verse the dataset cites for it. */
  steps: { id: string; name: string; ref: VerseRef | null }[];
}

/**
 * Trace a person's tribe through the family links (father to father) to one of the sons of Jacob.
 * Joseph's line is counted as the tribe of Ephraim or Manasseh where the line runs through them.
 * The links come from Theographic Bible Metadata, each with the verse it cites; nothing is inferred
 * beyond them. Returns null when the line does not reach a son of Jacob.
 */
export function traceTribe(id: string, byId: Map<string, Person>): TribeLine | null {
  const name = (p: Person) => p.name.replace(/ \(.*\)/, '');
  const isSonOfJacob = (p: Person) => p.gender !== 'Female' && p.relationships.some((r) => r.type === 'father' && r.to === 'jacob');
  const steps: TribeLine['steps'] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  let ref: VerseRef | null = null;
  while (cur && !seen.has(cur.id) && steps.length < 80) {
    seen.add(cur.id);
    steps.push({ id: cur.id, name: name(cur), ref });
    if (isSonOfJacob(cur)) {
      const joseph = cur.id === 'joseph';
      const through = joseph ? steps.find((s) => /^(Ephraim|Manasseh)$/.test(s.name)) : undefined;
      if (joseph && !through) return null;
      return { tribe: through ? through.name : name(cur), steps };
    }
    if (cur.id === 'jacob') return null;
    const f = cur.relationships.find((r) => r.type === 'father' && byId.has(r.to));
    if (!f) return null;
    ref = f.ref;
    cur = byId.get(f.to);
  }
  return null;
}
