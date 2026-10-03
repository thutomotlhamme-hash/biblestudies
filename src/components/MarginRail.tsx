'use client';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { canonicalIndex, chapterOf, formatRef, parseRef } from '@/lib/content/refs';
import { connectionsForChapter, type Edition } from '@/lib/content/repository';
import type { Chapter } from '@/lib/content/types';
import type { ReaderState } from '@/lib/state/reader-state';
import { GlyphConnection, GlyphDiscovery, GlyphMemory, GlyphThread } from './Icons';
import { useReader, type Overlay } from './ReaderContext';

export type MarginItem = {
  key: string;
  kind: 'connection' | 'reverse' | 'phrase' | 'memory' | 'thread';
  verse: number;
  label: string;
  aria: string;
  overlay: Overlay;
  testId: string;
  strong?: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  FULFILLED: 'Fulfilled',
  QUOTED: 'Quoted',
  AS_WRITTEN: 'As written',
  REMEMBERED: 'Remembered',
  REPEATED_PHRASE: 'Repeated phrase',
  SAME_PLACE: 'Same place',
  SAME_EVENT: 'Same event',
  PARALLEL: 'Shared wording',
  GENEALOGY: 'Genealogy',
  NAME: 'Name',
  TIME: 'Time',
  PLACE: 'Place',
};
export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t;

/**
 * Builds the margin apparatus for a chapter from structured metadata and the reader's own
 * memory — never hard-coded in UI. Memory notes are rationed: one per verse, each thing once per chapter.
 */
export function buildMarginItems(ed: Edition, chapter: Chapter, state: ReaderState): MarginItem[] {
  const items: MarginItem[] = [];
  const set = state.settings;
  const { forward: fwd, reverse: rev } = connectionsForChapter(ed, chapter.ref, set.family ? Math.min(2, set.maxLevel) as 2 : set.maxLevel);
  const allowed = (c: { method?: string }) => set.machineLinks && !set.family ? true : c.method !== 'text-match';
  const forward = fwd.filter(allowed);
  const reverse = rev.filter((r) => allowed(r.connection));
  // keep the margin quiet: at most two connection marks per verse, strongest evidence first
  const perVerse = new Map<number, number>();
  const room = (v: number) => {
    const n = perVerse.get(v) ?? 0;
    perVerse.set(v, n + 1);
    return n < 2;
  };
  forward.sort((a, b) => a.level - b.level);
  for (const c of forward) {
    if (!room(parseRef(c.anchorVerse).from)) continue;
    const v = parseRef(c.anchorVerse).from;
    const first = c.targets[0];
    const label = c.prophet?.name && first ? `${c.prophet.name} · ${formatRef(first.ref).replace(/^.* (?=\d+:)/, '')}` : first ? formatRef(first.ref) : c.prophet ? 'The prophets' : '';
    items.push({
      key: `c:${c.id}`,
      kind: 'connection',
      verse: v,
      label,
      strong: true,
      testId: `margin-connection-${c.id}`,
      overlay: { kind: 'vellum', id: c.id },
      aria: `${c.types.map(typeLabel).join(', ')}${c.prophet ? `, spoken by ${c.prophet.name ? `the prophet ${c.prophet.name}` : 'the prophets'}` : ''}: ${c.targets.length ? c.targets.map((t) => formatRef(t.ref)).join(' and ') : 'no passage named'}. Opens the other Scripture on vellum.`,
    });
  }
  const seenReverse = new Set<string>();
  for (const { connection: c, targetRef } of reverse) {
    const v = parseRef(targetRef).from;
    if (seenReverse.has(`${c.id}:${v}`) || !room(v)) continue;
    seenReverse.add(`${c.id}:${v}`);
    const later = canonicalIndex(c.anchorVerse) > canonicalIndex(targetRef);
    items.push({
      key: `r:${c.id}:${v}`,
      kind: 'reverse',
      verse: v,
      label: `${later ? 'Later' : 'Also'} · ${formatRef(c.anchorVerse)}`,
      strong: c.level <= 2,
      testId: `margin-reverse-${c.id}`,
      overlay: { kind: 'vellum', id: c.id, reverseTarget: targetRef },
      aria: `${typeLabel(c.types[0])}: ${formatRef(c.anchorVerse)} points back to this verse. Opens it on vellum.`,
    });
  }

  if (state.settings.memoryNotes) {
    const used = new Set<string>();
    const otherChapter = (refs: string[]) => refs.some((r) => chapterOf(r) !== chapter.ref);
    for (const v of chapter.verses) {
      const e = ed.entities.get(v.ref);
      if (!e) continue;
      let placed = false;
      for (const h of e.places) {
        const enc = state.places[h.id];
        if (placed || used.has(`p:${h.id}`) || !enc || !otherChapter(enc.refs)) continue;
        const place = ed.placeById.get(h.id);
        if (!place) continue;
        items.push({ key: `m:p:${h.id}`, kind: 'memory', verse: v.verse, label: `Been here before · ${place.name}`, testId: `margin-memory-place-${h.id}`, overlay: { kind: 'place', id: h.id }, aria: `You have been here before: ${place.name}. First met at ${formatRef(enc.first)}.` });
        used.add(`p:${h.id}`);
        placed = true;
      }
      for (const id of e.people) {
        const enc = state.people[id];
        if (placed || used.has(`q:${id}`) || !enc || !otherChapter(enc.refs)) continue;
        const person = ed.personById.get(id);
        if (!person) continue;
        items.push({ key: `m:q:${id}`, kind: 'memory', verse: v.verse, label: `Met before · ${person.name.replace(/ \(.*\)/, '')}`, testId: `margin-memory-person-${id}`, overlay: { kind: 'person', id }, aria: `You have met ${person.name} before, at ${formatRef(enc.first)}.` });
        used.add(`q:${id}`);
        placed = true;
      }
      for (const id of e.phrases) {
        if (used.has(`f:${id}`)) continue;
        const enc = state.phrases[id];
        const ph = ed.phrases.find((p) => p.id === id);
        if (!ph) continue;
        const others = (ed.occurrences.phrases.get(id) ?? []).filter((r) => r !== v.ref);
        if (!others.length) continue;
        const seen = enc && otherChapter(enc.refs);
        if (seen && !placed) {
          items.push({ key: `m:f:${id}`, kind: 'memory', verse: v.verse, label: `Seen before · “${ph.phrase}”`, testId: `margin-memory-phrase-${id}`, overlay: { kind: 'phrase', id }, aria: `You have seen the words “${ph.phrase}” before.` });
          placed = true;
        } else if (!seen && state.settings.discoveries && others.some((r) => chapterOf(r) !== chapter.ref)) {
          items.push({ key: `f:${id}`, kind: 'phrase', verse: v.verse, label: typeLabel(ph.type), testId: `margin-phrase-${id}`, overlay: { kind: 'phrase', id }, aria: `${typeLabel(ph.type)}: “${ph.phrase}” appears elsewhere in Scripture.` });
        }
        used.add(`f:${id}`);
      }
    }
  }

  if (state.followThread) {
    const t = ed.threads.find((x) => x.id === state.followThread);
    for (const r of ed.passagesOf(state.followThread)) {
      if (chapterOf(r) !== chapter.ref || !t) continue;
      items.push({ key: `t:${r}`, kind: 'thread', verse: parseRef(r).from, label: `Thread · ${t.name}`, testId: `margin-thread-${t.id}`, overlay: { kind: 'thread', id: t.id, ref: r }, aria: `Thread: ${t.name}. Follow this word through Scripture.` });
    }
  }
  const order = { connection: 0, reverse: 1, memory: 2, phrase: 3, thread: 4 };
  return items.sort((a, b) => a.verse - b.verse || order[a.kind] - order[b.kind]);
}

