import type { TeamStanding, KnockoutMatch, KnockoutRound } from '../types';
import { getBestThirdPlaceTeams } from './calculateStandings';
// Empty line or just remove it
import { allocateThirdPlaceByAnnexC } from '../data/thirdPlaceAllocation';
import { createTeamAgent, simulateMatchRich, calculateTournamentFatigue } from './matchEngine';
import { initRatings } from './ratingModel';
import { rngFromKey } from './rng';

const KNOCKOUT_CLIMATES: Record<string, 'temperate' | 'hot_humid' | 'hot_dry' | 'high_altitude'> = {
  'R32-1': 'hot_dry', 'R32-2': 'hot_humid', 'R32-3': 'hot_dry', 'R32-4': 'hot_humid',
  'R32-5': 'temperate', 'R32-6': 'hot_dry', 'R32-7': 'high_altitude', 'R32-8': 'temperate',
  'R32-9': 'hot_dry', 'R32-10': 'temperate', 'R32-11': 'high_altitude', 'R32-12': 'hot_humid',
  'R32-13': 'temperate', 'R32-14': 'hot_dry', 'R32-15': 'hot_humid', 'R32-16': 'temperate',
  'R16-1': 'hot_dry', 'R16-2': 'temperate', 'R16-3': 'hot_humid', 'R16-4': 'high_altitude',
  'R16-5': 'hot_dry', 'R16-6': 'temperate', 'R16-7': 'hot_humid', 'R16-8': 'temperate',
  'QF-1': 'hot_dry', 'QF-2': 'temperate', 'QF-3': 'hot_humid', 'QF-4': 'temperate',
  'SF-1': 'hot_dry', 'SF-2': 'temperate',
  'THIRD': 'hot_dry', 'FINAL': 'temperate'
};

// ノックアウトステージの各試合の静的構造定義
interface KnockoutConfig {
  id: string;
  round: KnockoutRound;
  matchNumber: number;
  label: string;
  date: string;
  team1Source: string; // "1A", "2C", "W-R32-1" など
  team2Source: string;
  winnerGoesTo: string | null;
  winnerSlot: 'team1' | 'team2' | null;
  loserGoesTo: string | null;  // 3位決定戦用 (SFのみ)
  loserSlot: 'team1' | 'team2' | null;
}

