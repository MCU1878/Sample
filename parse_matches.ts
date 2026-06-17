import fs from 'fs';
import { evaluateAccuracy } from './src/utils/accuracy';
import { createInitialMatches } from './src/data';

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

function run() {
  const raw = fs.readFileSync('real_matches.json');
  // decode UTF-16LE
  const str = Buffer.from(raw).toString('utf16le');
  // remove BOM if present
  const cleanStr = str.replace(/^\uFEFF/, '');
  const data = JSON.parse(cleanStr);
  const apiMatches = data.games || data.data || data;
  
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

  const finished = matches.filter(m => m.syncStatus === 'finished');
  console.log('Finished matches:', finished.length);
  for (const m of finished) {
    console.log(`${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`);
  }

  const report = evaluateAccuracy(matches);
  console.log(`\nCurrent Accuracy: ${report.hits}/${report.total} (${(report.rate*100).toFixed(1)}%)`);
  
  for (const d of report.details) {
    console.log(`${d.homeTeam} ${d.homeScore}-${d.awayScore} ${d.awayTeam} | Pred: ${d.predicted} (${d.hit ? 'HIT' : 'MISS'})`);
  }
}

run();
