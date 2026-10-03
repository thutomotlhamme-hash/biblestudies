'use client';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { allBooks, canonicalIndex, chapterOf, formatRef, parseRef, testamentOf } from '@/lib/content/refs';
import { chronoIndex } from '@/lib/content/repository';
import { useRefsReady } from '@/lib/library/useLibrary';
import { IconChevron } from './Icons';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

/** Emphasise every match of the thread wording without changing the text. */
function ThreadText({ text, re }: { text: string; re: RegExp }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  const g = new RegExp(re.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) {
    const start = m.index;
    let end = start + m[0].length;
    while (end < text.length && /[A-Za-z]/.test(text[end])) end++;
    out.push(text.slice(last, start), <span key={start} className="shared-phrase">{text.slice(start, end)}</span>);
    last = end;
    g.lastIndex = end;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

/** ThreadDrawer — a Scripture trail: follow one word through the journey, in canonical or chronological order. */
export function ThreadDrawer({ id, startRef }: { id: string; startRef?: string }) {
  const { ed, state, goTo, close, reduced, open, update, chapter } = useReader();
  const thread = ed.threads.find((t) => t.id === id) ?? ed.threads[0];
  const [order, setOrder] = useState<'canonical' | 'chronological'>('canonical');
  const passages = useMemo(() => {
    const list = ed.passagesOf(thread.id);
    return order === 'canonical' ? list : [...list].sort((a, b) => chronoIndex(ed, a) - chronoIndex(ed, b));
  }, [ed, thread.id, order]);
  // start at the given passage, or the first one at or after where the reader is
  const startAt = () => {
    const k = passages.indexOf(startRef ?? '');
    if (k >= 0) return k;
    const here = canonicalIndex(`${chapter.ref}.${state.position.verse}`);
    const n = passages.findIndex((r) => canonicalIndex(r) >= here);
    return order === 'canonical' && n >= 0 ? n : 0;
  };
  const [i, setI] = useState(startAt);
  useEffect(() => setI(startAt()), [id, startRef, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = passages[Math.min(i, passages.length - 1)] ?? passages[0];
  const ready = useRefsReady(ref ? [ref] : []);
  const verse = ready && ref ? ed.translation.verse(ref) : null;
  const re = thread.match ? new RegExp(thread.match, 'i') : null;
  const placeNames = thread.place ? [ed.placeById.get(thread.place)?.name ?? '', ...(ed.placeById.get(thread.place)?.names ?? [])].filter(Boolean) : [];
  const emphasis = re ?? (placeNames.length ? new RegExp(`\\b(${placeNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i') : null);
  const perBook = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of passages) m.set(parseRef(r).book, (m.get(parseRef(r).book) ?? 0) + 1);
    return m;
  }, [passages]);
  const dense = passages.length > 90;
  const visited = state.threadProgress[id] ?? [];

  useEffect(() => {
    if (!visited.includes(ref)) update((s) => ({ threadProgress: { ...s.threadProgress, [id]: [...(s.threadProgress[id] ?? []), ref] } }));
  }, [ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const people = (ref && ed.entities.get(ref)?.people) || [];
  const places = (ref && ed.entities.get(ref)?.places) || [];
  if (!ref) return null;
  const following = state.followThread === id;

  return (
    <Sheet label={`Thread: ${thread.name}`} eyebrow="Thread" title={thread.name} testId="thread-drawer" light maxHeight="80dvh">
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto scroll-quiet px-1 pb-1" role="tablist" aria-label="Threads">
        {ed.threads.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === id} className="tag min-h-[32px] shrink-0" style={{ opacity: t.id === id ? 1 : 0.5 }} onClick={() => open({ kind: 'thread', id: t.id })}>
            {t.name}
          </button>
        ))}
      </div>
      <p className="supp text-[14px] leading-snug">{thread.description}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Order" className="flex rounded-full border hairline p-0.5">
          {(['canonical', 'chronological'] as const).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={order === o} onClick={() => { setOrder(o); setI(0); }} className="min-h-[34px] rounded-full px-3 font-display text-[13px]" style={{ background: order === o ? 'var(--ink)' : 'transparent', color: order === o ? 'var(--paper)' : 'var(--ink-muted)' }} data-testid={`thread-order-${o}`}>
              {o === 'canonical' ? 'Canonical' : 'Chronological'}
            </button>
          ))}
        </div>
        <button type="button" role="switch" aria-checked={following} className="btn-quiet min-h-[34px] px-3 text-[13px] italic" onClick={() => update({ followThread: following ? null : id })} data-testid="thread-follow">
          {following ? 'Following in the margins ✓' : 'Follow in the margins'}
        </button>
      </div>
      {order === 'chronological' && <p className="supp mt-2 text-[12px] italic">Chronological order follows a traditional chronology of events (model-dependent); see the timeline for certainty.</p>}
      <p className="supp mt-1 text-[12px] italic text-[var(--ink-faint)]">{passages.length.toLocaleString()} passages. {thread.kind === 'wording' ? 'Found by the wording of the KJV.' : ''}</p>

      {dense ? (
        <div className="mt-5" aria-label={`${passages.length} passages across the Bible`}>
          <div className="flex h-12 items-end gap-[1px]" aria-hidden={false}>
            {allBooks()
              .filter((b) => order === 'chronological' || true)
              .map((b) => {
                const n = perBook.get(b.osis) ?? 0;
                const max = Math.max(...perBook.values());
                const cur = parseRef(ref).book === b.osis;
                return (
                  <button key={b.osis} type="button" disabled={!n} onClick={() => setI(passages.findIndex((r) => parseRef(r).book === b.osis))} aria-label={`${b.name}: ${n} passages`} className="flex-1" style={{ height: `${n ? 12 + (n / max) * 88 : 4}%`, background: cur ? 'var(--bronze)' : n ? (b.testament === 'OT' ? 'var(--ink-faint)' : 'var(--ink-muted)') : 'var(--rule)', opacity: n ? 1 : 0.5 }} />
                );
              })}
          </div>
          <input type="range" min={0} max={passages.length - 1} value={passages.indexOf(ref)} onChange={(e) => setI(Number(e.target.value))} className="mt-2 w-full accent-[var(--bronze)]" aria-label="Move through the thread" data-testid="thread-slider" />
          <div className="flex justify-between font-display text-[10px] tracking-[0.16em] text-[var(--ink-faint)]" aria-hidden>
            <span>GENESIS</span>
            <span>REVELATION</span>
          </div>
        </div>
      ) : (
      <div className="relative mt-5 h-14" role="list" aria-label={`${passages.length} passages`}>
        <svg className="absolute inset-x-0 top-[14px] h-6 w-full" preserveAspectRatio="none" viewBox="0 0 100 10" aria-hidden>
          <path d="M0 5 C 12 1, 25 9, 37 5 S 62 1, 75 5 S 92 9, 100 5" fill="none" stroke="var(--bronze)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.7" />
        </svg>
        {passages.map((r, k) => {
          const left = passages.length === 1 ? 50 : (k / (passages.length - 1)) * 100;
          const active = r === ref;
          const ot = testamentOf(r) === 'OT';
          return (
            <button key={r} type="button" role="listitem" onClick={() => setI(k)} aria-label={formatRef(r)} aria-current={active} className="absolute top-0 flex h-11 w-5 -translate-x-1/2 items-center justify-center" style={{ left: `${left}%` }}>
              <motion.span
                layout={!reduced}
                className="block rounded-full border"
                style={{ width: active ? 12 : 7, height: active ? 12 : 7, background: active ? 'var(--bronze)' : visited.includes(r) ? 'var(--pencil)' : ot ? 'var(--paper)' : 'var(--ink-muted)', borderColor: active ? 'var(--bronze-deep)' : 'var(--ink-muted)' }}
              />
            </button>
          );
        })}
        <div className="absolute inset-x-0 top-[44px] flex justify-between font-display text-[10px] tracking-[0.16em] text-[var(--ink-faint)]" aria-hidden>
          <span>{formatRef(passages[0]).replace(/ \d.*/, '').toUpperCase()}</span>
          <span>{formatRef(passages[passages.length - 1]).replace(/ \d.*/, '').toUpperCase()}</span>
        </div>
      </div>
      )}

      <motion.div key={ref} initial={reduced ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="mt-5" data-testid="thread-passage">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-[20px] font-medium">{formatRef(ref)}</p>
          <p className="label-caps text-[10px] text-[var(--ink-faint)]">
            {passages.indexOf(ref) + 1} / {passages.length}
          </p>
        </div>
        <p className="mt-2 text-[18px] leading-[1.55]">
          {verse ? (
            <span data-ref={ref}>
              <span data-scripture-text>{emphasis ? <ThreadText text={verse.text} re={emphasis} /> : verse.text}</span>
            </span>
          ) : (
            <span className="supp text-[14px] italic text-[var(--ink-faint)]">Opening…</span>
          )}
        </p>
        {(people.length > 0 || places.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {people.map((p) => (
              <button key={p} type="button" className="min-h-[32px] rounded-full border hairline px-2.5 font-display text-[13px]" onClick={() => open({ kind: 'person', id: p })}>
                {(ed.personById.get(p)?.name ?? p).replace(/ \(.*\)/, '')}
              </button>
            ))}
            {[...new Set(places.map((h) => h.id))].map((p) => (
              <button key={p} type="button" className="min-h-[32px] rounded-full border hairline px-2.5 font-display text-[13px] italic" onClick={() => open({ kind: 'place', id: p })}>
                {ed.placeById.get(p)?.name ?? p}
              </button>
            ))}
          </div>
        )}
      </motion.div>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" className="btn-quiet" disabled={passages.indexOf(ref) === 0} style={{ opacity: passages.indexOf(ref) === 0 ? 0.3 : 1 }} onClick={() => setI(passages.indexOf(ref) - 1)} aria-label="Previous passage in thread">
          <IconChevron dir="left" />
        </button>
        {true ? (
          <button
            type="button"
            className="btn-quiet px-3 text-[14px] italic"
            onClick={() => {
              goTo(chapterOf(ref), parseRef(ref).from, { keepReturn: true });
              close();
            }}
          >
            Read at {formatRef(ref)}
          </button>
        ) : (
          <span className="supp text-[12px] italic">Beyond this edition</span>
        )}
        <button type="button" className="btn-quiet" disabled={passages.indexOf(ref) === passages.length - 1} style={{ opacity: passages.indexOf(ref) === passages.length - 1 ? 0.3 : 1 }} onClick={() => setI(passages.indexOf(ref) + 1)} aria-label="Next passage in thread" data-testid="thread-next">
          <IconChevron dir="right" />
        </button>
      </div>
      <p className="supp mt-2 text-center text-[12px] italic">
        {visited.length} of {passages.length} passages read in this thread
      </p>
    </Sheet>
  );
}
