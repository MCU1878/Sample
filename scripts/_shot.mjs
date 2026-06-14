// 依存ゼロの簡易CDPドライバ: Edge(Chromium)をheadless起動 → アプリを開く
// → 「優勝確率を計算」をクリック → 結果をスクリーンショット。
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = 'http://localhost:5173';
const PORT = 9222;
const profile = mkdtempSync(join(tmpdir(), 'edge-cdp-'));

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1500,2600', '--force-device-scale-factor=1', APP,
], { stdio: 'ignore' });

const getJson = async (p) => (await fetch(`http://localhost:${PORT}${p}`)).json();

try {
  // devtools 起動待ち & ページターゲット取得
  let target;
  for (let i = 0; i < 50; i++) {
    try {
      const list = await getJson('/json');
      target = list.find((t) => t.type === 'page' && t.url.includes('localhost:5173'));
      if (target?.webSocketDebuggerUrl) break;
    } catch {}
    await sleep(400);
  }
  if (!target) throw new Error('page target not found');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const cmd = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await sleep(2000); // 初回コンパイル/描画待ち

  const click = await cmd('Runtime.evaluate', {
    expression: `(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('優勝確率を計算'));if(b){b.click();return 'clicked';}return 'notfound';})()`,
    returnByValue: true,
  });
  console.log('click:', click.result?.result?.value);

  await sleep(5000); // モンテカルロ(1万回)完了待ち

  const metrics = await cmd('Page.getLayoutMetrics');
  const cs = metrics.result.cssContentSize;
  const shot = await cmd('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(cs.width), height: Math.min(4000, Math.ceil(cs.height)), scale: 1 },
  });
  writeFileSync('forecast-shot.png', Buffer.from(shot.result.data, 'base64'));
  console.log('saved forecast-shot.png');

  // コンソールエラーの簡易確認
  const errs = await cmd('Runtime.evaluate', { expression: 'window.__errs__||"(none captured)"', returnByValue: true });
  console.log('page errors:', errs.result?.result?.value);

  ws.close();
} finally {
  edge.kill();
}
