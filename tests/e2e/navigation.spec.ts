import { expect, test } from '@playwright/test';
import { assertScriptureVerbatim, KJV, openAt, showChrome } from './helpers';

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
  // the spread may also show the end of Matthew 1 with its own heading
  await expect(page.getByTestId('section-heading').filter({ hasText: 'Wise Men Visit Herod' })).toBeVisible();
  await assertScriptureVerbatim(page, '[data-testid="reading-page"]', 'ylt');
  await page.locator('[data-person="herod"], [data-person^="herod"]').first().click();
  const sheet = page.getByTestId('person-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('person-who')).toContainText('Who is');

  await openAt(page, '1Chr.16', 41);
  await page.locator('[data-person^="jeduthun"]').first().click();
  await expect(page.getByTestId('person-tribe')).toContainText('Levi');
});

test('Aramaic: a passage written in Aramaic is marked, and an Aramaic word in the Gospels opens its story', async ({ page }) => {
  await openAt(page, 'Dan.2', 4);
  await expect(page.getByTestId('aramaic-mark').first()).toBeVisible();
  await expect(page.locator('[data-ref="Dan.2.4"].verse')).toHaveAttribute('data-aramaic', '');
  await page.getByTestId('aramaic-mark').first().click();
  const sheet = page.getByTestId('aramaic-sheet');
  await expect(sheet.getByTestId('aramaic-passage').first()).toBeVisible();
  for (const q of await sheet.locator('[data-ref-quote]').evaluateAll((els) => els.map((e) => ({ ref: (e as HTMLElement).dataset.refQuote!, text: e.querySelector('[data-quote-text]')!.textContent! })))) expect(KJV[q.ref], q.ref).toContain(q.text);
  await page.keyboard.press('Escape');

  await openAt(page, 'Mark.5', 41);
  await page.locator('[data-aramaic-word="g5008"]').first().click();
  await expect(page.getByTestId('aramaic-word-g5008')).toContainText('which is, being interpreted, Damsel, I say unto thee, arise');
});

test('a way back on every page but the first: turn back returns to the page before', async ({ page }) => {
  await openAt(page, 'Matt.7', 6);
  const head = () => page.locator('[data-page-side] header.running-head').first().textContent();
  const before = await head();
  await page.getByTestId('turn-back').first().click();
  await expect.poll(head).not.toBe(before);
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowRight');
  await expect.poll(head).toBe(before);
});
