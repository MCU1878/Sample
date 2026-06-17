// 答え合わせ（勝敗的中率）ロジックの実行検証。
// run-test.mjs 経由で esbuild バンドルして実行する。
import {
  predictProbabilities,
  outcomeFromProb,
  actualOutcome,
  evaluateAccuracy,
} from '../src/utils/accuracy';
import type { Match } from '../src/types';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}`, extra ?? '');
  }
}

function mkMatch(home: string, away: string, hs: number | null, as: number | null, finished = true): Match {
  return {
    id: `${home}-${away}`,
    group: 'X',
    homeTeam: home,
    awayTeam: away,
    homeScore: hs,
    awayScore: as,
    date: '2026-06-11',
    time: '16:00',
    matchDay: 1,
    syncStatus: finished ? 'finished' : undefined,
  };
}

console.log('A) 決定論性: 同じ入力は常に同じ確率');
{
  const p1 = predictProbabilities('BRA', 'HAI');
  const p2 = predictProbabilities('BRA', 'HAI');
  check('確率が完全一致（乱数なし）', JSON.stringify(p1) === JSON.stringify(p2));
  check('確率の合計が ≈1', Math.abs(p1.pHome + p1.pDraw + p1.pAway - 1) < 1e-6, p1);
}

console.log('B) 較正: 強豪が弱小に対して勝ち予測');
{
  const p = predictProbabilities('BRA', 'HAI'); // ブラジル(6位) vs ハイチ(83位)
  check('ブラジル勝利確率 > ハイチ勝利確率', p.pHome > p.pAway, p);
  check('最尤はホーム(ブラジル)勝利', outcomeFromProb(p) === 'HOME', outcomeFromProb(p));
}

console.log('C) 対称性: 入れ替えると確率も入れ替わる');
{
  const p = predictProbabilities('HAI', 'BRA'); // 弱小ホーム
  check('アウェイ(ブラジル)勝利が最尤', outcomeFromProb(p) === 'AWAY', outcomeFromProb(p));
}

console.log('D) actualOutcome の判定');
{
  check('2-1 はHOME', actualOutcome(2, 1) === 'HOME');
  check('0-0 はDRAW', actualOutcome(0, 0) === 'DRAW');
  check('1-3 はAWAY', actualOutcome(1, 3) === 'AWAY');
}

console.log('E) evaluateAccuracy 集計');
{
  // ブラジルが大勝 → 予測HOME的中、ハイチが番狂わせ勝ち → 予測HOMEで外れ
  const matches: Match[] = [
    mkMatch('BRA', 'HAI', 4, 0), // 予測HOME / 実際HOME → 的中
    mkMatch('ESP', 'CPV', 3, 0), // 予測HOME / 実際HOME → 的中
    mkMatch('HAI', 'BRA', 2, 1), // 予測AWAY / 実際HOME → 外れ
  ];
  const r = evaluateAccuracy(matches);
  check('対象3試合', r.total === 3, r.total);
  check('的中2試合', r.hits === 2, r.hits);
  check('的中率 ≈ 66.7%', Math.abs(r.rate - 2 / 3) < 1e-9, r.rate);
  check('exactRate は 0〜1', r.exactRate >= 0 && r.exactRate <= 1, r.exactRate);
  check('details 件数一致', r.details.length === 3);
}

console.log('F) 未確定/欠損は集計対象外（null スコアはスキップ）');
{
  const matches: Match[] = [
    mkMatch('BRA', 'HAI', 4, 0),
    mkMatch('ESP', 'CPV', null, null), // 未消化 → スキップ
  ];
  const r = evaluateAccuracy(matches);
  check('対象は1試合のみ', r.total === 1, r.total);
}

console.log('');
if (failures === 0) {
  console.log('✅ 全テスト合格');
} else {
  console.log(`❌ ${failures} 件失敗`);
  process.exit(1);
}
