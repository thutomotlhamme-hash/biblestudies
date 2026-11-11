import { expect, test } from '@playwright/test';
import { assertScriptureVerbatim, openAt, showChrome } from './helpers';

/** Every tool says what it is, and the Original view shows the words Scripture was written in. */
test('labelled tools; Original shows the Hebrew/Aramaic/Greek beneath the exact translation', async ({ page }) => {
  await openAt(page, 'Dan.2', 4);
  await showChrome(page);
  for (const [id, label] of [['open-map', 'Atlas'], ['open-timeline', 'Timeline'], ['open-threads', 'Threads'], ['open-original', 'Original'], ['toggle-bookmark', 'Ribbon'], ['enter-focus', 'Focus'], ['open-search', 'Search'], ['open-settings', 'Settings']]) {
    await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId(id)).toContainText(label);
  }
  // the voice is switched off for now
  await expect(page.getByTestId('listen')).toHaveCount(0);

  await page.getByTestId('open-original').click();
  const sheet = page.getByTestId('original-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('original-verse').first()).toBeVisible({ timeout: 10000 });
  // Daniel 2:4 turns from Hebrew to Aramaic
  await expect(sheet.locator('[data-verse-ref="Dan.2.4"]')).toContainText('Aramaic');
  await assertScriptureVerbatim(page, '[data-testid="original-sheet"]');
  await sheet.locator('[data-verse-ref="Dan.2.4"]').getByTestId('original-word').first().click();
  await expect(sheet.getByTestId('word-detail')).toBeVisible();
});

test('headings above passages and tappable names, in another translation too', async ({ page }) => {
  await openAt(page, 'Matt.2', 1, { settings: { translation: 'ylt' } });
  await expect(page.getByTestId('section-heading').first()).toHaveText('Wise Men Visit Herod');
  await assertScriptureVerbatim(page, '[data-testid="reading-page"]', 'ylt');
  await page.locator('[data-person="herod"], [data-person^="herod"]').first().click();
  const sheet = page.getByTestId('person-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('person-who')).toContainText('Who is');

  await openAt(page, '1Chr.16', 41);
  await page.locator('[data-person^="jeduthun"]').first().click();
  await expect(page.getByTestId('person-tribe')).toContainText('Levi');
});
