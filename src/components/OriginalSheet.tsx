'use client';
import { useState } from 'react';
import type { ChapterRef } from '@/lib/content/types';
import { WordDetail, WordRow, languageOf, useOriginalBook } from './OriginalWords';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

/**
 * ORIGINAL — the page being read, verse by verse, with the Hebrew, Aramaic or Greek words beneath
 * the translation and what each word means. The translation is shown exactly as it is; the
 * original-language words are a study aid beside it (STEPBible), never a new translation.
 */
export function OriginalSheet({ chapterRef, from, to }: { chapterRef: ChapterRef; from: number; to: number }) {
  const { ed } = useReader();
  const chapter = ed.chapterByRef.get(chapterRef)!;
  const { data: book, failed } = useOriginalBook(chapter.book.osis);
  const [sel, setSel] = useState<{ v: number; i: number } | null>(null);
  const verses = chapter.verses.filter((v) => v.verse >= from && v.verse <= to);
  const langs = book ? [...new Set(verses.flatMap((v) => (book.words[`${chapter.number}.${v.verse}`] ?? []).map((w) => languageOf(w, book))))] : [];

  return (
    <Sheet label="Original language" eyebrow={<span data-testid="original-eyebrow">Original language · {langs.join(' · ') || (chapter.book.testament === 'NT' ? 'Greek' : 'Hebrew')}</span>} title={`${chapter.book.name} ${chapter.number}:${from}–${to}`} testId="original-sheet" maxHeight="90dvh">
      <p className="supp text-[14px] leading-snug text-[var(--ink-muted)]">
        {chapter.book.testament === 'NT'
          ? 'The New Testament was written in Greek.'
          : 'The Old Testament was written in Hebrew, with a few passages in Aramaic (parts of Daniel and Ezra, Jeremiah 10:11, two words in Genesis 31:47).'}{' '}
        Under each verse are the words it was written in, with how each is said and what it means. Tap a word for its dictionary form and grammar.
      </p>
      {failed && <p className="supp mt-3 italic">The original-language text for this book could not be opened.</p>}
      {!book && !failed && <p className="supp mt-3 italic text-[var(--ink-faint)]">Opening…</p>}
      {book &&
        verses.map((v) => {
          const words = book.words[`${chapter.number}.${v.verse}`] ?? [];
          const w = sel?.v === v.verse ? words[sel.i] : null;
          return (
            <section key={v.ref} className="mt-5 border-t hairline pt-4" data-testid="original-verse" data-verse-ref={v.ref}>
              <p className="text-[16px] leading-[1.5]" data-ref={v.ref}>
                <sup className="verse-num">{v.verse}</sup> <span data-scripture-text>{v.text}</span>
              </p>
              <p className="label-caps mt-2 text-[9.5px] text-[var(--ink-faint)]">
                {[...new Set(words.map((x) => languageOf(x, book)))].join(' · ')} · {words.length} words
              </p>
              <div className="mt-2">
                <WordRow words={words} book={book} selected={sel?.v === v.verse ? sel.i : null} onSelect={(i) => setSel(i === null ? null : { v: v.verse, i })} />
              </div>
              {w && <WordDetail w={w} book={book} />}
            </section>
          );
        })}
      {book && (
        <p className="supp mt-6 text-[12px] italic leading-snug text-[var(--ink-faint)]">
          {book.note} The meanings are word-by-word hints, not a translation; the {ed.translation.translation.abbreviation} above is the translation. {book.language === 'hebrew' ? 'Hebrew and Aramaic text: Leningrad Codex tradition.' : 'Greek text: NA28/NA27, with every word of the Textus Receptus (the Greek behind the KJV) marked; faded words are not in it.'} Source: {book.source}
        </p>
      )}
    </Sheet>
  );
}
