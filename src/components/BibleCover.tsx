'use client';
import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface Props {
  continueLabel: string | null;
  /** The title leaf beneath the cover: the book the reader will open at. */
  leafTitle: { pre: string; main: string; post: string; chapter: number };
  /** Resolves when the first page's text is ready, so the hand-over never shows a blank or wrong page. */
  ready: () => Promise<unknown>;
  reduced: boolean;
  onOpened: () => void;
  onOpenStart: () => void;
}

/**
 * BibleCover + BookOpening.
 * A bound leather cover; on open it swings about the spine to reveal the title leaf,
 * then hands over to the reading page.
 */
export function BibleCover({ continueLabel, leafTitle, ready, reduced, onOpened, onOpenStart }: Props) {
  const cover = useAnimationControls();
  const leaf = useAnimationControls();
  const stage = useAnimationControls();
  const [opening, setOpening] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
  }, []);

  async function open() {
    if (opening) return;
    setOpening(true);
    onOpenStart();
    const text = ready().catch(() => {});
    if (reduced) {
      await text;
      await stage.start({ opacity: 0, transition: { duration: 0.18 } });
      onOpened();
      return;
    }
    await cover.start({
      rotateY: -168,
      transition: { duration: 0.78, ease: [0.5, 0.05, 0.2, 1] },
    });
    leaf.set({ opacity: 1 });
    // the page is handed over only once its text has arrived (normally long before this)
    await text;
    await stage.start({ scale: 1.03, opacity: 0, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } });
    onOpened();
  }

  return (
    <motion.div
      animate={stage}
      initial={{ opacity: 1, scale: 1 }}
      className="desk fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      data-testid="cover-stage"
    >
      <div className="relative" style={{ perspective: 2200 }}>
        {/* Text block beneath the cover (visible as the cover swings) */}
        <div
          className="book-dim relative grain rounded-r-[6px] page"
          style={{ transformStyle: 'preserve-3d', transform: 'scale(0.985, 0.975) translateX(3px)' }}
          aria-hidden
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            {leafTitle.pre && (
              <p className="running-head max-w-[16em]" style={{ letterSpacing: '0.3em' }}>
                {leafTitle.pre}
              </p>
            )}
            <p className="mt-3 font-display text-[clamp(28px,8vw,40px)] font-medium tracking-[0.08em] text-ink">{leafTitle.main}</p>
            {leafTitle.post && <p className="running-head mt-1 max-w-[18em] normal-case italic">{leafTitle.post}</p>}
            <div className="my-5 h-px w-16 bg-[var(--bronze)] opacity-50" />
            <p className="supp text-[15px] italic">Chapter {leafTitle.chapter}</p>
          </div>
          <div className="page-edges-right absolute -right-[5px] top-[3px] bottom-[3px] w-[5px] rounded-r-sm" />
        </div>

        {/* The cover itself */}
        <motion.button
          ref={btn}
          type="button"
          onClick={open}
          animate={cover}
          initial={{ rotateY: 0 }}
          style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
          className="book-dim leather absolute inset-0 cursor-pointer rounded-r-[7px] rounded-l-[3px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[rgba(233,210,154,0.6)]"
          aria-label={continueLabel ? `Open The Holy Bible and continue at ${continueLabel}` : 'Open The Holy Bible'}
          data-testid="bible-cover"
        >
          {/* spine hinge */}
          <span className="absolute left-0 top-0 bottom-0 w-[14px] rounded-l-[3px] bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
          <span className="absolute left-[14px] top-0 bottom-0 w-px bg-black/40" />
          {/* double gilt rules */}
          <span className="gilt-rule absolute inset-[16px] left-[26px] border" />
          <span className="gilt-rule absolute inset-[21px] left-[31px] border opacity-60" />
          <span className="absolute inset-0 flex flex-col items-center justify-center pl-3 text-center">
            <span className="gilt-text font-display text-[13px] font-semibold tracking-[0.5em]">THE</span>
            <span className="gilt-text mt-2 font-display text-[clamp(34px,10vw,46px)] font-medium leading-none tracking-[0.16em]">
              HOLY
            </span>
            <span className="gilt-text mt-1 font-display text-[clamp(34px,10vw,46px)] font-medium leading-none tracking-[0.16em]">
              BIBLE
            </span>
            <span className="mt-6 block h-px w-10 bg-[rgba(201,164,96,0.55)]" />
            <span className="gilt-text mt-4 font-display text-[11px] italic tracking-[0.18em] opacity-90">Immersive Edition</span>
          </span>
          <span className="gilt-text absolute bottom-[40px] left-[30px] right-[20px] text-center font-display text-[8.5px] tracking-[0.22em]">
            AUTHORISED KING JAMES VERSION
          </span>
          {/* ribbon peeking below */}
        </motion.button>
        <span aria-hidden className="ribbon absolute -bottom-[26px] left-[58%] h-[34px] w-[10px]" />
        <motion.div animate={leaf} initial={{ opacity: 0 }} className="pointer-events-none absolute inset-0" />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: opening ? 0 : 1 }}
        transition={{ delay: opening ? 0 : 0.5, duration: 0.5 }}
        className="mt-14 text-center font-display text-[13px] tracking-[0.18em] text-[#bfae8e]"
        aria-hidden
      >
        {continueLabel ? (
          <>
            <span className="opacity-70">Continue at</span> <span className="italic">{continueLabel}</span>
          </>
        ) : (
          <span className="opacity-70">Touch the cover to open</span>
        )}
      </motion.p>
    </motion.div>
  );
}
