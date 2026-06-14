import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const teamPages: Record<string, string> = {
  MEX: 'Mexico_national_football_team',
  KOR: 'South_Korea_national_football_team',
  RSA: 'South_Africa_national_soccer_team',
  CZE: 'Czech_Republic_national_football_team',
  CAN: 'Canada_men%27s_national_soccer_team',
  SUI: 'Switzerland_national_football_team',
  QAT: 'Qatar_national_football_team',
  BIH: 'Bosnia_and_Herzegovina_national_football_team',
  BRA: 'Brazil_national_football_team',
  MAR: 'Morocco_national_football_team',
  SCO: 'Scotland_national_football_team',
  HAI: 'Haiti_national_football_team',
  USA: 'United_States_men%27s_national_soccer_team',
  AUS: 'Australia_men%27s_national_soccer_team',
  PAR: 'Paraguay_national_football_team',
  TUR: 'Turkey_national_football_team',
  GER: 'Germany_national_football_team',
  ECU: 'Ecuador_national_football_team',
  CIV: 'Ivory_Coast_national_football_team',
  CUW: 'Curaçao_national_football_team',
  NED: 'Netherlands_national_football_team',
  JPN: 'Japan_national_football_team',
  TUN: 'Tunisia_national_football_team',
  SWE: 'Sweden_national_football_team',
  BEL: 'Belgium_national_football_team',
  IRN: 'Iran_national_football_team',
  EGY: 'Egypt_national_football_team',
  NZL: 'New_Zealand_national_football_team',
  ESP: 'Spain_national_football_team',
  URU: 'Uruguay_national_football_team',
  KSA: 'Saudi_Arabia_national_football_team',
  CPV: 'Cape_Verde_national_football_team',
  FRA: 'France_national_football_team',
  SEN: 'Senegal_national_football_team',
  NOR: 'Norway_national_football_team',
  IRQ: 'Iraq_national_football_team',
  ARG: 'Argentina_national_football_team',
  AUT: 'Austria_national_football_team',
  ALG: 'Algeria_national_football_team',
  JOR: 'Jordan_national_football_team',
  POR: 'Portugal_national_football_team',
  COL: 'Colombia_national_football_team',
  UZB: 'Uzbekistan_national_football_team',
  COD: 'DR_Congo_national_football_team',
  ENG: 'England_national_football_team',
  CRO: 'Croatia_national_football_team',
  PAN: 'Panama_national_football_team',
  GHA: 'Ghana_national_football_team'
};

async function fetchSquad(teamCode: string, pageTitle: string, retries = 3): Promise<any[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${pageTitle}&format=json`;
    const response = await axios.get(url, { headers: { 'User-Agent': 'AntigravityWC2026/1.1' } });
    if (response.data.error) {
       console.log(`Error fetching ${teamCode}: ${response.data.error.info}`);
       return generateFallback(teamCode);
    }
    const html = response.data.parse.text['*'];
    const $ = cheerio.load(html);
    
    let squadTable = null;
    
    $('h3, h2').each((i, el) => {
       const text = $(el).text().toLowerCase();
       if (text.includes('squad') || text.includes('players')) {
          let nextEl = $(el).next();
          while (nextEl.length && !nextEl.is('h2, h3')) {
             if (nextEl.is('table.sortable')) {
                 squadTable = nextEl;
                 break;
             }
             if (nextEl.find('table.sortable').length > 0) {
                 squadTable = nextEl.find('table.sortable').first();
                 break;
             }
             nextEl = nextEl.next();
          }
       }
    });

    if (!squadTable) {
       $('table.sortable').each((i, el) => {
         const text = $(el).text();
         if (text.includes('Pos.') && text.includes('Player')) {
           squadTable = $(el);
           return false;
         }
       });
    }

    if (!squadTable) {
      console.log(`Could not find squad table for ${teamCode}. Generating fallback.`);
      return generateFallback(teamCode);
    }

    const players: any[] = [];
    $(squadTable).find('tr').each((i, tr) => {
       const tds = $(tr).find('td, th');
       if (tds.length >= 4) {
          let pos = $(tds[1]).text().trim();
          if (pos.includes('GK')) pos = 'GK';
          else if (pos.includes('DF')) pos = 'DF';
          else if (pos.includes('MF')) pos = 'MF';
          else if (pos.includes('FW')) pos = 'FW';
          else return;
          
          let nameCell = $(tds[2]);
          let name = nameCell.find('a').first().text().trim() || nameCell.text().trim();
          
          name = name.replace(/\(.*\)/g, '').trim();
          name = name.replace(/\[.*\]/g, '').trim();
          name = name.replace(/[^a-zA-ZÀ-ÿ -]/g, '').trim();
          
          if (name && pos && ['GK', 'DF', 'MF', 'FW'].includes(pos)) {
             players.push({
               id: `${teamCode}-${players.length + 1}`,
               name: name,
               position: pos as 'GK' | 'DF' | 'MF' | 'FW',
             });
          }
       }
    });
    
    if (players.length < 11) {
       console.log(`${teamCode} had too few players (${players.length}). Generating fallback.`);
       return generateFallback(teamCode);
    }
    
    console.log(`Fetched ${players.length} players for ${teamCode}`);
    return players.slice(0, 26);
  } catch (error: any) {
    if (error.response && error.response.status === 429 && retries > 0) {
      console.log(`Rate limited on ${teamCode}. Waiting 5 seconds...`);
      await new Promise(r => setTimeout(r, 5000));
      return fetchSquad(teamCode, pageTitle, retries - 1);
    }
    console.error(`Failed to fetch ${teamCode}`, error.message);
    return generateFallback(teamCode);
  }
}

function generateFallback(teamCode: string) {
  const players = [];
  const positions = ['GK', 'GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW', 'FW', 'FW', 'FW', 'FW'];
  for (let i = 0; i < 26; i++) {
    players.push({
      id: `${teamCode}-${i + 1}`,
      name: `${teamCode} Player ${i + 1}`,
      position: positions[i]
    });
  }
  return players;
}

async function main() {
  const result: Record<string, any[]> = {};
  for (const [code, title] of Object.entries(teamPages)) {
    console.log(`Fetching ${code}...`);
    const squad = await fetchSquad(code, title);
    result[code] = squad;
    await new Promise(r => setTimeout(r, 1000));
  }

  const outPath = path.join(process.cwd(), 'src', 'data', 'players.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Saved to ${outPath}`);
}

main();
