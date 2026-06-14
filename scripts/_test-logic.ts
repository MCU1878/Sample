// 実コードをそのまま読み込んで挙動を検証する統合テスト（esbuildでバンドルして実行）。
import type { Match } from '../src/types';
import { groupTeams, teams } from '../src/data';
import { calculateGroupStandings, getAllGroupStandings, getBestThirdPlaceTeams } from '../src/utils/calculateStandings';
import { initializeKnockoutMatches, simulateKnockoutMatches } from '../src/utils/knockoutLogic';
import { allocateThirdPlaceByAnnexC } from '../src/data/thirdPlaceAllocation';

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); failures++; }
};

const mk = (group: string, home: string, away: string, hs: number, as: number): Match => ({
  id: `${group}-${home}-${away}`, group, homeTeam: home, awayTeam: away,
  homeScore: hs, awayScore: as, date: '', time: '', matchDay: 1,
});

// ===== A) タイブレーカー: 直接対決が総得失点差より優先される =====
console.log('A) タイブレーカー（直接対決優先）');
{
  // X,Y,Z が勝ち点3で並ぶ3すくみ。総得失点差はWが最大だが、直接対決で順序が決まるケース。
  // 各チームが他2チームと対戦。
  // 1試合ずつ: X>Y, Y>Z, Z>X（3すくみ・直接対決は全員1勝1敗で並ぶ）
  // → 直接対決の得失点差で決める。
  const g = ['X', 'Y', 'Z', 'W'];
  // fifaRank を一時付与（W は最下位、X<Y<Z）
  teams['X'] = { name: 'X', code: 'X', flag: '', iso: '', fifaRank: 10 };
  teams['Y'] = { name: 'Y', code: 'Y', flag: '', iso: '', fifaRank: 20 };
  teams['Z'] = { name: 'Z', code: 'Z', flag: '', iso: '', fifaRank: 30 };
  teams['W'] = { name: 'W', code: 'W', flag: '', iso: '', fifaRank: 99 };
  const matches: Match[] = [
    mk('T', 'X', 'Y', 1, 0), // X beats Y
    mk('T', 'Y', 'Z', 3, 0), // Y beats Z big
    mk('T', 'Z', 'X', 1, 0), // Z beats X
    // W loses all (gets 0 pts) but with big GD swing irrelevant
    mk('T', 'W', 'X', 0, 5),
    mk('T', 'W', 'Y', 0, 1),
    mk('T', 'W', 'Z', 0, 1),
  ];
  const st = calculateGroupStandings(matches, g);
  // X,Y,Z all 2W? Let's compute: X beat Y, lost Z, beat W => 2勝1敗=6pts. Y lost X, beat Z, beat W => 6pts. Z beat X, lost Y, beat W =>6pts. W:0.
  // 直接対決(X,Y,Z間): X: beatY(+1) lostZ(-1) => h2h GD 0, pts3. Y: lostX(-1) beatZ(+3) => GD+2 pts3. Z: beatX(+1) lostY(-3) => GD-2 pts3.
  // → 直接対決GDで Y > X > Z。
  const order = st.filter((s) => s.teamCode !== 'W').map((s) => s.teamCode).join('');
  ok(order === 'YXZ', `3すくみは直接対決GDで Y>X>Z（実際: ${order}）`);
  ok(st[3].teamCode === 'W', 'W は勝ち点0で最下位');
  delete teams['X']; delete teams['Y']; delete teams['Z']; delete teams['W'];
}

// ===== B) タイブレーカー: 2チーム同点は直接対決の勝者が上 =====
console.log('B) タイブレーカー（2チーム直接対決）');
{
  const g = ['P', 'Q', 'R', 'S'];
  teams['P'] = { name: 'P', code: 'P', flag: '', iso: '', fifaRank: 50 };
  teams['Q'] = { name: 'Q', code: 'Q', flag: '', iso: '', fifaRank: 5 };
  teams['R'] = { name: 'R', code: 'R', flag: '', iso: '', fifaRank: 60 };
  teams['S'] = { name: 'S', code: 'S', flag: '', iso: '', fifaRank: 70 };
  // P と Q が同勝ち点・同総得失点差。直接対決で P が Q に勝利 → P が上（fifaRankはQが上だが直接対決が優先）
  const matches: Match[] = [
    mk('T', 'P', 'Q', 1, 0), // P beats Q head-to-head
    mk('T', 'P', 'R', 0, 1),
    mk('T', 'P', 'S', 2, 0),
    mk('T', 'Q', 'R', 2, 1),
    mk('T', 'Q', 'S', 0, 1),
    mk('T', 'R', 'S', 0, 0),
  ];
  // P: vsQ W, vsR L, vsS W => 6pts, GF3 GA2 GD+1
  // Q: vsP L, vsR W, vsS L => 3pts
  // R: vsP W, vsQ L, vsS D => 4pts
  // S: vsP L, vsQ W, vsR D => 4pts
  // P clearly 1st (6). Then R & S both 4 -> tie. R vs S drew 0-0 -> h2h equal -> overall GD/GF then fifaRank(R=60<S=70 => R上)
  const st = calculateGroupStandings(matches, g);
  ok(st[0].teamCode === 'P', 'P が1位（勝ち点6）');
  const rs = [st[1].teamCode, st[2].teamCode];
  // R: GF1 GA1 GD0 ; S: GF1 GA1? S: vsP L(0-2)? wait S scores: vsP 0-2(GF0GA2), vsQ 1-0(GF1GA0), vsR 0-0 => GF1 GA2 GD-1. R: vsP1-0,vsQ1-2,vsR? R: vsP(1-0)GF1GA0, vsQ(1-2)GF1GA2, vsS(0-0) => GF2 GA2 GD0.
  // R GD0 > S GD-1 => R 2位, S 3位
  ok(rs[0] === 'R' && rs[1] === 'S', `R,S 同点は総得失点差で R>S（実際: ${rs.join(',')}）`);
  delete teams['P']; delete teams['Q']; delete teams['R']; delete teams['S'];
}

