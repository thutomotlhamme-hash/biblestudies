'use client';
import { allBooks } from '@/lib/content/refs';
import { useReader } from './ReaderContext';

const SHORT: Record<string, string> = {
  Pentateuch: 'Law',
  Historical: 'History',
  'Poetry-Wisdom': 'Poetry',
  'Major Prophets': 'Prophets',
  'Minor Prophets': 'Minor',
  Gospels: 'Gospels',
  Acts: 'Acts',
  'Pauline Epistles': 'Paul',
  'General Epistles': 'Letters',
  Revelation: 'Rev.',
};

/** The thumb index cut into a printed Bible's fore-edge: one tab for each part of the Bible. */
export function ThumbIndex() {
  const { chapter, open } = useReader();
  const divisions = [...new Set(allBooks().map((b) => b.division ?? ''))];
  return (
    <nav aria-label="Thumb index" className="thumb-index" data-testid="thumb-index">
      {divisions.map((d) => {
        const first = allBooks().find((b) => b.division === d)!;
        const here = chapter.book.division === d;
        return (
          <button key={d} type="button" className="thumb-tab" aria-current={here} title={d.replace('-', ' & ')} aria-label={`${d.replace('-', ' & ')}: open the contents`} onClick={() => open({ kind: 'contents', book: here ? chapter.book.osis : first.osis })} data-testid={`thumb-${first.osis}`}>
            <span>{SHORT[d] ?? d}</span>
          </button>
        );
      })}
    </nav>
  );
}
