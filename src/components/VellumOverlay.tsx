'use client';
import { animate, motion, useDragControls, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { LEVEL_LABEL, LEVEL_NOTE } from '@/lib/content/editorial';
import { canonicalIndex, chapterOf, formatRef, formatRefs, parseRef, testamentOf } from '@/lib/content/refs';
import { useRefsReady } from '@/lib/library/useLibrary';
import type { CrossReference, VerseRef } from '@/lib/content/types';
import { IconClose } from './Icons';
import { typeLabel } from './MarginRail';
import { useReader } from './ReaderContext';

/** Highlights a phrase inside a verse without altering any character. */
export function MarkedText({ text, phrase }: { text: string; phrase?: string }) {
  if (!phrase) return <>{text}</>;
  const i = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="shared-phrase">{text.slice(i, i + phrase.length)}</span>
      {text.slice(i + phrase.length)}
    </>
  );
}

/**
 * ProphetPlate — who spoke the words, taken only from Scripture: the attribution in the verse,
 * and the opening verse of the prophet's book where he is named.
 */
export function ProphetPlate({ connection }: { connection: CrossReference }) {
  const { ed } = useReader();
  const p = connection.prophet;
  const ready = useRefsReady(p ? [...connection.sourceVerses, ...(p.identifiedBy ? [p.identifiedBy] : [])] : []);
  if (!p || !ready) return null;
  // The attribution is found in the KJV wording; other translations word it differently.
  const opening = p.identifiedBy ? ed.translation.verse(p.identifiedBy) : null;
  const evidenceRef = connection.sourceVerses.find((r) => ed.kjv.verse(r).text.includes(p.attribution)) ?? connection.evidence.verse;
  const short = formatRef(evidenceRef).replace(/^.* (?=\d+:)/, '');
  const book = parseRef(evidenceRef).book === 'Matt' ? 'Matthew' : formatRef(evidenceRef).replace(/ \d+:.*/, '');
  return (
    <section className="mb-6 border-b hairline pb-5" aria-label={p.name ? `Spoken by the prophet ${p.name}` : 'Spoken by the prophets'} data-testid="prophet-plate">
      <p className="label-caps text-[10px] text-[var(--bronze-deep)]">{p.name ? 'By the prophet' : 'By the prophets'}</p>
      <h3 className="mt-1 font-display text-[34px] font-medium leading-none tracking-[0.02em]" data-testid="prophet-name">
        {p.name ?? 'Not named'}
      </h3>
      <p className="supp mt-3 text-[15px] leading-snug">
        {p.namedInText ? (
          <>
            {book} names him: <span className="italic">“{p.attribution}”</span> ({short}). Jeremy is the New Testament form of the name Jeremiah. His book opens:
          </>
        ) : p.name ? (
          <>
            {book} writes <span className="italic">“{p.attribution}”</span> ({short}) without naming him. The words are found in the book of {p.name}, which opens:
          </>
        ) : (
          <>
            {book} writes <span className="italic">“{p.attribution}”</span> ({short}) and names no single prophet.
          </>
        )}
      </p>
      {opening && (
        <p className="mt-2 text-[16.5px] leading-[1.5]" style={{ textAlign: 'left' }}>
          <span className="font-display text-[13px] font-semibold tracking-[0.02em] text-[var(--ink-muted)]">{formatRef(opening.ref)}&nbsp;&nbsp;</span>
          <span data-ref={opening.ref}>
            <span data-scripture-text>
              <MarkedText text={opening.text} phrase={p.identifiedPhrase} />
            </span>
          </span>
        </p>
      )}
    </section>
  );
}

/** Marks a character range (from the pipeline, against the KJV text) without altering the text. */
function SpanText({ text, span }: { text: string; span: [number, number] }) {
  return (
    <>
      {text.slice(0, span[0])}
      <span className="shared-phrase">{text.slice(span[0], span[1])}</span>
      {text.slice(span[1])}
    </>
  );
}

