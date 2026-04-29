import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';

const BASE = 'http://localhost:3000';
const OUT = 'D:/Retail Code/Retail/audit_screenshots';

// Mobile viewport: iPhone 14 Pro
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
// Tablet viewport
const TABLET = { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
// Desktop
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false };

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${name}`);
}

// Get JWT token from backend directly via Node HTTPS (bypassing browser cert check)
async function getToken() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = https.request({
      hostname: 'localhost', port: 8001, path: '/api/auth/login',
      method: 'POST', rejectUnauthorized: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).access_token); } catch { reject(new Error('Bad response: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function login(page) {
  const token = await getToken();
  console.log(`  ✓ Got token: ${token.substring(0, 30)}...`);

  // Log ALL network requests to diagnose
  page.on('request', req => {
    if (req.url().includes('8001') || req.url().includes('/api/')) {
      console.log(`    → REQ: ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', resp => {
    if (resp.url().includes('8001') || resp.url().includes('/api/')) {
      console.log(`    ← RES: ${resp.status()} ${resp.url()}`);
    }
  });
  page.on('requestfailed', req => {
    console.log(`    ✗ FAIL: ${req.url()} — ${req.failure()?.errorText}`);
  });

  // Navigate to login page first (establishes the origin for sessionStorage)
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(800);
  // Inject token AND navigate in same evaluate call so storage persists
  await page.evaluate(t => {
    sessionStorage.setItem('token', t);
    window.history.pushState({}, '', '/');
  }, token);
  // Now reload the page so React reads the token from sessionStorage
  await page.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const url = page.url();
  console.log(`  ✓ Post-login URL: ${url}`);
}

// Proxy all backend API calls (http://localhost:8001/**) to actual https backend
async function setupBackendProxy(page) {
  await page.route('http://localhost:8001/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postDataBuffer();
    const headers = req.headers();
    // Remove headers that conflict
    delete headers['host'];
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost', port: 8001,
        path: url.pathname + url.search,
        method: req.method(),
        headers,
        rejectUnauthorized: false,
      };
      const proxyReq = https.request(options, proxyRes => {
        const chunks = [];
        proxyRes.on('data', c => chunks.push(c));
        proxyRes.on('end', () => {
          const respBody = Buffer.concat(chunks);
          const respHeaders = {};
          for (const [k, v] of Object.entries(proxyRes.headers)) {
            if (k.toLowerCase() !== 'transfer-encoding') respHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
          }
          route.fulfill({ status: proxyRes.statusCode, headers: respHeaders, body: respBody }).then(resolve).catch(resolve);
        });
        proxyRes.on('error', () => route.abort().then(resolve).catch(resolve));
      });
      proxyReq.on('error', () => route.abort().then(resolve).catch(resolve));
      if (body) proxyReq.write(body);
      proxyReq.end();
    });
  });
}

async function auditPage(page, name, url, actions) {
  console.log(`\n🔍 Auditing: ${name}`);
  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, `${name}_initial`);
  if (actions) await actions(page);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // ── MOBILE AUDIT ──────────────────────────────────────────────
  console.log('\n═══════════ MOBILE (390×844) ═══════════');
  const mCtx = await browser.newContext({ viewport: MOBILE, ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const mp = await mCtx.newPage();
  await setupBackendProxy(mp);
  await login(mp);
  await shot(mp, 'mobile_00_login');

  // Dashboard — verify sidebar is CLOSED by default
  await auditPage(mp, 'verify_01_dashboard', '/', async p => {
    await p.waitForTimeout(500);
    await shot(p, 'verify_01_dashboard_scrolled');
  });

  // New Bill — verify suggestions NOT open on load
  await auditPage(mp, 'verify_02_newbill', '/new-bill', async p => {
    await p.waitForTimeout(800);
    await shot(p, 'verify_02_newbill_no_suggestions');
    // Now type something to see suggestions appear
    await p.fill('[data-testid="customer-name-input"]', 'Raj');
    await p.waitForTimeout(400);
    await shot(p, 'verify_02_newbill_typed_suggestions');
  });

  // Settings — verify Save button doesn't wrap
  await auditPage(mp, 'verify_03_settings', '/settings', async p => {
    await p.waitForTimeout(500);
    await shot(p, 'verify_03_settings_header');
  });

  // Labour Payments — verify sticky pay bar
  await auditPage(mp, 'verify_04_labour', '/labour', async p => {
    await p.waitForTimeout(800);
    // Select first item by clicking its checkbox
    const firstCb = p.locator('input[type="checkbox"]').nth(1);
    if (await firstCb.isVisible().catch(() => false)) {
      await firstCb.click();
      await p.waitForTimeout(400);
      await shot(p, 'verify_04_labour_sticky_bar');
    } else {
      await shot(p, 'verify_04_labour_no_items');
    }
  });

  // Order Status — scroll to show cards
  await auditPage(mp, 'verify_05_orderstatus', '/order-status', async p => {
    await p.evaluate(() => window.scrollTo(0, 700));
    await p.waitForTimeout(500);
    await shot(p, 'verify_05_orderstatus_cards');
  });

  await mCtx.close();

  // ── DESKTOP AUDIT (for comparison) ────────────────────────────
  console.log('\n═══════════ DESKTOP (1440×900) ═══════════');
  const dCtx = await browser.newContext({ viewport: DESKTOP, ignoreHTTPSErrors: true });
  const dp = await dCtx.newPage();
  await setupBackendProxy(dp);
  await login(dp);

  for (const [name, url] of [
    ['desktop_01_dashboard', '/'],
    ['desktop_02_newbill', '/new-bill'],
    ['desktop_03_daybook', '/daybook'],
    ['desktop_04_items', '/items'],
    ['desktop_05_reports', '/reports'],
    ['desktop_06_jobwork', '/jobwork'],
  ]) {
    await dp.goto(BASE + url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await dp.waitForTimeout(1000);
    await shot(dp, name);
  }

  await dCtx.close();
  await browser.close();

  console.log(`\n✅ All screenshots saved to: ${OUT}`);
  console.log(`Total files: ${fs.readdirSync(OUT).length}`);
}

run().catch(e => { console.error('AUDIT FAILED:', e.message); process.exit(1); });
