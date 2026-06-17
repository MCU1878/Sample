// 引き分け予測ルールの比較バックテスト。
// 3つの決定ルール（①強い方=argmax / ②固定0.29 / ③自己較正）を、
// 2つの「現実」（モデル通り / 番狂わせ・引き分け多めの現実）で walk-forward 評価する。
import { predictProbabilities, outcomeFromProb, actualOutcome, calibrateDrawThreshold, type Outcome, type DrawHistEntry } from '../src/utils/accuracy';
import { initRatings, updateRatings, expectedLambdas } from '../src/utils/ratingModel';
import { createInitialMatches, groupTeams } from '../src/data';
import { mulberry32 } from '../src/utils/rng';

type Rng = () => number;
function poisson(lambda: number, rng: Rng): number {
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L); return k - 1;
}

const fixtures = createInitialMatches().filter((m) => m.group);

// 「真の」スコアを生成する。compress=0:モデル通り / >0:実力差を圧縮（番狂わせ多）+ drawBoost:引き分け増
function genActuals(compress: number, drawBoost: number, seed: number) {
  const rng = mulberry32(seed);
  const trueRatings = initRatings(); // 真の強さもアンサンブル由来（ただし圧縮して使う）
  return fixtures.map((m) => {
    let { lambdaHome, lambdaAway } = expectedLambdas(m.homeTeam, m.awayTeam, trueRatings);
    // 実力差を平均(1.35)へ圧縮（過信の現実を再現）
    const mean = 1.35;
    lambdaHome = mean + (lambdaHome - mean) * (1 - compress);
    lambdaAway = mean + (lambdaAway - mean) * (1 - compress);
    let gh = poisson(lambdaHome, rng);
    let ga = poisson(lambdaAway, rng);
    // drawBoost の確率で、僅差を引き分けに寄せる
    if (Math.abs(gh - ga) === 1 && rng() < drawBoost) { gh = ga = Math.min(gh, ga); }
    return { ...m, homeScore: gh, awayScore: ga };
  });
}

function backtest(actuals: typeof fixtures, rule: 'argmax' | 'fixed' | 'calib' | 'shrink'): number {
  let ratings = initRatings();
  const hist: DrawHistEntry[] = [];
  let hits = 0, total = 0;
  for (const m of actuals) {
    const prob = predictProbabilities(m.homeTeam, m.awayTeam, ratings);
    let pred: Outcome;
    if (rule === 'shrink') {
      // 過去の実測勝/分/負率へ縮小（過信を補正）してから最尤
      const n = hist.length;
      if (n >= 5) {
        const cH = hist.filter((h) => h.actual === 'HOME').length / n;
        const cD = hist.filter((h) => h.actual === 'DRAW').length / n;
        const cA = hist.filter((h) => h.actual === 'AWAY').length / n;
        const a = 0.35;
        const pH = (1 - a) * prob.pHome + a * cH;
        const pD = (1 - a) * prob.pDraw + a * cD;
        const pA = (1 - a) * prob.pAway + a * cA;
        pred = pH >= pD && pH >= pA ? 'HOME' : pA >= pD && pA >= pH ? 'AWAY' : 'DRAW';
      } else pred = outcomeFromProb(prob, 0);
    } else {
      const thr = rule === 'fixed' ? 0.29 : rule === 'calib' ? calibrateDrawThreshold(hist) : 0;
      pred = outcomeFromProb(prob, thr);
    }
    const actual = actualOutcome(m.homeScore!, m.awayScore!);
    if (pred === actual) hits++;
    total++;
    hist.push({ closeness: Math.abs(prob.pHome - prob.pAway), fav: prob.pHome >= prob.pAway ? 'HOME' : 'AWAY', actual });
    ratings = updateRatings(ratings, m.homeTeam, m.awayTeam, m.homeScore!, m.awayScore!);
  }
  return hits / total;
}

function avg(compress: number, drawBoost: number, rule: 'argmax' | 'fixed' | 'calib' | 'shrink'): number {
  let s = 0; const N = 40;
  for (let seed = 1; seed <= N; seed++) s += backtest(genActuals(compress, drawBoost, seed), rule);
  return s / N;
}

function drawRate(compress: number, drawBoost: number): number {
  let d = 0, t = 0;
  for (let seed = 1; seed <= 40; seed++) for (const m of genActuals(compress, drawBoost, seed)) { t++; if (m.homeScore === m.awayScore) d++; }
  return d / t;
}

const pc = (x: number) => (x * 100).toFixed(1) + '%';
console.log('=== 引き分け予測ルールの比較（72試合 × 40シード平均, walk-forward）===\n');
for (const [label, compress, drawBoost] of [
  ['現実=モデル通り（過信なし）', 0.0, 0.0],
  ['現実=やや番狂わせ多め', 0.4, 0.15],
  ['現実=引き分け多発（過信が強い）', 0.6, 0.35],
] as const) {
  console.log(`▼ ${label}  実際の引き分け率 ${pc(drawRate(compress, drawBoost))}`);
  console.log(`   ① 強い方(argmax)      : ${pc(avg(compress, drawBoost, 'argmax'))}`);
  console.log(`   ② 固定0.29           : ${pc(avg(compress, drawBoost, 'fixed'))}`);
  console.log(`   ③ 自己較正しきい値    : ${pc(avg(compress, drawBoost, 'calib'))}`);
  console.log(`   ④ 実測率へ縮小(過信補正): ${pc(avg(compress, drawBoost, 'shrink'))}`);
  console.log('');
}
