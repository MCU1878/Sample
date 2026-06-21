// 予測力の指標（Brier・BSS・較正・推移）の検証。
import { brierScore, uniformBrier, brierSkillScore, reliabilityBins, cumulativeAccuracy } from '../src/utils/skillMetrics';
import type { MatchAccuracy, Outcome } from '../src/utils/accuracy';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`); else { failures++; console.log(`  ✗ ${name}`, extra ?? ''); }
}

function md(actual: Outcome, pH: number, pD: number, pA: number): MatchAccuracy {
  const conf = Math.max(pH, pD, pA);
  const pred: Outcome = pH >= pD && pH >= pA ? 'HOME' : pA >= pD && pA >= pH ? 'AWAY' : 'DRAW';
  return {
    matchId: 'x', date: '2026-06-12', homeTeam: 'A', awayTeam: 'B', homeScore: 1, awayScore: 0,
    predicted: pred, actual, hit: pred === actual, predictedScore: [1, 0], exactHit: false,
    confidence: conf, pHome: pH, pDraw: pD, pAway: pA,
  };
}

console.log('A) Brier: 完璧予測=0 / 真逆=2 / ランダム≈0.667');
{
  const perfect = [md('HOME', 1, 0, 0), md('AWAY', 0, 0, 1)];
  check('完璧予測の Brier ≈ 0', Math.abs(brierScore(perfect)) < 1e-9, brierScore(perfect));
  const worst = [md('HOME', 0, 0, 1)]; // 実際HOMEなのにAWAYに全確率
  check('真逆の Brier = 2', Math.abs(brierScore(worst) - 2) < 1e-9, brierScore(worst));
  const unif = [md('HOME', 1 / 3, 1 / 3, 1 / 3)];
  check('ランダムの Brier ≈ 0.667', Math.abs(brierScore(unif) - uniformBrier()) < 1e-9, brierScore(unif));
}

console.log('B) BSS: 良い予測は正、ランダムは0');
{
  const good = [md('HOME', 0.7, 0.2, 0.1), md('AWAY', 0.1, 0.2, 0.7), md('DRAW', 0.25, 0.5, 0.25)];
  check('良い予測の BSS > 0', brierSkillScore(good) > 0, brierSkillScore(good));
  const unif = [md('HOME', 1 / 3, 1 / 3, 1 / 3), md('AWAY', 1 / 3, 1 / 3, 1 / 3)];
  check('ランダムの BSS ≈ 0', Math.abs(brierSkillScore(unif)) < 1e-9, brierSkillScore(unif));
}

console.log('C) 較正ビン: 件数・的中率');
{
  // 確信度 0.7 のHOME予測を3つ（2的中1外し）→ 0.65-0.8 ビンに3件, hitRate=2/3
  const d = [md('HOME', 0.7, 0.2, 0.1), md('HOME', 0.7, 0.2, 0.1), md('AWAY', 0.7, 0.2, 0.1)];
  const bins = reliabilityBins(d);
  const b = bins.find((x) => 0.65 >= x.lo && 0.65 < x.hi)!;
  check('該当ビンに3件', b.count === 3, b);
  check('的中率 2/3', Math.abs(b.hitRate - 2 / 3) < 1e-9, b.hitRate);
}

console.log('D) 累積的中率: 件数と単調な分母');
{
  const d = [md('HOME', 0.7, 0.2, 0.1), md('AWAY', 0.7, 0.2, 0.1), md('HOME', 0.7, 0.2, 0.1)];
  const c = cumulativeAccuracy(d);
  check('点数=試合数', c.length === 3, c.length);
  check('1試合目 100%', c[0].rate === 1);
  check('2試合目 50%', c[1].rate === 0.5);
  check('3試合目 2/3', Math.abs(c[2].rate - 2 / 3) < 1e-9);
}

console.log('');
if (failures === 0) console.log('✅ 全テスト合格');
else { console.log(`❌ ${failures} 件失敗`); process.exit(1); }
