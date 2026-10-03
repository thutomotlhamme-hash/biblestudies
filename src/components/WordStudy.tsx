'use client';
import { useEffect, useState } from 'react';
import { formatRef, parseRef } from '@/lib/content/refs';
import type { VerseRef } from '@/lib/content/types';
import { fetchJson } from '@/lib/library/base';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

type Word = [string, string, string, string, string, string?];
interface OriginalBook {
  language: 'hebrew' | 'greek';
  source: string;
  note: string;
  words: Record<string, Word[]>;
  lexicon: Record<string, [string, string, string, string]>;
  morphology: Record<string, string>;
}

/**
 * Original-language word study (optional). Shows the Hebrew/Aramaic or Greek words of the verse with
 * transliteration, a word-level gloss, the lexical form and grammar. It is a study aid beside the
 * translation — never presented as a translation, never used to change the translation’s words.
 */
export function WordStudy({ verseRef }: { verseRef: VerseRef }) {
  const { ed } = useReader();
  const p = parseRef(verseRef);
  const [book, setBook] = useState<OriginalBook | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => {
    fetchJson<OriginalBook>(`original/${p.book}.json`).then(setBook, () => setFailed(true));
  }, [p.book]);
  const words = book?.words[`${p.chapter}.${p.from}`] ?? [];
  const rtl = book?.language === 'hebrew';
  const w = sel !== null ? words[sel] : null;
  const lex = w ? book?.lexicon[w[3]] ?? book?.lexicon[w[3].slice(0, 5)] : null;
  const verse = ed.translation.hasBook(p.book) ? ed.translation.verse(verseRef) : null;

  return (
    <Sheet label="Original language" eyebrow={book ? (rtl ? 'Hebrew · Aramaic' : 'Greek') : 'Original language'} title={formatRef(verseRef)} testId="word-study" maxHeight="88dvh">
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
          <ol dir={rtl ? 'rtl' : 'ltr'} className="flex flex-wrap gap-x-2 gap-y-3" data-testid="original-words">
            {words.map((x, i) => (
              <li key={i} dir="ltr">
                <button type="button" onClick={() => setSel(i === sel ? null : i)} aria-pressed={sel === i} className="flex min-h-[64px] flex-col items-center rounded-[3px] border hairline px-2.5 py-1.5 text-center" style={{ borderColor: sel === i ? 'var(--bronze)' : undefined, opacity: x[5] === 'not-tr' ? 0.55 : 1 }} title={x[5] === 'not-tr' ? 'Not in the Textus Receptus (the Greek text behind the KJV)' : x[5] === 'tr-only' ? 'Found in the Textus Receptus only' : undefined}>
                  <span lang={rtl ? 'he' : 'grc'} className="text-[22px] leading-tight" style={{ fontFamily: rtl ? '"SBL Hebrew","Ezra SIL","Times New Roman",serif' : '"Gentium Plus","GFS Didot","Times New Roman",serif' }}>
                    {x[0]}
                  </span>
                  <span className="supp text-[11.5px] italic text-[var(--ink-faint)]">{x[1]}</span>
                  <span className="text-[12.5px] text-[var(--ink-muted)]">{x[2]}</span>
                </button>
              </li>
            ))}
          </ol>
          {w && (
            <div className="mt-5 rounded-[2px] border hairline px-4 py-3" data-testid="word-detail">
              <p className="flex items-baseline gap-3">
                <span lang={rtl ? 'he' : 'grc'} className="text-[26px]">
                  {lex?.[0] ?? w[0]}
                </span>
                <span className="supp italic">{lex?.[1] ?? w[1]}</span>
                <span className="ml-auto font-display text-[12px] tracking-[0.08em] text-[var(--ink-faint)]">{w[3]}</span>
              </p>
              {lex?.[2] && <p className="mt-1 font-display text-[16px]">“{lex[2]}”</p>}
              <p className="mt-2 text-[13.5px] text-[var(--ink-muted)]">
                {w[4]
                  .split('/')
                  .map((c) => book.morphology[c] ?? c)
                  .join(' + ')}
              </p>
              {lex?.[3] && <p className="supp mt-2 text-[13px] leading-snug text-[var(--ink-muted)]">{lex[3]}</p>}
              {w[5] === 'not-tr' && <p className="supp mt-2 text-[12px] italic">This word is in modern critical editions but not in the Textus Receptus, the Greek text behind the KJV.</p>}
              {w[5] === 'tr-only' && <p className="supp mt-2 text-[12px] italic">This word is in the Textus Receptus but not in the NA28 critical edition.</p>}
            </div>
          )}
          <p className="supp mt-5 text-[12px] italic leading-snug text-[var(--ink-faint)]">
            {book.note} {rtl ? 'Hebrew text: Leningrad Codex tradition.' : 'Greek text: NA28/NA27 with every Textus Receptus word marked.'} Source: {book.source}
          </p>
        </>
      )}
    </Sheet>
  );
}
