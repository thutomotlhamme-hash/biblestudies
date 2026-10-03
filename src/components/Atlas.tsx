'use client';
import { animate, motion, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chapterOf, formatRef, formatRefs, parseRef } from '@/lib/content/refs';
import { useRefsReady, useRegistry } from '@/lib/library/useLibrary';
import type { Journey, JourneySegment, MapBase, RouteCertainty } from '@/lib/content/types';
import { CERTAINTY_LABEL, distanceKm } from './Evidence';
import { GlyphCompass, GlyphMemory, IconChevron, IconClose } from './Icons';
import { useReader } from './ReaderContext';

type VB = [number, number, number, number];

/** Fit points into the part of the sheet left clear by the header and the card (`band` of the height, centred at `center`). */
function boxOf(points: [number, number][], aspect: number, band: number, center: number, pad = 1.35, min = 120): VB {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  let w = Math.max(x1 - x0, min) * pad;
  let h = (Math.max(y1 - y0, min) * pad) / band;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h * center, w, h];
}

const segPoints = (map: MapBase, s: JourneySegment) => {
  const g = map.segments[s.id];
  if (!g) return [] as [number, number][];
  const pts: [number, number][] = [g.start, g.end];
  for (const m of g.d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)) pts.push([+m[1], +m[2]]);
  return pts;
};

const DASH: Record<RouteCertainty, (s: number) => string | undefined> = {
  explicit: () => undefined,
  approximate: (s) => `${7 * s} ${5 * s}`,
  reconstructed: (s) => `${0.01 * s} ${4.2 * s}`,
};
const CERTAINTY_NAME: Record<RouteCertainty, string> = { explicit: 'Explicit', approximate: 'Approximate', reconstructed: 'Reconstructed' };

/**
 * Atlas — the persistent biblical map, still a folded sheet inside the Bible. It shows the places
 * this reader has met, where they are now, and the journeys as layers with route certainty.
 */
export function Atlas(props: { layer?: string; segment?: string; focusPlace?: string }) {
  const { ed, close, reduced } = useReader();
  const mapReady = useRegistry('map');
  useRegistry('places');
  if (!mapReady || !ed.map || !ed.journeys.length) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center" data-testid="journey-map">
        <motion.div aria-hidden className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.15 }} className="map-sheet relative rounded-[3px] px-8 py-6 font-display text-[16px] italic text-[var(--map-ink)]" role="status">
          Unfolding the atlas…
        </motion.p>
      </div>
    );
  }
  return <AtlasSheet {...props} map={ed.map} />;
}

