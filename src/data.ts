import type { Team, Match } from './types';

// 国旗画像URL生成 (flagcdn.com)
export function getFlagUrl(iso: string, size = 40): string {
  return `https://flagcdn.com/w${size}/${iso}.png`;
}

export const teams: Record<string, Team> = {
  // グループA
  MEX: { name: 'メキシコ', code: 'MEX', flag: '🇲🇽', iso: 'mx', fifaRank: 15, eloRating: 1881, climateAdaptation: 'high_altitude' },
  KOR: { name: '韓国', code: 'KOR', flag: '🇰🇷', iso: 'kr', fifaRank: 25, eloRating: 1786, climateAdaptation: 'temperate' },
  RSA: { name: '南アフリカ', code: 'RSA', flag: '🇿🇦', iso: 'za', fifaRank: 60, eloRating: 1511, climateAdaptation: 'temperate' },
  CZE: { name: 'チェコ', code: 'CZE', flag: '🇨🇿', iso: 'cz', fifaRank: 41, eloRating: 1712, climateAdaptation: 'temperate' },

  // グループB
  CAN: { name: 'カナダ', code: 'CAN', flag: '🇨🇦', iso: 'ca', fifaRank: 30, eloRating: 1788, climateAdaptation: 'temperate' },
  SUI: { name: 'スイス', code: 'SUI', flag: '🇨🇭', iso: 'ch', fifaRank: 19, eloRating: 1891, climateAdaptation: 'temperate' },
  QAT: { name: 'カタール', code: 'QAT', flag: '🇶🇦', iso: 'qa', fifaRank: 55, eloRating: 1600, climateAdaptation: 'desert' },
  BIH: { name: 'ボスニア・ヘルツェゴビナ', code: 'BIH', flag: '🇧🇦', iso: 'ba', fifaRank: 65, eloRating: 1595, climateAdaptation: 'temperate' },

  // グループC
  BRA: { name: 'ブラジル', code: 'BRA', flag: '🇧🇷', iso: 'br', fifaRank: 6, eloRating: 1991, climateAdaptation: 'tropical' },
  MAR: { name: 'モロッコ', code: 'MAR', flag: '🇲🇦', iso: 'ma', fifaRank: 8, eloRating: 1827, climateAdaptation: 'desert' },
  SCO: { name: 'スコットランド', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', iso: 'gb-sct', fifaRank: 43, eloRating: 1782, climateAdaptation: 'temperate' },
  HAI: { name: 'ハイチ', code: 'HAI', flag: '🇭🇹', iso: 'ht', fifaRank: 83, eloRating: 1548, climateAdaptation: 'tropical' },

  // グループD
  USA: { name: 'アメリカ', code: 'USA', flag: '🇺🇸', iso: 'us', fifaRank: 16, eloRating: 1726, climateAdaptation: 'temperate' },
  AUS: { name: 'オーストラリア', code: 'AUS', flag: '🇦🇺', iso: 'au', fifaRank: 27, eloRating: 1777, climateAdaptation: 'temperate' },
  PAR: { name: 'パラグアイ', code: 'PAR', flag: '🇵🇾', iso: 'py', fifaRank: 40, eloRating: 1834, climateAdaptation: 'tropical' },
  TUR: { name: 'トルコ', code: 'TUR', flag: '🇹🇷', iso: 'tr', fifaRank: 22, eloRating: 1911, climateAdaptation: 'temperate' },

  // グループE
  GER: { name: 'ドイツ', code: 'GER', flag: '🇩🇪', iso: 'de', fifaRank: 10, eloRating: 1932, climateAdaptation: 'temperate' },
  ECU: { name: 'エクアドル', code: 'ECU', flag: '🇪🇨', iso: 'ec', fifaRank: 23, eloRating: 1938, climateAdaptation: 'high_altitude' },
  CIV: { name: 'コートジボワール', code: 'CIV', flag: '🇨🇮', iso: 'ci', fifaRank: 34, eloRating: 1695, climateAdaptation: 'tropical' },
  CUW: { name: 'キュラソー', code: 'CUW', flag: '🇨🇼', iso: 'cw', fifaRank: 82, eloRating: 1434, climateAdaptation: 'tropical' },

  // グループF
  NED: { name: 'オランダ', code: 'NED', flag: '🇳🇱', iso: 'nl', fifaRank: 7, eloRating: 1948, climateAdaptation: 'temperate' },
  JPN: { name: '日本', code: 'JPN', flag: '🇯🇵', iso: 'jp', fifaRank: 18, eloRating: 1906, climateAdaptation: 'temperate' },
  TUN: { name: 'チュニジア', code: 'TUN', flag: '🇹🇳', iso: 'tn', fifaRank: 44, eloRating: 1628, climateAdaptation: 'desert' },
  SWE: { name: 'スウェーデン', code: 'SWE', flag: '🇸🇪', iso: 'se', fifaRank: 38, eloRating: 1712, climateAdaptation: 'temperate' },

  // グループG
  BEL: { name: 'ベルギー', code: 'BEL', flag: '🇧🇪', iso: 'be', fifaRank: 9, eloRating: 1894, climateAdaptation: 'temperate' },
  IRN: { name: 'イラン', code: 'IRN', flag: '🇮🇷', iso: 'ir', fifaRank: 21, eloRating: 1772, climateAdaptation: 'desert' },
  EGY: { name: 'エジプト', code: 'EGY', flag: '🇪🇬', iso: 'eg', fifaRank: 29, eloRating: 1696, climateAdaptation: 'desert' },
  NZL: { name: 'ニュージーランド', code: 'NZL', flag: '🇳🇿', iso: 'nz', fifaRank: 85, eloRating: 1562, climateAdaptation: 'temperate' },

  // グループH
  ESP: { name: 'スペイン', code: 'ESP', flag: '🇪🇸', iso: 'es', fifaRank: 2, eloRating: 2157, climateAdaptation: 'temperate' },
  URU: { name: 'ウルグアイ', code: 'URU', flag: '🇺🇾', iso: 'uy', fifaRank: 17, eloRating: 1892, climateAdaptation: 'temperate' },
  KSA: { name: 'サウジアラビア', code: 'KSA', flag: '🇸🇦', iso: 'sa', fifaRank: 61, eloRating: 1576, climateAdaptation: 'desert' },
  CPV: { name: 'カーボベルデ', code: 'CPV', flag: '🇨🇻', iso: 'cv', fifaRank: 69, eloRating: 1578, climateAdaptation: 'tropical' },

  // グループI
  FRA: { name: 'フランス', code: 'FRA', flag: '🇫🇷', iso: 'fr', fifaRank: 1, eloRating: 2063, climateAdaptation: 'temperate' },
  SEN: { name: 'セネガル', code: 'SEN', flag: '🇸🇳', iso: 'sn', fifaRank: 14, eloRating: 1860, climateAdaptation: 'tropical' },
  NOR: { name: 'ノルウェー', code: 'NOR', flag: '🇳🇴', iso: 'no', fifaRank: 31, eloRating: 1914, climateAdaptation: 'temperate' },
  IRQ: { name: 'イラク', code: 'IRQ', flag: '🇮🇶', iso: 'iq', fifaRank: 57, eloRating: 1607, climateAdaptation: 'desert' },

  // グループJ
  ARG: { name: 'アルゼンチン', code: 'ARG', flag: '🇦🇷', iso: 'ar', fifaRank: 3, eloRating: 2115, climateAdaptation: 'temperate' },
  AUT: { name: 'オーストリア', code: 'AUT', flag: '🇦🇹', iso: 'at', fifaRank: 24, eloRating: 1830, climateAdaptation: 'temperate' },
  ALG: { name: 'アルジェリア', code: 'ALG', flag: '🇩🇿', iso: 'dz', fifaRank: 28, eloRating: 1772, climateAdaptation: 'desert' },
  JOR: { name: 'ヨルダン', code: 'JOR', flag: '🇯🇴', iso: 'jo', fifaRank: 63, eloRating: 1680, climateAdaptation: 'desert' },

  // グループK
  POR: { name: 'ポルトガル', code: 'POR', flag: '🇵🇹', iso: 'pt', fifaRank: 5, eloRating: 1989, climateAdaptation: 'temperate' },
  COL: { name: 'コロンビア', code: 'COL', flag: '🇨🇴', iso: 'co', fifaRank: 13, eloRating: 1982, climateAdaptation: 'high_altitude' },
  UZB: { name: 'ウズベキスタン', code: 'UZB', flag: '🇺🇿', iso: 'uz', fifaRank: 50, eloRating: 1714, climateAdaptation: 'desert' },
  COD: { name: 'DRコンゴ', code: 'COD', flag: '🇨🇩', iso: 'cd', fifaRank: 46, eloRating: 1652, climateAdaptation: 'tropical' },

  // グループL
  ENG: { name: 'イングランド', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', iso: 'gb-eng', fifaRank: 4, eloRating: 2024, climateAdaptation: 'temperate' },
  CRO: { name: 'クロアチア', code: 'CRO', flag: '🇭🇷', iso: 'hr', fifaRank: 11, eloRating: 1912, climateAdaptation: 'temperate' },
  PAN: { name: 'パナマ', code: 'PAN', flag: '🇵🇦', iso: 'pa', fifaRank: 33, eloRating: 1730, climateAdaptation: 'tropical' },
  GHA: { name: 'ガーナ', code: 'GHA', flag: '🇬🇭', iso: 'gh', fifaRank: 74, eloRating: 1510, climateAdaptation: 'tropical' },
};

export const groupTeams: Record<string, string[]> = {
  A: ['MEX', 'KOR', 'RSA', 'CZE'],
  B: ['CAN', 'SUI', 'QAT', 'BIH'],
  C: ['BRA', 'MAR', 'SCO', 'HAI'],
  D: ['USA', 'AUS', 'PAR', 'TUR'],
  E: ['GER', 'ECU', 'CIV', 'CUW'],
  F: ['NED', 'JPN', 'TUN', 'SWE'],
  G: ['BEL', 'IRN', 'EGY', 'NZL'],
  H: ['ESP', 'URU', 'KSA', 'CPV'],
  I: ['FRA', 'SEN', 'NOR', 'IRQ'],
  J: ['ARG', 'AUT', 'ALG', 'JOR'],
  K: ['POR', 'COL', 'UZB', 'COD'],
  L: ['ENG', 'CRO', 'PAN', 'GHA'],
};

export const groupClimates: Record<string, 'temperate' | 'hot_humid' | 'hot_dry' | 'high_altitude'> = {
  A: 'high_altitude', // メキシコ（高地）
  B: 'temperate',     // カナダ（温暖）
  C: 'hot_humid',     // マイアミ・アトランタ（高温多湿）
  D: 'hot_dry',       // LA・SF（高温乾燥）
  E: 'hot_humid',     // ヒューストン・モンテレイ（高温多湿）
  F: 'hot_dry',       // ダラス（高温乾燥）
  G: 'temperate',     // ニューヨーク（温暖・夏）
  H: 'high_altitude', // メキシコシティ（高地）
  I: 'temperate',     // ボストン・トロント（温暖）
  J: 'hot_humid',     // カンザスシティ（高温多湿）
  K: 'high_altitude', // グアダラハラ（高地）
  L: 'temperate',     // シアトル（温暖）
};

// ===== グループステージ日程 =====
import { officialMatches } from './official_schedule';

export function createInitialMatches(): Match[] {
  // officialMatches をコピーして初期状態の試合データとして返す
  return officialMatches.map((match) => ({
    ...match,
    climate: match.group ? groupClimates[match.group] || 'temperate' : 'temperate',
    homeScore: null,
    awayScore: null,
  }));
}

// ポアソン乱数生成（Knuthのアルゴリズム）
function poissonRandom(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// チームの実力差を考慮して試合スコアをシミュレートする (FIFAランキング使用モデル)
export function simulateMatchScore(homeTeamCode: string, awayTeamCode: string): { homeScore: number; awayScore: number } {
  const homeTeam = teams[homeTeamCode];
  const awayTeam = teams[awayTeamCode];

  // ランキングデフォルト値は 80位 とする
  const homeRank = homeTeam?.fifaRank ?? 80;
  const awayRank = awayTeam?.fifaRank ?? 80;

  // ランキングは値が「小さい」ほど強い。
  // 実力差 diff = awayRank - homeRank (ホームが強いほど diff はプラス)
  const diff = awayRank - homeRank;

  // 基本得点期待値 λ=1.35。実力差が 60 で期待値が ±1.0 調整される
  let homeLambda = 1.35 + (diff / 60);
  let awayLambda = 1.35 - (diff / 60);

  // 期待値の下限・上限を設定 (0.1〜3.8)
  homeLambda = Math.max(0.1, Math.min(3.8, homeLambda));
  awayLambda = Math.max(0.1, Math.min(3.8, awayLambda));

  return {
    homeScore: poissonRandom(homeLambda),
    awayScore: poissonRandom(awayLambda),
  };
}
