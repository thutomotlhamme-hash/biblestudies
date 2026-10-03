import { expect, test } from '@playwright/test';
import { assertScriptureVerbatim, dragBy, KJV, openAt, openBible, openCover, runningHead, showChrome, turnUntilVisible } from './helpers';

test.describe('Matthew 2 — the Phase 1 reader journey still holds', () => {
  test('vellum → place → map → thread → focus → reopen', async ({ page }) => {
    await openBible(page);
    await expect(page.getByRole('heading', { name: 'Chapter 2' })).toBeVisible();
    await assertScriptureVerbatim(page);

    // vellum with the prophet named from Scripture (pages fit the screen, so it may be a page on)
    await turnUntilVisible(page, 'margin-connection-x-micah5');
    await page.getByTestId('margin-connection-x-micah5').click();
    const sheet = page.getByTestId('vellum-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('vellum-beneath')).toContainText('New Testament · Matthew 2:5–6');
    await expect(sheet.getByText('Old Testament').first()).toBeVisible();
    await expect(page.getByTestId('prophet-name')).toHaveText('Micah');
    await expect(page.getByTestId('prophet-plate')).toContainText('Micah 1:1');
    await expect(page.getByTestId('vellum-scripture')).toContainText(KJV['Mic.5.2'].slice(0, 30));
    await assertScriptureVerbatim(page, '[data-testid="vellum-sheet"]');
    await expect(page.locator('[data-testid="reading-page"] .verse.is-linked')).toHaveCount(2);
    await expect(page.getByTestId('vellum-level')).toContainText('Level 1');
    await expect(page.getByTestId('vellum-evidence-level')).toContainText('Draft');

    // drag the vellum to read both texts together (once its opening spring has settled)
    await page.waitForTimeout(1500);
    const before = (await sheet.boundingBox())!;
    const vertical = page.viewportSize()!.width < 900;
    await dragBy(page, '[data-testid="vellum-handle"]', vertical ? 0 : 120, vertical ? 140 : 0);
    await page.waitForTimeout(700);
    const after = (await sheet.boundingBox())!;
    if (vertical) expect(after.y).toBeGreaterThan(before.y + 40);
    else expect(after.x).toBeGreaterThan(before.x + 40);
    await sheet.getByRole('tab', { name: '2 Samuel 5:2' }).click();
    await assertScriptureVerbatim(page, '[data-testid="vellum-sheet"]');
    await page.getByTestId('vellum-close').click();
    await expect(page.getByTestId('vellum-overlay')).toHaveCount(0);

    // a place
    await page.locator('[data-testid="reading-page"] [data-place="bethlehem"]').first().click();
    await expect(page.getByTestId('place-sheet')).toBeVisible();
    await expect(page.getByText('Ephrath, which is Beth-lehem', { exact: false }).first()).toBeVisible();
    await assertScriptureVerbatim(page, '[data-testid="place-sheet"]');

    // the map, following a route
    await page.getByTestId('place-show-map').click();
    await expect(page.getByTestId('journey-map')).toBeVisible();
    await page.waitForTimeout(1000);
    const title = page.getByTestId('map-segment-title');
    const t1 = await title.textContent();
    await page.getByTestId('map-next').click();
    await expect(title).not.toHaveText(t1!);
    await expect(page.getByTestId('route-certainty')).toBeVisible();
    await page.getByTestId('map-close').click();
    await expect(page.getByTestId('journey-map')).toHaveCount(0, { timeout: 3000 });

    // a thread, followed in the margins
    await page.keyboard.press('t');
    await expect(page.getByTestId('thread-drawer')).toBeVisible();
    await page.getByRole('tab', { name: 'Dream' }).click();
    await page.getByTestId('thread-follow').click();
    await assertScriptureVerbatim(page, '[data-testid="thread-drawer"]');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('margin-thread-dream').first()).toBeVisible();

    // Focus Mode
    await showChrome(page);
    await page.getByTestId('enter-focus').click();
    await expect(page.getByTestId('chrome-bottom')).toHaveCount(0);
    await expect(page.locator('[data-testid^="margin-"]')).toHaveCount(0);
    await expect(page.getByTestId('map-indicator')).toHaveCount(0);
    await expect(page.locator('[data-testid="reading-page"] .place-word')).toHaveCount(0);
    await assertScriptureVerbatim(page);

    // reopen — state restored
    await page.waitForTimeout(400);
    await expect(page.getByTestId('page-scroller')).toHaveCount(1);
    const head = await runningHead(page).textContent();
    await page.reload();
    await expect(page.getByTestId('bible-cover')).toHaveAccessibleName(/continue at Matthew 2:\d+/);
    await openCover(page);
    await expect(runningHead(page)).toHaveText(head!);
    await expect(page.locator('[data-testid^="margin-"]')).toHaveCount(0);
    await expect(page.getByTestId('page-scroller')).toHaveCount(1);
    await page.getByTestId('page-scroller').click({ position: { x: 30, y: 30 } });
    await page.getByTestId('exit-focus').click();
    await expect(page.locator('[data-testid^="margin-"]').first()).toBeVisible();
  });

  test('every verse of Matthew 2 is rendered verbatim', async ({ page }) => {
    await openBible(page);
    const seen = new Set<string>();
    for (let i = 0; i < 16 && (await page.getByTestId('reading-page').getAttribute('data-chapter')) === 'Matt.2'; i++) {
      (await assertScriptureVerbatim(page)).filter((r) => r.startsWith('Matt.2.')).forEach((r) => seen.add(r));
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(650);
    }
    for (let v = 1; v <= 23; v++) expect(seen.has(`Matt.2.${v}`), `Matt.2.${v}`).toBe(true);
  });

  test('swipe/drag turns the page and back', async ({ page }) => {
    await openBible(page);
    const first = await runningHead(page).textContent();
    await dragBy(page, '[data-testid="page-scroller"]', -220, 0);
    await expect(runningHead(page)).not.toHaveText(first!);
    await page.waitForTimeout(600);
    await dragBy(page, '[data-testid="page-scroller"]', 220, 0);
    await expect(runningHead(page)).toHaveText(first!);
  });

  test('each "by the prophet" names the prophet from Scripture', async ({ page }) => {
    await openAt(page, 'Matt.2', 15);
    await page.waitForTimeout(700);
    await page.getByTestId('margin-connection-x-hosea11').click();
    await expect(page.getByTestId('prophet-name')).toHaveText('Hosea');
    await expect(page.getByTestId('prophet-plate')).toContainText('without naming him');
    await assertScriptureVerbatim(page, '[data-testid="prophet-plate"]');
    await page.getByTestId('vellum-close').click();
    await page.waitForTimeout(400);
    await turnUntilVisible(page, 'margin-connection-x-jer31');
    await page.getByTestId('margin-connection-x-jer31').click();
    await expect(page.getByTestId('prophet-name')).toHaveText('Jeremiah');
    await expect(page.getByTestId('prophet-plate')).toContainText('Jeremy the prophet');
    await page.getByTestId('vellum-close').click();
    await openAt(page, 'Matt.2', 23);
    await page.waitForTimeout(700);
    await page.getByTestId('margin-connection-x-nazarene').click();
    await expect(page.getByTestId('vellum-note')).toContainText('does not assign one');
    await expect(page.getByTestId('prophet-plate')).toContainText('names no single prophet');
  });
});
