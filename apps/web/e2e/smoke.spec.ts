import { test, expect, type FileChooser } from '@playwright/test';

/** Demo-mode smoke tests covering the core navigable flows. */

test('homepage renders the hero and CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/Scan it\. Grade-check it\. Track it\./i)).toBeVisible();
});

test('pricing shows Collector Pro at $4.99', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText(/\$?4\.99/)).toBeVisible();
});

test('set explorer lists sets and opens a card', async ({ page }) => {
  await page.goto('/sets');
  await expect(page.getByRole('heading', { name: /sets/i })).toBeVisible();
  await page.getByText('Base Set').first().click();
  await expect(page).toHaveURL(/\/sets\//);
});

test('set explorer master search finds sets and cards', async ({ page }) => {
  await page.goto('/sets');
  const search = page.getByRole('combobox', { name: /search sets and cards/i });
  await search.click();
  await expect(page.getByText(/Try searching/i)).toBeVisible();

  await search.fill('Base');
  await expect(page.getByRole('option', { name: /Base Set/i }).first()).toBeVisible();
  await expect(page.getByText(/matching set/i)).toBeVisible();

  await search.fill('Charizard');
  await expect(page.getByRole('option', { name: /Charizard/i }).first()).toBeVisible({
    timeout: 5000,
  });
});

test('card page shows raw and graded values', async ({ page }) => {
  await page.goto('/cards/base1-4');
  await expect(page.getByText(/Raw market value/i)).toBeVisible();
  await expect(page.getByText(/Graded market values/i)).toBeVisible();
});

test('card page offers collection tracking (sign-in prompt when signed out)', async ({ page }) => {
  await page.goto('/cards/base1-4');
  await expect(page.getByText(/to track this card in your collection/i)).toBeVisible();
});

test('collection renders an image grid with remove controls', async ({ page }) => {
  await page.goto('/app/collection');
  const removeButtons = page.getByRole('button', { name: /^Remove / });
  await expect(removeButtons.first()).toBeVisible();

  // The button is server-rendered before React attaches its handler — retry
  // the click until hydration makes it arm the two-step confirm.
  await expect(async () => {
    await removeButtons.first().click();
    await expect(page.getByText('Remove?').first()).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });

  // Demo mode: removing requires a real account — the second tap yields an
  // honest sign-in message instead of a fake deletion.
  await removeButtons.first().click();
  // Generous timeout: the DELETE route may cold-compile on a dev server.
  await expect(page.getByText(/Sign in to manage your collection/i)).toBeVisible({
    timeout: 15_000,
  });
});

test('dashboard shows portfolio value in demo mode', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByText(/Total value/i)).toBeVisible();
  await expect(page.getByText(/Collection value over time/i)).toBeVisible();
});

test('grade flow gates on required photo uploads and produces a report', async ({ page }) => {
  await page.goto('/app/grade');
  const runButton = page.getByRole('button', { name: /Run Grade Potential analysis/i });
  await expect(runButton).toBeDisabled();

  // 1×1 PNG — enough to satisfy the upload gate in demo mode.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  for (const label of ['Front — straight on', 'Back — straight on', 'Front — angled light']) {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: new RegExp(label, 'i') }).click(),
    ]);
    await chooser.setFiles({
      name: `${label}.png`,
      mimeType: 'image/png',
      buffer: png,
    });
  }

  await expect(runButton).toBeEnabled();
  await runButton.click();
  await expect(page.getByText(/Grade Potential report/i)).toBeVisible({ timeout: 15_000 });
});

test('quick scan identifies an uploaded card photo end-to-end', async ({ page }) => {
  test.setTimeout(120_000); // first run downloads the Tesseract WASM + traineddata

  await page.goto('/app/scan');
  await expect(page.getByRole('button', { name: /Choose from library/i })).toBeVisible();

  // Draw a synthetic card-like photo: name in the top band, collector number
  // in the bottom band — exercises compression, quality metrics, both OCR
  // band passes, the identify API, and the confirm UI.
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1000;
    c.height = 1400;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#f5d060';
    ctx.fillRect(0, 0, 1000, 1400);
    ctx.fillStyle = '#fdfdf5';
    ctx.fillRect(45, 45, 910, 1310);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 64px Georgia';
    ctx.fillText('Charizard', 80, 140);
    ctx.font = 'bold 44px Georgia';
    ctx.fillText('120 HP', 700, 140);
    ctx.fillStyle = '#c8dff0';
    ctx.fillRect(90, 190, 820, 620);
    ctx.fillStyle = '#111';
    ctx.font = '34px Georgia';
    ctx.fillText('4/102', 110, 1330);
    return c.toDataURL('image/jpeg', 0.92);
  });

  // The button is server-rendered before React attaches its onClick; retry
  // until hydration makes the click actually open the chooser.
  let chooser: FileChooser | null = null;
  for (let attempt = 0; attempt < 5 && !chooser; attempt++) {
    try {
      [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10_000 }),
        page.getByRole('button', { name: /Choose from library/i }).click(),
      ]);
    } catch {
      // not hydrated yet — retry
    }
  }
  expect(chooser).not.toBeNull();
  await chooser!.setFiles({
    name: 'card.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
  });

  // OCR runs on-device (WASM), then the server matches against the catalog.
  await expect(page.getByText(/Confirm the exact printing/i)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('button', { name: /Charizard/i }).first()).toBeVisible();
  // The user's own photo is shown for side-by-side comparison.
  await expect(page.getByAltText(/Your scanned card/i)).toBeVisible();
});
