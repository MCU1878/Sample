import type { Team, Match } from './types';

// 国旗画像URL生成 (flagcdn.com)
export function getFlagUrl(iso: string, size = 40): string {
  return `https://flagcdn.com/w${size}/${iso}.png`;
}

export const teams: Record<string, Team> = {
  // グループA
  MEX: { name: 'メキシコ', code: 'MEX', flag: '🇲🇽', iso: 'mx', fifaRank: 15 },
  KOR: { name: '韓国', code: 'KOR', flag: '🇰🇷', iso: 'kr', fifaRank: 25 },
  RSA: { name: '南アフリカ', code: 'RSA', flag: '🇿🇦', iso: 'za', fifaRank: 60 },
  CZE: { name: 'チェコ', code: 'CZE', flag: '🇨🇿', iso: 'cz', fifaRank: 41 },

  // グループB
  CAN: { name: 'カナダ', code: 'CAN', flag: '🇨🇦', iso: 'ca', fifaRank: 30 },
  SUI: { name: 'スイス', code: 'SUI', flag: '🇨🇭', iso: 'ch', fifaRank: 19 },
  QAT: { name: 'カタール', code: 'QAT', flag: '🇶🇦', iso: 'qa', fifaRank: 55 },
  BIH: { name: 'ボスニア・ヘルツェゴビナ', code: 'BIH', flag: '🇧🇦', iso: 'ba', fifaRank: 65 },

  // グループC
  BRA: { name: 'ブラジル', code: 'BRA', flag: '🇧🇷', iso: 'br', fifaRank: 6 },
  MAR: { name: 'モロッコ', code: 'MAR', flag: '🇲🇦', iso: 'ma', fifaRank: 8 },
  SCO: { name: 'スコットランド', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', iso: 'gb-sct', fifaRank: 43 },
  HAI: { name: 'ハイチ', code: 'HAI', flag: '🇭🇹', iso: 'ht', fifaRank: 83 },

  // グループD
  USA: { name: 'アメリカ', code: 'USA', flag: '🇺🇸', iso: 'us', fifaRank: 16 },
  AUS: { name: 'オーストラリア', code: 'AUS', flag: '🇦🇺', iso: 'au', fifaRank: 27 },
  PAR: { name: 'パラグアイ', code: 'PAR', flag: '🇵🇾', iso: 'py', fifaRank: 40 },
  TUR: { name: 'トルコ', code: 'TUR', flag: '🇹🇷', iso: 'tr', fifaRank: 22 },

  // グループE
  GER: { name: 'ドイツ', code: 'GER', flag: '🇩🇪', iso: 'de', fifaRank: 10 },
  ECU: { name: 'エクアドル', code: 'ECU', flag: '🇪🇨', iso: 'ec', fifaRank: 23 },
  CIV: { name: 'コートジボワール', code: 'CIV', flag: '🇨🇮', iso: 'ci', fifaRank: 34 },
  CUW: { name: 'キュラソー', code: 'CUW', flag: '🇨🇼', iso: 'cw', fifaRank: 82 },

  // グループF
  NED: { name: 'オランダ', code: 'NED', flag: '🇳🇱', iso: 'nl', fifaRank: 7 },
  JPN: { name: '日本', code: 'JPN', flag: '🇯🇵', iso: 'jp', fifaRank: 18 },
  TUN: { name: 'チュニジア', code: 'TUN', flag: '🇹🇳', iso: 'tn', fifaRank: 44 },
  SWE: { name: 'スウェーデン', code: 'SWE', flag: '🇸🇪', iso: 'se', fifaRank: 38 },

  // グループG
  BEL: { name: 'ベルギー', code: 'BEL', flag: '🇧🇪', iso: 'be', fifaRank: 9 },
  IRN: { name: 'イラン', code: 'IRN', flag: '🇮🇷', iso: 'ir', fifaRank: 21 },
  EGY: { name: 'エジプト', code: 'EGY', flag: '🇪🇬', iso: 'eg', fifaRank: 29 },
  NZL: { name: 'ニュージーランド', code: 'NZL', flag: '🇳🇿', iso: 'nz', fifaRank: 85 },

  // グループH
  ESP: { name: 'スペイン', code: 'ESP', flag: '🇪🇸', iso: 'es', fifaRank: 2 },
  URU: { name: 'ウルグアイ', code: 'URU', flag: '🇺🇾', iso: 'uy', fifaRank: 17 },
  KSA: { name: 'サウジアラビア', code: 'KSA', flag: '🇸🇦', iso: 'sa', fifaRank: 61 },
  CPV: { name: 'カーボベルデ', code: 'CPV', flag: '🇨🇻', iso: 'cv', fifaRank: 69 },

  // グループI
  FRA: { name: 'フランス', code: 'FRA', flag: '🇫🇷', iso: 'fr', fifaRank: 1 },
  SEN: { name: 'セネガル', code: 'SEN', flag: '🇸🇳', iso: 'sn', fifaRank: 14 },
  NOR: { name: 'ノルウェー', code: 'NOR', flag: '🇳🇴', iso: 'no', fifaRank: 31 },
  IRQ: { name: 'イラク', code: 'IRQ', flag: '🇮🇶', iso: 'iq', fifaRank: 57 },

  // グループJ
  ARG: { name: 'アルゼンチン', code: 'ARG', flag: '🇦🇷', iso: 'ar', fifaRank: 3 },
  AUT: { name: 'オーストリア', code: 'AUT', flag: '🇦🇹', iso: 'at', fifaRank: 24 },
  ALG: { name: 'アルジェリア', code: 'ALG', flag: '🇩🇿', iso: 'dz', fifaRank: 28 },
  JOR: { name: 'ヨルダン', code: 'JOR', flag: '🇯🇴', iso: 'jo', fifaRank: 63 },

  // グループK
  POR: { name: 'ポルトガル', code: 'POR', flag: '🇵🇹', iso: 'pt', fifaRank: 5 },
  COL: { name: 'コロンビア', code: 'COL', flag: '🇨🇴', iso: 'co', fifaRank: 13 },
  UZB: { name: 'ウズベキスタン', code: 'UZB', flag: '🇺🇿', iso: 'uz', fifaRank: 50 },
  COD: { name: 'DRコンゴ', code: 'COD', flag: '🇨🇩', iso: 'cd', fifaRank: 46 },

  // グループL
  ENG: { name: 'イングランド', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', iso: 'gb-eng', fifaRank: 4 },
  CRO: { name: 'クロアチア', code: 'CRO', flag: '🇭🇷', iso: 'hr', fifaRank: 11 },
  PAN: { name: 'パナマ', code: 'PAN', flag: '🇵🇦', iso: 'pa', fifaRank: 33 },
  GHA: { name: 'ガーナ', code: 'GHA', flag: '🇬🇭', iso: 'gh', fifaRank: 74 },
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

// ===== グループステージ日程 =====
import { officialMatches } from './official_schedule';

export function createInitialMatches(): Match[] {
  // officialMatches をコピーして初期状態の試合データとして返す
  return officialMatches.map((match) => ({
    ...match,
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