function Passage({ refs, phrase, span, testId }: { refs: VerseRef[]; phrase?: string; span?: [number, number]; testId?: string }) {
  const { ed } = useReader();
  const ready = useRefsReady(refs);
  if (!ready) return <p className="supp mt-4 italic text-[var(--ink-faint)]">Opening…</p>;
  const verses = refs.flatMap((r) => ed.translation.passage(r));
  const kjv = ed.translation.translation.id === 'kjv';
  return (
    <p className="scripture mt-4" style={{ textAlign: 'left' }} data-testid={testId}>
      {verses.map((v) => (
        <span key={v.ref} data-ref={v.ref}>
          <sup className="verse-num">{v.verse}</sup>
          <span data-scripture-text>{span && kjv && verses.length === 1 ? <SpanText text={v.text} span={span} /> : <MarkedText text={v.text} phrase={kjv ? phrase : undefined} />}</span>{' '}
        </span>
      ))}
    </p>
  );
}

function TurnTo({ refId, from }: { refId: VerseRef; from?: VerseRef }) {
  const { goTo, close } = useReader();
  return (
    <button
      type="button"
      className="btn-quiet -ml-2 mt-2 px-2 text-[14px] italic"
      onClick={() => {
        goTo(chapterOf(refId), parseRef(refId).from, { keepReturn: true, returnAt: from });
        close();
      }}
      data-testid="vellum-turn-to"
    >
      Turn to {formatRef(refId)} →
    </button>
  );
}

/** CrossReferenceViewer — the other Scripture, shown verbatim, with the evidence for the link. */
export function CrossReferenceViewer({ connection, tab, setTab, reverseTarget }: { connection: CrossReference; tab: number; setTab: (n: number) => void; reverseTarget?: VerseRef }) {
  if (reverseTarget) {
    const t = connection.targets.find((x) => x.ref === reverseTarget);
    return (
      <div>
        <ProphetPlate connection={connection} />
        <section aria-label={`${formatRefs(connection.sourceVerses)}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[23px] font-medium leading-none">{formatRefs(connection.sourceVerses)}</h3>
            {connection.types.map((ty) => (
              <span key={ty} className="tag">
                {typeLabel(ty)}
              </span>
            ))}
          </div>
          <Passage refs={connection.sourceVerses} phrase={t?.nameForms ? t.nameForms[0] : t?.sharedPhrase} span={t?.anchorSpan} testId="vellum-scripture" />
          <TurnTo refId={connection.anchorVerse} from={reverseTarget} />
        </section>
        <Why connection={connection} />
      </div>
    );
  }
  const target = connection.targets[tab];
  return (
    <div>
      <ProphetPlate connection={connection} />
      {connection.targets.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1 border-b hairline" role="tablist" aria-label="Other passages">
          {connection.targets.map((t, i) => (
            <button
              key={t.ref}
              role="tab"
              aria-selected={i === tab}
              type="button"
              onClick={() => setTab(i)}
              className="relative -mb-px min-h-[44px] px-3 font-display text-[15px] transition-colors"
              style={{ color: i === tab ? 'var(--vellum-ink)' : 'var(--ink-faint)', borderBottom: i === tab ? '1.5px solid var(--bronze)' : '1.5px solid transparent' }}
            >
              {formatRef(t.ref)}
            </button>
          ))}
        </div>
      )}
      {target ? (
        <section aria-label={`${testamentOf(target.ref) === 'OT' ? 'Old Testament' : 'New Testament'}: ${formatRef(target.ref)}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[23px] font-medium leading-none">{formatRef(target.ref)}</h3>
            <span className="tag">{typeLabel(target.type)}</span>
          </div>
          <Passage refs={[target.ref]} phrase={target.nameForms ? target.nameForms[1] : target.sharedPhrase} span={target.targetSpan} testId="vellum-scripture" />
          <p className="supp mt-4 text-[14px] leading-snug">
            <span className="label-caps mr-2 text-[10px] text-[var(--ink-faint)]">{target.nameForms ? 'Name' : 'Shared wording'}</span>
            <span className="italic">{target.nameForms ? target.nameForms.map((f) => `“${f}”`).join(' / ') : `“${target.sharedPhrase}”`}</span>
          </p>
          <TurnTo refId={target.ref} from={connection.anchorVerse} />
        </section>
      ) : (
        <section aria-label="No single passage named">
          <h3 className="font-display text-[23px] font-medium leading-none">“By the prophets”</h3>
          <p className="supp mt-4 text-[16px] leading-relaxed" data-testid="vellum-note">
            {connection.unassignedNote}
          </p>
        </section>
      )}
      <Why connection={connection} />
    </div>
  );
}

