// ===== 順位計算ロジック =====

import type { Match, TeamStanding, BracketMatch } from '../types';

/**
 * グループ内の各チームの順位表を計算する
 * @param matches - 全試合データ
 * @param groupTeamCodes - グループに属するチームコードの配列
 * @returns ソート済み・ランク付きのTeamStanding配列
 */
export function calculateGroupStandings(
  matches: Match[],
  groupTeamCodes: string[]
): TeamStanding[] {
  // 各チームの成績を初期化
  const standingsMap: Record<string, TeamStanding> = {};
  for (const code of groupTeamCodes) {
    standingsMap[code] = {
      teamCode: code,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      rank: 0,
    };
  }

  // 各試合の結果を集計
  for (const match of matches) {
    // スコアが未入力の試合はスキップ
    if (match.homeScore === null || match.awayScore === null) {
      continue;
    }

    const { homeTeam, awayTeam, homeScore, awayScore } = match;
    const homeStanding = standingsMap[homeTeam];
    const awayStanding = standingsMap[awayTeam];

    // このグループに関係ない試合はスキップ
    if (!homeStanding || !awayStanding) {
      continue;
    }

    // 試合数を加算
    homeStanding.played += 1;
    awayStanding.played += 1;

    // 得点・失点を加算
    homeStanding.goalsFor += homeScore;
    homeStanding.goalsAgainst += awayScore;
    awayStanding.goalsFor += awayScore;
    awayStanding.goalsAgainst += homeScore;

    // 勝敗判定
    if (homeScore > awayScore) {
      // ホーム勝利
      homeStanding.won += 1;
      homeStanding.points += 3;
      awayStanding.lost += 1;
    } else if (homeScore < awayScore) {
      // アウェイ勝利
      awayStanding.won += 1;
      awayStanding.points += 3;
      homeStanding.lost += 1;
    } else {
      // 引き分け
      homeStanding.drawn += 1;
      homeStanding.points += 1;
      awayStanding.drawn += 1;
      awayStanding.points += 1;
    }
  }

  // 得失点差を計算
  for (const code of groupTeamCodes) {
    const s = standingsMap[code];
    s.goalDifference = s.goalsFor - s.goalsAgainst;
  }

  // ソート: 勝ち点(降順) > 得失点差(降順) > 総得点(降順) > チームコード(昇順)
  const sorted = groupTeamCodes
    .map((code) => standingsMap[code])
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference)
        return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.teamCode.localeCompare(b.teamCode);
    });

  // ランクを付与 (1〜4)
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].rank = i + 1;
  }

  return sorted;
}

/**
 * 全グループの順位表を一括計算する
 */
export function getAllGroupStandings(
  matches: Match[],
  groupTeams: Record<string, string[]>
): Record<string, TeamStanding[]> {
  const result: Record<string, TeamStanding[]> = {};

  for (const [groupName, teamCodes] of Object.entries(groupTeams)) {
    const groupMatches = matches.filter((m) => m.group === groupName);
    result[groupName] = calculateGroupStandings(groupMatches, teamCodes);
  }

  return result;
}

/**
 * グループ内で1試合でもプレイ済みかどうかを判定するヘルパー
 */
function hasPlayedMatches(standings: TeamStanding[]): boolean {
  return standings.some((s) => s.played > 0);
}

/**
 * 3位チームの中からベスト8を選出する
 * ソート: 勝ち点 > 得失点差 > 総得点
 */
export function getBestThirdPlaceTeams(
  allStandings: Record<string, TeamStanding[]>
): (TeamStanding & { group: string })[] {
  const thirdPlaceTeams: (TeamStanding & { group: string })[] = [];

  for (const [group, standings] of Object.entries(allStandings)) {
    if (!hasPlayedMatches(standings)) continue;
    const third = standings.find((s) => s.rank === 3);
    if (third) {
      thirdPlaceTeams.push({ ...third, group });
    }
  }

  // ベスト3位チームをソート
  thirdPlaceTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamCode.localeCompare(b.teamCode);
  });

  // 上位8チームを返す
  return thirdPlaceTeams.slice(0, 8);
}

/**
 * 全グループの順位表からラウンド32の対戦カードを生成する
 *
 * 2026年W杯形式: 各グループ1位 vs 別グループ2位のクロスオーバー
 * - Match 1:  1A vs 2C
 * - Match 2:  1C vs 2A
 * - Match 3:  1B vs 2D
 * - Match 4:  1D vs 2B
 * - Match 5:  1E vs 2G
 * - Match 6:  1G vs 2E
 * - Match 7:  1F vs 2H
 * - Match 8:  1H vs 2F
 * - Match 9:  1I vs 2K
 * - Match 10: 1K vs 2I
 * - Match 11: 1J vs 2L
 * - Match 12: 1L vs 2J
 * + 4試合: ベスト3位チーム同士の対戦
 */
export function getRoundOf32Matchups(
  allStandings: Record<string, TeamStanding[]>
): BracketMatch[] {
  const getTeam = (
    groupName: string,
    rank: number
  ): string | null => {
    const standings = allStandings[groupName];
    if (!standings || !hasPlayedMatches(standings)) {
      return null;
    }
    const team = standings.find((s) => s.rank === rank);
    return team ? team.teamCode : null;
  };

  // 1位 vs 2位 のクロスオーバー (12試合)
  const crossoverPairs: [string, string][] = [
    ['A', 'C'], ['C', 'A'],
    ['B', 'D'], ['D', 'B'],
    ['E', 'G'], ['G', 'E'],
    ['F', 'H'], ['H', 'F'],
    ['I', 'K'], ['K', 'I'],
    ['J', 'L'], ['L', 'J'],
  ];

  const matchups: BracketMatch[] = crossoverPairs.map(([g1, g2], index) => ({
    id: `R32-${index + 1}`,
    label: `1位 ${g1}組 vs 2位 ${g2}組`,
    team1: getTeam(g1, 1),
    team2: getTeam(g2, 2),
  }));

  // ベスト3位チーム対戦 (4試合)
  const bestThird = getBestThirdPlaceTeams(allStandings);
  for (let i = 0; i < 4; i++) {
    const t1 = bestThird[i * 2] ?? null;
    const t2 = bestThird[i * 2 + 1] ?? null;
    matchups.push({
      id: `R32-3rd-${i + 1}`,
      label: `ベスト3位 対戦 ${i + 1}`,
      team1: t1 ? t1.teamCode : null,
      team2: t2 ? t2.teamCode : null,
    });
  }

  return matchups;
}

/**
 * 全グループの3位チーム（12チーム）を抽出して成績順にソートする
 */
export function getAllThirdPlaceTeams(
  allStandings: Record<string, TeamStanding[]>
): (TeamStanding & { group: string })[] {
  const thirdPlaceTeams: (TeamStanding & { group: string })[] = [];

  for (const [group, standings] of Object.entries(allStandings)) {
    const third = standings.find((s) => s.rank === 3);
    if (third) {
      thirdPlaceTeams.push({ ...third, group });
    }
  }

  // 3位チームをソート
  // ソート: 勝ち点(降順) > 得失点差(降順) > 総得点(降順) > チームコード(昇順)
  thirdPlaceTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamCode.localeCompare(b.teamCode);
  });

  return thirdPlaceTeams;
}
