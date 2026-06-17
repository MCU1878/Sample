import fs from 'fs';
import { createInitialMatches } from './src/data';
import { runForecast } from './src/utils/forecast';

const raw = fs.readFileSync('real_matches.json');
const str = Buffer.from(raw).toString('utf16le');
const cleanStr = str.replace(/^\uFEFF/, '');
const data = JSON.parse(cleanStr);
const apiMatches = data.games || data.data || data;

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

let matches = createInitialMatches();
matches = matches.map((match) => {
  const homeName = Object.keys(apiNameToCode).find(k => apiNameToCode[k] === match.homeTeam);
  const awayName = Object.keys(apiNameToCode).find(k => apiNameToCode[k] === match.awayTeam);
  const apiMatch = apiMatches.find((g: any) => 
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

console.log("Running simulation (N=5000)...");
const res = runForecast(matches, { iterations: 5000 });
const sorted = Object.entries(res.champion).sort((a, b) => b[1] - a[1]);
console.log("Top 10 Champions:");
for (let i = 0; i < 10; i++) {
  console.log(`${sorted[i][0]}: ${(sorted[i][1] * 100).toFixed(1)}%`);
}