function Why({ connection }: { connection: CrossReference }) {
  const { state, update } = useReader();
  const saved = state.saved.discoveries.includes(connection.id);
  const words = connection.targets[0]?.words;
  return (
    <div className="mt-6 border-t hairline pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-caps text-[10px] text-[var(--ink-faint)]">Why this mark is here</p>
        <button type="button" className="btn-quiet -mr-2 px-2 text-[13px] italic" aria-pressed={saved} onClick={() => update((s) => ({ saved: { ...s.saved, discoveries: saved ? s.saved.discoveries.filter((x) => x !== connection.id) : [...s.saved.discoveries, connection.id] } }))} data-testid="save-discovery">
          {saved ? 'Saved ✓' : 'Save this discovery'}
        </button>
      </div>
      <p className="supp mt-2 text-[15px] leading-snug">
        {formatRef(connection.evidence.verse)} reads, <span className="italic">“{connection.evidence.phrase}”</span>.
        {connection.method === 'text-match' && words ? ` The two passages share ${words} consecutive words in the KJV.` : ''}
      </p>
      <p className="mt-3 text-[14px] leading-snug" data-testid="vellum-level">
        <span className="tag mr-2">Level {connection.level}</span>
        <span className="font-display">{LEVEL_LABEL[connection.level]}</span>
        <span className="supp block text-[13px] italic">{LEVEL_NOTE[connection.level]}</span>
      </p>
      {connection.notes && <p className="supp mt-2 text-[13.5px] italic leading-snug">{connection.notes}</p>}
      <p className="supp mt-2 text-[12px] leading-snug opacity-80" data-testid="vellum-evidence-level">
        {connection.method === 'text-match' ? 'Found by shared wording (content pipeline)' : `Curated · ${connection.editorial.author}`} · {connection.editorial.status === 'draft' ? 'Draft, awaiting editorial review' : connection.editorial.status}
      </p>
    </div>
  );
}

/**
 * VellumOverlay — a translucent sheet laid over the page. The other passage is printed on it;
 * drag the sheet to read both texts together.
 */
export function VellumOverlay({ id, wide, reverseTarget }: { id: string; wide: boolean; reverseTarget?: VerseRef }) {
  const { ed, close, reduced, play } = useReader();
  const found = ed.connections.find((c) => c.id === id);
  if (!found) return null;
  return <VellumSheet connection={found} wide={wide} reverseTarget={reverseTarget} close={close} reduced={reduced} play={play} />;
}

