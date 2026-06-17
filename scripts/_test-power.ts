// マルチソース・パワーランキング（アンサンブル）の検証。
import { powerQuality, activeSources, powerBreakdown } from '../src/utils/powerRankings';
import { groupTeams } from '../src/data';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}`, extra ?? ''); }
}

const ALL = Object.values(groupTeams).flat();

console.log('A) ソース構成');
{
  const s = activeSources();
  console.log('   使用ソース:', s.map((x) => x.label).join(' / '));
  check('5系統以上（FIFA + Elo + 4外部 = 6）', s.length >= 5, s.length);
}

console.log('B) 全48チームが [0,1] のパワー指数を持つ');
{
  let ok = true;
  for (const c of ALL) {
    const q = powerQuality(c);
    if (!(q >= 0 && q <= 1)) { ok = false; console.log('   範囲外:', c, q); }
  }
  check('全チーム 0〜1', ok);
  check('チーム数48', ALL.length === 48, ALL.length);
}

console.log('C) 序列の妥当性');
{
  const q = (c: string) => powerQuality(c);
  check('スペインは最上位帯（>0.9）', q('ESP') > 0.9, q('ESP'));
  check('強豪 > 中堅 > 弱小（ESP>JPN>HAI）', q('ESP') > q('JPN') && q('JPN') > q('HAI'), [q('ESP'), q('JPN'), q('HAI')]);
  check('最弱帯は低い（CUW<0.2）', q('CUW') < 0.2, q('CUW'));
  const ranked = [...ALL].sort((a, b) => q(b) - q(a));
  console.log('   上位8:', ranked.slice(0, 8).map((c) => `${c}:${q(c).toFixed(2)}`).join(' '));
  console.log('   下位5:', ranked.slice(-5).map((c) => `${c}:${q(c).toFixed(2)}`).join(' '));
  check('上位帯にESP/FRA/ARGが含まれる', ['ESP', 'FRA', 'ARG'].every((c) => ranked.slice(0, 6).includes(c)));
}

console.log('D) 欠損ソースの扱い（Opta欠損のGERでも算出できる）');
{
  const b = powerBreakdown('GER');
  const opta = b.perSource.find((s) => s.key === 'opta');
  check('GERのOptaは欠損(undefined)', opta?.normalized === undefined, opta);
  check('GERでもパワー指数は有効値', powerQuality('GER') > 0.7, powerQuality('GER'));
}

console.log('');
if (failures === 0) console.log('✅ 全テスト合格');
else { console.log(`❌ ${failures} 件失敗`); process.exit(1); }
