// =============================================================================
// 外部パワーランキング（実データ・2026年6月時点）
// -----------------------------------------------------------------------------
// FIFAランキング・World Football Elo（data.ts に保有）に加えて使う、独立した
// 強さ指標の実測値。powerRankings.ts のアンサンブルへ自動で組み込まれる。
//
// すべて公開されている実在のランキングの数値（出典は label と下記コメント参照）。
// 値が無いチームは省略（そのチームはそのソースを欠損として扱い、残りで平均する）。
//
// 出典:
//   - Opta Power Rankings (theanalyst.com, 0–100, 2026)
//   - Goal.com 2026 World Cup Power Rankings (1–48 序列)
//   - CBS Sports 2026 World Cup Power Rankings (序列)
//   - Bookmaker 優勝オッズ (Yahoo Sports / BetMGM, 2026年6月) → 対数強度
// =============================================================================

export interface ExternalRanking {
  key: string;
  label: string;
  weight: number;
  higherIsBetter: boolean;
  values: Record<string, number>;
}

// Opta Power Rankings（0–100, 高いほど強い）。GER/ECU/CIV/BIH は記事に数値なし→欠損。
const OPTA: Record<string, number> = {
  ESP: 100.0, ARG: 97.8, FRA: 96.8, ENG: 92.6, BRA: 90.5, COL: 90.1, NED: 88.7,
  POR: 87.0, CRO: 83.4, BEL: 83.3, URU: 82.6, MAR: 82.3, SUI: 81.9, JPN: 81.2,
  TUR: 78.2, NOR: 77.6, MEX: 77.2, IRN: 76.4, SEN: 76.1, AUS: 75.6, PAR: 75.4,
  AUT: 75.3, KOR: 74.6, USA: 73.1, ALG: 72.2, CAN: 71.7, SCO: 70.6, UZB: 70.4,
  CZE: 70.0, TUN: 68.3, PAN: 68.3, EGY: 67.7, COD: 65.0, SWE: 65.4, RSA: 64.8,
  IRQ: 63.2, JOR: 63.1, KSA: 61.7, NZL: 60.9, CPV: 59.8, GHA: 59.4, QAT: 59.2,
  HAI: 52.3, CUW: 45.7,
};

// Goal.com 2026 World Cup Power Rankings（序列 1=最強, 小さいほど強い）。全48チーム。
const GOAL: Record<string, number> = {
  ESP: 1, ARG: 2, FRA: 3, POR: 4, ENG: 5, GER: 6, BRA: 7, BEL: 8, NED: 9, SUI: 10,
  SEN: 11, JPN: 12, NOR: 13, MAR: 14, CIV: 15, COL: 16, CRO: 17, AUT: 18, TUR: 19,
  USA: 20, EGY: 21, ECU: 22, SWE: 23, PAR: 24, URU: 25, MEX: 26, ALG: 27, SCO: 28,
  KOR: 29, CAN: 30, CZE: 31, BIH: 32, AUS: 33, RSA: 34, COD: 35, GHA: 36, UZB: 37,
  TUN: 38, CPV: 39, KSA: 40, IRN: 41, HAI: 42, IRQ: 43, QAT: 44, JOR: 45, NZL: 46,
  PAN: 47, CUW: 48,
};

// CBS Sports 2026 World Cup Power Rankings（序列, 小さいほど強い）。上位帯のみ掲載→一部欠損。
const CBS: Record<string, number> = {
  ESP: 1, FRA: 2, ARG: 3, BRA: 4, POR: 5, ENG: 6, URU: 7, MAR: 8, NED: 9, GER: 10,
  NOR: 11, EGY: 12, JPN: 13, ECU: 15, BEL: 16, KOR: 17, MEX: 18, COL: 20, CRO: 21,
  CIV: 22, ALG: 23, PAR: 24, IRN: 25, CAN: 26, USA: 27, AUS: 28, SWE: 29, SEN: 30,
  UZB: 31, JOR: 32, NZL: 33,
};

// Bookmaker 優勝オッズ → 対数強度 ln(1/decimal odds)（高い=強い）。全48チーム。
// 元オッズ(米国式/分数) を10進オッズに直し対数化。例: +450→5.5→-1.70, 2500/1→2501→-7.82
const ODDS: Record<string, number> = {
  FRA: -1.70, ESP: -1.70, ENG: -2.08, POR: -2.08, ARG: -2.30, BRA: -2.30,
  GER: -2.71, NED: -2.94, BEL: -3.53, NOR: -3.53, USA: -3.53, COL: -3.71,
  MAR: -3.71, MEX: -3.93, JPN: -3.93, SUI: -4.20, URU: -4.20, CRO: -4.39,
  SEN: -4.39, SWE: -4.39, AUS: -4.62, ECU: -4.62, CIV: -4.62, TUR: -4.84,
  AUT: -5.02, CAN: -5.02, SCO: -5.02, KOR: -5.30, ALG: -5.53, BIH: -5.53,
  EGY: -5.53, CZE: -5.71, PAR: -5.71, GHA: -6.22, IRN: -6.22, COD: -6.62,
  TUN: -6.62, CPV: -6.91, IRQ: -6.91, JOR: -6.91, NZL: -6.91, PAN: -6.91,
  QAT: -6.91, KSA: -6.91, RSA: -6.91, UZB: -6.91, CUW: -7.82, HAI: -7.82,
};

export const EXTERNAL_RANKINGS: ExternalRanking[] = [
  { key: 'opta', label: 'Opta Power Rankings', weight: 1.0, higherIsBetter: true, values: OPTA },
  { key: 'goal', label: 'Goal.com 2026 ランキング', weight: 1.0, higherIsBetter: false, values: GOAL },
  { key: 'cbs', label: 'CBS Sports 2026 ランキング', weight: 1.0, higherIsBetter: false, values: CBS },
  { key: 'odds', label: 'ブックメーカー優勝オッズ', weight: 1.0, higherIsBetter: true, values: ODDS },
];
