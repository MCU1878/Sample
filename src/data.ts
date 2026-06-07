import type { Team, Match } from './types';

// ===== 2026 FIFA World Cup 北中米大会 - 公式グループ分け =====

// 国旗画像URL生成 (flagcdn.com)
export function getFlagUrl(iso: string, size = 40): string {
  return `https://flagcdn.com/w${size}/${iso}.png`;
}

export const teams: Record<string, Team> = {
  // グループA
  MEX: { name: 'メキシコ', code: 'MEX', flag: '🇲🇽', iso: 'mx', rating: 82 },
  KOR: { name: '韓国', code: 'KOR', flag: '🇰🇷', iso: 'kr', rating: 79 },
  RSA: { name: '南アフリカ', code: 'RSA', flag: '🇿🇦', iso: 'za', rating: 71 },
  CZE: { name: 'チェコ', code: 'CZE', flag: '🇨🇿', iso: 'cz', rating: 78 },

  // グループB
  CAN: { name: 'カナダ', code: 'CAN', flag: '🇨🇦', iso: 'ca', rating: 78 },
  SUI: { name: 'スイス', code: 'SUI', flag: '🇨🇭', iso: 'ch', rating: 83 },
  QAT: { name: 'カタール', code: 'QAT', flag: '🇶🇦', iso: 'qa', rating: 72 },
  BIH: { name: 'ボスニア・ヘルツェゴビナ', code: 'BIH', flag: '🇧🇦', iso: 'ba', rating: 76 },

  // グループC
  BRA: { name: 'ブラジル', code: 'BRA', flag: '🇧🇷', iso: 'br', rating: 93 },
  MAR: { name: 'モロッコ', code: 'MAR', flag: '🇲🇦', iso: 'ma', rating: 88 },
  SCO: { name: 'スコットランド', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', iso: 'gb-sct', rating: 79 },
  HAI: { name: 'ハイチ', code: 'HAI', flag: '🇭🇹', iso: 'ht', rating: 63 },

  // グループD
  USA: { name: 'アメリカ', code: 'USA', flag: '🇺🇸', iso: 'us', rating: 83 },
  AUS: { name: 'オーストラリア', code: 'AUS', flag: '🇦🇺', iso: 'au', rating: 77 },
  PAR: { name: 'パラグアイ', code: 'PAR', flag: '🇵🇾', iso: 'py', rating: 75 },
  TUR: { name: 'トルコ', code: 'TUR', flag: '🇹🇷', iso: 'tr', rating: 80 },

  // グループE
  GER: { name: 'ドイツ', code: 'GER', flag: '🇩🇪', iso: 'de', rating: 89 },
  ECU: { name: 'エクアドル', code: 'ECU', flag: '🇪🇨', iso: 'ec', rating: 81 },
  CIV: { name: 'コートジボワール', code: 'CIV', flag: '🇨🇮', iso: 'ci', rating: 79 },
  CUW: { name: 'キュラソー', code: 'CUW', flag: '🇨🇼', iso: 'cw', rating: 65 },

  // グループF
  NED: { name: 'オランダ', code: 'NED', flag: '🇳🇱', iso: 'nl', rating: 90 },
  JPN: { name: '日本', code: 'JPN', flag: '🇯🇵', iso: 'jp', rating: 84 },
  TUN: { name: 'チュニジア', code: 'TUN', flag: '🇹🇳', iso: 'tn', rating: 76 },
  SWE: { name: 'スウェーデン', code: 'SWE', flag: '🇸🇪', iso: 'se', rating: 83 },

  // グループG
  BEL: { name: 'ベルギー', code: 'BEL', flag: '🇧🇪', iso: 'be', rating: 88 },
  IRN: { name: 'イラン', code: 'IRN', flag: '🇮🇷', iso: 'ir', rating: 78 },
  EGY: { name: 'エジプト', code: 'EGY', flag: '🇪🇬', iso: 'eg', rating: 77 },
  NZL: { name: 'ニュージーランド', code: 'NZL', flag: '🇳🇿', iso: 'nz', rating: 66 },

  // グループH
  ESP: { name: 'スペイン', code: 'ESP', flag: '🇪🇸', iso: 'es', rating: 92 },
  URU: { name: 'ウルグアイ', code: 'URU', flag: '🇺🇾', iso: 'uy', rating: 86 },
  KSA: { name: 'サウジアラビア', code: 'KSA', flag: '🇸🇦', iso: 'sa', rating: 73 },
  CPV: { name: 'カーボベルデ', code: 'CPV', flag: '🇨🇻', iso: 'cv', rating: 71 },

  // グループI
  FRA: { name: 'フランス', code: 'FRA', flag: '🇫🇷', iso: 'fr', rating: 94 },
  SEN: { name: 'セネガル', code: 'SEN', flag: '🇸🇳', iso: 'sn', rating: 81 },
  NOR: { name: 'ノルウェー', code: 'NOR', flag: '🇳🇴', iso: 'no', rating: 82 },
  IRQ: { name: 'イラク', code: 'IRQ', flag: '🇮🇶', iso: 'iq', rating: 70 },

  // グループJ
  ARG: { name: 'アルゼンチン', code: 'ARG', flag: '🇦🇷', iso: 'ar', rating: 95 },
  AUT: { name: 'オーストリア', code: 'AUT', flag: '🇦🇹', iso: 'at', rating: 82 },
  ALG: { name: 'アルジェリア', code: 'ALG', flag: '🇩🇿', iso: 'dz', rating: 77 },
  JOR: { name: 'ヨルダン', code: 'JOR', flag: '🇯🇴', iso: 'jo', rating: 70 },

  // グループK
  POR: { name: 'ポルトガル', code: 'POR', flag: '🇵🇹', iso: 'pt', rating: 91 },
  COL: { name: 'コロンビア', code: 'COL', flag: '🇨🇴', iso: 'co', rating: 85 },
  UZB: { name: 'ウズベキスタン', code: 'UZB', flag: '🇺🇿', iso: 'uz', rating: 74 },
  COD: { name: 'DRコンゴ', code: 'COD', flag: '🇨🇩', iso: 'cd', rating: 73 },

  // グループL
  ENG: { name: 'イングランド', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', iso: 'gb-eng', rating: 93 },
  CRO: { name: 'クロアチア', code: 'CRO', flag: '🇭🇷', iso: 'hr', rating: 87 },
  PAN: { name: 'パナマ', code: 'PAN', flag: '🇵🇦', iso: 'pa', rating: 74 },
  GHA: { name: 'ガーナ', code: 'GHA', flag: '🇬🇭', iso: 'gh', rating: 75 },
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

// チームの実力差を考慮して試合スコアをシミュレートする
export function simulateMatchScore(homeTeamCode: string, awayTeamCode: string): { homeScore: number; awayScore: number } {
  const homeTeam = teams[homeTeamCode];
  const awayTeam = teams[awayTeamCode];

  const homeRating = homeTeam?.rating ?? 80;
  const awayRating = awayTeam?.rating ?? 80;

  const diff = homeRating - awayRating;

  // 基本の得点期待値 λ=1.35。実力差30で期待値を ±1.0 調整
  let homeLambda = 1.35 + (diff / 30);
  let awayLambda = 1.35 - (diff / 30);

  // 期待値の下限・上限を設定 (0.2〜3.5)
  homeLambda = Math.max(0.2, Math.min(3.5, homeLambda));
  awayLambda = Math.max(0.2, Math.min(3.5, awayLambda));

  return {
    homeScore: poissonRandom(homeLambda),
    awayScore: poissonRandom(awayLambda),
  };
}


