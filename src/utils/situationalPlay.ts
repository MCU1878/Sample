// =============================================================================
// 状況依存の戦い方（グループステージの勝ち点モチベーション）
// -----------------------------------------------------------------------------
// グループステージでは「その時点の勝ち点」で各チームの戦い方が変わる:
//   ・突破ほぼ確定 → 主力温存・消化試合（攻守とも緩む）
//   ・突破圏で順位を守りたい → 守備的（失点を減らすが得点も減る）
//   ・突破に勝ち点が必要 → 前掛かり（得点を狙うが失点リスクも上がる）
//   ・敗退濃厚 → モチベーション低下
//
// 効果は第3節で最大(w=1.0)、第2節で中程度(w=0.4)、第1節は情報がないため無効(0)。
// 各チームの「攻撃意図 attackMul」「被失点のしやすさ concedeMul」を返し、
// 期待得点 λ に乗算して反映する。
// =============================================================================

import type { Match } from '../types';

export interface Intent {
  attackMul: number; // 自分の期待得点に掛ける
  concedeMul: number; // 相手の期待得点に掛ける（>1 = 失点しやすい）
}

const NEUTRAL: Intent = { attackMul: 1, concedeMul: 1 };

export interface GroupRow {
  code: string;
  points: number;
  gd: number;
  played: number;
}

/** あるグループの、確定済み試合だけから勝ち点表を作る */
export function computeGroupTable(matches: Match[], groupCode: string, teamCodes: string[]): GroupRow[] {
  const rows: Record<string, GroupRow> = {};
  for (const c of teamCodes) rows[c] = { code: c, points: 0, gd: 0, played: 0 };

  for (const m of matches) {
    if (m.group !== groupCode) continue;
    if (m.homeScore === null || m.awayScore === null) continue;
    const h = rows[m.homeTeam];
    const a = rows[m.awayTeam];
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.gd += m.homeScore - m.awayScore;
    a.gd += m.awayScore - m.homeScore;
    if (m.homeScore > m.awayScore) h.points += 3;
    else if (m.homeScore < m.awayScore) a.points += 3;
    else {
      h.points += 1;
      a.points += 1;
    }
  }
  return Object.values(rows);
}

/**
 * チームの「その時点の勝ち点状況」から戦い方の意図を返す。
 * @param matchDay この試合の節（1/2/3）
 */
export function situationalIntent(code: string, table: GroupRow[], matchDay: number): Intent {
  const w = matchDay >= 3 ? 1.0 : matchDay === 2 ? 0.4 : 0.0;
  if (w === 0 || table.length < 2) return NEUTRAL;

  const sorted = [...table].sort((a, b) => b.points - a.points || b.gd - a.gd);
  const idx = sorted.findIndex((t) => t.code === code);
  if (idx < 0) return NEUTRAL;
  const me = sorted[idx];
  const myRank = idx + 1;
  const p2 = sorted[1]?.points ?? 0; // 突破ボーダー（2位）の勝ち点
  const p3 = sorted[2]?.points ?? 0; // 3位の勝ち点（追う側）

  const remaining = Math.max(1, 4 - matchDay); // この試合を含む残り試合数
  const maxReach = me.points + 3 * remaining;

  // 敗退濃厚（勝ってもボーダーに届かない）→ モチベーション低下
  if (maxReach < p2) {
    return { attackMul: 1 - 0.12 * w, concedeMul: 1 + 0.06 * w };
  }

  if (myRank <= 2) {
    const cushion = me.points - p3; // 追う3位との差
    if (cushion >= 4) {
      // ほぼ突破確定 → 主力温存・消化試合（攻守とも緩む）
      return { attackMul: 1 - 0.15 * w, concedeMul: 1 + 0.08 * w };
    }
    // 突破圏だが安泰ではない → 順位を守る堅守（失点減・得点もやや減）
    return { attackMul: 1 - 0.08 * w, concedeMul: 1 - 0.10 * w };
  }

  // ボーダー外で、まだ可能性あり → 勝ち点が必要 → 前掛かり（得点増・失点リスク増）
  return { attackMul: 1 + 0.15 * w, concedeMul: 1 + 0.10 * w };
}

/** 両チームの意図を期待得点 λ に反映する */
export function applyIntent(
  lambdaHome: number,
  lambdaAway: number,
  intentHome: Intent,
  intentAway: Intent
): [number, number] {
  const lh = lambdaHome * intentHome.attackMul * intentAway.concedeMul;
  const la = lambdaAway * intentAway.attackMul * intentHome.concedeMul;
  return [lh, la];
}
