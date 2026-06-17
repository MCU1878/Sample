import fs from 'fs';
import { createInitialMatches } from './src/data';
import { teamStyleRatios } from './src/data/teamStyles';
import { powerQuality } from './src/utils/powerRankings';
import { groupTeams } from './src/data';

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

const MU0 = Math.log(1.35);

function initRatings(scale: number) {
  const ratings: any = {};
  const codes = Object.values(groupTeams).flat();
  const qualities = codes.map((c) => powerQuality(c));
  const meanQ = qualities.reduce((a, b) => a + b, 0) / qualities.length;

  codes.forEach((c, i) => {
    const base = scale * (qualities[i] - meanQ);
    const ratio = teamStyleRatios[c] ?? 1.0;
    const shift = (ratio - 1.0) * scale;
    ratings[c] = {
      attack: { mean: base + shift, var: 0.08 },
      defense: { mean: base - shift, var: 0.08 },
    };
  });
  return ratings;
}

function clampLambda(x: number) { return Math.max(0.1, Math.min(5.5, x)); }

function getProbabilities(home: string, away: string, ratings: any, rho: number, hostBoost: number) {
  let lh = Math.exp(MU0 + ratings[home].attack.mean - ratings[away].defense.mean);
  let la = Math.exp(MU0 + ratings[away].attack.mean - ratings[home].defense.mean);
  
  const HOSTS = new Set(['USA', 'MEX', 'CAN']);
  if (HOSTS.has(home) && !HOSTS.has(away)) { lh *= hostBoost; la *= 0.90; }
  else if (HOSTS.has(away) && !HOSTS.has(home)) { la *= hostBoost; lh *= 0.90; }
  
  lh = clampLambda(lh); la = clampLambda(la);

  let pHome = 0; let pDraw = 0; let pAway = 0;
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      let baseP = (Math.exp(-lh) * Math.pow(lh, i) / Array.from({length: i}).reduce((a:any,_,k)=>a*(k+1),1)) *
                  (Math.exp(-la) * Math.pow(la, j) / Array.from({length: j}).reduce((a:any,_,k)=>a*(k+1),1));
      if (i===0&&j===0) baseP *= (1 - lh*la*rho);
      else if (i===0&&j===1) baseP *= (1 + lh*rho);
      else if (i===1&&j===0) baseP *= (1 + la*rho);
      else if (i===1&&j===1) baseP *= (1 - rho);
      baseP = Math.max(0, baseP);
      if (i>j) pHome+=baseP; else if (i<j) pAway+=baseP; else pDraw+=baseP;
    }
  }
  const sum = pHome+pDraw+pAway;
  return { pHome: pHome/sum, pDraw: pDraw/sum, pAway: pAway/sum };
}

function updateRatings(ratings: any, home: string, away: string, gh: number, ga: number) {
  return ratings; // simplified, we ignore bayesian update for tuning speed
}

function getMatches() {
  const raw = fs.readFileSync('real_matches.json');
  const str = Buffer.from(raw).toString('utf16le');
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
  return matches.filter(m => m.syncStatus === 'finished').sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);
}

const matches = getMatches();
let bestHits = 0;
let bestParams = null;

for (let scale = 0.5; scale <= 1.2; scale += 0.05) {
  for (let rho = -0.10; rho >= -0.35; rho -= 0.05) {
    for (let hostBoost = 1.10; hostBoost <= 1.20; hostBoost += 0.05) {
      for (let threshold = 0.15; threshold <= 0.35; threshold += 0.01) {
        
        let ratings = initRatings(scale);
        let hits = 0;
        for (const m of matches) {
          const prob = getProbabilities(m.homeTeam, m.awayTeam, ratings, rho, hostBoost);
          let predicted = 'DRAW';
          if (Math.abs(prob.pHome - prob.pAway) >= threshold) {
            if (prob.pHome >= prob.pDraw && prob.pHome >= prob.pAway) predicted = 'HOME';
            else if (prob.pAway >= prob.pDraw && prob.pAway >= prob.pHome) predicted = 'AWAY';
          }
          const actual = m.homeScore > m.awayScore ? 'HOME' : m.homeScore < m.awayScore ? 'AWAY' : 'DRAW';
          if (predicted === actual) hits++;
        }
        
        if (hits > bestHits) {
          bestHits = hits;
          bestParams = { scale, rho, hostBoost, threshold };
          console.log(`New Best: ${hits}/16 ->`, bestParams);
        }
      }
    }
  }
}
console.log('Final Best:', bestParams);
