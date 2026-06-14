// =============================================================================
// API Sync Module
// -----------------------------------------------------------------------------
// worldcup26.ir などのパブリックAPIから試合結果を取得し、
// アプリケーションの Match[] 状態にマージする。
// =============================================================================

import type { Match, MatchLog, MatchEvent, Player } from '../types';
import playersDataRaw from '../data/players.json';
import { teams } from '../data';
import { generatePlayerRatings } from './matchEngine';

const playersData = playersDataRaw as Record<string, Player[]>;

interface ApiMatch {
  home_team_name_en: string;
  away_team_name_en: string;
  home_score: string | null;
  away_score: string | null;
  home_scorers: string | null;
  away_scorers: string | null;
  finished: string; // "TRUE" or "FALSE"
  time_elapsed: string;
}

function parseScorers(scorersStr: string | null, teamCode: string): MatchEvent[] {
  if (!scorersStr || scorersStr === "null" || scorersStr === "") return [];
  const cleanStr = scorersStr.replace(/^\{/, '').replace(/\}$/, '');
  if (!cleanStr) return [];
  
  // Use regex to split by comma outside of quotes if necessary, but API format is usually `{"Name 12'","Name 34'"}`
  // Let's just match everything that looks like `"something"` or `“something”`
  const matches = cleanStr.match(/["“](.*?)["”]/g) || cleanStr.split(',');
  
  const events: MatchEvent[] = [];
  const roster = playersData[teamCode] || [];

  for (const matchStr of matches) {
    const text = matchStr.replace(/^["“]/, '').replace(/["”]$/, '').trim();
    if (!text) continue;

    const m = text.match(/(.+?)\s+(\d+)'(?:(?:\+\d+')?)(?:\(OG\))?/);
    if (m) {
      const name = m[1].trim();
      const minuteStr = m[2];
      const isOG = text.includes('(OG)');

      const nameParts = name.split(' ');
      const lastName = nameParts[nameParts.length - 1];
      const player = roster.find(p => p.name.includes(lastName) || name.includes(p.name));

      events.push({
        minute: parseInt(minuteStr, 10),
        type: 'GOAL',
        team: teamCode,
        playerId: isOG ? undefined : player?.id,
        description: `GOAL! ${teams[teamCode]?.name} 得点: ${name}${isOG ? ' (オウンゴール)' : ''}`,
      });
    }
  }
  return events;
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
          const homeScore = parseInt(liveData.home_score, 10);
          const awayScore = parseInt(liveData.away_score || "0", 10);

          let matchLog: MatchLog | undefined;
          if (isFinished) {
            const homeEvents = parseScorers(liveData.home_scorers, match.homeTeam);
            const awayEvents = parseScorers(liveData.away_scorers, match.awayTeam);
            const events = [...homeEvents, ...awayEvents].sort((a, b) => a.minute - b.minute);
            
            // Generate pseudo-stats to populate the UI
            const hPoss = Math.max(30, Math.min(70, 50 + (homeScore - awayScore) * 3));
            const aPoss = 100 - hPoss;
            const hShots = homeScore * 3 + Math.floor(Math.random() * 5);
            const aShots = awayScore * 3 + Math.floor(Math.random() * 5);

            matchLog = {
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore,
              awayScore,
              homePenScore: 0,
              awayPenScore: 0,
              isExtraTime: false,
              isPenaltyShootout: false,
              winner: homeScore > awayScore ? match.homeTeam : awayScore > homeScore ? match.awayTeam : 'DRAW',
              events,
              homeStats: { possession: hPoss, expectedGoals: +(homeScore*0.8).toFixed(1), shots: hShots, shotsOnTarget: homeScore + Math.floor(Math.random()*3), fouls: 10 + Math.floor(Math.random()*5), yellowCards: Math.floor(Math.random()*3), redCards: 0 },
              awayStats: { possession: aPoss, expectedGoals: +(awayScore*0.8).toFixed(1), shots: aShots, shotsOnTarget: awayScore + Math.floor(Math.random()*3), fouls: 10 + Math.floor(Math.random()*5), yellowCards: Math.floor(Math.random()*3), redCards: 0 },
              homeEndStamina: 0.7,
              awayEndStamina: 0.7,
              playerRatings: generatePlayerRatings(
                match.homeTeam,
                match.awayTeam,
                homeScore > awayScore ? match.homeTeam : awayScore > homeScore ? match.awayTeam : 'DRAW',
                events
              )
            };
          }

          return {
            ...match,
            homeScore,
            awayScore,
            syncStatus: isFinished ? 'finished' : 'live',
            matchLog: matchLog || match.matchLog,
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
