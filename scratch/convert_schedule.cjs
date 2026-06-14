const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'schedule.csv');
const outputPath = path.join(__dirname, '..', 'src', 'official_schedule.ts');

const teamMapping = {
  // Group A
  'Mexico': 'MEX',
  'South Africa': 'RSA',
  'Korea Republic': 'KOR',
  'DEN/MKD/CZE/IRL': 'CZE',
  
  // Group B
  'Canada': 'CAN',
  'Switzerland': 'SUI',
  'Qatar': 'QAT',
  'ITA/NIR/WAL/BIH': 'BIH',
  
  // Group C
  'Brazil': 'BRA',
  'Morocco': 'MAR',
  'Scotland': 'SCO',
  'Haiti': 'HAI',
  
  // Group D
  'USA': 'USA',
  'Australia': 'AUS',
  'Paraguay': 'PAR',
  'TUR/ROU/SVK/KOS': 'TUR',
  
  // Group E
  'Germany': 'GER',
  'Curaçao': 'CUW',
  'Côte d\'Ivoire': 'CIV',
  'Ecuador': 'ECU',
  
  // Group F
  'Netherlands': 'NED',
  'Japan': 'JPN',
  'UKR/SWE/POL/ALB': 'SWE',
  'Tunisia': 'TUN',
  
  // Group G
  'Belgium': 'BEL',
  'Egypt': 'EGY',
  'IR Iran': 'IRN',
  'New Zealand': 'NZL',
  
  // Group H
  'Spain': 'ESP',
  'Cabo Verde': 'CPV',
  'Saudi Arabia': 'KSA',
  'Uruguay': 'URU',
  
  // Group I
  'France': 'FRA',
  'Senegal': 'SEN',
  'Norway': 'NOR',
  'BOL/SUR/IRQ': 'IRQ',
  
  // Group J
  'Argentina': 'ARG',
  'Austria': 'AUT',
  'Algeria': 'ALG',
  'Jordan': 'JOR',
  
  // Group K
  'Portugal': 'POR',
  'Colombia': 'COL',
  'Uzbekistan': 'UZB',
  'NCL/JAM/COD': 'COD',
  
  // Group L
  'England': 'ENG',
  'Croatia': 'CRO',
  'Ghana': 'GHA',
  'Panama': 'PAN'
};

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  const matches = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // シンプルなカンマ区切り（カンマがクォート内にない前提）
    const cols = line.split(',');
    if (cols.length < 7) continue;

    const matchNum = parseInt(cols[0]);
    const roundNumStr = cols[1]; // "1", "2", "3" または "Round of 32" など
    const dateStr = cols[2]; // "DD/MM/YYYY HH:mm"
    const location = cols[3];
    const homeTeam = cols[4];
    const awayTeam = cols[5];
    const groupStr = cols[6]; // "Group A" など

    // グループステージのみ処理
    if (!groupStr || !groupStr.startsWith('Group')) continue;

    const group = groupStr.replace('Group ', '').trim();
    const round = parseInt(roundNumStr); // Matchday

    // チームコードに変換
    const homeCode = teamMapping[homeTeam];
    const awayCode = teamMapping[awayTeam];

    if (!homeCode || !awayCode) {
      console.warn(`Warning: Missing mapping for ${homeTeam} or ${awayTeam}`);
      continue;
    }

    // 日時をUTCからJSTに変換
    // 形式: "DD/MM/YYYY HH:mm"
    const parts = dateStr.split(' ');
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');

    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // 0-indexed
    const year = parseInt(dateParts[2]);
    const hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);

    // UTCでDateオブジェクトを作成
    const utcDate = new Date(Date.UTC(year, month, day, hour, minute));
    
    // JST (UTC+9) の日付・時刻文字列を生成
    // 時差を加算
    const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));

    const jstYear = jstDate.getUTCFullYear();
    const jstMonth = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const jstDay = String(jstDate.getUTCDate()).padStart(2, '0');
    const jstHour = String(jstDate.getUTCHours()).padStart(2, '0');
    const jstMin = String(jstDate.getUTCMinutes()).padStart(2, '0');

    const dateFormatted = `${jstYear}-${jstMonth}-${jstDay}`;
    const timeFormatted = `${jstHour}:${jstMin}`;

    matches.push({
      id: `${group}-${homeCode}-${awayCode}`,
      group,
      homeTeam: homeCode,
      awayTeam: awayCode,
      homeScore: null,
      awayScore: null,
      date: dateFormatted,
      time: timeFormatted,
      matchDay: round,
      matchNumber: matchNum
    });
  }

  return matches;
}

const content = fs.readFileSync(csvPath, 'utf8');
const parsedMatches = parseCSV(content);

// グループごとに並べ替え、さらにグループ内ではマッチデー順、キックオフ時間順、マッチ番号順に並べ替え
parsedMatches.sort((a, b) => {
  if (a.group !== b.group) return a.group.localeCompare(b.group);
  if (a.matchDay !== b.matchDay) return a.matchDay - b.matchDay;
  if (a.time !== b.time) return a.time.localeCompare(b.time);
  return a.matchNumber - b.matchNumber;
});

// ファイル出力
let output = `import type { Match } from './types';\n\n`;
output += `export const officialMatches: Match[] = [\n`;

parsedMatches.forEach((m) => {
  output += `  {\n`;
  output += `    id: '${m.id}',\n`;
  output += `    group: '${m.group}',\n`;
  output += `    homeTeam: '${m.homeTeam}',\n`;
  output += `    awayTeam: '${m.awayTeam}',\n`;
  output += `    homeScore: null,\n`;
  output += `    awayScore: null,\n`;
  output += `    date: '${m.date}',\n`;
  output += `    time: '${m.time}',\n`;
  output += `    matchDay: ${m.matchDay},\n`;
  output += `  },\n`;
});

output += `];\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(`Successfully generated JST schedule data at ${outputPath}. Total matches: ${parsedMatches.length}`);