// ▼ 公式トーナメント表（FIFA WC2026 / 付属書C）に厳密準拠した配線。
//   id は R32-1..16 / R16-1..8 / QF-1..4 / SF-1,2 / THIRD / FINAL を維持しつつ、
//   matchNumber 73〜104・対戦カード・勝ち上がり先(winnerGoesTo) を公式通りに設定する。
//   3位スロットの team2Source '3rd-X' は「1X位スロット」を表し、Annex C で実チームに解決する。
const KNOCKOUT_CONFIGS: KnockoutConfig[] = [
  // ===== Round of 32 (Match 73〜88) =====
  {
    id: 'R32-1', round: 'R32', matchNumber: 73, label: 'Match 73', date: '2026-06-29 04:00',
    team1Source: '2A', team2Source: '2B',
    winnerGoesTo: 'R16-2', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-2', round: 'R32', matchNumber: 74, label: 'Match 74', date: '2026-06-30 05:30',
    team1Source: '1E', team2Source: '3rd-E', // 3rd A/B/C/D/F
    winnerGoesTo: 'R16-1', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-3', round: 'R32', matchNumber: 75, label: 'Match 75', date: '2026-06-30 10:00',
    team1Source: '1F', team2Source: '2C',
    winnerGoesTo: 'R16-2', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-4', round: 'R32', matchNumber: 76, label: 'Match 76', date: '2026-06-30 02:00',
    team1Source: '1C', team2Source: '2F',
    winnerGoesTo: 'R16-3', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-5', round: 'R32', matchNumber: 77, label: 'Match 77', date: '2026-07-01 06:00',
    team1Source: '1I', team2Source: '3rd-I', // 3rd C/D/F/G/H
    winnerGoesTo: 'R16-1', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-6', round: 'R32', matchNumber: 78, label: 'Match 78', date: '2026-07-01 02:00',
    team1Source: '2E', team2Source: '2I',
    winnerGoesTo: 'R16-3', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-7', round: 'R32', matchNumber: 79, label: 'Match 79', date: '2026-07-01 10:00',
    team1Source: '1A', team2Source: '3rd-A', // 3rd C/E/F/H/I
    winnerGoesTo: 'R16-4', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-8', round: 'R32', matchNumber: 80, label: 'Match 80', date: '2026-07-02 01:00',
    team1Source: '1L', team2Source: '3rd-L', // 3rd E/H/I/J/K
    winnerGoesTo: 'R16-4', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-9', round: 'R32', matchNumber: 81, label: 'Match 81', date: '2026-07-02 09:00',
    team1Source: '1D', team2Source: '3rd-D', // 3rd B/E/F/I/J
    winnerGoesTo: 'R16-6', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-10', round: 'R32', matchNumber: 82, label: 'Match 82', date: '2026-07-02 05:00',
    team1Source: '1G', team2Source: '3rd-G', // 3rd A/E/H/I/J
    winnerGoesTo: 'R16-6', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-11', round: 'R32', matchNumber: 83, label: 'Match 83', date: '2026-07-03 08:00',
    team1Source: '2K', team2Source: '2L',
    winnerGoesTo: 'R16-5', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-12', round: 'R32', matchNumber: 84, label: 'Match 84', date: '2026-07-03 04:00',
    team1Source: '1H', team2Source: '2J',
    winnerGoesTo: 'R16-5', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-13', round: 'R32', matchNumber: 85, label: 'Match 85', date: '2026-07-03 12:00',
    team1Source: '1B', team2Source: '3rd-B', // 3rd E/F/G/I/J
    winnerGoesTo: 'R16-8', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-14', round: 'R32', matchNumber: 86, label: 'Match 86', date: '2026-07-04 07:00',
    team1Source: '1J', team2Source: '2H',
    winnerGoesTo: 'R16-7', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-15', round: 'R32', matchNumber: 87, label: 'Match 87', date: '2026-07-04 10:30',
    team1Source: '1K', team2Source: '3rd-K', // 3rd D/E/I/J/L
    winnerGoesTo: 'R16-8', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R32-16', round: 'R32', matchNumber: 88, label: 'Match 88', date: '2026-07-04 03:00',
    team1Source: '2D', team2Source: '2G',
    winnerGoesTo: 'R16-7', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },

  // ===== Round of 16 (Match 89〜96) =====
  {
    id: 'R16-1', round: 'R16', matchNumber: 89, label: 'Match 89', date: '2026-07-05 06:00',
    team1Source: 'W-R32-2', team2Source: 'W-R32-5', // W74 vs W77
    winnerGoesTo: 'QF-1', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R16-2', round: 'R16', matchNumber: 90, label: 'Match 90', date: '2026-07-05 02:00',
    team1Source: 'W-R32-1', team2Source: 'W-R32-3', // W73 vs W75
    winnerGoesTo: 'QF-1', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R16-3', round: 'R16', matchNumber: 91, label: 'Match 91', date: '2026-07-06 05:00',
    team1Source: 'W-R32-4', team2Source: 'W-R32-6', // W76 vs W78
    winnerGoesTo: 'QF-3', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R16-4', round: 'R16', matchNumber: 92, label: 'Match 92', date: '2026-07-06 09:00',
    team1Source: 'W-R32-7', team2Source: 'W-R32-8', // W79 vs W80
    winnerGoesTo: 'QF-3', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R16-5', round: 'R16', matchNumber: 93, label: 'Match 93', date: '2026-07-07 04:00',
    team1Source: 'W-R32-11', team2Source: 'W-R32-12', // W83 vs W84
    winnerGoesTo: 'QF-2', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R16-6', round: 'R16', matchNumber: 94, label: 'Match 94', date: '2026-07-07 09:00',
    team1Source: 'W-R32-9', team2Source: 'W-R32-10', // W81 vs W82
    winnerGoesTo: 'QF-2', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R16-7', round: 'R16', matchNumber: 95, label: 'Match 95', date: '2026-07-08 01:00',
    team1Source: 'W-R32-14', team2Source: 'W-R32-16', // W86 vs W88
    winnerGoesTo: 'QF-4', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'R16-8', round: 'R16', matchNumber: 96, label: 'Match 96', date: '2026-07-08 05:00',
    team1Source: 'W-R32-13', team2Source: 'W-R32-15', // W85 vs W87
    winnerGoesTo: 'QF-4', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },

  // ===== Quarterfinals (Match 97〜100) =====
  {
    id: 'QF-1', round: 'QF', matchNumber: 97, label: 'Match 97', date: '2026-07-10 05:00',
    team1Source: 'W-R16-1', team2Source: 'W-R16-2', // W89 vs W90
    winnerGoesTo: 'SF-1', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'QF-2', round: 'QF', matchNumber: 98, label: 'Match 98', date: '2026-07-11 04:00',
    team1Source: 'W-R16-5', team2Source: 'W-R16-6', // W93 vs W94
    winnerGoesTo: 'SF-1', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'QF-3', round: 'QF', matchNumber: 99, label: 'Match 99', date: '2026-07-12 06:00',
    team1Source: 'W-R16-3', team2Source: 'W-R16-4', // W91 vs W92
    winnerGoesTo: 'SF-2', winnerSlot: 'team1', loserGoesTo: null, loserSlot: null
  },
  {
    id: 'QF-4', round: 'QF', matchNumber: 100, label: 'Match 100', date: '2026-07-12 10:00',
    team1Source: 'W-R16-7', team2Source: 'W-R16-8', // W95 vs W96
    winnerGoesTo: 'SF-2', winnerSlot: 'team2', loserGoesTo: null, loserSlot: null
  },

  // ===== Semifinals (Match 101〜102) =====
  {
    id: 'SF-1', round: 'SF', matchNumber: 101, label: 'Match 101', date: '2026-07-15 04:00',
    team1Source: 'W-QF-1', team2Source: 'W-QF-2', // W97 vs W98
    winnerGoesTo: 'FINAL', winnerSlot: 'team1', loserGoesTo: 'THIRD', loserSlot: 'team1'
  },
  {
    id: 'SF-2', round: 'SF', matchNumber: 102, label: 'Match 102', date: '2026-07-16 04:00',
    team1Source: 'W-QF-3', team2Source: 'W-QF-4', // W99 vs W100
    winnerGoesTo: 'FINAL', winnerSlot: 'team2', loserGoesTo: 'THIRD', loserSlot: 'team2'
  },

  // ===== Third Place Play-off (Match 103) =====
  {
    id: 'THIRD', round: 'THIRD', matchNumber: 103, label: 'Match 103', date: '2026-07-19 06:00',
    team1Source: 'L-SF-1', team2Source: 'L-SF-2',
    winnerGoesTo: null, winnerSlot: null, loserGoesTo: null, loserSlot: null
  },

  // ===== Final (Match 104) =====
  {
    id: 'FINAL', round: 'FINAL', matchNumber: 104, label: 'Match 104', date: '2026-07-20 04:00',
    team1Source: 'W-SF-1', team2Source: 'W-SF-2',
    winnerGoesTo: null, winnerSlot: null, loserGoesTo: null, loserSlot: null
  }
];