interface Props {
  items: MarginItem[];
  textRef: RefObject<HTMLDivElement | null>;
  measureKey: string;
  wide: boolean;
}

/** Positions margin marks beside the first line of the verse they belong to. */
export function MarginRail({ items, textRef, measureKey, wide }: Props) {
  const { open, overlay, play } = useReader();
  const [tops, setTops] = useState<Record<string, number>>({});
  const railRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = textRef.current;
    if (!container) return;
    const measure = () => {
      const base = (railRef.current ?? container).getBoundingClientRect().top;
      const next: Record<string, number> = {};
      let lastBottom = -Infinity;
      const STEP = wide ? 30 : 34;
      items.forEach((it) => {
        const el = container.querySelector<HTMLElement>(`[data-verse="${it.verse}"]`);
        const rect = el?.getClientRects()[0];
        if (!rect) return;
        let top = rect.top - base + rect.height / 2 - 17;
        if (top < lastBottom) top = lastBottom;
        next[it.key] = top;
        lastBottom = top + STEP;
      });
      setTops(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [items, textRef, measureKey, wide]);

  const isActive = (it: MarginItem) => JSON.stringify(overlay) === JSON.stringify(it.overlay);

  return (
    <div ref={railRef} className="absolute inset-y-0 right-0" style={{ width: wide ? 132 : 36 }} aria-label="Margin notes" role="group">
      {items.map((it) => {
        const top = tops[it.key];
        if (top === undefined) return null;
        const Glyph = it.kind === 'connection' || it.kind === 'reverse' ? GlyphConnection : it.kind === 'thread' ? GlyphThread : it.kind === 'memory' ? GlyphMemory : GlyphDiscovery;
        const bronze = it.kind === 'connection' || it.kind === 'reverse';
        return (
          <button
            key={it.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              play('tap');
              open(it.overlay);
            }}
            aria-label={it.aria}
            data-testid={it.testId}
            data-verse={it.verse}
            className="group absolute left-0 flex h-[34px] items-center gap-2 pl-[10px] text-left transition-opacity duration-300"
            style={{
              top,
              width: wide ? 132 : 36,
              color: bronze ? 'var(--bronze)' : it.kind === 'memory' ? 'var(--pencil)' : 'var(--ink-faint)',
              opacity: isActive(it) ? 1 : it.strong ? 0.95 : it.kind === 'reverse' ? 0.8 : 0.75,
            }}
          >
            <Glyph className="shrink-0 transition-transform duration-300 group-hover:scale-110" />
            {wide && (
              <span
                className="truncate font-display text-[11.5px] leading-tight"
                style={{
                  color: bronze ? 'var(--bronze-deep)' : it.kind === 'memory' ? 'var(--pencil)' : 'var(--ink-faint)',
                  fontStyle: it.kind === 'connection' ? 'normal' : 'italic',
                }}
              >
                {it.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
