'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { chapterOf, formatRef, parseRef } from '@/lib/content/refs';
import type { ScaleSet } from '@/lib/content/types';
import { IconClose } from './Icons';
import { useReader } from './ReaderContext';

const HUMAN = 1.75; // metres — an average adult, for scale

/** A simple human silhouette standing on (x, baseline), `h` units tall. */
function Person({ x, base, h }: { x: number; base: number; h: number }) {
  const u = h / 7.5;
  return (
    <g aria-hidden fill="var(--ink)" opacity={0.75}>
      <circle cx={x} cy={base - h + u * 0.6} r={u * 0.6} />
      <rect x={x - u * 0.75} y={base - h + u * 1.3} width={u * 1.5} height={u * 3} rx={u * 0.5} />
      <rect x={x - u * 0.62} y={base - h + u * 4.1} width={u * 0.55} height={u * 3.4} rx={u * 0.25} />
      <rect x={x + u * 0.07} y={base - h + u * 4.1} width={u * 0.55} height={u * 3.4} rx={u * 0.25} />
    </g>
  );
}

/**
 * ScaleInsert — the Tabernacle from the measurements Scripture gives, with modern conversions.
 * Stated measurements and derived ones are labelled; the cubit is an assumption and says so.
 */
export function ScaleInsert({ focus }: { focus?: string }) {
  const { ed } = useReader();
  const set = ed.scale?.sets.find((x) => x.id === focus);
  if (set && set.id !== 'tabernacle') return <SetScale set={set} />;
  return <TabernacleScale />;
}

const fmtNum = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : n >= 10 ? n.toFixed(1) : n.toFixed(2));

/**
 * Any other set of measurements Scripture gives (the ark, the temple, Goliath, the image of gold …).
 * Each measurement quotes its verse; conversions are estimates and say which unit they assume.
 */
