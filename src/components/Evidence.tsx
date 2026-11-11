'use client';
import { useState, type ReactNode } from 'react';
import { chapterOf, formatRef, parseRef, testamentOf } from '@/lib/content/refs';
import type { Certainty, FamilyLink, VerseRef } from '@/lib/content/types';
import { useRefsReady, useRegistry } from '@/lib/library/useLibrary';
import { haversineKm } from '@/lib/geo';
import { traceTribe } from '@/lib/content/tribe';
import { GlyphMemory } from './Icons';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';
import { MarkedText } from './VellumOverlay';

export const CERTAINTY_LABEL: Record<Certainty, string> = {
  HIGH: 'Location: high confidence',
  PROBABLE: 'Location: probable',
  POSSIBLE: 'Location: possible',
  DISPUTED: 'Location: disputed',
  UNKNOWN: 'Location unknown',
};
export const CERTAINTY_NOTE: Record<Certainty, string> = {
  HIGH: 'The identification is overwhelmingly supported.',
  PROBABLE: 'A clear leading identification, with some doubt.',
  POSSIBLE: 'A proposed identification with modest support.',
  DISPUTED: 'Two or more serious proposals. Each is shown.',
  UNKNOWN: 'Where this place was is not known, so it is not drawn on the map.',
};

/** A Scripture reference printed with its verbatim text (loaded on demand). */
export function RefPassage({ refId, phrase, read, compact }: { refId: VerseRef; phrase?: string; read?: boolean; compact?: boolean }) {
  const { ed, goTo, close } = useReader();
  const ready = useRefsReady([refId]);
  let verses: { ref: string; verse: number; text: string }[] = [];
  try {
    verses = ready ? ed.translation.passage(refId) : [];
  } catch {
    verses = [];
  }
  return (
    <li className={`border-t hairline ${compact ? 'py-3' : 'py-4'} first:border-t-0`} data-passage={refId}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 font-display text-[16px] font-semibold tracking-[0.02em]">
          {read && <GlyphMemory className="text-[var(--pencil)]" aria-label="You have read this" />}
          {formatRef(refId)}
        </p>
        <span className="label-caps text-[9.5px] text-[var(--ink-faint)]">{testamentOf(refId) === 'OT' ? 'Old Testament' : 'New Testament'}</span>
      </div>
      <p className={`mt-1 ${compact ? 'text-[16px]' : 'text-[17px]'} leading-[1.5]`}>
        {!ready && <span className="supp text-[14px] italic text-[var(--ink-faint)]">Opening…</span>}
        {verses.map((v) => (
          <span key={v.ref} data-ref={v.ref}>
            {verses.length > 1 && <sup className="verse-num">{v.verse}</sup>}
            <span data-scripture-text>
              <MarkedText text={v.text} phrase={phrase} />
            </span>{' '}
          </span>
        ))}
      </p>
      <button
        type="button"
        className="btn-quiet -ml-2 mt-1 min-h-[36px] px-2 text-[13px] italic"
        onClick={() => {
          goTo(chapterOf(refId), parseRef(refId).from, { keepReturn: true });
          close();
        }}
        data-testid="read-passage"
      >
        Read at {formatRef(refId)} →
      </button>
    </li>
  );
}

function Section({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <section className="mt-6" data-testid={testId}>
      <p className="label-caps text-[10px] text-[var(--ink-faint)]">{label}</p>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="tag mr-1.5 inline-block" title={title}>
      {children}
    </span>
  );
}

function Paged({ refs, render, step = 8 }: { refs: VerseRef[]; render: (r: VerseRef) => ReactNode; step?: number }) {
  const [n, setN] = useState(step);
  return (
    <>
      <ul>{refs.slice(0, n).map(render)}</ul>
      {refs.length > n && (
        <button type="button" className="btn-quiet -ml-2 px-2 text-[13px] italic" onClick={() => setN((x) => x + step * 2)}>
          More ({refs.length - n} further)
        </button>
      )}
    </>
  );
}

function SaveToggle({ kind, id }: { kind: 'places' | 'journeys' | 'threads' | 'discoveries'; id: string }) {
  const { state, update } = useReader();
  const on = state.saved[kind].includes(id);
  return (
    <button type="button" className="btn-quiet -mr-2 px-2 text-[13px] italic" aria-pressed={on} onClick={() => update((s) => ({ saved: { ...s.saved, [kind]: on ? s.saved[kind].filter((x) => x !== id) : [...s.saved[kind], id] } }))} data-testid={`save-${kind}`}>
      {on ? 'Saved ✓' : 'Save'}
    </button>
  );
}

