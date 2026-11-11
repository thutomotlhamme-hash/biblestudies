'use client';
import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/library/base';

/** [word, transliteration, gloss, Strong's, grammar code, Textus Receptus flag?] */
export type Word = [string, string, string, string, string, string?];
export interface OriginalBook {
  language: 'hebrew' | 'greek';
  source: string;
  note: string;
  words: Record<string, Word[]>;
  lexicon: Record<string, [string, string, string, string]>;
  morphology: Record<string, string>;
}

/** Load a book's original-language layer (STEPBible) when a view needs it. */
export function useOriginalBook(book: string) {
  const [data, setData] = useState<OriginalBook | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setData(null);
    setFailed(false);
    fetchJson<OriginalBook>(`original/${book}.json`).then(setData, () => setFailed(true));
  }, [book]);
  return { data, failed };
}

/** Hebrew, Aramaic (STEPBible marks Aramaic grammar with A…) or Greek. */
export function languageOf(w: Word, book: OriginalBook): 'Hebrew' | 'Aramaic' | 'Greek' {
  if (book.language === 'greek') return 'Greek';
  return w[4].split('/').some((c) => c.startsWith('A')) ? 'Aramaic' : 'Hebrew';
}

export const fontFor = (lang: string) => (lang === 'Greek' ? '"Gentium Plus","GFS Didot","Times New Roman",serif' : '"SBL Hebrew","Ezra SIL","Times New Roman",serif');

/** The words of one verse: each with its transliteration and its word-level meaning. */
export function WordRow({ words, book, selected, onSelect, testId }: { words: Word[]; book: OriginalBook; selected: number | null; onSelect: (i: number | null) => void; testId?: string }) {
  const rtl = book.language === 'hebrew';
  return (
    <ol dir={rtl ? 'rtl' : 'ltr'} className="flex flex-wrap gap-x-2 gap-y-3" data-testid={testId}>
      {words.map((x, i) => {
        const lang = languageOf(x, book);
        return (
          <li key={i} dir="ltr">
            <button
              type="button"
              onClick={() => onSelect(i === selected ? null : i)}
              aria-pressed={selected === i}
              aria-label={`${lang} word ${x[1]}, meaning ${x[2]}`}
              className="flex min-h-[64px] flex-col items-center rounded-[3px] border hairline px-2.5 py-1.5 text-center"
              style={{ borderColor: selected === i ? 'var(--bronze)' : undefined, opacity: x[5] === 'not-tr' ? 0.55 : 1 }}
              title={x[5] === 'not-tr' ? 'Not in the Textus Receptus (the Greek text behind the KJV)' : x[5] === 'tr-only' ? 'Found in the Textus Receptus only' : lang}
              data-testid="original-word"
            >
              <span lang={lang === 'Greek' ? 'grc' : lang === 'Aramaic' ? 'arc' : 'he'} className="text-[22px] leading-tight" style={{ fontFamily: fontFor(lang) }}>
                {x[0]}
              </span>
              <span className="supp text-[11.5px] italic text-[var(--ink-faint)]">{x[1]}</span>
              <span className="text-[12.5px] text-[var(--ink-muted)]">{x[2]}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** One word in full: dictionary form, meaning, grammar and the brief lexicon entry. */
export function WordDetail({ w, book }: { w: Word; book: OriginalBook }) {
  const lex = book.lexicon[w[3]] ?? book.lexicon[w[3].slice(0, 5)];
  const lang = languageOf(w, book);
  return (
    <div className="mt-3 rounded-[2px] border hairline px-4 py-3" data-testid="word-detail">
      <p className="flex items-baseline gap-3">
        <span lang={lang === 'Greek' ? 'grc' : 'he'} className="text-[26px]" style={{ fontFamily: fontFor(lang) }}>
          {lex?.[0] ?? w[0]}
        </span>
        <span className="supp italic">{lex?.[1] ?? w[1]}</span>
        <span className="ml-auto font-display text-[12px] tracking-[0.08em] text-[var(--ink-faint)]">
          {lang} · {w[3]}
        </span>
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
  );
}
