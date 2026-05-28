const { test, expect } = require('@playwright/test');

/**
 * E2E Tests for Dashboard
 */

const BASE_URL = process.env.TEST_BASE_URL || 'https://localhost:8001';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
  });

  test('should display dashboard with stats', async ({ page }) => {
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard-stats"]')).toBeVisible();
  });

  test('should refresh dashboard on button click', async ({ page }) => {
    await page.click('[aria-label="Refresh dashboard"]');
    await expect(page.locator('.loading')).not.toBeVisible();
  });

  test('should have skip navigation link', async ({ page }) => {
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toHaveAttribute('aria-label', 'Skip to main content');
  });
});
