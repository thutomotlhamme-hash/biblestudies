'use client';
import { useEffect, useMemo, useState } from 'react';
import { DEEP_LEVEL_LABEL, LEVEL_LABEL, STATUS_ORDER } from '@/lib/content/editorial';
import { allBooks, formatRef } from '@/lib/content/refs';
import { getLibrary } from '@/lib/content/repository';
import { TRANSLATIONS } from '@/lib/content/translation';
import type { EditorialStatus } from '@/lib/content/types';
import { useLibrary } from '@/lib/library/useLibrary';
import { account, rest, useAccount } from '@/lib/sync/sync';

type Row = { type: string; id: string; title: string; level: string; status: EditorialStatus; author: string; source: string; method: string; notes?: string | null; refs: string };
type Review = { type: string; id: string; status: EditorialStatus | 'rejected'; reviewer: string; note: string; at: string; checkedAgainstText: boolean; server?: boolean };
type ServerReview = { object_type: string; object_id: string; status: Review['status']; reviewer_name: string; note: string | null; created_at: string; checked_against_text: boolean };
const toServerType = (t: string) => t.toLowerCase();
const fromServer = (r: ServerReview): Review => ({ type: r.object_type[0].toUpperCase() + r.object_type.slice(1), id: r.object_id, status: r.status, reviewer: r.reviewer_name, note: r.note ?? '', at: r.created_at, checkedAgainstText: r.checked_against_text, server: true });

const LEDGER = 'holy-bible.editorial-ledger';
const readLedger = (): Review[] => {
  try {
    return JSON.parse(localStorage.getItem(LEDGER) ?? '[]');
  } catch {
    return [];
  }
};

/**
 * Editorial desk (internal). Every supplementary object with its provenance and lifecycle
 * (draft → researched → reviewed → approved → published). Reviews are recorded in a ledger that
 * the content pipeline applies at build (scripts/pipeline/study.py reads content/editorial/reviews.json).
 *
 * Scripture cannot be edited here — it is shown only as read-only checksums. AI never publishes:
 * a review needs a named human reviewer who confirms they checked the claim against the text.
 */
