const { test, expect } = require('@playwright/test');

/**
 * E2E Tests for Authentication
 */

const BASE_URL = process.env.TEST_BASE_URL || 'https://localhost:8001';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
  });

  test('should display login page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/login|sign in/i);
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.fill('input[type="text"]', 'invalid');
    await page.fill('input[type="password"]', 'invalid');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.toast')).toContainText(/invalid|error/i);
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'admin123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/dashboard|$/);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/login/);
  });

  test('should access dashboard when authenticated', async ({ page, context }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});
