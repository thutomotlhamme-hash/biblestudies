'use client';
import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { chapterOf, formatRef, parseRef } from '@/lib/content/refs';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

/**
 * ARAMAIC IN SCRIPTURE — where the Bible was written in Aramaic, and the Aramaic words the Gospels
 * keep. Built only from STEPBible's data (grammar codes and lexicon); every quotation is the KJV's
 * exact words; where a verse itself names the language, that is shown beside the lexicon's view.
 * Supplementary — not Scripture.
 */
export function AramaicSheet({ focus }: { focus?: string }) {
  const { ed, goTo, close, open, reduced } = useReader();
  const data = ed.aramaic;
  const focused = useRef<HTMLElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => focused.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }), 350);
    return () => window.clearTimeout(t);
  }, [focus, reduced]);
  const read = (ref: string) => {
    goTo(chapterOf(ref), parseRef(ref).from, { keepReturn: true });
    close();
  };
  const appear = (i: number) => (reduced ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 + i * 0.05, duration: 0.42, ease: [0.2, 0, 0, 1] as const } });

  return (
    <Sheet label="Aramaic in Scripture" eyebrow={<span style={{ color: 'var(--aramaic)' }}>Aramaic · Supplementary — not Scripture</span>} title="Aramaic in Scripture" testId="aramaic-sheet" maxHeight="92dvh">
      {!data && <p className="supp italic text-[var(--ink-faint)]">Opening…</p>}
      {data && (
        <>
          {data.name && (
            <motion.section {...appear(0)} className="relative overflow-hidden rounded-[3px] border px-5 py-5 text-center" style={{ borderColor: 'color-mix(in srgb, var(--aramaic) 35%, transparent)', background: 'var(--aramaic-wash)' }} data-testid="aramaic-name">
              <p lang="arc" className="text-[52px] leading-none" style={{ color: 'var(--aramaic)', fontFamily: '"SBL Hebrew","Ezra SIL","Times New Roman",serif' }}>
                {data.name.word}
              </p>
              <p className="supp mt-2 text-[14px] italic text-[var(--ink-muted)]">
                {data.name.translit.replace(/\./g, '')} · ‘{data.name.gloss}’
              </p>
              <p className="mt-3 text-[15.5px] leading-snug" data-ref-quote={data.name.kjv.ref}>
                <span className="label-caps mr-2 text-[9px] text-[var(--ink-faint)]">KJV</span>“<span data-quote-text>{data.name.kjv.text}</span>”
                <button type="button" className="ml-1 text-[13px] italic underline decoration-dotted" onClick={() => read(data.name!.kjv.ref)}>
                  {formatRef(data.name.kjv.ref)}
                </button>
              </p>
              <p className="supp mt-2 text-[12.5px] leading-snug text-[var(--ink-muted)]">The word the KJV gives as “Syriack” is {data.name.word}, ‘{data.name.gloss}’, in the Hebrew of {formatRef(data.name.ref)} (STEPBible). From there to Daniel 7:28 the book is written in Aramaic.</p>
            </motion.section>
          )}

          <section className="mt-6">
            <p className="label-caps text-[10px] text-[var(--ink-faint)]">Written in Aramaic</p>
            <ul className="mt-2 flex flex-col gap-2.5">
              {data.passages.map((p, i) => {
                const pct = Math.max(2, Math.round((p.verses / p.bookVerses) * 100));
                return (
                  <motion.li key={p.from} {...appear(i + 1)} className="rounded-[3px] border hairline px-4 py-3" data-testid="aramaic-passage">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-display text-[17px]">{p.from === p.to ? formatRef(p.from) : `${formatRef(p.from)} – ${formatRef(p.to).replace(/^.* (?=\d+:)/, '')}`}</p>
                      <p className="supp shrink-0 text-[12.5px] italic text-[var(--ink-faint)]">
                        {p.verses} {p.verses === 1 ? 'verse' : 'verses'}
                      </p>
                    </div>
                    <div className="mt-2 h-[5px] overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--aramaic) 12%, transparent)' }} aria-hidden>
                      <motion.div className="h-full rounded-full" style={{ background: 'var(--aramaic)' }} initial={reduced ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3 + i * 0.08, duration: 0.8, ease: [0.2, 0, 0, 1] }} />
                    </div>
                    <p className="supp mt-1 text-[12px] text-[var(--ink-faint)]">
                      {p.verses} of the book’s {p.bookVerses.toLocaleString()} verses
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4">
                      <button type="button" className="btn-quiet -ml-2 min-h-[36px] px-2 text-[13px] italic" onClick={() => read(p.from)}>
                        Read it →
                      </button>
                      <button type="button" className="btn-quiet min-h-[36px] px-2 text-[13px] italic" style={{ color: 'var(--aramaic)' }} onClick={() => open({ kind: 'original', chapter: chapterOf(p.from), from: parseRef(p.from).from, to: parseRef(p.from).from + 3 })}>
                        See the Aramaic words
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </section>

          <section className="mt-7">
            <p className="label-caps text-[10px] text-[var(--ink-faint)]">Aramaic words in the New Testament</p>
            <p className="supp mt-1 text-[13px] leading-snug text-[var(--ink-muted)]">The Gospels were written in Greek, but at times they keep a word as it was spoken, and often give its meaning straight after.</p>
            <ul className="mt-3 flex flex-col gap-3">
              {data.words.map((w, i) => {
                const isFocus = w.id === focus;
                return (
                  <motion.li
                    key={w.id}
                    {...appear(i + 2)}
                    ref={isFocus ? (el: HTMLLIElement | null) => void (focused.current = el) : undefined}
                    className="rounded-[3px] border px-4 py-3"
                    style={{ borderColor: isFocus ? 'var(--aramaic)' : 'var(--rule)', boxShadow: isFocus ? '0 0 0 3px color-mix(in srgb, var(--aramaic) 18%, transparent)' : undefined }}
                    data-testid={`aramaic-word-${w.id}`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-[22px] font-medium">{w.kjv}</span>
                      <span lang="grc" className="text-[19px] text-[var(--ink-muted)]" style={{ fontFamily: '"Gentium Plus","GFS Didot","Times New Roman",serif' }}>
                        {w.greek}
                      </span>
                      <span className="supp ml-auto text-[13.5px] italic" style={{ color: 'var(--aramaic)' }}>
                        ‘{w.gloss}’
                      </span>
                    </div>
                    <ul className="mt-1.5">
                      {w.places.map((p) => (
                        <li key={p.ref} className="border-t hairline py-1.5 first:border-t-0">
                          <button type="button" className="font-display text-[14px] underline decoration-dotted" onClick={() => read(p.ref)}>
                            {formatRef(p.ref)}
                          </button>
                          {p.meaning && (
                            <span className="ml-2 text-[14.5px]" data-ref-quote={p.meaning.ref}>
                              <span className="label-caps mr-1.5 text-[8.5px] text-[var(--ink-faint)]">KJV</span>“<span data-quote-text>{p.meaning.text}</span>”
                            </span>
                          )}
                          {p.saysHebrew && <span className="supp ml-2 text-[12px] italic text-[var(--ink-faint)]">— the verse itself calls it Hebrew</span>}
                        </li>
                      ))}
                    </ul>
                    <p className="supp mt-1.5 text-[12px] italic leading-snug text-[var(--ink-faint)]">STEPBible lexicon: {w.lexicon}</p>
                  </motion.li>
                );
              })}
            </ul>
          </section>

          <p className="supp mt-6 text-[12px] italic leading-snug text-[var(--ink-faint)]">
            {data.note} Source: {data.source}.
          </p>
        </>
      )}
    </Sheet>
  );
}
