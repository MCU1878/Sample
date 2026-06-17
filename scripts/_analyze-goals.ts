// モデルの得点見積もりが現実的か（W杯平均 約2.7点/試合）を検証。
import { predictProbabilities, outcomeFromProb } from '../src/utils/accuracy';
import { createInitialMatches } from '../src/data';

const fixtures = createInitialMatches().filter((m) => m.group);
let totalGoals = 0;
let maxLambda = 0;
const modalScores: Record<string, number> = {};
let highScorePred = 0; // 合計3点以上の最有力スコア

for (const m of fixtures) {
  const p = predictProbabilities(m.homeTeam, m.awayTeam);
  totalGoals += p.lambdaHome + p.lambdaAway;
  maxLambda = Math.max(maxLambda, p.lambdaHome, p.lambdaAway);
  const o = outcomeFromProb(p);
  const [i, j] = p.topScore[o];
  const key = `${i}-${j}`;
  modalScores[key] = (modalScores[key] ?? 0) + 1;
  if (i + j >= 3) highScorePred++;
}

const n = fixtures.length;
console.log(`試合数: ${n}`);
console.log(`平均 期待合計得点: ${(totalGoals / n).toFixed(2)} 点/試合  (W杯実績の目安 ≈ 2.7)`);
console.log(`最大の片側 期待得点(λ): ${maxLambda.toFixed(2)}`);
console.log(`最有力スコアが合計3点以上だった試合: ${highScorePred} / ${n}`);
console.log('最有力スコアの分布:');
for (const [k, v] of Object.entries(modalScores).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${k} : ${v}試合`);
}
