'use client';
import { useEffect, useState } from 'react';
import { DEEP_LEVEL_LABEL, DEEP_LEVEL_NOTE, LEVEL_LABEL, LEVEL_NOTE } from '@/lib/content/editorial';
import { chapterOf, formatRef, parseRef } from '@/lib/content/refs';
import type { ChapterRef, DeepClaim, DeepItem, DeepStory } from '@/lib/content/types';
import { RefPassage } from './Evidence';
import { GlyphDeep } from './Icons';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

type Tab = 'research' | 'stories' | 'links';
type Scale = 'deep' | 'connection';

const levelLabel = (scale: Scale, level: number) => (scale === 'deep' ? DEEP_LEVEL_LABEL[level] : LEVEL_LABEL[level]);
const levelNote = (scale: Scale, level: number) => (scale === 'deep' ? DEEP_LEVEL_NOTE[level] : LEVEL_NOTE[level]);

function Level({ scale, level }: { scale: Scale; level: number }) {
  return (
    <span className="tag mr-1.5 inline-block" title={levelNote(scale, level)} data-testid="deep-level">
      Level {level} · {levelLabel(scale, level)}
    </span>
  );
}

/** A cited reference: tap to read it in the Bible (with a way back). */
function Cite({ refId }: { refId: string }) {
  const { goTo, close } = useReader();
  return (
    <button
      type="button"
      className="btn-quiet -ml-1 min-h-[32px] px-1 text-[13px] italic underline decoration-[var(--rule)] underline-offset-2"
      onClick={() => {
        goTo(chapterOf(refId), parseRef(refId).from, { keepReturn: true });
        close();
      }}
    >
      {formatRef(refId)}
    </button>
  );
}

function Claim({ c, scale }: { c: DeepClaim; scale: Scale }) {
  return (
    <li className="border-t hairline py-2 first:border-t-0" data-testid="deep-claim">
      <p className="supp text-[15px] leading-snug">{c.text}</p>
      {c.quote && (
        // An exact slice of the KJV verse (tested). Shown as the KJV's words, never reworded.
        <p className="mt-1 text-[15.5px] leading-snug" data-testid="deep-quote" data-quote-ref={c.quote.ref}>
          <span className="label-caps mr-2 text-[9px] text-[var(--ink-faint)]">KJV</span>“<span data-quote-text>{c.quote.text}</span>”
        </p>
      )}
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--ink-faint)]">
        <span title={levelNote(scale, c.level)}>Level {c.level}</span>
        <span aria-hidden>·</span>
        {c.refs.map((r) => (
          <Cite key={r} refId={r} />
        ))}
      </p>
    </li>
  );
}

/**
 * The moment a video note refers to, in YouTube's own embedded player (privacy-enhanced domain).
 * Nothing is copied: the creator's video plays from YouTube, credited, starting at that second.
 * It loads only when the reader asks for it.
 */
