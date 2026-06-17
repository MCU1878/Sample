// =============================================================================
// Agent-Based Match Engine
// -----------------------------------------------------------------------------
// チームを「攻撃力・守備力・スタミナ・勢い」を持つエージェントとしてモデル化し、
// 試合を分単位のイベント（得点・勢いの振れ・疲労蓄積・退場）で生成する。
// =============================================================================

import type { TeamAgent, MatchEvent, MatchLog, PlayerMatchRating } from '../types';
import { teams } from '../data';
import type { RatingMap } from './ratingModel';
import { initRatings, expectedLambdas } from './ratingModel';
import { poissonSample } from './forecast';
import type { Intent } from './situationalPlay';
import playersDataRaw from '../data/players.json';
import type { Player } from '../types';

const playersData = playersDataRaw as Record<string, Player[]>;

function pickPlayerByPosition(roster: Player[] | undefined, pos: string, rng: Rng) {
  if (!roster || roster.length === 0) return null;
  const players = roster.filter(p => p.position === pos);
  if (players.length > 0) return players[Math.floor(rng() * players.length)];
  return roster[Math.floor(rng() * roster.length)];
}

// ===== Constants =====

/** カード確率 (per minute per team) */
const YELLOW_CARD_BASE_RATE = 3.2 / 90;   // 1試合平均3.2枚/チーム→両チーム合計6.4枚
const RED_CARD_BASE_RATE = 0.13 / 90;     // W杯平均 ~0.26枚/試合 = 0.13/チーム

/** 負傷確率 (per minute per team) */
const INJURY_BASE_RATE = 0.004;

/** スタミナ消耗（1分あたり） */
const STAMINA_DEPLETION_RATE = 0.008;

/** 勢いの自然減衰率 (per minute) */
const MOMENTUM_DECAY = 0.97;

/** 勢いランダムシフトの確率 */
const MOMENTUM_RANDOM_SHIFT_PROB = 0.02;

// ===== RNG =====

export type Rng = () => number;

function defaultRng(): number {
  return Math.random();
}

// ===== Team Agent Creation =====