/**
 * グループ順位表からノックアウトステージ（Round of 32）の全枠を初期化する。
 * 3位8チームの割り当ては FIFA 公式 付属書C の495通り対応表に厳密準拠する。
 */
export function initializeKnockoutMatches(
  allStandings: Record<string, TeamStanding[]>
): KnockoutMatch[] {
  // 1. 各グループの1位と2位を決定
  const groupWinners: Record<string, string> = {}; // "A" -> "MEX"
  const groupRunnersUp: Record<string, string> = {}; // "A" -> "KOR"

  for (const [group, standings] of Object.entries(allStandings)) {
    const w = standings.find((s) => s.rank === 1);
    const r = standings.find((s) => s.rank === 2);
    if (w) groupWinners[group] = w.teamCode;
    if (r) groupRunnersUp[group] = r.teamCode;
  }

  // 2. ベスト3位の8チームを抽出し、Annex C で各1位スロットへ割り当て
  const bestThirds = getBestThirdPlaceTeams(allStandings);
  // 通過3位の「所属グループ → そのグループ3位のチームコード」マップ
  const thirdTeamByGroup: Record<string, string> = {};
  for (const t of bestThirds) thirdTeamByGroup[t.group] = t.teamCode;
  // 付属書Cによる割り当て（1位スロット文字 → 入る3位の所属グループ）。8チーム未確定なら null。
  const slotToGroup = allocateThirdPlaceByAnnexC(bestThirds.map((t) => t.group));

  // 3. 静的構成から試合リストを生成
  return KNOCKOUT_CONFIGS.map((config) => {
    let team1: string | null = null;
    let team2: string | null = null;

    if (config.round === 'R32') {
      // Team 1
      if (config.team1Source.startsWith('1')) {
        team1 = groupWinners[config.team1Source[1]] ?? null;
      } else if (config.team1Source.startsWith('2')) {
        team1 = groupRunnersUp[config.team1Source[1]] ?? null;
      }

      // Team 2
      if (config.team2Source.startsWith('1')) {
        team2 = groupWinners[config.team2Source[1]] ?? null;
      } else if (config.team2Source.startsWith('2')) {
        team2 = groupRunnersUp[config.team2Source[1]] ?? null;
      } else if (config.team2Source.startsWith('3rd-')) {
        // '3rd-E' → 1E位スロット。Annex C が指定する所属グループの3位チームを入れる
        const winnerGroup = config.team2Source.slice(4);
        const assignedGroup = slotToGroup ? slotToGroup[winnerGroup] : null;
        team2 = assignedGroup ? thirdTeamByGroup[assignedGroup] ?? null : null;
      }
    }

    return {
      id: config.id,
      round: config.round,
      matchNumber: config.matchNumber,
      label: config.label,
      team1,
      team2,
      score1: null,
      score2: null,
      pen1: null,
      pen2: null,
      date: config.date,
      team1Source: config.team1Source,
      team2Source: config.team2Source,
      winnerGoesTo: config.winnerGoesTo,
      winnerSlot: config.winnerSlot,
      loserGoesTo: config.loserGoesTo,
      loserSlot: config.loserSlot,
      climate: KNOCKOUT_CLIMATES[config.id] || 'temperate',
    };
  });
}

