'use client';
import { useState, type ReactNode } from 'react';
import { deviceVoice } from '@/lib/audio/audio';
import { TRANSLATIONS } from '@/lib/content/translation';
import { downloadForOffline, type OfflineProgress } from '@/lib/offline';
import { account, useAccount } from '@/lib/sync/sync';
import { FONT_SIZES, LINE_HEIGHTS, type MotionPref, type Theme } from '@/lib/state/reader-state';
import { isEditorialPreview } from '@/lib/content/editorial';
import { useReader } from './ReaderContext';
import { Sheet } from './Sheet';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t hairline py-3 first:border-t-0">
      <span className="font-display text-[16px]">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: ReactNode; aria?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border hairline p-0.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          aria-label={o.aria}
          onClick={() => onChange(o.v)}
          className="min-h-[40px] min-w-[44px] rounded-full px-3 font-display text-[14px] transition-colors"
          style={{ background: value === o.v ? 'var(--ink)' : 'transparent', color: value === o.v ? 'var(--paper)' : 'var(--ink-muted)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!on)}
      className="relative h-[30px] w-[52px] rounded-full border hairline transition-colors"
      style={{ background: on ? 'var(--bronze)' : 'transparent' }}
    >
      <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full shadow transition-all" style={{ left: on ? 25 : 3, background: on ? 'var(--paper)' : 'var(--ink-faint)' }} />
    </button>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="label-caps mb-1 mt-7 text-[10px] text-[var(--bronze-deep)]">{children}</p>;
}

function Listening() {
  const { state, updateSettings, audio } = useReader();
  const voices = deviceVoice.voices();
  return (
    <>
      <Row label="Speed">
        <Seg<number> label="Speed" value={state.settings.audioRate} onChange={(v) => updateSettings({ audioRate: v })} options={[0.75, 1, 1.25, 1.5].map((v) => ({ v, label: `${v}×` }))} />
      </Row>
      {voices.length > 0 && (
        <Row label="Voice">
          <select value={state.settings.audioVoice ?? ''} onChange={(e) => updateSettings({ audioVoice: e.target.value || null })} className="max-w-[180px] rounded-[2px] border hairline bg-transparent px-2 py-1.5 font-display text-[13px]" aria-label="Voice">
            <option value="">Default</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </Row>
      )}
      <p className="supp text-[12.5px] italic leading-snug">
        {audio.available ? 'Listening uses your device’s own voice to read the exact text. It is not a recorded edition; an authorised recording can be added without changing anything else.' : 'This device has no speech voice available.'}
        {state.audio.ref ? ' It resumes where you stopped.' : ''}
      </p>
    </>
  );
}

function Offline({ translation }: { translation: string }) {
  const [p, setP] = useState<OfflineProgress | null>(null);
  return (
    <div>
      <p className="supp text-[13px] leading-snug">Every chapter you open is kept for offline reading. You can also keep the whole Bible on this device (about 5 MB of text, plus the study notes).</p>
      <button type="button" className="btn-card mt-2" disabled={!!p && !p.done} onClick={() => void downloadForOffline(translation, setP)} data-testid="download-offline">
        {!p ? 'Keep the whole Bible offline' : p.done ? (p.failed ? `Kept ${p.loaded} of ${p.total} — try again` : 'The whole Bible is on this device ✓') : `Keeping… ${p.loaded} of ${p.total}`}
      </button>
    </div>
  );
}

function SyncRow() {
  const session = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!account.configured)
    return <p className="supp text-[13px] leading-snug">Reading needs no account. Your place, memory, ribbons, highlights and notes are kept on this device.</p>;
  if (session)
    return (
      <div className="supp text-[13.5px] leading-snug" data-testid="sync-signed-in">
        Signed in as <span className="font-display">{session.email}</span>. Your reading place, marks and private notes follow you to your other devices. Only you can read them.{' '}
        <button type="button" className="underline" onClick={() => account.signOut()}>
          Sign out
        </button>
      </div>
    );
  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'The sync service could not be reached.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void run(() => account.signIn(email, password))(); }} data-testid="sync-form">
      <p className="supp text-[13px] leading-snug">Optional. Sign in to keep your place, highlights and private notes on all your devices. Reading never needs an account.</p>
      <input id="sync-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="min-h-[42px] w-full rounded-[2px] border hairline bg-transparent px-3 font-display text-[15px]" aria-label="Email" />
      <input id="sync-password" type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8 or more characters)" className="min-h-[42px] w-full rounded-[2px] border hairline bg-transparent px-3 font-display text-[15px]" aria-label="Password" />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-card flex-1">
          Sign in
        </button>
        <button
          type="button"
          disabled={busy || !email || password.length < 8}
          className="btn-card flex-1"
          onClick={run(async () => {
            const signedIn = await account.signUp(email, password);
            if (!signedIn) setMsg('Account created. Confirm the email we sent you, then sign in.');
          })}
        >
          Create account
        </button>
      </div>
      {msg && <p className="supp text-[12.5px] italic" role="status">{msg}</p>}
    </form>
  );
}

