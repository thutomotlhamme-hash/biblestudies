import { expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';

/** ref -> exact text, read from the same files the app is served. */
function load(tr: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(`public/data/text/${tr}`)) {
    if (f === 'manifest.json') continue;
    const d = JSON.parse(readFileSync(`public/data/text/${tr}/${f}`, 'utf8')) as { book: string; chapters: string[][] };
    d.chapters.forEach((ch, c) => ch.forEach((t, v) => (out[`${d.book}.${c + 1}.${v + 1}`] = t)));
  }
  return out;
}
export const TEXT: Record<string, Record<string, string>> = { kjv: load('kjv'), asv: load('asv'), ylt: load('ylt') };
export const KJV = TEXT.kjv;
export const STORAGE_KEY = 'holy-bible.reader.v3';

/** Put the reader at a chapter (fresh memory unless given), then open the cover. */
export async function openAt(page: Page, chapter = 'Gen.11', verse = 1, extra: Record<string, unknown> = {}) {
  // seed storage from a same-origin file, so the app cannot overwrite it first
  await page.goto('/manifest.webmanifest');
  await page.evaluate(
    ([key, chapter, verse, extra]) => {
      localStorage.setItem(key as string, JSON.stringify({ v: 3, position: { chapter, page: 0, verse }, updatedAt: 0, ...(extra as object) }));
    },
    [STORAGE_KEY, chapter, verse, extra] as const,
  );
  await page.goto('/');
  await openCover(page);
}

export async function openCover(page: Page) {
  await page.getByTestId('bible-cover').click();
  await expect(page.getByTestId('reading-page')).toBeVisible();
  await expect(page.getByTestId('cover-stage')).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByTestId('loading-leaf')).toHaveCount(0, { timeout: 15000 });
  await pagesSettled(page);
}

/** Pages are fitted to the screen once measured; wait until they have settled. */
export async function pagesSettled(page: Page) {
  await expect(page.locator('main[data-page-fit="settled"]')).toHaveCount(1, { timeout: 10000 });
}

export const openBible = (page: Page) => openAt(page, 'Matt.2');

export const runningHead = (page: Page) => page.locator('[data-testid="reading-page"] [data-page-side] header.running-head').first();

/** Read the current page slowly to the end, so every verse is really seen. */
export async function readPage(page: Page) {
  for (const id of ['page-scroller', 'page-scroller-right']) {
    const sc = page.getByTestId(id);
    // wait for a page turn to finish (the old leaf is removed when its animation ends)
    await expect(sc).toHaveCount(id === 'page-scroller' ? 1 : (await sc.count()) ? 1 : 0, { timeout: 5000 });
    if (!(await sc.count())) continue;
    const h = await sc.evaluate((el) => el.scrollHeight);
    for (let y = 0; y <= h; y += 220) {
      await sc.evaluate((el, y) => el.scrollTo({ top: y }), y);
      await page.waitForTimeout(60);
    }
  }
  await page.waitForTimeout(150);
}

/** Read page after page until the book reaches `chapter`. */
export async function readUntil(page: Page, chapter: string, max = 12) {
  for (let i = 0; i < max; i++) {
    if ((await page.getByTestId('reading-page').getAttribute('data-chapter')) === chapter) return;
    await readPage(page);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(650);
  }
  throw new Error(`did not reach ${chapter}`);
}

/** Turn pages until a test id is visible. */
export async function turnUntilVisible(page: Page, testId: string, max = 5) {
  for (let i = 0; i < max; i++) {
    if (await page.getByTestId(testId).first().isVisible()) return;
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(700);
  }
}

export async function readAndTurn(page: Page, pages: number) {
  for (let i = 0; i < pages; i++) {
    await readPage(page);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
  }
}

export async function goToChapter(page: Page, chapter: string) {
  await expect(page.getByTestId('contents')).toHaveCount(0, { timeout: 3000 });
  await page.keyboard.press('c');
  await expect(page.getByTestId('contents')).toBeVisible();
  const book = chapter.split('.')[0];
  if (!(await page.getByTestId(`contents-chapter-${chapter}`).count())) await page.getByTestId(`contents-book-${book}`).click();
  await page.getByTestId(`contents-chapter-${chapter}`).click();
  await page.getByTestId('contents-open-chapter').click();
  await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', chapter);
  await expect(page.getByTestId('loading-leaf')).toHaveCount(0, { timeout: 15000 });
  await page.waitForTimeout(700);
}

/** Every Scripture run on screen must equal the translation text exactly. */
export async function assertScriptureVerbatim(page: Page, scope = '[data-testid="reading-page"]', tr = 'kjv') {
  const read = () =>
    page.locator(`${scope} [data-ref]`).evaluateAll((els) =>
      els
        .filter((e) => e.querySelector(':scope > [data-scripture-text]'))
        .map((e) => ({ ref: (e as HTMLElement).dataset.ref!, text: e.querySelector(':scope > [data-scripture-text]')!.textContent! })),
    );
  // passages load on demand: wait until the text has arrived
  await expect.poll(async () => (await read()).length, { timeout: 15000 }).toBeGreaterThan(0);
  const rows = await read();
  for (const r of rows) expect(r.text, r.ref).toBe(TEXT[tr][r.ref]);
  return rows.map((r) => r.ref);
}

export async function dragBy(page: Page, selector: string, dx: number, dy: number) {
  const box = (await page.locator(selector).first().boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 20);
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
  await page.mouse.up();
}

export async function showChrome(page: Page) {
  await expect(page.getByTestId('page-scroller')).toHaveCount(1);
  await page.getByTestId('page-scroller').click({ position: { x: 30, y: 30 } });
  await expect(page.getByTestId('chrome-bottom')).toBeVisible();
}
