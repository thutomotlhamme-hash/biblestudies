'use client';
import { useState } from 'react';
import { chapterOf, formatRef, parseRef } from '@/lib/content/refs';
import { canonicalIndex } from '@/lib/content/refs';
import type { VerseRef } from '@/lib/content/types';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

type Tab = 'highlights' | 'notes' | 'favourites' | 'saved';

/** The reader's own marks — highlights, private notes, favourites, saved places, journeys, threads and discoveries. No counts, no streaks. */
export function MyBible({ tab: initial }: { tab?: Tab }) {
  const { ed, state, goTo, close, open, update } = useReader();
  const [tab, setTab] = useState<Tab>(initial ?? 'highlights');
  const go = (ref: VerseRef) => {
    goTo(chapterOf(ref), parseRef(ref).from);
    close();
  };
  const byCanon = (a: string, b: string) => canonicalIndex(a) - canonicalIndex(b);
  const TABS: [Tab, string][] = [
    ['highlights', 'Highlights'],
    ['notes', 'Notes'],
    ['favourites', 'Favourites'],
    ['saved', 'Saved'],
  ];
  const Row = ({ r, children }: { r: VerseRef; children?: React.ReactNode }) => (
    <li className="border-t hairline first:border-t-0">
      <button type="button" className="flex min-h-[48px] w-full flex-col items-start py-2 text-left" onClick={() => go(r)}>
        <span className="font-display text-[16px]">{formatRef(r)}</span>
        {children}
      </button>
    </li>
  );
  const empty = (t: string) => <p className="supp mt-4 text-[14px] italic text-[var(--ink-faint)]">{t}</p>;

  return (
    <Sheet label="Your Bible" eyebrow="Kept on this device" title="Your Bible" testId="my-bible" maxHeight="86dvh">
      <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto border-b hairline">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="-mb-px min-h-[44px] shrink-0 px-2.5 font-display text-[15px]" style={{ color: tab === k ? 'var(--ink)' : 'var(--ink-faint)', borderBottom: tab === k ? '1.5px solid var(--bronze)' : '1.5px solid transparent' }} data-testid={`mine-tab-${k}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'highlights' &&
        (Object.keys(state.highlights).length ? (
          <ul>
            {Object.keys(state.highlights)
              .sort(byCanon)
              .map((r) => (
                <Row key={r} r={r}>
                  <span className={`mt-1 inline-block h-2 w-10 rounded-full hl-swatch hl-${state.highlights[r]}`} aria-label={`${state.highlights[r]} highlight`} />
                </Row>
              ))}
          </ul>
        ) : (
          empty('Tap a verse number to highlight a verse.')
        ))}

      {tab === 'notes' &&
        (Object.keys(state.notes).length ? (
          <ul>
            {Object.keys(state.notes)
              .sort(byCanon)
              .map((r) => (
                <Row key={r} r={r}>
                  <span className="supp mt-0.5 line-clamp-2 text-[14px] text-[var(--ink-muted)]">{state.notes[r].text}</span>
                </Row>
              ))}
          </ul>
        ) : (
          empty('Notes you write on a verse are private and appear here.')
        ))}

      {tab === 'favourites' && (state.favourites.length ? <ul>{[...state.favourites].sort(byCanon).map((r) => <Row key={r} r={r} />)}</ul> : empty('Mark a verse with the heart to keep it here.'))}

      {tab === 'saved' && (
        <div className="space-y-5">
          {[
            ['Places', state.saved.places.map((id) => ({ id, label: ed.placeById.get(id)?.name ?? id, act: () => open({ kind: 'place', id }) }))],
            ['Journeys', state.saved.journeys.map((id) => ({ id, label: ed.journeys.find((j) => j.id === id)?.name ?? id, act: () => open({ kind: 'atlas', layer: id }) }))],
            ['Threads', state.saved.threads.map((id) => ({ id, label: ed.threads.find((t) => t.id === id)?.name ?? id, act: () => open({ kind: 'thread', id }) }))],
            ['Discoveries', state.saved.discoveries.map((id) => {
              const c = ed.connections.find((x) => x.id === id);
              return { id, label: c ? `${formatRef(c.anchorVerse)} → ${c.targets[0] ? formatRef(c.targets[0].ref) : ''}` : id, act: () => open({ kind: 'vellum', id }) };
            })],
          ].map(([title, items]) => (
            <section key={title as string}>
              <p className="label-caps text-[10px] text-[var(--ink-faint)]">{title as string}</p>
              {(items as { id: string; label: string; act: () => void }[]).length ? (
                <ul>
                  {(items as { id: string; label: string; act: () => void }[]).map((it) => (
                    <li key={it.id} className="flex items-center border-t hairline first:border-t-0">
                      <button type="button" className="min-h-[44px] flex-1 text-left font-display text-[16px]" onClick={it.act}>
                        {it.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="supp text-[13px] italic text-[var(--ink-faint)]">Nothing saved yet.</p>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2 border-t hairline pt-4">
        <button
          type="button"
          className="btn-quiet px-3 text-[13px] italic"
          onClick={() => {
            const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), highlights: state.highlights, notes: state.notes, favourites: state.favourites, saved: state.saved, bookmarks: state.bookmarks }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'my-bible-notes.json';
            a.click();
          }}
        >
          Export my notes
        </button>
        <button type="button" className="btn-quiet px-3 text-[13px] italic" onClick={() => update({ highlights: {} })}>
          Clear highlights
        </button>
      </div>
    </Sheet>
  );
}
