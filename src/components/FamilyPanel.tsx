'use client';
import { formatChapter } from '@/lib/content/refs';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

/**
 * Family reading. Scripture is never rewritten or simplified for children — Family Mode changes only the
 * page around it: larger type, fewer margin notes (explicit quotations and fulfilments only), and short
 * reading plans a household can follow together.
 */
export const PLANS: { id: string; title: string; about: string; chapters: string[] }[] = [
  { id: 'beginnings', title: 'In the beginning', about: 'Creation to the flood and the call of Abram', chapters: ['Gen.1', 'Gen.2', 'Gen.3', 'Gen.6', 'Gen.7', 'Gen.8', 'Gen.9', 'Gen.12'] },
  { id: 'joseph', title: 'Joseph and his brothers', about: 'Genesis 37–50, the family story', chapters: ['Gen.37', 'Gen.39', 'Gen.40', 'Gen.41', 'Gen.42', 'Gen.43', 'Gen.44', 'Gen.45', 'Gen.46', 'Gen.50'] },
  { id: 'exodus', title: 'Out of Egypt', about: 'Moses, the Passover and the sea', chapters: ['Exod.1', 'Exod.2', 'Exod.3', 'Exod.12', 'Exod.14', 'Exod.16', 'Exod.19', 'Exod.20'] },
  { id: 'david', title: 'David the shepherd', about: 'From the fields of Bethlehem to the throne', chapters: ['1Sam.16', '1Sam.17', '1Sam.18', '1Sam.20', '2Sam.5', 'Ps.23'] },
  { id: 'christmas', title: 'The birth of Jesus', about: 'Matthew and Luke', chapters: ['Luke.1', 'Luke.2', 'Matt.1', 'Matt.2'] },
  { id: 'mark', title: 'The Gospel of Mark', about: 'A whole Gospel, one chapter at a time', chapters: Array.from({ length: 16 }, (_, i) => `Mark.${i + 1}`) },
];

export function FamilyPanel() {
  const { state, updateSettings, update, goTo, close } = useReader();
  const on = state.settings.family;
  return (
    <Sheet label="Family reading" eyebrow="Together" title="Family reading" testId="family-panel" maxHeight="86dvh">
      <div className="flex items-center justify-between gap-4 rounded-[2px] border hairline px-4 py-3">
        <div>
          <p className="font-display text-[17px]">Family Mode</p>
          <p className="supp text-[13px] italic text-[var(--ink-muted)]">Larger type and a quieter margin. The words of Scripture are exactly the same.</p>
        </div>
        <button type="button" role="switch" aria-checked={on} onClick={() => updateSettings({ family: !on })} className="relative h-[30px] w-[52px] shrink-0 rounded-full border hairline" style={{ background: on ? 'var(--bronze)' : 'transparent' }} data-testid="family-toggle" aria-label="Family Mode">
          <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full shadow transition-all" style={{ left: on ? 25 : 3, background: on ? 'var(--paper)' : 'var(--ink-faint)' }} />
        </button>
      </div>

      <p className="label-caps mt-6 text-[10px] text-[var(--ink-faint)]">Reading plans</p>
      <ul className="mt-1">
        {PLANS.map((p) => {
          const mine = state.plans.find((x) => x.id === p.id);
          const next = p.chapters.find((c) => !mine?.done.includes(c)) ?? p.chapters[0];
          return (
            <li key={p.id} className="border-t hairline py-3 first:border-t-0" data-plan={p.id}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-[17px]">{p.title}</p>
                <p className="supp text-[12px] italic text-[var(--ink-faint)]">{p.chapters.length} readings</p>
              </div>
              <p className="supp text-[13px] text-[var(--ink-muted)]">{p.about}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {p.chapters.map((c) => (
                  <span key={c} className="rounded-full border hairline px-2 py-0.5 font-display text-[11.5px]" style={{ background: mine?.done.includes(c) ? 'color-mix(in srgb, var(--bronze) 18%, transparent)' : undefined }}>
                    {formatChapter(c)}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn-quiet -ml-2 px-2 text-[14px] italic"
                  onClick={() => {
                    if (!mine) update((s) => ({ plans: [...s.plans, { id: p.id, startedAt: Date.now(), done: [] }] }));
                    goTo(next, 1);
                    close();
                  }}
                >
                  {mine ? `Continue · ${formatChapter(next)}` : 'Begin'} →
                </button>
                {mine && (
                  <button type="button" className="btn-quiet px-2 text-[13px] italic text-[var(--ink-faint)]" onClick={() => update((s) => ({ plans: s.plans.map((x) => (x.id === p.id ? { ...x, done: [...new Set([...x.done, next])] } : x)) }))}>
                    Mark {formatChapter(next)} read
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
