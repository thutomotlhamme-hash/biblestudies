'use client';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatRef } from '@/lib/content/refs';
import type { Genealogy, GenealogyRelationship } from '@/lib/content/types';
import { useRefsReady } from '@/lib/library/useLibrary';
import { useMedia } from '@/lib/useMedia';
import { IconClose } from './Icons';
import { useReader } from './ReaderContext';

/**
 * GenealogyGatefold — Matthew 1:1–17 unfolded beside the text, like a gatefold sheet.
 * Every link quotes Matthew's own words; the visual never replaces the genealogy text.
 */
export function GenealogyGatefold({ focus }: { focus?: string }) {
  const { ed } = useReader();
  const [which, setWhich] = useState(() => ed.genealogies.find((g) => g.id === focus)?.id ?? 'matthew-1');
  const g = ed.genealogies.find((x) => x.id === which) ?? ed.genealogy;
  const picker = (
    <div className="scroll-quiet -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Genealogies">
      {ed.genealogies.map((x) => (
        <button key={x.id} type="button" role="tab" aria-selected={x.id === g.id} className="tag min-h-[30px] shrink-0" style={{ opacity: x.id === g.id ? 1 : 0.55 }} onClick={() => setWhich(x.id)} data-testid={`genealogy-tab-${x.id}`}>
          {formatRef(x.evidence).replace(/:\d+$/, '')}
        </button>
      ))}
    </div>
  );
  return g.kind === 'line' ? <LineGatefold g={g} picker={picker} /> : <MatthewGatefold focus={focus} picker={picker} />;
}

/** Evidence card: the verse that states a link, printed exactly. */
function EvidenceCard({ detail, onClose }: { detail: GenealogyRelationship; onClose: () => void }) {
  const { ed } = useReader();
  const ready = useRefsReady([detail.evidence]);
  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="sheet grain absolute inset-x-2 bottom-2 z-[3] rounded-[3px] px-5 py-4 md:inset-x-auto md:right-6 md:w-[420px]" data-testid="gatefold-evidence">
      <div className="relative z-[1]">
        <div className="flex items-start justify-between">
          <p className="label-caps text-[10px] text-[var(--bronze-deep)]">{formatRef(detail.evidence)}</p>
          <button type="button" className="btn-quiet -mr-2 -mt-2" onClick={onClose} aria-label="Close evidence">
            <IconClose width={16} height={16} />
          </button>
        </div>
        <p className="mt-1 text-[17px] leading-[1.5]">
          <span data-ref={detail.evidence}>{ready ? <span data-scripture-text>{ed.translation.verse(detail.evidence).text}</span> : <span className="supp italic">Opening…</span>}</span>
        </p>
      </div>
    </motion.div>
  );
}

/** A single line of descent, as written (Genesis 5, Genesis 11, Luke 3, 1 Chronicles 3). */
function LineGatefold({ g, picker }: { g: Genealogy; picker: React.ReactNode }) {
  const { ed, close, reduced, open } = useReader();
  const [detail, setDetail] = useState<GenealogyRelationship | null>(null);
  const up = g.id === 'luke-3';
  // order the nodes along the line as the text gives them
  const order = up ? g.nodes : g.nodes;
  const edgeInto = (id: string) => g.edges.find((e) => (up ? e.parentId === id : e.childId === id));
  const personFor = (name: string) => ed.people.find((p) => p.name === name && (p.verses ?? []).some((r) => g.edges.some((e) => e.evidence === r)))?.id;
  const cols = order.length > 40 ? 3 : order.length > 14 ? 2 : 1;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 md:p-8" data-testid="genealogy-gatefold">
      <motion.div aria-hidden className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.div role="dialog" aria-modal="true" aria-label={`Genealogy: ${g.title}`} className="insert-stock grain relative flex max-h-[94dvh] w-full max-w-[980px] flex-col rounded-[2px]" initial={reduced ? { opacity: 0 } : { rotateX: -70, opacity: 0.4 }} animate={{ rotateX: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.15 : 0.7, ease: [0.3, 0, 0.1, 1] }} style={{ transformOrigin: 'top center', transformPerspective: 1600 }}>
        <div className="relative z-[1] flex items-start justify-between gap-3 px-5 pt-4 md:px-8">
          <div className="min-w-0">
            <p className="label-caps text-[10px] text-[var(--ink-muted)]">Gatefold · genealogy · as written</p>
            <h2 className="mt-1 font-display text-[26px] font-medium leading-tight">{g.title}</h2>
            <p className="supp text-[14px] italic">{formatRef(g.evidence).replace(/:\d+$/, '')} · {g.nodes.length} names</p>
          </div>
          <button type="button" className="btn-quiet shrink-0" onClick={close} aria-label="Fold the genealogy away" data-testid="gatefold-close">
            <IconClose />
          </button>
        </div>
        <div className="relative z-[1] px-5 pt-2 md:px-8">{picker}</div>
        <div className="scroll-quiet relative z-[1] flex-1 overflow-y-auto px-5 pb-6 pt-2 md:px-8">
          <ol className="gap-x-8" style={{ columnCount: cols, columnGap: '2rem' }} data-testid="genealogy-line">
            {order.map((n, i) => {
              const via = edgeInto(n.id);
              const pid = personFor(n.name);
              return (
                <li key={n.id} className="relative break-inside-avoid pl-5" data-node={n.id}>
                  <span aria-hidden className="absolute left-0 top-[11px] h-[8px] w-[8px] rounded-full border border-[var(--ink-muted)]" style={{ background: pid ? 'var(--ink)' : 'var(--insert-stock)' }} />
                  {i > 0 && via && (
                    <button type="button" className="block min-h-[20px] text-left font-display text-[11px] italic text-[var(--ink-faint)]" onClick={() => setDetail(via)} aria-label={`Evidence: ${via.phrase}, ${formatRef(via.evidence)}`}>
                      {up ? 'son of' : 'begat'} · {formatRef(via.evidence).replace(/^.* /, '')}
                    </button>
                  )}
                  <button type="button" className="min-h-[30px] text-left font-display text-[17px] leading-tight" style={{ fontWeight: pid ? 600 : 400 }} onClick={() => (pid ? open({ kind: 'person', id: pid }) : via && setDetail(via))} data-testid={`gen-node-${n.id}`}>
                    {n.name}
                  </button>
                </li>
              );
            })}
          </ol>
          {g.note && <p className="supp mt-5 border-t hairline pt-3 text-[13px] italic leading-snug">{g.note}</p>}
        </div>
        {detail && <EvidenceCard detail={detail} onClose={() => setDetail(null)} />}
      </motion.div>
    </div>
  );
}

