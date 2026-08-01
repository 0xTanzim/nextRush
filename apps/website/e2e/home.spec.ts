import { expect, test } from '@playwright/test';

test.describe('Homepage adoption and navigation', () => {
  test('uses one main landmark and explains its value proposition', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Why NextRush' })).toBeVisible();
    await expect(page.getByText('Zero runtime deps', { exact: true })).toBeVisible();
  });

  test('keeps the mobile home link named and comfortably tappable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const homeLink = page.getByRole('link', { name: 'NextRush home' });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('aria-label', 'NextRush home');

    const box = await homeLink.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  });

  test('announces the selected package manager', async ({ page }) => {
    await page.goto('/');

    const pnpm = page.getByRole('button', { name: 'pnpm' });
    const npm = page.getByRole('button', { name: 'npm', exact: true });

    await expect(pnpm).toHaveAttribute('aria-pressed', 'true');
    await npm.click();
    await expect(pnpm).toHaveAttribute('aria-pressed', 'false');
    await expect(npm).toHaveAttribute('aria-pressed', 'true');
  });
});
