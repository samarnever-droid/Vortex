import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import projectsHandler from '../api/projects.js';
import assetsHandler from '../api/assets.js';

const root = path.resolve('dist');
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      req.query = Object.fromEntries(url.searchParams);
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
      return await (url.pathname === '/api/projects' ? projectsHandler : assetsHandler)(req, res);
    }
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    const ext = path.extname(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[ext] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch (error) { res.statusCode = 500; res.end(error.message); }
});
await new Promise(resolve => server.listen(4177, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
  await page.goto('http://127.0.0.1:4177');
  await page.locator('.webgl-viewport canvas').waitFor({ timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'screenshots/editor-desktop.png', fullPage: true });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'screenshots/editor-desktop-later.png', fullPage: true });
  console.log('Initial:', await page.locator('.global-status').innerText());
  console.log('Scene objects:', await page.locator('.tree-item').count());
  console.log('Canvas:', await page.locator('canvas').evaluate(c => ({ width: c.width, height: c.height })));
  await page.locator('.asset-grid .asset-card').filter({ hasText: 'Stone Block' }).click();
  await page.waitForFunction(() => document.querySelector('.save-indicator')?.textContent === 'All changes saved', { timeout: 30000 });
  console.log('Added Stone Block; objects:', await page.locator('.tree-item').count());
  await page.getByRole('spinbutton', { name: 'position X', exact: true }).fill('8.5');
  await page.getByRole('spinbutton', { name: 'position X', exact: true }).press('Enter');
  await page.waitForTimeout(1500);
  await page.reload();
  await page.locator('.webgl-viewport canvas').waitFor({ timeout: 60000 });
  await page.locator('.tree-object').filter({ hasText: 'Stone Block' }).click();
  console.log('Persisted X:', await page.getByRole('spinbutton', { name: 'position X', exact: true }).inputValue());
  await page.getByRole('button', { name: 'Play F5', exact: true }).click();
  await page.waitForTimeout(1000);
  console.log('Play mode:', await page.locator('.play-instructions').isVisible());
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Editor settings', exact: true }).click();
  await page.locator('.settings-form select').selectOption('Performance');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.waitForTimeout(1300);
  console.log('Quality:', await page.locator('.stats-quality').innerText());
  await page.screenshot({ path: 'screenshots/editor-performance.png', fullPage: true });
  await page.locator('.tree-object').filter({ hasText: 'Stone Block' }).click();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(1500);
  console.log('Deleted; objects:', await page.locator('.tree-item').count());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'screenshots/editor-mobile.png', fullPage: true });
  console.log('Mobile overflow:', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await page.getByRole('button', { name: 'Scene hierarchy', exact: true }).click();
  console.log('Mobile hierarchy visible:', await page.locator('.scene-panel').isVisible());
  console.log('Errors:', JSON.stringify(errors));
} finally { await browser.close(); server.close(); }
