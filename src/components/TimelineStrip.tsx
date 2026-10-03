'use client';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chapterOf, formatRef, parseRef } from '@/lib/content/refs';
import type { TimelineEvent } from '@/lib/content/types';
import { useRegistry } from '@/lib/library/useLibrary';
import { IconClose } from './Icons';
import { useReader } from './ReaderContext';

const START = -4100;
const END = 110;
const ZOOMS = [0.14, 0.45, 1.3];
const fmt = (y: number) => (y < 0 ? `${-y} BC` : `AD ${y}`);

const STYLE: Record<string, { fill: string; dash?: string; opacity: number }> = {
  'Biblically explicit': { fill: 'var(--ink)', opacity: 0.9 },
  'Historically established': { fill: 'var(--bronze-deep)', opacity: 0.85 },
  Approximate: { fill: 'var(--bronze)', dash: '4 3', opacity: 0.55 },
  'Scholarly estimate': { fill: 'var(--ink-faint)', dash: '1.5 3', opacity: 0.45 },
  'Traditional chronology': { fill: 'var(--pencil)', dash: '2 2', opacity: 0.5 },
};

/**
 * TimelineStrip — a strip of paper slipped into the Bible. Two kinds of dating are kept apart:
 * curated anchors (each with its own certainty) and a traditional chronology (Ussher-based,
 * model-dependent) for events across the whole Bible. Neither is presented as Scripture.
 */
