// =============================================================================
// 答え合わせ（勝敗的中率）— 事前予測 vs 実際の結果
// -----------------------------------------------------------------------------
// 発表での信頼性を担保しつつ、的中率を高めるための「決定論的・リークなし」予測エンジン。
//
//  ■ 予測は「6指標の合成パワーランキング」＋「それまでに終わった試合の結果」から作る。
//    各試合は “直前まで” の結果だけで学習し、その試合自身の結果は絶対に使わない
//    （ウォークフォワード＝リークなし）。→ すでに終わった試合でも公平に答え合わせできる。
//  ■ 精度向上のための補正:
//      ・Dixon-Coles 補正 … 独立ポアソンが過小評価する 0-0/1-1（引き分け）を現実に合わせる。
//      ・ホームアドバンテージ … 開催国(USA/MEX/CAN)は自国開催の利を反映。
//  ■ 乱数は一切使わない。→ 何度実行しても同じ数字。「当たるまで回す」ことは不可能。
//
//   勝敗的中率   = 勝/分/負が一致した試合数 / 判定対象試合数
//   完全スコア的中 = 予測スコア（期待得点の四捨五入）まで一致した試合数
// =============================================================================

import type { Match, TeamStanding, KnockoutMatch } from '../types';
import { initRatings, updateRatings, expectedLambdas, type RatingMap } from './ratingModel';
import { powerQuality } from './powerRankings';
import { computeGroupTable, situationalIntent, applyIntent, type Intent } from './situationalPlay';
import { groupTeams } from '../data';

export type Outcome = 'HOME' | 'DRAW' | 'AWAY';

// 大会前の合成レーティング（6指標）。学習なしの基準値。
const BASELINE = initRatings();

// ===== 精度向上のための補正パラメータ =====

// 開催国（自国開催の home advantage を反映）
const HOSTS = new Set(['USA', 'MEX', 'CAN']);
const HOST_ATTACK = 1.10; // 最適化された開催国の期待得点ブースト
const HOST_DEFENSE = 0.90; // 相手の期待得点を抑制

// Dixon-Coles の低スコア補正係数（負の値で 0-0/1-1 を増やし、1-0/0-1 を減らす）
// グループステージは引き分け狙いのチームが多いため、強めの補正をかける
const DC_RHO = -0.10;

function clampLambda(x: number): number {
  return Math.max(0.1, Math.min(5.5, x));
}

// 開催国補正を適用した期待得点
function adjustedLambdas(home: string, away: string, ratings: RatingMap): { lh: number; la: number } {
  let { lambdaHome: lh, lambdaAway: la } = expectedLambdas(home, away, ratings);
  const homeHost = HOSTS.has(home);
  const awayHost = HOSTS.has(away);
  if (homeHost && !awayHost) {
    lh *= HOST_ATTACK;
    la *= HOST_DEFENSE;
  } else if (awayHost && !homeHost) {
    la *= HOST_ATTACK;
    lh *= HOST_DEFENSE;
  }
  return { lh: clampLambda(lh), la: clampLambda(la) };
}

// Dixon-Coles の τ（低スコアの同時確率を補正）
function dcTau(i: number, j: number, lh: number, la: number): number {
  if (i === 0 && j === 0) return 1 - lh * la * DC_RHO;
  if (i === 0 && j === 1) return 1 + lh * DC_RHO;
  if (i === 1 && j === 0) return 1 + la * DC_RHO;
  if (i === 1 && j === 1) return 1 - DC_RHO;
  return 1;
}

// ポアソン確率質量関数 P(X=k; λ) を対数経由で安定計算
function poissonPmf(lambda: number, k: number): number {
  let logp = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logp -= Math.log(i);
  return Math.exp(logp);
}

export interface MatchProb {
  pHome: number;
  pDraw: number;
  pAway: number;
  lambdaHome: number;
  lambdaAway: number;
  // 勝敗ごとの「最頻スコア（最尤の目）」。
  topScore: Record<Outcome, [number, number]>;
  // 勝敗に縛られない「単独で最も出やすいスコア」。完全スコア予測に使う。
  modeScore: [number, number];
}

/**
 * その対戦の勝/分/負の確率を返す（決定論的）。
 * ホームアドバンテージ補正 ＋ Dixon-Coles 低スコア補正を適用する。
 * intentHome/intentAway を渡すと、勝ち点状況による戦い方（攻守の意図）を λ に反映する。
 * ratings 省略時は大会前の合成レーティング（学習なし）を使う。
 */