/** PLACE — the place's history in Scripture and in this reader's journey. */
export function PlaceSheet({ id }: { id: string }) {
  const { ed, state, open, chapter } = useReader();
  const full = useRegistry('places');
  useRegistry('people');
  const place = ed.placeById.get(id);
  if (!place) return <Sheet label="Place" title="…" testId="place-sheet">{null}</Sheet>;
  const enc = state.places[id];
  const earlier = (enc?.refs ?? []).filter((r) => chapterOf(r) !== chapter.ref);
  const before = earlier.length > 0;
  const occurrences = place.verses ?? ed.occurrences.places.get(id) ?? [];
  const unread = occurrences.filter((r) => !enc?.refs.includes(r));
  const peopleHere = new Map<string, number>();
  for (const r of occurrences) for (const p of ed.entities.get(r)?.people ?? []) peopleHere.set(p, (peopleHere.get(p) ?? 0) + 1);
  const journeys = ed.journeys.flatMap((j) => j.segments.filter((s) => s.from === id || s.to === id).map((s) => ({ j, s })));

  return (
    <Sheet label={`Place: ${place.name}`} eyebrow={<>Place · {place.name}</>} title={before ? 'You have been here before.' : place.name} testId="place-sheet">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <Chip title={CERTAINTY_NOTE[place.certainty]}>{CERTAINTY_LABEL[place.certainty]}</Chip>
          <Chip>{place.kind}</Chip>
        </div>
        <SaveToggle kind="places" id={id} />
      </div>
      {place.names.length > 0 && <p className="supp mt-2 text-[14px] italic">Also named in Scripture: {place.names.slice(0, 6).join(', ')}.</p>}
      {place.modern && (
        <p className="supp mt-2 text-[15px] leading-snug" data-testid="place-identification">
          {place.certainty === 'DISPUTED' ? 'One proposal: ' : 'Identified with '}
          {place.modern}.
        </p>
      )}
      {place.certainty === 'DISPUTED' && place.alternatives.length > 0 && (
        <p className="supp mt-1 text-[14px] leading-snug">Other proposals: {place.alternatives.map((a) => a.name).join('; ')}.</p>
      )}
      <p className="supp mt-1 text-[12.5px] italic text-[var(--ink-faint)]">{CERTAINTY_NOTE[place.certainty]}</p>
      {place.identification && <p className="supp mt-2 text-[14px] leading-snug">{place.identification}</p>}
      {place.note && <p className="supp mt-2 text-[13.5px] italic leading-snug">{place.note}</p>}

      {enc && (
        <Section label="First encounter" testId="place-first-encounter">
          <p className="supp text-[14px]">
            You first read of {place.name} at <span className="italic">{formatRef(enc.first)}</span>.
          </p>
          <ul>
            <RefPassage refId={enc.first} read compact />
          </ul>
        </Section>
      )}

      {place.samePlace?.map((s) => (
        <div key={s.evidence} className="mt-4 rounded-[2px] border hairline px-4 py-3">
          <p className="label-caps text-[10px] text-[var(--bronze-deep)]">Same place · {s.label}</p>
          <p className="mt-1 text-[16px] leading-snug">
            “{s.phrase}” <span className="supp text-[13px]">— {formatRef(s.evidence)}</span>
          </p>
        </div>
      ))}

      {place.lat != null && place.certainty !== 'UNKNOWN' && (
        <button type="button" className="btn-quiet -ml-2 mt-3 px-2 text-[14px] italic" onClick={() => open({ kind: 'atlas', place: id, layer: journeys[0]?.j.id, segment: journeys[0]?.s.id })} data-testid="place-show-map">
          Show on the map →
        </button>
      )}

      {earlier.length > 1 && (
        <Section label="Where you have read of it">
          <Paged refs={earlier.slice(1)} render={(r) => <RefPassage key={r} refId={r} read compact />} step={4} />
        </Section>
      )}

      {peopleHere.size > 0 && (
        <Section label="People named with this place">
          <div className="flex flex-wrap gap-2">
            {[...peopleHere.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12)
              .map(([pid]) => (
                <button key={pid} type="button" className="min-h-[36px] rounded-full border hairline px-3 font-display text-[14px]" onClick={() => open({ kind: 'person', id: pid })}>
                  {ed.personById.get(pid)?.name ?? pid}
                </button>
              ))}
          </div>
          <p className="supp mt-2 text-[12.5px] italic">Named in the same verse as {place.name}, in the books you have opened.</p>
        </Section>
      )}

      {journeys.length > 0 && (
        <Section label="Journeys through here">
          <ul className="space-y-1">
            {journeys.map(({ j, s }) => (
              <li key={s.id}>
                <button type="button" className="flex min-h-[40px] w-full items-baseline justify-between gap-2 text-left" onClick={() => open({ kind: 'atlas', layer: j.id, segment: s.id })}>
                  <span className="font-display text-[15.5px]">
                    {j.name} <span className="text-[var(--ink-faint)]">· {s.label}</span>
                  </span>
                  <span className="supp shrink-0 text-[12px] italic">{s.certainty}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {unread.length > 0 && (
        <Section label={`${place.name} also appears in (${unread.length})`}>
          <Paged refs={unread} render={(r) => <RefPassage key={r} refId={r} compact />} />
        </Section>
      )}
      {!full && <p className="supp mt-4 text-[12.5px] italic text-[var(--ink-faint)]">Gathering every verse that names {place.name}…</p>}
      <p className="supp mt-6 text-[11.5px] italic text-[var(--ink-faint)]">Locations: OpenBible.info Bible Geocoding Data (CC BY 4.0). {place.editorial?.status === 'draft' ? 'Draft — awaiting editorial review.' : ''}</p>
    </Sheet>
  );
}

const REL: Record<string, string> = { father: 'Father', mother: 'Mother', child: 'Child', partner: 'Husband or wife', sibling: 'Brother or sister', parent: 'Parent', spouse: 'Spouse', ancestor: 'Ancestor', descendant: 'Descendant', relative: 'Relative', tribe: 'Tribe', dynasty: 'Dynasty', ruler: 'Ruler', prophet: 'Prophet' };
const BASIS: Record<FamilyLink['basis'], string> = {
  stated: 'stated in this verse',
  'named-together': 'both named here; the link itself awaits review',
  'not-identified': 'no stating verse identified yet',
};

/** PERSON — who they are in the text, their family (each link with the verse behind it), and where they appear. */
export function PersonSheet({ id }: { id: string }) {
  const { ed, state, open, chapter, goTo, close } = useReader();
  const full = useRegistry('people');
  useRegistry('places');
  useRegistry('timeline');
  const person = ed.personById.get(id);
  if (!person) return <Sheet label="Person" title="…" testId="person-sheet">{null}</Sheet>;
  const enc = state.people[id];
  const short = person.name.replace(/ \(.*\)/, '');
  const before = (enc?.refs ?? []).some((r) => chapterOf(r) !== chapter.ref);
  const passages = person.verses ?? ed.occurrences.people.get(id) ?? [];
  const places = new Map<string, number>();
  for (const r of passages) for (const h of ed.entities.get(r)?.places ?? []) places.set(h.id, (places.get(h.id) ?? 0) + 1);
  const trees = ed.genealogies.filter((g) => g.nodes.some((n) => n.person === id || (g.kind === 'line' && n.name === person.name)));
  const nameOf = (to: string) => ed.personById.get(to)?.name ?? ed.genealogy.nodes.find((n) => n.id === to)?.name ?? to;
  const tribe = full ? traceTribe(id, ed.personById) : null;
  const father = person.relationships.find((r) => r.type === 'father');
  const events = ed.timeline.filter((t) => t.people?.includes(id));
  const journeys = ed.journeys.filter((j) => j.people?.includes(id));
  const read = (r: string) => {
    goTo(chapterOf(r), parseRef(r).from, { keepReturn: true });
    close();
  };
  const links = [...person.relationships].sort((a, b) => ['father', 'mother', 'partner', 'sibling', 'child'].indexOf(a.type) - ['father', 'mother', 'partner', 'sibling', 'child'].indexOf(b.type));

  return (
    <Sheet label={`Person: ${person.name}`} eyebrow={<>Person{person.kind ? ` · ${person.kind}` : ''}</>} title={before ? `You have met ${short} before.` : person.name} testId="person-sheet">
      <section className="rounded-[2px] border hairline px-4 py-3" data-testid="person-who">
        <p className="label-caps text-[9.5px] text-[var(--ink-faint)]">Who is {short}? · supplementary</p>
        <p className="supp mt-1 text-[15px] leading-snug">
          {person.gender === 'Female' ? 'A woman' : person.gender === 'Male' ? 'A man' : 'A person'} named in {passages.length || 'several'} {passages.length === 1 ? 'verse' : 'verses'} of Scripture
          {passages[0] ? (
            <>
              , first at{' '}
              <button type="button" className="italic underline decoration-dotted" onClick={() => read(passages[0])}>
                {formatRef(passages[0])}
              </button>
            </>
          ) : null}
          .{father ? ` ${person.gender === 'Female' ? 'Daughter' : 'Son'} of ${nameOf(father.to)}.` : ''}
          {tribe ? ` Of the tribe of ${tribe.tribe}.` : ''}
        </p>
        {tribe && (
          <p className="supp mt-1.5 text-[12.5px] leading-snug text-[var(--ink-muted)]" data-testid="person-tribe">
            Tribe traced through the family links:{' '}
            {tribe.steps.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ' ← '}
                <button type="button" className="underline decoration-dotted" onClick={() => open({ kind: 'person', id: s.id })}>
                  {s.name}
                </button>
                {s.ref && (
                  <button type="button" className="ml-0.5 text-[11px] italic text-[var(--ink-faint)]" onClick={() => read(s.ref!)}>
                    ({formatRef(s.ref)})
                  </button>
                )}
              </span>
            ))}
            . From Theographic Bible Metadata; draft, awaiting review.
          </p>
        )}
        {full && !tribe && person.gender === 'Male' && <p className="supp mt-1.5 text-[12px] italic text-[var(--ink-faint)]">The family links do not trace {short} to one of the tribes of Israel.</p>}
      </section>
      {person.summary && <p className="supp mt-3 text-[15px] leading-snug">{person.summary}</p>}
      {person.also.length > 0 && <p className="supp mt-1 text-[13.5px] italic">Also named {person.also.join(', ')}.</p>}
      {enc && (
        <p className="supp mt-3 text-[14px]">
          You first met {short} at <span className="italic">{formatRef(enc.first)}</span>.
        </p>
      )}
      {trees.map((g) => (
        <button key={g.id} type="button" className="btn-quiet -ml-2 mt-1 block px-2 text-[14px] italic" onClick={() => open({ kind: 'insert', id: g.kind === 'matthew' ? (id === 'jacob' ? 'insert-sons-of-jacob' : 'insert-genealogy') : `insert-genealogy-${g.id}`, focus: g.kind === 'matthew' ? id : g.id })} data-testid="person-open-tree">
          Unfold {g.title.toLowerCase().startsWith('the') ? g.title.charAt(0).toLowerCase() + g.title.slice(1) : g.title} →
        </button>
      ))}

      {!!person.curatedRelationships?.length && (
        <Section label="Relationships, as Scripture states them" testId="person-relationships">
          <ul>
            {person.curatedRelationships.map((r, i) => (
              <li key={i} className="border-t hairline py-2.5 first:border-t-0">
                <div className="flex items-baseline justify-between gap-3">
                  <button type="button" className="text-left font-display text-[16px] font-semibold disabled:font-normal" disabled={!ed.personById.has(r.to)} onClick={() => open({ kind: 'person', id: r.to })}>
                    {nameOf(r.to)}
                  </button>
                  <span className="label-caps text-[9.5px] text-[var(--ink-faint)]">{REL[r.type]}</span>
                </div>
                <p className="mt-0.5 text-[15px] leading-snug">
                  “{r.phrase}” <span className="supp text-[12.5px]">— {formatRef(r.evidence)}</span>
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {links.length > 0 && (
        <Section label="Family" testId="person-family">
          <ul>
            {links.map((r, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 border-t hairline py-2 first:border-t-0">
                <div className="min-w-0">
                  <button type="button" className="text-left font-display text-[16px]" onClick={() => open({ kind: 'person', id: r.to })}>
                    {nameOf(r.to)}
                  </button>
                  <p className="supp text-[12.5px] italic text-[var(--ink-faint)]">
                    {r.ref ? (
                      <button type="button" className="underline decoration-dotted" onClick={() => { goTo(chapterOf(r.ref!), parseRef(r.ref!).from, { keepReturn: true }); close(); }}>
                        {formatRef(r.ref)}
                      </button>
                    ) : null}
                    {r.ref ? ' — ' : ''}
                    {BASIS[r.basis]}
                  </p>
                </div>
                <span className="label-caps shrink-0 text-[9.5px] text-[var(--ink-faint)]">{REL[r.type]}</span>
              </li>
            ))}
          </ul>
          <p className="supp mt-2 text-[12px] italic text-[var(--ink-faint)]">Family links: Theographic Bible Metadata (CC BY-SA 4.0), each checked against the KJV wording. Draft — awaiting review.</p>
        </Section>
      )}

      {journeys.length > 0 && (
        <Section label={`Follow ${short} on the map`} testId="person-journeys">
          <div className="flex flex-col gap-2">
            {journeys.map((j) => (
              <button key={j.id} type="button" className="btn-card justify-between text-left" onClick={() => open({ kind: 'atlas', layer: j.id, segment: j.segments[0]?.id })} data-testid={`person-journey-${j.id}`}>
                <span className="font-display text-[15.5px]">{j.name}</span>
                <span className="supp text-[12.5px] italic text-[var(--ink-faint)]">
                  {j.segments.length} {j.segments.length === 1 ? 'stage' : 'stages'} · {formatRef(j.segments[0].anchor)}
                </span>
              </button>
            ))}
          </div>
          <p className="supp mt-2 text-[12px] italic text-[var(--ink-faint)]">Each stage cites the verse that moves them and names the place reached; lines are explicit only where both places are reliably located.</p>
        </Section>
      )}

      {events.length > 0 && (
        <Section label={`${short} in the story`} testId="person-events">
          <ul>
            {events.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 border-t hairline py-2 first:border-t-0">
                <button type="button" className="text-left font-display text-[15.5px]" onClick={() => read(t.refs[0])}>
                  {t.label}
                </button>
                <span className="supp shrink-0 text-[12px] italic text-[var(--ink-faint)]">{formatRef(t.refs[0])}</span>
              </li>
            ))}
          </ul>
          <p className="supp mt-2 text-[12px] italic text-[var(--ink-faint)]">Events: Theographic Bible Metadata (CC BY-SA 4.0). Supplementary — not Scripture.</p>
        </Section>
      )}

      {places.size > 0 && (
        <Section label="Places named with them">
          <div className="flex flex-wrap gap-2">
            {[...places.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12)
              .map(([pid]) => (
                <button key={pid} type="button" className="min-h-[36px] rounded-full border hairline px-3 font-display text-[14px]" onClick={() => open({ kind: 'place', id: pid })}>
                  {ed.placeById.get(pid)?.name ?? pid}
                </button>
              ))}
          </div>
        </Section>
      )}

      {passages.length > 0 && (
        <Section label={`Where ${short} is named (${passages.length})`}>
          <Paged refs={passages} render={(r) => <RefPassage key={r} refId={r} read={enc?.refs.includes(r)} compact />} />
        </Section>
      )}
      {!full && <p className="supp mt-4 text-[12.5px] italic text-[var(--ink-faint)]">Gathering every verse that names {short}…</p>}
    </Sheet>
  );
}

/** PHRASE — the same wording elsewhere in Scripture. */
export function PhraseSheet({ id }: { id: string }) {
  const { ed, state } = useReader();
  const ph = ed.phrases.find((p) => p.id === id)!;
  const enc = state.phrases[id];
  const refs = ed.occurrences.phrases.get(id) ?? [];
  return (
    <Sheet label={`Phrase: ${ph.phrase}`} eyebrow={ph.type === 'TIME' ? 'Time · Repeated phrase' : enc && enc.refs.length > 1 ? 'You have seen this phrase before' : 'Repeated phrase'} title={`“${ph.phrase}”`} testId="phrase-sheet" light>
      <p className="supp text-[14px]">The words “{ph.phrase}” appear in {refs.length} verses:</p>
      <Paged refs={refs} render={(r) => <RefPassage key={r} refId={r} phrase={ph.phrase} read={enc?.refs.includes(r)} compact />} />
    </Sheet>
  );
}

export const distanceKm = (a: { lat: number | null; lon: number | null }, b: { lat: number | null; lon: number | null }) =>
  a.lat == null || b.lat == null || a.lon == null || b.lon == null ? null : haversineKm({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
