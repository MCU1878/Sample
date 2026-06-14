// =============================================================================
// ベイズ状態空間レーティング（Phase 1 / 手法A）
// -----------------------------------------------------------------------------
// 各チームを「攻撃力 attack」「守備力 defense」の潜在変数（平均±分散）で表す。
// 得点はポアソン分布に従うとし、実際の試合結果を観測するたびに
// 拡張カルマンフィルタ（ポアソン回帰のベイズ逐次更新）で事後分布を更新する。
//
//   試合の期待得点:
//     λ_home = exp(MU0 + atk_home - def_away)
//     λ_away = exp(MU0 + atk_away - def_home)   （中立地のためホーム補正なし）
//
//   観測 (g_home, g_away) による更新（潜在変数 x ごと、η=対数期待得点）:
//     勾配     grad = (観測得点 - λ)               （∂logL/∂x, x=atk は +、x=def は -）
//     フィッシャー情報 F = λ                        （ポアソンの分散=平均）
//     分散更新 var' = var / (1 + var·F)
//     平均更新 mean' = mean + var'·grad·sign
//   → 観測のたびに分散が縮む（= 大会が進むほど推定が確信的になる）。
// =============================================================================

import { teams } from '../data';

export interface LatentVar {
  mean: number;
  var: number;
}

export interface TeamRating {
  attack: LatentVar;
  defense: LatentVar;
}

export type RatingMap = Record<string, TeamRating>;

// 同格対戦で λ≈1.35 になる基準（現行ポアソンモデルの基本期待値に合わせる）
export const MU0 = Math.log(1.35);
// FIFAランク差をレーティング差へ変換するスケール（強豪vs弱小で λ が現実的な範囲に収まるよう調整）
const STRENGTH_SCALE = 1.0;
// 事前分布の分散（大会前の不確かさ。1試合での学習率（更新幅）を抑えるため小さめに設定）
const PRIOR_VAR = 0.04;
// 各試合ごとに加えるプロセスノイズ（強さは時間で多少変動しうる、という仮定。学習が硬直しない程度）
const PROCESS_NOISE = 0.002;

// FIFAランク(1〜100+) → 0〜1 の質スコア（1=最強）
function qualityFromRank(rank: number): number {
  const r = Math.max(1, Math.min(100, rank));
  return (100 - r) / 100;
}

/**
 * 全チームの事前レーティングを FIFA ランキングから生成する。
 * 攻撃・守備とも、全チーム平均からの相対質に STRENGTH_SCALE を掛けた値を平均とする。
 */
export function initRatings(teamCodes?: string[]): RatingMap {
  const codes = teamCodes ?? Object.keys(teams);
  const qualities = codes.map((c) => qualityFromRank(teams[c]?.fifaRank ?? 80));
  const meanQ = qualities.reduce((s, q) => s + q, 0) / (qualities.length || 1);

  const ratings: RatingMap = {};
  codes.forEach((c, i) => {
    const base = STRENGTH_SCALE * (qualities[i] - meanQ);
    ratings[c] = {
      attack: { mean: base, var: PRIOR_VAR },
      defense: { mean: base, var: PRIOR_VAR },
    };
  });
  return ratings;
}

/** ある対戦の期待得点 λ を返す（中立地） */
export function expectedLambdas(
  homeCode: string,
  awayCode: string,
  ratings: RatingMap
): { lambdaHome: number; lambdaAway: number } {
  const h = ratings[homeCode];
  const a = ratings[awayCode];
  const atkH = h?.attack.mean ?? 0;
  const defH = h?.defense.mean ?? 0;
  const atkA = a?.attack.mean ?? 0;
  const defA = a?.defense.mean ?? 0;

  const clamp = (x: number) => Math.max(0.1, Math.min(5.5, x));
  return {
    lambdaHome: clamp(Math.exp(MU0 + atkH - defA)),
    lambdaAway: clamp(Math.exp(MU0 + atkA - defH)),
  };
}

// 1つの潜在変数を EKF 流に更新する
function updateVar(v: LatentVar, lambda: number, residual: number, sign: number): LatentVar {
  const fisher = lambda; // ポアソンのフィッシャー情報
  const newVar = v.var / (1 + v.var * fisher);
  const newMean = v.mean + newVar * sign * residual;
  // プロセスノイズを足して、将来の学習余地を残す
  return { mean: newMean, var: newVar + PROCESS_NOISE };
}

/**
 * 試合結果 (g_home, g_away) を観測し、関与する4つの潜在変数を更新した新しい RatingMap を返す。
 * （元の RatingMap は破壊しない）
 */
export function updateRatings(
  ratings: RatingMap,
  homeCode: string,
  awayCode: string,
  gHome: number,
  gAway: number
): RatingMap {
  const h = ratings[homeCode];
  const a = ratings[awayCode];
  if (!h || !a) return ratings;

  const { lambdaHome, lambdaAway } = expectedLambdas(homeCode, awayCode, ratings);
  const resHome = gHome - lambdaHome; // ホーム得点の残差
  const resAway = gAway - lambdaAway; // アウェイ得点の残差

  const next: RatingMap = { ...ratings };
  // ホーム得点 = f(atk_home(+), def_away(-))
  next[homeCode] = {
    attack: updateVar(h.attack, lambdaHome, resHome, +1),
    defense: h.defense, // 後で away 得点側で更新
  };
  next[awayCode] = {
    attack: a.attack,
    defense: updateVar(a.defense, lambdaHome, resHome, -1),
  };
  // アウェイ得点 = f(atk_away(+), def_home(-))
  next[awayCode] = {
    attack: updateVar(next[awayCode].attack, lambdaAway, resAway, +1),
    defense: next[awayCode].defense,
  };
  next[homeCode] = {
    attack: next[homeCode].attack,
    defense: updateVar(next[homeCode].defense, lambdaAway, resAway, -1),
  };

  return next;
}

/**
 * 観測済みの全試合（スコア入力済み）を順に取り込み、事後レーティングを得る。
 * @param playedMatches [homeCode, awayCode, gHome, gAway] の配列（時系列順が望ましい）
 */
export function fitRatings(
  playedMatches: [string, string, number, number][],
  teamCodes?: string[]
): RatingMap {
  let ratings = initRatings(teamCodes);
  for (const [h, a, gh, ga] of playedMatches) {
    ratings = updateRatings(ratings, h, a, gh, ga);
  }
  return ratings;
}