function VellumSheet({ connection, wide, reverseTarget, close, reduced, play }: { connection: CrossReference; wide: boolean; reverseTarget?: VerseRef; close: () => void; reduced: boolean; play: (s: 'vellum') => void }) {
  const id = connection.id;
  const [tab, setTab] = useState(0);
  const controls = useDragControls();
  const [vp, setVp] = useState({ w: 390, h: 800 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => setTab(0), [id]);
  useEffect(() => play('vellum'), [id, play]);

  const sheetW = Math.min(560, Math.round(vp.w * 0.46));
  const snaps = useMemo(() => (wide ? [0, sheetW * 0.42] : [vp.h * 0.2, vp.h * 0.44, vp.h * 0.66]), [wide, sheetW, vp.h]);
  const pos = useMotionValue(wide ? sheetW : vp.h);
  const initial = wide ? snaps[0] : snaps[1];

  useEffect(() => {
    pos.set(wide ? sheetW + 40 : vp.h);
    const c = animate(pos, initial, reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 260, damping: 34, mass: 0.9 });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, wide, vp.h, sheetW]);

  const dismiss = () => {
    animate(pos, wide ? sheetW + 40 : vp.h, { duration: reduced ? 0.12 : 0.32, ease: [0.4, 0, 1, 1] }).then(close);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const v = wide ? info.velocity.x : info.velocity.y;
    const cur = pos.get();
    const limit = wide ? sheetW * 0.66 : vp.h * 0.8;
    if (cur > limit || (v > 900 && cur > snaps[snaps.length - 1] - 20)) return dismiss();
    const projected = cur + v * 0.12;
    const target = snaps.reduce((a, b) => (Math.abs(b - projected) < Math.abs(a - projected) ? b : a));
    animate(pos, target, reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 36 });
  };

  const shade = useTransform(pos, wide ? [0, sheetW] : [snaps[0], vp.h], [0.08, 0]);
  // Label the two layers by testament: the page beneath, and the sheet laid over it.
  const pageRefs = reverseTarget ? [reverseTarget] : connection.sourceVerses;
  const sheetRef = reverseTarget ? connection.anchorVerse : connection.targets[0]?.ref;
  const t = (r: VerseRef) => (testamentOf(r) === 'OT' ? 'Old Testament' : 'New Testament');
  const beneath = `${t(pageRefs[0])} · ${formatRefs(pageRefs)}`;
  const sheetLabel = sheetRef ? (reverseTarget && canonicalIndex(sheetRef) > canonicalIndex(reverseTarget) ? `${t(sheetRef)} · later` : t(sheetRef)) : 'Old Testament';

  return (
    <div className="pointer-events-none fixed inset-0 z-40" data-testid="vellum-overlay">
      <motion.div aria-hidden className="absolute inset-0 bg-black" style={{ opacity: shade }} />
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-x-0 top-[max(10px,env(safe-area-inset-top))] flex justify-center">
        <span className="tag" style={{ background: 'var(--paper)', boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }} data-testid="vellum-beneath">
          {beneath}
        </span>
      </motion.div>

      <motion.aside
        role="dialog"
        aria-modal="false"
        aria-label={`Vellum: ${sheetRef ? formatRef(sheetRef) : 'the prophets'} over ${formatRefs(pageRefs)}`}
        className={`vellum fibres pointer-events-auto absolute ${wide ? 'bottom-0 right-0 top-0 rounded-l-[4px]' : 'vellum-edge inset-x-0 top-0'} flex flex-col`}
        style={wide ? { x: pos, width: sheetW } : { y: pos, height: vp.h }}
        drag={wide ? 'x' : 'y'}
        dragConstraints={wide ? { left: 0, right: sheetW } : { top: vp.h * 0.1, bottom: vp.h }}
        dragElastic={0.06}
        dragMomentum={false}
        dragListener={false}
        dragControls={controls}
        onDragEnd={onDragEnd}
        data-testid="vellum-sheet"
      >
        <div
          className={`relative z-[1] flex items-center justify-between ${wide ? 'px-8 pt-6' : 'px-5 pt-4'}`}
          style={{ touchAction: 'none', cursor: 'grab' }}
          onPointerDown={(e) => controls.start(e)}
          data-testid="vellum-handle"
        >
          {!wide && <span aria-hidden className="absolute left-1/2 top-2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-[var(--bronze)] opacity-40" />}
          {wide && <span aria-hidden className="absolute left-2 top-1/2 h-10 w-[3px] -translate-y-1/2 rounded-full bg-[var(--bronze)] opacity-40" />}
          <div className={`flex flex-wrap items-center gap-2 pt-2 ${wide ? 'mr-auto' : ''}`}>
            <span className="label-caps text-[var(--bronze-deep)]">{sheetLabel}</span>
            {!reverseTarget &&
              connection.types.map((ty) => (
                <span key={ty} className="tag">
                  {typeLabel(ty)}
                </span>
              ))}
          </div>
          <button type="button" onClick={dismiss} className={`btn-quiet ${wide ? '-ml-3 order-first mr-2' : '-mr-2'}`} aria-label="Lay the vellum aside" data-testid="vellum-close">
            <IconClose />
          </button>
        </div>
        <div className={`scroll-quiet relative z-[1] flex-1 overflow-y-auto ${wide ? 'px-8 pb-10 pt-4' : 'px-6 pb-[40vh] pt-3'}`}>
          <CrossReferenceViewer connection={connection} tab={tab} setTab={setTab} reverseTarget={reverseTarget} />
        </div>
      </motion.aside>
    </div>
  );
}
