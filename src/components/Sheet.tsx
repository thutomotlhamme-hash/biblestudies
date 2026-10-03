'use client';
import { motion, useDragControls, type PanInfo } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './Icons';
import { useReader } from './ReaderContext';

interface Props {
  label: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
  testId?: string;
  /** Allow the page beneath to stay readable (no scrim). */
  light?: boolean;
  maxHeight?: string;
}

/** A leaf of paper that slides up from the bottom (phone) or in from the side (tablet/desktop). */
export function Sheet({ label, eyebrow, title, children, testId, light, maxHeight = '78dvh' }: Props) {
  const { close, reduced } = useReader();
  const controls = useDragControls();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 600) close();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-stretch md:justify-end" data-testid={testId}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: light ? 0.12 : 0.32 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={close}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="sheet grain relative flex w-full flex-col rounded-t-[10px] outline-none md:h-full md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-[4px]"
        style={{ maxHeight }}
        initial={reduced ? { opacity: 0 } : { y: '100%' }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        exit={reduced ? { opacity: 0 } : { y: '100%' }}
        transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 300, damping: 36 }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={onDragEnd}
      >
        <div className="relative z-[1] cursor-grab px-5 pt-3 md:px-7 md:pt-7" style={{ touchAction: 'none' }} onPointerDown={(e) => controls.start(e)}>
          <span aria-hidden className="mx-auto mb-2 block h-[3px] w-10 rounded-full bg-[var(--ink-faint)] opacity-40 md:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pt-1">
              {eyebrow && <div className="label-caps text-[var(--bronze-deep)]">{eyebrow}</div>}
              {title && <h2 className="mt-1 font-display text-[25px] font-medium leading-tight">{title}</h2>}
            </div>
            <button type="button" className="btn-quiet -mr-2 shrink-0" onClick={close} aria-label="Close" data-testid="sheet-close">
              <IconClose />
            </button>
          </div>
        </div>
        <div className="scroll-quiet relative z-[1] flex-1 overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2 md:px-7">{children}</div>
      </motion.div>
    </div>
  );
}
