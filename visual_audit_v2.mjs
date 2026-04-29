/**
 * COMPREHENSIVE MOBILE UI AUDIT v2
 * Covers all missing scenarios from v1 + newly found issues
 * Viewport: 390×844 mobile (no isMobile flag, touch enabled)
 * Run: node visual_audit_v2.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

const BASE = 'http://localhost:3000';
const OUT  = 'D:/Retail Code/Retail/audit_screenshots/v2';
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true };

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let shotCount = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(shotCount++).padStart(3,'0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 [${shotCount-1}] ${name}`);
}
async function shotFull(page, name) {
  const file = path.join(OUT, `${String(shotCount++).padStart(3,'0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 [${shotCount-1}] ${name} (full)`);
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
      const pr = http.request(opts, pres => {
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

async function getToken() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = http.request({
      hostname: 'localhost', port: 8001, path: '/api/auth/login',
      method: 'POST',
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


async function nav(page, path, wait = 1500) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
}

async function tapText(page, text) {
  await page.locator(`text="${text}"`).first().tap().catch(async () => {
    await page.locator(`button:has-text("${text}")`).first().tap().catch(() => {});
  });
}

async function scrollMain(page, y) {
  await page.evaluate(top => {
    // Pick the largest scrollable container (main content, not sidebar nav)
    const candidates = [...document.querySelectorAll('div.overflow-y-auto, div[class*="overflow-y-auto"]')]
      .filter(el => el.scrollHeight > 1000);
    const el = candidates[0] || document.scrollingElement;
    if (el) el.scrollTop = top;
    else window.scrollTo(0, top);
  }, y);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const token = await getToken();
  console.log('✓ Token acquired');

  const ctx = await browser.newContext({
    ...MOBILE,
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });

  const p = await ctx.newPage();
  await setupProxy(p);

  // Inject auth: navigate to login, set token in sessionStorage, reload
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await p.waitForTimeout(600);
  await p.evaluate(t => sessionStorage.setItem('token', t), token);
  await p.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(2500);
  console.log('✓ Auth injected');

  // ═══════════════════════════════════════════════════════
  // 1. DAYBOOK — tally/untally functionality (FIXED BUG)
  // ═══════════════════════════════════════════════════════
  console.log('\n── 1. DAYBOOK TALLY FLOW');
  await nav(p, '/daybook');
  await shot(p, '01_daybook_pending_initial');

  // Switch to Tallied to see entries
  await tapText(p, 'Tallied');
  await p.waitForTimeout(800);
  await shot(p, '01_daybook_tallied_entries_top');

  // Scroll to see actual entry cards
  await scrollMain(p, 800);
  await p.waitForTimeout(400);
  await shot(p, '01_daybook_tallied_entries_cards');

  // Full page to see all tally buttons on mobile cards
  await scrollMain(p, 0);
  await p.waitForTimeout(300);
  await shotFull(p, '01_daybook_tallied_full');

  // Un-tally first entry to see the Pending tab populated
  // tap the green tally button on the first entry's first category
  const tallyBtns = p.locator('.md\\:hidden button[aria-label*="Un-tally"], .md\\:hidden button[aria-label*="tally"]');
  const tallyCount = await tallyBtns.count();
  console.log(`    Found ${tallyCount} tally buttons in mobile view`);
  if (tallyCount > 0) {
    await tallyBtns.first().tap();
    await p.waitForTimeout(800);
    await shot(p, '01_daybook_after_untally_action');
  }

  // Go to Pending to see the untallied entry
  await tapText(p, 'Pending');
  await p.waitForTimeout(600);
  await shot(p, '01_daybook_pending_with_entry');
  await scrollMain(p, 600);
  await p.waitForTimeout(400);
  await shot(p, '01_daybook_pending_entry_cards');

  // Tally it back via "Tally all" button
  const tallyAllBtn = p.locator('button:has-text("Tally all")').first();
  if (await tallyAllBtn.isVisible().catch(() => false)) {
    await shot(p, '01_daybook_tally_all_button');
    await tallyAllBtn.tap();
    await p.waitForTimeout(800);
    await shot(p, '01_daybook_after_tally_all');
  }

  // Date filter — today
  await scrollMain(p, 0);
  await p.waitForTimeout(300);
  const dateSelect = p.locator('[data-testid="daybook-date-filter"]');
  await dateSelect.selectOption({ index: 1 }).catch(() => {});
  await p.waitForTimeout(700);
  await shot(p, '01_daybook_date_filtered_today');
  await scrollMain(p, 600);
  await p.waitForTimeout(400);
  await shot(p, '01_daybook_date_filtered_entries');
  await dateSelect.selectOption({ index: 0 }).catch(() => {});
  await p.waitForTimeout(400);

  // ═══════════════════════════════════════════════════════
  // 2. MANAGE ORDERS — full mobile flow
  // ═══════════════════════════════════════════════════════
  console.log('\n── 2. MANAGE ORDERS DETAIL FLOW');
  await nav(p, '/items');
  await shot(p, '02_items_list_initial');

  // Tap first order row to open detail pane (mobile: hides list, shows detail)
  await p.locator('div[class*="cursor-pointer"][class*="border-b"]').first().tap().catch(async () => {
    await p.locator('div.border-b.cursor-pointer').first().tap().catch(() => {});
  });
  await p.waitForTimeout(700);
  await shot(p, '02_items_detail_pane_open');

  // Scroll within detail pane
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '02_items_detail_pane_scrolled');

  await scrollMain(p, 800);
  await p.waitForTimeout(300);
  await shot(p, '02_items_detail_pane_bottom');

  // Back to orders list (mobile back button)
  await p.locator('button:has-text("Orders")').first().tap().catch(async () => {
    await p.goBack().catch(() => {});
  });
  await p.waitForTimeout(500);
  await shot(p, '02_items_back_to_list');

  // Open Settle payment panel
  await p.locator('div[class*="cursor-pointer"][class*="border-b"]').first().tap().catch(() => {});
  await p.waitForTimeout(700);
  // Find and tap the $ / Settle button in the detail pane
  await p.locator('button:has-text("Settle"), button[title*="ettle"], button:has([data-icon="currency-dollar"])').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '02_items_settlement_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);

  // Open edit overlay — scissors (tailoring) icon on list row
  await p.locator('button:has-text("Orders")').first().tap().catch(() => {});
  await p.waitForTimeout(400);
  await p.locator('button[title="Assign Tailoring"], button:has([data-icon="scissors"])').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '02_items_tailoring_assign_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Invoice modal — printer icon
  await p.locator('button[title="Invoice"], button:has([data-icon="printer"])').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '02_items_invoice_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Filter panel
  await p.locator('button:has([data-icon="funnel"]), button[aria-label*="filter"], button:has-text("Filters")').first().tap().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '02_items_filter_panel_open');
  // Apply a date filter
  await tapText(p, 'This Month').catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '02_items_filter_this_month');
  // Close filter: navigate fresh to clear all filter state
  await nav(p, '/items', 800);

  // Search flow
  await p.locator('input[placeholder*="earch"]').fill('Raj', { timeout: 8000 });
  await p.waitForTimeout(700);
  await shot(p, '02_items_search_results');

  // Tap search result to open detail
  await p.locator('div[class*="cursor-pointer"][class*="border-b"]').first().tap().catch(() => {});
  await p.waitForTimeout(700);
  await shot(p, '02_items_search_detail_open');
  await p.locator('button:has-text("Orders")').first().tap().catch(() => {});
  await p.waitForTimeout(400);
  await p.fill('input[placeholder*="earch"]', '');
  await p.waitForTimeout(400);

  // Multi-select — ctrl+click simulation via selectRef
  await nav(p, '/items');
  await shot(p, '02_items_settled_tab');

  // ═══════════════════════════════════════════════════════
  // 3. NEW BILL — full item entry flow with tailoring
  // ═══════════════════════════════════════════════════════
  console.log('\n── 3. NEW BILL EXTENDED FLOW');
  await nav(p, '/new-bill');

  // Customer name suggestions
  await p.fill('[data-testid="customer-name-input"]', 'Raj');
  await p.waitForTimeout(600);
  await shot(p, '03_newbill_customer_suggestions_list');
  // Select a suggestion
  await p.locator('[data-testid="customer-suggestion"]').first().tap().catch(async () => {
    await p.locator('.absolute.z-50 li, [class*="suggestion"]').first().tap().catch(() => {});
  });
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_customer_selected');

  // Fill item with tailoring need
  await p.fill('[data-testid="barcode-input"]', 'SHIRT001');
  await p.locator('[data-testid="article-type-select"]').selectOption({ index: 1 }).catch(async () => {
    await p.locator('select').nth(0).selectOption({ index: 1 }).catch(() => {});
  });
  await p.fill('[data-testid="qty-input"]', '2');
  await p.fill('[data-testid="price-input"]', '850');
  await shot(p, '03_newbill_item_form_filled');
  await p.locator('[data-testid="add-item-btn"]').tap();
  await p.waitForTimeout(400);
  await shot(p, '03_newbill_item_added_list');

  // Second item
  await p.fill('[data-testid="barcode-input"]', 'PANT002');
  await p.fill('[data-testid="qty-input"]', '1');
  await p.fill('[data-testid="price-input"]', '1200');
  await p.locator('[data-testid="add-item-btn"]').tap();
  await p.waitForTimeout(400);
  await scrollMain(p, 600);
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_two_items');
  await scrollMain(p, 0);

  // Edit an item
  await p.locator('[data-testid="edit-item-btn"], button[title*="dit"]').first().tap().catch(async () => {
    await p.locator('button:has([data-icon="pencil-simple"])').first().tap().catch(() => {});
  });
  await p.waitForTimeout(400);
  await shot(p, '03_newbill_edit_item_mode');

  // Scroll to payment section
  await scrollMain(p, 99999);
  await p.waitForTimeout(500);
  await shot(p, '03_newbill_payment_section');

  // Select Cash payment mode
  await p.locator('button:has-text("Cash"), label:has-text("Cash")').first().tap().catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_cash_selected');

  // Mark as Settled
  await p.locator('label:has-text("Settled") input[type="checkbox"], input[type="checkbox"]').first().tap().catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_fabric_settled');

  // Enable Needs Tailoring
  await p.locator('label:has-text("Needs Tailoring") input, label:has-text("Tailoring") input').first().tap().catch(async () => {
    await p.locator('input[type="checkbox"]').nth(1).tap().catch(() => {});
  });
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_tailoring_enabled');

  // Open Configure Tailoring modal
  await p.locator('button:has-text("Configure Tailoring"), button:has-text("Tailoring")').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '03_newbill_tailoring_modal_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_tailoring_modal_items');
  await scrollMain(p, 0);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Sticky save bar
  await scrollMain(p, 99999);
  await p.waitForTimeout(300);
  await shot(p, '03_newbill_sticky_save_bar');
  await scrollMain(p, 0);

  // Barcode scanner modal
  await p.locator('[data-testid="scan-barcode-btn"]').tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '03_newbill_scanner_modal');
  // Close scanner with its dedicated close button (Escape doesn't work)
  await p.locator('[data-testid="close-scanner-btn"]').tap().catch(async () => {
    await p.locator('[data-testid="barcode-scanner-modal"] button').first().tap().catch(() => {});
  });
  // Wait for scanner modal to fully disappear
  await p.locator('[data-testid="barcode-scanner-modal"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(500);

  // Duplicate barcode warning — navigate fresh to ensure clean state
  await nav(p, '/new-bill', 800);
  await p.fill('[data-testid="barcode-input"]', 'DUPE001');
  await p.fill('[data-testid="qty-input"]', '1');
  await p.fill('[data-testid="price-input"]', '500');
  await p.locator('[data-testid="add-item-btn"]').tap();
  await p.waitForTimeout(400);
  // Add same barcode again
  await p.fill('[data-testid="barcode-input"]', 'DUPE001');
  await p.fill('[data-testid="qty-input"]', '1');
  await p.fill('[data-testid="price-input"]', '500');
  await p.locator('[data-testid="add-item-btn"]').tap();
  await p.waitForTimeout(500);
  await shot(p, '03_newbill_dup_warning');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Add-on modal — navigate fresh again
  await nav(p, '/new-bill', 800);
  await p.fill('[data-testid="barcode-input"]', 'ADDON001');
  await p.fill('[data-testid="qty-input"]', '1');
  await p.fill('[data-testid="price-input"]', '400');
  await p.locator('[data-testid="add-item-btn"]').tap();
  await p.waitForTimeout(400);
  await p.locator('button:has-text("Add-on"), button:has-text("Configure Add-on")').first().tap().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '03_newbill_addon_modal');
  await p.locator('button:has([data-icon="x"]), button[title="Close"]').first().tap().catch(async () => {
    await p.keyboard.press('Escape');
  });
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════
  // 4. JOB WORK — full flow with embroidery & edit panel
  // ═══════════════════════════════════════════════════════
  console.log('\n── 4. JOB WORK EXTENDED');
  await nav(p, '/jobwork');
  await shot(p, '04_jobwork_pending_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(400);
  await shot(p, '04_jobwork_pending_list');

  // Select an item
  const jobCb = p.locator('input[type="checkbox"]').first();
  if (await jobCb.isVisible().catch(() => false)) {
    await jobCb.tap();
    await p.waitForTimeout(300);
    await shot(p, '04_jobwork_item_selected');
  }

  // Stitched sub-tab
  await tapText(p, 'Stitched');
  await p.waitForTimeout(600);
  await shot(p, '04_jobwork_stitched_tab');
  await scrollMain(p, 300);
  await p.waitForTimeout(300);
  await shot(p, '04_jobwork_stitched_entries');

  // Select and move to Delivered
  const stitchedCb = p.locator('input[type="checkbox"]').first();
  if (await stitchedCb.isVisible().catch(() => false)) {
    await stitchedCb.tap();
    await p.waitForTimeout(300);
    await shot(p, '04_jobwork_stitched_selected');
    const moveBtn = p.locator('button:has-text("Move"), button:has-text("Deliver")').first();
    if (await moveBtn.isVisible().catch(() => false)) {
      await moveBtn.tap();
      await p.waitForTimeout(500);
      await shot(p, '04_jobwork_move_to_delivered_confirm');
      await tapText(p, 'Cancel').catch(() => { p.keyboard.press('Escape'); });
      await p.waitForTimeout(300);
    }
    await stitchedCb.tap().catch(() => {});
  }

  // Delivered tab
  await tapText(p, 'Delivered');
  await p.waitForTimeout(600);
  await shot(p, '04_jobwork_delivered_tab');

  // Back to Pending
  await tapText(p, 'Pending');
  await p.waitForTimeout(400);

  // Item double-click to open edit panel (items are cursor-pointer divs in StatusColumn)
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  const jobItemRow = p.locator('div.cursor-pointer').filter({ hasText: /Kurta|Pant|Jacket|Shirt/ }).first();
  await jobItemRow.dblclick({ timeout: 5000 }).catch(async () => {
    // fallback: tap twice
    await jobItemRow.tap().catch(() => {});
    await p.waitForTimeout(200);
    await jobItemRow.tap().catch(() => {});
  });
  await p.waitForTimeout(800);
  await shot(p, '04_jobwork_item_edit_panel');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Embroidery tab
  await tapText(p, 'Embroidery');
  await p.waitForTimeout(700);
  await shot(p, '04_jobwork_embroidery_tab');
  await scrollMain(p, 300);
  await p.waitForTimeout(300);
  await shot(p, '04_jobwork_embroidery_list');
  await scrollMain(p, 0);

  // Filter by karigar
  const karigarSelect = p.locator('select').nth(1);
  const karigarCount = await karigarSelect.locator('option').count().catch(() => 0);
  if (karigarCount > 1) {
    await karigarSelect.selectOption({ index: 1 });
    await p.waitForTimeout(500);
    await shot(p, '04_jobwork_filtered_by_karigar');
    await karigarSelect.selectOption({ index: 0 });
    await p.waitForTimeout(300);
  }

  // ═══════════════════════════════════════════════════════
  // 5. ORDER STATUS — expanded
  // ═══════════════════════════════════════════════════════
  console.log('\n── 5. ORDER STATUS EXPANDED');
  await nav(p, '/order-status');
  await shot(p, '05_orderstatus_top');
  // Stats cards
  await scrollMain(p, 300);
  await p.waitForTimeout(300);
  await shot(p, '05_orderstatus_stat_cards');
  // Scroll to order grid — use inner scroll container
  await scrollMain(p, 800);
  await p.waitForTimeout(600);
  await shot(p, '05_orderstatus_grid_top');
  await scrollMain(p, 1400);
  await p.waitForTimeout(400);
  await shot(p, '05_orderstatus_grid_scrolled');
  await scrollMain(p, 2400);
  await p.waitForTimeout(400);
  await shot(p, '05_orderstatus_grid_rows');

  // Apply date filter
  await scrollMain(p, 0);
  await p.waitForTimeout(300);
  const fromInput = p.locator('input[type="date"]').first();
  if (await fromInput.isVisible().catch(() => false)) {
    await fromInput.fill('2026-04-01');
    await p.waitForTimeout(200);
    await tapText(p, 'Apply Filters');
    await p.waitForTimeout(700);
    await shot(p, '05_orderstatus_date_filtered');
    await scrollMain(p, 900);
    await p.waitForTimeout(400);
    await shot(p, '05_orderstatus_date_filtered_grid');
    await fromInput.fill('');
    await tapText(p, 'Apply Filters');
    await p.waitForTimeout(500);
  }

  // Customer filter
  const custSel = p.locator('select').first();
  const custOpts = await custSel.locator('option').count().catch(() => 0);
  if (custOpts > 1) {
    await custSel.selectOption({ index: 1 });
    await tapText(p, 'Apply Filters');
    await p.waitForTimeout(700);
    await scrollMain(p, 900);
    await p.waitForTimeout(300);
    await shot(p, '05_orderstatus_customer_filtered_grid');
    await custSel.selectOption({ index: 0 });
    await tapText(p, 'Apply Filters');
    await p.waitForTimeout(500);
  }

  // ═══════════════════════════════════════════════════════
  // 6. REPORTS — all tabs with charts visible
  // ═══════════════════════════════════════════════════════
  console.log('\n── 6. REPORTS ALL TABS');
  await nav(p, '/reports', 3000);
  await shot(p, '06_reports_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(400);
  await shot(p, '06_reports_summary_cards');
  await scrollMain(p, 900);
  await p.waitForTimeout(400);
  await shot(p, '06_reports_tab_bar_visible');

  // Revenue tab
  await tapText(p, 'Revenue');
  await p.waitForTimeout(1000);
  await scrollMain(p, 900);
  await p.waitForTimeout(500);
  await shot(p, '06_reports_revenue_chart_area');
  await scrollMain(p, 1400);
  await p.waitForTimeout(400);
  await shot(p, '06_reports_revenue_chart_scrolled');

  // Customers tab
  await scrollMain(p, 900);
  await p.waitForTimeout(300);
  await tapText(p, 'Customers');
  await p.waitForTimeout(1500);
  await shot(p, '06_reports_customers_tab');
  await scrollMain(p, 1200);
  await p.waitForTimeout(400);
  await shot(p, '06_reports_customers_table');

  // Breakdown tab
  await scrollMain(p, 900);
  await p.waitForTimeout(300);
  await tapText(p, 'Breakdown');
  await p.waitForTimeout(1500);
  await shot(p, '06_reports_breakdown_tab');
  await scrollMain(p, 1300);
  await p.waitForTimeout(500);
  await shot(p, '06_reports_breakdown_charts');

  // Period filters
  await scrollMain(p, 600);
  await p.waitForTimeout(300);
  await tapText(p, 'Today');
  await p.waitForTimeout(1200);
  await shot(p, '06_reports_today_filter');
  await tapText(p, 'This Week');
  await p.waitForTimeout(1200);
  await shot(p, '06_reports_this_week');
  await tapText(p, 'This Month');
  await p.waitForTimeout(1200);
  await shot(p, '06_reports_this_month');
  await tapText(p, 'This Year');
  await p.waitForTimeout(1200);
  await shot(p, '06_reports_this_year');

  // Export button
  await scrollMain(p, 0);
  await p.waitForTimeout(300);
  await shot(p, '06_reports_export_button');

  // ═══════════════════════════════════════════════════════
  // 7. LABOUR PAYMENTS — full flow
  // ═══════════════════════════════════════════════════════
  console.log('\n── 7. LABOUR PAYMENTS FLOW');
  await nav(p, '/labour');
  await shot(p, '07_labour_unpaid_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '07_labour_unpaid_list');
  await scrollMain(p, 0);

  // Select one item — sticky bar should appear
  const lCb1 = p.locator('input[type="checkbox"]').nth(1);
  if (await lCb1.isVisible().catch(() => false)) {
    await lCb1.tap();
    await p.waitForTimeout(400);
    await shot(p, '07_labour_one_selected_sticky_bar');
    // Select more
    await p.locator('input[type="checkbox"]').nth(2).tap().catch(() => {});
    await p.locator('input[type="checkbox"]').nth(3).tap().catch(() => {});
    await p.waitForTimeout(300);
    await shot(p, '07_labour_multi_selected');
    // Deselect all
    await lCb1.tap().catch(() => {});
    await p.locator('input[type="checkbox"]').nth(2).tap().catch(() => {});
    await p.locator('input[type="checkbox"]').nth(3).tap().catch(() => {});
    await p.waitForTimeout(300);
  }

  // Select All
  const headerCb = p.locator('input[type="checkbox"]').first();
  await headerCb.tap().catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, '07_labour_select_all_sticky');
  await headerCb.tap().catch(() => {}); // deselect

  // Filter by type
  const typeDropdown = p.locator('select').first();
  await typeDropdown.selectOption('Embroidery').catch(async () => {
    await p.locator('select').nth(0).selectOption({ index: 1 }).catch(() => {});
  });
  await p.waitForTimeout(500);
  await shot(p, '07_labour_embroidery_type');
  await typeDropdown.selectOption({ index: 0 }).catch(() => {});
  await p.waitForTimeout(300);

  // Paid tab
  await tapText(p, 'Paid');
  await p.waitForTimeout(800);
  await shot(p, '07_labour_paid_tab');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '07_labour_paid_entries');
  await scrollMain(p, 0);

  // Sticky pay bar — select items first then capture bar + selected state
  await tapText(p, 'Pending');
  await p.waitForTimeout(600);
  // Select first 2 items
  await p.locator('input[type="checkbox"]').nth(1).tap().catch(() => {});
  await p.locator('input[type="checkbox"]').nth(2).tap().catch(() => {});
  await p.waitForTimeout(300);
  // Scroll to bottom to show sticky pay bar in full context
  await scrollMain(p, 99999);
  await p.waitForTimeout(400);
  await shot(p, '07_labour_sticky_pay_bar_full');
  // Scroll back up so the selected items AND the bar are both visible
  await scrollMain(p, 200);
  await p.waitForTimeout(300);
  await shot(p, '07_labour_pay_bar_with_list');
  // Deselect
  await p.locator('input[type="checkbox"]').nth(1).tap().catch(() => {});
  await p.locator('input[type="checkbox"]').nth(2).tap().catch(() => {});

  // ═══════════════════════════════════════════════════════
  // 8. SETTINGS — scroll via inner container
  // ═══════════════════════════════════════════════════════
  console.log('\n── 8. SETTINGS ALL SECTIONS');
  await nav(p, '/settings');
  await shot(p, '08_settings_top');

  // Scroll the settings inner scrollable container
  await p.evaluate(() => {
    const el = document.querySelector('[class*="overflow-y-auto"], main, .overflow-y-auto');
    if (el) el.scrollTop = 400;
    else window.scrollTo(0, 400);
  });
  await p.waitForTimeout(400);
  await shot(p, '08_settings_article_types');

  await p.evaluate(() => {
    const el = document.querySelector('[class*="overflow-y-auto"], main, .overflow-y-auto');
    if (el) el.scrollTop = 900;
    else window.scrollTo(0, 900);
  });
  await p.waitForTimeout(400);
  await shot(p, '08_settings_payment_modes');

  await p.evaluate(() => {
    const el = document.querySelector('[class*="overflow-y-auto"], main, .overflow-y-auto');
    if (el) el.scrollTop = 1400;
    else window.scrollTo(0, 1400);
  });
  await p.waitForTimeout(400);
  await shot(p, '08_settings_addon_items');

  await p.evaluate(() => {
    const el = document.querySelector('[class*="overflow-y-auto"], main, .overflow-y-auto');
    if (el) el.scrollTop = 1900;
    else window.scrollTo(0, 1900);
  });
  await p.waitForTimeout(400);
  await shot(p, '08_settings_karigars');

  await p.evaluate(() => {
    const el = document.querySelector('[class*="overflow-y-auto"], main, .overflow-y-auto');
    if (el) el.scrollTop = 2500;
    else window.scrollTo(0, 2500);
  });
  await p.waitForTimeout(400);
  await shot(p, '08_settings_firm_details');

  await p.evaluate(() => {
    const el = document.querySelector('[class*="overflow-y-auto"], main, .overflow-y-auto');
    if (el) el.scrollTop = 99999;
    else window.scrollTo(0, 99999);
  });
  await p.waitForTimeout(400);
  await shot(p, '08_settings_bottom');

  // Full page settings
  await shotFull(p, '08_settings_full_page');

  // Dirty state
  await p.evaluate(() => {
    const el = document.querySelector('[class*="overflow-y-auto"], main, .overflow-y-auto');
    if (el) el.scrollTop = 0;
    else window.scrollTo(0, 0);
  });
  await p.waitForTimeout(300);
  const rateInput = p.locator('input[type="number"]').first();
  if (await rateInput.isVisible().catch(() => false)) {
    const curVal = await rateInput.inputValue();
    await rateInput.fill(String(parseInt(curVal || '500') + 1));
    await p.waitForTimeout(300);
    await shot(p, '08_settings_dirty_save_button');
    await rateInput.fill(curVal); // revert
    await p.waitForTimeout(200);
  }

  // ═══════════════════════════════════════════════════════
  // 9. DATA MANAGER — all tabs
  // ═══════════════════════════════════════════════════════
  console.log('\n── 9. DATA MANAGER ALL TABS');
  await nav(p, '/data');
  await shot(p, '09_datamanager_import_tab');

  // Export Data tab
  await tapText(p, 'Export Data');
  await p.waitForTimeout(500);
  await shot(p, '09_datamanager_export_tab');

  // Backup & Restore tab
  await tapText(p, 'Backup & Restore');
  await p.waitForTimeout(500);
  await shot(p, '09_datamanager_backup_tab');
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '09_datamanager_backup_scrolled');

  // Data Audit tab (4th — was clipped before fix)
  await tapText(p, 'Data Audit');
  await p.waitForTimeout(700);
  await shot(p, '09_datamanager_audit_tab');
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '09_datamanager_audit_results');

  // ═══════════════════════════════════════════════════════
  // 10. USERS — edit, reset password, page permissions
  // ═══════════════════════════════════════════════════════
  console.log('\n── 10. USERS EXTENDED');
  await nav(p, '/users');
  await shot(p, '10_users_list');

  // Edit user
  await p.locator('button[title="Edit"], button:has([data-icon="pencil-simple"])').first().tap().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '10_users_edit_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Reset password
  await p.locator('button[title="Reset password"], button:has([data-icon="lock-key"])').first().tap().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '10_users_reset_password_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Page permissions (shield icon) — not admin
  await p.locator('button[title="Page permissions"], button:has([data-icon="shield-check"])').first().tap().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '10_users_page_permissions_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Add User form — close any open modal first, then click Add User button
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.locator('button:has-text("Add User"), button:has([data-icon="user-plus"])').last().tap().catch(async () => {
    await p.locator('button').filter({ hasText: 'Add User' }).last().tap().catch(() => {});
  });
  await p.waitForTimeout(500);
  await shot(p, '10_users_add_form');
  // Fill form with whatever inputs are present
  const inputs = p.locator('.fixed input, [role="dialog"] input, .modal input, form input');
  const inCount = await inputs.count().catch(() => 0);
  if (inCount > 0) {
    await inputs.nth(0).fill('Test User').catch(() => {});
    await inputs.nth(1).fill('testuser99').catch(() => {});
    if (inCount > 2) await inputs.nth(2).fill('test1234').catch(() => {});
    await p.waitForTimeout(200);
    await shot(p, '10_users_add_form_filled');
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════
  // 11. SIDEBAR — open state, nav items, close button
  // ═══════════════════════════════════════════════════════
  console.log('\n── 11. SIDEBAR FLOWS');
  await nav(p, '/');
  // Open sidebar via hamburger
  await p.locator('header button').first().tap().catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, '11_sidebar_open_dashboard');
  // Scroll sidebar nav (if long)
  await p.evaluate(() => {
    const sidebar = document.querySelector('aside[data-testid="sidebar"]');
    if (sidebar) sidebar.scrollTop = 200;
  });
  await p.waitForTimeout(300);
  await shot(p, '11_sidebar_scrolled');
  // Close via X button
  await p.locator('aside button[aria-label="Close sidebar"]').first().tap().catch(async () => {
    await p.locator('.fixed.inset-0').first().tap().catch(() => {});
  });
  await p.waitForTimeout(400);
  await shot(p, '11_sidebar_closed_after_x');

  // Dark mode toggle via sidebar
  await p.locator('header button').first().tap().catch(() => {});
  await p.waitForTimeout(400);
  await tapText(p, 'Dark').catch(() => tapText(p, 'Light'));
  await p.waitForTimeout(400);
  await shot(p, '11_sidebar_dark_mode_active');
  // Close
  await p.locator('aside button[aria-label="Close sidebar"]').first().tap().catch(async () => {
    await p.locator('.fixed.inset-0').first().tap().catch(() => {});
  });
  await p.waitForTimeout(400);
  await shot(p, '11_dark_mode_dashboard');

  // Navigate while dark
  await nav(p, '/daybook');
  await shot(p, '11_dark_daybook');
  await nav(p, '/labour');
  await shot(p, '11_dark_labour');

  // Toggle back to light
  await p.locator('header button').first().tap().catch(() => {});
  await p.waitForTimeout(400);
  await tapText(p, 'Light').catch(() => tapText(p, 'Dark'));
  await p.waitForTimeout(400);
  await p.locator('aside button[aria-label="Close sidebar"]').first().tap().catch(async () => {
    await p.locator('.fixed.inset-0').first().tap().catch(() => {});
  });
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════
  // 12. AUDIT LOG — filters
  // ═══════════════════════════════════════════════════════
  console.log('\n── 12. AUDIT LOG FILTERS');
  await nav(p, '/audit');
  await shot(p, '12_auditlog_top');
  // Open filters
  await p.locator('button:has-text("Filters")').first().tap().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '12_auditlog_filters_open');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(300);
  await shot(p, '12_auditlog_entries_scrolled');

  // ═══════════════════════════════════════════════════════
  // 13. LOGIN FLOWS — empty, validation, wrong pass
  // ═══════════════════════════════════════════════════════
  console.log('\n── 13. LOGIN EDGE CASES');
  // Force logout by clearing storage
  await p.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await nav(p, '/login', 1000);
  await shot(p, '13_login_empty');
  // Try submit empty
  await p.locator('button[type="submit"]').tap().catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, '13_login_validation_error');
  // Wrong password
  await p.fill('input[placeholder*="sername"]', 'admin');
  await p.fill('input[type="password"]', 'wrongpass');
  await p.locator('button[type="submit"]').tap();
  await p.waitForTimeout(1000);
  await shot(p, '13_login_wrong_password');
  // Correct login
  await p.fill('input[type="password"]', 'admin123');
  await p.locator('button[type="submit"]').tap();
  await p.waitForTimeout(1500);
  await shot(p, '13_login_success_redirect');

  // ═══════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════
  await ctx.close();
  await browser.close();

  const files = fs.readdirSync(OUT).length;
  console.log(`\n✅ v2 audit complete — ${files} screenshots saved to: ${OUT}`);
}

run().catch(err => { console.error('❌', err); process.exit(1); });
