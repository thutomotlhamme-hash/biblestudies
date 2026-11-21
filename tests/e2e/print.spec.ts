import { expect, test } from '@playwright/test';
import { assertScriptureVerbatim, KJV, openAt, showChrome } from './helpers';

/** The KJV as it is printed: Psalm titles, the 1611 summaries, poetry and the words of Jesus in red. */
test('Psalm title, 1611 summary and poetry — the verses themselves unchanged', async ({ page }) => {
  await openAt(page, 'Ps.23', 1);
  await expect(page.getByTestId('psalm-title').first()).toHaveText('A Psalm of David.');
  await expect(page.getByTestId('chapter-summary').first()).toContainText('Dauids confidence in Gods grace.');
  await expect(page.locator('.scripture-poetry').first()).toBeVisible();
  await assertScriptureVerbatim(page);
});

test('the words of Jesus in red, and the switch that turns them off', async ({ page }) => {
  await openAt(page, 'Matt.3', 15);
  const red = page.locator('[data-ref="Matt.3.15"] .wj').first();
  await expect(red).toHaveText('Suffer it to be so now: for thus it becometh us to fulfil all righteousness.');
  await assertScriptureVerbatim(page);
  await showChrome(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('toggle-red-letter').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ref="Matt.3.15"] .wj')).toHaveCount(0);
});

test('a verse: cross-references to compare, learn it by heart, and practise it at the back', async ({ page }) => {
  await openAt(page, 'John.3', 16);
  await page.getByTestId('verse-num-16').first().click();
  const sheet = page.getByTestId('verse-sheet');
  await expect(sheet.getByTestId('cross-references')).toBeVisible({ timeout: 10000 });
  await expect(sheet.getByTestId('cross-reference').filter({ hasText: 'Romans 5:8' })).toBeVisible();
  await sheet.getByTestId('toggle-memory').click();
  await expect(sheet.getByTestId('toggle-memory')).toHaveAttribute('aria-pressed', 'true');
  await sheet.getByTestId('cross-reference').filter({ hasText: 'Romans 5:8' }).click();
  await expect(page.locator('[data-ref="Rom.5.8"].verse').first()).toBeVisible({ timeout: 10000 });

  await showChrome(page);
  await page.getByTestId('open-navigator').click();
  await page.getByTestId('open-back-memory').click();
  const practise = page.getByTestId('practise');
  await expect(practise).toContainText('For God so loved the world');
  await practise.getByTestId('practise-next').click();
  await practise.getByTestId('practise-next').click();
  await practise.getByTestId('practise-next').click();
  await expect(practise).toContainText('First letters');
  await expect(practise).not.toContainText('loved the world');
});

test('at the back: a concordance and Nave’s topical index lead into the text', async ({ page }) => {
  await openAt(page, 'Gen.1', 1);
  await showChrome(page);
  await page.getByTestId('open-navigator').click();
  await page.getByTestId('open-back-concordance').click();
  const back = page.getByTestId('back-matter');
  await back.getByTestId('concordance-input').fill('shepherd');
  await back.getByTestId('concordance-word').filter({ hasText: /^shepherd\d/ }).first().click();
  await expect(page.getByTestId('search-input')).toHaveValue('"shepherd"', { timeout: 10000 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('search-sheet')).toHaveCount(0);
  if (!(await page.getByTestId('open-navigator').isVisible())) await showChrome(page);
  await page.getByTestId('open-navigator').click();
  await page.getByTestId('open-back-topics').click();
  await back.getByTestId('topics-input').fill('AARON');
  await back.getByTestId('topic-subject').filter({ hasText: /^AARON\d/ }).click();
  await expect(back.getByTestId('topic')).toContainText('Lineage of');
  await back.getByTestId('topic-ref').filter({ hasText: 'Exodus 6:16–20' }).first().click();
  await expect(page.locator('[data-ref="Exod.6.16"].verse').first()).toBeVisible({ timeout: 10000 });
  expect(KJV['Exod.6.16']).toBeTruthy();
});

test('a book’s introduction: its facts and the 1611 contents of every chapter', async ({ page }) => {
  await openAt(page, 'Ruth.1', 1);
  await page.getByTestId('book-intro-link').first().click();
  const sheet = page.getByTestId('book-sheet');
  await expect(sheet.getByTestId('book-facts')).toContainText('4 chapters');
  await expect(sheet.getByTestId('book-contents').locator('li')).toHaveCount(4);
});
