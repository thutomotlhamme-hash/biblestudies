'use client';
import { useState } from 'react';
import { formatRef, parseRef } from '@/lib/content/refs';
import type { VerseRef } from '@/lib/content/types';
import { WordDetail, WordRow, languageOf, useOriginalBook } from './OriginalWords';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

/**
 * Original-language word study (optional). Shows the Hebrew/Aramaic or Greek words of the verse with
 * transliteration, a word-level gloss, the lexical form and grammar. It is a study aid beside the
 * translation — never presented as a translation, never used to change the translation’s words.
 */
export function WordStudy({ verseRef }: { verseRef: VerseRef }) {
  const { ed } = useReader();
  const p = parseRef(verseRef);
  const { data: book, failed } = useOriginalBook(p.book);
  const [sel, setSel] = useState<number | null>(null);
  const words = book?.words[`${p.chapter}.${p.from}`] ?? [];
  const w = sel !== null ? words[sel] : null;
  const verse = ed.translation.hasBook(p.book) ? ed.translation.verse(verseRef) : null;
  const langs = book ? [...new Set(words.map((x) => languageOf(x, book)))].join(' · ') : '';

  return (
    <Sheet label="Original language" eyebrow={langs || 'Original language'} title={formatRef(verseRef)} testId="word-study" maxHeight="88dvh">
      {verse && (
        <p className="mb-3 text-[16px] leading-[1.5] text-[var(--ink-muted)]" data-ref={verseRef}>
          <span className="label-caps mr-2 text-[9.5px]">{ed.translation.translation.abbreviation}</span>
          <span data-scripture-text>{verse.text}</span>
        </p>
      )}
      {failed && <p className="supp italic">The word study for this book could not be opened.</p>}
      {!book && !failed && <p className="supp italic text-[var(--ink-faint)]">Opening…</p>}
      {book && (
        <>
          <WordRow words={words} book={book} selected={sel} onSelect={setSel} testId="original-words" />
          {w && <WordDetail w={w} book={book} />}
          <p className="supp mt-5 text-[12px] italic leading-snug text-[var(--ink-faint)]">
            {book.note} {book.language === 'hebrew' ? 'Hebrew text: Leningrad Codex tradition.' : 'Greek text: NA28/NA27 with every Textus Receptus word marked.'} Source: {book.source}
          </p>
        </>
      )}
    </Sheet>
  );
}
