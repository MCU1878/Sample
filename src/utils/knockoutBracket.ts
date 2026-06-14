// ===== ノックアウトステージ（決勝トーナメント）ブラケット定義 =====

import type { KnockoutMatch, TeamStanding } from '../types';

/**
 * ノックアウトステージの全試合を初期化する
 * R32(16試合) + R16(8試合) + QF(4試合) + SF(2試合) + 3位決定戦(1試合) + 決勝(1試合) = 32試合
 */
export function createKnockoutBracket(): KnockoutMatch[] {
  const matches: KnockoutMatch[] = [];

  // ===== ラウンド32 (16試合) =====
  // 1位 vs 2位 クロスオーバー (12試合)
  const r32Crossovers: Array<{ n: number; src1: string; src2: string; label: string }> = [
    { n: 1,  src1: '1A', src2: '2C', label: 'A組1位 vs C組2位' },
    { n: 2,  src1: '1C', src2: '2A', label: 'C組1位 vs A組2位' },
    { n: 3,  src1: '1B', src2: '2D', label: 'B組1位 vs D組2位' },
    { n: 4,  src1: '1D', src2: '2B', label: 'D組1位 vs B組2位' },
    { n: 5,  src1: '1E', src2: '2G', label: 'E組1位 vs G組2位' },
    { n: 6,  src1: '1G', src2: '2E', label: 'G組1位 vs E組2位' },
    { n: 7,  src1: '1F', src2: '2H', label: 'F組1位 vs H組2位' },
    { n: 8,  src1: '1H', src2: '2F', label: 'H組1位 vs F組2位' },
    { n: 9,  src1: '1I', src2: '2K', label: 'I組1位 vs K組2位' },
    { n: 10, src1: '1K', src2: '2I', label: 'K組1位 vs I組2位' },
    { n: 11, src1: '1J', src2: '2L', label: 'J組1位 vs L組2位' },
    { n: 12, src1: '1L', src2: '2J', label: 'L組1位 vs J組2位' },
  ];

  const r32Dates = [
    '2026-07-01', '2026-07-01', '2026-07-01', '2026-07-01',
    '2026-07-02', '2026-07-02', '2026-07-02', '2026-07-02',
    '2026-07-03', '2026-07-03', '2026-07-03', '2026-07-03',
    '2026-07-04', '2026-07-04', '2026-07-04', '2026-07-04',
  ];

  for (const c of r32Crossovers) {
    const r16Num = Math.ceil(c.n / 2);
    const slot: 'team1' | 'team2' = c.n % 2 === 1 ? 'team1' : 'team2';
    matches.push({
      id: `R32-${c.n}`,
      round: 'R32',
      matchNumber: c.n,
      label: c.label,
      team1: null, team2: null,
      score1: null, score2: null,
      pen1: null, pen2: null,
      date: r32Dates[c.n - 1],
      team1Source: c.src1,
      team2Source: c.src2,
      winnerGoesTo: `R16-${r16Num}`,
      winnerSlot: slot,
      loserGoesTo: null, loserSlot: null,
    });
  }

  // ベスト3位 対戦 (4試合: R32-13 ~ R32-16)
  const thirdPairs: Array<{ n: number; src1: string; src2: string; label: string }> = [
    { n: 13, src1: '3RD-1', src2: '3RD-8', label: 'ベスト3位 #1 vs #8' },
    { n: 14, src1: '3RD-2', src2: '3RD-7', label: 'ベスト3位 #2 vs #7' },
    { n: 15, src1: '3RD-3', src2: '3RD-6', label: 'ベスト3位 #3 vs #6' },
    { n: 16, src1: '3RD-4', src2: '3RD-5', label: 'ベスト3位 #4 vs #5' },
  ];

  for (const c of thirdPairs) {
    const r16Num = Math.ceil(c.n / 2);
    const slot: 'team1' | 'team2' = c.n % 2 === 1 ? 'team1' : 'team2';
    matches.push({
      id: `R32-${c.n}`,
      round: 'R32',
      matchNumber: c.n,
      label: c.label,
      team1: null, team2: null,
      score1: null, score2: null,
      pen1: null, pen2: null,
      date: r32Dates[c.n - 1],
      team1Source: c.src1,
      team2Source: c.src2,
      winnerGoesTo: `R16-${r16Num}`,
      winnerSlot: slot,
      loserGoesTo: null, loserSlot: null,
    });
  }

  // ===== ラウンド16 (8試合) =====
  const r16Dates = [
    '2026-07-05', '2026-07-05', '2026-07-06', '2026-07-06',
    '2026-07-07', '2026-07-07', '2026-07-08', '2026-07-08',
  ];
  for (let i = 1; i <= 8; i++) {
    const qfNum = Math.ceil(i / 2);
    const slot: 'team1' | 'team2' = i % 2 === 1 ? 'team1' : 'team2';
    matches.push({
      id: `R16-${i}`,
      round: 'R16',
      matchNumber: i,
      label: `ラウンド16 第${i}試合`,
      team1: null, team2: null,
      score1: null, score2: null,
      pen1: null, pen2: null,
      date: r16Dates[i - 1],
      team1Source: `W-R32-${i * 2 - 1}`,
      team2Source: `W-R32-${i * 2}`,
      winnerGoesTo: `QF-${qfNum}`,
      winnerSlot: slot,
      loserGoesTo: null, loserSlot: null,
    });
  }

  // ===== 準々決勝 (4試合) =====
  const qfDates = ['2026-07-10', '2026-07-10', '2026-07-11', '2026-07-11'];
  for (let i = 1; i <= 4; i++) {
    const sfNum = Math.ceil(i / 2);
    const slot: 'team1' | 'team2' = i % 2 === 1 ? 'team1' : 'team2';
    matches.push({
      id: `QF-${i}`,
      round: 'QF',
      matchNumber: i,
      label: `準々決勝 第${i}試合`,
      team1: null, team2: null,
      score1: null, score2: null,
      pen1: null, pen2: null,
      date: qfDates[i - 1],
      team1Source: `W-R16-${i * 2 - 1}`,
      team2Source: `W-R16-${i * 2}`,
      winnerGoesTo: `SF-${sfNum}`,
      winnerSlot: slot,
      loserGoesTo: null, loserSlot: null,
    });
  }

  // ===== 準決勝 (2試合) =====
  matches.push({
    id: 'SF-1',
    round: 'SF', matchNumber: 1,
    label: '準決勝 第1試合',
    team1: null, team2: null,
    score1: null, score2: null,
    pen1: null, pen2: null,
    date: '2026-07-14',
    team1Source: 'W-QF-1', team2Source: 'W-QF-2',
    winnerGoesTo: 'FINAL', winnerSlot: 'team1',
    loserGoesTo: 'THIRD', loserSlot: 'team1',
  });
  matches.push({
    id: 'SF-2',
    round: 'SF', matchNumber: 2,
    label: '準決勝 第2試合',
    team1: null, team2: null,
    score1: null, score2: null,
    pen1: null, pen2: null,
    date: '2026-07-15',
    team1Source: 'W-QF-3', team2Source: 'W-QF-4',
    winnerGoesTo: 'FINAL', winnerSlot: 'team2',
    loserGoesTo: 'THIRD', loserSlot: 'team2',
  });

  // ===== 3位決定戦 =====
  matches.push({
    id: 'THIRD',
    round: 'THIRD', matchNumber: 1,
    label: '3位決定戦',
    team1: null, team2: null,
    score1: null, score2: null,
    pen1: null, pen2: null,
    date: '2026-07-18',
    team1Source: 'L-SF-1', team2Source: 'L-SF-2',
    winnerGoesTo: null, winnerSlot: null,
    loserGoesTo: null, loserSlot: null,
  });

  // ===== 決勝 =====
  matches.push({
    id: 'FINAL',
    round: 'FINAL', matchNumber: 1,
    label: '決勝',
    team1: null, team2: null,
    score1: null, score2: null,
    pen1: null, pen2: null,
    date: '2026-07-19',
    team1Source: 'W-SF-1', team2Source: 'W-SF-2',
    winnerGoesTo: null, winnerSlot: null,
    loserGoesTo: null, loserSlot: null,
  });

  return matches;
}