function SetScale({ set }: { set: ScaleSet }) {
  const { ed, close, reduced, goTo, open } = useReader();
  const [cubit, setCubit] = useState<'common' | 'long'>('common');
  const units = ed.scale!.units;
  const c = cubit === 'common' ? units.cubit.common! : units.cubit.long!;
  const lengths = set.items.filter((i) => i.dims.length || i.dims.height || i.dims.breadth);
  const maxCubits = Math.max(4, ...lengths.map((i) => Math.max(i.dims.length ?? 0, i.dims.height ?? 0, i.dims.breadth ?? 0)));
  const S = 560 / maxCubits;
  const others = ed.scale!.sets.filter((x) => x.id !== set.id);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 md:p-8" data-testid="scale-insert">
      <motion.div aria-hidden className="absolute inset-0 bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.section role="dialog" aria-modal="true" aria-label={`${set.title} to scale`} className="insert-stock grain scroll-quiet relative max-h-[94dvh] w-full max-w-[760px] overflow-y-auto rounded-[2px]" initial={reduced ? { opacity: 0 } : { x: '70%', rotate: 3, opacity: 0 }} animate={reduced ? { opacity: 1 } : { x: 0, rotate: -0.4, opacity: 1 }} exit={reduced ? { opacity: 0 } : { x: '80%', rotate: 4, opacity: 0 }} transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 190, damping: 26 }}>
        <div className="relative z-[1] px-5 pb-7 pt-5 md:px-9">
          <div className="flex items-start justify-between">
            <p className="label-caps text-[10px] text-[var(--ink-muted)]">Scale insert · not part of the biblical text</p>
            <button type="button" className="btn-quiet -mr-3 -mt-3" onClick={close} aria-label="Return the insert" data-testid="scale-close">
              <IconClose />
            </button>
          </div>
          <h2 className="font-display text-[30px] font-medium leading-tight">{set.title} to scale</h2>
          <p className="supp text-[15px] italic">From the measurements in {formatRef(set.anchor).replace(/:\d+$/, '')}</p>
          {lengths.some((i) => !i.dims.length_furlongs) && (
            <div role="radiogroup" aria-label="Cubit" className="mt-4 inline-flex rounded-full border hairline p-0.5">
              {(['common', 'long'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={cubit === k} onClick={() => setCubit(k)} className="min-h-[36px] rounded-full px-3 font-display text-[13.5px]" style={{ background: cubit === k ? 'var(--ink)' : 'transparent', color: cubit === k ? 'var(--paper)' : 'var(--ink-muted)' }} data-testid={`cubit-${k}`}>
                  {k === 'common' ? 'Cubit ≈ 45.7 cm' : 'Long cubit ≈ 52.4 cm'}
                </button>
              ))}
            </div>
          )}
          <p className="supp mt-2 text-[12.5px] italic leading-snug">{units.cubit.note}</p>

          <figure className="mt-5">
            <svg viewBox={`0 0 640 ${Math.min(420, maxCubits * S * 0.6 + 60)}`} className="w-full" role="img" aria-label={`${set.title}, drawn to scale with a person of ${HUMAN} metres.`} data-testid="scale-drawing">
              {(() => {
                const H = Math.min(420, maxCubits * S * 0.6 + 60);
                let x = 20;
                return (
                  <>
                    <line x1={5} x2={635} y1={H - 20} y2={H - 20} stroke="var(--rule)" />
                    {lengths
                      .filter((i) => !i.dims.length_furlongs)
                      .map((i) => {
                        const w = (i.dims.length ?? i.dims.breadth ?? 1) * S;
                        const h = (i.dims.height ?? i.dims.height_or_thickness ?? Math.min(i.dims.breadth ?? 1, maxCubits * 0.1)) * S;
                        const el = (
                          <g key={i.id}>
                            <rect x={x} y={H - 20 - Math.min(h, H - 40)} width={Math.min(w, 600 - x)} height={Math.min(h, H - 40)} fill="rgba(154,116,64,0.18)" stroke="var(--bronze-deep)" />
                            <text x={x + 4} y={H - 26 - Math.min(h, H - 40)} className="map-label" style={{ fontSize: 11 }}>
                              {i.label}
                            </text>
                          </g>
                        );
                        x += Math.min(w, 600 - x) + 14;
                        return el;
                      })}
                    <Person x={Math.min(620, x + 6)} base={H - 20} h={(HUMAN / c) * S} />
                  </>
                );
              })()}
            </svg>
            <p className="supp mt-1 text-[12px] italic">Side views, to one scale. The human figure is {HUMAN} m. Shapes are simplified to the dimensions Scripture gives.</p>
          </figure>

          <table className="mt-5 w-full font-display text-[14.5px]" data-testid="scale-table">
            <thead>
              <tr className="label-caps text-left text-[9.5px] text-[var(--ink-faint)]">
                <th className="py-1 font-semibold">As Scripture gives it</th>
                <th className="py-1 font-semibold">Estimate</th>
              </tr>
            </thead>
            <tbody>
              {set.items.map((it) => {
                const d = it.dims;
                const est = d.weight_shekels
                  ? `≈ ${fmtNum((d.weight_shekels * units.shekel.g!) / 1000)} kg (shekel ≈ ${units.shekel.g} g)`
                  : d.length_furlongs
                    ? `≈ ${fmtNum((d.length_furlongs * units.furlong.m!) / 1000)} km (furlong ≈ ${units.furlong.m} m)`
                    : Object.entries(d)
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${k.replace('_or_thickness', '')} ≈ ${fmtNum(v! * c)} m`)
                        .join(' · ');
                return (
                  <tr key={it.id} className="border-t hairline align-top">
                    <td className="py-2 pr-3">
                      <span className="font-semibold">{it.label}</span>
                      <span className="block text-[15px] leading-snug">“{it.phrase}”</span>
                      <button type="button" className="text-[12px] italic text-[var(--ink-muted)]" onClick={() => { goTo(chapterOf(it.evidence), parseRef(it.evidence).from, { keepReturn: true }); close(); }}>
                        {formatRef(it.evidence)}
                      </button>
                    </td>
                    <td className="py-2 text-[13px] italic tabular-nums">{est}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="supp mt-3 text-[12px] italic">Every conversion is an estimate: {Object.entries(units).filter(([k]) => k !== 'cubit').map(([k, u]) => `${k} — ${u.note}`).join(' ')}</p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {others.map((o) => (
              <button key={o.id} type="button" className="tag min-h-[30px]" onClick={() => open({ kind: 'insert', id: o.id === 'tabernacle' ? 'insert-tabernacle' : `insert-scale-${o.id}`, focus: o.id })}>
                {o.title}
              </button>
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function TabernacleScale() {
  const { ed, close, reduced, goTo } = useReader();
  const m = ed.measurements;
  const [cubit, setCubit] = useState<'common' | 'long'>('common');
  const [compare, setCompare] = useState(false);
  const c = m.cubit[cubit];
  const get = (id: string) => m.items.find((i) => i.id === id)!;
  const court = get('court').dims;
  const board = get('boards').dims;
  const tent = get('tent-length').dims;
  const west = get('tent-west').dims;
  const ark = get('ark').dims;
  const metres = (cu: number) => (cu * c).toFixed(cu * c < 10 ? 2 : 1);

  // Plan drawing: 1 cubit = 5 units
  const S = 5;
  const W = court.length! * S + 40;
  const tennis = { l: 23.77 / c, b: 10.97 / c };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 md:p-8" data-testid="scale-insert">
      <motion.div aria-hidden className="absolute inset-0 bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="The Tabernacle to scale"
        className="insert-stock grain scroll-quiet relative max-h-[94dvh] w-full max-w-[760px] overflow-y-auto rounded-[2px]"
        initial={reduced ? { opacity: 0 } : { x: '70%', rotate: 3, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { x: 0, rotate: -0.4, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { x: '80%', rotate: 4, opacity: 0 }}
        transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 190, damping: 26 }}
      >
        <div className="relative z-[1] px-5 pb-7 pt-5 md:px-9">
          <div className="flex items-start justify-between">
            <p className="label-caps text-[10px] text-[var(--ink-muted)]">Scale insert · not part of the biblical text</p>
            <button type="button" className="btn-quiet -mr-3 -mt-3" onClick={close} aria-label="Return the insert" data-testid="scale-close">
              <IconClose />
            </button>
          </div>
          <h2 className="font-display text-[30px] font-medium leading-tight">The Tabernacle to scale</h2>
          <p className="supp text-[15px] italic">From the measurements in Exodus 25–27</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Cubit" className="flex rounded-full border hairline p-0.5">
              {(['common', 'long'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={cubit === k} onClick={() => setCubit(k)} className="min-h-[36px] rounded-full px-3 font-display text-[13.5px]" style={{ background: cubit === k ? 'var(--ink)' : 'transparent', color: cubit === k ? 'var(--paper)' : 'var(--ink-muted)' }} data-testid={`cubit-${k}`}>
                  {k === 'common' ? 'Cubit ≈ 45.7 cm' : 'Long cubit ≈ 52.4 cm'}
                </button>
              ))}
            </div>
            <button type="button" role="switch" aria-checked={compare} onClick={() => setCompare((v) => !v)} className="btn-quiet min-h-[36px] px-3 text-[13.5px] italic" data-testid="scale-compare">
              {compare ? 'Hide' : 'Compare with'} a tennis court
            </button>
          </div>
          <p className="supp mt-2 text-[12.5px] italic leading-snug">{m.cubit.note}</p>

          {/* Court plan */}
          <figure className="mt-5">
            <figcaption className="label-caps mb-1 text-[10px] text-[var(--bronze-deep)]">The court — plan</figcaption>
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${W} ${court.breadth! * S + 60}`} className="w-full min-w-[320px]" role="img" aria-label={`Court ${court.length} by ${court.breadth} cubits, about ${metres(court.length!)} by ${metres(court.breadth!)} metres.`} data-testid="scale-court">
                <rect x={20} y={20} width={court.length! * S} height={court.breadth! * S} fill="none" stroke="var(--ink)" strokeWidth={1.4} />
                <text x={20 + (court.length! * S) / 2} y={14} textAnchor="middle" className="map-label" style={{ fontSize: 12 }}>
                  {court.length} cubits · {metres(court.length!)} m
                </text>
                <text x={W - 12} y={20 + (court.breadth! * S) / 2} textAnchor="middle" className="map-label" style={{ fontSize: 12 }} transform={`rotate(90 ${W - 12} ${20 + (court.breadth! * S) / 2})`}>
                  {court.breadth} cubits · {metres(court.breadth!)} m
                </text>
                {/* the tent, shown at its stated/derived size; its position in the court is not given in these verses */}
                <rect x={20 + court.length! * S * 0.55} y={20 + (court.breadth! * S - west.length! * S) / 2} width={tent.length! * S} height={west.length! * S} fill="rgba(154,116,64,0.12)" stroke="var(--bronze-deep)" strokeWidth={1.2} strokeDasharray="5 3" />
                <text x={20 + court.length! * S * 0.55 + (tent.length! * S) / 2} y={20 + (court.breadth! * S) / 2 + 4} textAnchor="middle" className="map-label" style={{ fontSize: 11, fontStyle: 'italic' }}>
                  tabernacle {tent.length} × {west.length}+ cubits
                </text>
                {compare && (
                  <g data-testid="scale-tennis">
                    <rect x={30} y={30} width={tennis.l * S} height={tennis.b * S} fill="none" stroke="var(--ink-muted)" strokeDasharray="2 3" />
                    <text x={34} y={30 + tennis.b * S - 5} className="map-label" style={{ fontSize: 10, fontStyle: 'italic', fill: 'var(--ink-muted)' }}>
                      tennis court
                    </text>
                  </g>
                )}
                <Person x={20 + 12} base={20 + court.breadth! * S - 4} h={(HUMAN / c) * S} />
              </svg>
            </div>
            <p className="supp mt-1 text-[12px] italic">The tent’s place within the court is not stated in these verses; it is drawn for size only. Its width is derived and uncertain (see below).</p>
          </figure>

          {/* Side elevation: board & person */}
          <figure className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <figcaption className="label-caps mb-1 text-[10px] text-[var(--bronze-deep)]">A board, standing</figcaption>
              <svg viewBox="0 0 160 170" className="w-full max-w-[260px]" role="img" aria-label={`Board ${board.length} cubits high, about ${metres(board.length!)} metres, beside a person of ${HUMAN} metres.`}>
                <line x1={5} x2={155} y1={160} y2={160} stroke="var(--rule)" />
                <rect x={30} y={160 - board.length! * 14} width={board.breadth! * 14} height={board.length! * 14} fill="rgba(154,116,64,0.18)" stroke="var(--bronze-deep)" />
                <text x={64} y={160 - board.length! * 7} className="map-label" style={{ fontSize: 10 }}>
                  {board.length} cubits · {metres(board.length!)} m
                </text>
                <Person x={110} base={160} h={(HUMAN / c) * 14} />
              </svg>
            </div>
            <div>
              <figcaption className="label-caps mb-1 text-[10px] text-[var(--bronze-deep)]">The ark of the testimony</figcaption>
              <svg viewBox="0 0 160 170" className="w-full max-w-[260px]" role="img" aria-label={`Ark ${ark.length} by ${ark.breadth} by ${ark.height} cubits.`}>
                <line x1={5} x2={155} y1={160} y2={160} stroke="var(--rule)" />
                <rect x={20} y={160 - ark.height! * 28} width={ark.length! * 28} height={ark.height! * 28} fill="rgba(154,116,64,0.25)" stroke="var(--bronze-deep)" />
                <text x={20} y={160 - ark.height! * 28 - 6} className="map-label" style={{ fontSize: 10 }}>
                  {ark.length} × {ark.height} cubits · {metres(ark.length!)} × {metres(ark.height!)} m
                </text>
                <Person x={120} base={160} h={(HUMAN / c) * 28} />
              </svg>
            </div>
          </figure>

          <table className="mt-5 w-full font-display text-[14.5px]" data-testid="scale-table">
            <thead>
              <tr className="label-caps text-left text-[9.5px] text-[var(--ink-faint)]">
                <th className="py-1 font-semibold">Item</th>
                <th className="py-1 font-semibold">Cubits</th>
                <th className="py-1 font-semibold">Metres</th>
                <th className="py-1 font-semibold">Basis</th>
              </tr>
            </thead>
            <tbody>
              {m.items.map((it) => (
                <tr key={it.id} className="border-t hairline align-top">
                  <td className="py-2 pr-2">
                    {it.label}
                    <button type="button" className="block text-[12px] italic text-[var(--ink-muted)]" onClick={() => { goTo(chapterOf(it.evidence), parseRef(it.evidence).from, { keepReturn: true }); close(); }} title={it.phrase}>
                      {formatRef(it.evidence)}
                    </button>
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{Object.values(it.dims).join(' × ')}</td>
                  <td className="py-2 pr-2 tabular-nums">{Object.values(it.dims).map((d) => metres(d!)).join(' × ')}</td>
                  <td className="py-2 text-[12.5px] italic">{it.basis === 'stated' ? 'Stated' : `Derived: ${it.derivation}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="supp mt-3 text-[12px] italic">Human figure: {HUMAN} m, for scale only. Conversions change with the cubit chosen above.</p>
        </div>
      </motion.section>
    </div>
  );
}
