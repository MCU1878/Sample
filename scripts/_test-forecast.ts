// 予測エンジン（Phase 2a）の検証。
import { createInitialMatches, teams, groupTeams } from '../src/data';
import { runForecast, mulberry32 } from '../src/utils/forecast';
import type { Match } from '../src/types';

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failures++; }
};
const sum = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + v, 0);
const ALL = Object.values(groupTeams).flat();

const N = 3000;

console.log('F-1) 確率の整合性（合計・範囲）');
{
  const f = runForecast(createInitialMatches(), { iterations: N, rng: mulberry32(42) });
  ok(Object.values(f.champion).every((p) => p >= 0 && p <= 1), '全確率が [0,1]');
  ok(Math.abs(sum(f.champion) - 1) < 0.02, `優勝確率の合計≈1（実際 ${sum(f.champion).toFixed(3)}）`);
  ok(Math.abs(sum(f.final) - 2) < 0.05, `決勝進出の合計≈2（実際 ${sum(f.final).toFixed(2)}）`);
  ok(Math.abs(sum(f.semifinal) - 4) < 0.1, `ベスト4の合計≈4（実際 ${sum(f.semifinal).toFixed(2)}）`);
  ok(Math.abs(sum(f.quarterfinal) - 8) < 0.1, `ベスト8の合計≈8（実際 ${sum(f.quarterfinal).toFixed(2)}）`);
  ok(Math.abs(sum(f.roundOf16) - 16) < 0.1, `ベスト16の合計≈16（実際 ${sum(f.roundOf16).toFixed(2)}）`);
  ok(Math.abs(sum(f.roundOf32) - 32) < 0.1, `R32進出の合計≈32（実際 ${sum(f.roundOf32).toFixed(2)}）`);
}

console.log('F-2) 単調性: 各チームで champion ≤ final ≤ … ≤ R32');
{
  const f = runForecast(createInitialMatches(), { iterations: N, rng: mulberry32(7) });
  let mono = true;
  for (const t of ALL) {
    if (!(f.champion[t] <= f.final[t] + 1e-9 && f.final[t] <= f.semifinal[t] + 1e-9 &&
          f.semifinal[t] <= f.quarterfinal[t] + 1e-9 && f.quarterfinal[t] <= f.roundOf16[t] + 1e-9 &&
          f.roundOf16[t] <= f.roundOf32[t] + 1e-9)) { mono = false; break; }
  }
  ok(mono, '全チームで到達確率が後段ほど小さい（ラウンド単調性）');
}

console.log('F-3) 妥当性: 強豪の優勝確率 > 弱小');
{
  const f = runForecast(createInitialMatches(), { iterations: N, rng: mulberry32(123) });
  // FIFAランク上位（優勝候補）と下位（最弱級）を比較
  const strong = ['FRA', 'ESP', 'ARG', 'ENG']; // rank 1〜4
  const weak = ['NZL', 'HAI', 'CUW', 'CPV'];    // rank 85,83,82,69
  const avgStrong = strong.reduce((s, t) => s + f.champion[t], 0) / strong.length;
  const avgWeak = weak.reduce((s, t) => s + f.champion[t], 0) / weak.length;
  ok(avgStrong > avgWeak * 3, `強豪の平均優勝率(${(avgStrong * 100).toFixed(1)}%) >> 弱小(${(avgWeak * 100).toFixed(2)}%)`);
  ok(f.roundOf32['FRA'] > f.roundOf32['NZL'], `フランスのR32進出率(${(f.roundOf32['FRA'] * 100).toFixed(0)}%) > NZ(${(f.roundOf32['NZL'] * 100).toFixed(0)}%)`);
}

console.log('F-4) 固定結果の反映: 強豪をグループ全敗させると進出率が激減');
{
  // ブラジル(C組,rank6)をグループ3試合すべて 0-3 で敗北させる
  const matches: Match[] = createInitialMatches();
  const braMatches = matches.filter((m) => m.group === 'C' && (m.homeTeam === 'BRA' || m.awayTeam === 'BRA'));
  for (const m of braMatches) {
    if (m.homeTeam === 'BRA') { m.homeScore = 0; m.awayScore = 3; }
    else { m.homeScore = 3; m.awayScore = 0; }
  }
  const baseline = runForecast(createInitialMatches(), { iterations: N, rng: mulberry32(99) });
  const f = runForecast(matches, { iterations: N, rng: mulberry32(99) });
  ok(f.roundOf32['BRA'] < 0.15, `全敗ブラジルのR32進出率が激減（${(baseline.roundOf32['BRA'] * 100).toFixed(0)}% → ${(f.roundOf32['BRA'] * 100).toFixed(0)}%）`);
  ok(f.champion['BRA'] < baseline.champion['BRA'], 'ブラジルの優勝確率も低下');
}

console.log('');
console.log(`(参考) 初期状態の優勝確率トップ5:`);
{
  const f = runForecast(createInitialMatches(), { iterations: N, rng: mulberry32(2026) });
  const top = ALL.map((t) => [t, f.champion[t]] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [t, p] of top) console.log(`   ${teams[t].name}: ${(p * 100).toFixed(1)}%`);
}

console.log('');
if (failures === 0) console.log('✅ 予測エンジン検証 全項目 PASS');
else { console.error(`❌ 予測エンジン検証 ${failures} 件 FAIL`); process.exit(1); }
