import { expect, test } from '@playwright/test';
import { assertScriptureVerbatim, goToChapter, KJV, openAt, openCover, showChrome, TEXT, turnUntilVisible } from './helpers';

/** Phase 3 — the complete digital Holy Bible. Every step re-checks the words on screen. */
test.describe('Phase 3 — the complete Bible', () => {

  test('0 · opening: a new or older save opens at Genesis 1 — no other book flashes first', async ({ page }) => {
    await page.goto('/manifest.webmanifest');
    await page.evaluate(() => localStorage.setItem('holy-bible.reader.v2', JSON.stringify({ v: 2, position: { chapter: 'Matt.2', page: 0, verse: 1 }, updatedAt: 0 })));
    await page.addInitScript(() => {
      const seen: string[] = ((window as unknown as { __chapters: string[] }).__chapters = []);
      new MutationObserver(() => {
        document.querySelectorAll('[data-testid="reading-page"]').forEach((el) => {
          const c = el.getAttribute('data-chapter');
          if (c && seen[seen.length - 1] !== c) seen.push(c);
        });
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-chapter'] });
    });
    await page.goto('/');
    const stage = page.getByTestId('cover-stage');
    await expect(stage).toContainText(/genesis/i);
    await expect(stage).not.toContainText(/matthew/i);
    await openCover(page);
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Gen.1');
    expect(await page.evaluate(() => (window as unknown as { __chapters: string[] }).__chapters)).toEqual(['Gen.1']);
    await assertScriptureVerbatim(page);
  });
  test('1 · library: any book, chapter and verse; the book runs on to the end of Revelation', async ({ page }) => {
    await openAt(page, 'Gen.1');
    await assertScriptureVerbatim(page);
    await goToChapter(page, 'Rev.22');
    await assertScriptureVerbatim(page);
    await page.keyboard.press('c');
    await page.getByTestId('contents-jump').fill('Obadiah 1:3');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Obad.1');
    await expect(page.getByTestId('loading-leaf')).toHaveCount(0, { timeout: 15000 });
    await assertScriptureVerbatim(page);
    await goToChapter(page, 'Jude.1');
    await turnUntilVisible(page, 'continue-chapter', 15);
    await page.getByTestId('continue-chapter').click();
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Rev.1');
  });

  test('2 · search: exact phrase, filters, and Scripture kept apart from notes', async ({ page }) => {
    await openAt(page, 'Gen.1');
    await page.keyboard.press('/');
    await page.getByTestId('search-input').fill('"the LORD is my shepherd"');
    const first = page.getByTestId('search-verse').first();
    await expect(first).toHaveAttribute('data-ref', 'Ps.23.1', { timeout: 20000 });
    await expect(first).toContainText(KJV['Ps.23.1']);
    await page.getByTestId('search-input').fill('Bethlehem');
    await page.getByTestId('search-filter-NT').click();
    await expect(page.getByTestId('search-verse').first()).toHaveAttribute('data-ref', /^(Matt|Luke|John)\./, { timeout: 20000 });
    await expect(page.getByTestId('search-group-places')).toBeVisible();
    await expect(page.getByText('Supplementary — not Scripture')).toBeVisible();
    await page.getByTestId('search-verse').first().click();
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Matt.2');
    await assertScriptureVerbatim(page);
  });

  test('3 · translations: switch, and compare verse by verse — nothing merged', async ({ page }) => {
    await openAt(page, 'John.1');
    await page.keyboard.press('Escape');
    await showChrome(page);
    await page.getByTestId('open-settings').click();
    await page.getByTestId('translation-asv').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('loading-leaf')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('[data-ref="John.1.1"] [data-scripture-text]').first()).toHaveText(TEXT.asv['John.1.1'], { timeout: 10000 });
    await assertScriptureVerbatim(page, '[data-testid="reading-page"]', 'asv');
    await page.getByTestId('verse-num-3').click();
    await page.getByTestId('open-compare').click();
    const cmp = page.getByTestId('compare-verse');
    for (const tr of ['kjv', 'asv', 'ylt']) await expect(cmp.locator(`[data-translation="${tr}"] [data-scripture-text]`)).toHaveText(TEXT[tr]['John.1.3'], { timeout: 10000 });
  });

  test('4 · personal tools: highlight, private note, favourite — kept after reopening', async ({ page }) => {
    await openAt(page, 'Ps.23');
    await page.getByTestId('verse-num-4').click();
    await page.getByTestId('highlight-gold').click();
    await page.getByTestId('note-input').fill('Read at my grandmother’s service');
    await page.getByTestId('toggle-favourite').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-ref="Ps.23.4"].verse')).toHaveAttribute('data-highlight', 'gold');
    await page.waitForTimeout(400);
    await page.reload();
    await openCover(page);
    await expect(page.locator('[data-ref="Ps.23.4"].verse')).toHaveAttribute('data-highlight', 'gold');
    await showChrome(page);
    await page.getByTestId('open-mine').click();
    await page.getByTestId('mine-tab-notes').click();
    await expect(page.getByTestId('my-bible')).toContainText('grandmother');
    await page.getByTestId('mine-tab-favourites').click();
    await expect(page.getByTestId('my-bible')).toContainText('Psalms 23:4');
    await assertScriptureVerbatim(page);
  });

  test('5 · a connection found by wording carries its evidence level and is shown verbatim', async ({ page }) => {
    await openAt(page, 'Matt.4', 4);
    const mark = page.locator('[data-testid^="margin-connection-m-Matt_4_4"]').first();
    await expect(mark).toBeAttached({ timeout: 15000 });
    await turnUntilVisible(page, (await mark.getAttribute('data-testid'))!, 3);
    await mark.click();
    await expect(page.getByTestId('vellum-sheet')).toBeVisible();
    await expect(page.getByTestId('vellum-level')).toContainText('Level 1');
    await expect(page.getByTestId('vellum-level')).toContainText('Explicit quotation');
    await expect(page.getByTestId('vellum-evidence-level')).toContainText('shared wording');
    await assertScriptureVerbatim(page, '[data-testid="vellum-sheet"]');
    await expect(page.locator('[data-testid="vellum-sheet"] [data-ref="Deut.8.3"]')).toBeVisible();
  });

  test('6 · original-language study aid for a verse', async ({ page }) => {
    await openAt(page, 'Gen.1');
    await page.locator('[data-ref="Gen.1.1"] button[data-interactive]').first().focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('open-words').click();
    await expect(page.getByTestId('original-words').locator('li')).toHaveCount(7, { timeout: 10000 });
    await page.getByTestId('original-words').locator('li button').nth(1).click();
    await expect(page.getByTestId('word-detail')).toContainText('H1254');
    await expect(page.getByTestId('word-study')).toContainText('not a translation');
  });

  test('7 · atlas: Paul’s first journey with distances; a disputed place shows its proposals', async ({ page }) => {
    await openAt(page, 'Acts.13', 4);
    await page.keyboard.press('m');
    await expect(page.getByTestId('map-segment-card')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('layer-paul-1').click();
    await expect(page.getByTestId('map-segment-title')).toContainText('Seleucia');
    await expect(page.getByTestId('segment-distance')).toContainText('km');
    await expect(page.getByTestId('route-certainty')).toHaveText('Explicit');
    await page.getByTestId('map-close').click();
    await page.keyboard.press('/');
    await page.getByTestId('search-input').fill('Emmaus');
    await page.getByTestId('search-place-emmaus').click({ timeout: 15000 });
    await expect(page.getByTestId('place-sheet')).toContainText('disputed');
    await expect(page.getByTestId('place-sheet')).toContainText('Other proposals');
  });

  test('8 · genealogies as written: Luke 3, with the link quoted', async ({ page }) => {
    await openAt(page, 'Luke.3', 23);
    await turnUntilVisible(page, 'insert-tab-insert-genealogy-luke-3', 8);
    await page.getByTestId('insert-tab-insert-genealogy-luke-3').click();
    const line = page.getByTestId('genealogy-line');
    await expect(line).toContainText('Adam');
    await expect(page.getByTestId('genealogy-gatefold')).toContainText('does not reconcile');
    await line.locator('li').nth(3).locator('button').first().click();
    await assertScriptureVerbatim(page, '[data-testid="gatefold-evidence"]');
  });

  test('9 · scale: Noah’s ark, from Genesis 6:15', async ({ page }) => {
    await openAt(page, 'Gen.6', 14);
    await turnUntilVisible(page, 'insert-tab-insert-scale-ark', 6);
    await page.getByTestId('insert-tab-insert-scale-ark').click();
    await expect(page.getByTestId('scale-insert')).toContainText('three hundred cubits');
    await expect(page.getByTestId('scale-table')).toContainText('m');
  });

  test('10 · Family Mode: larger type, quieter margin, the same words', async ({ page }) => {
    await openAt(page, 'Matt.4', 4);
    const size = () => page.locator('.scripture').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    const s0 = await size();
    const machine0 = await page.locator('[data-testid^="margin-connection-m-"]').count();
    await showChrome(page);
    await page.getByTestId('open-settings').click();
    await page.getByTestId('open-family').click();
    await page.getByTestId('family-toggle').click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    expect(await size()).toBeGreaterThan(s0);
    expect(await page.locator('[data-testid^="margin-connection-m-"]').count()).toBeLessThanOrEqual(machine0);
    await assertScriptureVerbatim(page);
  });
});

test.describe('Opening the Bible', () => {
  test('the leaf under the cover is the book you open at; an old Matthew 2 save never flashes', async ({ page }) => {
    await page.goto('/manifest.webmanifest');
    await page.evaluate(() => localStorage.setItem('holy-bible.reader.v2', JSON.stringify({ v: 2, position: { chapter: 'Matt.2', page: 0, verse: 1 }, updatedAt: 5 })));
    await page.goto('/');
    await expect(page.getByTestId('cover-stage')).not.toContainText('MATTHEW');
    await expect(page.getByTestId('cover-stage')).toContainText('GENESIS');
    const seen = new Set<string>();
    await page.getByTestId('bible-cover').click();
    for (let i = 0; i < 25; i++) {
      seen.add((await page.getByTestId('reading-page').getAttribute('data-chapter').catch(() => null)) ?? '-');
      await page.waitForTimeout(80);
    }
    expect([...seen].filter((c) => c !== '-')).toEqual(['Gen.1']);
    await expect(page.getByTestId('loading-leaf')).toHaveCount(0);
  });
});
