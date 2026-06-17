// 勝ち点状況による戦い方（situationalPlay）の検証。
import { computeGroupTable, situationalIntent, applyIntent, type GroupRow } from '../src/utils/situationalPlay';
import type { Match } from '../src/types';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}`, extra ?? ''); }
}

const row = (code: string, points: number, gd = 0): GroupRow => ({ code, points, gd, played: 2 });

console.log('A) 第1節は状況情報なし → 中立');
{
  const t = [row('A', 0), row('B', 0), row('C', 0), row('D', 0)];
  const i = situationalIntent('A', t, 1);
  check('attackMul=1, concedeMul=1', i.attackMul === 1 && i.concedeMul === 1, i);
}

console.log('B) 第3節: 突破ほぼ確定の首位 → 攻撃を緩める（主力温存）');
{
  const t = [row('A', 6), row('B', 3), row('C', 1), row('D', 1)];
  const i = situationalIntent('A', t, 3); // cushion = 6-1 = 5 >= 4
  check('attackMul < 1（温存）', i.attackMul < 1, i);
  check('concedeMul > 1（やや緩む）', i.concedeMul > 1, i);
}

console.log('C) 第3節: 突破に勝ち点が必要なボーダー外 → 前掛かり');
{
  const t = [row('A', 6), row('B', 3), row('C', 1), row('D', 1)];
  const i = situationalIntent('C', t, 3); // 3位, maxReach=4 >= p2(3) → 生存・前掛かり
  check('attackMul > 1（前掛かり）', i.attackMul > 1, i);
  check('concedeMul > 1（リスク増）', i.concedeMul > 1, i);
}

console.log('D) 第3節: 突破圏だが安泰でない2位 → 堅守');
{
  const t = [row('A', 6), row('B', 4), row('C', 3), row('D', 0)];
  const i = situationalIntent('B', t, 3); // 2位, cushion=4-3=1<4 → 守る
  check('attackMul < 1', i.attackMul < 1, i);
  check('concedeMul < 1（失点しにくい）', i.concedeMul < 1, i);
}

console.log('E) 第3節: 敗退濃厚（勝ってもボーダー不可）→ モチベ低下');
{
  const t = [row('A', 6), row('B', 6), row('C', 0), row('D', 0)];
  const i = situationalIntent('C', t, 3); // maxReach=0+3=3 < p2=6 → 敗退濃厚
  check('attackMul < 1（モチベ低下）', i.attackMul < 1, i);
}

console.log('F) applyIntent: 前掛かり同士なら両者の期待得点が増える');
{
  const attacking = { attackMul: 1.15, concedeMul: 1.10 };
  const [lh, la] = applyIntent(1.5, 1.2, attacking, attacking);
  check('ホーム λ 増加', lh > 1.5, lh);
  check('アウェイ λ 増加', la > 1.2, la);
}

console.log('G) computeGroupTable: 勝ち点・得失点を正しく集計');
{
  const mk = (h: string, a: string, hs: number, as: number, md = 1): Match => ({
    id: `${h}-${a}`, group: 'A', homeTeam: h, awayTeam: a, homeScore: hs, awayScore: as,
    date: '2026-06-12', time: '00:00', matchDay: md,
  });
  const matches: Match[] = [mk('A', 'B', 2, 0), mk('C', 'D', 1, 1)];
  const t = computeGroupTable(matches, 'A', ['A', 'B', 'C', 'D']);
  const byCode = Object.fromEntries(t.map((r) => [r.code, r]));
  check('A: 3点, GD+2', byCode.A.points === 3 && byCode.A.gd === 2, byCode.A);
  check('B: 0点, GD-2', byCode.B.points === 0 && byCode.B.gd === -2, byCode.B);
  check('C/D: 各1点（引分）', byCode.C.points === 1 && byCode.D.points === 1);
}

console.log('');
if (failures === 0) console.log('✅ 全テスト合格');
else { console.log(`❌ ${failures} 件失敗`); process.exit(1); }
