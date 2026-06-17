// シード固定で「同じ入力 → 同じ結果」になることを検証する。
import { runForecast, rngFromKey } from '../src/utils/forecast';
import { simulateMatchFromCodes } from '../src/utils/matchEngine';
import { createInitialMatches } from '../src/data';
import { getAllGroupStandings } from '../src/utils/calculateStandings';
import { initializeKnockoutMatches, simulateKnockoutMatches } from '../src/utils/knockoutLogic';
import { groupTeams } from '../src/data';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}`, extra ?? ''); }
}

console.log('A) グループ試合: 同じ rng キー → 同じスコア');
{
  const a = simulateMatchFromCodes('BRA', 'HAI', undefined, { rng: rngFromKey('grp|test|BRA-HAI') });
  const b = simulateMatchFromCodes('BRA', 'HAI', undefined, { rng: rngFromKey('grp|test|BRA-HAI') });
  check('スコア一致', a.homeScore === b.homeScore && a.awayScore === b.awayScore, [a.homeScore, a.awayScore, b.homeScore, b.awayScore]);
  check('イベント列も一致', JSON.stringify(a.events) === JSON.stringify(b.events));
}

console.log('B) 確率予測: 同じ盤面 → 完全に同じ確率（再現可能）');
{
  const matches = createInitialMatches();
  const key = 'wc2026-forecast|';
  const r1 = runForecast(matches, { iterations: 300, rng: rngFromKey(key) });
  const r2 = runForecast(matches, { iterations: 300, rng: rngFromKey(key) });
  check('champion 分布が完全一致', JSON.stringify(r1.champion) === JSON.stringify(r2.champion));
  check('roundOf32 分布が完全一致', JSON.stringify(r1.roundOf32) === JSON.stringify(r2.roundOf32));
}

console.log('C) 決勝トーナメント: 同じ盤面 → 同じ全スコア');
{
  const matches = createInitialMatches().map((m) => {
    const s = simulateMatchFromCodes(m.homeTeam, m.awayTeam, undefined, { rng: rngFromKey('grp|' + m.id + '|' + m.homeTeam + '-' + m.awayTeam) });
    return { ...m, homeScore: s.homeScore, awayScore: s.awayScore };
  });
  const standings = getAllGroupStandings(matches, groupTeams);
  const ko1 = simulateKnockoutMatches(initializeKnockoutMatches(standings));
  const ko2 = simulateKnockoutMatches(initializeKnockoutMatches(standings));
  const sig = (ko: typeof ko1) => ko.map((m) => `${m.id}:${m.score1}-${m.score2}/${m.pen1}-${m.pen2}`).join('|');
  check('全104試合のスコアが一致', sig(ko1) === sig(ko2));
  const champ1 = ko1.find((m) => m.id === 'FINAL');
  check('優勝者が決定している', !!(champ1 && champ1.score1 !== null), champ1);
}

console.log('D) 異なるキー → 異なる結果（乱数が効いている）');
{
  const a = simulateMatchFromCodes('BRA', 'ARG', undefined, { rng: rngFromKey('k1') });
  const b = simulateMatchFromCodes('BRA', 'ARG', undefined, { rng: rngFromKey('k2') });
  // 別シードなので通常はイベント列が異なる（稀な一致を避けるため複数試行で確認）
  let anyDiff = false;
  for (let i = 0; i < 5; i++) {
    const x = simulateMatchFromCodes('BRA', 'ARG', undefined, { rng: rngFromKey('ka' + i) });
    const y = simulateMatchFromCodes('BRA', 'ARG', undefined, { rng: rngFromKey('kb' + i) });
    if (JSON.stringify(x.events) !== JSON.stringify(y.events)) anyDiff = true;
  }
  check('別シードで結果が変わりうる', anyDiff, [a.homeScore, b.homeScore]);
}

console.log('');
if (failures === 0) console.log('✅ 全テスト合格');
else { console.log(`❌ ${failures} 件失敗`); process.exit(1); }
