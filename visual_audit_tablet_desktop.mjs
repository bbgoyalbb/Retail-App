/**
 * COMPREHENSIVE TABLET + DESKTOP UI AUDIT
 * Covers ALL pages and ALL interactive scenarios at:
 *   - Tablet:  768×1024 (iPad — md: breakpoint boundary)
 *   - Desktop: 1440×900 (standard laptop/monitor)
 *
 * Run: node visual_audit_tablet_desktop.mjs
 * Requires: frontend on :3000, backend on :8001
 * Output: audit_screenshots/tablet/  and  audit_screenshots/desktop/
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';

const BASE       = 'http://localhost:3000';
const OUT_TABLET  = 'D:/Retail Code/Retail/audit_screenshots/tablet';
const OUT_DESKTOP = 'D:/Retail Code/Retail/audit_screenshots/desktop';

const VIEWPORTS = [
  {
    label: 'tablet',
    out: OUT_TABLET,
    config: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
  },
  {
    label: 'desktop',
    out: OUT_DESKTOP,
    config: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, hasTouch: false,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
  }
];

for (const vp of VIEWPORTS) {
  if (!fs.existsSync(vp.out)) fs.mkdirSync(vp.out, { recursive: true });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getToken() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = http.request({
      hostname: 'localhost', port: 8001, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data).access_token); } catch { reject(new Error('Bad response: ' + data)); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function setupProxy(page) {
  await page.route('http://localhost:8001/**', async route => {
    const req  = route.request();
    const url  = new URL(req.url());
    const body = req.postDataBuffer();
    const headers = { ...req.headers() };
    delete headers['host'];
    return new Promise(resolve => {
      const opts = { hostname: 'localhost', port: 8001, path: url.pathname + url.search, method: req.method(), headers };
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

let shotCount = 0;
let shotOut   = '';

function resetCount() { shotCount = 0; }

async function shot(page, name) {
  const file = path.join(shotOut, `${String(shotCount++).padStart(3, '0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 [${shotCount - 1}] ${name}`);
}

async function shotFull(page, name) {
  const file = path.join(shotOut, `${String(shotCount++).padStart(3, '0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 [${shotCount - 1}] ${name} (full)`);
}

async function nav(page, route, wait = 1500) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
}

async function click(page, text) {
  await page.locator(`text="${text}"`).first().click().catch(async () => {
    await page.locator(`button:has-text("${text}")`).first().click().catch(() => {});
  });
}

// Scroll the main content container (not sidebar)
async function scrollMain(page, y) {
  await page.evaluate(top => {
    const candidates = [...document.querySelectorAll('div.overflow-y-auto, div[class*="overflow-y-auto"]')]
      .filter(el => el.scrollHeight > 1000);
    const el = candidates[0] || document.scrollingElement;
    if (el) el.scrollTop = top;
    else window.scrollTo(0, top);
  }, y);
}

// ─── Full audit for one viewport ────────────────────────────────────────────

async function auditViewport(browser, token, viewport) {
  shotOut = viewport.out;
  resetCount();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  AUDITING: ${viewport.label.toUpperCase()}  (${viewport.config.viewport.width}×${viewport.config.viewport.height})`);
  console.log(`${'═'.repeat(60)}`);

  const ctx = await browser.newContext({ ...viewport.config, ignoreHTTPSErrors: true });
  const p   = await ctx.newPage();
  await setupProxy(p);

  // Inject auth
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await p.waitForTimeout(500);
  await p.evaluate(t => sessionStorage.setItem('token', t), token);
  await p.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(2000);
  console.log('✓ Auth injected');

  // ═══════════════════════════════════════════════════════
  // 1. DASHBOARD
  // ═══════════════════════════════════════════════════════
  console.log('\n── 1. DASHBOARD');
  await nav(p, '/');
  await shot(p, '01_dashboard_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '01_dashboard_stat_cards');
  await scrollMain(p, 900);
  await p.waitForTimeout(300);
  await shot(p, '01_dashboard_quick_links');
  await scrollMain(p, 1400);
  await p.waitForTimeout(300);
  await shot(p, '01_dashboard_recent_orders');
  await scrollMain(p, 2000);
  await p.waitForTimeout(300);
  await shot(p, '01_dashboard_bottom');
  await shotFull(p, '01_dashboard_full_page');

  // ═══════════════════════════════════════════════════════
  // 2. DAYBOOK — full tally flow
  // ═══════════════════════════════════════════════════════
  console.log('\n── 2. DAYBOOK');
  await nav(p, '/daybook');
  await shot(p, '02_daybook_pending_initial');
  await scrollMain(p, 500);
  await p.waitForTimeout(300);
  await shot(p, '02_daybook_pending_list');
  await scrollMain(p, 0);

  // Switch to Tallied
  await click(p, 'Tallied');
  await p.waitForTimeout(800);
  await shot(p, '02_daybook_tallied_top');
  await scrollMain(p, 600);
  await p.waitForTimeout(400);
  await shot(p, '02_daybook_tallied_entries');
  await scrollMain(p, 0);
  await shotFull(p, '02_daybook_tallied_full');

  // Un-tally first entry
  const tallyBtns = p.locator('button[aria-label*="Un-tally"], button[aria-label*="tally"], button[aria-label*="Tally"]');
  const tallyCount = await tallyBtns.count();
  console.log(`    Found ${tallyCount} tally buttons`);
  if (tallyCount > 0) {
    await tallyBtns.first().click({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(800);
    await shot(p, '02_daybook_after_untally');
  }

  // Pending tab — tally all
  await click(p, 'Pending');
  await p.waitForTimeout(600);
  await shot(p, '02_daybook_pending_with_entry');
  await scrollMain(p, 500);
  await p.waitForTimeout(300);
  await shot(p, '02_daybook_pending_cards');
  const tallyAllBtn = p.locator('button:has-text("Tally all")').first();
  if (await tallyAllBtn.isVisible().catch(() => false)) {
    await scrollMain(p, 0);
    await shot(p, '02_daybook_tally_all_button');
    await tallyAllBtn.click({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(800);
    await shot(p, '02_daybook_after_tally_all');
  }

  // Date filter
  await scrollMain(p, 0);
  const dateSelect = p.locator('[data-testid="daybook-date-filter"]');
  await dateSelect.selectOption({ index: 1 }).catch(() => {});
  await p.waitForTimeout(700);
  await shot(p, '02_daybook_date_filter_today');
  await scrollMain(p, 500);
  await p.waitForTimeout(300);
  await shot(p, '02_daybook_date_filter_entries');
  await dateSelect.selectOption({ index: 0 }).catch(() => {});
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════
  // 3. MANAGE ORDERS (ItemsManager)
  // ═══════════════════════════════════════════════════════
  console.log('\n── 3. MANAGE ORDERS');
  await nav(p, '/items');
  await shot(p, '03_items_list_initial');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '03_items_list_scrolled');
  await scrollMain(p, 0);

  // Open first order detail
  await p.locator('div[class*="cursor-pointer"][class*="border-b"], tr.cursor-pointer, div.border-b').first().click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(700);
  await shot(p, '03_items_detail_open');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '03_items_detail_scrolled');
  await scrollMain(p, 900);
  await p.waitForTimeout(300);
  await shot(p, '03_items_detail_bottom');
  await scrollMain(p, 0);

  // Settlement modal
  await p.locator('button:has-text("Settle"), button[title*="ettle"], button:has([data-icon="currency-dollar"])').first().click().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '03_items_settlement_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);

  // Back to list (desktop: click another row; tablet mobile: back button)
  await p.locator('button:has-text("Orders")').first().click().catch(() => {});
  await p.waitForTimeout(400);

  // Tailoring assign modal
  await p.locator('button[title="Assign Tailoring"], button:has([data-icon="scissors"])').first().click().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '03_items_tailoring_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Invoice modal
  await p.locator('button[title="Invoice"], button:has([data-icon="printer"])').first().click().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '03_items_invoice_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Filter panel
  await p.locator('button:has([data-icon="funnel"]), button[aria-label*="ilter"], button:has-text("Filters")').first().click().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '03_items_filter_panel');
  await click(p, 'This Month').catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, '03_items_filter_this_month');
  await nav(p, '/items', 800);

  // Search
  await p.locator('input[placeholder*="earch"]').fill('Raj', { timeout: 8000 });
  await p.waitForTimeout(700);
  await shot(p, '03_items_search_results');
  await p.locator('div[class*="cursor-pointer"][class*="border-b"], tr.cursor-pointer, div.border-b').first().click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '03_items_search_detail');
  await p.locator('button:has-text("Orders")').first().click().catch(() => {});
  await p.waitForTimeout(300);
  await p.fill('input[placeholder*="earch"]', '');
  await p.waitForTimeout(300);

  // Settled tab
  await nav(p, '/items');
  await p.locator('button:has-text("Settled"), [data-testid="settled-tab"]').first().click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '03_items_settled_tab');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '03_items_settled_list');

  // ═══════════════════════════════════════════════════════
  // 4. NEW BILL
  // ═══════════════════════════════════════════════════════
  console.log('\n── 4. NEW BILL');
  await nav(p, '/new-bill');
  await shot(p, '04_newbill_blank');

  // Customer suggestions
  await p.fill('[data-testid="customer-name-input"]', 'Raj');
  await p.waitForTimeout(600);
  await shot(p, '04_newbill_customer_suggestions');
  await p.locator('[data-testid="customer-suggestion"]').first().click().catch(async () => {
    await p.locator('.absolute.z-50 li, [class*="suggestion"]').first().click().catch(() => {});
  });
  await p.waitForTimeout(300);
  await shot(p, '04_newbill_customer_selected');

  // Add first item
  await p.fill('[data-testid="barcode-input"]', 'SHIRT001');
  await p.locator('[data-testid="article-type-select"]').selectOption({ index: 1 }).catch(() => {});
  await p.fill('[data-testid="qty-input"]', '2');
  await p.fill('[data-testid="price-input"]', '850');
  await shot(p, '04_newbill_item_form_filled');
  await p.locator('[data-testid="add-item-btn"]').click();
  await p.waitForTimeout(400);
  await shot(p, '04_newbill_item_added');

  // Add second item
  await p.fill('[data-testid="barcode-input"]', 'PANT002');
  await p.fill('[data-testid="qty-input"]', '1');
  await p.fill('[data-testid="price-input"]', '1200');
  await p.locator('[data-testid="add-item-btn"]').click();
  await p.waitForTimeout(400);
  await scrollMain(p, 500);
  await p.waitForTimeout(300);
  await shot(p, '04_newbill_two_items_list');
  await scrollMain(p, 0);

  // Edit item inline
  await p.locator('[data-testid="edit-item-btn"], button[title*="dit"], button:has([data-icon="pencil-simple"])').first().click().catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, '04_newbill_edit_item_mode');

  // Payment section
  await scrollMain(p, 99999);
  await p.waitForTimeout(500);
  await shot(p, '04_newbill_payment_section');
  await p.locator('button:has-text("Cash"), label:has-text("Cash")').first().click().catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, '04_newbill_cash_mode');
  await p.locator('label:has-text("Settled") input[type="checkbox"], input[type="checkbox"]').first().click().catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, '04_newbill_fabric_settled');

  // Tailoring toggle
  await p.locator('label:has-text("Needs Tailoring") input, label:has-text("Tailoring") input').first().click().catch(async () => {
    await p.locator('input[type="checkbox"]').nth(1).click().catch(() => {});
  });
  await p.waitForTimeout(300);
  await shot(p, '04_newbill_tailoring_enabled');

  // Configure Tailoring modal
  await p.locator('button:has-text("Configure Tailoring"), button:has-text("Tailoring")').first().click().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '04_newbill_tailoring_modal_top');
  await scrollMain(p, 500);
  await p.waitForTimeout(300);
  await shot(p, '04_newbill_tailoring_modal_items');
  await scrollMain(p, 0);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Sticky save bar
  await scrollMain(p, 99999);
  await p.waitForTimeout(300);
  await shot(p, '04_newbill_sticky_save_bar');
  await scrollMain(p, 0);

  // Barcode scanner modal
  await p.locator('[data-testid="scan-barcode-btn"]').click().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '04_newbill_scanner_modal');
  await p.locator('[data-testid="close-scanner-btn"]').click().catch(async () => {
    await p.locator('[data-testid="barcode-scanner-modal"] button').first().click().catch(() => {});
  });
  await p.locator('[data-testid="barcode-scanner-modal"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(400);

  // Duplicate barcode warning
  await nav(p, '/new-bill', 800);
  await p.fill('[data-testid="barcode-input"]', 'DUPE001');
  await p.fill('[data-testid="qty-input"]', '1');
  await p.fill('[data-testid="price-input"]', '500');
  await p.locator('[data-testid="add-item-btn"]').click();
  await p.waitForTimeout(400);
  await p.fill('[data-testid="barcode-input"]', 'DUPE001');
  await p.fill('[data-testid="qty-input"]', '1');
  await p.fill('[data-testid="price-input"]', '500');
  await p.locator('[data-testid="add-item-btn"]').click();
  await p.waitForTimeout(500);
  await shot(p, '04_newbill_dup_warning');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Add-on modal
  await nav(p, '/new-bill', 800);
  await p.fill('[data-testid="barcode-input"]', 'ADDON001');
  await p.fill('[data-testid="qty-input"]', '1');
  await p.fill('[data-testid="price-input"]', '400');
  await p.locator('[data-testid="add-item-btn"]').click();
  await p.waitForTimeout(400);
  await p.locator('button:has-text("Add-on"), button:has-text("Configure Add-on")').first().click().catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, '04_newbill_addon_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════
  // 5. JOB WORK
  // ═══════════════════════════════════════════════════════
  console.log('\n── 5. JOB WORK');
  await nav(p, '/jobwork');
  await shot(p, '05_jobwork_tailoring_pending_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(400);
  await shot(p, '05_jobwork_pending_list');
  await scrollMain(p, 0);

  // Sort buttons
  const ordSort = p.locator('button:has-text("Ord"), button:has-text("ORD")').first();
  if (await ordSort.isVisible().catch(() => false)) {
    await ordSort.click();
    await p.waitForTimeout(300);
    await shot(p, '05_jobwork_sorted_by_order');
  }

  // Select item & show move bar
  const jobCb = p.locator('input[type="checkbox"]').first();
  if (await jobCb.isVisible().catch(() => false)) {
    await jobCb.click();
    await p.waitForTimeout(300);
    await shot(p, '05_jobwork_item_selected_move_bar');
    await jobCb.click().catch(() => {});
  }

  // Stitched tab
  await click(p, 'Stitched');
  await p.waitForTimeout(600);
  await shot(p, '05_jobwork_stitched_tab');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '05_jobwork_stitched_list');

  // Select & show move dialog
  const stitchedCb = p.locator('input[type="checkbox"]').first();
  if (await stitchedCb.isVisible().catch(() => false)) {
    await stitchedCb.click().catch(() => {});
    await p.waitForTimeout(300);
    await shot(p, '05_jobwork_stitched_selected');
    const moveBtn = p.locator('button:has-text("Move"), button:has-text("Deliver")').first();
    if (await moveBtn.isVisible().catch(() => false)) {
      await moveBtn.click().catch(() => {});
      await p.waitForTimeout(500);
      await shot(p, '05_jobwork_move_dialog');
      await click(p, 'Cancel').catch(async () => { await p.keyboard.press('Escape'); });
      await p.waitForTimeout(300);
    }
    await stitchedCb.click().catch(() => {});
  }

  // Delivered tab
  await click(p, 'Delivered');
  await p.waitForTimeout(600);
  await shot(p, '05_jobwork_delivered_tab');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '05_jobwork_delivered_list');

  // Back to Pending + double-click edit panel
  await click(p, 'Pending');
  await p.waitForTimeout(500);
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  const jobRow = p.locator('div.cursor-pointer').filter({ hasText: /Kurta|Pant|Jacket|Shirt|Blazer|Pajama/ }).first();
  await jobRow.dblclick({ timeout: 5000 }).catch(async () => {
    await jobRow.click().catch(() => {});
    await p.waitForTimeout(200);
    await jobRow.click().catch(() => {});
  });
  await p.waitForTimeout(800);
  await shot(p, '05_jobwork_item_edit_panel');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Embroidery tab + filters
  await click(p, 'Embroidery');
  await p.waitForTimeout(700);
  await shot(p, '05_jobwork_embroidery_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '05_jobwork_embroidery_list');
  await scrollMain(p, 0);

  // Filter by karigar
  const kSel = p.locator('select').nth(1);
  const kCount = await kSel.locator('option').count().catch(() => 0);
  if (kCount > 1) {
    await kSel.selectOption({ index: 1 });
    await p.waitForTimeout(500);
    await shot(p, '05_jobwork_embroidery_karigar_filter');
    await kSel.selectOption({ index: 0 });
    await p.waitForTimeout(300);
  }

  // Filter by date
  const dateSel = p.locator('select').nth(0);
  if (await dateSel.isVisible().catch(() => false)) {
    await dateSel.selectOption({ index: 1 }).catch(() => {});
    await p.waitForTimeout(400);
    await shot(p, '05_jobwork_filter_by_date');
    await dateSel.selectOption({ index: 0 }).catch(() => {});
    await p.waitForTimeout(300);
  }

  // Embroidery: In Progress + Finished tabs
  await click(p, 'In Progress').catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '05_jobwork_emb_in_progress');
  await click(p, 'Finished').catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '05_jobwork_emb_finished');

  // ═══════════════════════════════════════════════════════
  // 6. ORDER STATUS
  // ═══════════════════════════════════════════════════════
  console.log('\n── 6. ORDER STATUS');
  await nav(p, '/order-status');
  await shot(p, '06_orderstatus_top');
  await scrollMain(p, 300);
  await p.waitForTimeout(300);
  await shot(p, '06_orderstatus_stat_cards');
  await scrollMain(p, 800);
  await p.waitForTimeout(600);
  await shot(p, '06_orderstatus_grid_header');
  await scrollMain(p, 1400);
  await p.waitForTimeout(400);
  await shot(p, '06_orderstatus_grid_rows');
  await scrollMain(p, 2400);
  await p.waitForTimeout(400);
  await shot(p, '06_orderstatus_grid_more_rows');

  // Date filter
  await scrollMain(p, 0);
  await p.waitForTimeout(300);
  const dateFrom = p.locator('input[type="date"]').first();
  if (await dateFrom.isVisible().catch(() => false)) {
    await dateFrom.fill('2026-04-01');
    await p.waitForTimeout(200);
    await click(p, 'Apply Filters');
    await p.waitForTimeout(700);
    await shot(p, '06_orderstatus_date_filtered');
    await scrollMain(p, 900);
    await p.waitForTimeout(400);
    await shot(p, '06_orderstatus_date_filtered_grid');
    await dateFrom.fill('');
    await click(p, 'Apply Filters');
    await p.waitForTimeout(500);
  }

  // Customer filter
  const custSel = p.locator('select').first();
  const custOpts = await custSel.locator('option').count().catch(() => 0);
  if (custOpts > 1) {
    await custSel.selectOption({ index: 1 });
    await click(p, 'Apply Filters');
    await p.waitForTimeout(700);
    await scrollMain(p, 900);
    await p.waitForTimeout(300);
    await shot(p, '06_orderstatus_customer_filtered');
    await custSel.selectOption({ index: 0 });
    await click(p, 'Apply Filters');
    await p.waitForTimeout(500);
  }

  // Order no filter
  const orderInput = p.locator('input[placeholder*="order"]').first();
  if (await orderInput.isVisible().catch(() => false)) {
    await orderInput.fill('810');
    await click(p, 'Apply Filters');
    await p.waitForTimeout(700);
    await scrollMain(p, 500);
    await p.waitForTimeout(300);
    await shot(p, '06_orderstatus_order_no_filter');
    await orderInput.fill('');
    await click(p, 'Apply Filters');
    await p.waitForTimeout(500);
  }

  // ═══════════════════════════════════════════════════════
  // 7. REPORTS
  // ═══════════════════════════════════════════════════════
  console.log('\n── 7. REPORTS');
  await nav(p, '/reports', 3000);
  await shot(p, '07_reports_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(400);
  await shot(p, '07_reports_summary_cards');
  await scrollMain(p, 900);
  await p.waitForTimeout(400);
  await shot(p, '07_reports_tab_bar');

  // Revenue tab
  await click(p, 'Revenue');
  await p.waitForTimeout(1000);
  await scrollMain(p, 900);
  await p.waitForTimeout(500);
  await shot(p, '07_reports_revenue_chart');
  await scrollMain(p, 1500);
  await p.waitForTimeout(400);
  await shot(p, '07_reports_revenue_chart_bottom');

  // Customers tab
  await scrollMain(p, 900);
  await p.waitForTimeout(300);
  await click(p, 'Customers');
  await p.waitForTimeout(1500);
  await shot(p, '07_reports_customers_top');
  await scrollMain(p, 1200);
  await p.waitForTimeout(400);
  await shot(p, '07_reports_customers_table');
  await scrollMain(p, 1800);
  await p.waitForTimeout(300);
  await shot(p, '07_reports_customers_table_scrolled');

  // Breakdown tab
  await scrollMain(p, 900);
  await p.waitForTimeout(300);
  await click(p, 'Breakdown');
  await p.waitForTimeout(1500);
  await shot(p, '07_reports_breakdown_top');
  await scrollMain(p, 1200);
  await p.waitForTimeout(500);
  await shot(p, '07_reports_breakdown_pie_chart');
  await scrollMain(p, 1800);
  await p.waitForTimeout(400);
  await shot(p, '07_reports_breakdown_bar_chart');

  // Period filters
  await scrollMain(p, 600);
  await p.waitForTimeout(300);
  for (const period of ['Today', 'This Week', 'This Month', 'This Year']) {
    await click(p, period);
    await p.waitForTimeout(1200);
    await shot(p, `07_reports_period_${period.toLowerCase().replace(/ /g, '_')}`);
  }

  // Export button
  await scrollMain(p, 0);
  await p.waitForTimeout(300);
  await shot(p, '07_reports_export_btn_visible');

  // ═══════════════════════════════════════════════════════
  // 8. LABOUR PAYMENTS
  // ═══════════════════════════════════════════════════════
  console.log('\n── 8. LABOUR PAYMENTS');
  await nav(p, '/labour');
  await shot(p, '08_labour_pending_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '08_labour_pending_list');
  await scrollMain(p, 0);

  // Select individual items
  const lCb = p.locator('input[type="checkbox"]').nth(1);
  if (await lCb.isVisible().catch(() => false)) {
    await lCb.click();
    await p.waitForTimeout(400);
    await shot(p, '08_labour_one_selected');
    await p.locator('input[type="checkbox"]').nth(2).click().catch(() => {});
    await p.locator('input[type="checkbox"]').nth(3).click().catch(() => {});
    await p.waitForTimeout(300);
    await shot(p, '08_labour_multi_selected');
    // Show sticky bar at bottom
    await scrollMain(p, 99999);
    await p.waitForTimeout(400);
    await shot(p, '08_labour_sticky_pay_bar');
    await scrollMain(p, 200);
    await p.waitForTimeout(300);
    await shot(p, '08_labour_pay_bar_with_items');
    // Deselect
    await lCb.click().catch(() => {});
    await p.locator('input[type="checkbox"]').nth(2).click().catch(() => {});
    await p.locator('input[type="checkbox"]').nth(3).click().catch(() => {});
    await p.waitForTimeout(300);
  }

  // Select all
  const hdrCb = p.locator('input[type="checkbox"]').first();
  await hdrCb.click().catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, '08_labour_select_all');
  await hdrCb.click().catch(() => {}); // deselect

  // Filter by type
  const typeDD = p.locator('select').first();
  await typeDD.selectOption('Embroidery').catch(async () => {
    await typeDD.selectOption({ index: 1 }).catch(() => {});
  });
  await p.waitForTimeout(500);
  await shot(p, '08_labour_filter_embroidery');
  await typeDD.selectOption({ index: 0 }).catch(() => {});
  await p.waitForTimeout(300);

  // Filter by karigar
  const labKarigar = p.locator('select').nth(1);
  const labKCount = await labKarigar.locator('option').count().catch(() => 0);
  if (labKCount > 1) {
    await labKarigar.selectOption({ index: 1 });
    await p.waitForTimeout(400);
    await shot(p, '08_labour_filter_karigar');
    await labKarigar.selectOption({ index: 0 });
    await p.waitForTimeout(300);
  }

  // Paid tab
  await click(p, 'Paid');
  await p.waitForTimeout(800);
  await shot(p, '08_labour_paid_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '08_labour_paid_list');
  // Expand a payment row
  await p.locator('tr.cursor-pointer, div.cursor-pointer').first().click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, '08_labour_paid_expanded_row');

  // ═══════════════════════════════════════════════════════
  // 9. SETTINGS
  // ═══════════════════════════════════════════════════════
  console.log('\n── 9. SETTINGS');
  await nav(p, '/settings');
  await shot(p, '09_settings_top');
  await scrollMain(p, 500);
  await p.waitForTimeout(400);
  await shot(p, '09_settings_article_types');
  await scrollMain(p, 1000);
  await p.waitForTimeout(400);
  await shot(p, '09_settings_payment_modes');
  await scrollMain(p, 1500);
  await p.waitForTimeout(400);
  await shot(p, '09_settings_addon_items');
  await scrollMain(p, 2100);
  await p.waitForTimeout(400);
  await shot(p, '09_settings_karigars');
  await scrollMain(p, 2700);
  await p.waitForTimeout(400);
  await shot(p, '09_settings_firm_details');
  await scrollMain(p, 99999);
  await p.waitForTimeout(400);
  await shot(p, '09_settings_bottom');
  await shotFull(p, '09_settings_full_page');

  // Dirty save button
  await scrollMain(p, 0);
  await p.waitForTimeout(300);
  const rateInput = p.locator('input[type="number"]').first();
  if (await rateInput.isVisible().catch(() => false)) {
    const curVal = await rateInput.inputValue();
    await rateInput.fill(String(parseInt(curVal || '500') + 1));
    await p.waitForTimeout(300);
    await shot(p, '09_settings_dirty_save_btn');
    await rateInput.fill(curVal);
    await p.waitForTimeout(200);
  }

  // ═══════════════════════════════════════════════════════
  // 10. DATA MANAGER
  // ═══════════════════════════════════════════════════════
  console.log('\n── 10. DATA MANAGER');
  await nav(p, '/data');
  await shot(p, '10_datamanager_import_tab');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '10_datamanager_import_scrolled');

  await click(p, 'Export Data');
  await p.waitForTimeout(500);
  await shot(p, '10_datamanager_export_tab');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '10_datamanager_export_scrolled');

  await click(p, 'Backup & Restore');
  await p.waitForTimeout(500);
  await shot(p, '10_datamanager_backup_tab');
  await scrollMain(p, 500);
  await p.waitForTimeout(300);
  await shot(p, '10_datamanager_backup_scrolled');

  await click(p, 'Data Audit');
  await p.waitForTimeout(700);
  await shot(p, '10_datamanager_audit_tab');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '10_datamanager_audit_results');

  // ═══════════════════════════════════════════════════════
  // 11. USERS
  // ═══════════════════════════════════════════════════════
  console.log('\n── 11. USERS');
  await nav(p, '/users');
  await shot(p, '11_users_list_top');
  // Scroll table to see action buttons
  await p.evaluate(() => {
    const tbl = document.querySelector('table');
    if (tbl) { const w = tbl.closest('[class*="overflow-x"]'); if (w) w.scrollLeft = 999; }
  });
  await p.waitForTimeout(300);
  await shot(p, '11_users_list_actions_visible');
  await p.evaluate(() => {
    const tbl = document.querySelector('table');
    if (tbl) { const w = tbl.closest('[class*="overflow-x"]'); if (w) w.scrollLeft = 0; }
  });

  // Edit user modal
  await p.locator('button[title="Edit"], button:has([data-icon="pencil-simple"])').first().click().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '11_users_edit_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Reset password modal
  await p.locator('button[title="Reset password"], button:has([data-icon="lock-key"])').first().click().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '11_users_reset_password_modal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Page permissions modal
  await p.locator('button[title="Page permissions"], button:has([data-icon="shield-check"])').first().click().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '11_users_page_permissions_modal');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '11_users_page_permissions_scrolled');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Toggle active button
  await p.locator('button[title*="ctive"], button:has([data-icon="toggle"])').nth(1).click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '11_users_toggle_active_confirm');
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(300);

  // Add User form
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.locator('button:has-text("Add User"), button:has([data-icon="user-plus"])').last().click().catch(async () => {
    await p.locator('button').filter({ hasText: 'Add User' }).last().click().catch(() => {});
  });
  await p.waitForTimeout(500);
  await shot(p, '11_users_add_form');
  const addInputs = p.locator('.fixed input, [role="dialog"] input, form input');
  const addCount  = await addInputs.count().catch(() => 0);
  if (addCount > 0) {
    await addInputs.nth(0).fill('Test User').catch(() => {});
    await addInputs.nth(1).fill('testuser99').catch(() => {});
    if (addCount > 2) await addInputs.nth(2).fill('test1234').catch(() => {});
    await p.waitForTimeout(200);
    await shot(p, '11_users_add_form_filled');
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // ═══════════════════════════════════════════════════════
  // 12. SIDEBAR — open/close/dark mode
  // ═══════════════════════════════════════════════════════
  console.log('\n── 12. SIDEBAR');
  await nav(p, '/');

  // On desktop sidebar is always visible; on tablet it may be collapsed
  const hamburger = p.locator('header button').first();
  const hambVisible = await hamburger.isVisible().catch(() => false);

  if (hambVisible) {
    await hamburger.click();
    await p.waitForTimeout(400);
    await shot(p, '12_sidebar_open');
    await p.evaluate(() => {
      const s = document.querySelector('aside[data-testid="sidebar"]');
      if (s) s.scrollTop = 200;
    });
    await p.waitForTimeout(300);
    await shot(p, '12_sidebar_scrolled');
    // Close
    await p.locator('aside button[aria-label="Close sidebar"]').first().click().catch(async () => {
      await p.locator('.fixed.inset-0').first().click().catch(() => {});
    });
    await p.waitForTimeout(400);
    await shot(p, '12_sidebar_closed');
  } else {
    // Desktop — sidebar always visible
    await shot(p, '12_sidebar_always_visible');
    await p.evaluate(() => {
      const s = document.querySelector('aside[data-testid="sidebar"], nav[class*="flex-1"]');
      if (s) s.parentElement.scrollTop = 200;
    });
    await p.waitForTimeout(300);
    await shot(p, '12_sidebar_scrolled');
  }

  // Dark mode toggle
  if (hambVisible) {
    await hamburger.click();
    await p.waitForTimeout(400);
  }
  await click(p, 'Dark').catch(() => click(p, 'Light'));
  await p.waitForTimeout(500);
  await shot(p, '12_dark_mode_active');
  if (hambVisible) {
    await p.locator('aside button[aria-label="Close sidebar"]').first().click().catch(async () => {
      await p.locator('.fixed.inset-0').first().click().catch(() => {});
    });
    await p.waitForTimeout(400);
  }
  await shot(p, '12_dark_dashboard');
  await nav(p, '/daybook');
  await shot(p, '12_dark_daybook');
  await nav(p, '/labour');
  await shot(p, '12_dark_labour');
  await nav(p, '/items');
  await shot(p, '12_dark_items');
  await nav(p, '/reports', 2000);
  await shot(p, '12_dark_reports');

  // Revert to light
  if (hambVisible) {
    await hamburger.click();
    await p.waitForTimeout(400);
  }
  await click(p, 'Light').catch(() => click(p, 'Dark'));
  await p.waitForTimeout(500);
  if (hambVisible) {
    await p.locator('aside button[aria-label="Close sidebar"]').first().click().catch(async () => {
      await p.locator('.fixed.inset-0').first().click().catch(() => {});
    });
    await p.waitForTimeout(400);
  }

  // ═══════════════════════════════════════════════════════
  // 13. AUDIT LOG
  // ═══════════════════════════════════════════════════════
  console.log('\n── 13. AUDIT LOG');
  await nav(p, '/audit');
  await shot(p, '13_auditlog_top');
  await scrollMain(p, 400);
  await p.waitForTimeout(300);
  await shot(p, '13_auditlog_entries');

  // Open filters
  await scrollMain(p, 0);
  await p.locator('button:has-text("Filters"), button:has([data-icon="funnel"])').first().click().catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, '13_auditlog_filters_open');
  // Filter by action type
  const actionSel = p.locator('select').first();
  const actionCount = await actionSel.locator('option').count().catch(() => 0);
  if (actionCount > 1) {
    await actionSel.selectOption({ index: 1 });
    await p.waitForTimeout(500);
    await shot(p, '13_auditlog_filtered_by_action');
    await actionSel.selectOption({ index: 0 });
    await p.waitForTimeout(300);
  }
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(300);
  await scrollMain(p, 600);
  await p.waitForTimeout(300);
  await shot(p, '13_auditlog_entries_scrolled');

  // ═══════════════════════════════════════════════════════
  // 14. LOGIN FLOWS
  // ═══════════════════════════════════════════════════════
  console.log('\n── 14. LOGIN');
  await p.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await nav(p, '/login', 1000);
  await shot(p, '14_login_empty');
  await p.locator('button[type="submit"]').click().catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, '14_login_validation_errors');
  await p.fill('input[placeholder*="sername"]', 'admin');
  await p.fill('input[type="password"]', 'wrongpass');
  await p.locator('button[type="submit"]').click();
  await p.waitForTimeout(1000);
  await shot(p, '14_login_wrong_password');
  await p.fill('input[type="password"]', 'admin123');
  await p.locator('button[type="submit"]').click();
  await p.waitForTimeout(1500);
  await shot(p, '14_login_success_redirect');

  // ═══════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════
  await ctx.close();
  const count = fs.readdirSync(shotOut).length;
  console.log(`\n✅ ${viewport.label.toUpperCase()} done — ${count} screenshots → ${shotOut}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function run() {
  const browser = await chromium.launch({ headless: true });
  const token   = await getToken();
  console.log('✓ Token acquired');

  for (const viewport of VIEWPORTS) {
    await auditViewport(browser, token, viewport);
  }

  await browser.close();
  console.log('\n🎉 All viewports complete.');
  console.log(`   Tablet:  ${OUT_TABLET}`);
  console.log(`   Desktop: ${OUT_DESKTOP}`);
}

run().catch(err => { console.error('❌', err); process.exit(1); });
