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
const codes = Object.values(groupTeams).flat();
const qualities = codes.map((c) => powerQuality(c));
const meanQ = qualities.reduce((a, b) => a + b, 0) / qualities.length;

function getQuality(code: string) {
  const i = codes.indexOf(code);
  return i >= 0 ? qualities[i] : meanQ;
}

function evaluate(name: string, probFn: (home: string, away: string) => { pHome: number, pDraw: number, pAway: number }, threshold: number) {
  let hits = 0;
  let logLoss = 0;
  
  for (const m of matches) {
    const prob = probFn(m.homeTeam, m.awayTeam);
    let predicted = 'DRAW';
    if (Math.abs(prob.pHome - prob.pAway) >= threshold) {
      if (prob.pHome >= prob.pDraw && prob.pHome >= prob.pAway) predicted = 'HOME';
      else if (prob.pAway >= prob.pDraw && prob.pAway >= prob.pHome) predicted = 'AWAY';
    }
    const actual = m.homeScore > m.awayScore ? 'HOME' : m.homeScore < m.awayScore ? 'AWAY' : 'DRAW';
    if (predicted === actual) hits++;
    
    let pActual = actual === 'HOME' ? prob.pHome : actual === 'AWAY' ? prob.pAway : prob.pDraw;
    pActual = Math.max(1e-15, Math.min(1 - 1e-15, pActual));
    logLoss -= Math.log(pActual);
  }
  
  logLoss /= matches.length;
  console.log(`[${name}] Accuracy: ${hits}/${matches.length} (${(hits/matches.length*100).toFixed(1)}%) | Log-Loss: ${logLoss.toFixed(4)}`);
}

