/**
 * Audio architecture.
 *
 * An AudioSource reads Scripture aloud verse by verse and reports which verse is being read, so the
 * page can follow. Two kinds are defined:
 *
 *  - RecordedAudioSource: an authorised recorded edition (per-chapter files with verse timings,
 *    described by an audio manifest). None is installed in this build — licensed narration is
 *    supplied by the rights holder, never generated.
 *  - DeviceVoiceSource: the reader's own device voice (Web Speech API). It reads the exact verse
 *    text and is always labelled "device voice — not a recorded edition".
 *
 * Neither ever alters the words: the text passed in is the translation's text, unchanged.
 */
import type { Verse } from '@/lib/content/types';

export interface PlayOptions {
  rate: number;
  voice?: string | null;
  onVerse: (v: Verse) => void;
  onEnd: () => void;
}

export interface AudioSource {
  id: string;
  name: string;
  kind: 'recorded' | 'device-voice';
  description: string;
  available(): boolean;
  play(verses: Verse[], opts: PlayOptions): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface AudioManifest {
  translation: string;
  narrator: string;
  licence: string;
  chapters: Record<string, { url: string; timings: { verse: number; start: number }[] }>;
}

/** Plays an authorised recorded edition described by an AudioManifest (none installed here). */
export class RecordedAudioSource implements AudioSource {
  id = 'recorded';
  kind = 'recorded' as const;
  description: string;
  private el: HTMLAudioElement | null = null;
  constructor(
    readonly name: string,
    private manifest: AudioManifest | null,
  ) {
    this.description = manifest ? `${manifest.narrator} · ${manifest.licence}` : 'No recorded edition is installed in this build.';
  }
  available() {
    return !!this.manifest;
  }
  play(verses: Verse[], opts: PlayOptions) {
    if (!this.manifest || !verses.length) return;
    const ch = this.manifest.chapters[`${verses[0].book}.${verses[0].chapter}`];
    if (!ch) return opts.onEnd();
    this.el = new Audio(ch.url);
    this.el.playbackRate = opts.rate;
    const start = ch.timings.find((t) => t.verse === verses[0].verse)?.start ?? 0;
    this.el.currentTime = start;
    this.el.ontimeupdate = () => {
      const t = this.el!.currentTime;
      const cur = [...ch.timings].reverse().find((x) => x.start <= t);
      const v = verses.find((x) => x.verse === cur?.verse);
      if (v) opts.onVerse(v);
    };
    this.el.onended = opts.onEnd;
    void this.el.play();
  }
  pause() {
    this.el?.pause();
  }
  resume() {
    void this.el?.play();
  }
  stop() {
    this.el?.pause();
    this.el = null;
  }
}

/** The device's own speech synthesis, verse by verse. */
export class DeviceVoiceSource implements AudioSource {
  id = 'device-voice';
  name = 'Device voice';
  kind = 'device-voice' as const;
  description = 'Your device’s built-in voice reads the text. It is not a recorded edition.';
  private queue: Verse[] = [];
  private opts: PlayOptions | null = null;
  private stopped = true;

  available() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  voices(): SpeechSynthesisVoice[] {
    return this.available() ? speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en')) : [];
  }

  play(verses: Verse[], opts: PlayOptions) {
    if (!this.available()) return;
    speechSynthesis.cancel();
    this.queue = [...verses];
    this.opts = opts;
    this.stopped = false;
    this.next();
  }

  private next() {
    if (this.stopped || !this.opts) return;
    const v = this.queue.shift();
    if (!v) {
      this.stopped = true;
      this.opts.onEnd();
      return;
    }
    const u = new SpeechSynthesisUtterance(v.text);
    u.rate = this.opts.rate;
    const voice = this.voices().find((x) => x.name === this.opts!.voice);
    if (voice) u.voice = voice;
    u.onstart = () => this.opts?.onVerse(v);
    u.onend = () => this.next();
    u.onerror = () => this.next();
    speechSynthesis.speak(u);
  }

  pause() {
    if (this.available()) speechSynthesis.pause();
  }
  resume() {
    if (this.available()) speechSynthesis.resume();
  }
  stop() {
    this.stopped = true;
    this.queue = [];
    if (this.available()) speechSynthesis.cancel();
  }
}

export const deviceVoice = new DeviceVoiceSource();
export const recorded = new RecordedAudioSource('Recorded edition', null);
