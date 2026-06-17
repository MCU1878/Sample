// App.tsx の fillGroupStageSituational と同じ合成ロジックを再現し、
// (1) 決定論（同じ入力→同じ出力） (2) 節順で状況効果が入ること を検証する。
import type { Match } from '../src/types';
import { simulateMatchFromCodes } from '../src/utils/matchEngine';
import { computeGroupTable, situationalIntent } from '../src/utils/situationalPlay';
import { rngFromKey } from '../src/utils/rng';
import { createInitialMatches, groupTeams } from '../src/data';

const GROUPS = Object.keys(groupTeams);

// App.tsx と同一ロジック（situational あり/なしを切替可能）
function fill(matches: Match[], situational: boolean): Match[] {
  const filled = matches.map((m) => ({ ...m }));
  for (const md of [1, 2, 3]) {
    const tables: Record<string, ReturnType<typeof computeGroupTable>> = {};
    if (md >= 2 && situational) for (const g of GROUPS) tables[g] = computeGroupTable(filled, g, groupTeams[g]);
    for (const match of filled) {
      if ((match.matchDay ?? 1) !== md) continue;
      if (match.syncStatus) continue;
      const iH = md >= 2 && situational && match.group ? situationalIntent(match.homeTeam, tables[match.group] ?? [], md) : undefined;
      const iA = md >= 2 && situational && match.group ? situationalIntent(match.awayTeam, tables[match.group] ?? [], md) : undefined;
      const log = simulateMatchFromCodes(match.homeTeam, match.awayTeam, undefined, {
        climate: match.climate,
        rng: rngFromKey('grp|' + match.id + '|' + match.homeTeam + '-' + match.awayTeam),
        intentHome: iH, intentAway: iA,
      });
      match.homeScore = log.homeScore;
      match.awayScore = log.awayScore;
    }
  }
  return filled;
}

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`); else { failures++; console.log(`  ✗ ${name}`, extra ?? ''); }
}
const sig = (ms: Match[]) => ms.map((m) => `${m.id}:${m.homeScore}-${m.awayScore}`).join('|');

console.log('A) 決定論: 同じ入力を2回埋めると完全一致');
{
  const a = fill(createInitialMatches(), true);
  const b = fill(createInitialMatches(), true);
  check('72試合のスコアが完全一致', sig(a) === sig(b));
  check('全試合スコアが入っている', a.every((m) => m.homeScore !== null && m.awayScore !== null));
}

console.log('B) 状況効果: 第3節のスコア分布が situational あり/なしで変わる');
{
  const withS = fill(createInitialMatches(), true);
  const without = fill(createInitialMatches(), false);
  // 第1節は両者同一（状況効果なし）
  const md1Same = withS.filter((m) => m.matchDay === 1).every((m, i) => {
    const w = without.filter((x) => x.matchDay === 1)[i];
    return m.homeScore === w.homeScore && m.awayScore === w.awayScore;
  });
  check('第1節は同一（状況効果は無効）', md1Same);
  // 第3節は一部の試合でスコアが変わる
  const md3With = withS.filter((m) => m.matchDay === 3);
  const md3Without = without.filter((m) => m.matchDay === 3);
  let diff = 0;
  for (let i = 0; i < md3With.length; i++) {
    if (md3With[i].homeScore !== md3Without[i].homeScore || md3With[i].awayScore !== md3Without[i].awayScore) diff++;
  }
  console.log(`   第3節 ${md3With.length}試合中 ${diff}試合でスコアが変化`);
  check('第3節で状況効果が表れている（変化>0）', diff > 0);
}

console.log('');
if (failures === 0) console.log('✅ 全テスト合格');
else { console.log(`❌ ${failures} 件失敗`); process.exit(1); }
