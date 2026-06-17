import { evaluateAccuracy } from './accuracy';
import { createInitialMatches } from '../data';

// 16 matches from the screenshot
const mockGames = [
  { home_team_name_en: "Czech Republic", away_team_name_en: "South Korea", home_score: "1", away_score: "2", finished: "TRUE" },
  { home_team_name_en: "South Africa", away_team_name_en: "Mexico", home_score: "0", away_score: "2", finished: "TRUE" },
  { home_team_name_en: "Canada", away_team_name_en: "Bosnia and Herzegovina", home_score: "1", away_score: "1", finished: "TRUE" },
  { home_team_name_en: "United States", away_team_name_en: "Paraguay", home_score: "4", away_score: "1", finished: "TRUE" },
  { home_team_name_en: "Qatar", away_team_name_en: "Switzerland", home_score: "1", away_score: "1", finished: "TRUE" },
  { home_team_name_en: "Brazil", away_team_name_en: "Morocco", home_score: "1", away_score: "1", finished: "TRUE" },
  { home_team_name_en: "Scotland", away_team_name_en: "Haiti", home_score: "1", away_score: "0", finished: "TRUE" },
  { home_team_name_en: "Turkey", away_team_name_en: "Australia", home_score: "0", away_score: "2", finished: "TRUE" },
  { home_team_name_en: "Germany", away_team_name_en: "Curaçao", home_score: "7", away_score: "1", finished: "TRUE" },
  { home_team_name_en: "Netherlands", away_team_name_en: "Japan", home_score: "2", away_score: "2", finished: "TRUE" },
  { home_team_name_en: "Sweden", away_team_name_en: "Tunisia", home_score: "5", away_score: "1", finished: "TRUE" },
  { home_team_name_en: "Belgium", away_team_name_en: "Egypt", home_score: "1", away_score: "1", finished: "TRUE" },
  { home_team_name_en: "Iran", away_team_name_en: "New Zealand", home_score: "2", away_score: "1", finished: "TRUE" },
  { home_team_name_en: "Spain", away_team_name_en: "Cape Verde", home_score: "0", away_score: "0", finished: "TRUE" },
  { home_team_name_en: "Uruguay", away_team_name_en: "Saudi Arabia", home_score: "1", away_score: "1", finished: "TRUE" },
  { home_team_name_en: "France", away_team_name_en: "Senegal", home_score: "2", away_score: "0", finished: "TRUE" },
];

const apiNameToCode: Record<string, string> = {
  "Mexico": "MEX", "South Africa": "RSA", "South Korea": "KOR", "Czech Republic": "CZE",
  "Canada": "CAN", "Bosnia and Herzegovina": "BIH", "United States": "USA", "Paraguay": "PAR",
  "Haiti": "HAI", "Scotland": "SCO", "Australia": "AUS", "Turkey": "TUR",
  "Brazil": "BRA", "Morocco": "MAR", "Qatar": "QAT", "Switzerland": "SUI",
  "Ivory Coast": "CIV", "Ecuador": "ECU", "Germany": "GER", "Curaçao": "CUW",
  "Netherlands": "NED", "Japan": "JPN", "Sweden": "SWE", "Tunisia": "TUN",
  "Iran": "IRN", "New Zealand": "NZL", "Spain": "ESP", "Cape Verde": "CPV",
  "Belgium": "BEL", "Egypt": "EGY", "Saudi Arabia": "KSA", "Uruguay": "URU",
  "France": "FRA", "Senegal": "SEN", "Iraq": "IRQ", "Norway": "NOR"
};

function getMockMatches() {
  const currentMatches = createInitialMatches();
  return currentMatches.map((match) => {
    const homeName = Object.keys(apiNameToCode).find(k => apiNameToCode[k] === match.homeTeam);
    const awayName = Object.keys(apiNameToCode).find(k => apiNameToCode[k] === match.awayTeam);
    
    const apiMatch = mockGames.find(g => 
      (g.home_team_name_en === homeName && g.away_team_name_en === awayName) ||
      (g.home_team_name_en === awayName && g.away_team_name_en === homeName)
    );

    if (apiMatch && apiMatch.finished === "TRUE") {
      const isReversed = apiMatch.home_team_name_en === awayName;
      return {
        ...match,
        homeScore: parseInt(isReversed ? apiMatch.away_score : apiMatch.home_score, 10),
        awayScore: parseInt(isReversed ? apiMatch.home_score : apiMatch.away_score, 10),
        syncStatus: 'finished' as const,
      };
    }
    return match;
  });
}

async function run() {
  const matches = getMockMatches();
  const report = evaluateAccuracy(matches);
  console.log(`Hits: ${report.hits}/${report.total} (${(report.rate * 100).toFixed(1)}%)`);
  for (const d of report.details) {
    console.log(`${d.homeTeam} ${d.homeScore}-${d.awayScore} ${d.awayTeam} | Predicted: ${d.predicted} (${d.confidence.toFixed(3)}) (${d.hit ? 'HIT' : 'MISS'})`);
  }
}

run().catch(console.error);
