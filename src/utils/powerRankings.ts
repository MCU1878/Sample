// =============================================================================
// マルチソース・パワーランキング（アンサンブル）
// -----------------------------------------------------------------------------
// 「1つのランキングだけだと突っ込まれる」問題に対応するため、複数の独立した
// 強さ指標を正規化して加重平均し、合成パワー指数 powerQuality(code)∈[0,1] を作る。
//
//   合成指数 = Σ_s w_s · normalized_s(team)   （Σ w_s = 1）
//
// normalized_s は各ソースを全チームで min-max 正規化し「高い=強い」に揃えた値。
// initRatings() はこの合成指数を使うため、確率予測も答え合わせも同じ基準で動く。
//
// ★ ソースは RANKING_SOURCES に追加するだけで自動的にアンサンブルへ組み込まれる。
//   現在は実データとして保有する FIFAランキング・World Football Elo の2系統。
//   （他系統は data/externalRankings 等から供給して順次追加可能）
// =============================================================================

import { teams } from '../data';
import { EXTERNAL_RANKINGS } from '../data/externalRankings';

export interface RankingSource {
  key: string;
  label: string;        // 表示名（出典）
  weight: number;       // 加重（正規化前。合計1でなくてよい）
  higherIsBetter: boolean;
  /** チームコード → 生の数値（無いチームは undefined） */
  raw: (code: string) => number | undefined;
}

// ===== ソース定義 =====
// 外部ランキング（externalRankings.ts）から供給されるソースを動的に組み込む。
const externalSources: RankingSource[] = EXTERNAL_RANKINGS.map((r) => ({
  key: r.key,
  label: r.label,
  weight: r.weight,
  higherIsBetter: r.higherIsBetter,
  raw: (code: string) => r.values[code],
}));

export const RANKING_SOURCES: RankingSource[] = [
  {
    key: 'fifa',
    label: 'FIFAランキング',
    weight: 1.0,
    higherIsBetter: false, // 1位が最強（小さいほど良い）
    raw: (code) => teams[code]?.fifaRank,
  },
  {
    key: 'elo',
    label: 'World Football Elo',
    weight: 1.0,
    higherIsBetter: true, // 高いほど強い
    raw: (code) => teams[code]?.eloRating,
  },
  ...externalSources,
];

const ALL_CODES = Object.keys(teams);

// ===== 各ソースを [0,1] に正規化（min-max・向き補正込み） =====
interface SourceNorm {
  source: RankingSource;
  min: number;
  max: number;
}

const SOURCE_NORMS: SourceNorm[] = RANKING_SOURCES.map((source) => {
  const vals = ALL_CODES.map((c) => source.raw(c)).filter((v): v is number => typeof v === 'number');
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  return { source, min, max };
});

/** 1ソースの正規化値（0〜1, 高い=強い）。値が無ければ undefined */
function normalizedValue(sn: SourceNorm, code: string): number | undefined {
  const raw = sn.source.raw(code);
  if (typeof raw !== 'number') return undefined;
  const span = sn.max - sn.min;
  if (span <= 0) return 0.5;
  const t = (raw - sn.min) / span; // 0..1（生値の小→0, 大→1）
  return sn.source.higherIsBetter ? t : 1 - t; // 向きを「高い=強い」に揃える
}

export interface PowerBreakdown {
  code: string;
  quality: number; // 合成 [0,1]
  perSource: { key: string; label: string; normalized: number | undefined; raw: number | undefined }[];
}

/** チームの各ソース内訳（透明性のため・UI表示用） */
export function powerBreakdown(code: string): PowerBreakdown {
  const perSource = SOURCE_NORMS.map((sn) => ({
    key: sn.source.key,
    label: sn.source.label,
    normalized: normalizedValue(sn, code),
    raw: sn.source.raw(code),
  }));
  return { code, quality: powerQuality(code), perSource };
}

/**
 * 合成パワー指数 [0,1]（高いほど強い）。
 * 利用可能なソースのみを、その重みで加重平均する（欠損ソースは自動的に除外）。
 */
export function powerQuality(code: string): number {
  let wsum = 0;
  let acc = 0;
  for (const sn of SOURCE_NORMS) {
    const n = normalizedValue(sn, code);
    if (n === undefined) continue;
    acc += sn.source.weight * n;
    wsum += sn.source.weight;
  }
  if (wsum <= 0) return 0.5;
  return acc / wsum;
}

/** アンサンブルに実際に使われているソースの一覧（UI表示用） */
export function activeSources(): { key: string; label: string; weight: number }[] {
  return RANKING_SOURCES.map((s) => ({ key: s.key, label: s.label, weight: s.weight }));
}