export function createTeamAgent(
  code: string,
  ratings?: RatingMap,
  tournamentFatigue: number = 0,
  matchClimate: 'temperate' | 'hot_humid' | 'hot_dry' | 'high_altitude' = 'temperate'
): TeamAgent {
  const r = ratings?.[code];
  let attackPower = 1.0;
  let defensePower = 1.0;

  const teamData = teams[code];
  const rank = teamData?.fifaRank ?? 50;
  const elo = teamData?.eloRating ?? 1700;

  if (r) {
    // レーティングの mean (typically -0.5 ~ +0.5) を [0.5 ~ 2.0] にマッピング
    attackPower = clamp(Math.exp(r.attack.mean), 0.5, 2.0);
    defensePower = clamp(Math.exp(r.defense.mean), 0.5, 2.0);
  } else {
    // FIFAランクとEloレーティングのブレンド (Eloを少し重視)
    const fifaQuality = (100 - Math.max(1, Math.min(100, rank))) / 100;
    const eloQuality = Math.max(0, Math.min(1, (elo - 1400) / 800));
    const blendedQuality = fifaQuality * 0.4 + eloQuality * 0.6;
    
    attackPower = clamp(0.7 + blendedQuality * 1.0, 0.5, 2.0);
    defensePower = clamp(0.7 + blendedQuality * 1.0, 0.5, 2.0);
  }

  // ホームアドバンテージ（開催国ブースト）
  const isHostNation = ['USA', 'MEX', 'CAN'].includes(code);
  if (isHostNation) {
    attackPower *= 1.08;
    defensePower *= 1.05;
  }

  // 気候によるスタミナ減少ペナルティ計算
  const teamClimate = teamData?.climateAdaptation || 'temperate';
  let staminaMultiplier = 1.0;

  if (matchClimate === 'high_altitude') {
    if (teamClimate !== 'high_altitude') staminaMultiplier = 1.25;
  } else if (matchClimate === 'hot_humid') {
    if (teamClimate === 'temperate') staminaMultiplier = 1.15;
    else if (teamClimate === 'desert' || teamClimate === 'high_altitude') staminaMultiplier = 1.05;
  } else if (matchClimate === 'hot_dry') {
    if (teamClimate === 'temperate') staminaMultiplier = 1.10;
    else if (teamClimate === 'tropical' || teamClimate === 'high_altitude') staminaMultiplier = 1.05;
  }

  const initialStamina = clamp(1.0 - tournamentFatigue * 0.4, 0.5, 1.0);

  return {
    code,
    attackPower,
    defensePower,
    stamina: initialStamina,
    momentum: 0,
    redCards: 0,
    yellowCards: 0,
    tournamentFatigue,
    staminaMultiplier,
    roster: playersData[code] || [],
  };
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

// ===== Helper Functions for Scripted Match Engine =====

function getRealisticScore(
  lambdaHome: number,
  lambdaAway: number,
  isKnockout: boolean,
  sH: number,
  sA: number,
  rng: Rng
) {
  // 10000回のシミュレーションから「最も確率が高い1点」を固定するのではなく、
  // ポアソン分布の確率曲線に基づいた「リアルな1試合」を直接抽出します。
  // これにより、3-0や4-1といったスコアも（現実と同じ正しい確率で）自然発生するようになります。
  let gh = poissonSample(lambdaHome, rng);
  let ga = poissonSample(lambdaAway, rng);
  let etH = 0, etA = 0, pkH = 0, pkA = 0;

  if (isKnockout && gh === ga) {
    etH = poissonSample(lambdaHome * 0.33, rng);
    etA = poissonSample(lambdaAway * 0.33, rng);
    if (gh + etH === ga + etA) {
      const diff = sH - sA;
      const pHome = 1 / (1 + Math.exp(-0.5 * diff));
      if (rng() < pHome) pkH = 1;
      else pkA = 1;
    }
  }

  return { gh, ga, etH, etA, pkH, pkA };
}

function generateGoalMinutes(count: number, maxMin: number, rng: Rng): number[] {
  const mins: number[] = [];
  for (let i = 0; i < count; i++) {
    mins.push(1 + Math.floor(rng() * maxMin));
  }
  return mins.sort((a, b) => a - b);
}

function generateGoalEvent(agent: TeamAgent, minute: number, rng: Rng): MatchEvent {
  const scorer = pickPlayerByPosition(agent.roster, 'FW', rng) || pickPlayerByPosition(agent.roster, 'MF', rng);
  const assister = rng() < 0.7 ? pickPlayerByPosition(agent.roster, 'MF', rng) : undefined;
  return {
    minute,
    type: 'GOAL',
    team: agent.code,
    playerId: scorer?.id,
    assistId: assister?.id,
    description: `GOAL! ${teams[agent.code]?.name} 得点: ${scorer ? scorer.name : '選手'}${assister ? ' (A: ' + assister.name + ')' : ''}`,
  };
}

function resolveMinuteEvents(
  home: TeamAgent,
  away: TeamAgent,
  minute: number,
  rng: Rng
): MatchEvent[] {
  const events: MatchEvent[] = [];

  for (const agent of [home, away]) {
    const frustrationFactor = 1.0 + Math.max(0, -agent.momentum) * 0.5;
    if (rng() < YELLOW_CARD_BASE_RATE * frustrationFactor) {
      const carded = pickPlayerByPosition(agent.roster, 'DF', rng) || pickPlayerByPosition(agent.roster, 'MF', rng);
      events.push({
        minute,
        type: 'YELLOW_CARD',
        team: agent.code,
        playerId: carded?.id,
        description: `イエローカード: ${carded ? carded.name : '選手'} (${teams[agent.code]?.name})`,
      });
    }
  }

  for (const agent of [home, away]) {
    const frustrationFactor = 1.0 + Math.max(0, -agent.momentum) * 0.8;
    if (rng() < RED_CARD_BASE_RATE * frustrationFactor) {
      events.push({
        minute,
        type: 'RED_CARD',
        team: agent.code,
        description: `${getTeamName(agent.code)} の選手にレッドカード！一人少ない状態で戦うことに`,
      });
    }
  }

  for (const agent of [home, away]) {
    const injuryProb = INJURY_BASE_RATE * (1.0 - agent.stamina * 0.5);
    if (rng() < injuryProb) {
      events.push({
        minute,
        type: 'INJURY',
        team: agent.code,
        description: `${getTeamName(agent.code)} の選手が負傷、治療のため一時中断`,
      });
    }
  }

  for (const agent of [home, away]) {
    if (rng() < MOMENTUM_RANDOM_SHIFT_PROB) {
      const shift = (rng() - 0.5) * 0.4;
      if (Math.abs(shift) > 0.1) {
        events.push({
          minute,
          type: 'MOMENTUM_SHIFT',
          team: agent.code,
          description: shift > 0
            ? `${getTeamName(agent.code)} が攻勢を強める！`
            : `${getTeamName(agent.code)} に流れが悪くなる`,
        });
      }
    }
  }

  return events;
}

function applyEvents(
  home: TeamAgent,
  away: TeamAgent,
  events: MatchEvent[],
  homeScore: { value: number },
  awayScore: { value: number },
  rng: Rng
): void {
  for (const event of events) {
    const isHome = event.team === home.code;
    const agent = isHome ? home : away;
    const opponent = isHome ? away : home;

    switch (event.type) {
      case 'GOAL':
        if (isHome) homeScore.value++; else awayScore.value++;
        agent.momentum = clamp(agent.momentum + 0.4, -1, 1);
        opponent.momentum = clamp(opponent.momentum - 0.3, -1, 1);
        break;
      case 'RED_CARD':
        agent.redCards++;
        agent.momentum = clamp(agent.momentum - 0.4, -1, 1);
        opponent.momentum = clamp(opponent.momentum + 0.3, -1, 1);
        break;
      case 'YELLOW_CARD':
        agent.yellowCards++;
        if (agent.yellowCards >= 2 && agent.yellowCards % 2 === 0) {
          agent.redCards++;
          agent.momentum = clamp(agent.momentum - 0.3, -1, 1);
          opponent.momentum = clamp(opponent.momentum + 0.2, -1, 1);
          event.description += ' (2枚目で退場！)';
        }
        break;
      case 'INJURY':
        agent.stamina = clamp(agent.stamina - (0.05 + rng() * 0.15), 0.1, 1);
        break;
      case 'MOMENTUM_SHIFT':
        const shift = event.description?.includes('攻勢') ? 0.15 : -0.15;
        agent.momentum = clamp(agent.momentum + shift, -1, 1);
        break;
    }
  }
}

function tickAgentState(agent: TeamAgent): void {
  const pressureFactor = 1.0 + 0.5 * Math.abs(agent.momentum);
  const redCardFactor = 1.0 + 0.2 * agent.redCards;
  agent.stamina = clamp(
    agent.stamina - STAMINA_DEPLETION_RATE * pressureFactor * redCardFactor * agent.staminaMultiplier,
    0.1, 1.0
  );
  agent.momentum *= MOMENTUM_DECAY;
}

function simulatePenaltyShootout(
  home: TeamAgent,
  away: TeamAgent,
  rng: Rng,
  forcedWinner: TeamAgent | null
): { homeScore: number; awayScore: number; events: MatchEvent[] } {
  const events: MatchEvent[] = [];
  let hScore = 0;
  let aScore = 0;

  const homeProb = forcedWinner ? (forcedWinner.code === home.code ? 0.99 : 0.01) : 0.75;
  const awayProb = forcedWinner ? (forcedWinner.code === away.code ? 0.99 : 0.01) : 0.75;

  for (let i = 1; i <= 5; i++) {
    const hKick = rng() < homeProb;
    if (hKick) hScore++;
    events.push({
      minute: 120 + i,
      type: 'PENALTY_KICK',
      team: home.code,
      description: hKick
        ? `PK ${i}本目: ${getTeamName(home.code)} 成功！`
        : `PK ${i}本目: ${getTeamName(home.code)} 失敗...`,
    });

    if (hScore > aScore + (6 - i) || aScore > hScore + (5 - i)) break;

    const aKick = rng() < awayProb;
    if (aKick) aScore++;
    events.push({
      minute: 120 + i,
      type: 'PENALTY_KICK',
      team: away.code,
      description: aKick
        ? `PK ${i}本目: ${getTeamName(away.code)} 成功！`
        : `PK ${i}本目: ${getTeamName(away.code)} 失敗...`,
    });

    if (hScore > aScore + (5 - i) || aScore > hScore + (5 - i)) break;
  }

  let round = 6;
  while (hScore === aScore && round <= 20) {
    const hKick = rng() < homeProb;
    if (hKick) hScore++;
    events.push({
      minute: 120 + round,
      type: 'PENALTY_KICK',
      team: home.code,
      description: hKick
        ? `サドンデス ${round}本目: ${getTeamName(home.code)} 成功！`
        : `サドンデス ${round}本目: ${getTeamName(home.code)} 失敗...`,
    });

    const aKick = rng() < awayProb;
    if (aKick) aScore++;
    events.push({
      minute: 120 + round,
      type: 'PENALTY_KICK',
      team: away.code,
      description: aKick
        ? `サドンデス ${round}本目: ${getTeamName(away.code)} 成功！`
        : `サドンデス ${round}本目: ${getTeamName(away.code)} 失敗...`,
    });

    round++;
  }

  return { homeScore: hScore, awayScore: aScore, events };
}

// ===== Main Simulation =====

function getTeamStrength(code: string, rMap: RatingMap): number {
  const r = rMap[code];
  return r ? r.attack.mean + r.defense.mean : 0;
}

export interface SimulationOptions {
  isKnockout?: boolean;
  rng?: Rng;
  climate?: 'temperate' | 'hot_humid' | 'hot_dry' | 'high_altitude';
  intentHome?: Intent;
  intentAway?: Intent;
  ratings?: RatingMap;
}

export function simulateMatchRich(
  homeAgent: TeamAgent,
  awayAgent: TeamAgent,
  options: SimulationOptions = {}
): MatchLog {
  const { isKnockout = false, rng = defaultRng, ratings } = options;

  const rMap = ratings ?? initRatings();
  let { lambdaHome, lambdaAway } = expectedLambdas(homeAgent.code, awayAgent.code, rMap);

  const sH = getTeamStrength(homeAgent.code, rMap);
  const sA = getTeamStrength(awayAgent.code, rMap);

  if (isKnockout) {
    const diff = sH - sA;
    if (diff > 0) {
      lambdaHome *= 1.0 + diff * 0.3;
      lambdaAway *= Math.max(0.5, 1.0 - diff * 0.5);
    } else if (diff < 0) {
      lambdaAway *= 1.0 + Math.abs(diff) * 0.3;
      lambdaHome *= Math.max(0.5, 1.0 - Math.abs(diff) * 0.5);
    }
  }

  // ポアソン分布の確率曲線から「最もリアルな1試合」を抽出
  const target = getRealisticScore(lambdaHome, lambdaAway, isKnockout, sH, sA, rng);

  const events: MatchEvent[] = [];
  const homeScore = { value: 0 };
  const awayScore = { value: 0 };

  // ゴール時間の割り振り（90分間）
  const homeGoalMins = generateGoalMinutes(target.gh, 90, rng);
  const awayGoalMins = generateGoalMinutes(target.ga, 90, rng);

  // ---- 前半 (1〜45分) ----
  for (let min = 1; min <= 45; min++) {
    const minuteEvents = resolveMinuteEvents(homeAgent, awayAgent, min, rng);
    
    while (homeGoalMins.length > 0 && homeGoalMins[0] === min) {
      homeGoalMins.shift();
      minuteEvents.push(generateGoalEvent(homeAgent, min, rng));
    }
    while (awayGoalMins.length > 0 && awayGoalMins[0] === min) {
      awayGoalMins.shift();
      minuteEvents.push(generateGoalEvent(awayAgent, min, rng));
    }

    applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
    events.push(...minuteEvents);
    tickAgentState(homeAgent);
    tickAgentState(awayAgent);
  }

  // 前半アディショナルタイム（1〜3分）
  const ht1Stoppage = 1 + Math.floor(rng() * 3);
  for (let s = 1; s <= ht1Stoppage; s++) {
    const minuteEvents = resolveMinuteEvents(homeAgent, awayAgent, 45 + s, rng);
    // アディショナルタイムのゴール処理（もし90分内に収まらなかった場合など）
    applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
    events.push(...minuteEvents);
  }

  events.push({
    minute: 45,
    type: 'HALF_TIME',
    team: '',
    description: `ハーフタイム: ${getTeamName(homeAgent.code)} ${homeScore.value} - ${awayScore.value} ${getTeamName(awayAgent.code)}`,
  });

  homeAgent.stamina = clamp(homeAgent.stamina + 0.05, 0, 1);
  awayAgent.stamina = clamp(awayAgent.stamina + 0.05, 0, 1);
  homeAgent.momentum *= 0.5;
  awayAgent.momentum *= 0.5;

  // ---- 後半 (46〜90分) ----
  for (let min = 46; min <= 90; min++) {
    const minuteEvents = resolveMinuteEvents(homeAgent, awayAgent, min, rng);
    
    while (homeGoalMins.length > 0 && homeGoalMins[0] === min) {
      homeGoalMins.shift();
      minuteEvents.push(generateGoalEvent(homeAgent, min, rng));
    }
    while (awayGoalMins.length > 0 && awayGoalMins[0] === min) {
      awayGoalMins.shift();
      minuteEvents.push(generateGoalEvent(awayAgent, min, rng));
    }

    applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
    events.push(...minuteEvents);
    tickAgentState(homeAgent);
    tickAgentState(awayAgent);
  }

  // 後半アディショナルタイム（2〜6分）
  const ht2Stoppage = 2 + Math.floor(rng() * 5);
  for (let s = 1; s <= ht2Stoppage; s++) {
    const minuteEvents = resolveMinuteEvents(homeAgent, awayAgent, 90 + s, rng);
    applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
    events.push(...minuteEvents);
  }

  let isExtraTime = false;
  let isPenaltyShootout = false;
  let homePenScore: number | null = null;
  let awayPenScore: number | null = null;

  // ---- 延長戦 (knockout only) ----
  if (isKnockout && (target.etH > 0 || target.etA > 0 || target.pkH > 0 || target.pkA > 0 || homeScore.value === awayScore.value)) {
    isExtraTime = true;
    events.push({
      minute: 90,
      type: 'EXTRA_TIME',
      team: '',
      description: '同点のため延長戦に突入！',
    });

    const homeEtGoalMins = generateGoalMinutes(target.etH, 30, rng).map(m => m + 90);
    const awayEtGoalMins = generateGoalMinutes(target.etA, 30, rng).map(m => m + 90);

    // 延長前半 (91〜105分)
    for (let min = 91; min <= 105; min++) {
      const minuteEvents = resolveMinuteEvents(homeAgent, awayAgent, min, rng);
      
      while (homeEtGoalMins.length > 0 && homeEtGoalMins[0] === min) {
        homeEtGoalMins.shift();
        minuteEvents.push(generateGoalEvent(homeAgent, min, rng));
      }
      while (awayEtGoalMins.length > 0 && awayEtGoalMins[0] === min) {
        awayEtGoalMins.shift();
        minuteEvents.push(generateGoalEvent(awayAgent, min, rng));
      }

      applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
      events.push(...minuteEvents);
      tickAgentState(homeAgent);
      tickAgentState(awayAgent);
    }

    // 延長後半 (106〜120分)
    for (let min = 106; min <= 120; min++) {
      const minuteEvents = resolveMinuteEvents(homeAgent, awayAgent, min, rng);
      
      while (homeEtGoalMins.length > 0 && homeEtGoalMins[0] === min) {
        homeEtGoalMins.shift();
        minuteEvents.push(generateGoalEvent(homeAgent, min, rng));
      }
      while (awayEtGoalMins.length > 0 && awayEtGoalMins[0] === min) {
        awayEtGoalMins.shift();
        minuteEvents.push(generateGoalEvent(awayAgent, min, rng));
      }

      applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
      events.push(...minuteEvents);
      tickAgentState(homeAgent);
      tickAgentState(awayAgent);
    }
  }

  // ---- PK戦 (knockout, still tied after extra time) ----
  if (isKnockout && (target.pkH > 0 || target.pkA > 0 || homeScore.value === awayScore.value)) {
    isPenaltyShootout = true;
    const forcedWinner = target.pkH > 0 ? homeAgent : (target.pkA > 0 ? awayAgent : null);
    const pk = simulatePenaltyShootout(homeAgent, awayAgent, rng, forcedWinner);
    events.push(...pk.events);
    homePenScore = pk.homeScore;
    awayPenScore = pk.awayScore;
  }

  // Determine winner
  let winner: string | null = null;
  if (homeScore.value > awayScore.value) {
    winner = homeAgent.code;
  } else if (awayScore.value > homeScore.value) {
    winner = awayAgent.code;
  } else if (isPenaltyShootout && homePenScore !== null && awayPenScore !== null) {
    winner = homePenScore > awayPenScore ? homeAgent.code : awayAgent.code;
  }

  // Full time event
  events.push({
    minute: isExtraTime ? 120 : 90,
    type: 'FULL_TIME',
    team: '',
    description: winner
      ? `試合終了！ ${getTeamName(winner)} の勝利！ (${homeScore.value}-${awayScore.value}${isPenaltyShootout ? ` PK: ${homePenScore}-${awayPenScore}` : ''})`
      : `試合終了！ ${homeScore.value}-${awayScore.value} で引き分け`,
  });

  // --- FotMob-style Stats Generation ---
  const homeQuality = homeAgent.attackPower * homeAgent.defensePower;
  const awayQuality = awayAgent.attackPower * awayAgent.defensePower;
  const hShare = homeQuality / (homeQuality + awayQuality);
  const homePossession = Math.round(clamp(hShare * 100 + (rng() * 10 - 5), 30, 70));

  const hShots = homeScore.value + Math.floor(rng() * 8) + 2;
  const aShots = awayScore.value + Math.floor(rng() * 8) + 2;
  const hShotsOnTarget = homeScore.value + Math.floor(rng() * 4);
  const aShotsOnTarget = awayScore.value + Math.floor(rng() * 4);
  const hFouls = 5 + Math.floor(rng() * 10) + homeAgent.yellowCards * 2;
  const aFouls = 5 + Math.floor(rng() * 10) + awayAgent.yellowCards * 2;

  const homeStats = {
    possession: homePossession,
    shots: hShots,
    shotsOnTarget: hShotsOnTarget,
    expectedGoals: Number((homeScore.value * 0.6 + hShotsOnTarget * 0.12 + rng() * 0.5).toFixed(2)),
    fouls: hFouls,
    yellowCards: homeAgent.yellowCards,
    redCards: homeAgent.redCards,
  };
  const awayStats = {
    possession: 100 - homePossession,
    shots: aShots,
    shotsOnTarget: aShotsOnTarget,
    expectedGoals: Number((awayScore.value * 0.6 + aShotsOnTarget * 0.12 + rng() * 0.5).toFixed(2)),
    fouls: aFouls,
    yellowCards: awayAgent.yellowCards,
    redCards: awayAgent.redCards,
  };

  const playerRatings = generatePlayerRatings(homeAgent.code, awayAgent.code, winner || 'DRAW', events, rng);

  return {
    homeTeam: homeAgent.code,
    awayTeam: awayAgent.code,
    homeScore: homeScore.value,
    awayScore: awayScore.value,
    homePenScore,
    awayPenScore,
    events,
    winner,
    isExtraTime,
    isPenaltyShootout,
    homeEndStamina: homeAgent.stamina,
    awayEndStamina: awayAgent.stamina,
    playerRatings,
    homeStats,
    awayStats,
  };
}

export function generatePlayerRatings(
  homeCode: string,
  awayCode: string,
  winner: string | 'DRAW',
  events: MatchEvent[],
  rng: () => number = Math.random
): PlayerMatchRating[] {
  const ratings: PlayerMatchRating[] = [];
  
  const processTeam = (code: string, isWinner: boolean, isDraw: boolean) => {
    const roster = playersData[code];
    if (!roster) return;
    
    roster.forEach(player => {
      let r = 6.0 + (rng() * 1.0 - 0.5); // 5.5 to 6.5
      if (isWinner) r += 0.5 + rng() * 0.5;
      else if (isDraw) r += rng() * 0.5;
      else r -= 0.5;
      
      const goals = events.filter(e => e.type === 'GOAL' && e.playerId === player.id).length;
      const assists = events.filter(e => e.type === 'GOAL' && e.assistId === player.id).length;
      r += goals * (1.0 + rng() * 0.5);
      r += assists * (0.5 + rng() * 0.5);
      
      const yellows = events.filter(e => e.type === 'YELLOW_CARD' && e.playerId === player.id).length;
      const reds = events.filter(e => e.type === 'RED_CARD' && e.playerId === player.id).length;
      r -= yellows * 0.5;
      r -= reds * 1.5;
      
      r = Math.min(10.0, Math.max(3.0, r));
      ratings.push({ playerId: player.id, rating: +(r.toFixed(1)) });
    });
  };

  processTeam(homeCode, winner === homeCode, winner === 'DRAW');
  processTeam(awayCode, winner === awayCode, winner === 'DRAW');
  
  return ratings;
}

// ===== Tournament Fatigue =====

/**
 * 試合終了後の大会疲労蓄積を計算する
 */
export function calculateTournamentFatigue(
  previousFatigue: number,
  endStamina: number,
  wasExtraTime: boolean
): number {
  let fatigue = previousFatigue + (1.0 - endStamina) * 0.3;
  if (wasExtraTime) fatigue += 0.05;
  return clamp(fatigue, 0, 0.5);
}

// ===== Convenience: simulate from team codes =====

/**
 * チームコードから直接シミュレーションを実行する（App.tsx等から簡単に呼べる）
 */
export function simulateMatchFromCodes(
  homeCode: string,
  awayCode: string,
  ratings?: RatingMap,
  options: SimulationOptions = {}
): MatchLog {
  const r = ratings ?? initRatings();
  const climate = options.climate || 'temperate';
  const home = createTeamAgent(homeCode, r, 0, climate);
  const away = createTeamAgent(awayCode, r, 0, climate);

  // 勝ち点状況による戦い方を攻撃力・守備力へ反映
  //   attackMul>1 → 前掛かり（攻撃力↑） / concedeMul>1 → 隙が増える（守備力↓）
  if (options.intentHome) {
    home.attackPower = clamp(home.attackPower * options.intentHome.attackMul, 0.3, 2.5);
    home.defensePower = clamp(home.defensePower / options.intentHome.concedeMul, 0.3, 2.5);
  }
  if (options.intentAway) {
    away.attackPower = clamp(away.attackPower * options.intentAway.attackMul, 0.3, 2.5);
    away.defensePower = clamp(away.defensePower / options.intentAway.concedeMul, 0.3, 2.5);
  }

  return simulateMatchRich(home, away, options);
}

// ===== Description Generators =====

function getTeamName(code: string): string {
  return teams[code]?.name ?? code;
}