function MatthewGatefold({ focus, picker }: { focus?: string; picker: React.ReactNode }) {
  const { ed, close, reduced, open, state } = useReader();
  const g = ed.genealogy;
  const wide = useMedia('(min-width: 900px)');
  const [detail, setDetail] = useState<GenealogyRelationship | null>(null);
  const [showBranch, setShowBranch] = useState(focus === 'jacob');
  const scroller = useRef<HTMLDivElement>(null);

  // Walk the line from Abraham to Jesus through the edges.
  const chain = useMemo(() => {
    const out: { id: string; name: string; person: string | null; via?: GenealogyRelationship }[] = [];
    let cur = 'abraham';
    let via: GenealogyRelationship | undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const node = g.nodes.find((n) => n.id === cur)!;
      out.push({ ...node, via });
      via = g.edges.find((e) => e.parentId === cur && !e.relation);
      if (!via && cur === 'joseph-nazareth') via = g.edges.find((e) => e.relation === 'husband');
      if (!via && cur === 'mary') via = g.edges.find((e) => e.relation === 'of whom was born');
      cur = via?.childId ?? '';
    }
    return out;
  }, [g]);

  const sections = (g.sections ?? []).map((s) => {
    const a = chain.findIndex((n) => n.id === s.from);
    const b = chain.findIndex((n) => n.id === s.to);
    return { ...s, nodes: chain.slice(a, b + 1) };
  });

  useEffect(() => {
    if (!focus) return;
    const t = window.setTimeout(() => scroller.current?.querySelector(`[data-node="${focus}"]`)?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }), 700);
    return () => window.clearTimeout(t);
  }, [focus, reduced]);

  const flap = (i: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : wide
        ? { initial: { rotateY: i === 0 ? 100 : i === 2 ? -100 : 0, rotateX: 0, opacity: i === 1 ? 1 : 0.4 }, animate: { rotateY: 0, rotateX: 0, opacity: 1 }, transition: { duration: 0.85, delay: 0.15 + (i === 1 ? 0 : 0.25), ease: [0.3, 0, 0.1, 1] as [number, number, number, number] } }
        : { initial: { rotateX: i === 0 ? 0 : -95, rotateY: 0, opacity: i === 0 ? 1 : 0.3 }, animate: { rotateX: 0, rotateY: 0, opacity: 1 }, transition: { duration: 0.7, delay: 0.1 + i * 0.22, ease: [0.3, 0, 0.1, 1] as [number, number, number, number] } };

  const branch = g.branches![0];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 md:p-8" data-testid="genealogy-gatefold">
      <motion.div aria-hidden className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.div role="dialog" aria-modal="true" aria-label="Genealogy gatefold: Matthew 1:1–17" className="relative flex max-h-[94dvh] w-full max-w-[1180px] flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} style={{ perspective: 1800 }}>
        <div className="insert-stock grain relative z-[2] flex flex-col-reverse items-start justify-between gap-1 rounded-t-[2px] px-5 pb-3 pt-3 md:flex-row md:px-8 md:pt-4">
          <div className="relative z-[1]">
            <p className="label-caps text-[10px] text-[var(--ink-muted)]">Gatefold · genealogy · every link quoted from Scripture</p>
            <h2 className="mt-1 font-display text-[26px] font-medium leading-tight">{g.title}</h2>
            <p className="supp text-[14px] italic">Matthew 1:1–17{showBranch ? ' · with Genesis 35:22–26' : ''}</p>
          </div>
          <div className="relative z-[1] -mr-2 flex items-center self-end md:self-start">
            <button type="button" className="btn-quiet whitespace-nowrap px-3 text-[13px] italic" onClick={() => setShowBranch((b) => !b)} aria-pressed={showBranch} data-testid="gatefold-branch-toggle">
              {showBranch ? 'Hide' : 'Show'} the sons of Jacob
            </button>
            <button type="button" className="btn-quiet" onClick={close} aria-label="Fold the genealogy away" data-testid="gatefold-close">
              <IconClose />
            </button>
          </div>
        </div>
        <div className="insert-stock relative z-[2] px-5 md:px-8">{picker}</div>
        <div ref={scroller} className="scroll-quiet relative flex-1 overflow-y-auto">
          <div className="grid gap-[2px] md:grid-cols-3" style={{ transformStyle: 'preserve-3d' }}>
            {sections.map((s, i) => (
              <motion.section
                key={s.label}
                {...flap(i)}
                style={{ transformOrigin: wide ? (i === 0 ? 'right center' : i === 2 ? 'left center' : 'center') : 'top center' }}
                className="insert-stock grain relative px-5 pb-6 pt-4 md:px-6"
                aria-label={s.label}
              >
                <div className="relative z-[1]">
                  <p className="label-caps text-[10px] text-[var(--bronze-deep)]">{s.label}</p>
                  <p className="supp mb-3 text-[12px] italic">Fourteen generations — {formatRef(g.sectionsEvidence!)}</p>
                  <ol className="relative">
                    <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-px bg-[var(--rule)]" />
                    {s.nodes.map((n) => {
                      const read = n.person ? !!state.people[n.person] : false;
                      const isFocus = focus && (n.id === focus || n.person === focus);
                      return (
                        <li key={n.id} data-node={n.id} className="relative pl-6">
                          <span aria-hidden className="absolute left-[3px] top-[13px] h-[9px] w-[9px] rounded-full border" style={{ background: isFocus ? 'var(--bronze)' : n.person ? 'var(--ink)' : 'var(--insert-stock)', borderColor: 'var(--ink-muted)' }} />
                          {n.via && (
                            <button type="button" className="block min-h-[22px] text-left font-display text-[11.5px] italic text-[var(--ink-faint)]" onClick={() => setDetail(n.via!)} aria-label={`Evidence: ${n.via.clause ?? n.via.phrase}, ${formatRef(n.via.evidence)}`}>
                              {n.via.relation ?? 'begat'}
                              {n.via.mother ? ` · ${n.via.mother}` : ''}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => (n.person && ed.personById.has(n.person) ? open({ kind: 'person', id: n.person }) : n.via && setDetail(n.via))}
                            className="min-h-[34px] text-left font-display text-[18px] leading-tight"
                            style={{ fontWeight: n.person ? 600 : 400, color: isFocus ? 'var(--bronze-deep)' : undefined }}
                            data-testid={`gen-node-${n.id}`}
                          >
                            {n.name}
                            {read && <span className="ml-1.5 text-[11px] italic text-[var(--pencil)]">met</span>}
                          </button>
                          {n.id === 'jacob' && showBranch && (
                            <div className="mb-3 ml-1 mt-1 rounded-[2px] border hairline px-3 py-2" data-testid="gatefold-branch">
                              <p className="label-caps text-[9.5px] text-[var(--bronze-deep)]">{branch.label}</p>
                              {branch.groups.map((gr) => (
                                <p key={gr.mother} className="mt-1 text-[14px] leading-snug">
                                  <span className="supp text-[12px] italic">of {gr.mother}: </span>
                                  {gr.children.join(', ')} <span className="supp text-[11px]">({formatRef(gr.evidence).replace('Genesis ', 'Gen ')})</span>
                                </p>
                              ))}
                              <p className="supp mt-1 text-[11.5px] italic">Matthew follows the line of Judah (spelled Judas in Matthew 1:2).</p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </motion.section>
            ))}
          </div>
          <div className="insert-stock grain relative px-5 py-4 md:px-8">
            <div className="relative z-[1] space-y-1">
              {(g.nameForms ?? []).map((f) => (
                <p key={f.forms.join()} className="supp text-[12.5px] italic">
                  {f.note}
                </p>
              ))}
            </div>
          </div>
        </div>
        {detail && <EvidenceCard detail={detail} onClose={() => setDetail(null)} />}
      </motion.div>
    </div>
  );
}
