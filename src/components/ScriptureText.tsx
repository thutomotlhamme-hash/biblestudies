'use client';
import { memo, useMemo } from 'react';
import type { Hit } from '@/lib/content/segment';
import { segmentVerse, type Run } from '@/lib/content/runs';
export { segmentVerse };
import type { Verse as VerseT, VerseRef } from '@/lib/content/types';
import type { HighlightColor, Note } from '@/lib/state/reader-state';

interface VerseProps {
  verse: VerseT;
  hits: Hit[];
  italics?: [number, number][];
  linkPlaces: boolean;
  dropCap: boolean;
  state?: 'linked' | 'target';
  highlight?: HighlightColor;
  hasNote: boolean;
  reading: boolean;
  block: boolean;
  onPlace: (id: string) => void;
  onVerse: (ref: VerseRef) => void;
}

/**
 * A single verse. The text is rendered exactly as supplied by the translation; place names may be
 * wrapped in a button and supplied words set in italics, but no character is added, removed or changed.
 */
export const Verse = memo(function Verse({ verse, hits, italics, linkPlaces, dropCap, state, highlight, hasNote, reading, block, onPlace, onVerse }: VerseProps) {
  const runs = useMemo(() => segmentVerse(verse.text, linkPlaces ? hits : [], italics), [verse.text, hits, linkPlaces, italics]);

  let lead: string | null = null;
  let rest: Run[] = runs;
  if (dropCap && runs.length && !runs[0].placeId && !runs[0].italic) {
    const m = /^(\S+\s+\S+)/.exec(runs[0].text);
    if (m) {
      lead = m[1];
      rest = [{ text: runs[0].text.slice(lead.length) }, ...runs.slice(1)];
    }
  }
  const cls = ['verse', state === 'linked' ? 'is-linked' : '', state === 'target' ? 'is-target' : '', highlight ? `hl-${highlight}` : '', reading ? 'is-reading' : '', block ? 'verse-block' : ''].filter(Boolean).join(' ');

  return (
    <span className={cls} data-verse={verse.verse} data-ref={verse.ref} id={`v${verse.verse}`} data-highlight={highlight}>
      {dropCap ? (
        <button type="button" className="sr-only focus:not-sr-only" data-interactive onClick={(e) => { e.stopPropagation(); onVerse(verse.ref); }} aria-label={`Verse ${verse.verse}. Verse options`}>
          Verse {verse.verse}.{' '}
        </button>
      ) : (
        <button
          type="button"
          className="verse-num"
          data-interactive
          aria-label={`Verse ${verse.verse}. Verse options`}
          data-testid={`verse-num-${verse.verse}`}
          onClick={(e) => {
            e.stopPropagation();
            onVerse(verse.ref);
          }}
        >
          {verse.verse}
        </button>
      )}
      <span data-scripture-text>
        {lead && <span style={{ fontVariant: 'small-caps', letterSpacing: '0.04em' }}>{lead}</span>}
        {rest.map((r, i) =>
          r.placeId ? (
            <button
              key={i}
              type="button"
              className={`place-word${r.italic ? ' supplied' : ''}`}
              data-place={r.placeId}
              onClick={(e) => {
                e.stopPropagation();
                onPlace(r.placeId!);
              }}
            >
              {r.text}
            </button>
          ) : r.italic ? (
            <em key={i} className="supplied">
              {r.text}
            </em>
          ) : (
            <span key={i}>{r.text}</span>
          ),
        )}
      </span>
      {hasNote && <span className="note-mark" aria-label="You have a note on this verse" />}{' '}
    </span>
  );
});

interface ScriptureProps {
  verses: VerseT[];
  hitsFor: (ref: string) => Hit[];
  italicsFor?: (ref: string) => [number, number][] | undefined;
  linkPlaces: boolean;
  withDropCap: boolean;
  linked: Set<number>;
  layout?: 'paragraph' | 'verse';
  highlights?: Record<VerseRef, HighlightColor>;
  notes?: Record<VerseRef, Note>;
  reading?: VerseRef | null;
  onPlace: (id: string) => void;
  onVerse?: (ref: VerseRef) => void;
}

export function ScriptureText({ verses, hitsFor, italicsFor, linkPlaces, withDropCap, linked, layout = 'paragraph', highlights = {}, notes = {}, reading, onPlace, onVerse = () => {} }: ScriptureProps) {
  return (
    <p className={`scripture${layout === 'verse' ? ' scripture-verses' : ''}`}>
      {verses.map((v, i) => (
        <Verse
          key={v.ref}
          verse={v}
          hits={hitsFor(v.ref)}
          italics={italicsFor?.(v.ref)}
          linkPlaces={linkPlaces}
          dropCap={withDropCap && i === 0}
          state={linked.has(v.verse) ? 'linked' : undefined}
          highlight={highlights[v.ref]}
          hasNote={!!notes[v.ref]}
          reading={reading === v.ref}
          block={layout === 'verse'}
          onPlace={onPlace}
          onVerse={onVerse}
        />
      ))}
    </p>
  );
}
