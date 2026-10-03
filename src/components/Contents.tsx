'use client';
import { useState } from 'react';
import { allBooks, chapterOf, formatChapter, formatRef, getBook, parseHumanRef, parseRef } from '@/lib/content/refs';
import { IconClose } from './Icons';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

type Tab = 'books' | 'bookmarks' | 'recent' | 'journey';

/** Contents — the whole Bible by testament, book, chapter and verse, with the reader's own ribbons and pencil marks. */
export function Contents({ tab: initial }: { tab?: Tab }) {
  const { ed, state, goTo, close, update, chapter } = useReader();
  const [tab, setTab] = useState<Tab>(initial ?? 'books');
  const [pick, setPick] = useState<string | null>(null);
  const [book, setBook] = useState<string | null>(chapter.book.osis);
  const [jump, setJump] = useState('');
  const books = allBooks();
  const prevC = ed.chapters[chapter.index - 1];
  const nextC = ed.chapters[chapter.index + 1];
  const go = (c: string, v = 1) => {
    goTo(c, v);
    close();
  };
  const ChapterGrid = ({ osis }: { osis: string }) => {
    const b = getBook(osis);
    return (
      <div className="mt-2 rounded-[2px] border hairline p-3">
        <p className="font-display text-[17px]">{b.name}</p>
        {b.title && b.title.toUpperCase() !== b.name.toUpperCase() && <p className="supp text-[12px] italic text-[var(--ink-faint)]">{b.title}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {b.verses!.map((_, i) => {
            const ref = `${osis}.${i + 1}`;
            const isCur = ref === chapter.ref;
            const read = state.history.some((h) => h.chapter === ref);
            return (
              <button key={ref} type="button" aria-label={`${b.name} ${i + 1}`} aria-current={isCur} onClick={() => setPick(pick === ref ? null : ref)} className="h-9 min-w-9 rounded-[2px] px-1.5 font-display text-[15px] tabular-nums" style={{ background: isCur ? 'var(--ink)' : pick === ref ? 'var(--bronze)' : 'transparent', color: isCur || pick === ref ? 'var(--paper)' : 'var(--ink)', border: '1px solid var(--rule)', boxShadow: read && !isCur ? 'inset 0 -2px 0 var(--pencil)' : undefined }} data-testid={`contents-chapter-${ref}`}>
                {i + 1}
              </button>
            );
          })}
        </div>
        {pick && pick.startsWith(`${osis}.`) && (
          <div className="mt-3 border-t hairline pt-3" data-testid="contents-verses">
            <div className="flex items-center justify-between">
              <p className="font-display text-[15px]">{formatChapter(pick)} · verse</p>
              <button type="button" className="btn-quiet min-h-[32px] px-3 text-[13px] italic" onClick={() => go(pick, 1)} data-testid="contents-open-chapter">
                Open the chapter →
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {Array.from({ length: ed.chapterByRef.get(pick)!.verseCount }, (_, i) => i + 1).map((v) => (
                <button key={v} type="button" className="h-8 min-w-8 rounded-[2px] font-display text-[13px] tabular-nums hover:bg-[rgba(154,116,64,0.12)]" onClick={() => go(pick, v)} aria-label={`${formatChapter(pick)}:${v}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  const TABS: [Tab, string][] = [
    ['books', 'Books'],
    ['bookmarks', 'Ribbons'],
    ['recent', 'Recent'],
    ['journey', 'Your journey'],
  ];

  return (
    <Sheet label="Contents" eyebrow="The Holy Bible" title="Contents" testId="contents" maxHeight="86dvh">
      <div role="tablist" aria-label="Contents" className="mb-3 flex gap-1 border-b hairline">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="-mb-px min-h-[44px] px-2.5 font-display text-[15px]" style={{ color: tab === k ? 'var(--ink)' : 'var(--ink-faint)', borderBottom: tab === k ? '1.5px solid var(--bronze)' : '1.5px solid transparent' }} data-testid={`contents-tab-${k}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'books' && (
        <div data-testid="contents-books">
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const r = parseHumanRef(jump);
              if (r) go(`${r.book}.${r.chapter ?? 1}`, r.verse ?? 1);
            }}
          >
            <input value={jump} onChange={(e) => setJump(e.target.value)} placeholder="Go to… John 3:16" aria-label="Go to a reference" className="min-h-[42px] flex-1 rounded-[2px] border hairline bg-transparent px-3 font-display text-[16px] outline-none focus:border-[var(--bronze)]" data-testid="contents-jump" />
            <button type="submit" className="btn-quiet border hairline px-3 font-display text-[14px]" disabled={!parseHumanRef(jump)}>
              Go
            </button>
          </form>
          <div className="mb-4 flex items-center justify-between gap-2">
            <button type="button" className="btn-quiet -ml-2 px-2 text-[13.5px] italic" disabled={!prevC} onClick={() => prevC && go(prevC.ref)} data-testid="contents-prev">
              ← {prevC ? formatChapter(prevC.ref) : ''}
            </button>
            <button type="button" className="btn-quiet -mr-2 px-2 text-[13.5px] italic" disabled={!nextC} onClick={() => nextC && go(nextC.ref)} data-testid="contents-next">
              {nextC ? formatChapter(nextC.ref) : ''} →
            </button>
          </div>
          {(['OT', 'NT'] as const).map((t) => (
            <section key={t} className="mb-5">
              <h3 className="label-caps text-[10px] text-[var(--bronze-deep)]">{t === 'OT' ? 'The Old Testament' : 'The New Testament'}</h3>
              {[...new Set(books.filter((b) => b.testament === t).map((b) => b.division))].map((d) => (
                <div key={d} className="mt-2">
                  <p className="supp text-[11.5px] italic text-[var(--ink-faint)]">{d}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {books
                      .filter((b) => b.testament === t && b.division === d)
                      .map((b) => (
                        <button key={b.osis} type="button" aria-expanded={book === b.osis} onClick={() => { setBook(book === b.osis ? null : b.osis); setPick(null); }} className="min-h-[36px] rounded-[2px] border hairline px-2.5 font-display text-[15px]" style={{ background: book === b.osis ? 'var(--ink)' : b.osis === chapter.book.osis ? 'color-mix(in srgb, var(--bronze) 14%, transparent)' : 'transparent', color: book === b.osis ? 'var(--paper)' : 'var(--ink)' }} data-testid={`contents-book-${b.osis}`}>
                          {b.name}
                        </button>
                      ))}
                  </div>
                  {books.some((b) => b.osis === book && b.testament === t && b.division === d) && <ChapterGrid osis={book!} />}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {tab === 'bookmarks' && (
        <ul data-testid="contents-bookmarks">
          {state.bookmarks.length === 0 && <li className="supp py-4 text-[14px] italic">No ribbons yet. Use the ribbon in the reading tools to mark a page.</li>}
          {state.bookmarks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 border-t hairline py-2 first:border-t-0">
              <button type="button" className="flex min-h-[40px] flex-1 items-center gap-3 text-left" onClick={() => go(b.chapter, b.verse)} data-testid="bookmark-item">
                <span className="ribbon block h-[26px] w-[8px]" style={{ background: b.color === 'crimson' ? undefined : `var(--ribbon-${b.color})` }} aria-hidden />
                <span className="font-display text-[16px]">{formatRef(`${b.chapter}.${b.verse}`)}</span>
                <span className="supp text-[12px]">{new Date(b.createdAt).toLocaleDateString()}</span>
              </button>
              <button type="button" className="btn-quiet" aria-label={`Remove the ribbon at ${formatRef(`${b.chapter}.${b.verse}`)}`} onClick={() => update((s) => ({ bookmarks: s.bookmarks.filter((x) => x.id !== b.id) }))}>
                <IconClose width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'recent' && (
        <ul data-testid="contents-recent">
          {state.history.map((h) => (
            <li key={h.chapter} className="border-t hairline first:border-t-0">
              <button type="button" className="flex min-h-[44px] w-full items-center justify-between text-left" onClick={() => go(h.chapter, h.verse)}>
                <span className="font-display text-[16px]">{formatChapter(h.chapter)}</span>
                <span className="supp text-[12px]">{new Date(h.at).toLocaleDateString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'journey' && (
        <ol data-testid="contents-journey" aria-label="Your journey so far">
          {state.journeyHistory.length === 0 && <li className="supp py-4 text-[14px] italic">Places you read about will be pencilled in here, in the order you meet them.</li>}
          {state.journeyHistory.map((h, i) => (
            <li key={h.placeId}>
              {i > 0 && <p aria-hidden className="pl-2 text-[12px] leading-none text-[var(--pencil)]">↓</p>}
              <button type="button" className="flex min-h-[38px] w-full items-baseline justify-between text-left" onClick={() => go(chapterOf(h.ref), parseRef(h.ref).from)}>
                <span className="font-display text-[17px] italic" style={{ color: 'var(--pencil)' }}>
                  {ed.placeById.get(h.placeId)?.name}
                </span>
                <span className="supp text-[12px]">{formatRef(h.ref)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}
