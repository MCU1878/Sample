// 進出的中（グループ突破）と 決勝トーナメント勝敗的中 の検証。
import { evaluateAdvancement, evaluateKnockoutAccuracy } from '../src/utils/accuracy';
import type { TeamStanding, KnockoutMatch } from '../src/types';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}`, extra ?? ''); }
}

function st(code: string, rank: number, played = 3): TeamStanding {
  return { teamCode: code, played, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, rank };
}

console.log('A) 進出的中: 予測上位2が実際に突破（全的中）');
{
  // グループH: 強さ ESP>URU>KSA>CPV → 予測突破 [ESP,URU]
  const standings: Record<string, TeamStanding[]> = {
    H: [st('ESP', 1), st('URU', 2), st('KSA', 3), st('CPV', 4)],
  };
  const r = evaluateAdvancement(standings);
  check('完了グループ1', r.completedGroups === 1, r.completedGroups);
  check('突破的中率 100%', r.advRate === 1, r.advRate);
  check('首位的中 100%', r.winnerRate === 1, r.winnerRate);
  check('予測突破は [ESP,URU]', r.groups[0].predictedTop2.join() === 'ESP,URU', r.groups[0].predictedTop2);
}

console.log('B) 進出的中: 番狂わせで1枠だけ的中');
{
  // 実際は URU が4位に転落、KSA が2位に → 実突破 [ESP,KSA]、予測[ESP,URU] → hits=1
  const standings: Record<string, TeamStanding[]> = {
    H: [st('ESP', 1), st('KSA', 2), st('CPV', 3), st('URU', 4)],
  };
  const r = evaluateAdvancement(standings);
  check('突破的中 1/2', r.advHits === 1 && r.advTotal === 2, [r.advHits, r.advTotal]);
  check('首位は的中(ESP)', r.winnerRate === 1);
}

console.log('C) 未完了グループ（played<3）は集計対象外');
{
  const standings: Record<string, TeamStanding[]> = {
    A: [st('MEX', 1, 2), st('KOR', 2, 2), st('CZE', 3, 1), st('RSA', 4, 1)],
  };
  const r = evaluateAdvancement(standings);
  check('完了グループ0', r.completedGroups === 0, r.completedGroups);
  check('的中率0（分母0）', r.advRate === 0);
}

console.log('D) 決勝トーナメント勝敗的中');
{
  const mk = (id: string, t1: string, t2: string, s1: number | null, s2: number | null, p1: number | null = null, p2: number | null = null): KnockoutMatch => ({
    id, round: 'R16', matchNumber: 1, label: id, team1: t1, team2: t2, score1: s1, score2: s2, pen1: p1, pen2: p2,
    date: '2026-07-01', team1Source: '', team2Source: '', winnerGoesTo: null, winnerSlot: null, loserGoesTo: null, loserSlot: null,
  });
  const koMatches: KnockoutMatch[] = [
    mk('A', 'ESP', 'GHA', 2, 0),          // 予測ESP, 実ESP → 的中
    mk('B', 'CUW', 'FRA', 1, 0),          // 予測FRA(強), 実CUW勝ち → 外れ
    mk('C', 'ENG', 'USA', 1, 1, 4, 3),    // PKでENG → 予測ENG → 的中
    mk('D', 'BRA', 'ARG', null, null),    // 未実施 → 除外
  ];
  const r = evaluateKnockoutAccuracy(koMatches);
  check('対象3試合', r.total === 3, r.total);
  check('的中2試合', r.hits === 2, r.hits);
  check('PK決着も勝者判定できる', r.details.find((d) => d.id === 'C')?.actualWinner === 'ENG');
}

console.log('');
if (failures === 0) console.log('✅ 全テスト合格');
else { console.log(`❌ ${failures} 件失敗`); process.exit(1); }
