/* Clicks through the real UI in Chromium and screenshots every screen into scripts/.ui-shots/.
   Needs: the backend stack and `npm run dev` (FE_URL, default http://localhost:3000).
   Browser: CHROME_PATH, else the newest Playwright Chromium in %LOCALAPPDATA%/ms-playwright, else installed Chrome.
   Reports uncaught page errors, console errors and /api responses >= 400 (the wrong-password login is expected).
   The learner/admin accounts it creates are deleted at the end. Run: npm run ui-check */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { adminCall, purgeUsers } from './devtools';

const BASE = process.env.FE_URL || 'http://localhost:3000';
const OUT = path.resolve(process.cwd(), 'scripts/.ui-shots');
const PW = 'secret12';
const sfx = Date.now().toString(36).slice(-5);

function chromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const pw = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(pw)) {
    const dirs = fs.readdirSync(pw).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      const exe = path.join(pw, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  for (const exe of ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) {
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('No Chromium found: set CHROME_PATH');
}

const issues: string[] = [];
function watch(page: Page, who: string) {
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('INFO:')) issues.push(`[${who}] console: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', e => issues.push(`[${who}] PAGE ERROR: ${e.message.slice(0, 200)}`));
  page.on('response', r => {
    if (r.url().includes('/api/') && r.status() >= 400) issues.push(`[${who}] ${r.request().method()} ${r.url().replace(BASE, '')} -> ${r.status()}`);
  });
}

async function shot(page: Page, name: string, wait = 1500) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('  shot', name);
}

async function login(page: Page, username: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[aria-label="Tên đăng nhập hoặc email"]', username);
  await page.fill('input[aria-label="Mật khẩu"]', PW);
  await page.click('button[type=submit]');
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
}

const created: number[] = [];

async function run() {
  await fetch(BASE).catch(() => { throw new Error(`FE not reachable at ${BASE} — start it with npm run dev`); });
  fs.mkdirSync(OUT, { recursive: true });
  const learner = `ui_hocvien_${sfx}`, admin = `ui_quantri_${sfx}`;
  for (const [username, fullName, role] of [[learner, 'Học Viên Thử', 'USER'], [admin, 'Quản Trị Thử', 'ADMIN']]) {
    const u = await adminCall<{ id: number }>('POST', '/api/users/admin', { username, email: `${username}@test.local`, password: PW, fullName, role });
    created.push(u.id);
  }

  const browser = await chromium.launch({
    executablePath: chromePath(),
    // Chrome's fake camera lets the Studio record and score a clip (a test pattern, so the score is low).
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  try {
    console.log('— guest');
    const g = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    watch(g, 'guest');
    await g.goto(`${BASE}/`); await shot(g, '01-landing', 3500);
    await g.goto(`${BASE}/register`); await shot(g, '02-register');
    await g.goto(`${BASE}/login`);
    await g.fill('input[aria-label="Tên đăng nhập hoặc email"]', learner);
    await g.fill('input[aria-label="Mật khẩu"]', 'sai-mat-khau');
    await g.click('button[type=submit]');
    await shot(g, '03-login-wrong-password');
    await g.close();

    console.log('— learner');
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['camera'] });
    const p = await ctx.newPage();
    watch(p, 'learner');
    await login(p, learner);
    await shot(p, '10-today');
    await p.reload(); await shot(p, '11-today-after-reload');
    await p.goto(`${BASE}/learn`); await shot(p, '12-journey');
    const lesson = p.locator('a[href^="/lesson/"]').first();
    if (await lesson.count()) { await lesson.click(); await shot(p, '13-lesson'); }
    await p.goto(`${BASE}/dictionary`); await shot(p, '14-dictionary');
    await p.locator('.drow-head').first().click(); await shot(p, '15-dictionary-open', 2500);
    await p.goto(`${BASE}/request`); await shot(p, '16-request');
    await p.goto(`${BASE}/community`); await shot(p, '17-community');
    const post = p.locator('button.post, button.feature-post').first();
    if (await post.count()) { await post.click(); await shot(p, '18-post-modal', 2000); await p.keyboard.press('Escape'); }
    await p.goto(`${BASE}/community/mine`); await shot(p, '19-my-posts');
    await p.goto(`${BASE}/profile`); await shot(p, '20-profile');
    await p.click('text=Dùng ảnh từ đường dẫn');
    await p.fill('#av-url', 'https://i.pravatar.cc/150?img=12');
    await shot(p, '21-avatar-url', 2500);
    await p.click('form button.btn:has-text("Lưu")');
    await shot(p, '22-profile-avatar-set');
    await p.goto(`${BASE}/people/${created[1]}`); await shot(p, '23-people');
    await p.keyboard.press('Control+k'); await p.keyboard.type('phòng'); await shot(p, '24-palette', 500);
    await p.keyboard.press('Escape');
    await p.goto(`${BASE}/today`); await p.click('.mentor-btn'); await shot(p, '25-mentor', 2000);
    await p.keyboard.press('Escape');
    await p.goto(`${BASE}/studio`); await shot(p, '26-studio', 4000);
    const start = p.locator('button:has-text("Bắt đầu lượt tập")');
    if (await start.isEnabled().catch(() => false)) {
      await start.click();
      await p.waitForSelector('.dial, .coachnote', { timeout: 150000 }).catch(() => { issues.push('[learner] studio: no result within 150s'); });
      await shot(p, '27-studio-result', 6000);
    } else issues.push('[learner] studio: start button disabled (no camera?)');
    const m = await ctx.newPage(); watch(m, 'mobile');
    await m.setViewportSize({ width: 390, height: 844 });
    await m.goto(`${BASE}/today`); await shot(m, '28-mobile-today');
    await m.goto(`${BASE}/community`); await shot(m, '29-mobile-community');
    await ctx.close();

    console.log('— admin');
    const actx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const a = await actx.newPage();
    watch(a, 'admin');
    await login(a, admin);
    await shot(a, '40-admin-overview', 2000);
    for (const [n, route] of [['41', 'categories'], ['42', 'signs'], ['43', 'users'], ['44', 'posts'], ['45', 'reports'], ['46', 'requests']]) {
      await a.goto(`${BASE}/admin/${route}`); await shot(a, `${n}-admin-${route}`);
    }
    await a.goto(`${BASE}/admin/signs`);
    await a.locator('button[aria-label^="Sửa"]').first().click(); await shot(a, '47-admin-sign-form', 800);
    await actx.close();
  } finally {
    await browser.close();
  }
}

try {
  await run();
} catch (e) {
  issues.push(`SCRIPT ERROR: ${(e as Error).message}`);
} finally {
  if (process.env.KEEP_DATA !== '1') {
    for (const id of created) await adminCall('DELETE', `/api/users/admin/${id}`).catch(() => {});
    purgeUsers(created);
  }
}
// The deliberate wrong-password login is the only expected failure.
const real = issues.filter(i => !i.includes('/api/auth/login -> 401') && !i.includes('status of 401'));
console.log(`\nScreenshots: ${OUT}`);
console.log(`${real.length} issue(s)`);
real.forEach(i => console.log('  ' + i));
if (real.length) process.exit(1);
