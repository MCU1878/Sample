// =============================================================================
// API Sync Module
// -----------------------------------------------------------------------------
// worldcup26.ir などのパブリックAPIから試合結果を取得し、
// アプリケーションの Match[] 状態にマージする。
// =============================================================================

import type { Match } from '../types';

interface ApiMatch {
  home_team_name_en: string;
  away_team_name_en: string;
  home_score: string | null;
  away_score: string | null;
  finished: string; // "TRUE" or "FALSE"
  time_elapsed: string;
}

const apiNameToCode: Record<string, string> = {
  "Mexico": "MEX", "South Africa": "RSA", "South Korea": "KOR", "Czech Republic": "CZE",
  "Canada": "CAN", "Bosnia and Herzegovina": "BIH", "United States": "USA", "Paraguay": "PAR",
  "Haiti": "HAI", "Scotland": "SCO", "Australia": "AUS", "Turkey": "TUR",
  "Brazil": "BRA", "Morocco": "MAR", "Qatar": "QAT", "Switzerland": "SUI",
  "Ivory Coast": "CIV", "Ecuador": "ECU", "Germany": "GER", "Curaçao": "CUW",
  "Netherlands": "NED", "Japan": "JPN", "Sweden": "SWE", "Tunisia": "TUN",
  "Iran": "IRN", "New Zealand": "NZL", "Spain": "ESP", "Cape Verde": "CPV",
  "Belgium": "BEL", "Egypt": "EGY", "Saudi Arabia": "KSA", "Uruguay": "URU",
  "France": "FRA", "Senegal": "SEN", "Iraq": "IRQ", "Norway": "NOR",
  "Argentina": "ARG", "Algeria": "ALG", "Austria": "AUT", "Jordan": "JOR",
  "Portugal": "POR", "Democratic Republic of the Congo": "COD", "England": "ENG",
  "Croatia": "CRO", "Uzbekistan": "UZB", "Colombia": "COL", "Ghana": "GHA", "Panama": "PAN"
};

/**
 * 外部APIから試合データをフェッチし、既存の Match[] を更新する関数を返す。
 */
export async function fetchLiveMatches(): Promise<(currentMatches: Match[]) => Match[]> {
  try {
    const response = await fetch('https://worldcup26.ir/get/games', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    const apiMatches: ApiMatch[] = data.games || data.data || data;

    // 状態更新関数を返す
    return (currentMatches: Match[]) => currentMatches.map((match) => {
      // API上のホーム・アウェイと一致する試合を探す
      const liveData = apiMatches.find(
        (am) => apiNameToCode[am.home_team_name_en] === match.homeTeam &&
                apiNameToCode[am.away_team_name_en] === match.awayTeam
      );

      if (liveData && liveData.home_score !== null && liveData.home_score !== "null") {
        // APIの "time_elapsed" が "notstarted" の場合はまだ始まっていないためロック・同期しない
        const isNotStarted = liveData.time_elapsed === 'notstarted' || 
                            (liveData.home_score === "0" && liveData.away_score === "0" && liveData.finished === "FALSE");
        
        if (!isNotStarted) {
          const isFinished = liveData.finished === "TRUE" || liveData.time_elapsed === 'finished';
          return {
            ...match,
            homeScore: parseInt(liveData.home_score, 10),
            awayScore: parseInt(liveData.away_score || "0", 10),
            syncStatus: isFinished ? 'finished' : 'live',
          };
        }
      }
      return match;
    });
  } catch (error) {
    console.error("fetchLiveMatches failed:", error);
    return (currentMatches: Match[]) => currentMatches; // エラー時はそのまま返す
  }
}
