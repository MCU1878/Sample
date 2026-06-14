// =============================================================================
// 配線検証: knockoutLogic.ts の KNOCKOUT_CONFIGS を実際に読み取り、
// FIFA 公式トーナメント表（PDFの事実）から独立に組んだ「正解」と突き合わせる。
//   実行: node scripts/verify-bracket.mjs
// =============================================================================
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, '../src/utils/knockoutLogic.ts'), 'utf8');

// ---- 1) 実コードから各 config を抽出 ----
// "id: '...'" ごとにブロック分割し、各フィールドを個別に取り出す（行末コメントに強い）。
const configs = {};
const unq = (s) => (s === 'null' || s == null ? null : s.replace(/'/g, ''));
const blocks = src.split(/\bid:\s*'/).slice(1);
for (const b of blocks) {
  const id = b.match(/^([^']+)'/)?.[1];
  if (!id) continue;
  const f = (name, allowNull = false) => {
    const pat = allowNull
      ? new RegExp(`${name}:\\s*(null|'[^']+')`)
      : new RegExp(`${name}:\\s*'([^']+)'`);
    return b.match(pat)?.[1];
  };
  configs[id] = {
    id,
    matchNumber: Number(b.match(/matchNumber:\s*(\d+)/)?.[1]),
    team1Source: f('team1Source'),
    team2Source: f('team2Source'),
    winnerGoesTo: unq(f('winnerGoesTo', true)),
    winnerSlot: unq(f('winnerSlot', true)),
    loserGoesTo: unq(f('loserGoesTo', true)),
    loserSlot: unq(f('loserSlot', true)),
  };
}

// matchNumber -> id（実コードのマッピング）
const idOf = {};
for (const c of Object.values(configs)) idOf[c.matchNumber] = c.id;

// ---- 2) 公式ブラケット（PDFの事実）を独立に定義 ----
// num: [src1, src2, winnerToNum|null, [loserToNum|null]]
const OFFICIAL = {
  73: ['2A', '2B', 90], 74: ['1E', '3rd-E', 89], 75: ['1F', '2C', 90], 76: ['1C', '2F', 91],
  77: ['1I', '3rd-I', 89], 78: ['2E', '2I', 91], 79: ['1A', '3rd-A', 92], 80: ['1L', '3rd-L', 92],
  81: ['1D', '3rd-D', 94], 82: ['1G', '3rd-G', 94], 83: ['2K', '2L', 93], 84: ['1H', '2J', 93],
  85: ['1B', '3rd-B', 96], 86: ['1J', '2H', 95], 87: ['1K', '3rd-K', 96], 88: ['2D', '2G', 95],
  89: ['W74', 'W77', 97], 90: ['W73', 'W75', 97], 91: ['W76', 'W78', 99], 92: ['W79', 'W80', 99],
  93: ['W83', 'W84', 98], 94: ['W81', 'W82', 98], 95: ['W86', 'W88', 100], 96: ['W85', 'W87', 100],
  97: ['W89', 'W90', 101], 98: ['W93', 'W94', 101], 99: ['W91', 'W92', 102], 100: ['W95', 'W96', 102],
  101: ['W97', 'W98', 104, 103], 102: ['W99', 'W100', 104, 103],
  103: ['L101', 'L102', null], 104: ['W101', 'W102', null],
};

// 公式ソース表記 'W74'/'L101'/'2A'/'3rd-E' を、実コードのソース表記へ変換
function toCodeSource(s) {
  if (/^[WL]\d+$/.test(s)) {
    const wl = s[0];
    const num = Number(s.slice(1));
    return `${wl}-${idOf[num]}`; // 例: W74 -> W-R32-2
  }
  return s; // '2A','1E','3rd-E' はそのまま
}

// ---- 3) 突き合わせ ----
const errors = [];
// 同一 winnerGoesTo に集まる2試合のどちらが team1/team2 か（公式の記載順 src1=先）を決めるため、
// 各 nextMatch に流入する元 match を番号順で team1, team2 に割り当てる。
const feeders = {}; // nextNum -> [fromNum,...]（昇順）
for (const [numStr, info] of Object.entries(OFFICIAL)) {
  const next = info[2];
  if (next != null) (feeders[next] ??= []).push(Number(numStr));
}
for (const k of Object.keys(feeders)) feeders[k].sort((a, b) => a - b);

for (const [numStr, info] of Object.entries(OFFICIAL)) {
  const num = Number(numStr);
  const id = idOf[num];
  const cfg = configs[id];
  if (!cfg) { errors.push(`config 不在: Match ${num}`); continue; }

  // 対戦ソース
  const expS1 = toCodeSource(info[0]);
  const expS2 = toCodeSource(info[1]);
  if (cfg.team1Source !== expS1 || cfg.team2Source !== expS2) {
    errors.push(`Match ${num} (${id}) ソース不一致: 期待[${expS1} vs ${expS2}] 実際[${cfg.team1Source} vs ${cfg.team2Source}]`);
  }

  // 勝者の行き先
  const nextNum = info[2];
  if (nextNum == null) {
    if (cfg.winnerGoesTo !== null) errors.push(`Match ${num} (${id}) winnerGoesTo は null のはず`);
  } else {
    const expGoesTo = idOf[nextNum];
    const slotIdx = feeders[nextNum].indexOf(num); // 0 -> team1, 1 -> team2
    const expSlot = slotIdx === 0 ? 'team1' : 'team2';
    if (cfg.winnerGoesTo !== expGoesTo || cfg.winnerSlot !== expSlot) {
      errors.push(`Match ${num} (${id}) 勝者進出不一致: 期待[${expGoesTo}/${expSlot}] 実際[${cfg.winnerGoesTo}/${cfg.winnerSlot}]`);
    }
  }

  // 敗者の行き先（SFのみ 3位決定戦へ）
  const loserNum = info[3];
  if (loserNum != null) {
    const expLoseTo = idOf[loserNum];
    // 101->THIRD team1, 102->THIRD team2（番号順）
    const lfeeders = Object.entries(OFFICIAL).filter(([, v]) => v[3] === loserNum).map(([n]) => Number(n)).sort((a, b) => a - b);
    const expLSlot = lfeeders.indexOf(num) === 0 ? 'team1' : 'team2';
    if (cfg.loserGoesTo !== expLoseTo || cfg.loserSlot !== expLSlot) {
      errors.push(`Match ${num} (${id}) 敗者進出不一致: 期待[${expLoseTo}/${expLSlot}] 実際[${cfg.loserGoesTo}/${cfg.loserSlot}]`);
    }
  }
}

if (Object.keys(configs).length !== 32) errors.push(`config数が32でない: ${Object.keys(configs).length}`);

if (errors.length) {
  console.error(`❌ ブラケット配線 検証失敗 (${errors.length}件):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('✅ ブラケット配線 検証OK: 全32試合のソース・勝者/敗者進出先が公式トーナメント表と一致。');
