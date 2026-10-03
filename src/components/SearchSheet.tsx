'use client';
import { useEffect, useMemo, useState } from 'react';
import { allBooks, chapterOf, formatRef, parseHumanRef, parseRef } from '@/lib/content/refs';
import { useRegistry } from '@/lib/library/useLibrary';
import { searchScripture } from '@/lib/search/client';
import type { SearchResult } from '@/lib/search/engine';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

function Marked({ text, marks }: { text: string; marks: [number, number][] }) {
  const out: React.ReactNode[] = [];
  let c = 0;
  marks.forEach(([a, b], i) => {
    if (a < c) return;
    if (a > c) out.push(<span key={`t${i}`}>{text.slice(c, a)}</span>);
    out.push(
      <mark key={`m${i}`} className="search-mark">
        {text.slice(a, b)}
      </mark>,
    );
    c = b;
  });
  if (c < text.length) out.push(<span key="end">{text.slice(c)}</span>);
  return <span data-scripture-text>{out}</span>;
}

/**
 * Universal search. Scripture results and supplementary results are kept apart: Scripture first,
 * exactly as the translation gives it; places, people, threads, journeys and events after, marked as notes.
 */
export function SearchSheet({ q: initial }: { q?: string }) {
  const { ed, goTo, close, open, state } = useReader();
  useRegistry('places');
  useRegistry('people');
  useRegistry('timeline');
  const [q, setQ] = useState(initial ?? '');
  const [testament, setTestament] = useState<'OT' | 'NT' | null>(null);
  const [book, setBook] = useState<string>('');
  const [scripture, setScripture] = useState<{ total: number; results: SearchResult[]; q: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(60);
  const query = q.trim();
  const lower = query.toLowerCase().replace(/["“”]/g, '');

  useEffect(() => {
    if (query.length < 2 || parseHumanRef(query)?.chapter) {
      setScripture(null);
      return;
    }
    setBusy(true);
    const t = window.setTimeout(() => {
      searchScripture(state.settings.translation, { q: query, testament, books: book ? [book] : null, limit })
        .then((r) => setScripture({ ...r, q: query }))
        .catch(() => setScripture({ total: 0, results: [], q: query }))
        .finally(() => setBusy(false));
    }, 220);
    return () => window.clearTimeout(t);
  }, [query, testament, book, limit, state.settings.translation]);

  const supp = useMemo(() => {
    if (lower.length < 2) return null;
    const ref = parseHumanRef(query);
    const refs: { label: string; chapter: string; verse: number }[] = [];
    if (ref) {
      const b = allBooks().find((x) => x.osis === ref.book)!;
      if (ref.chapter) refs.push({ label: ref.verse ? formatRef(`${ref.book}.${ref.chapter}.${ref.verse}${ref.verseEnd ? `-${ref.verseEnd}` : ''}`) : `${b.name} ${ref.chapter}`, chapter: `${ref.book}.${ref.chapter}`, verse: ref.verse ?? 1 });
      else refs.push({ label: `${b.name} 1`, chapter: `${ref.book}.1`, verse: 1 });
    }
    const starts = (s: string) => s.toLowerCase().startsWith(lower);
    const places = ed.places.filter((p) => starts(p.name) || p.names.some(starts)).sort((a, b) => (b.verses?.length ?? 0) - (a.verses?.length ?? 0)).slice(0, 24);
    const people = ed.people.filter((p) => starts(p.name) || p.also.some(starts)).sort((a, b) => (b.verses?.length ?? 0) - (a.verses?.length ?? 0)).slice(0, 24);
    const threads = ed.threads.filter((t) => t.name.toLowerCase().includes(lower));
    const journeys = ed.journeys.filter((j) => j.name.toLowerCase().includes(lower) || j.segments.some((s) => [s.from, s.to].some((id) => id && places.slice(0, 3).some((p) => p.id === id))));
    const events = ed.timeline.filter((t) => t.label.toLowerCase().includes(lower)).slice(0, 12);
    return { refs, places, people, threads, journeys, events };
  }, [query, lower, ed, ed.places, ed.people, ed.timeline]);

  const Group = ({ label, count, children, testId }: { label: string; count: number; children: React.ReactNode; testId: string }) =>
    count ? (
      <section className="mt-5" data-testid={`search-group-${testId}`}>
        <p className="label-caps text-[10px] text-[var(--ink-faint)]">
          {label} <span className="font-normal">· {count}</span>
        </p>
        <div className="mt-1">{children}</div>
      </section>
    ) : null;
  const chip = 'min-h-[38px] rounded-full border hairline px-3 font-display text-[15px]';
  const nothing = supp && scripture && !busy && !supp.refs.length && !scripture.total && !supp.places.length && !supp.people.length && !supp.threads.length && !supp.journeys.length && !supp.events.length;

  return (
    <Sheet label="Search" eyebrow={`The Holy Bible · ${ed.translation.translation.abbreviation}`} title="Search" testId="search-sheet" maxHeight="92dvh">
      <label htmlFor="search-input" className="sr-only">
        Search words, “exact phrases”, references, people or places
      </label>
      <input
        id="search-input"
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setLimit(60);
        }}
        placeholder='shepherd · "in the beginning" · John 3:16 · Bethel'
        className="w-full rounded-[2px] border hairline bg-transparent px-3 py-3 font-display text-[18px] outline-none focus:border-[var(--bronze)]"
        data-testid="search-input"
        autoComplete="off"
        enterKeyHint="search"
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Search filters">
        {([null, 'OT', 'NT'] as const).map((t) => (
          <button key={String(t)} type="button" aria-pressed={testament === t} onClick={() => setTestament(t)} className="min-h-[34px] rounded-full border hairline px-3 font-display text-[13px]" style={{ background: testament === t ? 'var(--ink)' : 'transparent', color: testament === t ? 'var(--paper)' : 'var(--ink-muted)' }} data-testid={`search-filter-${t ?? 'all'}`}>
            {t === null ? 'Whole Bible' : t === 'OT' ? 'Old Testament' : 'New Testament'}
          </button>
        ))}
        <select value={book} onChange={(e) => setBook(e.target.value)} className="min-h-[34px] rounded-full border hairline bg-transparent px-3 font-display text-[13px]" aria-label="Limit to a book" data-testid="search-book">
          <option value="">Any book</option>
          {allBooks()
            .filter((b) => !testament || b.testament === testament)
            .map((b) => (
              <option key={b.osis} value={b.osis}>
                {b.name}
              </option>
            ))}
        </select>
      </div>

      {supp && (
        <>
          <Group label="References" count={supp.refs.length} testId="references">
            {supp.refs.map((r) => (
              <button key={r.chapter + r.verse} type="button" className="flex min-h-[40px] w-full items-center text-left font-display text-[17px]" onClick={() => { goTo(r.chapter, r.verse); close(); }} data-testid="search-reference">
                {r.label} →
              </button>
            ))}
          </Group>

          <section className="mt-5" data-testid="search-group-scripture" aria-busy={busy}>
            <p className="label-caps text-[10px] text-[var(--ink-faint)]">
              Scripture {scripture && !busy ? <span className="font-normal">· {scripture.total.toLocaleString()} {scripture.total === 1 ? 'verse' : 'verses'}</span> : busy ? <span className="font-normal">· searching…</span> : null}
            </p>
            {scripture && (
              <ul className="mt-1">
                {scripture.results.map((v) => (
                  <li key={v.ref} className="border-t hairline first:border-t-0">
                    <button type="button" className="w-full py-2.5 text-left" onClick={() => { goTo(chapterOf(v.ref), parseRef(v.ref).from, { keepReturn: true }); close(); }} data-testid="search-verse" data-ref={v.ref}>
                      <span className="font-display text-[13.5px] font-semibold">{formatRef(v.ref)}</span>
                      <span className="mt-0.5 block text-[16px] leading-snug">
                        <Marked text={v.text} marks={v.marks} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {scripture && scripture.total > scripture.results.length && (
              <button type="button" className="btn-quiet mt-1 px-2 text-[13px] italic" onClick={() => setLimit((l) => l + 120)}>
                Show more ({scripture.results.length} of {scripture.total.toLocaleString()})
              </button>
            )}
          </section>

          <div className="mt-6 border-t hairline pt-1" aria-label="Notes, places and people — supplementary">
            <p className="supp mt-2 text-[11.5px] italic text-[var(--ink-faint)]">Supplementary — not Scripture</p>
            <Group label="Places" count={supp.places.length} testId="places">
              <div className="flex flex-wrap gap-2">
                {supp.places.map((p) => (
                  <button key={p.id} type="button" className={chip} onClick={() => open({ kind: 'place', id: p.id })} data-testid={`search-place-${p.id}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </Group>
            <Group label="People" count={supp.people.length} testId="people">
              <div className="flex flex-wrap gap-2">
                {supp.people.map((p) => (
                  <button key={p.id} type="button" className={chip} onClick={() => open({ kind: 'person', id: p.id })} data-testid={`search-person-${p.id}`}>
                    {p.name}
                    {(p.verses?.length ?? 0) > 0 && <span className="ml-1.5 text-[11px] text-[var(--ink-faint)]">{p.verses![0] ? formatRef(p.verses![0]).replace(/:\d+$/, '') : ''}</span>}
                  </button>
                ))}
              </div>
            </Group>
            <Group label="Threads" count={supp.threads.length} testId="threads">
              <div className="flex flex-wrap gap-2">
                {supp.threads.map((t) => (
                  <button key={t.id} type="button" className={chip} onClick={() => open({ kind: 'thread', id: t.id })}>
                    {t.name}
                  </button>
                ))}
              </div>
            </Group>
            <Group label="Journeys" count={supp.journeys.length} testId="journeys">
              {supp.journeys.map((j) => (
                <button key={j.id} type="button" className="flex min-h-[40px] w-full items-center text-left font-display text-[16px]" onClick={() => open({ kind: 'atlas', layer: j.id })}>
                  {j.name} <span className="ml-2 text-[13px] italic text-[var(--ink-faint)]">{j.segments.length} stages</span>
                </button>
              ))}
            </Group>
            <Group label="Events" count={supp.events.length} testId="events">
              {supp.events.map((t) => (
                <button key={t.id} type="button" className="flex min-h-[40px] w-full items-center text-left font-display text-[16px]" onClick={() => { goTo(chapterOf(t.refs[0]), parseRef(t.refs[0]).from, { keepReturn: true }); close(); }}>
                  {t.label} <span className="ml-2 text-[13px] italic text-[var(--ink-faint)]">{formatRef(t.refs[0])}</span>
                </button>
              ))}
            </Group>
          </div>
          {nothing && <p className="supp mt-5 text-[14px] italic">Nothing matches “{query}”.</p>}
        </>
      )}
      {!supp && <p className="supp mt-4 text-[13px] italic text-[var(--ink-faint)]">Search every verse of the Bible. Put words in quotation marks to find an exact phrase. Works offline once the Bible is downloaded.</p>}
    </Sheet>
  );
}