export function TimelineStrip() {
  const { ed, chapter, close, reduced, goTo, open } = useReader();
  const ready = useRegistry('timeline');
  useRegistry('people');
  const [zoom, setZoom] = useState(1);
  const [traditional, setTraditional] = useState(true);
  const [list, setList] = useState(false);
  const [filter, setFilter] = useState('');
  const PX = ZOOMS[zoom];
  const x = (year: number) => (year - START) * PX;
  const curated = ed.timeline.filter((t) => t.origin === 'curated' && t.dateStart != null);
  const trad = ed.timeline.filter((t) => t.origin !== 'curated' && t.dateStart != null);
  const undated = ed.timeline.filter((t) => t.dateStart == null);
  const here = ed.timeline.find((t) => t.origin === 'curated' && t.refs.some((r) => chapterOf(r) === chapter.ref)) ?? ed.timeline.find((t) => t.refs.some((r) => chapterOf(r) === chapter.ref)) ?? (chapter.year != null ? [...trad].sort((a, b) => Math.abs(a.dateStart! - chapter.year!) - Math.abs(b.dateStart! - chapter.year!))[0] : undefined);
  const [sel, setSel] = useState<TimelineEvent | null>(null);
  const cur = sel ?? here ?? curated[0] ?? trad[0];
  const strip = useRef<HTMLDivElement>(null);

  const lanes = useMemo(() => {
    const ends: number[] = [];
    const out = new Map<string, number>();
    for (const t of [...curated].sort((a, b) => a.dateStart! - b.dateStart!)) {
      const w = Math.max((t.dateEnd! - t.dateStart!) * PX, 6) + 150;
      const x0 = (t.dateStart! - START) * PX;
      let lane = ends.findIndex((e) => e < x0);
      if (lane < 0) lane = ends.length;
      ends[lane] = x0 + w;
      out.set(t.id, lane);
    }
    return out;
  }, [curated, PX]);
  const laneCount = Math.max(1, ...[...lanes.values()].map((l) => l + 1));
  const tradY = laneCount * 34 + 18;
  const axisY = tradY + (traditional ? 40 : 6);

  useEffect(() => {
    const el = strip.current;
    if (el && cur?.dateStart != null) el.scrollTo({ left: Math.max(0, x(cur.dateStart) - el.clientWidth / 3), behavior: reduced ? 'auto' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id, reduced, zoom, ready]);

  const step = zoom === 0 ? 500 : zoom === 1 ? 250 : 100;
  const ticks: number[] = [];
  for (let y = Math.ceil(START / step) * step; y <= END; y += step) ticks.push(y);
  const shown = [...ed.timeline].filter((t) => (traditional || t.origin === 'curated') && t.label.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => (a.dateStart ?? 1e9) - (b.dateStart ?? 1e9));

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-8" data-testid="timeline-strip">
      <motion.div aria-hidden className="absolute inset-0 bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="Timeline strip"
        className="insert-stock grain relative flex max-h-[92dvh] w-full max-w-[1100px] flex-col rounded-t-[4px] md:rounded-[2px]"
        initial={reduced ? { opacity: 0 } : { y: '60%', opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { y: '70%', opacity: 0 }}
        transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 220, damping: 30 }}
      >
        <div className="relative z-[1] flex items-start justify-between px-5 pt-4 md:px-8">
          <div>
            <p className="label-caps text-[10px] text-[var(--ink-muted)]">Timeline strip · supplementary, not Scripture</p>
            <h2 className="font-display text-[26px] font-medium leading-tight">From the beginning to the apostles</h2>
          </div>
          <div className="flex items-center">
            <button type="button" className="btn-quiet px-3 text-[13px] italic" onClick={() => setList((l) => !l)} aria-pressed={list} data-testid="timeline-list-toggle">
              {list ? 'Strip' : 'As a list'}
            </button>
            <button type="button" className="btn-quiet" onClick={close} aria-label="Return the timeline" data-testid="timeline-close">
              <IconClose />
            </button>
          </div>
        </div>
        <div className="relative z-[1] flex flex-wrap items-center gap-2 px-5 pt-2 md:px-8">
          <button type="button" role="switch" aria-checked={traditional} onClick={() => setTraditional((t) => !t)} className="min-h-[34px] rounded-full border hairline px-3 font-display text-[13px]" style={{ background: traditional ? 'var(--ink)' : 'transparent', color: traditional ? 'var(--paper)' : 'var(--ink-muted)' }} data-testid="timeline-traditional">
            Traditional chronology
          </button>
          {!list && (
            <div role="radiogroup" aria-label="Zoom" className="flex rounded-full border hairline p-0.5">
              {['Ages', 'Centuries', 'Decades'].map((z, i) => (
                <button key={z} type="button" role="radio" aria-checked={zoom === i} onClick={() => setZoom(i)} className="min-h-[30px] rounded-full px-3 font-display text-[12.5px]" style={{ background: zoom === i ? 'var(--ink)' : 'transparent', color: zoom === i ? 'var(--paper)' : 'var(--ink-muted)' }}>
                  {z}
                </button>
              ))}
            </div>
          )}
          {list && <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter events" aria-label="Filter events" className="min-h-[34px] flex-1 rounded-full border hairline bg-transparent px-3 font-display text-[14px] outline-none" />}
        </div>
        {traditional && <p className="supp relative z-[1] px-5 pt-1 text-[11.5px] italic leading-snug text-[var(--ink-muted)] md:px-8">{ed.traditionalNote}</p>}

        {!ready && <p className="supp relative z-[1] px-8 py-8 italic">Unrolling the timeline…</p>}
        {ready && list && (
          <ol className="scroll-quiet relative z-[1] overflow-y-auto px-5 pb-6 md:px-8" data-testid="timeline-list">
            {shown.map((t) => (
              <li key={t.id} className="border-t hairline py-2">
                <button type="button" className="w-full text-left" onClick={() => { setSel(t); setList(false); }}>
                  <span className="font-display text-[16px]">{t.label}</span>
                  <span className="supp ml-2 text-[13px]">
                    {t.dateStart != null ? `${fmt(t.dateStart)}${t.dateEnd !== t.dateStart ? ` – ${fmt(t.dateEnd!)}` : ''}` : 'dates not stated'} · {t.certainty}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {ready && !list && (
          <>
            <div ref={strip} className="scroll-quiet relative z-[1] mt-2 overflow-x-auto px-5 md:px-8" tabIndex={0} aria-label="Timeline, scroll sideways">
              <svg width={x(END) + 60} height={axisY + 28} role="img" aria-label="Timeline. Use “As a list” for a text version.">
                <line x1={0} x2={x(END)} y1={axisY} y2={axisY} stroke="var(--rule)" />
                {ticks.map((y) => (
                  <g key={y}>
                    <line x1={x(y)} x2={x(y)} y1={0} y2={axisY + 4} stroke="var(--rule)" strokeDasharray="2 4" />
                    <text x={x(y)} y={axisY + 20} textAnchor="middle" className="map-label" style={{ fontSize: 11, fill: 'var(--ink-muted)' }}>
                      {y === 0 ? 'BC | AD' : fmt(y)}
                    </text>
                  </g>
                ))}
                {curated.map((t) => {
                  const lane = lanes.get(t.id)!;
                  const st = STYLE[t.certainty] ?? STYLE.Approximate;
                  const x0 = x(t.dateStart!);
                  const w = Math.max((t.dateEnd! - t.dateStart!) * PX, 6);
                  const y = lane * 34 + 8;
                  const active = cur?.id === t.id;
                  return (
                    <g key={t.id} role="button" tabIndex={0} aria-label={`${t.label}, ${fmt(t.dateStart!)} to ${fmt(t.dateEnd!)}, ${t.certainty}`} onClick={() => setSel(t)} onKeyDown={(e) => e.key === 'Enter' && setSel(t)} style={{ cursor: 'pointer' }} data-testid={`timeline-item-${t.id}`}>
                      <rect x={x0} y={y} width={w} height={10} rx={2} fill={st.fill} opacity={st.opacity} stroke={active ? 'var(--bronze-deep)' : 'none'} strokeWidth={active ? 2 : 0} strokeDasharray={st.dash} />
                      <text x={x0 + w + 6} y={y + 9} className="map-label" style={{ fontSize: 13, fontWeight: active ? 600 : 400, fill: 'var(--ink)' }}>
                        {t.label}
                      </text>
                      {here?.id === t.id && (
                        <text x={x0} y={y - 2} className="map-label" style={{ fontSize: 10, fontStyle: 'italic', fill: 'var(--bronze-deep)' }}>
                          you are reading here
                        </text>
                      )}
                    </g>
                  );
                })}
                {traditional &&
                  trad.map((t) => {
                    const active = cur?.id === t.id;
                    const x0 = x(t.dateStart!);
                    return (
                      <g key={t.id} role="button" tabIndex={-1} onClick={() => setSel(t)} style={{ cursor: 'pointer' }} data-testid={`timeline-trad-${t.id}`}>
                        <rect x={x0 - 1} y={tradY} width={Math.max(2, (t.dateEnd! - t.dateStart!) * PX)} height={active ? 16 : 10} fill={active ? 'var(--bronze-deep)' : 'var(--pencil)'} opacity={active ? 0.9 : 0.35} />
                        {active && (
                          <text x={x0 + 4} y={tradY + 28} className="map-label" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--ink)' }}>
                            {t.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
              </svg>
            </div>
            <div className="relative z-[1] flex flex-wrap gap-x-4 gap-y-1 px-5 pt-1 font-display text-[11px] italic text-[var(--ink-muted)] md:px-8" aria-label="Certainty legend">
              {Object.entries(STYLE).map(([k, s]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <svg width="18" height="8" aria-hidden>
                    <rect x="0" y="1" width="18" height="6" rx="1.5" fill={s.fill} opacity={s.opacity} />
                  </svg>
                  {k}
                </span>
              ))}
            </div>
          </>
        )}

        {cur && (
          <motion.div key={cur.id} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="sheet relative z-[1] mx-3 mb-[max(12px,env(safe-area-inset-bottom))] mt-3 rounded-[3px] px-5 py-4 md:mx-8 md:mb-6" data-testid="timeline-detail">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-[21px] font-medium">{cur.label}</h3>
              <span className="tag" data-testid="timeline-certainty">
                {cur.certainty}
              </span>
            </div>
            <p className="supp text-[13.5px]">{cur.dateStart != null ? `${fmt(cur.dateStart)}${cur.dateEnd !== cur.dateStart ? ` – ${fmt(cur.dateEnd!)}` : ''}` : 'Length stated; dates not stated'}</p>
            {cur.note && <p className="supp mt-2 text-[14.5px] leading-snug">{cur.note}</p>}
            {cur.origin !== 'curated' && <p className="supp mt-1 text-[12px] italic text-[var(--ink-faint)]">Date from a traditional chronology — model-dependent.</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cur.refs.map((r) => (
                <button key={r} type="button" className="min-h-[34px] rounded-full border hairline px-3 font-display text-[13.5px] italic" onClick={() => { goTo(chapterOf(r), parseRef(r).from, { keepReturn: true }); close(); }}>
                  Read {formatRef(r)}
                </button>
              ))}
              {cur.people?.filter((p) => ed.personById.has(p)).slice(0, 6).map((p) => (
                <button key={p} type="button" className="min-h-[34px] rounded-full border hairline px-3 font-display text-[13.5px]" onClick={() => open({ kind: 'person', id: p })}>
                  {ed.personById.get(p)!.name}
                </button>
              ))}
            </div>
            {undated.length > 0 && !list && (
              <p className="supp mt-3 text-[12px] italic">
                Also: {undated.map((u) => u.label).join('; ')} — {undated[0].note}
              </p>
            )}
          </motion.div>
        )}
      </motion.section>
    </div>
  );
}