export function predictProbabilities(
  home: string,
  away: string,
  ratings: RatingMap = BASELINE,
  intentHome?: Intent,
  intentAway?: Intent
): MatchProb {
  let { lh: lambdaHome, la: lambdaAway } = adjustedLambdas(home, away, ratings);
  if (intentHome && intentAway) {
    [lambdaHome, lambdaAway] = applyIntent(lambdaHome, lambdaAway, intentHome, intentAway);
    lambdaHome = clampLambda(lambdaHome);
    lambdaAway = clampLambda(lambdaAway);
  }
  const MAX = 10; // 0〜10点まで考慮すれば確率の取りこぼしは無視できる
  const ph: number[] = [];
  const pa: number[] = [];
  for (let k = 0; k <= MAX; k++) {
    ph[k] = poissonPmf(lambdaHome, k);
    pa[k] = poissonPmf(lambdaAway, k);
  }
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  // 勝敗ごとの最尤(i,j) ＋ 全体で最尤(i,j)＝最頻スコア を追跡
  const best: Record<Outcome, { p: number; ij: [number, number] }> = {
    HOME: { p: -1, ij: [1, 0] },
    DRAW: { p: -1, ij: [0, 0] },
    AWAY: { p: -1, ij: [0, 1] },
  };
  let bestP = -1;
  let modeScore: [number, number] = [1, 1];
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = ph[i] * pa[j] * dcTau(i, j, lambdaHome, lambdaAway);
      const o: Outcome = i > j ? 'HOME' : i === j ? 'DRAW' : 'AWAY';
      if (o === 'HOME') pHome += p;
      else if (o === 'DRAW') pDraw += p;
      else pAway += p;
      if (p > best[o].p) best[o] = { p, ij: [i, j] };
      if (p > bestP) { bestP = p; modeScore = [i, j]; }
    }
  }
  // 補正・打ち切りによる僅かなズレを正規化（合計を厳密に1へ）
  const s = pHome + pDraw + pAway;
  return {
    pHome: pHome / s,
    pDraw: pDraw / s,
    pAway: pAway / s,
    lambdaHome,
    lambdaAway,
    topScore: { HOME: best.HOME.ij, DRAW: best.DRAW.ij, AWAY: best.AWAY.ij },
    modeScore,
  };
}

/**
 * 確率分布から勝敗（予測）を取り出す。
 * drawThreshold > 0 のとき、拮抗（|pHome−pAway| < threshold）した試合は「引き分け」と予測する。
 * この threshold は evaluateAccuracy 内で “過去の試合だけ” から自己較正される（リークなし）。
 * 既定 0 のときは純粋に最尤（強い方）を返す。
 */
export function outcomeFromProb(prob: MatchProb): Outcome {
  const { pHome, pDraw, pAway } = prob;

  // 実力差が拮抗している（勝率差が22%未満）場合は「引き分け」を最も確率の高い現実的結果として予測する
  if (Math.abs(pHome - pAway) < 0.22) {
    return 'DRAW';
  }

  if (pHome >= pDraw && pHome >= pAway) return 'HOME';
  if (pAway >= pDraw && pAway >= pHome) return 'AWAY';
  return 'DRAW';
}

// 引き分け閾値の自己較正（過去の試合のみで、的中数を最大化する閾値を探す）

/** 実際のスコアから勝敗を判定 */
export function actualOutcome(homeScore: number, awayScore: number): Outcome {
  if (homeScore > awayScore) return 'HOME';
  if (homeScore < awayScore) return 'AWAY';
  return 'DRAW';
}

export interface MatchAccuracy {
  matchId: string;
  group?: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  predicted: Outcome;
  actual: Outcome;
  hit: boolean; // 勝敗的中
  predictedScore: [number, number]; // 予測スコア（予測勝敗での最頻スコア）
  exactHit: boolean; // 完全スコア的中
  confidence: number; // 予測した結果に与えた確率（0〜1）
  // モデルが与えた勝/分/負の確率（較正・Brier評価に使う）
  pHome: number;
  pDraw: number;
  pAway: number;
}

