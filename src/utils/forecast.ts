// =============================================================================
// 予測エンジン（Phase 2a / 手法A×モンテカルロ）
// -----------------------------------------------------------------------------
// 入力済みのグループ結果は「固定」し、未消化の試合だけを
// ベイズ・レーティング(A)由来の期待得点 λ からポアソン標本化して大会を反復実行する。
// 各反復で「グループ完成 → 公式順位(タイブレーカー) → Annex CでR32 → ノックアウト解決」を回し、
// 各チームが到達したラウンドを集計して確率に変換する。
//
// ノックアウトは検証済みの公式ブラケット配線（KnockoutMatch.winnerGoesTo 等）をそのまま使い、
// 試合の勝敗のみを λ から標本化する。
// =============================================================================

import type { Match, KnockoutMatch } from '../types';
import { groupTeams } from '../data';
import { getAllGroupStandings } from './calculateStandings';
import { initializeKnockoutMatches } from './knockoutLogic';
import { fitRatings, expectedLambdas, type RatingMap } from './ratingModel';
import { computeGroupTable, situationalIntent, applyIntent, type Intent } from './situationalPlay';

// 決定論的 RNG は rng.ts に集約（再エクスポートで既存の import を維持）
export { mulberry32, seedFromString, rngFromKey, type Rng } from './rng';
import type { Rng } from './rng';

// ポアソン乱数（Knuth）。rng 注入で再現可能。
function poissonSample(lambda: number, rng: Rng): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/** Dixon-Coles 補正パラメータ（低スコア引き分けの確率を上方修正） */
const DIXON_COLES_RHO = 0.13;

/** Dixon-Coles モデルに基づくスコアサンプリング（勝ち点状況の意図を反映可能） */
function sampleScore(
  home: string,
  away: string,
  ratings: RatingMap,
  rng: Rng,
  intentHome?: Intent,
  intentAway?: Intent
): { gh: number; ga: number } {
  let { lambdaHome, lambdaAway } = expectedLambdas(home, away, ratings);
  // 勝ち点状況による戦い方（攻守の意図）を λ に反映
  if (intentHome && intentAway) {
    [lambdaHome, lambdaAway] = applyIntent(lambdaHome, lambdaAway, intentHome, intentAway);
    lambdaHome = Math.max(0.1, Math.min(5.5, lambdaHome));
    lambdaAway = Math.max(0.1, Math.min(5.5, lambdaAway));
  }

  // まず独立ポアソンでサンプリング
  let gh = poissonSample(lambdaHome, rng);
  let ga = poissonSample(lambdaAway, rng);
  
  // Dixon-Coles 補正: 低スコア (0-0, 1-1, 0-1, 1-0) の確率を調整
  // ρ > 0 のとき 0-0 と 1-1 (ドロー) を増やし、1-0 と 0-1 を減らす
  const rho = DIXON_COLES_RHO;
  if (gh === 0 && ga === 0) {
    // P(0,0) *= (1 + rho * lambdaHome * lambdaAway)
    // 既にサンプル済みなので、棄却法で補正
    // 0-0が出た → 受理率を高める（常に受理）
  } else if (gh === 1 && ga === 1) {
    // P(1,1) *= (1 + rho) → 常に受理
  } else if (gh === 1 && ga === 0) {
    // P(1,0) *= (1 - rho * lambdaAway) → 棄却して再サンプル
    if (rng() < rho * lambdaAway) {
      // 棄却 → 0-0 のドローに変更
      gh = 0;
    }
  } else if (gh === 0 && ga === 1) {
    // P(0,1) *= (1 - rho * lambdaHome) → 棄却して再サンプル  
    if (rng() < rho * lambdaHome) {
      // 棄却 → 0-0 のドローに変更
      ga = 0;
    }
  }
  
  return { gh, ga };
}

// チーム総合力（攻撃平均＋守備平均、ともに高い=強い）。PK決着の重み付けに使う。
function strength(code: string, ratings: RatingMap): number {
  const r = ratings[code];
  return r ? r.attack.mean + r.defense.mean : 0;
}

/** ノックアウト1試合: 勝者を返す（同点はレーティング重みのPKで決着） */
function playKnockout(
  home: string,
  away: string,
  ratings: RatingMap,
  rng: Rng
): string {
  // 決勝トーナメントは「引き分け狙い」がないため、Dixon-Coles補正を使わず純粋なポアソンで判定。
  // また、延長戦の可能性を含めるため、期待得点（ラムダ）を 120分換算（約1.33倍）にする。
  const { lambdaHome, lambdaAway } = expectedLambdas(home, away, ratings);
  const lh = lambdaHome * 1.33;
  const la = lambdaAway * 1.33;
  
  const gh = poissonSample(lh, rng);
  const ga = poissonSample(la, rng);

  if (gh > ga) return home;
  if (ga > gh) return away;

  // PK戦または延長戦での競り合い：選手層（ベンチワーク）や個人の質がモロに出るため、
  // 強豪国が圧倒的に有利になるよう係数（Sensitivity）を 0.3 -> 0.8 に引き上げ。
  const d = strength(home, ratings) - strength(away, ratings);
  const pHome = 1 / (1 + Math.exp(-0.8 * d)); 
  return rng() < pHome ? home : away;
}

