'use client';
import { memo, useMemo, type ReactNode } from 'react';
import type { Hit } from '@/lib/content/segment';
import { segmentVerse, type Run } from '@/lib/content/runs';
import { poetryTurn } from '@/lib/content/repository';
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
  onPerson?: (id: string) => void;
  onAramaic?: (id: string) => void;
  onVerse: (ref: VerseRef) => void;
  numberIds?: string;
  aramaic?: boolean;
  /** Words of Jesus (KJV character ranges), printed in red — a printing tradition, not the text. */
  red?: [number, number][];
  poetry?: boolean;
}

/**
 * A single verse. The text is rendered exactly as supplied by the translation; place names may be
 * wrapped in a button and supplied words set in italics, but no character is added, removed or changed.
 */
export const Verse = memo(function Verse({ verse, hits, italics, linkPlaces, dropCap, state, highlight, hasNote, reading, block, onPlace, onPerson, onAramaic, onVerse, numberIds, aramaic, red, poetry }: VerseProps) {
  const runs = useMemo(() => {
    const rs = segmentVerse(verse.text, linkPlaces ? hits : [], italics, red);
    // poetry: the verse's second half — after its first colon — on its own indented line (layout only)
    const at = poetry ? poetryTurn(verse.text) : -1;
    if (at < 0) return rs;
    const out: (Run & { brk?: boolean })[] = [];
    let n = 0;
    for (const r of rs) {
      if (at > n && at < n + r.text.length) {
        out.push({ ...r, text: r.text.slice(0, at - n) }, { ...r, text: r.text.slice(at - n), brk: true });
      } else out.push(at === n && n > 0 ? { ...r, brk: true } : r);
      n += r.text.length;
    }
    return out;
  }, [verse.text, hits, linkPlaces, italics, red, poetry]);

  let lead: string | null = null;
  let rest: Run[] = runs;
  if (dropCap && runs.length && !runs[0].placeId && !runs[0].personId && !runs[0].aramaicId && !runs[0].italic && !runs[0].red) {
    const m = /^(\S+\s+\S+)/.exec(runs[0].text);
    if (m) {
      lead = m[1];
      rest = [{ text: runs[0].text.slice(lead.length) }, ...runs.slice(1)];
    }
  }
  const cls = ['verse', state === 'linked' ? 'is-linked' : '', state === 'target' ? 'is-target' : '', highlight ? `hl-${highlight}` : '', reading ? 'is-reading' : '', block ? 'verse-block' : ''].filter(Boolean).join(' ');

  return (
    <span className={cls} data-verse={verse.verse} data-ref={verse.ref} id={`v${verse.verse}`} data-highlight={highlight} data-aramaic={aramaic ? '' : undefined}>
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
          data-testid={`verse-num-${numberIds ?? ''}${verse.verse}`}
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
        {rest.map((r, i) => [
          (r as { brk?: boolean }).brk ? <span key={i + 'b'} className="poetry-break" aria-hidden /> : null,
          r.placeId ? (
            <button
              key={i}
              type="button"
              className={`place-word${r.italic ? ' supplied' : ''}${r.red ? ' wj' : ''}`}
              data-place={r.placeId}
              onClick={(e) => {
                e.stopPropagation();
                onPlace(r.placeId!);
              }}
            >
              {r.text}
            </button>
          ) : r.aramaicId ? (
            <button
              key={i}
              type="button"
              className={`aramaic-word${r.red ? ' wj' : ''}`}
              data-aramaic-word={r.aramaicId}
              title="Aramaic — tap to learn more"
              onClick={(e) => {
                e.stopPropagation();
                onAramaic?.(r.aramaicId!);
              }}
            >
              {r.text}
            </button>
          ) : r.personId ? (
            <button
              key={i}
              type="button"
              className={`person-word${r.italic ? ' supplied' : ''}${r.red ? ' wj' : ''}`}
              data-person={r.personId}
              onClick={(e) => {
                e.stopPropagation();
                onPerson?.(r.personId!);
              }}
            >
              {r.text}
            </button>
          ) : r.italic ? (
            <em key={i} className={`supplied${r.red ? ' wj' : ''}`}>
              {r.text}
            </em>
          ) : (
            <span key={i} className={r.red ? 'wj' : undefined}>
              {r.text}
            </span>
          ),
        ])}
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
  onPerson?: (id: string) => void;
  /** A section heading (supplementary) to set above a verse. */
  headingFor?: (ref: string) => string | undefined;
  /** A quiet mark set above a verse (e.g. where an Aramaic passage begins). */
  markFor?: (ref: string) => ReactNode;
  aramaicFor?: (ref: string) => boolean;
  onAramaic?: (id: string) => void;
  onVerse?: (ref: VerseRef) => void;
  /** Prefix for verse-number test ids: chapters other than the one being read are told apart. */
  numberIds?: string;
  redFor?: (ref: string) => [number, number][] | undefined;
  /** A line of the printed text set above a verse (the Hebrew letters over Psalm 119). */
  letterFor?: (ref: string) => string | undefined;
  /** Poetry: a verse's second half (after its first colon) set on its own indented line. */
  poetry?: boolean;
}

export function ScriptureText({ verses, hitsFor, italicsFor, linkPlaces, withDropCap, linked, layout = 'paragraph', highlights = {}, notes = {}, reading, onPlace, onPerson, headingFor, markFor, aramaicFor, onAramaic, onVerse = () => {}, numberIds, redFor, letterFor, poetry }: ScriptureProps) {
  return (
    <p className={`scripture${layout === 'verse' ? ' scripture-verses' : ''}${poetry ? ' scripture-poetry' : ''}`}>
      {verses.map((v, i) => {
        const shown = headingFor?.(v.ref);
        const mark = markFor?.(v.ref);
        const letter = letterFor?.(v.ref);
        return [
          letter ? (
            <span key={v.ref + ':l'} className="psalm-letter" role="heading" aria-level={3} data-testid="psalm-letter">
              {letter}
            </span>
          ) : null,
          mark ? <span key={v.ref + ':m'} className="block">{mark}</span> : null,
          shown ? (
            <span key={v.ref + ':h'} className="section-heading" role="heading" aria-level={3} data-testid="section-heading" title="Section heading — supplementary, not Scripture">
              {shown}
            </span>
          ) : null,
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
          onPerson={onPerson}
          onAramaic={onAramaic}
          onVerse={onVerse}
          numberIds={numberIds}
          aramaic={aramaicFor?.(v.ref)}
          red={redFor?.(v.ref)}
          poetry={poetry}
        />,
        ];
      })}
    </p>
  );
}
