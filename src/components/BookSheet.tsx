'use client';
import { useEffect, useMemo } from 'react';
import { formatRef, getBook, parseRef } from '@/lib/content/refs';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

/**
 * A book's introduction, made only of what the Bible's own text and this Bible's data hold: its
 * place in the canon, its length, the people and places it names most, and its contents — each
 * chapter with the 1611 translators' summary. Nothing here is a claim about authorship or date.
 * Supplementary — not Scripture.
 */
export function BookSheet({ osis }: { osis: string }) {
  const { ed, version, goTo, close, open } = useReader();
  const b = getBook(osis);
  useEffect(() => {
    void ed.ensureBook(osis);
    void ed.ensureXrefs(osis);
  }, [ed, osis]);
  const loaded = ed.chapterByRef.get(`${osis}.1`)?.loaded;
  const facts = useMemo(() => {
    if (!loaded) return null;
    const chapters = ed.chapters.filter((c) => c.book.osis === osis);
    let words = 0;
    const people = new Map<string, number>();
    const places = new Map<string, number>();
    let red = 0;
    for (const c of chapters)
      for (const v of c.verses) {
        words += v.text.split(/\s+/).filter(Boolean).length;
        const e = ed.entities.get(v.ref);
        for (const id of new Set((e?.names ?? []).map((n) => n.id))) people.set(id, (people.get(id) ?? 0) + 1);
        for (const id of new Set((e?.places ?? []).map((n) => n.id))) places.set(id, (places.get(id) ?? 0) + 1);
        if (ed.redAt(v.ref)) red++;
      }
    const top = (m: Map<string, number>) => [...m].sort((a, z) => z[1] - a[1]).slice(0, 8);
    const x = ed.xrefs.get(osis)?.refs ?? {};
    const pointed = Object.entries(x)
      .map(([k, l]) => [k, l.reduce((n, [, v]) => n + v, 0)] as const)
      .sort((a, z) => z[1] - a[1])
      .slice(0, 5)
      .map(([k]) => `${osis}.${k}`);
    return { chapters, words, people: top(people), places: top(places), red, pointed };
  }, [ed, osis, loaded, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const read = (chapter: string, verse = 1) => {
    goTo(chapter, verse, { keepReturn: true });
    close();
  };
  const verses = b.verses!.reduce((n, v) => n + v, 0);
  const titles = Object.keys(ed.print.get(osis)?.titles ?? {}).length;
  const aramaic = ed.aramaic?.passages.filter((p) => p.from.startsWith(`${osis}.`)) ?? [];

  return (
    <Sheet label={`About ${b.name}`} eyebrow="Supplementary — not Scripture" title={b.name} testId="book-sheet" maxHeight="90dvh">
      <p className="supp text-[14px] italic text-[var(--ink-muted)]">{b.title}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="book-facts">
        {[
          [b.testament === 'OT' ? 'Old Testament' : 'New Testament', `Book ${b.order} of 66`],
          [(b.division ?? '').replace('-', ' & '), 'Division'],
          [`${b.chapterCount} ${b.chapterCount === 1 ? 'chapter' : 'chapters'}`, `${verses.toLocaleString()} verses`],
          [facts ? `${facts.words.toLocaleString()} words` : '…', `in the ${ed.translation.translation.abbreviation}`],
        ].map(([a, z]) => (
          <div key={a} className="rounded-[3px] border hairline px-3 py-2">
            <dt className="font-display text-[15.5px] leading-tight">{a}</dt>
            <dd className="supp text-[11.5px] text-[var(--ink-faint)]">{z}</dd>
          </div>
        ))}
      </dl>
      {(titles > 0 || (facts?.red ?? 0) > 0 || aramaic.length > 0) && (
        <ul className="supp mt-3 space-y-1 text-[13.5px] leading-snug text-[var(--ink-muted)]">
          {titles > 0 && <li>{titles} of its chapters carry a title in the KJV (“A Psalm of David…”).</li>}
          {facts && facts.red > 0 && <li>Words of Jesus are printed in red in {facts.red.toLocaleString()} of its verses (KJV).</li>}
          {aramaic.map((p) => (
            <li key={p.from}>
              Written in Aramaic:{' '}
              <button type="button" className="underline decoration-dotted" onClick={() => open({ kind: 'aramaic' })}>
                {formatRef(p.from)} – {formatRef(p.to).replace(/^.* (?=\d+:)/, '')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {facts && (facts.people.length > 0 || facts.places.length > 0) && (
        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          {facts.people.length > 0 && (
            <div>
              <p className="label-caps text-[10px] text-[var(--ink-faint)]">People named most</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {facts.people.map(([id, n]) => (
                  <li key={id}>
                    <button type="button" className="min-h-[34px] rounded-[3px] border hairline px-2 font-display text-[14px]" onClick={() => open({ kind: 'person', id })}>
                      {ed.personById.get(id)?.name ?? id} <span className="supp text-[11px] text-[var(--ink-faint)]">{n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {facts.places.length > 0 && (
            <div>
              <p className="label-caps text-[10px] text-[var(--ink-faint)]">Places named most</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {facts.places.map(([id, n]) => (
                  <li key={id}>
                    <button type="button" className="min-h-[34px] rounded-[3px] border hairline px-2 font-display text-[14px]" onClick={() => open({ kind: 'place', id })}>
                      {ed.placeById.get(id)?.name ?? id} <span className="supp text-[11px] text-[var(--ink-faint)]">{n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="supp text-[11.5px] italic text-[var(--ink-faint)] sm:col-span-2">Counted by verse, from the names marked in the text.</p>
        </section>
      )}

      {facts && facts.pointed.length > 0 && (
        <section className="mt-5">
          <p className="label-caps text-[10px] text-[var(--ink-faint)]">Verses with the most cross-references</p>
          <ul className="mt-1">
            {facts.pointed.map((r) => (
              <li key={r} className="border-t hairline py-1.5 first:border-t-0">
                <button type="button" className="text-left text-[14.5px] leading-snug" onClick={() => read(`${osis}.${parseRef(r).chapter}`, parseRef(r).from)}>
                  <span className="font-display text-[var(--bronze-deep)]">{formatRef(r)}</span> <span>{ed.translation.verse(r)?.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6" data-testid="book-contents">
        <p className="label-caps text-[10px] text-[var(--ink-faint)]">The contents · the 1611 chapter summaries</p>
        <ol className="mt-1">
          {Array.from({ length: b.chapterCount! }, (_, i) => i + 1).map((n) => {
            const s = ed.summaryOf(`${osis}.${n}`);
            return (
              <li key={n} className="border-t hairline first:border-t-0">
                <button type="button" className="flex w-full gap-3 py-2 text-left" onClick={() => read(`${osis}.${n}`)}>
                  <span className="w-8 shrink-0 font-display text-[18px] text-[var(--bronze)]">{n}</span>
                  <span className="text-[13.5px] italic leading-snug text-[var(--ink-muted)]">{s ?? ed.headings.get(`${osis}.${n}.1`)?.label ?? ''}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="supp mt-2 text-[11.5px] italic leading-snug text-[var(--ink-faint)]">The summaries are those printed in the 1611 King James Bible, in their own spelling — the translators’ contents lines, not Scripture.</p>
      </section>
    </Sheet>
  );
}
