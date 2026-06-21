// 終了済み試合がロック（予想不可・🔒表示）されることを検証＋スクショ。
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9239;
const profile = mkdtempSync(join(tmpdir(), 'edge-lock-'));
const g = (h, a, hs, as) => ({ home_team_name_en: h, away_team_name_en: a, home_score: String(hs), away_score: String(as), home_scorers: null, away_scorers: null, finished: 'TRUE', time_elapsed: 'finished' });
const MOCK = { games: [ g('Mexico', 'South Africa', 2, 0), g('South Korea', 'Czech Republic', 2, 1) ] };
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1200,2000', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
const getJson = async (p) => (await fetch(`http://localhost:${PORT}${p}`)).json();
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
try {
  let target;
  for (let i = 0; i < 50; i++) { try { const l = await getJson('/json'); target = l.find((t) => t.type === 'page'); if (target?.webSocketDebuggerUrl) break; } catch {} await sleep(400); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === 'Fetch.requestPaused') { const { requestId, request } = m.params;
      if (request.url.includes('worldcup26.ir')) cmd('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: b64(JSON.stringify(MOCK)) });
      else cmd('Fetch.continueRequest', { requestId }); } };
  const cmd = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Fetch.enable', { patterns: [{ urlPattern: '*worldcup26.ir*' }] });
  await cmd('Page.navigate', { url: 'http://localhost:5173' });
  for (let i = 0; i < 40; i++) { const ov = await cmd('Runtime.evaluate', { expression: `!!document.querySelector('.sync-overlay')`, returnByValue: true }); if (ov.result?.result?.value === false) break; await sleep(500); }
  await sleep(800);
  await cmd('Runtime.evaluate', { expression: `[...document.querySelectorAll('.phase-tab')].find(x=>x.textContent.includes('予想チャレンジ')).click()` });
  await sleep(700);
  // 終了済み行（.mp-score を持つ）のセグメントを click → 予想は入らないはず
  const before = await cmd('Runtime.evaluate', { expression: `localStorage.getItem('wc2026-my-match-picks')||'{}'`, returnByValue: true });
  await cmd('Runtime.evaluate', { expression: `(()=>{const fr=[...document.querySelectorAll('.mp-row')].filter(r=>r.querySelector('.mp-score'));fr.slice(0,2).forEach(r=>{const b=r.querySelector('.mp-seg__btn');b.click();});})()` });
  await sleep(300);
  const after = await cmd('Runtime.evaluate', { expression: `JSON.stringify({picks:localStorage.getItem('wc2026-my-match-picks')||'{}',disabled:[...document.querySelectorAll('.mp-row')].filter(r=>r.querySelector('.mp-score')).slice(0,2).map(r=>r.querySelector('.mp-seg__btn').disabled),locks:document.querySelectorAll('.mp-locked').length})`, returnByValue: true });
  console.log('before picks:', before.result.result.value);
  console.log('after click (finished rows):', after.result.result.value);
  // 未消化行（.mp-date を持つ）は選べることも確認
  await cmd('Runtime.evaluate', { expression: `(()=>{const ur=[...document.querySelectorAll('.mp-row')].find(r=>r.querySelector('.mp-date'));ur?.querySelector('.mp-seg__btn').click();})()` });
  await sleep(300);
  const fut = await cmd('Runtime.evaluate', { expression: `localStorage.getItem('wc2026-my-match-picks')||'{}'`, returnByValue: true });
  console.log('after picking a future match:', fut.result.result.value);
  const r = await cmd('Runtime.evaluate', { expression: `(()=>{const e=document.querySelector('.mp-group');const b=e.getBoundingClientRect();return JSON.stringify({x:b.x,y:b.y+window.scrollY,w:b.width,h:b.height});})()`, returnByValue: true });
  const rect = JSON.parse(r.result.result.value);
  const shot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, rect.x - 10), y: Math.max(0, rect.y - 10), width: Math.ceil(rect.w + 20), height: Math.min(500, Math.ceil(rect.h + 20)), scale: 2 } });
  writeFileSync('lock-shot.png', Buffer.from(shot.result.data, 'base64'));
  console.log('saved lock-shot.png');
  ws.close();
} finally { edge.kill(); }
