// ===== 順位計算ロジック =====

import type { Match, TeamStanding } from '../types';
import { teams } from '../data';

// FIFAランキング（値が小さいほど上位）。未登録は最下位扱い。
function fifaRankOf(code: string): number {
  return teams[code]?.fifaRank ?? 999;
}

/**
 * 同一グループ内で同点（勝ち点が等しい）チーム群の順位を、
 * FIFA WC2026 公式の順位決定基準（規則 付属書／公式サイト記載）で解決する。
 *
 *   1) 当該チーム間の勝ち点
 *   2) 当該チーム間の得失点差
 *   3) 当該チーム間の得点
 *   4) 1〜3を適用後も同順位なら、そのチーム同士で再度1〜3を適用（再帰）。なお決まらなければ5以降。
 *   5) 全試合の得失点差
 *   6) 全試合の得点
 *   7) フェアプレーポイント        ← ★意図的に未対応（後述）
 *   8) 最新のFIFAランキング
 *   9) 過去のFIFAランキング         ← 8で必ず決着するため到達しない
 *
 * 【7 フェアプレーポイントについて】
 *   本シミュレータはカード（警告・退場）をモデル化していないため、フェアプレーポイントを
 *   算出する材料が無く、意図的にスキップしている（=「漏れ」ではない）。
 *   その結果、適用順は 1→2→3→(4)→5→6→8 となる。7に到達する状況は現実でも極めて稀。
 *
 * 3チーム以上が絡む場合は、分離できたサブグループへ「当該間」基準を再帰的に再適用する。
 */
function breakTies(
  tiedCodes: string[],
  standingsMap: Record<string, TeamStanding>,
  groupMatches: Match[]
): string[] {
  if (tiedCodes.length === 1) return tiedCodes;

  // 当該チーム同士の試合だけで集計（直接対決ミニリーグ）
  const inSet = new Set(tiedCodes);
  const h2h: Record<string, { pts: number; gd: number; gf: number }> = {};
  for (const c of tiedCodes) h2h[c] = { pts: 0, gd: 0, gf: 0 };

  for (const m of groupMatches) {
    if (m.homeScore === null || m.awayScore === null) continue;
    if (!inSet.has(m.homeTeam) || !inSet.has(m.awayTeam)) continue;
    const home = h2h[m.homeTeam];
    const away = h2h[m.awayTeam];
    home.gf += m.homeScore; home.gd += m.homeScore - m.awayScore;
    away.gf += m.awayScore; away.gd += m.awayScore - m.homeScore;
    if (m.homeScore > m.awayScore) home.pts += 3;
    else if (m.homeScore < m.awayScore) away.pts += 3;
    else { home.pts += 1; away.pts += 1; }
  }

  // 当該間基準でソート
  const sorted = [...tiedCodes].sort((a, b) => {
    if (h2h[b].pts !== h2h[a].pts) return h2h[b].pts - h2h[a].pts;
    if (h2h[b].gd !== h2h[a].gd) return h2h[b].gd - h2h[a].gd;
    if (h2h[b].gf !== h2h[a].gf) return h2h[b].gf - h2h[a].gf;
    return 0;
  });

  // 当該間基準が同値のかたまりに分割
  const same = (x: string, y: string) =>
    h2h[x].pts === h2h[y].pts && h2h[x].gd === h2h[y].gd && h2h[x].gf === h2h[y].gf;
  const subgroups: string[][] = [];
  let cur: string[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (same(sorted[i], sorted[i - 1])) cur.push(sorted[i]);
    else { subgroups.push(cur); cur = [sorted[i]]; }
  }
  subgroups.push(cur);

  // 当該間基準で全く分離できなかった → 全試合の基準（得失点差→得点→FIFAランキング）へ
  if (subgroups.length === 1) {
    return [...tiedCodes].sort((a, b) => {
      const sa = standingsMap[a], sb = standingsMap[b];
      if (sb.goalDifference !== sa.goalDifference) return sb.goalDifference - sa.goalDifference;
      if (sb.goalsFor !== sa.goalsFor) return sb.goalsFor - sa.goalsFor;
      // 7) フェアプレーポイントは本シミュレータ非対応のためスキップ
      return fifaRankOf(a) - fifaRankOf(b); // 8) FIFAランキング（昇順=上位）
    });
  }

  // 一部だけ分離 → 残った同値サブグループへ当該間基準を再帰適用
  const result: string[] = [];
  for (const g of subgroups) {
    if (g.length === 1) result.push(g[0]);
    else result.push(...breakTies(g, standingsMap, groupMatches));
  }
  return result;
}

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

  // FIFA WC2026 公式の順位決定基準で並べる。
  // まず勝ち点（全試合）で大分類し、同点グループは breakTies で
  // 「当該チーム間 → 全試合 → FIFAランキング」の順に解決する。
  const byPoints = [...groupTeamCodes].sort(
    (a, b) => standingsMap[b].points - standingsMap[a].points
  );

  const orderedCodes: string[] = [];
  let i = 0;
  while (i < byPoints.length) {
    let j = i;
    while (j < byPoints.length && standingsMap[byPoints[j]].points === standingsMap[byPoints[i]].points) {
      j++;
    }
    const tie = byPoints.slice(i, j);
    orderedCodes.push(...(tie.length === 1 ? tie : breakTies(tie, standingsMap, matches)));
    i = j;
  }

  const sorted = orderedCodes.map((code) => standingsMap[code]);

  // ランクを付与 (1〜4)
  for (let k = 0; k < sorted.length; k++) {
    sorted[k].rank = k + 1;
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
 * 異なるグループの3位チーム同士を比較する公式基準。
 * （直接対決は無いので）勝ち点 > 得失点差 > 総得点 > フェアプレー(本sim非対応) > FIFAランキング。
 */
function compareThirdPlace(a: TeamStanding, b: TeamStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return fifaRankOf(a.teamCode) - fifaRankOf(b.teamCode);
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

  // ベスト3位チームをソート（公式: 勝ち点 > 得失点差 > 総得点 > フェアプレー(非対応) > FIFAランキング）
  thirdPlaceTeams.sort(compareThirdPlace);

  // 上位8チームを返す
  return thirdPlaceTeams.slice(0, 8);
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

  // 3位チームをソート（公式: 勝ち点 > 得失点差 > 総得点 > フェアプレー(非対応) > FIFAランキング）
  thirdPlaceTeams.sort(compareThirdPlace);

  return thirdPlaceTeams;
}
