import { test, expect } from '@playwright/test';

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
