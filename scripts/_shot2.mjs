// 優勝確率パネルだけを拡大キャプチャ。
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9223;
const profile = mkdtempSync(join(tmpdir(), 'edge-cdp2-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, '--window-size=1200,1600', '--force-device-scale-factor=2', 'http://localhost:5173'], { stdio: 'ignore' });
const getJson = async (p) => (await fetch(`http://localhost:${PORT}${p}`)).json();
try {
  let target;
  for (let i = 0; i < 50; i++) { try { const l = await getJson('/json'); target = l.find((t) => t.type === 'page' && t.url.includes('5173')); if (target?.webSocketDebuggerUrl) break; } catch {} await sleep(400); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const cmd = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await sleep(2000);
  await cmd('Runtime.evaluate', { expression: `[...document.querySelectorAll('button')].find(x=>x.textContent.includes('優勝確率を計算')).click()`, returnByValue: true });
  await sleep(5000);
  const rect = await cmd('Runtime.evaluate', {
    expression: `(()=>{const h=[...document.querySelectorAll('.card__title')].find(x=>x.textContent.includes('優勝確率シミュレーション'));const c=h.closest('.card');const r=c.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});})()`,
    returnByValue: true,
  });
  const r = JSON.parse(rect.result.result.value);
  const shot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 2 } });
  writeFileSync('forecast-panel.png', Buffer.from(shot.result.data, 'base64'));
  console.log('saved forecast-panel.png');
  ws.close();
} finally { edge.kill(); }