/**
 * 特定の試合のスコア（および必要に応じてPK）の変更をノックアウトツリーに伝播させる
 */
export function updateKnockoutProgression(
  matches: KnockoutMatch[],
  matchId: string,
  updates: Partial<Pick<KnockoutMatch, 'score1' | 'score2' | 'pen1' | 'pen2' | 'matchLog'>>
): KnockoutMatch[] {
  // まず変更を対象の試合に適用
  let updated = matches.map((m) => {
    if (m.id !== matchId) return m;
    return { ...m, ...updates };
  });

  // 勝敗を判定し、勝者（と敗者）を決定
  const determineWinner = (m: KnockoutMatch): { winner: string | null; loser: string | null } => {
    if (m.score1 === null || m.score2 === null) return { winner: null, loser: null };

    if (m.score1 > m.score2) return { winner: m.team1, loser: m.team2 };
    if (m.score1 < m.score2) return { winner: m.team2, loser: m.team1 };

    // 引き分けの場合はPK
    if (m.pen1 !== null && m.pen2 !== null) {
      if (m.pen1 > m.pen2) return { winner: m.team1, loser: m.team2 };
      if (m.pen1 < m.pen2) return { winner: m.team2, loser: m.team1 };
    }
    return { winner: null, loser: null };
  };

  // 変更の伝播（キューを用いたトポロジカル順の処理）
  // ノックアウトの依存関係は閉路のない木構造（DAG）なので、依存順に解決する
  // 今回は試合数が32と少ないため、簡単な反復処理で依存伝播を完了できる
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;

    updated = updated.map((m) => {
      // 各試合について、現在の進出元ソース（勝者・敗者）の最新の値をチェックして更新する
      let t1 = m.team1;
      let t2 = m.team2;

      // Team 1のソースチェック (例: "W-R32-1", "L-SF-1")
      if (m.team1Source.startsWith('W-') || m.team1Source.startsWith('L-')) {
        const sourceId = m.team1Source.substring(2); // "R32-1" や "SF-1"
        const sourceMatch = updated.find((x) => x.id === sourceId);
        if (sourceMatch) {
          const { winner, loser } = determineWinner(sourceMatch);
          const expected = m.team1Source.startsWith('W-') ? winner : loser;
          if (t1 !== expected) {
            t1 = expected;
            changed = true;
          }
        }
      }

      // Team 2のソースチェック
      if (m.team2Source.startsWith('W-') || m.team2Source.startsWith('L-')) {
        const sourceId = m.team2Source.substring(2);
        const sourceMatch = updated.find((x) => x.id === sourceId);
        if (sourceMatch) {
          const { winner, loser } = determineWinner(sourceMatch);
          const expected = m.team2Source.startsWith('W-') ? winner : loser;
          if (t2 !== expected) {
            t2 = expected;
            changed = true;
          }
        }
      }

      // チームが「別のチームに変更された」または「未決定(null)に戻った」場合のみ、スコアをリセットする
      const t1LostOrChanged = (m.team1 !== null && t1 === null) || (m.team1 !== null && t1 !== null && m.team1 !== t1);
      const t2LostOrChanged = (m.team2 !== null && t2 === null) || (m.team2 !== null && t2 !== null && m.team2 !== t2);
      const teamResetNeeded = t1LostOrChanged || t2LostOrChanged;

      return {
        ...m,
        team1: t1,
        team2: t2,
        score1: teamResetNeeded ? null : m.score1,
        score2: teamResetNeeded ? null : m.score2,
        pen1: teamResetNeeded ? null : m.pen1,
        pen2: teamResetNeeded ? null : m.pen2,
      };
    });
  }

  return updated;
}