/**
 * ノックアウト試合の勝者チームコードを取得
 */
export function getKnockoutWinner(match: KnockoutMatch): string | null {
  if (match.team1 === null || match.team2 === null) return null;
  if (match.score1 === null || match.score2 === null) return null;

  if (match.score1 > match.score2) return match.team1;
  if (match.score2 > match.score1) return match.team2;

  // 同点の場合はPK戦で決定
  if (match.pen1 !== null && match.pen2 !== null) {
    if (match.pen1 > match.pen2) return match.team1;
    if (match.pen2 > match.pen1) return match.team2;
  }

  return null; // まだ決着なし（PK未入力）
}

/**
 * ノックアウト試合の敗者チームコードを取得
 */
export function getKnockoutLoser(match: KnockoutMatch): string | null {
  if (match.team1 === null || match.team2 === null) return null;
  if (match.score1 === null || match.score2 === null) return null;

  if (match.score1 > match.score2) return match.team2;
  if (match.score2 > match.score1) return match.team1;

  if (match.pen1 !== null && match.pen2 !== null) {
    if (match.pen1 > match.pen2) return match.team2;
    if (match.pen2 > match.pen1) return match.team1;
  }

  return null;
}

/**
 * グループステージ結果からR32のチームを自動配置し、
 * 各ラウンドの結果に基づいて次ラウンドのチームを自動進出させる
 */