export function EditorialDesk() {
  const { lib: ed, version } = useLibrary();
  const [filter, setFilter] = useState('Connection');
  const [status, setStatus] = useState<'all' | EditorialStatus>('all');
  const [method, setMethod] = useState<'all' | 'curated' | 'text-match'>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [loadingAll, setLoadingAll] = useState(0);
  const [ledger, setLedger] = useState<Review[]>([]);
  const [reviewer, setReviewer] = useState('');
  const [open, setOpen] = useState<Row | null>(null);
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const session = useAccount();
  const [editor, setEditor] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [server, setServer] = useState<Review[]>([]);
  const [deskMsg, setDeskMsg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signed-in editors review against the shared ledger in Supabase (hb_editorial_reviews).
  useEffect(() => {
    if (!session) return setEditor('unknown');
    let live = true;
    void (async () => {
      const ok = await account.isEditor();
      if (!live) return;
      setEditor(ok ? 'yes' : 'no');
      if (!ok) return;
      try {
        const me = (await rest(`hb_editors?select=display_name&user_id=eq.${session.userId}`)) as { display_name: string }[];
        if (live && me?.[0]) setReviewer((r) => r || me[0].display_name);
        const all = (await rest('hb_editorial_reviews?select=object_type,object_id,status,reviewer_name,note,created_at,checked_against_text&order=created_at.asc')) as ServerReview[];
        if (live) setServer(all.map(fromServer));
      } catch (e) {
        if (live) setDeskMsg(`The shared ledger could not be reached (${(e as Error).message}). Decisions are kept on this device.`);
      }
    })();
    return () => {
      live = false;
    };
  }, [session]);

  useEffect(() => {
    setLedger(readLedger());
    const lib = getLibrary();
    void lib.init().then(() => Promise.all([lib.ensurePlaces(), lib.ensurePeople(), lib.ensureTimeline(), loadAll()]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async () => {
    let n = 0;
    const queue = [...allBooks()];
    const work = async () => {
      for (let b = queue.shift(); b; b = queue.shift()) {
        await ed.ensureBook(b.osis).catch(() => {});
        setLoadingAll(++n);
      }
    };
    await Promise.all([work(), work(), work(), work()]);
  };

  const rows = useMemo<Row[]>(() => {
    const r: Row[] = [];
    ed.connections.forEach((c) => r.push({ type: 'Connection', id: c.id, title: `${formatRef(c.anchorVerse)} → ${c.targets.map((t) => formatRef(t.ref)).join(', ') || '—'}`, level: `${c.level} · ${LEVEL_LABEL[c.level]}`, status: c.editorial.status, author: c.editorial.author, source: c.source, method: c.method, notes: c.targets[0]?.sharedPhrase ? `“${c.targets[0].sharedPhrase}”` : c.notes, refs: c.types.join(', ') }));
    ed.places.filter((p) => !p.partial).forEach((p) => r.push({ type: 'Place', id: p.id, title: p.name, level: p.certainty, status: p.editorial?.status ?? 'draft', author: p.editorial?.author ?? '', source: p.source, method: p.identification ? 'curated' : 'text-match', notes: p.modern ?? p.identification, refs: `${p.verses?.length ?? 0} verses` }));
    ed.people.filter((p) => !p.partial).forEach((p) => r.push({ type: 'Person', id: p.id, title: p.name, level: p.evidenceLevel, status: p.editorial?.status ?? 'draft', author: p.editorial?.author ?? '', source: p.source, method: p.summary ? 'curated' : 'text-match', notes: `${p.relationships.filter((x) => x.basis === 'stated').length}/${p.relationships.length} family links stated in a verse`, refs: `${p.verses?.length ?? 0} verses` }));
    ed.journeys.forEach((j) => j.segments.forEach((s) => r.push({ type: 'Journey', id: s.id, title: `${j.name}: ${s.label}`, level: s.certainty, status: j.editorial.status, author: j.editorial.author, source: j.source, method: j.origin === 'curated' ? 'curated' : 'text-match', notes: s.note ?? `${s.from} → ${s.to}`, refs: s.verses.map(formatRef).join('; ') })));
    ed.threads.forEach((t) => r.push({ type: 'Thread', id: t.id, title: t.name, level: t.evidenceLevel, status: t.editorial.status, author: t.editorial.author, source: t.source, method: 'text-match', notes: t.match, refs: `${t.count} passages` }));
    ed.timeline.forEach((t) => r.push({ type: 'Timeline', id: t.id, title: t.label, level: t.certainty, status: t.editorial.status, author: t.editorial.author, source: t.source, method: t.origin === 'curated' ? 'curated' : 'text-match', notes: t.note, refs: t.refs.map(formatRef).join('; ') }));
    ed.genealogies.forEach((g) => r.push({ type: 'Genealogy', id: g.id, title: g.title, level: g.evidenceLevel, status: g.editorial.status, author: g.editorial.author, source: g.source, method: 'curated', notes: g.note, refs: `${g.edges.length} links` }));
    ed.scale?.sets.forEach((s) => r.push({ type: 'Scale', id: s.id, title: s.title, level: 'A', status: ed.scale!.editorial.status, author: ed.scale!.editorial.author, source: ed.scale!.source, method: 'curated', notes: `${s.items.length} measurements`, refs: formatRef(s.anchor) }));
    // Deep Made Simple: research, links and stories, each with its claims' verses
    for (const items of ed.deep.items.values())
      items.forEach((d) => r.push({ type: 'Deep', id: d.id, title: `${d.kind === 'link' ? 'Link' : `Research · ${d.topic}`}: ${d.title}`, level: `${d.level} · ${d.scale === 'deep' ? DEEP_LEVEL_LABEL[d.level] : LEVEL_LABEL[d.level]}`, status: d.editorial.status, author: d.editorial.author, source: d.source, method: d.method === 'text-match' ? 'text-match' : 'curated', notes: d.claims.map((c) => c.text + (c.quote ? ` “${c.quote.text}”` : '')).join(' '), refs: [...new Set(d.claims.flatMap((c) => c.refs))].map(formatRef).join('; ') }));
    ed.deep.stories.forEach((s) => r.push({ type: 'Deep', id: s.id, title: `Story: ${s.title}`, level: `${s.level} · ${DEEP_LEVEL_LABEL[s.level]}`, status: s.editorial.status, author: s.editorial.author, source: s.source, method: 'curated', notes: s.steps.map((x) => `${formatRef(x.ref)} “${x.phrase}”${x.why ? ` (${x.why.text})` : ''}`).join(' → '), refs: `${s.steps.length} passages` }));
    ed.inserts.forEach((i) => r.push({ type: 'Insert', id: i.id, title: i.title, level: i.evidenceLevel, status: i.editorial.status, author: i.editorial.author, source: i.sources ?? '—', method: 'curated', refs: formatRef(i.anchorVerse) }));
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ed, version]);

  const latest = useMemo(() => {
    const m = new Map<string, Review>();
    for (const x of [...server, ...ledger].sort((a, b) => a.at.localeCompare(b.at))) m.set(`${x.type}:${x.id}`, x);
    return m;
  }, [ledger, server]);
  const types = [...new Set(rows.map((r) => r.type))];
  const shown = rows.filter((r) => r.type === filter && (status === 'all' || (latest.get(`${r.type}:${r.id}`)?.status ?? r.status) === status) && (method === 'all' || r.method === method) && (!q || (r.title + r.notes + r.id).toLowerCase().includes(q.toLowerCase())));
  const PAGE = 150;
  const counts = rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});

  const record = async (target: EditorialStatus | 'rejected') => {
    if (!open || !reviewer.trim() || !checked) return;
    const entry: Review = { type: open.type, id: open.id, status: target, reviewer: reviewer.trim(), note, at: new Date().toISOString(), checkedAgainstText: checked };
    if (editor === 'yes') {
      try {
        await rest('hb_editorial_reviews', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ object_type: toServerType(entry.type), object_id: entry.id, status: entry.status, reviewer_name: entry.reviewer, note: entry.note || null, checked_against_text: true }) });
        setServer((s) => [...s, { ...entry, server: true }]);
        setDeskMsg('');
      } catch (e) {
        setDeskMsg(`Not saved to the shared ledger (${(e as Error).message}). Kept on this device — export it or try again.`);
        const next = [...ledger, entry];
        setLedger(next);
        localStorage.setItem(LEDGER, JSON.stringify(next));
      }
    } else {
      const next = [...ledger, entry];
      setLedger(next);
      localStorage.setItem(LEDGER, JSON.stringify(next));
    }
    setOpen(null);
    setNote('');
    setChecked(false);
  };

  return (
    <main className="min-h-full bg-[var(--paper)] px-4 py-8 text-[var(--ink)] md:px-10" style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      <p className="label-caps text-[var(--ink-muted)]">The Holy Bible · internal</p>
      <h1 className="font-display text-[34px] font-medium">Editorial desk</h1>
      <p className="supp max-w-[70ch] text-[15px]">
        Every supplementary object, its provenance and its place in the lifecycle <em>{STATUS_ORDER.join(' → ')}</em>. Nothing generated by AI or by the text-matching pipeline is published without a named human reviewer. Production builds set <code>NEXT_PUBLIC_MIN_EDITORIAL_STATUS=published</code>. Scripture is not editable here.
      </p>
      <p className="mt-3 font-display text-[14px]">
        {rows.length.toLocaleString()} objects loaded · {Object.entries(counts).map(([k, v]) => `${v.toLocaleString()} ${k}`).join(' · ')} · {server.length + ledger.length} review decisions ({server.length} shared, {ledger.length} on this device)
      </p>

      <section className="mt-4 rounded-[2px] border hairline p-4 font-display text-[13.5px]" aria-label="Editor account" data-testid="desk-account">
        <p className="label-caps text-[10px] text-[var(--ink-faint)]">Shared ledger</p>
        {!account.configured ? (
          <p className="supp mt-1">Sync is not configured in this build; decisions are kept on this device and exported as reviews.json.</p>
        ) : !session ? (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setDeskMsg('');
              account.signIn(email.trim(), password).catch((err: Error) => setDeskMsg(err.message));
            }}
          >
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="Editor email" className="rounded-[2px] border hairline bg-transparent px-2 py-1.5" aria-label="Editor email" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="Password" className="rounded-[2px] border hairline bg-transparent px-2 py-1.5" aria-label="Password" />
            <button type="submit" className="btn-quiet border hairline px-3">Sign in</button>
            <span className="supp text-[12.5px] italic">Editors record decisions to the shared ledger; everyone else keeps a local ledger.</span>
          </form>
        ) : (
          <p className="mt-1">
            Signed in as {session.email} ·{' '}
            {editor === 'yes' ? 'editor — decisions go to the shared ledger' : editor === 'no' ? 'not an editor — decisions are kept on this device' : 'checking…'}{' '}
            <button type="button" className="btn-quiet underline" onClick={() => account.signOut()}>
              Sign out
            </button>
          </p>
        )}
        {deskMsg && <p className="supp mt-2 text-[12.5px] italic" role="status">{deskMsg}</p>}
      </section>

      <section className="mt-5 rounded-[2px] border hairline p-4" aria-label="Scripture integrity (read-only)">
        <p className="label-caps text-[10px] text-[var(--ink-faint)]">Scripture · read-only</p>
        <p className="supp mt-1 text-[13.5px]">
          {TRANSLATIONS.map((t) => `${t.abbreviation} (${t.verses.toLocaleString()} verses, ${t.licence})`).join(' · ')}. Each chapter carries a SHA-256 checksum in <code>data/text/&lt;translation&gt;/manifest.json</code>; the integrity tests block any deployment in which a character differs.
        </p>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {types.map((t) => (
          <button key={t} type="button" onClick={() => { setFilter(t); setPage(0); }} className="tag min-h-[32px]" style={{ opacity: filter === t ? 1 : 0.5 }}>
            {t} ({rows.filter((r) => r.type === t).length.toLocaleString()})
          </button>
        ))}
        {filter === 'Connection' && loadingAll < allBooks().length && (
          <button type="button" className="btn-quiet border hairline px-3 text-[13px]" onClick={() => void loadAll()} data-testid="desk-load-all">
            {loadingAll ? `Loading books… ${loadingAll}/66` : 'Load connections for all 66 books'}
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 font-display text-[13px]">
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-[2px] border hairline bg-transparent px-2 py-1.5" aria-label="Status">
          <option value="all">Any status</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="rounded-[2px] border hairline bg-transparent px-2 py-1.5" aria-label="Origin">
          <option value="all">Curated and machine</option>
          <option value="curated">Curated</option>
          <option value="text-match">Machine (pipeline)</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="rounded-[2px] border hairline bg-transparent px-2 py-1.5" aria-label="Filter" />
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name (reviewer)" className="rounded-[2px] border hairline bg-transparent px-2 py-1.5" aria-label="Reviewer name" />
        <button
          type="button"
          className="btn-quiet border hairline px-3"
          onClick={() => {
            const blob = new Blob([JSON.stringify([...latest.values()].map(({ server: _s, ...r }) => r), null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'reviews.json';
            a.click();
          }}
        >
          Export reviews.json
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] font-display text-[13.5px]" data-testid="editorial-table">
          <thead>
            <tr className="label-caps text-left text-[9.5px] text-[var(--ink-faint)]">
              {['Object', 'Evidence', 'Status', 'Origin', 'Author', 'Detail', 'References', ''].map((h) => (
                <th key={h} className="py-2 pr-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.slice(page * PAGE, (page + 1) * PAGE).map((r) => {
              const rev = latest.get(`${r.type}:${r.id}`);
              return (
                <tr key={r.type + r.id} className="border-t hairline align-top">
                  <td className="py-2 pr-3 font-semibold">{r.title}</td>
                  <td className="py-2 pr-3">{r.level}</td>
                  <td className="py-2 pr-3 italic">
                    {rev ? (
                      <>
                        {rev.status} <span className="text-[11px] not-italic text-[var(--ink-faint)]">(was {r.status}; {rev.reviewer})</span>
                      </>
                    ) : (
                      r.status
                    )}
                  </td>
                  <td className="py-2 pr-3 text-[12.5px]">{r.method === 'text-match' ? 'machine' : 'curated'}</td>
                  <td className="py-2 pr-3 text-[12.5px]">{r.author}</td>
                  <td className="py-2 pr-3 text-[12.5px]">{r.notes}</td>
                  <td className="py-2 pr-3 text-[12.5px]">{r.refs}</td>
                  <td className="py-2">
                    <button type="button" className="btn-quiet border hairline px-2 text-[12px]" onClick={() => setOpen(r)}>
                      Review
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length > PAGE && (
          <div className="mt-3 flex items-center gap-3 font-display text-[13px]">
            <button type="button" className="btn-quiet" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ← Previous
            </button>
            <span>
              {page * PAGE + 1}–{Math.min(shown.length, (page + 1) * PAGE)} of {shown.length.toLocaleString()}
            </span>
            <button type="button" className="btn-quiet" disabled={(page + 1) * PAGE >= shown.length} onClick={() => setPage((p) => p + 1)}>
              Next →
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Review">
          <div className="sheet w-full max-w-[520px] rounded-[3px] p-5">
            <p className="label-caps text-[10px] text-[var(--ink-faint)]">
              {open.type} · {open.id}
            </p>
            <h2 className="font-display text-[22px]">{open.title}</h2>
            <p className="supp mt-1 text-[13px]">{open.notes}</p>
            <p className="supp mt-1 text-[12px] italic">
              {open.source} · {open.author}
            </p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Review note (sources checked, corrections needed…)" className="mt-3 w-full rounded-[2px] border hairline bg-transparent p-2 font-display text-[14px]" />
            <label className="mt-2 flex items-center gap-2 font-display text-[13.5px]">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> I checked this claim against the text of Scripture myself.
            </label>
            {!reviewer.trim() && <p className="supp mt-2 text-[12px] italic">Enter your name as reviewer above to record a decision.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {(['researched', 'reviewed', 'approved', 'published', 'rejected'] as const).map((s) => (
                <button key={s} type="button" disabled={!reviewer.trim() || !checked} className="btn-quiet border hairline px-3 text-[13px] disabled:opacity-40" onClick={() => void record(s)}>
                  {s}
                </button>
              ))}
              <button type="button" className="btn-quiet ml-auto px-3 text-[13px]" onClick={() => setOpen(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
