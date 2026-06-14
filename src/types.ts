// ===== 型定義 =====

export interface Team {
  name: string;
  code: string;
  flag: string; // emoji flag
  iso: string;  // ISO 2-letter code for flag images (flagcdn.com)
  fifaRank: number; // FIFA Men's World Ranking (1〜100+)
  eloRating?: number;
  climateAdaptation?: 'temperate' | 'tropical' | 'desert' | 'high_altitude' | 'hot_humid' | 'hot_dry';
}

export interface Player {
  id: string;        // e.g. "JPN-1"
  name: string;      // e.g. "Takefusa Kubo"
  position: 'GK' | 'DF' | 'MF' | 'FW';
  // Below properties can be simulated/derived in matchEngine
  overall?: number;  
  stamina?: number;
}

export interface Match {
  id: string;
  group?: string; // 'A' - 'L'
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  date: string;     // "2026-06-11"
  time: string;     // "16:00"
  matchDay: number; // 1, 2, or 3
  syncStatus?: 'live' | 'finished';
  climate?: 'temperate' | 'hot_humid' | 'hot_dry' | 'high_altitude';
  matchLog?: MatchLog;
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
  // Agent engine match log (optional, populated by rich simulation)
  matchLog?: MatchLog;
  climate?: 'temperate' | 'hot_humid' | 'hot_dry' | 'high_altitude';
}

// ===== Agent-Based Match Engine Types =====

export interface TeamAgent {
  code: string;
  // Base parameters (derived from Bayesian ratings)
  attackPower: number;     // [0.5 ~ 2.0]
  defensePower: number;    // [0.5 ~ 2.0]
  // Dynamic parameters (change during match)
  stamina: number;         // [0.0 ~ 1.0] — starts at 1.0, depletes over time
  momentum: number;        // [-1.0 ~ 1.0] — surges on goals/cards
  redCards: number;        // number of red cards received
  yellowCards: number;     // number of yellow cards received
  // Tournament-wide fatigue (knockout stage)
  tournamentFatigue: number; // [0.0 ~ 0.5] — accumulated from previous matches
  staminaMultiplier: number; // 1.0 = normal, 1.2 = faster depletion due to climate
  roster?: Player[];
}

export type MatchEventType =
  | 'GOAL'
  | 'RED_CARD'
  | 'YELLOW_CARD'
  | 'MOMENTUM_SHIFT'
  | 'INJURY'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'EXTRA_TIME'
  | 'PENALTY_KICK';

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  team: string;            // team code
  playerId?: string;       // main player involved (goalscorer, booked player)
  assistId?: string;       // player who assisted (for GOAL)
  description: string;     // narrative text
}

export interface MatchStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  expectedGoals: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

export interface PlayerMatchRating {
  playerId: string;
  rating: number; // 0.0 - 10.0
}

export interface MatchLog {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homePenScore: number | null;
  awayPenScore: number | null;
  events: MatchEvent[];
  winner: string | null;          // null = draw (group stage)
  isExtraTime: boolean;
  isPenaltyShootout: boolean;
  homeEndStamina: number;
  awayEndStamina: number;
  playerRatings?: PlayerMatchRating[];
  homeStats?: MatchStats;
  awayStats?: MatchStats;
}
