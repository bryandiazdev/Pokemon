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

test('grade flow gates on required captures and produces a report', async ({ page }) => {
  await page.goto('/app/grade');
  const runButton = page.getByRole('button', { name: /Run Grade Potential analysis/i });
  await expect(runButton).toBeDisabled();
  await page.getByText('Front — straight on').click();
  await page.getByText('Back — straight on').click();
  await page.getByText('Front — angled light').click();
  await expect(runButton).toBeEnabled();
});