/**
 * 全てのノックアウト試合をシミュレートする（ランダム決定）
 */
export function simulateKnockoutMatches(matches: KnockoutMatch[]): KnockoutMatch[] {
  let currentMatches = [...matches];
  const ratings = initRatings();
  
  // チームコード -> 現在の大会疲労
  const fatigueMap: Record<string, number> = {};

  // 試合番号順（Match 73から104）にシミュレートを処理
  const sorted = [...currentMatches].sort((a, b) => a.matchNumber - b.matchNumber);

  for (const match of sorted) {
    const activeMatch = currentMatches.find((m) => m.id === match.id);
    if (!activeMatch || !activeMatch.team1 || !activeMatch.team2) continue;

    // スコアがすでに入力されている場合はそのまま
    if (activeMatch.score1 !== null && activeMatch.score2 !== null) {
      // 引き続き疲労計算だけは行うためにAgent化して扱うなら（今回は省略）
      continue;
    }

    // Retrieve or initialize tournament fatigue
    const hFatigue = fatigueMap[activeMatch.team1] || 0;
    const aFatigue = fatigueMap[activeMatch.team2] || 0;

    // Create agents
    const homeAgent = createTeamAgent(activeMatch.team1, ratings, hFatigue);
    const awayAgent = createTeamAgent(activeMatch.team2, ratings, aFatigue);

    // Run rich simulation (with extra time & penalties)
    // 試合ID由来の固定シードで決定論的に。→ 同じ盤面なら毎回同じトーナメント結果になる。
    const log = simulateMatchRich(homeAgent, awayAgent, {
      isKnockout: true,
      climate: activeMatch.climate,
      rng: rngFromKey('ko|' + activeMatch.id + '|' + activeMatch.team1 + '-' + activeMatch.team2),
    });

    // Update match with scores
    currentMatches = updateKnockoutProgression(currentMatches, activeMatch.id, {
      score1: log.homeScore,
      score2: log.awayScore,
      pen1: log.homePenScore,
      pen2: log.awayPenScore,
      matchLog: log,
    });

    // Accumulate fatigue for the next match
    fatigueMap[activeMatch.team1] = calculateTournamentFatigue(hFatigue, log.homeEndStamina, log.isExtraTime);
    fatigueMap[activeMatch.team2] = calculateTournamentFatigue(aFatigue, log.awayEndStamina, log.isExtraTime);
  }

  return currentMatches;
}