// ---------------------------------------------------------
// BASELINE (Current Logic)
// ---------------------------------------------------------
function probBaseline(home: string, away: string) {
  const scale = 0.50;
  const MU0 = Math.log(1.35);
  const hostBoost = 1.10;
  const rho = -0.10;

  const hQ = getQuality(home) - meanQ;
  const aQ = getQuality(away) - meanQ;
  
  const hRatio = teamStyleRatios[home] ?? 1.0;
  const aRatio = teamStyleRatios[away] ?? 1.0;

  const hAtk = scale * hQ + (hRatio - 1.0) * scale;
  const hDef = scale * hQ - (hRatio - 1.0) * scale;
  const aAtk = scale * aQ + (aRatio - 1.0) * scale;
  const aDef = scale * aQ - (aRatio - 1.0) * scale;

  let lh = Math.exp(MU0 + hAtk - aDef);
  let la = Math.exp(MU0 + aAtk - hDef);
  
  const HOSTS = new Set(['USA', 'MEX', 'CAN']);
  if (HOSTS.has(home) && !HOSTS.has(away)) { lh *= hostBoost; la *= 0.90; }
  else if (HOSTS.has(away) && !HOSTS.has(home)) { la *= hostBoost; lh *= 0.90; }
  
  lh = Math.max(0.1, Math.min(5.5, lh)); la = Math.max(0.1, Math.min(5.5, la));

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

evaluate('Baseline', probBaseline, 0.29);

// ---------------------------------------------------------
// STRATEGY 1: Bivariate Poisson
// X ~ Poi(lh), Y ~ Poi(la), Z ~ Poi(lambda3)
// Goals Home = X + Z, Goals Away = Y + Z
// ---------------------------------------------------------
function probBivariate(home: string, away: string) {
  const scale = 0.50;
  const MU0 = Math.log(1.20); // lower base lambda because Z adds goals
  const lambda3 = 0.25; // covariance factor
  const hostBoost = 1.10;

  const hQ = getQuality(home) - meanQ;
  const aQ = getQuality(away) - meanQ;
  
  const hRatio = teamStyleRatios[home] ?? 1.0;
  const aRatio = teamStyleRatios[away] ?? 1.0;

  const hAtk = scale * hQ + (hRatio - 1.0) * scale;
  const hDef = scale * hQ - (hRatio - 1.0) * scale;
  const aAtk = scale * aQ + (aRatio - 1.0) * scale;
  const aDef = scale * aQ - (aRatio - 1.0) * scale;

  let lh = Math.exp(MU0 + hAtk - aDef);
  let la = Math.exp(MU0 + aAtk - hDef);
  
  const HOSTS = new Set(['USA', 'MEX', 'CAN']);
  if (HOSTS.has(home) && !HOSTS.has(away)) { lh *= hostBoost; la *= 0.90; }
  else if (HOSTS.has(away) && !HOSTS.has(home)) { la *= hostBoost; lh *= 0.90; }

  let pHome = 0; let pDraw = 0; let pAway = 0;
  for (let z = 0; z <= 3; z++) {
    const pZ = (Math.exp(-lambda3) * Math.pow(lambda3, z) / Array.from({length: z}).reduce((a:any,_,k)=>a*(k+1),1));
    for (let x = 0; x <= 6; x++) {
      const pX = (Math.exp(-lh) * Math.pow(lh, x) / Array.from({length: x}).reduce((a:any,_,k)=>a*(k+1),1));
      for (let y = 0; y <= 6; y++) {
        const pY = (Math.exp(-la) * Math.pow(la, y) / Array.from({length: y}).reduce((a:any,_,k)=>a*(k+1),1));
        const prob = pZ * pX * pY;
        const gH = x + z;
        const gA = y + z;
        if (gH > gA) pHome += prob;
        else if (gA > gH) pAway += prob;
        else pDraw += prob;
      }
    }
  }
  const sum = pHome+pDraw+pAway;
  return { pHome: pHome/sum, pDraw: pDraw/sum, pAway: pAway/sum };
}

evaluate('Strat 1: Bivariate Poisson', probBivariate, 0.22);

// ---------------------------------------------------------
// STRATEGY 3: Elo Hybrid
// Blend Poisson probability with standard Elo win probability
// ---------------------------------------------------------
function probEloHybrid(home: string, away: string) {
  const base = probBaseline(home, away);
  
  const hQ = getQuality(home); // mapped [0, 1] usually
  const aQ = getQuality(away);
  // approximate an Elo diff from powerQuality
  const eloDiff = (hQ - aQ) * 800; // 0.1 diff = 80 Elo points
  
  // standard Elo win probability (ignoring draws for a moment)
  const pHomeElo = 1 / (1 + Math.pow(10, -eloDiff / 400));
  const pAwayElo = 1 - pHomeElo;
  
  // Blend: we assume Elo gives decisive win prob, distribute draw equally
  const blendWeight = 0.3; 
  // We don't have a direct P_draw from basic Elo, so let's just adjust decisive probs
  let pHome = base.pHome * (1 - blendWeight) + pHomeElo * blendWeight * (1 - base.pDraw);
  let pAway = base.pAway * (1 - blendWeight) + pAwayElo * blendWeight * (1 - base.pDraw);
  let pDraw = base.pDraw; // keep baseline draw prob
  
  const sum = pHome+pDraw+pAway;
  return { pHome: pHome/sum, pDraw: pDraw/sum, pAway: pAway/sum };
}

evaluate('Strat 3: Elo Hybrid', probEloHybrid, 0.29);

// ---------------------------------------------------------
// TUNE STRATEGY 4: Dynamic MU0
// ---------------------------------------------------------
let bestS4Acc = 0;
let bestS4Loss = 999;
let bestS4Params: any = null;

for (let scale = 0.50; scale <= 0.70; scale += 0.05) {
  for (let rho = -0.10; rho >= -0.20; rho -= 0.05) {
    for (let thres = 0.15; thres <= 0.35; thres += 0.01) {
      
      let hits = 0;
      let logLoss = 0;
      
      for (const m of matches) {
        const hQ = getQuality(m.homeTeam) - meanQ;
        const aQ = getQuality(m.awayTeam) - meanQ;
        const diff = Math.abs(hQ - aQ);
        
        const dynamicMU0 = Math.log(1.10 + 0.40 * diff); 
        const hostBoost = 1.10;

        const hRatio = teamStyleRatios[m.homeTeam] ?? 1.0;
        const aRatio = teamStyleRatios[m.awayTeam] ?? 1.0;

        const hAtk = scale * hQ + (hRatio - 1.0) * scale;
        const hDef = scale * hQ - (hRatio - 1.0) * scale;
        const aAtk = scale * aQ + (aRatio - 1.0) * scale;
        const aDef = scale * aQ - (aRatio - 1.0) * scale;

        let lh = Math.exp(dynamicMU0 + hAtk - aDef);
        let la = Math.exp(dynamicMU0 + aAtk - hDef);
        
        const HOSTS = new Set(['USA', 'MEX', 'CAN']);
        if (HOSTS.has(m.homeTeam) && !HOSTS.has(m.awayTeam)) { lh *= hostBoost; la *= 0.90; }
        else if (HOSTS.has(m.awayTeam) && !HOSTS.has(m.homeTeam)) { la *= hostBoost; lh *= 0.90; }

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
        const pH = pHome/sum; const pD = pDraw/sum; const pA = pAway/sum;
        
        let predicted = 'DRAW';
        if (Math.abs(pH - pA) >= thres) {
          if (pH >= pD && pH >= pA) predicted = 'HOME';
          else if (pA >= pD && pA >= pH) predicted = 'AWAY';
        }
        
        const actual = m.homeScore > m.awayScore ? 'HOME' : m.homeScore < m.awayScore ? 'AWAY' : 'DRAW';
        if (predicted === actual) hits++;
        
        let pActual = actual === 'HOME' ? pH : actual === 'AWAY' ? pA : pD;
        pActual = Math.max(1e-15, Math.min(1 - 1e-15, pActual));
        logLoss -= Math.log(pActual);
      }
      logLoss /= matches.length;
      
      if (hits > bestS4Acc || (hits === bestS4Acc && logLoss < bestS4Loss)) {
        bestS4Acc = hits;
        bestS4Loss = logLoss;
        bestS4Params = { scale, rho, thres };
      }
    }
  }
}
console.log(`[Strat 4 Tuned] Accuracy: ${bestS4Acc}/${matches.length} (${(bestS4Acc/matches.length*100).toFixed(1)}%) | Log-Loss: ${bestS4Loss.toFixed(4)} ->`, bestS4Params);
