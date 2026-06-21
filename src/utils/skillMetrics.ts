// =============================================================================
// 予測力の指標（較正・Brierスコア・的中率の推移）
// -----------------------------------------------------------------------------
// 「当てるだけでなく、確率まで正確か」を測る指標群。すべて answer-check（答え合わせ）
// の MatchAccuracy[] から計算する。決定論的・リークなし（walk-forward の予測確率を使用）。
// =============================================================================

import type { MatchAccuracy, Outcome } from './accuracy';

/** 実際の勝敗を one-hot (home, draw, away) に */
function oneHot(o: Outcome): [number, number, number] {
  return [o === 'HOME' ? 1 : 0, o === 'DRAW' ? 1 : 0, o === 'AWAY' ? 1 : 0];
}

/**
 * 多クラス Brier スコア（0=完璧 〜 2=最悪）。低いほど良い。
 * brier = mean over matches of Σ_outcome (p - actual)²
 */
export function brierScore(details: MatchAccuracy[]): number {
  if (details.length === 0) return 0;
  let sum = 0;
  for (const d of details) {
    const [oH, oD, oA] = oneHot(d.actual);
    sum += (d.pHome - oH) ** 2 + (d.pDraw - oD) ** 2 + (d.pAway - oA) ** 2;
  }
  return sum / details.length;
}

/** ランダム3択（各1/3）の Brier。常に 2/3 ≈ 0.667。 */
export function uniformBrier(): number {
  return (1 / 3 - 1) ** 2 + 2 * (1 / 3) ** 2; // = 0.6667
}

/**
 * Brier Skill Score = 1 - Brier_model / Brier_baseline。
 * 正なら baseline（ランダム）より良い。0.1〜0.2 出れば実用的に優秀。
 */
export function brierSkillScore(details: MatchAccuracy[]): number {
  const base = uniformBrier();
  if (base === 0) return 0;
  return 1 - brierScore(details) / base;
}

export interface ReliabilityBin {
  lo: number;
  hi: number;
  meanConfidence: number; // ビン内の平均「予測確信度」
  hitRate: number; // ビン内の実際の的中率
  count: number;
}

/**
 * 信頼度較正（reliability diagram）用のビン集計。
 * 予測した結果に与えた確率(confidence)でビン分けし、各ビンの平均確信度 vs 実的中率を返す。
 * よく較正されたモデルは meanConfidence ≈ hitRate（対角線上）。
 */
export function reliabilityBins(
  details: MatchAccuracy[],
  edges: number[] = [0.33, 0.45, 0.55, 0.65, 0.8, 1.0001]
): ReliabilityBin[] {
  const bins: ReliabilityBin[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const inBin = details.filter((d) => d.confidence >= lo && d.confidence < hi);
    if (inBin.length === 0) {
      bins.push({ lo, hi, meanConfidence: (lo + hi) / 2, hitRate: 0, count: 0 });
      continue;
    }
    const meanConfidence = inBin.reduce((s, d) => s + d.confidence, 0) / inBin.length;
    const hitRate = inBin.filter((d) => d.hit).length / inBin.length;
    bins.push({ lo, hi, meanConfidence, hitRate, count: inBin.length });
  }
  return bins;
}

/** walk-forward 順に、各試合時点での累積的中率を返す（推移グラフ用） */
export function cumulativeAccuracy(details: MatchAccuracy[]): { n: number; rate: number }[] {
  const out: { n: number; rate: number }[] = [];
  let hits = 0;
  details.forEach((d, i) => {
    if (d.hit) hits++;
    out.push({ n: i + 1, rate: hits / (i + 1) });
  });
  return out;
}

export interface SkillSummary {
  brier: number;
  uniformBrier: number;
  skillScore: number; // BSS
  total: number;
}

export function skillSummary(details: MatchAccuracy[]): SkillSummary {
  return {
    brier: brierScore(details),
    uniformBrier: uniformBrier(),
    skillScore: brierSkillScore(details),
    total: details.length,
  };
}
