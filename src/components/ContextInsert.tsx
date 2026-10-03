'use client';
import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { haversineKm } from '@/lib/geo';
import { formatRef } from '@/lib/content/refs';
import { IconClose } from './Icons';
import { useReader } from './ReaderContext';

/**
 * ContextInsert — a card "tipped in" between the pages. Printed on different stock and
 * labelled as context so it can never be mistaken for Scripture.
 */
export function ContextInsert({ id }: { id: string }) {
  const { ed, close, reduced, open } = useReader();
  const ins = ed.inserts.find((i) => i.id === id)!;
  const place = (pid: string) => ed.placeById.get(pid)! as { name: string; kind: string; lat: number; lon: number };
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 md:p-10" data-testid="context-insert">
      <motion.div aria-hidden className="absolute inset-0 bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Context insert: ${ins.title}`}
        className="insert-stock grain relative max-h-[88dvh] w-full max-w-[520px] overflow-y-auto rounded-[2px] outline-none scroll-quiet"
        initial={reduced ? { opacity: 0 } : { x: '70%', rotate: 3, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { x: 0, rotate: -0.6, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { x: '80%', rotate: 4, opacity: 0 }}
        transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 190, damping: 26 }}
      >
        <div className="relative z-[1] px-6 pb-7 pt-6 md:px-9">
          <div className="flex items-start justify-between">
            <p className="label-caps text-[10px] text-[var(--ink-muted)]">Context insert · not part of the biblical text</p>
            <button type="button" className="btn-quiet -mr-3 -mt-3" onClick={close} aria-label="Return the insert" data-testid="insert-close">
              <IconClose />
            </button>
          </div>
          <h2 className="mt-1 font-display text-[30px] font-medium leading-tight">{ins.title}</h2>
          <p className="supp text-[15px] italic">{ins.subtitle}</p>
          <div className="mt-4 h-px bg-[var(--rule)]" />

          {(ins.sections ?? []).map((s) => (
            <section key={s.heading} className="mt-5">
              <h3 className="label-caps text-[10.5px] text-[var(--bronze-deep)]">{s.heading}</h3>
              <dl className="mt-2 space-y-3">
                {s.items.map((it) => (
                  <div key={it.term}>
                    <dt className="font-display text-[18px] font-semibold">
                      {it.term} <span className="ml-1 text-[12px] font-normal text-[var(--ink-faint)]">{it.refs.map((r) => formatRef(r).replace('Matthew ', '')).join(', ')}</span>
                    </dt>
                    <dd className="supp text-[15px] leading-snug">{it.text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <section className="mt-6">
            <h3 className="label-caps text-[10.5px] text-[var(--bronze-deep)]">Distances (straight line)</h3>
            <table className="mt-2 w-full font-display text-[15px]">
              <tbody>
                {(ins.distances ?? []).map(([a, b]) => {
                  const km = haversineKm(place(a), place(b));
                  return (
                    <tr key={a + b} className="border-b hairline">
                      <td className="py-1.5">
                        {place(a).name} – {place(b).name}
                        {place(b).kind === 'region' && <span className="text-[12px] italic text-[var(--ink-faint)]"> (Delta)</span>}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        ≈ {km < 50 ? Math.round(km) : Math.round(km / 5) * 5} km <span className="text-[var(--ink-faint)]">· {Math.round(km * 0.621)} mi</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <button type="button" className="btn-quiet -ml-2 mt-4 px-2 text-[14px] italic" onClick={() => open({ kind: 'atlas', layer: 'jesus', segment: 's1' })}>
            Unfold the map of the journey →
          </button>
          <p className="supp mt-4 text-[12px] italic leading-snug opacity-80">{ins.sources}</p>
        </div>
      </motion.div>
    </div>
  );
}
