// ベイズ・レーティング（手法A）の挙動検証。
import { teams } from '../src/data';
import { initRatings, expectedLambdas, updateRatings, fitRatings, MU0 } from '../src/utils/ratingModel';

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failures++; }
};
const approx = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol;

// テスト用ダミーチーム
teams['TOP'] = { name: 'TOP', code: 'TOP', flag: '', iso: '', fifaRank: 1 };
teams['MID'] = { name: 'MID', code: 'MID', flag: '', iso: '', fifaRank: 50 };
teams['LOW'] = { name: 'LOW', code: 'LOW', flag: '', iso: '', fifaRank: 95 };
const CODES = ['TOP', 'MID', 'LOW'];

console.log('A-1) 校正: 同格対戦は λ≈1.35、強弱は単調');
{
  const R = initRatings(CODES);
  const mm = expectedLambdas('MID', 'MID', R); // 同一なので atk-def=0
  ok(approx(mm.lambdaHome, Math.exp(MU0)) && approx(mm.lambdaHome, 1.35, 1e-9), `同格 λ=${mm.lambdaHome.toFixed(3)}≈1.35`);

  const tl = expectedLambdas('TOP', 'LOW', R);
  ok(tl.lambdaHome > 1.35 && tl.lambdaAway < 1.35, `強(TOP)vs弱(LOW): λ_home=${tl.lambdaHome.toFixed(2)} > 1.35 > λ_away=${tl.lambdaAway.toFixed(2)}`);

  const tm = expectedLambdas('TOP', 'MID', R);
  ok(tl.lambdaHome > tm.lambdaHome, `相手が弱いほど期待得点が大（TOP vs LOW ${tl.lambdaHome.toFixed(2)} > TOP vs MID ${tm.lambdaHome.toFixed(2)}）`);
}

console.log('A-2) 観測で分散が縮む（確信が高まる）');
{
  const R0 = initRatings(CODES);
  const R1 = updateRatings(R0, 'TOP', 'LOW', 3, 0);
  ok(R1['TOP'].attack.var < R0['TOP'].attack.var, `TOP攻撃の分散が減少 ${R0['TOP'].attack.var.toFixed(3)}→${R1['TOP'].attack.var.toFixed(3)}`);
  ok(R1['LOW'].defense.var < R0['LOW'].defense.var, `LOW守備の分散が減少 ${R0['LOW'].defense.var.toFixed(3)}→${R1['LOW'].defense.var.toFixed(3)}`);
}

console.log('A-3) 学習: 番狂わせが続くと弱小チームの強さ推定が上がる');
{
  // LOW（事前は最弱）が TOP/MID を繰り返し大差で破る
  const upsets: [string, string, number, number][] = [];
  for (let i = 0; i < 8; i++) {
    upsets.push(['LOW', 'TOP', 3, 0]);
    upsets.push(['LOW', 'MID', 2, 0]);
  }
  const R0 = initRatings(CODES);
  const Rf = fitRatings(upsets, CODES);

  ok(Rf['LOW'].attack.mean > R0['LOW'].attack.mean, `LOWの攻撃力推定が上昇 ${R0['LOW'].attack.mean.toFixed(2)}→${Rf['LOW'].attack.mean.toFixed(2)}`);

  const before = expectedLambdas('LOW', 'TOP', R0).lambdaHome;
  const after = expectedLambdas('LOW', 'TOP', Rf).lambdaHome;
  ok(after > before, `LOW対TOP の期待得点が学習後に増加 ${before.toFixed(2)}→${after.toFixed(2)}`);

  // 勝者側TOPの守備も「崩される」方向に更新され、被得点期待が増える
  const concededBefore = expectedLambdas('LOW', 'TOP', R0).lambdaHome;
  const concededAfter = expectedLambdas('LOW', 'TOP', Rf).lambdaHome;
  ok(concededAfter > concededBefore, 'TOPの守備評価も実態に合わせて低下');
}

console.log('A-4) 逆方向: 順当な結果なら序列は保たれる');
{
  const normal: [string, string, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    normal.push(['TOP', 'LOW', 3, 0]);
    normal.push(['TOP', 'MID', 2, 0]);
    normal.push(['MID', 'LOW', 2, 0]);
  }
  const Rf = fitRatings(normal, CODES);
  ok(Rf['TOP'].attack.mean > Rf['MID'].attack.mean && Rf['MID'].attack.mean > Rf['LOW'].attack.mean,
    `順当な結果では攻撃力序列 TOP>MID>LOW を維持（${Rf['TOP'].attack.mean.toFixed(2)} > ${Rf['MID'].attack.mean.toFixed(2)} > ${Rf['LOW'].attack.mean.toFixed(2)}）`);
}

delete teams['TOP']; delete teams['MID']; delete teams['LOW'];

console.log('');
if (failures === 0) console.log('✅ レーティング検証 全項目 PASS');
else { console.error(`❌ レーティング検証 ${failures} 件 FAIL`); process.exit(1); }
