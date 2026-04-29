/**
 * COMPREHENSIVE MOBILE UI AUDIT — covers all pages, states, modals, flows
 * Viewport: iPhone 14 Pro (390×844, dpr=3, touch)
 * Run: node visual_audit_full.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';

const BASE = 'http://localhost:3000';
const OUT  = 'D:/Retail Code/Retail/audit_screenshots/full';

const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true };

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let shotCount = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(shotCount++).padStart(3,'0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: false });   // viewport only — faster, realistic
  console.log(`  📸 [${shotCount-1}] ${name}`);
}
async function shotFull(page, name) {
  const file = path.join(OUT, `${String(shotCount++).padStart(3,'0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 [${shotCount-1}] ${name} (full)`);
}

// ── Auth helpers ────────────────────────────────────────────────
async function getToken() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = https.request({
      hostname: 'localhost', port: 8001, path: '/api/auth/login',
      method: 'POST', rejectUnauthorized: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data).access_token); } catch { reject(new Error('Bad: ' + data)); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function setupProxy(page) {
  await page.route('http://localhost:8001/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postDataBuffer();
    const headers = { ...req.headers() };
    delete headers['host'];
    return new Promise(resolve => {
      const opts = { hostname: 'localhost', port: 8001, path: url.pathname + url.search, method: req.method(), headers, rejectUnauthorized: false };
      const pr = https.request(opts, pres => {
        const chunks = [];
        pres.on('data', c => chunks.push(c));
        pres.on('end', () => {
          const respBody = Buffer.concat(chunks);
          const respHeaders = {};
          for (const [k, v] of Object.entries(pres.headers)) {
            if (k.toLowerCase() !== 'transfer-encoding') respHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
          }
          route.fulfill({ status: pres.statusCode, headers: respHeaders, body: respBody }).then(resolve).catch(resolve);
        });
        pres.on('error', () => route.abort().then(resolve).catch(resolve));
      });
      pr.on('error', () => route.abort().then(resolve).catch(resolve));
      if (body) pr.write(body);
      pr.end();
    });
  });
}

async function injectAuth(page, token) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(600);
  await page.evaluate(t => sessionStorage.setItem('token', t), token);
  await page.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function nav(page, url, wait = 2000) {
  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(wait);
}

// ── Tap helpers ─────────────────────────────────────────────────
async function tap(page, selector) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 })) { await el.tap(); return true; }
  } catch {}
  return false;
}
async function tapText(page, text) {
  try {
    const el = page.getByText(text, { exact: false }).first();
    if (await el.isVisible({ timeout: 2000 })) { await el.tap(); return true; }
  } catch {}
  return false;
}

// ════════════════════════════════════════════════════════════════
async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    ...MOBILE,
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const p = await ctx.newPage();
  await setupProxy(p);

  const token = await getToken();
  console.log('✓ Token acquired');

  // ═══════════════════════════════════════════
  // 1. LOGIN PAGE
  // ═══════════════════════════════════════════
  console.log('\n── 1. LOGIN PAGE');
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await shot(p, '01_login_empty');

  await p.fill('#username', 'admin');
  await shot(p, '01_login_username_filled');

  await p.fill('#password', 'admin123');
  await shot(p, '01_login_both_filled');

  // Inject token instead of actual submit (avoid 401 rate limit risk)
  await p.evaluate(t => sessionStorage.setItem('token', t), token);
  await p.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(2500);

  // ═══════════════════════════════════════════
  // 2. DASHBOARD
  // ═══════════════════════════════════════════
  console.log('\n── 2. DASHBOARD');
  await nav(p, '/');
  await shot(p, '02_dashboard_top');
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '02_dashboard_mid');
  await p.evaluate(() => window.scrollTo(0, 99999));
  await p.waitForTimeout(300);
  await shot(p, '02_dashboard_bottom');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Open sidebar
  const menuBtn = p.locator('[data-testid="mobile-menu-btn"], button').first();
  await p.locator('header button, [class*="topbar"] button, .md\\:hidden button').first().tap().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '02_dashboard_sidebar_open');

  // Close sidebar by clicking overlay
  await p.locator('.fixed.inset-0').first().tap().catch(() => tapText(p, 'Dashboard'));
  await p.waitForTimeout(400);
  await shot(p, '02_dashboard_sidebar_closed');

  // ═══════════════════════════════════════════
  // 3. NEW BILL — all states
  // ═══════════════════════════════════════════
  console.log('\n── 3. NEW BILL');
  await nav(p, '/new-bill');
  await shot(p, '03_newbill_initial');

  // Customer name — tap without typing (should NOT show suggestions)
  await p.locator('[data-testid="customer-name-input"]').tap();
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_customer_focus_empty');

  // Type to get suggestions
  await p.fill('[data-testid="customer-name-input"]', 'Raj');
  await p.waitForTimeout(400);
  await shot(p, '03_newbill_customer_suggestions');

  // Select a customer
  await p.locator('ul li').first().tap().catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_customer_selected');

  // Fill item form
  await p.fill('[data-testid="barcode-input"]', 'TEST-001');
  await p.fill('[data-testid="qty-input"]', '2.5');
  await p.fill('[data-testid="price-input"]', '450');
  await p.fill('[data-testid="discount-input"]', '5');
  await shot(p, '03_newbill_item_form_filled');

  // Add item
  await p.locator('[data-testid="add-item-btn"]').tap();
  await p.waitForTimeout(400);
  await shot(p, '03_newbill_item_added');

  // Add second item
  await p.fill('[data-testid="barcode-input"]', 'TEST-002');
  await p.fill('[data-testid="qty-input"]', '3');
  await p.fill('[data-testid="price-input"]', '600');
  await p.locator('[data-testid="add-item-btn"]').tap();
  await p.waitForTimeout(400);
  await shot(p, '03_newbill_two_items');

  // Edit an item — click pencil
  await p.locator('button[title*="dit"], button:has([data-icon="pencil-simple"])').first().tap().catch(async () => {
    await p.locator('button').filter({ hasText: '' }).first().tap().catch(() => {});
  });
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_edit_item');

  // Scroll to payment section
  await p.evaluate(() => window.scrollTo(0, 99999));
  await p.waitForTimeout(400);
  await shot(p, '03_newbill_payment_section');
  await shot(p, '03_newbill_sticky_bar');

  // Check payment mode pills
  await p.evaluate(() => window.scrollTo(0, 99999));
  await tapText(p, 'Cash');
  await p.waitForTimeout(200);
  await shot(p, '03_newbill_payment_mode_selected');

  // Mark as Settled
  await p.locator('input[type="checkbox"]').first().tap().catch(() => tapText(p, 'Mark as Settled'));
  await p.waitForTimeout(200);
  await shot(p, '03_newbill_settled_checked');

  // Needs Tailoring checkbox
  await p.locator('input[type="checkbox"]').nth(1).tap().catch(() => tapText(p, 'Needs Tailoring'));
  await p.waitForTimeout(200);
  await shot(p, '03_newbill_needs_tailoring');

  // Open barcode scanner
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(300);
  await p.locator('[data-testid="scan-barcode-btn"]').tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '03_newbill_scanner_modal');
  // Close it
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Undo last add (remove item)
  await p.locator('button[title*="emove"], button[title*="elete"]').first().tap().catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_item_removed');

  // ═══════════════════════════════════════════
  // 4. DAYBOOK
  // ═══════════════════════════════════════════
  console.log('\n── 4. DAYBOOK');
  await nav(p, '/daybook');
  await shot(p, '04_daybook_initial');

  // Switch to Tallied tab
  await tapText(p, 'Tallied');
  await p.waitForTimeout(700);
  await shot(p, '04_daybook_tallied_tab');

  // Back to Pending
  await tapText(p, 'Pending');
  await p.waitForTimeout(500);

  // Change DATE filter to today's date
  const dateSelects = p.locator('select');
  const count = await dateSelects.count();
  if (count > 0) {
    await dateSelects.first().selectOption({ index: 1 }).catch(() => {});
    await p.waitForTimeout(600);
    await shot(p, '04_daybook_date_filtered');
    await dateSelects.first().selectOption({ index: 0 }).catch(() => {});
    await p.waitForTimeout(400);
  }

  // Scroll to see entries
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(400);
  await shot(p, '04_daybook_entries');
  await shotFull(p, '04_daybook_full_page');

  // ═══════════════════════════════════════════
  // 5. MANAGE ORDERS (ItemsManager)
  // ═══════════════════════════════════════════
  console.log('\n── 5. MANAGE ORDERS');
  await nav(p, '/items');
  await shot(p, '05_items_list_pending');

  // Scroll list
  await p.evaluate(() => window.scrollTo(0, 500));
  await p.waitForTimeout(300);
  await shot(p, '05_items_list_scrolled');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Switch to Awaiting tab
  await tapText(p, 'Awaiting');
  await p.waitForTimeout(600);
  await shot(p, '05_items_awaiting_tab');

  // Switch to Settled
  await tapText(p, 'Settled');
  await p.waitForTimeout(600);
  await shot(p, '05_items_settled_tab');

  // Switch to All
  await tapText(p, 'All');
  await p.waitForTimeout(600);
  await shot(p, '05_items_all_tab');

  // Back to Pending
  await tapText(p, 'Pending');
  await p.waitForTimeout(500);

  // Open search
  await p.locator('input[placeholder*="earch"]').tap().catch(() => {});
  await p.fill('input[placeholder*="earch"]', 'Raj');
  await p.waitForTimeout(600);
  await shot(p, '05_items_search_results');
  await p.fill('input[placeholder*="earch"]', '');
  await p.waitForTimeout(400);

  // Open Filters panel
  await p.locator('button:has-text("Filters"), button[title*="ilter"]').first().tap().catch(() =>
    p.locator('button svg[class*="Funnel"], button').filter({ hasText: /filter/i }).first().tap().catch(() => {})
  );
  await p.waitForTimeout(500);
  await shot(p, '05_items_filter_panel');
  // Close filters
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Tap an order to open detail pane
  await p.locator('.divide-y > div, [class*="order-row"]').first().tap().catch(async () => {
    // try clicking the first customer link
    await p.locator('button, a').filter({ hasText: /\(/ }).first().tap().catch(() => {});
  });
  await p.waitForTimeout(700);
  await shot(p, '05_items_order_detail_open');

  // Scroll within detail pane
  await p.evaluate(() => window.scrollTo(0, 500));
  await p.waitForTimeout(300);
  await shot(p, '05_items_order_detail_scrolled');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Open Settlement panel — tap Settle/CurrencyDollar button
  await p.locator('button[title*="ettle"], button:has-text("Settle"), button:has([data-icon="currency-dollar"])').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '05_items_settlement_panel');
  // Close
  await p.keyboard.press('Escape');
  await p.locator('button[title*="lose"], button:has([data-icon="x"])').first().tap().catch(() => {});
  await p.waitForTimeout(300);

  // Open edit overlay — tap pencil on a row
  await p.locator('button:has([data-icon="pencil-simple"])').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '05_items_edit_overlay');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Print / invoice modal
  await p.locator('button:has([data-icon="printer"])').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '05_items_invoice_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Sort dropdown
  await p.locator('button:has([data-icon="caret-down"]), button:has-text("Order Date")').first().tap().catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, '05_items_sort_dropdown');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════
  // 6. JOB WORK
  // ═══════════════════════════════════════════
  console.log('\n── 6. JOB WORK');
  await nav(p, '/jobwork');
  await shot(p, '06_jobwork_tailoring_pending');

  // Scroll items
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '06_jobwork_tailoring_scrolled');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Stitched tab
  await tapText(p, 'Stitched');
  await p.waitForTimeout(600);
  await shot(p, '06_jobwork_tailoring_stitched');

  // Delivered tab
  await tapText(p, 'Delivered');
  await p.waitForTimeout(600);
  await shot(p, '06_jobwork_tailoring_delivered');

  // Back to Pending
  await tapText(p, 'Pending');
  await p.waitForTimeout(400);

  // Embroidery tab
  await tapText(p, 'Embroidery');
  await p.waitForTimeout(700);
  await shot(p, '06_jobwork_embroidery_tab');

  // Scroll embroidery
  await p.evaluate(() => window.scrollTo(0, 300));
  await p.waitForTimeout(300);
  await shot(p, '06_jobwork_embroidery_scrolled');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Back to Tailoring, open filter dropdown
  await tapText(p, 'Tailoring');
  await p.waitForTimeout(400);
  const filterSelects = p.locator('select');
  const fCount = await filterSelects.count();
  if (fCount > 0) {
    await filterSelects.first().selectOption({ index: 1 }).catch(() => {});
    await p.waitForTimeout(500);
    await shot(p, '06_jobwork_filtered');
    await filterSelects.first().selectOption({ index: 0 }).catch(() => {});
    await p.waitForTimeout(300);
  }

  // Select an item and try Move to Stitched
  const cb = p.locator('input[type="checkbox"]').first();
  if (await cb.isVisible().catch(() => false)) {
    await cb.tap();
    await p.waitForTimeout(300);
    await shot(p, '06_jobwork_item_selected');
    // Click Move to Stitched button
    await p.locator('button:has-text("Move"), button:has-text("Stitch")').first().tap().catch(() => {});
    await p.waitForTimeout(500);
    await shot(p, '06_jobwork_move_dialog');
    // Cancel dialog
    await tapText(p, 'Cancel');
    await p.waitForTimeout(300);
    // Unselect
    await cb.tap().catch(() => {});
    await p.waitForTimeout(200);
  }

  // ═══════════════════════════════════════════
  // 7. ORDER STATUS
  // ═══════════════════════════════════════════
  console.log('\n── 7. ORDER STATUS');
  await nav(p, '/order-status');
  await shot(p, '07_orderstatus_top');

  // Scroll to grid
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(500);
  await shot(p, '07_orderstatus_cards_visible');

  // Scroll further
  await p.evaluate(() => window.scrollTo(0, 1200));
  await p.waitForTimeout(300);
  await shot(p, '07_orderstatus_more_cards');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Apply a customer filter
  const custSelect = p.locator('select').first();
  const custCount = await custSelect.locator('option').count();
  if (custCount > 1) {
    await custSelect.selectOption({ index: 1 });
    await tapText(p, 'Apply Filters');
    await p.waitForTimeout(700);
    await shot(p, '07_orderstatus_customer_filtered');
    await custSelect.selectOption({ index: 0 });
    await tapText(p, 'Apply Filters');
    await p.waitForTimeout(500);
  }

  // ═══════════════════════════════════════════
  // 8. REPORTS
  // ═══════════════════════════════════════════
  console.log('\n── 8. REPORTS');
  await nav(p, '/reports', 3000);
  await shot(p, '08_reports_revenue_tab');

  // Scroll to see charts
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(400);
  await shot(p, '08_reports_revenue_chart');

  await p.evaluate(() => window.scrollTo(0, 0));

  // Summary tab
  await tapText(p, 'Summary');
  await p.waitForTimeout(1500);
  await shot(p, '08_reports_summary_cards');
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '08_reports_summary_scrolled');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Customers tab
  await tapText(p, 'Customers');
  await p.waitForTimeout(1500);
  await shot(p, '08_reports_customers_tab');
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '08_reports_customers_scrolled');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Date period filter — This Week
  await tapText(p, 'This Week');
  await p.waitForTimeout(1500);
  await shot(p, '08_reports_this_week');

  // This Month
  await tapText(p, 'This Month');
  await p.waitForTimeout(1500);
  await shot(p, '08_reports_this_month');

  // This Year
  await tapText(p, 'This Year');
  await p.waitForTimeout(1500);
  await shot(p, '08_reports_this_year');

  // Back to Revenue tab
  await tapText(p, 'Revenue');
  await p.waitForTimeout(1000);

  // Weekly period
  await tapText(p, 'Weekly').catch(() => {});
  await p.waitForTimeout(1000);
  await shot(p, '08_reports_weekly_period');

  // Monthly period
  await tapText(p, 'Monthly').catch(() => {});
  await p.waitForTimeout(1000);
  await shot(p, '08_reports_monthly_period');

  // ═══════════════════════════════════════════
  // 9. LABOUR PAYMENTS
  // ═══════════════════════════════════════════
  console.log('\n── 9. LABOUR PAYMENTS');
  await nav(p, '/labour');
  await shot(p, '09_labour_unpaid_top');

  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '09_labour_unpaid_list');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Filter by type — Embroidery
  const typeSelect = p.locator('select').first();
  await typeSelect.selectOption('Embroidery').catch(async () => {
    await p.locator('select').nth(1).selectOption({ index: 1 }).catch(() => {});
  });
  await p.waitForTimeout(500);
  await shot(p, '09_labour_type_embroidery');
  await typeSelect.selectOption({ index: 0 }).catch(() => {});
  await p.waitForTimeout(300);

  // Select first item — sticky bar should appear
  const laborCb = p.locator('input[type="checkbox"]').nth(1);
  if (await laborCb.isVisible().catch(() => false)) {
    await laborCb.tap();
    await p.waitForTimeout(300);
    await shot(p, '09_labour_one_selected_sticky');

    // Select more
    const cb2 = p.locator('input[type="checkbox"]').nth(2);
    const cb3 = p.locator('input[type="checkbox"]').nth(3);
    await cb2.tap().catch(() => {}); await cb3.tap().catch(() => {});
    await p.waitForTimeout(300);
    await shot(p, '09_labour_multi_selected');

    // Deselect all
    await laborCb.tap().catch(() => {}); await cb2.tap().catch(() => {}); await cb3.tap().catch(() => {});
    await p.waitForTimeout(300);
  }

  // Select All checkbox (header)
  const headerCb = p.locator('input[type="checkbox"]').first();
  await headerCb.tap().catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, '09_labour_select_all');
  await headerCb.tap().catch(() => {}); // deselect all

  // Paid tab
  await tapText(p, 'Paid');
  await p.waitForTimeout(800);
  await shot(p, '09_labour_paid_tab');
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '09_labour_paid_scrolled');
  await p.evaluate(() => window.scrollTo(0, 0));

  // Back to unpaid, scroll to bottom panel (payment form)
  await tapText(p, 'Pending');
  await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollTo(0, 99999));
  await p.waitForTimeout(400);
  await shot(p, '09_labour_payment_panel');

  // ═══════════════════════════════════════════
  // 10. SETTINGS — all sections
  // ═══════════════════════════════════════════
  console.log('\n── 10. SETTINGS');
  await nav(p, '/settings');
  await shot(p, '10_settings_top');

  // Article Types section
  await p.evaluate(() => window.scrollTo(0, 300));
  await p.waitForTimeout(300);
  await shot(p, '10_settings_article_types');

  // Payment Modes section
  await p.evaluate(() => window.scrollTo(0, 700));
  await p.waitForTimeout(300);
  await shot(p, '10_settings_payment_modes');

  // Add-on Items section
  await p.evaluate(() => window.scrollTo(0, 1100));
  await p.waitForTimeout(300);
  await shot(p, '10_settings_addon_items');

  // Karigars section
  await p.evaluate(() => window.scrollTo(0, 1500));
  await p.waitForTimeout(300);
  await shot(p, '10_settings_karigars');

  // Firm details
  await p.evaluate(() => window.scrollTo(0, 2000));
  await p.waitForTimeout(300);
  await shot(p, '10_settings_firm_details');

  // Keyboard shortcuts
  await p.evaluate(() => window.scrollTo(0, 99999));
  await p.waitForTimeout(300);
  await shot(p, '10_settings_keyboard_shortcuts');

  // Dirty state — edit something
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(300);
  // Try to type in first rate input
  const rateInput = p.locator('input[type="number"]').first();
  if (await rateInput.isVisible().catch(() => false)) {
    await rateInput.triple_click?.() ?? await rateInput.tap();
    await p.waitForTimeout(200);
    await shot(p, '10_settings_dirty_state');
  }

  // ═══════════════════════════════════════════
  // 11. DATA MANAGER
  // ═══════════════════════════════════════════
  console.log('\n── 11. DATA MANAGER');
  await nav(p, '/data');
  await shot(p, '11_datamanager_top');
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '11_datamanager_mid');
  await p.evaluate(() => window.scrollTo(0, 99999));
  await p.waitForTimeout(300);
  await shot(p, '11_datamanager_bottom');

  // ═══════════════════════════════════════════
  // 12. USERS PAGE (admin only)
  // ═══════════════════════════════════════════
  console.log('\n── 12. USERS');
  await nav(p, '/users');
  await shot(p, '12_users_list');
  await p.evaluate(() => window.scrollTo(0, 300));
  await p.waitForTimeout(300);
  await shot(p, '12_users_scrolled');

  // Add user form / modal
  await p.locator('button:has-text("Add User"), button:has-text("New User"), button:has-text("Add")').first().tap().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '12_users_add_form');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════
  // 13. AUDIT LOG
  // ═══════════════════════════════════════════
  console.log('\n── 13. AUDIT LOG');
  await nav(p, '/audit');
  await shot(p, '13_auditlog_top');
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '13_auditlog_entries');

  // ═══════════════════════════════════════════
  // 14. DARK MODE — key pages
  // ═══════════════════════════════════════════
  console.log('\n── 14. DARK MODE');
  // Toggle dark mode via sidebar
  await nav(p, '/');
  // Open sidebar
  await p.locator('header button, [class*="topbar"] button').first().tap().catch(() => {});
  await p.waitForTimeout(400);
  await tapText(p, 'Dark').catch(() => tapText(p, 'Light'));
  await p.waitForTimeout(500);
  await p.locator('.fixed.inset-0').first().tap().catch(() => {});
  await p.waitForTimeout(400);

  await shot(p, '14_dark_dashboard');
  await nav(p, '/new-bill');
  await shot(p, '14_dark_newbill');
  await nav(p, '/items');
  await shot(p, '14_dark_items');
  await nav(p, '/reports', 2500);
  await shot(p, '14_dark_reports');
  await nav(p, '/settings');
  await shot(p, '14_dark_settings');

  // Toggle back to light
  await p.locator('header button, [class*="topbar"] button').first().tap().catch(() => {});
  await p.waitForTimeout(400);
  await tapText(p, 'Light').catch(() => tapText(p, 'Dark'));
  await p.waitForTimeout(400);
  await p.locator('.fixed.inset-0').first().tap().catch(() => {});
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════
  // 15. EDGE CASES / OVERLAYS
  // ═══════════════════════════════════════════
  console.log('\n── 15. EDGE CASES & OVERLAYS');

  // NewBill — Tailoring modal
  await nav(p, '/new-bill');
  await p.fill('[data-testid="customer-name-input"]', 'Rajat');
  await p.fill('[data-testid="barcode-input"]', 'X001');
  await p.fill('[data-testid="qty-input"]', '2');
  await p.fill('[data-testid="price-input"]', '500');
  await p.locator('[data-testid="add-item-btn"]').tap();
  await p.waitForTimeout(300);
  // Check Needs Tailoring
  await p.evaluate(() => window.scrollTo(0, 99999));
  await p.waitForTimeout(300);
  await p.locator('label:has-text("Needs Tailoring") input, input[type="checkbox"]').nth(1).tap().catch(async () => {
    await tapText(p, 'Needs Tailoring');
  });
  await p.waitForTimeout(300);
  // Configure Tailoring button
  await p.locator('button:has-text("Configure Tailoring"), button:has-text("Tailoring")').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '15_newbill_tailoring_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Configure Add-ons button
  await p.locator('button:has-text("Configure Add-on"), button:has-text("Add-on")').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '15_newbill_addon_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // NewBill — duplicate warning (re-add same barcode)
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.fill('[data-testid="barcode-input"]', 'X001');
  await p.fill('[data-testid="qty-input"]', '1');
  await p.fill('[data-testid="price-input"]', '300');
  await p.locator('[data-testid="add-item-btn"]').tap();
  await p.waitForTimeout(400);
  await shot(p, '15_newbill_dup_warning');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);

  // JobWork — double-click item to open edit panel
  await nav(p, '/jobwork');
  await p.waitForTimeout(500);
  // Double tap an item card
  await p.locator('.bg-\\[var\\(--surface\\)\\] .space-y-1, div[class*="border"]').nth(2).dblclick().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '15_jobwork_edit_panel');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ItemsManager — Tailoring overlay
  await nav(p, '/items');
  await p.waitForTimeout(500);
  // Tap scissors icon on first order
  await p.locator('button:has([data-icon="scissors"])').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '15_items_tailoring_overlay');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ItemsManager — Tag/label icon (order label)
  await p.locator('button:has([data-icon="tag"])').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '15_items_label_overlay');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════
  // 16. OFFLINE STATE simulation
  // ═══════════════════════════════════════════
  console.log('\n── 16. OFFLINE BANNER');
  await nav(p, '/');
  await ctx.setOffline(true);
  await p.waitForTimeout(800);
  await shot(p, '16_offline_banner');
  await ctx.setOffline(false);
  await p.waitForTimeout(500);

  // ═══════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════
  await ctx.close();
  await browser.close();

  const files = fs.readdirSync(OUT).length;
  console.log(`\n✅ Full audit complete — ${files} screenshots saved to: ${OUT}`);
}

run().catch(err => { console.error('❌', err); process.exit(1); });