export function SettingsPanel() {
  const { state, updateSettings, ed, update, open } = useReader();
  const s = state.settings;
  return (
    <Sheet label="Reading settings" eyebrow="Reading" title="Type & page" testId="settings-panel">
      <div className="mb-4 rounded-[2px] border hairline px-4 py-3 text-center" aria-hidden>
        <p style={{ fontSize: FONT_SIZES[s.fontStep], lineHeight: LINE_HEIGHTS[s.lineStep] }}>
          <sup className="verse-num">10</sup>When they saw the star, they rejoiced with exceeding great joy.
        </p>
      </div>
      <Row label="Text size">
        <button type="button" className="btn-quiet font-display text-[15px]" aria-label="Smaller text" data-testid="font-smaller" disabled={s.fontStep === 0} onClick={() => updateSettings({ fontStep: Math.max(0, s.fontStep - 1) })}>
          A
        </button>
        <span className="w-10 text-center font-display text-[13px] tabular-nums text-[var(--ink-muted)]" aria-live="polite">
          {FONT_SIZES[s.fontStep]}
        </span>
        <button type="button" className="btn-quiet font-display text-[22px]" aria-label="Larger text" data-testid="font-larger" disabled={s.fontStep === FONT_SIZES.length - 1} onClick={() => updateSettings({ fontStep: Math.min(FONT_SIZES.length - 1, s.fontStep + 1) })}>
          A
        </button>
      </Row>
      <Row label="Line spacing">
        <Seg label="Line spacing" value={s.lineStep} onChange={(v) => updateSettings({ lineStep: v })} options={[{ v: 0, label: 'Close' }, { v: 1, label: 'Book' }, { v: 2, label: 'Open' }]} />
      </Row>
      <Row label="Page">
        <Seg<Theme>
          label="Page colour"
          value={s.theme}
          onChange={(v) => updateSettings({ theme: v })}
          options={[
            { v: 'paper', label: 'Paper' },
            { v: 'night', label: 'Night' },
            { v: 'contrast', label: 'Contrast', aria: 'High contrast' },
          ]}
        />
      </Row>
      <Row label="Motion">
        <Seg<MotionPref>
          label="Motion"
          value={s.motion}
          onChange={(v) => updateSettings({ motion: v })}
          options={[
            { v: 'system', label: 'System' },
            { v: 'reduce', label: 'Reduce' },
            { v: 'full', label: 'Full' },
          ]}
        />
      </Row>
      <Row label="Margin notes & places">
        <Toggle on={s.marginNotes} onChange={(v) => updateSettings({ marginNotes: v })} label="Margin notes and place links" testId="toggle-margin" />
      </Row>
      <Row label="Memory notes (“been here before”)">
        <Toggle on={s.memoryNotes} onChange={(v) => updateSettings({ memoryNotes: v })} label="Memory notes in the margin" testId="toggle-memory" />
      </Row>
      <Row label="Two-page spread on wide screens">
        <Toggle on={s.spread} onChange={(v) => updateSettings({ spread: v })} label="Two-page spread" testId="toggle-spread" />
      </Row>
      <Row label="Page sounds">
        <Toggle on={s.sound} onChange={(v) => updateSettings({ sound: v, ambience: v ? s.ambience : false })} label="Quiet page sounds" testId="toggle-sound" />
      </Row>
      <Row label="Room tone">
        <Toggle on={s.ambience} onChange={(v) => updateSettings({ ambience: v, sound: v ? true : s.sound })} label="Very faint ambient room tone" />
      </Row>
      <Row label="Verse by verse">
        <Seg label="Layout" value={s.layout} onChange={(v) => updateSettings({ layout: v })} options={[{ v: 'paragraph', label: 'Book' }, { v: 'verse', label: 'Verses' }]} />
      </Row>
      <Row label="Typeface for easier reading">
        <Toggle on={s.legible} onChange={(v) => updateSettings({ legible: v })} label="Use a typeface designed for legibility" testId="toggle-legible" />
      </Row>

      <Heading>Translation</Heading>
      <div role="radiogroup" aria-label="Translation" className="space-y-1">
        {TRANSLATIONS.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={s.translation === t.id} onClick={() => updateSettings({ translation: t.id })} className="flex w-full items-baseline justify-between gap-3 rounded-[2px] border hairline px-3 py-2 text-left" style={{ borderColor: s.translation === t.id ? 'var(--bronze)' : undefined }} data-testid={`translation-${t.id}`}>
            <span className="font-display text-[16px]">
              {t.name} <span className="text-[12px] text-[var(--ink-faint)]">{t.abbreviation}</span>
            </span>
            <span className="supp shrink-0 text-[12px] italic">{t.year}</span>
          </button>
        ))}
      </div>
      <p className="supp mt-2 text-[12.5px] leading-snug">{ed.translation.translation.copyright}</p>
      {s.translation === 'kjv' && (
        <Row label="Supplied words in italics (as printed in the KJV)">
          <Toggle on={s.italics} onChange={(v) => updateSettings({ italics: v })} label="Show the words the translators supplied in italics" testId="toggle-italics" />
        </Row>
      )}
      {s.translation !== 'kjv' && <p className="supp mt-1 text-[12px] italic text-[var(--ink-faint)]">Place names are tapped in the KJV only; memory and margin notes still follow the verses you read.</p>}

      <Heading>Discoveries</Heading>
      <Row label="Show connections up to">
        <Seg<1 | 2 | 3 | 4> label="Evidence level" value={s.maxLevel} onChange={(v) => updateSettings({ maxLevel: v })} options={[{ v: 1, label: '1', aria: 'Explicit quotations only' }, { v: 2, label: '2', aria: 'Quotations and fulfilments' }, { v: 3, label: '3', aria: 'Also direct references' }, { v: 4, label: '4', aria: 'Also textual parallels' }]} />
      </Row>
      <p className="supp -mt-1 text-[12px] italic text-[var(--ink-faint)]">1 explicit quotation · 2 explicit fulfilment · 3 direct reference · 4 strong textual parallel</p>
      <Row label="Links found by shared wording">
        <Toggle on={s.machineLinks} onChange={(v) => updateSettings({ machineLinks: v })} label="Show links found by shared wording (awaiting review)" testId="toggle-machine" />
      </Row>
      <Row label="Repeated wording marks">
        <Toggle on={s.discoveries} onChange={(v) => updateSettings({ discoveries: v })} label="Quiet marks where wording repeats elsewhere" />
      </Row>

      <Heading>Listening</Heading>
      <Listening />

      <Heading>Family & your Bible</Heading>
      <Row label="Family reading">
        <button type="button" className="btn-quiet px-3 text-[14px] italic" onClick={() => open({ kind: 'family' })} data-testid="open-family">
          {s.family ? 'On · plans' : 'Open'} →
        </button>
      </Row>
      <Row label="Highlights, notes, favourites">
        <button type="button" className="btn-quiet px-3 text-[14px] italic" onClick={() => open({ kind: 'mine' })}>
          Open →
        </button>
      </Row>

      <Heading>Offline</Heading>
      <Offline translation={s.translation} />

      <Heading>Account & sync</Heading>
      <SyncRow />

      <div className="mt-6 border-t hairline pt-4">
        <p className="label-caps text-[10px] text-[var(--ink-faint)]">This edition</p>
        <p className="supp mt-1 text-[14px] leading-snug">
          Scripture: {ed.translation.translation.name} ({ed.translation.translation.abbreviation}). Maps, notes, inserts and threads are supplementary and printed in a different face.
        </p>
        {isEditorialPreview && (
          <p className="supp mt-2 text-[13px] italic leading-snug" data-testid="editorial-preview-note">
            Editorial preview: the supplementary notes in this build are drafts awaiting human review. Scripture itself is not affected.
          </p>
        )}
        <p className="supp mt-2 text-[13px] leading-snug">Your reading place, ribbons, highlights, notes and the places and people you have met are kept on this device{account.configured ? ' (and in your account if you sign in)' : ''}.</p>
        <button type="button" className="btn-quiet -ml-2 mt-2 px-2 text-[13px] italic" onClick={() => update({ places: {}, people: {}, phrases: {}, journeyHistory: [], threadProgress: {} })} data-testid="reset-memory">
          Clear the pencil marks (places, people and phrases met)
        </button>
      </div>
    </Sheet>
  );
}