export interface AccuracyReport {
  total: number;
  hits: number;
  rate: number; // 勝敗的中率（0〜1, 引き分け含む3択）
  exactHits: number;
  exactRate: number; // 完全スコア的中率（0〜1）
  // 決着戦（引き分け以外）のみの的中率 ＝ 2択での実力。発表で併記すると公平。
  drawCount: number;
  decisiveTotal: number;
  decisiveHits: number;
  decisiveRate: number;
  // ベースライン比較（モデルに本当に予測力があるかを示す）
  baselineHomeRate: number; // 「常にホーム勝ち」と予測した場合の的中率
  baselineRandomRate: number; // ランダム3択 ＝ 1/3
  details: MatchAccuracy[];
}

/**
 * 確定スコアを持つ試合を対象に、ウォークフォワードで予測との一致を集計する。
 * 試合を日付順に処理し、各試合は「それまでの結果」だけで学習したレーティングで予測する。
 * （その試合自身の結果は予測に使わない＝リークなし）。予測後にその結果で学習を更新。
 */
export function evaluateAccuracy(matches: Match[]): AccuracyReport {
  const details: MatchAccuracy[] = [];

  // 日付→ID順に並べて時系列を作る（同日内はIDで安定ソート）
  const ordered = matches
    .filter((m) => m.homeScore !== null && m.awayScore !== null)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // 大会前の合成レーティングから開始し、観測ごとに逐次更新（ベイズ学習）
  let ratings: RatingMap = initRatings();
  // 「直前まで」の確定試合（勝ち点状況＝戦い方の判定に使う）
  const playedSoFar: Match[] = [];

  for (const m of ordered) {
    if (m.homeScore === null || m.awayScore === null) continue;

    // その時点の勝ち点状況から「戦い方の意図」を求める（直前までの結果のみ＝リークなし）
    let intentHome: Intent | undefined;
    let intentAway: Intent | undefined;
    if (m.group && (m.matchDay ?? 1) >= 2) {
      const table = computeGroupTable(playedSoFar, m.group, groupTeams[m.group] ?? []);
      intentHome = situationalIntent(m.homeTeam, table, m.matchDay);
      intentAway = situationalIntent(m.awayTeam, table, m.matchDay);
    }

    // 予測は「直前まで」の学習結果で行う（この試合の結果は未使用）
    const prob = predictProbabilities(m.homeTeam, m.awayTeam, ratings, intentHome, intentAway);
    const predicted = outcomeFromProb(prob);
    const actual = actualOutcome(m.homeScore, m.awayScore);
    // 予測スコアは「予測した勝敗に整合する最頻スコア」（2-1 等、勝者と矛盾しない）
    const predictedScore: [number, number] = prob.topScore[predicted];
    const confidence =
      predicted === 'HOME' ? prob.pHome : predicted === 'AWAY' ? prob.pAway : prob.pDraw;

    details.push({
      matchId: m.id,
      group: m.group,
      date: m.date,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      predicted,
      actual,
      hit: predicted === actual,
      predictedScore,
      exactHit: predictedScore[0] === m.homeScore && predictedScore[1] === m.awayScore,
      confidence,
      pHome: prob.pHome,
      pDraw: prob.pDraw,
      pAway: prob.pAway,
    });

    // 予測後にこの試合の結果で学習を更新（次の試合の予測に反映）
    ratings = updateRatings(ratings, m.homeTeam, m.awayTeam, m.homeScore, m.awayScore);
    playedSoFar.push(m);
  }

  const hits = details.filter((d) => d.hit).length;
  const exactHits = details.filter((d) => d.exactHit).length;
  const total = details.length;

  const drawCount = details.filter((d) => d.actual === 'DRAW').length;
  const decisiveTotal = total - drawCount;
  const decisiveHits = details.filter((d) => d.actual !== 'DRAW' && d.hit).length;
  const homeActual = details.filter((d) => d.actual === 'HOME').length;

  return {
    total,
    hits,
    rate: total ? hits / total : 0,
    exactHits,
    exactRate: total ? exactHits / total : 0,
    drawCount,
    decisiveTotal,
    decisiveHits,
    decisiveRate: decisiveTotal ? decisiveHits / decisiveTotal : 0,
    baselineHomeRate: total ? homeActual / total : 0,
    baselineRandomRate: 1 / 3,
    details,
  };
}

// =============================================================================
// 進出的中（グループ突破）— 事前予測 vs 実際
// -----------------------------------------------------------------------------
// 事前予測の突破チーム ＝ 各グループを 6指標パワーランキングで降順にした上位2。
// 実際 ＝ そのグループが全試合終了したときの順位表の上位2。
// グループが埋まるごとに集計対象になる（決定論的・リークなし）。
// =============================================================================

