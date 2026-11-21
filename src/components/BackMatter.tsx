'use client';
import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '@/lib/library/base';
import { chapterOf, formatRef, getBook, parseRef } from '@/lib/content/refs';
import type { VerseRef } from '@/lib/content/types';
import { useRefsReady } from '@/lib/library/useLibrary';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

export type BackTab = 'concordance' | 'topics' | 'maps' | 'memory';
const TABS: [BackTab, string][] = [
  ['concordance', 'Concordance'],
  ['topics', 'Topics'],
  ['maps', 'Maps'],
  ['memory', 'By heart'],
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** "Exod.6.16-20", "Num.17", "Gen.1.1-2:3" → a readable reference and where to open it. */
export function topicRef(r: string): { label: string; chapter: string; verse: number } {
  const parts = r.split('.');
  const book = getBook(parts[0]).name;
  if (parts.length === 2) return { label: `${book} ${parts[1]}`, chapter: r, verse: 1 };
  const [v, end] = parts[2].split('-');
  return { label: `${book} ${parts[1]}:${v}${end ? `–${end}` : ''}`, chapter: `${parts[0]}.${parts[1]}`, verse: Number(v) };
}

/**
 * AT THE BACK — what a printed Bible keeps after Revelation: a concordance, a topical index
 * (Nave's), the maps, and the verses the reader is learning by heart. Supplementary — not Scripture.
 */
export function BackMatter({ tab: initial }: { tab?: BackTab }) {
  const [tab, setTab] = useState<BackTab>(initial ?? 'concordance');
  return (
    <Sheet label="At the back" eyebrow="Supplementary — not Scripture" title="At the back" testId="back-matter" maxHeight="90dvh">
      <div role="tablist" aria-label="At the back" className="mb-3 flex gap-1 overflow-x-auto border-b hairline">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="-mb-px min-h-[44px] shrink-0 px-2.5 font-display text-[15px]" style={{ color: tab === k ? 'var(--ink)' : 'var(--ink-faint)', borderBottom: tab === k ? '1.5px solid var(--bronze)' : '1.5px solid transparent' }} data-testid={`back-tab-${k}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'concordance' && <Concordance />}
      {tab === 'topics' && <Topics />}
      {tab === 'maps' && <Plates />}
      {tab === 'memory' && <ByHeart />}
    </Sheet>
  );
}

function LetterRow({ letter, setLetter }: { letter: string; setLetter: (l: string) => void }) {
  return (
    <div className="flex flex-wrap gap-0.5" role="group" aria-label="Letter">
      {LETTERS.map((l) => (
        <button key={l} type="button" onClick={() => setLetter(l)} aria-pressed={letter === l} className="h-8 min-w-[28px] rounded-[2px] font-display text-[14px]" style={{ background: letter === l ? 'var(--ink)' : 'transparent', color: letter === l ? 'var(--paper)' : 'var(--ink-muted)' }} data-testid={`letter-${l}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Concordance() {
  const { open } = useReader();
  const [data, setData] = useState<[string, number, number][] | null>(null);
  const [letter, setLetter] = useState('A');
  const [q, setQ] = useState('');
  useEffect(() => {
    fetchJson<{ words: [string, number, number][] }>('study/concordance.json').then((d) => setData(d.words), () => setData([]));
  }, []);
  const shown = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return s ? data.filter((w) => w[0].startsWith(s)).slice(0, 300) : data.filter((w) => w[0][0] === letter.toLowerCase());
  }, [data, letter, q]);
  return (
    <div data-testid="concordance">
      <p className="supp text-[13px] leading-snug text-[var(--ink-muted)]">Every word of the King James text, with how often it occurs. Tap a word to see each verse it is in.</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a word" className="mt-3 w-full rounded-[2px] border hairline bg-transparent px-3 py-2 font-display text-[16px] outline-none focus:border-[var(--bronze)]" data-testid="concordance-input" aria-label="Find a word in the concordance" />
      {!q && (
        <div className="mt-2">
          <LetterRow letter={letter} setLetter={setLetter} />
        </div>
      )}
      {!data && <p className="supp mt-4 italic text-[var(--ink-faint)]">Opening…</p>}
      <ul className="mt-3 columns-2 gap-6 md:columns-3">
        {shown.map(([w, n, v]) => (
          <li key={w} className="break-inside-avoid">
            <button type="button" className="flex w-full items-baseline justify-between gap-2 py-1 text-left" onClick={() => open({ kind: 'search', q: `"${w}"` })} data-testid="concordance-word" title={`${n} times in ${v} verses`}>
              <span className="font-display text-[15.5px]">{w}</span>
              <span className="supp text-[12px] tabular-nums text-[var(--ink-faint)]">{n.toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="supp mt-4 text-[12px] italic text-[var(--ink-faint)]">Counted from the King James text of this Bible.</p>
    </div>
  );
}

interface TopicEntry {
  t: string;
  r?: string[];
  d?: 1;
  see?: string[];
}
interface Topic {
  id: string;
  name: string;
  entries: TopicEntry[];
}

function Topics() {
  const { goTo, close } = useReader();
  const [index, setIndex] = useState<[string, string, string, number][] | null>(null);
  const [source, setSource] = useState('');
  const [letter, setLetter] = useState('A');
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);
  const books = useMemo(() => new Map<string, Promise<Topic[]>>(), []);
  useEffect(() => {
    fetchJson<{ source: string; subjects: [string, string, string, number][] }>('study/topics/index.json').then(
      (d) => {
        setIndex(d.subjects);
        setSource(d.source);
      },
      () => setIndex([]),
    );
  }, []);
  const openTopic = (id: string, l: string) => {
    let p = books.get(l);
    if (!p) {
      p = fetchJson<{ subjects: Topic[] }>(`study/topics/${l}.json`).then((d) => d.subjects);
      books.set(l, p);
    }
    void p.then((list) => setTopic(list.find((t) => t.id === id) ?? null));
  };
  const seeTopic = (name: string) => {
    const hit = index?.find((s) => s[1] === name.toUpperCase().trim()) ?? index?.find((s) => s[1].startsWith(name.toUpperCase().split(',')[0].trim()));
    if (hit) openTopic(hit[0], hit[2]);
  };
  const shown = useMemo(() => {
    if (!index) return [];
    const s = q.trim().toUpperCase();
    return s ? index.filter((t) => t[1].includes(s)).slice(0, 200) : index.filter((t) => t[2] === letter);
  }, [index, letter, q]);

  if (topic)
    return (
      <div data-testid="topic">
        <button type="button" className="btn-quiet -ml-2 px-2 text-[13px] italic" onClick={() => setTopic(null)}>
          ← All topics
        </button>
        <h3 className="mt-1 font-display text-[22px] tracking-[0.06em]">{topic.name}</h3>
        <ul className="mt-2">
          {topic.entries.map((e, i) => (
            <li key={i} className="border-t hairline py-2 first:border-t-0" style={{ paddingLeft: e.d ? 16 : 0 }}>
              {e.see ? (
                <p className="text-[14.5px] italic">
                  See{' '}
                  {e.see.map((s, k) => (
                    <button key={k} type="button" className="mr-1 underline decoration-dotted" onClick={() => seeTopic(s)}>
                      {s}
                    </button>
                  ))}
                </p>
              ) : (
                e.t && <p className="font-display text-[15.5px] leading-snug">{e.t}</p>
              )}
              {e.r && (
                <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                  {e.r.map((r) => {
                    const t = topicRef(r);
                    return (
                      <button key={r} type="button" className="text-[13.5px] text-[var(--bronze-deep)] underline decoration-dotted underline-offset-2" onClick={() => { goTo(t.chapter, t.verse, { keepReturn: true }); close(); }} data-testid="topic-ref">
                        {t.label}
                      </button>
                    );
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
        <p className="supp mt-4 text-[12px] italic leading-snug text-[var(--ink-faint)]">Nave’s headings are his topical arrangement of Scripture — an index to look things up, not a claim about the text. {source}.</p>
      </div>
    );
  return (
    <div data-testid="topics">
      <p className="supp text-[13px] leading-snug text-[var(--ink-muted)]">Nave’s Topical Bible (1896): over five thousand subjects, each with the verses that speak of it.</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a subject — faith, prayer, Aaron…" className="mt-3 w-full rounded-[2px] border hairline bg-transparent px-3 py-2 font-display text-[16px] outline-none focus:border-[var(--bronze)]" data-testid="topics-input" aria-label="Find a subject" />
      {!q && (
        <div className="mt-2">
          <LetterRow letter={letter} setLetter={setLetter} />
        </div>
      )}
      {!index && <p className="supp mt-4 italic text-[var(--ink-faint)]">Opening…</p>}
      <ul className="mt-3 columns-1 gap-6 md:columns-2">
        {shown.map(([id, name, l, n]) => (
          <li key={id} className="break-inside-avoid">
            <button type="button" className="flex w-full items-baseline justify-between gap-2 py-1.5 text-left" onClick={() => openTopic(id, l)} data-testid="topic-subject">
              <span className="font-display text-[15px] tracking-[0.04em]">{name}</span>
              {n > 0 && <span className="supp text-[11.5px] tabular-nums text-[var(--ink-faint)]">{n}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Plates() {
  const { ed, open } = useReader();
  return (
    <div data-testid="plates">
      <p className="supp text-[13px] leading-snug text-[var(--ink-muted)]">The maps, as the plates at the back of a Bible: each journey drawn from the verses that tell it, with how sure each route is.</p>
      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ed.journeys.map((j, i) => (
          <li key={j.id}>
            <button type="button" className="flex w-full items-baseline gap-3 rounded-[3px] border hairline px-3 py-2.5 text-left" onClick={() => open({ kind: 'atlas', layer: j.id })} data-testid="map-plate">
              <span className="font-display text-[12px] tracking-[0.14em] text-[var(--bronze-deep)]">PLATE {toRoman(i + 1)}</span>
              <span className="font-display text-[16px] leading-snug">{j.name}</span>
              <span className="supp ml-auto shrink-0 text-[11.5px] text-[var(--ink-faint)]">{j.segments.length} stages</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function toRoman(n: number) {
  const m: [number, string][] = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of m) while (n >= v) { s += r; n -= v; }
  return s;
}

/**
 * Learning verses by heart: the words faded a little more each time, then just their first letters —
 * a way to practise, nothing more. No streaks, no scores.
 */
function ByHeart() {
  const { state, update, goTo, close } = useReader();
  const refs = state.memory.map((m) => m.ref);
  const [active, setActive] = useState<VerseRef | null>(refs[0] ?? null);
  if (!refs.length)
    return (
      <div data-testid="by-heart">
        <p className="supp text-[14px] leading-snug text-[var(--ink-muted)]">Tap a verse number, then “Learn by heart”, and the verse will wait for you here.</p>
      </div>
    );
  return (
    <div data-testid="by-heart">
      <div className="flex flex-wrap gap-1.5">
        {refs.map((r) => (
          <button key={r} type="button" onClick={() => setActive(r)} aria-pressed={active === r} className="min-h-[36px] rounded-[3px] border hairline px-2.5 font-display text-[14px]" style={{ background: active === r ? 'var(--ink)' : 'transparent', color: active === r ? 'var(--paper)' : 'var(--ink)' }}>
            {formatRef(r)}
          </button>
        ))}
      </div>
      {active && (
        <Practise
          key={active}
          verseRef={active}
          onRead={() => { goTo(chapterOf(active), parseRef(active).from, { keepReturn: true }); close(); }}
          onRemove={() => {
            update((s) => ({ memory: s.memory.filter((m) => m.ref !== active) }));
            setActive(refs.find((r) => r !== active) ?? null);
          }}
        />
      )}
    </div>
  );
}

const STAGES = ['Read it', 'Some words hidden', 'More hidden', 'First letters', 'Say it'];

function Practise({ verseRef, onRead, onRemove }: { verseRef: VerseRef; onRead: () => void; onRemove: () => void }) {
  const { ed } = useReader();
  const ready = useRefsReady([verseRef]);
  const [stage, setStage] = useState(0);
  const text = ready ? ed.translation.verse(verseRef)?.text ?? '' : '';
  // the same words hide each time for a verse, so practice builds on itself
  const words = text.split(/(\s+)/);
  const hidden = (i: number) => {
    if (stage === 0) return false;
    if (stage >= 3) return true;
    const h = (i * 2654435761) % 7;
    return stage === 1 ? h < 2 : h < 5;
  };
  return (
    <div className="mt-4 rounded-[3px] border hairline px-4 py-4" data-testid="practise">
      <p className="label-caps text-[10px] text-[var(--ink-faint)]">
        {formatRef(verseRef)} · {ed.translation.translation.abbreviation} · {STAGES[stage]}
      </p>
      <p className="mt-2 font-display text-[19px] leading-[1.6]" aria-live="polite">
        {stage === 4 ? (
          <span className="italic text-[var(--ink-faint)]">Say it from memory, then reveal it to check.</span>
        ) : (
          words.map((w, i) =>
            /\s+/.test(w) || !hidden(i) ? (
              <span key={i}>{w}</span>
            ) : stage === 3 ? (
              <span key={i}>
                {w[0]}
                <span style={{ letterSpacing: '0.1em', color: 'var(--ink-faint)' }}>{w.slice(1).replace(/[A-Za-z’']/g, '·')}</span>
              </span>
            ) : (
              <span key={i} className="rounded-[2px]" style={{ background: 'color-mix(in srgb, var(--ink) 12%, transparent)', color: 'transparent' }}>
                {w}
              </span>
            ),
          )
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {stage > 0 && (
          <button type="button" className="btn-card" onClick={() => setStage(0)}>
            Reveal
          </button>
        )}
        {stage < STAGES.length - 1 && (
          <button type="button" className="btn-card" onClick={() => setStage(stage + 1)} data-testid="practise-next">
            Hide more →
          </button>
        )}
        <button type="button" className="btn-quiet px-2 text-[13px] italic" onClick={onRead}>
          Read it in place
        </button>
        <button type="button" className="btn-quiet ml-auto px-2 text-[13px] italic" onClick={onRemove}>
          Done with this verse
        </button>
      </div>
      <p className="supp mt-3 text-[12px] italic text-[var(--ink-faint)]">Hiding words is only a way to practise: the verse itself is never changed.</p>
    </div>
  );
}
