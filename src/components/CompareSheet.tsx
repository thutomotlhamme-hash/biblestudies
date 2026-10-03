'use client';
import { useEffect, useState } from 'react';
import { chapterOf, formatChapter, formatRef, parseRef } from '@/lib/content/refs';
import { getTranslation, TRANSLATIONS } from '@/lib/content/translation';
import type { Verse, VerseRef } from '@/lib/content/types';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

/**
 * Compare translations. Each text is shown exactly as its translation gives it, under its own name.
 * Nothing is merged, harmonised or synthesised.
 */
export function CompareSheet({ verseRef }: { verseRef: VerseRef }) {
  const { state, updateSettings } = useReader();
  const [mode, setMode] = useState<'verse' | 'chapter'>('verse');
  const [pair, setPair] = useState<[string, string]>([state.settings.translation, TRANSLATIONS.find((t) => t.id !== state.settings.translation)!.id]);
  const [texts, setTexts] = useState<Record<string, Verse[]>>({});
  const p = parseRef(verseRef);

  useEffect(() => {
    let live = true;
    Promise.all(
      TRANSLATIONS.map(async (t) => {
        const a = getTranslation(t.id);
        const verses = await a.getChapter(p.book, p.chapter);
        return [t.id, verses] as const;
      }),
    )
      .then((all) => live && setTexts(Object.fromEntries(all)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [p.book, p.chapter]);

  return (
    <Sheet label="Compare translations" eyebrow="Compare" title={mode === 'verse' ? formatRef(verseRef) : formatChapter(chapterOf(verseRef))} testId="compare-sheet" maxHeight="88dvh">
      <div role="tablist" className="mb-3 flex gap-1 border-b hairline">
        {(['verse', 'chapter'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className="-mb-px min-h-[44px] px-3 font-display text-[15px]" style={{ color: mode === m ? 'var(--ink)' : 'var(--ink-faint)', borderBottom: mode === m ? '1.5px solid var(--bronze)' : '1.5px solid transparent' }}>
            {m === 'verse' ? 'This verse' : 'Side by side'}
          </button>
        ))}
      </div>

      {mode === 'verse' ? (
        <ul data-testid="compare-verse">
          {TRANSLATIONS.map((t) => {
            const v = texts[t.id]?.find((x) => x.verse === p.from);
            return (
              <li key={t.id} className="border-t hairline py-3 first:border-t-0" data-translation={t.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-[14px] font-semibold tracking-[0.06em]">{t.abbreviation}</p>
                  <p className="supp text-[12px] italic text-[var(--ink-faint)]">
                    {t.name}, {t.year}
                  </p>
                </div>
                <p className="mt-1 text-[17px] leading-[1.5]" data-ref={verseRef}>
                  {v ? <span data-scripture-text>{v.text}</span> : texts[t.id] ? <span className="supp italic text-[var(--ink-faint)]">Not in this translation.</span> : <span className="supp italic text-[var(--ink-faint)]">Opening…</span>}
                </p>
                {t.id !== state.settings.translation && (
                  <button type="button" className="btn-quiet -ml-2 min-h-[34px] px-2 text-[12.5px] italic" onClick={() => updateSettings({ translation: t.id })}>
                    Read in the {t.abbreviation}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div data-testid="compare-chapter">
          <div className="mb-2 grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <select key={i} value={pair[i]} onChange={(e) => setPair((pp) => (i === 0 ? [e.target.value, pp[1]] : [pp[0], e.target.value]))} className="min-h-[40px] rounded-[2px] border hairline bg-transparent px-2 font-display text-[14px]" aria-label={i === 0 ? 'Left translation' : 'Right translation'}>
                {TRANSLATIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.abbreviation} — {t.name}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <div className="space-y-2">
            {(texts[pair[0]] ?? []).map((v) => {
              const w = texts[pair[1]]?.find((x) => x.verse === v.verse);
              return (
                <div key={v.ref} className={`grid grid-cols-2 gap-3 rounded-[2px] px-1 py-1 text-[15px] leading-[1.45] ${v.verse === p.from ? 'bg-[color-mix(in_srgb,var(--bronze)_10%,transparent)]' : ''}`}>
                  <p data-ref={v.ref}>
                    <sup className="verse-num">{v.verse}</sup>
                    <span data-scripture-text>{v.text}</span>
                  </p>
                  <p data-ref={v.ref}>
                    <sup className="verse-num">{v.verse}</sup>
                    {w ? <span data-scripture-text>{w.text}</span> : <span className="supp italic text-[var(--ink-faint)]">—</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="supp mt-5 text-[12px] italic text-[var(--ink-faint)]">Each translation is shown as published. Verse numbering follows the KJV.</p>
    </Sheet>
  );
}