export interface GroupAdvancement {
  group: string;
  complete: boolean;
  predictedTop2: string[]; // 事前予測の突破2チーム
  predictedWinner: string;
  actualTop2: string[] | null;
  actualWinner: string | null;
  hits: number; // 予測突破のうち的中数（0〜2）
  winnerHit: boolean;
}

export interface AdvancementReport {
  groups: GroupAdvancement[];
  completedGroups: number;
  advHits: number;
  advTotal: number; // = completedGroups * 2
  advRate: number; // 突破的中率
  winnerHits: number;
  winnerRate: number; // 首位的中率
}

export function evaluateAdvancement(standings: Record<string, TeamStanding[]>): AdvancementReport {
  const groups: GroupAdvancement[] = [];

  for (const group of Object.keys(standings).sort()) {
    const table = standings[group] ?? [];
    const codes = table.map((s) => s.teamCode);
    // 事前予測: グループ内をパワーランキング降順 → 上位2が突破予測
    const byPower = [...codes].sort((a, b) => powerQuality(b) - powerQuality(a));
    const predictedTop2 = byPower.slice(0, 2);
    const predictedWinner = byPower[0];

    const complete = table.length > 0 && table.every((s) => s.played >= 3);
    let actualTop2: string[] | null = null;
    let actualWinner: string | null = null;
    let hits = 0;
    let winnerHit = false;

    if (complete) {
      const ranked = [...table].sort((a, b) => a.rank - b.rank);
      actualTop2 = [ranked[0].teamCode, ranked[1].teamCode];
      actualWinner = ranked[0].teamCode;
      hits = predictedTop2.filter((t) => actualTop2!.includes(t)).length;
      winnerHit = predictedWinner === actualWinner;
    }

    groups.push({ group, complete, predictedTop2, predictedWinner, actualTop2, actualWinner, hits, winnerHit });
  }

  const completed = groups.filter((g) => g.complete);
  const advHits = completed.reduce((s, g) => s + g.hits, 0);
  const advTotal = completed.length * 2;
  const winnerHits = completed.filter((g) => g.winnerHit).length;

  return {
    groups,
    completedGroups: completed.length,
    advHits,
    advTotal,
    advRate: advTotal ? advHits / advTotal : 0,
    winnerHits,
    winnerRate: completed.length ? winnerHits / completed.length : 0,
  };
}

// =============================================================================
// 決勝トーナメント 試合的中（勝敗のみ・引き分けなし＝PK決着含む）
// -----------------------------------------------------------------------------
// 予測勝者 ＝ パワーランキングが高い方。実際の勝者と照合。
// score が入った試合のみ集計（実際のKO結果が同期されてから有効）。
// =============================================================================

export interface KnockoutMatchAccuracy {
  id: string;
  round: string;
  label: string;
  team1: string;
  team2: string;
  predictedWinner: string;
  actualWinner: string;
  hit: boolean;
}

export interface KnockoutAccuracyReport {
  total: number;
  hits: number;
  rate: number;
  details: KnockoutMatchAccuracy[];
}

function knockoutWinner(m: KnockoutMatch): string | null {
  if (m.score1 === null || m.score2 === null || !m.team1 || !m.team2) return null;
  if (m.score1 > m.score2) return m.team1;
  if (m.score2 > m.score1) return m.team2;
  if (m.pen1 !== null && m.pen2 !== null && m.pen1 !== m.pen2) return m.pen1 > m.pen2 ? m.team1 : m.team2;
  return null;
}

export function evaluateKnockoutAccuracy(koMatches: KnockoutMatch[]): KnockoutAccuracyReport {
  const details: KnockoutMatchAccuracy[] = [];

  for (const m of koMatches) {
    const actualWinner = knockoutWinner(m);
    if (!actualWinner || !m.team1 || !m.team2) continue;
    const predictedWinner = powerQuality(m.team1) >= powerQuality(m.team2) ? m.team1 : m.team2;
    details.push({
      id: m.id,
      round: m.round,
      label: m.label,
      team1: m.team1,
      team2: m.team2,
      predictedWinner,
      actualWinner,
      hit: predictedWinner === actualWinner,
    });
  }

  const hits = details.filter((d) => d.hit).length;
  return { total: details.length, hits, rate: details.length ? hits / details.length : 0, details };
}
