/**
 * A verse card: the verse's exact words set on a page-coloured card, with its reference and
 * translation, drawn to an image the reader can share or save. The words are drawn as given —
 * wrapped onto lines, never shortened or altered.
 */
export interface CardInput {
  text: string;
  reference: string;
  translation: string;
  night?: boolean;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawVerseCard({ text, reference, translation, night }: CardInput): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  await document.fonts?.ready.catch(() => {});
  const paper = night ? '#1d1a16' : '#f3ecdf';
  const ink = night ? '#e9e1d2' : '#2a241d';
  const bronze = night ? '#c9a26a' : '#9a7444';
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  // a quiet inner rule, like a printed page
  ctx.strokeStyle = bronze;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 64, W - 128, H - 128);
  ctx.globalAlpha = 1;

  // the words: largest size that fits the card
  const maxW = W - 260;
  let size = 64;
  let lines: string[] = [];
  for (; size >= 30; size -= 2) {
    ctx.font = `${size}px "EB Garamond", Georgia, serif`;
    lines = wrap(ctx, text, maxW);
    if (lines.length * size * 1.42 <= H - 520) break;
  }
  const lh = size * 1.42;
  let y = (H - lines.length * lh) / 2 - 40 + size;
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  for (const l of lines) {
    ctx.fillText(l, W / 2, y);
    y += lh;
  }
  // ornament and reference
  y += 30;
  ctx.fillStyle = bronze;
  ctx.fillRect(W / 2 - 70, y, 50, 2);
  ctx.fillRect(W / 2 + 20, y, 50, 2);
  ctx.save();
  ctx.translate(W / 2, y + 1);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  ctx.font = `italic 40px "Cormorant Garamond", "EB Garamond", Georgia, serif`;
  ctx.fillStyle = ink;
  ctx.fillText(reference, W / 2, y + 72);
  ctx.font = `26px "Cormorant Garamond", "EB Garamond", Georgia, serif`;
  ctx.fillStyle = bronze;
  const spaced = (s: string) => s.toUpperCase().split('').join(' ');
  ctx.fillText(spaced(`The Holy Bible · ${translation}`), W / 2, H - 110);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('no image'))), 'image/png'));
}

/** Share the card where the device can; otherwise save it. */
export async function shareVerseCard(input: CardInput, filename: string): Promise<'shared' | 'saved'> {
  const blob = await drawVerseCard(input);
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: input.reference });
      return 'shared';
    } catch {
      /* cancelled: fall through to saving */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
