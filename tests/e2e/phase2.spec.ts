import { expect, test } from '@playwright/test';
import { assertScriptureVerbatim, goToChapter, openAt, openCover, readAndTurn, readPage, readUntil, runningHead, showChrome, turnUntilVisible } from './helpers';

test.describe('Phase 2 — a connected biblical journey', () => {
  test('A · Genesis: meet a place, revisit it later → “You have been here before”', async ({ page }) => {
    await openAt(page, 'Gen.12');
    await readUntil(page, 'Gen.13'); // Genesis 12 (Beth-el at 12:8) into Genesis 13
    const note = page.getByTestId('margin-memory-place-bethel');
    await expect(note).toBeVisible();
    await note.click();
    const sheet = page.getByTestId('place-sheet');
    await expect(sheet).toContainText('You have been here before.');
    await expect(page.getByTestId('place-first-encounter')).toContainText('Genesis 12:8');
    await assertScriptureVerbatim(page, '[data-testid="place-sheet"]');
    await expect(sheet).toContainText('Journeys through here');
  });

  test('B · open vellum → go to the earlier passage → return', async ({ page }) => {
    await openAt(page, 'Matt.2', 5);
    await page.waitForTimeout(600);
    await page.getByTestId('margin-connection-x-micah5').click();
    await page.getByTestId('vellum-turn-to').click();
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Mic.5');
    await assertScriptureVerbatim(page);
    // the earlier passage knows it is quoted later
    await expect(page.getByTestId('margin-reverse-x-micah5').first()).toBeVisible();
    const back = page.getByTestId('return-pill');
    await expect(back).toContainText('Matthew 2:5');
    await back.click();
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Matt.2');
    // back on the page that holds Matthew 2:5 (pages fit the screen, so where it starts varies)
    await expect(page.locator('[data-testid="page-scroller"] [data-ref="Matt.2.5"]')).toBeVisible();
  });

  test('C · read → open the atlas → select a location → return to Scripture', async ({ page }) => {
    await openAt(page, 'Gen.12');
    await readPage(page);
    await page.keyboard.press('m');
    await expect(page.getByTestId('journey-map')).toBeVisible();
    await page.getByTestId('layer-abraham').click();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId('route-ab1')).toHaveAttribute('data-certainty', 'reconstructed');
    await page.getByTestId('atlas-list-toggle').click();
    await expect(page.getByTestId('atlas-list')).toContainText('From Ur of the Chaldees to Haran');
    await page.getByTestId('atlas-list-toggle').click();
    await page.waitForTimeout(800);
    await page.getByTestId('map-place-shechem').dispatchEvent('click');
    await expect(page.getByTestId('place-sheet')).toContainText('Shechem');
    await page.getByTestId('read-passage').first().click();
    await expect(page.getByTestId('journey-map')).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByTestId('reading-page')).toBeVisible();
    await assertScriptureVerbatim(page);
  });

  test('D · open a person → genealogy → related Scripture', async ({ page }) => {
    await openAt(page, 'Gen.35', 23);
    await page.keyboard.press('s');
    await page.getByTestId('search-input').fill('Jacob');
    await page.getByTestId('search-person-jacob').click();
    const person = page.getByTestId('person-sheet');
    await expect(person).toBeVisible();
    await expect(page.getByTestId('person-relationships')).toContainText('Isaac begat Jacob');
    await page.getByTestId('person-open-tree').first().click();
    const tree = page.getByTestId('genealogy-gatefold');
    await expect(tree).toBeVisible();
    await expect(page.getByTestId('gatefold-branch')).toContainText('Reuben');
    await page.getByTestId('gen-node-isaac').click();
    await expect(page.getByTestId('person-sheet').last()).toContainText('Isaac');
    await page.getByTestId('person-sheet').last().getByTestId('read-passage').first().click();
    await expect(page.getByTestId('person-sheet')).toHaveCount(0, { timeout: 3000 });
    await assertScriptureVerbatim(page);
  });

  test('E · open the timeline → inspect an event → return', async ({ page }) => {
    await openAt(page, '2Sam.5');
    await showChrome(page);
    await page.getByTestId('open-timeline').click();
    await expect(page.getByTestId('timeline-strip')).toBeVisible();
    await expect(page.getByTestId('timeline-detail')).toContainText('David reigns forty years');
    await page.getByTestId('timeline-item-t-exodus').click();
    await expect(page.getByTestId('timeline-certainty')).toHaveText('Scholarly estimate');
    await page.getByTestId('timeline-list-toggle').click();
    await expect(page.getByTestId('timeline-list')).toContainText('Israel in Egypt 430 years');
    await page.getByTestId('timeline-close').click();
    await expect(page.getByTestId('timeline-strip')).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', '2Sam.5');
  });

  test('F · open the scale insert → compare dimensions → return', async ({ page }) => {
    await openAt(page, 'Exod.26', 16);
    await page.waitForTimeout(600);
    await page.getByTestId('insert-tab-insert-tabernacle').click();
    const ins = page.getByTestId('scale-insert');
    await expect(ins).toBeVisible();
    const table = page.getByTestId('scale-table');
    await expect(table).toContainText('45.7'); // 100 cubits at 45.7 cm
    await page.getByTestId('cubit-long').click();
    await expect(table).toContainText('52.4');
    await expect(table).toContainText('Derived');
    await page.getByTestId('scale-compare').click();
    await expect(page.getByTestId('scale-tennis')).toBeVisible();
    await page.getByTestId('scale-close').click();
    await expect(ins).toHaveCount(0, { timeout: 3000 });
  });

  test('G · bookmark → close → reopen → the ribbon remains', async ({ page }) => {
    await openAt(page, 'Ruth.1');
    await showChrome(page);
    await page.getByTestId('toggle-bookmark').click();
    await expect(page.getByTestId('bookmark-ribbon')).toHaveCount(1);
    await page.waitForTimeout(400);
    await page.reload();
    await openCover(page);
    await expect(page.getByTestId('bookmark-ribbon')).toHaveCount(1);
    await page.keyboard.press('c');
    await page.getByTestId('contents-tab-bookmarks').click();
    await expect(page.getByTestId('bookmark-item')).toContainText('Ruth 1:1');
  });

  test('H · read → close → reopen → resume exactly', async ({ page }) => {
    await openAt(page, 'Exod.12');
    await readAndTurn(page, 2);
    await expect(page.getByTestId('page-scroller')).toHaveCount(1);
    const head = await runningHead(page).textContent();
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByTestId('bible-cover')).toHaveAccessibleName(/continue at Exodus 12:\d+/);
    await openCover(page);
    await expect(page.getByTestId('reading-page')).toHaveAttribute('data-chapter', 'Exod.12');
    await expect(runningHead(page)).toHaveText(head!);
  });

  test('I · Focus Mode → navigate → exit', async ({ page }) => {
    await openAt(page, 'Gen.28');
    await page.keyboard.press('f');
    await expect(page.locator('[data-testid^="margin-"]')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(700);
    await expect(page.locator('[data-testid^="margin-"]')).toHaveCount(0);
    await expect(page.getByTestId('map-indicator')).toHaveCount(0);
    await assertScriptureVerbatim(page);
    await expect(page.getByTestId('page-scroller')).toHaveCount(1);
    await page.getByTestId('page-scroller').click({ position: { x: 30, y: 30 } });
    await page.getByTestId('exit-focus').click();
    await expect(page.getByTestId('chrome-bottom')).toHaveCount(0);
  });

  test('J · offline → the selected journey still opens and reads', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      return reg.active?.state;
    });
    await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length > 20, null, { timeout: 20000 });
    await context.setOffline(true);
    await page.reload();
    await openCover(page);
    await goToChapter(page, 'Matt.2');
    await assertScriptureVerbatim(page);
    await goToChapter(page, 'Gen.12');
    await assertScriptureVerbatim(page);
    await context.setOffline(false);
  });

  test('the Phase 2 demonstration: Abraham → Ruth → Matthew 2, recognising Bethlehem and Egypt', async ({ page }) => {
    test.setTimeout(120_000);
    await openAt(page, 'Gen.12');
    await readUntil(page, 'Gen.13'); // Beth-el (12:8), Egypt (12:10)
    await goToChapter(page, 'Ruth.1');
    await readPage(page); // Beth-lehem-judah
    await goToChapter(page, 'Matt.2');
    await expect(page.getByTestId('margin-memory-place-bethlehem')).toBeVisible();
    await turnUntilVisible(page, 'margin-memory-place-egypt');
    await expect(page.getByTestId('margin-memory-place-egypt')).toBeVisible();
    await page.getByTestId('margin-memory-place-egypt').click();
    await expect(page.getByTestId('place-sheet')).toContainText('You have been here before.');
    await expect(page.getByTestId('place-first-encounter')).toContainText('Genesis 12:10');
    await page.keyboard.press('Escape');
    await page.getByTestId('margin-connection-x-hosea11').click();
    await expect(page.getByTestId('prophet-name')).toHaveText('Hosea');
    await page.getByTestId('vellum-close').click();
    await expect(page.getByTestId('vellum-overlay')).toHaveCount(0);
    await page.keyboard.press('f');
    await expect(page.locator('[data-testid^="margin-"]')).toHaveCount(0);
    await page.keyboard.press('c'); // contents still reachable from the keyboard
    await page.getByTestId('contents-tab-journey').click();
    await expect(page.getByTestId('contents-journey')).toContainText('Egypt');
    await expect(page.getByTestId('contents-journey')).toContainText('Beth-el');
  });
});
