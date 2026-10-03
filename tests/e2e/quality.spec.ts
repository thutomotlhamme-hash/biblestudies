import { expect, test } from '@playwright/test';
import { openAt, openBible, runningHead, showChrome } from './helpers';

test.describe('Layout, accessibility and motion', () => {
  test('no horizontal overflow and no UI covering Scripture while reading', async ({ page }) => {
    await openBible(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('chrome-bottom')).toHaveCount(0);
    const sc = page.getByTestId('page-scroller');
    await sc.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await page.waitForTimeout(300);
    const last = (await page.locator('[data-testid="page-scroller"] .verse').last().boundingBox())!;
    const chip = (await page.getByTestId('map-indicator').boundingBox())!;
    expect(last.y + last.height).toBeLessThan(chip.y);
    const text = (await page.locator('[data-testid="page-scroller"] .scripture').boundingBox())!;
    for (const m of await page.locator('[data-testid="page-scroller"] [data-testid^="margin-connection"]').all()) {
      const b = (await m.boundingBox())!;
      expect(b.x + 6).toBeGreaterThanOrEqual(text.x + text.width - 1);
    }
  });

  test('tap targets and labels', async ({ page }) => {
    await openBible(page);
    await showChrome(page);
    for (const b of await page.locator('[data-testid="chrome-bottom"] button, [data-testid="chrome-top"] button').all()) {
      if (!(await b.isVisible())) continue;
      const box = (await b.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(await b.getAttribute('aria-label')).toBeTruthy();
    }
    for (const b of await page.locator('[data-testid^="margin-"]').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(34);
  });

  test('settings: text size, theme, high contrast, editorial note', async ({ page }) => {
    await openBible(page);
    const size = () => page.locator('[data-testid="page-scroller"] .scripture').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    const s0 = await size();
    await showChrome(page);
    await page.getByTestId('open-settings').click();
    await page.getByTestId('font-larger').click();
    await page.getByRole('radio', { name: 'Night' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await page.getByRole('radio', { name: 'High contrast' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
    await expect(page.getByTestId('editorial-preview-note')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await size()).toBeGreaterThan(s0);
  });

  test('keyboard: arrows turn pages across chapters and books, m opens the atlas, Escape closes', async ({ page }) => {
    await openAt(page, 'Hos.11');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Hos.12');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Hos.11');
    // from the last chapter of a book into the next book
    await page.keyboard.press('n');
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('n');
      await page.waitForTimeout(500);
    }
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Joel.1', { timeout: 10000 });
    await page.keyboard.press('m');
    await expect(page.getByTestId('map-close')).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('journey-map')).toHaveCount(0, { timeout: 3000 });
  });

  test('reduced motion: the book opens without long animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const t0 = Date.now();
    await page.getByTestId('bible-cover').click();
    await expect(page.getByTestId('cover-stage')).toHaveCount(0, { timeout: 2500 });
    expect(Date.now() - t0).toBeLessThan(2500);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
    await page.keyboard.press('m');
    await expect(page.getByTestId('journey-map')).toBeVisible({ timeout: 3000 });
  });

  test('context insert is labelled as not Scripture', async ({ page }) => {
    await openBible(page);
    await page.getByTestId('insert-tab-insert-rulers-lands').click();
    await expect(page.getByTestId('context-insert')).toContainText('not part of the biblical text');
    await expect(page.getByTestId('context-insert')).toContainText('Archelaus');
    await page.getByTestId('insert-close').click();
    await expect(page.getByTestId('context-insert')).toHaveCount(0, { timeout: 3000 });
  });

  test('search finds references, places, people and words', async ({ page }) => {
    await openBible(page);
    await page.keyboard.press('s');
    await page.getByTestId('search-input').fill('Bethlehem');
    await expect(page.getByTestId('search-place-bethlehem')).toBeVisible();
    await expect(page.getByTestId('search-group-scripture')).toBeVisible();
    await page.getByTestId('search-input').fill('gen 22:2');
    await page.getByText('Genesis 22:2 →').click();
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Gen.22');
    await expect(runningHead(page)).toContainText('22:');
  });

  test('editorial desk lists provenance for supplementary material', async ({ page }) => {
    await page.goto('/editorial/');
    await page.getByLabel('Filter', { exact: true }).fill('Micah 5:2');
    await expect(page.getByTestId('editorial-table')).toContainText('Matthew 2:5 → Micah 5:2', { timeout: 30000 });
    await expect(page.getByTestId('editorial-table')).toContainText('draft');
    await page.getByLabel('Filter', { exact: true }).fill('it is written');
    await page.getByLabel('Filter', { exact: true }).fill('');
    await page.getByLabel('Origin').selectOption('text-match');
    await expect(page.getByTestId('editorial-table')).toContainText('machine', { timeout: 30000 });
  });

  test('PWA manifest and service worker are served', async ({ page, request }) => {
    const m = await request.get('/manifest.webmanifest');
    expect((await m.json()).name).toBe('The Holy Bible');
    const sw = await (await request.get('/sw.js')).text();
    expect(sw).toContain('_next/static');
    await page.goto('/');
    await expect(page).toHaveTitle('The Holy Bible');
  });
});