function VideoMoment({ id, start, title }: { id: string; start: number; title: string }) {
  const [on, setOn] = useState(false);
  const at = `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}`;
  return (
    <div className="mt-2" data-testid="deep-video">
      {on ? (
        <div className="relative w-full overflow-hidden rounded-[2px]" style={{ aspectRatio: '16 / 9' }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?start=${start}&rel=0`}
            title={`Deep Made Simple — ${title}, from ${at}`}
            allow="encrypted-media; picture-in-picture; fullscreen"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <button type="button" className="btn-card w-full" onClick={() => setOn(true)} data-testid="deep-video-play">
          ▶ Watch this moment ({at}) · YouTube
        </button>
      )}
      <p className="supp mt-1 text-[11.5px] italic text-[var(--ink-faint)]">
        Video by Deep Made Simple on YouTube ·{' '}
        <a className="underline" href={`https://www.youtube.com/watch?v=${encodeURIComponent(id)}&t=${start}s`} target="_blank" rel="noopener noreferrer">
          open on YouTube
        </a>
      </p>
    </div>
  );
}

function ItemCard({ it }: { it: DeepItem }) {
  const { open } = useReader();
  const o = it.object;
  return (
    <article className="mt-4 rounded-[2px] border hairline px-4 py-3" data-testid={`deep-item-${it.id}`} data-deep-kind={it.kind}>
      <p className="label-caps text-[9.5px] text-[var(--ink-faint)]">{it.subtitle}</p>
      <h3 className="font-display text-[19px] font-medium leading-tight">{it.title}</h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-y-1">
        <Level scale={it.scale} level={it.level} />
        <span className="tag mr-1.5 inline-block italic">{it.editorial.status}</span>
        {it.method === 'text-match' && <span className="tag mr-1.5 inline-block">found by wording</span>}
      </div>
      <ul className="mt-2">
        {it.claims.map((c, i) => (
          <Claim key={i} c={c} scale={it.scale} />
        ))}
      </ul>
      {o?.kind === 'video' && <VideoMoment id={o.id} start={o.start} title={it.title} />}
      {o && o.kind !== 'video' && (
        <button
          type="button"
          className="btn-quiet -ml-2 mt-1 min-h-[36px] px-2 text-[13px] italic"
          onClick={() => open(o.kind === 'words' ? { kind: 'words', ref: o.ref } : o.kind === 'vellum' ? { kind: 'vellum', id: o.id } : { kind: o.kind, id: o.id })}
        >
          {o.kind === 'words' ? 'Open the word study →' : o.kind === 'vellum' ? 'Open both passages on vellum →' : `Open the ${o.kind} →`}
        </button>
      )}
      <p className="supp mt-1 text-[11.5px] italic text-[var(--ink-faint)]">
        {it.source} · {it.editorial.author}
      </p>
    </article>
  );
}

function StoryView({ st }: { st: DeepStory }) {
  const { ed } = useReader();
  const kjv = ed.translation.translation.id === 'kjv';
  return (
    <article className="mt-4" data-testid={`deep-story-${st.id}`}>
      <p className="supp text-[15px] leading-snug">{st.summary}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-y-1">
        <Level scale="deep" level={st.level} />
        <span className="tag mr-1.5 inline-block italic">{st.editorial.status}</span>
      </div>
      <ol className="mt-3">
        {st.steps.map((s, i) => (
          <li key={i} className="mt-3 border-l-2 border-[var(--rule)] pl-3" data-testid="deep-story-step" data-step-ref={s.ref}>
            {s.why && (
              <p className="supp text-[13px] italic text-[var(--ink-muted)]" data-testid="deep-story-why">
                {s.why.text} <span className="not-italic text-[var(--ink-faint)]">· Level {s.why.level}{s.why.connection ? ` · ${LEVEL_LABEL[s.why.level]}` : ''}</span>
              </p>
            )}
            {s.note && <p className="supp mt-0.5 text-[13.5px] text-[var(--ink-muted)]">{s.note}</p>}
            {/* The verse itself, verbatim from the active translation. */}
            <ul>
              <RefPassage refId={s.ref} phrase={kjv ? s.phrase : undefined} compact />
            </ul>
          </li>
        ))}
      </ol>
      <p className="supp mt-3 text-[11.5px] italic text-[var(--ink-faint)]">
        {st.source} · {st.editorial.author}
      </p>
    </article>
  );
}

/**
 * DEEP MADE SIMPLE — deep study, told plainly. Research, stories and links for a chapter, kept apart
 * from Scripture and labelled as supplementary. Every claim cites its verse and carries a level;
 * quotations are exact KJV words; story passages are shown whole from the active translation.
 */
export function DeepSheet({ chapterRef, verse, tab: initial, story }: { chapterRef: ChapterRef; verse?: number; tab?: Tab; story?: string }) {
  const { ed, version } = useReader();
  useEffect(() => {
    void ed.ensureDeep(chapterRef.split('.')[0]);
  }, [ed, chapterRef]);
  void version;
  const { items, stories } = ed.deepFor(chapterRef);
  const research = items.filter((i) => i.kind === 'research');
  const links = items.filter((i) => i.kind === 'link');
  const atVerse = (it: DeepItem) => verse !== undefined && parseRef(it.anchor).from === verse;
  const storyHere = stories.find((s) => s.id === story) ?? stories.find((s) => s.steps.some((x) => chapterOf(x.ref) === chapterRef && parseRef(x.ref).from === verse));
  const [tab, setTab] = useState<Tab>(initial ?? (research.some(atVerse) || !storyHere ? 'research' : 'stories'));
  const [openStory, setOpenStory] = useState<string | null>(storyHere?.id ?? null);
  const index = ed.deep.index;
  const ch = ed.chapterByRef.get(chapterRef);
  const counts: Record<Tab, number> = { research: research.length, stories: stories.length, links: links.length };
  const ordered = (list: DeepItem[]) => [...list.filter(atVerse), ...list.filter((i) => !atVerse(i))];

  return (
    <Sheet
      label="Deep Made Simple"
      eyebrow={
        <span className="flex items-center gap-1.5" data-testid="deep-header">
          <GlyphDeep /> Deep Made Simple · Supplementary — not Scripture
        </span>
      }
      title={ch ? `${ch.book.name} ${ch.number}` : chapterRef}
      testId="deep-sheet"
      maxHeight="88dvh"
    >
      <p className="supp text-[15px] italic text-[var(--ink-muted)]">{index?.tagline ?? 'Deep study, told plainly.'}</p>
      <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Deep Made Simple">
        {(['research', 'stories', 'links'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="tag min-h-[36px] capitalize" style={{ opacity: tab === t ? 1 : 0.55 }} data-testid={`deep-tab-${t}`}>
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      {!items.length && !stories.length && <p className="supp mt-4 italic text-[var(--ink-faint)]">Deep Made Simple does not cover this chapter yet.</p>}

      {tab === 'research' && (
        <section role="tabpanel" aria-label="Research">
          {verse !== undefined && research.some(atVerse) && <p className="label-caps mt-4 text-[10px] text-[var(--ink-faint)]">At verse {verse}</p>}
          {ordered(research).map((it, i) => (
            <div key={it.id}>
              {verse !== undefined && i === research.filter(atVerse).length && i > 0 && <p className="label-caps mt-6 text-[10px] text-[var(--ink-faint)]">Elsewhere in this chapter</p>}
              <ItemCard it={it} />
            </div>
          ))}
        </section>
      )}

      {tab === 'stories' && (
        <section role="tabpanel" aria-label="Stories">
          {!stories.length && <p className="supp mt-4 italic text-[var(--ink-faint)]">No story passes through this chapter yet.</p>}
          {stories.map((st) => (
            <div key={st.id} className="mt-3 border-t hairline pt-3 first:border-t-0">
              <button type="button" className="w-full text-left font-display text-[19px] font-medium leading-tight" aria-expanded={openStory === st.id} onClick={() => setOpenStory(openStory === st.id ? null : st.id)} data-testid={`deep-story-open-${st.id}`}>
                {st.title} <span className="supp text-[13px] italic text-[var(--ink-faint)]">· {st.steps.length} passages</span>
              </button>
              {openStory === st.id && <StoryView st={st} />}
            </div>
          ))}
        </section>
      )}

      {tab === 'links' && (
        <section role="tabpanel" aria-label="Links">
          {ordered(links).map((it) => (
            <ItemCard key={it.id} it={it} />
          ))}
        </section>
      )}

      <p className="supp mt-6 text-[12px] italic leading-snug text-[var(--ink-faint)]">
        {index?.note} Research levels: {Object.entries(DEEP_LEVEL_LABEL).map(([k, v]) => `${k} ${v.toLowerCase()}`).join(' · ')}. Links keep the connection levels.
      </p>
    </Sheet>
  );
}
