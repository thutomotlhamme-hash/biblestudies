import { expect, test } from '@playwright/test';
import { assertScriptureVerbatim, KJV, openAt } from './helpers';

/** Deep Made Simple — supplementary, labelled, and never a rewording of Scripture. */
test('Deep Made Simple: a story through Matthew 2, its links, and Scripture verbatim in any translation', async ({ page }) => {
  await openAt(page, 'Matt.2');
  await page.getByTestId('margin-deep-1').click();
  const sheet = page.getByTestId('deep-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('deep-header')).toContainText('Deep Made Simple');
  await expect(page.getByTestId('deep-header')).toContainText('Supplementary — not Scripture');

  // research belonging to Matthew 2:1 comes first, then the story that passes through it
  await expect(sheet.getByTestId('deep-claim').first()).toBeVisible();
  await page.getByTestId('deep-tab-stories').click();
  // the story opens at its passage; every passage is the KJV's own words
  const story = page.getByTestId('deep-story-story-abram-to-bethlehem');
  await expect(story).toBeVisible();
  await expect(story.getByTestId('deep-story-step')).toHaveCount(12);
  await expect(story.getByTestId('deep-story-why').first()).toContainText('Later in the same chapter.');
  const refs = await assertScriptureVerbatim(page, '[data-testid="deep-sheet"]');
  expect(refs).toContain('Matt.2.1');

  // links: every quotation is an exact slice of its KJV verse, with its level
  await page.getByTestId('deep-tab-links').click();
  const quotes = sheet.getByTestId('deep-quote');
  await expect(quotes.first()).toBeVisible();
  for (const q of await quotes.evaluateAll((els) => els.map((e) => ({ ref: (e as HTMLElement).dataset.quoteRef!, text: e.querySelector('[data-quote-text]')!.textContent! })))) {
    expect(KJV[q.ref], q.ref).toContain(q.text);
  }
  await expect(sheet.getByTestId('deep-level').first()).toContainText('Level 1');

  // read in another translation: the story shows that translation's words, untouched
  await openAt(page, 'Matt.2', 1, { settings: { translation: 'asv' } });
  await page.getByTestId('margin-deep-1').click();
  await page.getByTestId('deep-tab-stories').click();
  await expect(page.getByTestId('deep-story-story-abram-to-bethlehem')).toBeVisible();
  await assertScriptureVerbatim(page, '[data-testid="deep-sheet"]', 'asv');
});
