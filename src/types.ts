// ===== 型定義 =====

export interface Team {
  name: string;
  code: string;
  flag: string; // emoji flag
  iso: string;  // ISO 2-letter code for flag images (flagcdn.com)
  rating: number; // サッカーの強さレーティング (50〜99)
}

export interface Match {
  id: string;
  group: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  date: string;     // "2026-06-11"
  time: string;     // "16:00"
  matchDay: number; // 1, 2, or 3
}

export interface TeamStanding {
  teamCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  rank: number;
}

export interface GroupStandings {
  group: string;
  standings: TeamStanding[];
}

export interface BracketMatch {
  id: string;
  label: string;
  team1: string | null;
  team2: string | null;
}

export type KnockoutRound = 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD' | 'FINAL';

export interface KnockoutMatch {
  id: string;
  round: KnockoutRound;
  matchNumber: number;
  label: string;
  team1: string | null;
  team2: string | null;
  score1: number | null;
  score2: number | null;
  pen1: number | null;
  pen2: number | null;
  date: string;
  // Sources for auto-population
  team1Source: string; // e.g., "1A", "W-R32-1", "L-SF-1"
  team2Source: string;
  // Bracket progression
  winnerGoesTo: string | null;   // next match id
  winnerSlot: 'team1' | 'team2' | null;
  loserGoesTo: string | null;    // for SF losers → 3rd place
  loserSlot: 'team1' | 'team2' | null;
}