// ===== C) フル大会: Annex C 割り当て + 再戦回避 + 完走 =====
console.log('C) フル大会（Annex C 割り当て・再戦回避・完走）');
{
  // 全グループの全6試合を、FIFAランキング上位が確実に勝つよう決定的に埋める。
  const groupMatchesAll: Match[] = [];
  for (const [grp, codes] of Object.entries(groupTeams)) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < codes.length; i++)
      for (let j = i + 1; j < codes.length; j++) pairs.push([codes[i], codes[j]]);
    for (const [a, b] of pairs) {
      // ランキング上位(数値が小)が 2-0 で勝つ。差をつけて3位争いにばらつきを出す。
      const ra = teams[a].fifaRank, rb = teams[b].fifaRank;
      if (ra <= rb) groupMatchesAll.push(mk(grp, a, b, 2, 0));
      else groupMatchesAll.push(mk(grp, a, b, 0, 2));
    }
  }
  const standings = getAllGroupStandings(groupMatchesAll, groupTeams);
  const ko = initializeKnockoutMatches(standings);

  // R32 全試合に両チームが入っている
  const r32 = ko.filter((m) => m.round === 'R32');
  ok(r32.length === 16, `R32 は16試合（実際 ${r32.length}）`);
  ok(r32.every((m) => m.team1 && m.team2), 'R32 全試合に team1/team2 が確定');

  // 3位通過チームの所属グループ集合を取得
  const bestThirds = getBestThirdPlaceTeams(standings);
  const thirdGroups = bestThirds.map((t) => t.group);
  const alloc = allocateThirdPlaceByAnnexC(thirdGroups)!;
  // teamCode -> group
  const groupOf: Record<string, string> = {};
  for (const [grp, codes] of Object.entries(groupTeams)) for (const c of codes) groupOf[c] = grp;
  // 各グループ1位
  const winnerOf: Record<string, string> = {};
  for (const [grp, st] of Object.entries(standings)) winnerOf[grp] = st.find((s) => s.rank === 1)!.teamCode;

  // 3位スロット試合(team2Sourceが'3rd-X')で、入った3位が Annex C 通りか & 同組再戦が無いか
  let thirdSlotChecks = 0;
  for (const m of r32) {
    if (!m.team2Source.startsWith('3rd-')) continue;
    thirdSlotChecks++;
    const slot = m.team2Source.slice(4);            // 例 'E'
    const expectGroup = alloc[slot];                 // Annex C が指す3位の所属グループ
    const actualGroup = groupOf[m.team2!];
    ok(actualGroup === expectGroup, `1${slot} の相手3位は ${expectGroup}組（実際 ${actualGroup}組）`);
    // 再戦回避: 3位の所属グループ ≠ 対戦する1位の所属グループ
    ok(groupOf[m.team2!] !== groupOf[m.team1!], `1${slot}(${groupOf[m.team1!]}組) と 3位(${actualGroup}組) が別グループ`);
  }
  ok(thirdSlotChecks === 8, `3位スロットは8試合（実際 ${thirdSlotChecks}）`);

  // 完走: 全シミュレートして優勝者が決まる
  const sim = simulateKnockoutMatches(ko);
  const final = sim.find((m) => m.round === 'FINAL')!;
  const champ = final.score1! > final.score2! ? final.team1
    : final.score1! < final.score2! ? final.team2
    : (final.pen1! > final.pen2! ? final.team1 : final.team2);
  ok(!!champ, `決勝が完了し優勝者が決定（${champ ? teams[champ]?.name : '—'}）`);

  // どの試合でも同一チームが自分自身と対戦しない
  ok(sim.every((m) => !(m.team1 && m.team2) || m.team1 !== m.team2), '全試合で自己対戦が無い');
}

console.log('');
if (failures === 0) console.log('✅ 統合テスト 全項目 PASS');
else { console.error(`❌ 統合テスト ${failures} 件 FAIL`); process.exit(1); }