function AtlasSheet({ layer, segment, focusPlace, map }: { layer?: string; segment?: string; focusPlace?: string; map: MapBase }) {
  const { ed, state, chapter, close, reduced, goTo, play, open, update } = useReader();
  const { journeys, places } = ed;
  const [everyPlace, setEveryPlace] = useState(false);
  const eraLayer = (journeys.find((j) => j.segments.some((s) => chapterOf(s.anchor) === chapter.ref)) ?? journeys.find((j) => j.era === chapter.era))?.id;
  const [active, setActive] = useState<string>(layer ?? eraLayer ?? journeys[0].id);
  const [enabled, setEnabled] = useState<Set<string>>(() => {
    const s = new Set<string>([layer ?? eraLayer ?? journeys[0].id]);
    for (const j of journeys) if (j.segments.some((sg) => (sg.to && state.places[sg.to]) || (sg.from && state.places[sg.from]))) s.add(j.id);
    return s;
  });
  const activeJourney = journeys.find((j) => j.id === active) as Journey;
  const [idx, setIdx] = useState(() => Math.max(0, activeJourney.segments.findIndex((s) => s.id === segment)));
  const [mode, setMode] = useState<'segment' | 'all' | 'place'>(focusPlace && !segment ? 'place' : segment || layer || eraLayer ? 'segment' : 'all');
  const [listView, setListView] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(0.75);
  const svg = useRef<SVGSVGElement>(null);
  const vb = useMotionValue(`0 0 ${map.width} ${map.height}`);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAspect(el.clientWidth / Math.max(1, el.clientHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [listView]);
  useEffect(() => play('unfold'), [play]);

  const seg = activeJourney.segments[Math.min(idx, activeJourney.segments.length - 1)];
  // the clear band between the header and the card, as fractions of the sheet height
  const [band, center] = aspect < 0.8 ? [0.26, 0.31] : aspect < 1.2 ? [0.42, 0.36] : [0.6, 0.44];

  // Where the reader is now: the last place named at or before the current verse in this chapter.
  const current = useMemo(() => {
    for (let v = state.position.verse; v >= 1; v--) {
      const hits = ed.entities.get(`${chapter.ref}.${v}`)?.places ?? [];
      const located = hits.filter((h) => map.places[h.id]);
      if (located.length) return located[located.length - 1].id;
    }
    const last = [...state.journeyHistory].reverse().find((h) => map.places[h.placeId]);
    return last?.placeId ?? null;
  }, [state.position.verse, state.journeyHistory, chapter.ref, ed, map]);

  const target = useMemo<VB>(() => {
    if (mode === 'place' && focusPlace && map.places[focusPlace]) return boxOf([map.places[focusPlace], ...(map.alternatives?.[focusPlace] ?? [])], aspect, band, center, 1.2, 140);
    if (mode === 'all') {
      const pts = journeys.filter((j) => enabled.has(j.id)).flatMap((j) => j.segments.flatMap((s) => segPoints(map, s)));
      return boxOf(pts.length ? pts : [[0, 0], [map.width, map.height]], aspect, band, center, 1.1, 160);
    }
    const pts = segPoints(map, seg);
    const fallback = [seg.from, seg.to].map((id) => (id ? map.places[id] : undefined)).filter(Boolean) as [number, number][];
    return boxOf(pts.length ? pts : fallback.length ? fallback : [[map.width / 2, map.height / 2]], aspect, band, center, 1.35, 70);
  }, [mode, focusPlace, map, aspect, band, center, journeys, enabled, seg]);

  // The sheet opens already framed on its subject; later changes glide from view to view.
  const currentBox = useRef<VB | null>(null);
  useEffect(() => {
    if (!currentBox.current) {
      currentBox.current = target;
      vb.set(target.join(' '));
      return;
    }
    const from = currentBox.current;
    const c = animate(0, 1, {
      duration: reduced ? 0 : 0.6,
      ease: [0.45, 0, 0.15, 1],
      onUpdate: (t) => {
        const v = from.map((f, i) => f + (target[i] - f) * t) as VB;
        currentBox.current = v;
        vb.set(v.join(' '));
      },
    });
    return () => c.stop();
  }, [target, reduced, vb]);

  useMotionValueEvent(vb, 'change', (v) => {
    svg.current?.setAttribute('viewBox', v);
    const s = Math.max(0.25, Math.min(2.2, Number(v.split(' ')[2]) / 1000));
    // re-render the labels only when the zoom has changed noticeably (every frame would stutter)
    setScale((p) => (Math.abs(p - s) / p > 0.12 ? s : p));
  });

  const toggleLayer = (id: string) => {
    setEnabled((s) => {
      const n = new Set(s);
      if (n.has(id) && id !== active) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const choose = (id: string) => {
    setActive(id);
    setEnabled((s) => new Set(s).add(id));
    setIdx(0);
    setMode('segment');
    play('tap');
  };
  const step = (d: number) => {
    setMode('segment');
    setIdx((i) => Math.min(activeJourney.segments.length - 1, Math.max(0, i + d)));
    play('tap');
  };

  const lastRef = seg.verses[seg.verses.length - 1];
  const verseReady = useRefsReady([lastRef]);
  const verseText = verseReady ? ed.translation.verse(lastRef) : null;
  const pf = seg.from ? ed.placeById.get(seg.from) : undefined;
  const pt = seg.to ? ed.placeById.get(seg.to) : undefined;
  const km = pf && pt ? distanceKm(pf, pt) : null;
  const savedJourney = state.saved.journeys.includes(activeJourney.id);
  const placeName = (id: string | null, label?: string) => (id ? places.find((p) => p.id === id)?.name : label) ?? '';
  const inActive = new Set(activeJourney.segments.flatMap((s) => [s.from, s.to]).filter(Boolean) as string[]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" data-testid="journey-map">
      <motion.div aria-hidden className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="Atlas — the biblical world of this journey"
        className="map-sheet relative flex h-[100dvh] w-full flex-col overflow-hidden md:h-[90vh] md:max-w-[1180px] md:rounded-[3px]"
        style={{ transformOrigin: '12% 100%', boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6)' }}
        initial={reduced ? { opacity: 0 } : { scaleX: 0.1, scaleY: 0.06, opacity: 0.7 }}
        animate={reduced ? { opacity: 1 } : { scaleX: [0.1, 1, 1], scaleY: [0.06, 0.06, 1], opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { scaleY: 0.06, opacity: 0, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
        transition={{ duration: reduced ? 0.12 : 0.5, times: [0, 0.45, 1], ease: [0.45, 0, 0.15, 1] }}
      >
        <header className="relative z-[3] px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))] md:px-8 md:pt-6" style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--map-sea) 94%, transparent) 70%, transparent)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="label-caps text-[var(--map-ink)] opacity-70">The Atlas</p>
              <h2 className="font-display text-[24px] font-medium leading-tight text-[var(--map-ink)]">{mode === 'all' ? 'All journeys shown' : activeJourney.name}</h2>
            </div>
            <div className="flex items-center">
              <button type="button" className="btn-quiet hidden px-2.5 text-[13px] italic sm:inline-flex" style={{ color: 'var(--map-ink)' }} onClick={() => setEveryPlace((v) => !v)} aria-pressed={everyPlace} data-testid="atlas-every-place">
                {everyPlace ? 'Fewer places' : 'Every place'}
              </button>
              <button type="button" className="btn-quiet px-2.5 text-[13px] italic" style={{ color: 'var(--map-ink)' }} onClick={() => update((s) => ({ saved: { ...s.saved, journeys: savedJourney ? s.saved.journeys.filter((x) => x !== activeJourney.id) : [...s.saved.journeys, activeJourney.id] } }))} aria-pressed={savedJourney} data-testid="save-journey">
                {savedJourney ? 'Saved ✓' : 'Save'}
              </button>
              <button type="button" className="btn-quiet px-2.5 text-[13px] italic" style={{ color: 'var(--map-ink)' }} onClick={() => setListView((v) => !v)} aria-pressed={listView} data-testid="atlas-list-toggle">
                {listView ? 'Map' : 'As a list'}
              </button>
              <button type="button" className="btn-quiet px-2.5 text-[13px] italic" style={{ color: 'var(--map-ink)' }} onClick={() => setMode((m) => (m === 'all' ? 'segment' : 'all'))} aria-pressed={mode === 'all'} data-testid="map-overview">
                {mode === 'all' ? 'Follow the route' : 'Whole journey'}
              </button>
              <button type="button" className="btn-quiet" style={{ color: 'var(--map-ink)' }} onClick={close} aria-label="Fold the map away" data-testid="map-close">
                <IconClose />
              </button>
            </div>
          </div>
          <div className="scroll-quiet -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Journey layers">
            {journeys.map((j) => {
              const on = enabled.has(j.id);
              const isActive = j.id === active;
              return (
                <span key={j.id} className="flex shrink-0 items-stretch overflow-hidden rounded-full border" style={{ borderColor: isActive ? 'var(--bronze-deep)' : 'color-mix(in srgb, var(--map-ink) 30%, transparent)' }}>
                  <button type="button" role="switch" aria-checked={on} aria-label={`Show ${j.name} layer`} onClick={() => toggleLayer(j.id)} className="flex min-h-[34px] w-8 items-center justify-center" data-testid={`layer-toggle-${j.id}`}>
                    <span className="block h-2.5 w-2.5 rounded-full border" style={{ borderColor: 'var(--map-ink)', background: on ? (isActive ? 'var(--bronze-deep)' : 'var(--map-ink)') : 'transparent' }} />
                  </button>
                  <button type="button" onClick={() => choose(j.id)} className="min-h-[34px] pr-3 font-display text-[13.5px]" style={{ color: 'var(--map-ink)', fontWeight: isActive ? 600 : 400 }} data-testid={`layer-${j.id}`}>
                    {j.name}
                  </button>
                </span>
              );
            })}
          </div>
        </header>

        {listView ? (
          <div className="scroll-quiet relative z-[2] flex-1 overflow-y-auto px-5 pb-10 md:px-8" data-testid="atlas-list">
            {journeys.map((j) => (
              <section key={j.id} className="mt-5">
                <h3 className="label-caps text-[var(--map-ink)]">{j.name}</h3>
                <ol className="mt-1">
                  {j.segments.map((s) => (
                    <li key={s.id} className="border-t border-[color-mix(in_srgb,var(--map-ink)_18%,transparent)] py-2 text-[var(--map-ink)]">
                      <p className="font-display text-[16px]">
                        {s.label} <span className="text-[13px] italic opacity-70">— {CERTAINTY_NAME[s.certainty]}</span>
                      </p>
                      <p className="font-display text-[13px] opacity-80">
                        {placeName(s.from, s.fromLabel)} → {placeName(s.to, s.toLabel)} · {formatRefs(s.verses)}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            <section className="mt-6">
              <h3 className="label-caps text-[var(--map-ink)]">Places you have met</h3>
              <ul className="mt-1 font-display text-[15px] text-[var(--map-ink)]">
                {state.journeyHistory.map((h) => (
                  <li key={h.placeId}>
                    {places.find((p) => p.id === h.placeId)?.name} — first at {formatRef(h.ref)}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <>
            <div ref={box} className="absolute inset-0">
              <svg ref={svg} viewBox={`0 0 ${map.width} ${map.height}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={`Map of the journeys. ${mode === 'all' ? 'All enabled journeys.' : seg.label}. Use “As a list” for a text version.`}>
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M0 1 9 5 0 9 2.5 5z" fill="var(--bronze-deep)" />
                  </marker>
                  <filter id="paper" x="0" y="0" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" />
                    <feColorMatrix values="0 0 0 0 0.45 0 0 0 0 0.36 0 0 0 0 0.22 0 0 0 0.08 0" />
                    <feComposite in2="SourceGraphic" operator="in" />
                  </filter>
                </defs>
                <g opacity={0.35}>
                  {map.graticule.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke="var(--map-ink)" strokeWidth={0.4 * scale} strokeDasharray={`${2 * scale} ${3 * scale}`} />
                  ))}
                </g>
                {[14, 6].map((w, i) => (
                  <path key={w} d={map.land} fill="none" stroke="var(--map-ink)" strokeOpacity={0.05 + i * 0.03} strokeWidth={w * scale} />
                ))}
                <path d={map.land} fill="var(--map-land)" stroke="var(--map-ink)" strokeWidth={0.9 * scale} />
                {Object.entries(map.lakes).map(([k, d]) => (
                  <path key={k} d={d} fill="var(--map-sea)" stroke="var(--map-ink)" strokeWidth={0.7 * scale} />
                ))}
                {Object.entries(map.rivers).map(([k, d]) => (
                  <path key={k} d={d} fill="none" stroke="var(--map-ink)" strokeOpacity={0.55} strokeWidth={1 * scale} />
                ))}
                {map.labels.map((l) => (
                  <text
                    key={l.text}
                    x={l.xy[0]}
                    y={l.xy[1]}
                    textAnchor="middle"
                    className="map-label"
                    style={{ fontSize: (l.kind === 'sea' ? 22 : l.kind === 'region' ? 17 : l.kind === 'water' ? 11 : 12) * scale, letterSpacing: l.kind === 'water' ? '0.04em' : '0.34em', fontStyle: l.kind === 'water' || l.kind === 'sea' ? 'italic' : 'normal', opacity: l.kind === 'region-minor' ? 0.4 : l.kind === 'water' ? 0.6 : 0.55 }}
                  >
                    {l.text}
                    {l.sub && (
                      <tspan x={l.xy[0]} dy={18 * scale} style={{ fontSize: 12 * scale, letterSpacing: '0.1em' }}>
                        {l.sub}
                      </tspan>
                    )}
                  </text>
                ))}
                {/* journeys */}
                {journeys
                  .filter((j) => enabled.has(j.id))
                  .map((j) =>
                    j.segments.map((s, i) => {
                      const isAct = j.id === active;
                      const state2 = mode === 'all' || !isAct ? 'rest' : i < idx ? 'done' : i === idx ? 'current' : i === idx + 1 ? 'next' : 'later';
                      if (state2 === 'later' || !map.segments[s.id]) return null;
                      const d = map.segments[s.id].d;
                      const dash = state2 === 'next' ? `${1 * scale} ${5 * scale}` : DASH[s.certainty](scale);
                      return (
                        <g key={s.id + (state2 === 'current' ? `-${idx}` : '')} data-testid={`route-${s.id}`} data-certainty={s.certainty}>
                          {state2 === 'current' && <path d={d} fill="none" stroke="var(--map-land)" strokeWidth={6 * scale} opacity={0.7} strokeLinecap="round" />}
                          <motion.path
                            d={d}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            stroke={isAct ? 'var(--bronze-deep)' : 'var(--map-ink)'}
                            strokeWidth={(state2 === 'current' ? 2.3 : isAct ? 1.6 : 1.2) * scale}
                            strokeDasharray={dash}
                            markerEnd={state2 === 'current' ? 'url(#arrow)' : undefined}
                            opacity={state2 === 'rest' ? (isAct ? 0.85 : 0.45) : state2 === 'done' ? 0.55 : state2 === 'next' ? 0.55 : 1}
                            initial={state2 === 'current' && !reduced && !dash ? { pathLength: 0 } : false}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.85, ease: [0.45, 0, 0.2, 1], delay: 0.15 }}
                          />
                        </g>
                      );
                    }),
                  )}
                {/* regions named without a single point */}
                {places
                  .filter((p) => p.kind === 'region' && map.places[p.id] && (state.places[p.id] || inActive.has(p.id)))
                  .map((p) => (
                    <ellipse key={p.id} cx={map.places[p.id][0]} cy={map.places[p.id][1]} rx={34} ry={22} fill={current === p.id ? 'rgba(154,116,64,0.10)' : 'none'} stroke={current === p.id ? 'var(--bronze-deep)' : 'var(--map-ink)'} strokeWidth={(current === p.id ? 1.5 : 0.8) * scale} strokeDasharray={`${3 * scale} ${4 * scale}`} opacity={0.55} data-testid={`map-region-${p.id}`} />
                  ))}
                {/* every located place, quietly, when asked for */}
                {everyPlace &&
                  places
                    .filter((p) => map.places[p.id] && p.kind !== 'region')
                    .map((p) => (
                      <g key={'e' + p.id} onClick={() => open({ kind: 'place', id: p.id })} style={{ cursor: 'pointer' }}>
                        <circle cx={map.places[p.id][0]} cy={map.places[p.id][1]} r={1.8 * scale} fill="var(--map-ink)" opacity={p.certainty === 'HIGH' ? 0.55 : 0.3} />
                        {scale < 0.35 && (
                          <text x={map.places[p.id][0] + 3 * scale} y={map.places[p.id][1] + 3 * scale} className="map-label" style={{ fontSize: 9 * scale, opacity: 0.65 }}>
                            {p.name}
                          </text>
                        )}
                      </g>
                    ))}
                {/* disputed locations: each serious proposal is shown, joined by a dotted line */}
                {focusPlace &&
                  map.alternatives?.[focusPlace]?.map((xy, i) => (
                    <g key={'alt' + i} data-testid="map-alternative">
                      <path d={`M${map.places[focusPlace][0]} ${map.places[focusPlace][1]}L${xy[0]} ${xy[1]}`} stroke="var(--map-ink)" strokeWidth={0.8 * scale} strokeDasharray={`${0.01 * scale} ${3 * scale}`} strokeLinecap="round" opacity={0.6} />
                      <circle cx={xy[0]} cy={xy[1]} r={4 * scale} fill="none" stroke="var(--map-ink)" strokeWidth={1 * scale} strokeDasharray={`${2 * scale} ${2 * scale}`} />
                    </g>
                  ))}
                {/* places */}
                {places
                  .filter((p) => p.kind !== 'region' && map.places[p.id])
                  .map((p) => {
                    const xy = map.places[p.id];
                    const met = !!state.places[p.id];
                    const onRoute = inActive.has(p.id);
                    if (!met && !onRoute && focusPlace !== p.id) return null;
                    const isCur = current === p.id;
                    const r = 4.2 * scale;
                    const left = ['bethlehem', 'jerusalem', 'ramah', 'moriah', 'ai', 'hebron', 'rameses'].includes(p.id);
                    return (
                      <g key={p.id} data-testid={`map-place-${p.id}`} data-state={isCur ? 'current' : met ? 'met' : 'unmet'} role="button" tabIndex={0} aria-label={`${p.name}${met ? ', you have been here' : ''}. Open its history.`} style={{ cursor: 'pointer' }} onClick={() => open({ kind: 'place', id: p.id })} onKeyDown={(e) => e.key === 'Enter' && open({ kind: 'place', id: p.id })}>
                        <circle cx={xy[0]} cy={xy[1]} r={r * 4} fill="transparent" />
                        {isCur && !reduced && (
                          <motion.circle cx={xy[0]} cy={xy[1]} r={r * 3} fill="none" stroke="var(--bronze)" strokeWidth={1 * scale} initial={{ opacity: 0.8, scale: 0.4 }} animate={{ opacity: 0, scale: 1.3 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }} style={{ transformOrigin: `${xy[0]}px ${xy[1]}px` }} />
                        )}
                        {isCur && <circle cx={xy[0]} cy={xy[1]} r={r * 2} fill="none" stroke="var(--bronze)" strokeWidth={1.2 * scale} />}
                        {met && <path d={`M${xy[0] + r * 2.2} ${xy[1] - r * 0.6}a${r * 2.2} ${r * 2.1} 0 1 0 ${-r * 0.4} ${r * 1.6}`} fill="none" stroke="var(--pencil)" strokeWidth={0.9 * scale} strokeLinecap="round" />}
                        <circle cx={xy[0]} cy={xy[1]} r={r} fill={met ? 'var(--map-ink)' : 'var(--map-land)'} stroke="var(--map-ink)" strokeWidth={1.1 * scale} />
                        <text x={xy[0] + (left ? -r * 2.8 : r * 2.8)} y={xy[1] + r * 1.1} textAnchor={left ? 'end' : 'start'} className="map-label" style={{ fontSize: 13 * scale, fontWeight: isCur ? 600 : 500, letterSpacing: '0.06em', opacity: met || onRoute ? 1 : 0.7 }} paintOrder="stroke" stroke="var(--map-land)" strokeWidth={3 * scale}>
                          {p.name}
                        </text>
                      </g>
                    );
                  })}
                {mode === 'segment' && seg.style === 'direction' && (
                  <text x={(seg.fromLabel ? map.segments[seg.id].start[0] : map.segments[seg.id].end[0]) - 12} y={(seg.fromLabel ? map.segments[seg.id].start[1] : map.segments[seg.id].end[1]) - 10 * scale} textAnchor="end" className="map-label" style={{ fontSize: 12 * scale, fontStyle: 'italic' }}>
                    {seg.fromLabel ?? seg.toLabel}
                  </text>
                )}
              </svg>
              <div className="pointer-events-none absolute right-5 top-[190px] hidden text-[var(--map-ink)] opacity-60 md:right-8 md:block" aria-hidden>
                <GlyphCompass width={30} height={30} />
                <p className="mt-1 text-center font-display text-[10px] tracking-[0.2em]">N</p>
              </div>
            </div>

            {/* pencilled journey history */}
            <div className="relative z-[2] ml-auto mr-3 mt-1 md:mr-8">
              <button type="button" className="btn-quiet min-h-[36px] bg-[color-mix(in_srgb,var(--map-land)_80%,transparent)] px-3 text-[13px] italic" style={{ color: 'var(--map-ink)' }} onClick={() => setHistoryOpen((o) => !o)} aria-expanded={historyOpen} data-testid="journey-history-toggle">
                <GlyphMemory /> Your journey so far ({state.journeyHistory.length})
              </button>
              {historyOpen && (
                <ol className="scroll-quiet mt-1 max-h-[36vh] w-[250px] overflow-y-auto rounded-[2px] bg-[color-mix(in_srgb,var(--map-land)_92%,transparent)] px-4 py-3 shadow-md" data-testid="journey-history" aria-label="Your journey so far">
                  {state.journeyHistory.length === 0 && <li className="font-display text-[14px] italic text-[var(--map-ink)]">Places you read about will be pencilled in here.</li>}
                  {state.journeyHistory.map((h, i) => (
                    <li key={h.placeId} className="text-[var(--map-ink)]">
                      {i > 0 && <p className="pl-1 text-[11px] leading-none opacity-50" aria-hidden>↓</p>}
                      <button
                        type="button"
                        className="w-full text-left font-display text-[15px] leading-snug"
                        style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
                        onClick={() => {
                          goTo(chapterOf(h.ref), parseRef(h.ref).from, { keepReturn: true });
                          close();
                        }}
                      >
                        {places.find((p) => p.id === h.placeId)?.name} <span className="text-[12px] opacity-60">{formatRef(h.ref)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="relative z-[2] mt-auto px-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-8 md:pb-8">
              {mode === 'place' && focusPlace ? (
                <div className="sheet grain relative rounded-[3px] px-5 pb-4 pt-4 md:max-w-[520px]" data-testid="map-place-card">
                  <div className="relative z-[1]">
                    <p className="label-caps text-[var(--bronze-deep)]">{CERTAINTY_LABEL[ed.placeById.get(focusPlace)?.certainty ?? 'UNKNOWN']}</p>
                    <h3 className="mt-1 font-display text-[21px] font-medium">{ed.placeById.get(focusPlace)?.name}</h3>
                    {ed.placeById.get(focusPlace)?.modern && <p className="supp text-[13px]">{ed.placeById.get(focusPlace)?.certainty === 'DISPUTED' ? 'One proposal: ' : ''}{ed.placeById.get(focusPlace)?.modern}</p>}
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn-quiet px-3 text-[14px] italic" onClick={() => open({ kind: 'place', id: focusPlace })}>
                        Its history →
                      </button>
                      <button type="button" className="btn-quiet px-3 text-[14px] italic" onClick={() => setMode('segment')}>
                        Follow {activeJourney.name}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div key={seg.id + mode} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="sheet grain relative rounded-[3px] px-5 pb-4 pt-4 md:max-w-[540px]" data-testid="map-segment-card">
                  <div className="relative z-[1]">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="label-caps text-[var(--bronze-deep)]">
                        {idx + 1} of {activeJourney.segments.length} · {formatRefs(seg.verses)}
                      </p>
                      <p className="supp shrink-0 text-[12px] italic">{seg.travellers}</p>
                    </div>
                    <h3 className="mt-1 font-display text-[21px] font-medium leading-snug" data-testid="map-segment-title">
                      {seg.label}
                    </h3>
                    <p className="supp text-[13px]">
                      {placeName(seg.from, seg.fromLabel)} <span aria-hidden>→</span>
                      <span className="sr-only">to</span> {placeName(seg.to, seg.toLabel)}
                      <span className="tag ml-2 inline-block" data-testid="route-certainty">
                        {CERTAINTY_NAME[seg.certainty]}
                      </span>
                      {km != null && (
                        <span className="ml-2 italic" title={ed.distanceNote} data-testid="segment-distance">
                          ≈ {km < 20 ? Math.round(km) : Math.round(km / 5) * 5} km in a straight line
                        </span>
                      )}
                    </p>
                    {!map.segments[seg.id] && <p className="supp mt-1 text-[12px] italic">This stage is not drawn: one of its places has no known location.</p>}
                    {verseText && (
                      <blockquote className="mt-3 border-l-2 border-[var(--rule)] pl-3 text-[15.5px] leading-snug" cite={verseText.ref}>
                        <span className="verse-num">{verseText.verse}</span>
                        <span data-ref={verseText.ref}>
                          <span data-scripture-text>{verseText.text}</span>
                        </span>
                      </blockquote>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button type="button" className="btn-quiet px-2" disabled={idx === 0} onClick={() => step(-1)} aria-label="Previous stage of the journey" style={{ opacity: idx === 0 ? 0.3 : 1 }}>
                        <IconChevron dir="left" />
                      </button>
                      <button
                        type="button"
                        className="btn-quiet px-3 text-[14px] italic"
                        onClick={() => {
                          goTo(chapterOf(seg.anchor), parseRef(seg.anchor).from, { keepReturn: chapterOf(seg.anchor) !== chapter.ref });
                          close();
                        }}
                        data-testid="map-read-here"
                      >
                        Read at {formatRef(seg.anchor)}
                      </button>
                      <button type="button" className="btn-quiet px-2" disabled={idx === activeJourney.segments.length - 1} onClick={() => step(1)} aria-label="Next stage of the journey" data-testid="map-next" style={{ opacity: idx === activeJourney.segments.length - 1 ? 0.3 : 1 }}>
                        <IconChevron dir="right" />
                      </button>
                    </div>
                    <p className="supp mt-1 text-[11.5px] italic leading-snug opacity-90">{seg.note ?? ed.certaintyLegend[seg.certainty]}</p>
                  </div>
                </motion.div>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 font-display text-[10.5px] italic text-[var(--map-ink)]" aria-label="Route certainty legend">
                <span className="flex items-center gap-3 opacity-80">
                  {(['explicit', 'approximate', 'reconstructed'] as RouteCertainty[]).map((c) => (
                    <span key={c} className="flex items-center gap-1">
                      <svg width="22" height="6" aria-hidden>
                        <path d="M1 3h20" stroke="var(--map-ink)" strokeWidth="1.4" strokeDasharray={DASH[c](0.6)} strokeLinecap="round" />
                      </svg>
                      {CERTAINTY_NAME[c]}
                    </span>
                  ))}
                </span>
                <span className="opacity-60">{map.attribution}</span>
              </div>
            </div>
          </>
        )}
      </motion.section>
    </div>
  );
}