export function populateKnockoutTeams(
  knockoutMatches: KnockoutMatch[],
  allStandings: Record<string, TeamStanding[]>,
  bestThird: TeamStanding[],
): KnockoutMatch[] {
  const updated = knockoutMatches.map((m) => ({ ...m }));
  const matchMap = new Map<string, KnockoutMatch>();
  for (const m of updated) {
    matchMap.set(m.id, m);
  }

  // ヘルパー: ソースからチームコードを解決
  function resolveSource(source: string): string | null {
    // "1A" → グループAの1位
    const groupRankMatch = source.match(/^(\d)([A-L])$/);
    if (groupRankMatch) {
      const rank = parseInt(groupRankMatch[1]);
      const group = groupRankMatch[2];
      const standings = allStandings[group];
      if (!standings || !standings.some((s) => s.played > 0)) return null;
      const team = standings.find((s) => s.rank === rank);
      return team ? team.teamCode : null;
    }

    // "3RD-N" → ベスト3位のN番目
    const thirdMatch = source.match(/^3RD-(\d+)$/);
    if (thirdMatch) {
      const idx = parseInt(thirdMatch[1]) - 1;
      return bestThird[idx] ? bestThird[idx].teamCode : null;
    }

    // "W-R32-1" → R32-1の勝者
    const winnerMatch = source.match(/^W-(.+)$/);
    if (winnerMatch) {
      const srcMatch = matchMap.get(winnerMatch[1]);
      if (srcMatch) return getKnockoutWinner(srcMatch);
      return null;
    }

    // "L-SF-1" → SF-1の敗者
    const loserMatch = source.match(/^L-(.+)$/);
    if (loserMatch) {
      const srcMatch = matchMap.get(loserMatch[1]);
      if (srcMatch) return getKnockoutLoser(srcMatch);
      return null;
    }

    return null;
  }

  // 全試合のチームを解決（ラウンド順に処理）
  const roundOrder: string[] = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'];
  for (const round of roundOrder) {
    for (const match of updated) {
      if (match.round !== round) continue;
      const newTeam1 = resolveSource(match.team1Source);
      const newTeam2 = resolveSource(match.team2Source);

      // チームが変わったらスコアをリセット
      if (newTeam1 !== match.team1 || newTeam2 !== match.team2) {
        match.team1 = newTeam1;
        match.team2 = newTeam2;
        // チームが変わった場合、スコアのみリセット（チームが確定していた場合）
        if (match.team1 !== newTeam1 || match.team2 !== newTeam2) {
          match.score1 = null;
          match.score2 = null;
          match.pen1 = null;
          match.pen2 = null;
        }
      }
      // matchMapも更新
      matchMap.set(match.id, match);
    }
  }

  return updated;
}
