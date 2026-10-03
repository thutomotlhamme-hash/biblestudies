'use client';
import { useState } from 'react';
import { LEVEL_LABEL } from '@/lib/content/editorial';
import { chapterOf, formatRef, parseRef } from '@/lib/content/refs';
import type { VerseRef } from '@/lib/content/types';
import { useRefsReady } from '@/lib/library/useLibrary';
import type { HighlightColor } from '@/lib/state/reader-state';
import { GlyphConnection, IconHeart, IconListen } from './Icons';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

const COLORS: { c: HighlightColor; label: string }[] = [
  { c: 'gold', label: 'Gold' },
  { c: 'rose', label: 'Rose' },
  { c: 'sage', label: 'Sage' },
  { c: 'sky', label: 'Sky' },
];

/** Everything the reader can do with one verse: highlight, a private note, favourite, compare, study, listen. */
export function VerseSheet({ verseRef }: { verseRef: VerseRef }) {
  const { ed, state, update, open, audio, close } = useReader();
  const ready = useRefsReady([verseRef]);
  const note = state.notes[verseRef];
  const [draft, setDraft] = useState(note?.text ?? '');
  const [copied, setCopied] = useState(false);
  const hl = state.highlights[verseRef];
  const fav = state.favourites.includes(verseRef);
  const verse = ready ? ed.translation.verse(verseRef) : null;
  const links = ed.connections.filter((c) => c.anchorVerse === verseRef || c.sourceVerses.includes(verseRef) || c.targets.some((t) => t.ref === verseRef));

  const setHighlight = (c: HighlightColor | null) =>
    update((s) => {
      const next = { ...s.highlights };
      if (c) next[verseRef] = c;
      else delete next[verseRef];
      return { highlights: next };
    });
  const saveNote = () =>
    update((s) => {
      const notes = { ...s.notes };
      const text = draft.trim();
      if (!text) delete notes[verseRef];
      else notes[verseRef] = { text, createdAt: s.notes[verseRef]?.createdAt ?? Date.now(), updatedAt: Date.now() };
      return { notes };
    });

  return (
    <Sheet label={`Verse ${formatRef(verseRef)}`} eyebrow={ed.translation.translation.abbreviation} title={formatRef(verseRef)} testId="verse-sheet" light>
      {verse && (
        <blockquote className="rounded-[2px] border hairline px-4 py-3 text-[17px] leading-[1.55]" data-ref={verseRef}>
          <span data-scripture-text>{verse.text}</span>
        </blockquote>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Highlight">
        {COLORS.map(({ c, label }) => (
          <button key={c} type="button" onClick={() => setHighlight(hl === c ? null : c)} aria-pressed={hl === c} aria-label={`Highlight ${label}`} className={`h-9 w-9 rounded-full border hairline hl-swatch hl-${c}`} style={{ outline: hl === c ? '2px solid var(--ink)' : 'none', outlineOffset: 2 }} data-testid={`highlight-${c}`} />
        ))}
        <button type="button" className="btn-quiet ml-auto" onClick={() => update((s) => ({ favourites: fav ? s.favourites.filter((r) => r !== verseRef) : [...s.favourites, verseRef] }))} aria-pressed={fav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} data-testid="toggle-favourite">
          <IconHeart filled={fav} className={fav ? 'text-[var(--crimson,#8b2d2d)]' : ''} />
        </button>
      </div>

      <label className="mt-5 block">
        <span className="label-caps text-[10px] text-[var(--ink-faint)]">Your note · private</span>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={saveNote} rows={3} className="mt-1 w-full rounded-[2px] border hairline bg-transparent p-3 font-display text-[16px] leading-snug outline-none focus:border-[var(--bronze)]" placeholder="A note in your own words" data-testid="note-input" />
      </label>
      <p className="supp text-[12px] italic text-[var(--ink-faint)]">Notes stay on this device unless you turn on sync. They are yours alone and never shown with Scripture’s words.</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn-card" onClick={() => open({ kind: 'compare', ref: verseRef })} data-testid="open-compare">
          Compare translations
        </button>
        <button type="button" className="btn-card" onClick={() => open({ kind: 'words', ref: verseRef })} data-testid="open-words">
          {parseRef(verseRef).book && ed.chapterByRef.get(chapterOf(verseRef))?.book.testament === 'NT' ? 'Greek words' : 'Hebrew words'}
        </button>
        <button type="button" className="btn-card" disabled={!audio.available} onClick={() => { audio.start(verseRef); close(); }} data-testid="listen-here">
          <IconListen width={16} height={16} /> Listen from here
        </button>
        <button
          type="button"
          className="btn-card"
          onClick={() => {
            if (!verse) return;
            void navigator.clipboard?.writeText(`${verse.text}\n— ${formatRef(verseRef)} (${ed.translation.translation.abbreviation})`).then(() => setCopied(true));
          }}
        >
          {copied ? 'Copied' : 'Copy verse'}
        </button>
      </div>

      {links.length > 0 && (
        <section className="mt-6">
          <p className="label-caps text-[10px] text-[var(--ink-faint)]">Connections at this verse</p>
          <ul className="mt-1">
            {links.slice(0, 8).map((c) => {
              const other = c.anchorVerse === verseRef || c.sourceVerses.includes(verseRef) ? c.targets[0]?.ref : c.anchorVerse;
              const reverse = !(c.anchorVerse === verseRef || c.sourceVerses.includes(verseRef));
              return (
                <li key={c.id}>
                  <button type="button" className="flex min-h-[44px] w-full items-center gap-2 text-left" onClick={() => open(reverse ? { kind: 'vellum', id: c.id, reverseTarget: verseRef } : { kind: 'vellum', id: c.id })}>
                    <GlyphConnection className="shrink-0 text-[var(--bronze)]" />
                    <span className="font-display text-[15px]">{other ? formatRef(other) : 'The prophets'}</span>
                    <span className="supp ml-auto text-[12px] italic text-[var(--ink-faint)]">
                      {LEVEL_LABEL[c.level]}
                      {c.method === 'text-match' ? ' · found by wording' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Sheet>
  );
}
