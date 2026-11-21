/**
 * Print a chapter (or save it as PDF from the print dialog): the chapter's exact text, set plainly
 * on paper with its book and chapter, the Psalm title where the KJV prints one, and — marked as
 * supplementary — the 1611 summary. Built in a separate frame, so the reading page is untouched.
 */
export interface PrintInput {
  book: string;
  chapter: number;
  translation: string;
  verses: { verse: number; text: string; red?: [number, number][] }[];
  title?: string;
  summary?: string;
  headings?: Record<number, string>;
  poetry?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function words(text: string, red?: [number, number][]) {
  if (!red?.length) return esc(text);
  let out = '';
  let at = 0;
  for (const [a, b] of red) {
    out += esc(text.slice(at, a)) + `<span class="wj">${esc(text.slice(a, b))}</span>`;
    at = b;
  }
  return out + esc(text.slice(at));
}

export function chapterHtml(p: PrintInput): string {
  const body = p.verses
    .map((v) => `${p.headings?.[v.verse] ? `<h3>${esc(p.headings[v.verse])}</h3>` : ''}<span class="v${p.poetry ? ' line' : ''}"><sup>${v.verse}</sup>${words(v.text, v.red)}</span>`)
    .join(p.poetry ? '' : ' ');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(`${p.book} ${p.chapter}`)}</title><style>
  @page { margin: 22mm 20mm; }
  body { font-family: "EB Garamond", "Iowan Old Style", Georgia, serif; color: #1c1813; font-size: 12.5pt; line-height: 1.55; }
  header { text-align: center; margin-bottom: 14pt; }
  header .bk { letter-spacing: .3em; font-size: 10pt; }
  header .ch { font-size: 34pt; margin: 2pt 0 0; }
  .summary { font-style: italic; font-size: 10pt; text-align: center; color: #5a5146; margin: 0 auto 12pt; max-width: 32em; }
  .summary small { display: block; font-style: normal; font-size: 7.5pt; letter-spacing: .08em; margin-top: 3pt; }
  .title { font-style: italic; text-align: center; margin-bottom: 10pt; }
  h3 { font-weight: normal; font-variant: small-caps; letter-spacing: .1em; text-align: center; font-size: 10.5pt; color: #7a5a30; margin: 10pt 0 4pt; }
  p { text-align: justify; hyphens: auto; margin: 0; }
  .line { display: block; padding-left: 1.4em; text-indent: -1.4em; }
  sup { font-size: 7pt; color: #7a5a30; margin-right: 2pt; }
  .wj { color: #a3262a; }
  footer { margin-top: 18pt; font-size: 8pt; color: #7d7468; text-align: center; letter-spacing: .12em; }
  </style></head><body>
  <header><div class="bk">${esc(p.book.toUpperCase())}</div><div class="ch">${p.chapter}</div></header>
  ${p.summary ? `<p class="summary">${esc(p.summary)}<small>THE 1611 CHAPTER SUMMARY · SUPPLEMENTARY — NOT SCRIPTURE</small></p>` : ''}
  ${p.title ? `<p class="title">${esc(p.title)}</p>` : ''}
  <p>${body}</p>
  <footer>THE HOLY BIBLE · ${esc(p.translation)}${p.headings && Object.keys(p.headings).length ? ' · SECTION HEADINGS ARE SUPPLEMENTARY' : ''}</footer>
  </body></html>`;
}

export function printChapter(p: PrintInput) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(chapterHtml(p));
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  // let the fonts load in the frame first
  setTimeout(go, 350);
}
