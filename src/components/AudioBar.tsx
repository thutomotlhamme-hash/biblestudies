'use client';
import { motion } from 'framer-motion';
import { deviceVoice, recorded } from '@/lib/audio/audio';
import { formatRef } from '@/lib/content/refs';
import { IconClose, IconPause, IconPlay } from './Icons';
import { useReader } from './ReaderContext';

const RATES = [0.75, 1, 1.25, 1.5];
const SLEEP = [null, 10, 20, 30] as const;

/** A slim listening bar. The page follows the verse being read; the words are the translation's own. */
export function AudioBar({ lifted }: { lifted: boolean }) {
  const { audio, state, updateSettings, reduced } = useReader();
  const source = recorded.available() ? recorded : deviceVoice;
  const rate = state.settings.audioRate;
  const minutesLeft = audio.sleepAt ? Math.max(1, Math.round((audio.sleepAt - Date.now()) / 60000)) : null;
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="chrome fixed right-3 z-20 flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full border py-1 pl-1 pr-2 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.3)] md:right-6"
      style={{ bottom: `calc(${lifted ? 76 : 14}px + env(safe-area-inset-bottom))`, transition: 'bottom 280ms cubic-bezier(.3,0,.2,1)' }}
      role="region"
      aria-label="Listening"
      data-testid="audio-bar"
    >
      <button type="button" className="btn-quiet !min-w-[40px]" onClick={() => (audio.playing ? audio.pause() : audio.start(audio.ref ?? undefined))} aria-label={audio.playing ? 'Pause' : 'Resume listening'}>
        {audio.playing ? <IconPause /> : <IconPlay />}
      </button>
      <span className="min-w-0 truncate font-display text-[13px] tabular-nums text-[var(--ink-muted)]" aria-live="polite">
        {audio.ref ? formatRef(audio.ref) : ''}
      </span>
      <button type="button" className="btn-quiet !min-w-[40px] px-2 font-display text-[12px] tabular-nums" onClick={() => updateSettings({ audioRate: RATES[(RATES.indexOf(rate) + 1) % RATES.length] })} aria-label={`Speed ${rate} times. Change speed`}>
        {rate}×
      </button>
      <button
        type="button"
        className="btn-quiet !min-w-[40px] px-2 font-display text-[12px]"
        onClick={() => {
          const i = SLEEP.findIndex((m) => (m === null ? !audio.sleepAt : minutesLeft !== null && Math.abs(minutesLeft - m) < 2));
          audio.setSleep(SLEEP[(i + 1) % SLEEP.length]);
        }}
        aria-label={minutesLeft ? `Sleep timer: ${minutesLeft} minutes. Change` : 'Set a sleep timer'}
      >
        {minutesLeft ? `☾ ${minutesLeft}m` : '☾'}
      </button>
      <span className="supp hidden text-[11px] italic text-[var(--ink-faint)] md:inline" title={source.description}>
        {source.kind === 'device-voice' ? 'device voice' : source.name}
      </span>
      <button type="button" className="btn-quiet !min-w-[36px]" onClick={audio.stop} aria-label="Stop listening">
        <IconClose width={16} height={16} />
      </button>
    </motion.div>
  );
}