export interface ForecastResult {
  iterations: number;
  // teamCode -> 各到達確率(0〜1)
  champion: Record<string, number>;
  final: Record<string, number>;
  semifinal: Record<string, number>;   // ベスト4
  quarterfinal: Record<string, number>; // ベスト8
  roundOf16: Record<string, number>;
  roundOf32: Record<string, number>;    // 決勝トーナメント進出（=グループ突破）
}

const ALL_TEAMS: string[] = Object.values(groupTeams).flat();

function emptyTally(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const t of ALL_TEAMS) o[t] = 0;
  return o;
}

/**
 * 現在のグループ結果から大会を N 回シミュレートし、各チームの到達確率を返す。
 * @param matches 全グループ試合（スコア入力済みは固定、null は標本化）
 * @param options.iterations 反復回数（既定 10000）
 * @param options.rng 乱数（既定 Math.random）
 */
export function runForecast(
  matches: Match[],
  options: { iterations?: number; rng?: Rng } = {}
): ForecastResult {
  const N = options.iterations ?? 10000;
  const rng = options.rng ?? Math.random;

  // 1. 入力済み結果からレーティングを学習（反復の外で1回）
  const played: [string, string, number, number][] = [];
  for (const m of matches) {
    if (m.homeScore !== null && m.awayScore !== null) {
      played.push([m.homeTeam, m.awayTeam, m.homeScore, m.awayScore]);
    }
  }
  const ratings = fitRatings(played);

  const champion = emptyTally();
  const final = emptyTally();
  const semifinal = emptyTally();
  const quarterfinal = emptyTally();
  const roundOf16 = emptyTally();
  const roundOf32 = emptyTally();

  // 未消化のグループ試合（節順に処理して、勝ち点状況→戦い方を反映する）
  const unplayed = matches.filter((m) => m.homeScore === null || m.awayScore === null);
  const playedMatches = matches.filter((m) => m.homeScore !== null && m.awayScore !== null);
  const GROUP_CODES = Object.keys(groupTeams);

  for (let n = 0; n < N; n++) {
    // 2. グループステージを節(1→2→3)順に完成させる
    const completed: Match[] = playedMatches.slice();
    for (const md of [1, 2, 3]) {
      const mdMatches = unplayed.filter((m) => (m.matchDay ?? 1) === md);
      // 第2/3節は、直前までの勝ち点表から各チームの戦い方を決める
      let tables: Record<string, ReturnType<typeof computeGroupTable>> | null = null;
      if (md >= 2) {
        tables = {};
        for (const g of GROUP_CODES) tables[g] = computeGroupTable(completed, g, groupTeams[g]);
      }
      for (const m of mdMatches) {
        let iH: Intent | undefined;
        let iA: Intent | undefined;
        if (tables && m.group) {
          const t = tables[m.group] ?? [];
          iH = situationalIntent(m.homeTeam, t, md);
          iA = situationalIntent(m.awayTeam, t, md);
        }
        const { gh, ga } = sampleScore(m.homeTeam, m.awayTeam, ratings, rng, iH, iA);
        completed.push({ ...m, homeScore: gh, awayScore: ga });
      }
    }

    // 3. 公式順位 → R32（Annex C）
    const standings = getAllGroupStandings(completed, groupTeams);
    const ko: KnockoutMatch[] = initializeKnockoutMatches(standings);
    const byId: Record<string, KnockoutMatch> = {};
    for (const m of ko) byId[m.id] = { ...m };

    // 4. ノックアウトを試合番号順に解決（公式配線をそのまま使用）
    const ordered = Object.values(byId).sort((a, b) => a.matchNumber - b.matchNumber);

    // R32進出＝グループ突破の集計（R32の出場32チーム）
    for (const m of ordered) {
      if (m.round === 'R32') {
        if (m.team1) roundOf32[m.team1] += 1;
        if (m.team2) roundOf32[m.team2] += 1;
      }
    }

    for (const m of ordered) {
      const cur = byId[m.id];
      if (!cur.team1 || !cur.team2) continue;
      const winner = playKnockout(cur.team1, cur.team2, ratings, rng);
      const loser = winner === cur.team1 ? cur.team2 : cur.team1;

      // 勝者の到達ラウンドを集計（=次に進むラウンドの出場権）
      if (cur.round === 'R32') roundOf16[winner] += 1;
      else if (cur.round === 'R16') quarterfinal[winner] += 1;
      else if (cur.round === 'QF') semifinal[winner] += 1;
      else if (cur.round === 'SF') final[winner] += 1;
      else if (cur.round === 'FINAL') champion[winner] += 1;

      // 勝者・敗者を次の試合スロットへ伝播
      if (cur.winnerGoesTo && cur.winnerSlot) byId[cur.winnerGoesTo][cur.winnerSlot] = winner;
      if (cur.loserGoesTo && cur.loserSlot) byId[cur.loserGoesTo][cur.loserSlot] = loser;
    }
  }

  // 5. 正規化
  const norm = (o: Record<string, number>) => {
    const r: Record<string, number> = {};
    for (const t of ALL_TEAMS) r[t] = o[t] / N;
    return r;
  };

  return {
    iterations: N,
    champion: norm(champion),
    final: norm(final),
    semifinal: norm(semifinal),
    quarterfinal: norm(quarterfinal),
    roundOf16: norm(roundOf16),
    roundOf32: norm(roundOf32),
  };
}
