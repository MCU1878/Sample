// =============================================================================
// Agent-Based Match Engine
// -----------------------------------------------------------------------------
// チームを「攻撃力・守備力・スタミナ・勢い」を持つエージェントとしてモデル化し、
// 試合を分単位のイベント（得点・勢いの振れ・疲労蓄積・退場）で生成する。
// =============================================================================

import type { TeamAgent, MatchEvent, MatchLog } from '../types';
import { teams } from '../data';
import type { RatingMap } from './ratingModel';
import { initRatings } from './ratingModel';
import playersDataRaw from '../data/players.json';
import type { Player } from '../types';

const playersData = playersDataRaw as Record<string, Player[]>;

function pickPlayerByPosition(roster: Player[], pos: string, rng: Rng) {
  if (!roster || roster.length === 0) return null;
  const players = roster.filter(p => p.position === pos);
  if (players.length > 0) return players[Math.floor(rng() * players.length)];
  return roster[Math.floor(rng() * roster.length)];
}

// ===== Constants =====

/** 1チームあたりの平均ゴール数（W杯近年平均2.7の半分） */
const AVG_GOALS_PER_TEAM = 1.35;
const GOAL_BASE_RATE = AVG_GOALS_PER_TEAM / 90;

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

  // 大会疲労を初期スタミナに反映
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

// ===== Utility =====

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

// ===== Event Generation (per minute) =====

function getEffectiveAttack(agent: TeamAgent): number {
  const staminaFactor = 0.5 + 0.5 * agent.stamina;
  const momentumFactor = 1.0 + 0.3 * agent.momentum;
  const cardPenalty = Math.max(0.6, 1.0 - 0.15 * agent.redCards);
  return agent.attackPower * staminaFactor * momentumFactor * cardPenalty;
}

function getEffectiveDefense(agent: TeamAgent): number {
  const staminaFactor = 0.5 + 0.5 * agent.stamina;
  const momentumFactor = 1.0 + 0.15 * agent.momentum; // 守備は勢いの影響が小さい
  const cardPenalty = Math.max(0.6, 1.0 - 0.15 * agent.redCards);
  return agent.defensePower * staminaFactor * momentumFactor * cardPenalty;
}

function resolveMinute(
  home: TeamAgent,
  away: TeamAgent,
  minute: number,
  rng: Rng
): MatchEvent[] {
  const events: MatchEvent[] = [];

  // --- Goal Check (for each team) ---
  const homeEffAtk = getEffectiveAttack(home);
  const awayEffDef = getEffectiveDefense(away);
  const homeGoalProb = GOAL_BASE_RATE * (homeEffAtk / Math.max(0.1, awayEffDef));
  if (rng() < clamp(homeGoalProb, 0, 0.15)) {
    const scorer = pickPlayerByPosition(home.roster, 'FW', rng) || pickPlayerByPosition(home.roster, 'MF', rng);
    const assister = rng() < 0.7 ? pickPlayerByPosition(home.roster, 'MF', rng) : undefined;
    events.push({
      minute,
      type: 'GOAL',
      team: home.code,
      playerId: scorer?.id,
      assistId: assister?.id,
      description: `GOAL! ${teams[home.code]?.name} 得点: ${scorer ? scorer.name : '選手'}${assister ? ' (A: ' + assister.name + ')' : ''}`,
    });
  }

  const awayEffAtk = getEffectiveAttack(away);
  const homeEffDef = getEffectiveDefense(home);
  const awayGoalProb = GOAL_BASE_RATE * (awayEffAtk / Math.max(0.1, homeEffDef));
  if (rng() < clamp(awayGoalProb, 0, 0.15)) {
    const scorer = pickPlayerByPosition(away.roster, 'FW', rng) || pickPlayerByPosition(away.roster, 'MF', rng);
    const assister = rng() < 0.7 ? pickPlayerByPosition(away.roster, 'MF', rng) : undefined;
    events.push({
      minute,
      type: 'GOAL',
      team: away.code,
      playerId: scorer?.id,
      assistId: assister?.id,
      description: `GOAL! ${teams[away.code]?.name} 得点: ${scorer ? scorer.name : '選手'}${assister ? ' (A: ' + assister.name + ')' : ''}`,
    });
  }

  // --- Yellow Card Check ---
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

  // --- Red Card Check ---
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

  // --- Injury Check ---
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

  // --- Momentum Random Shift ---
  for (const agent of [home, away]) {
    if (rng() < MOMENTUM_RANDOM_SHIFT_PROB) {
      const shift = (rng() - 0.5) * 0.4; // -0.2 ~ +0.2
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

// ===== Apply Events to Agent State =====

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
        // 勢い: 得点チーム急上昇、失点チーム急降下
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
        // 2枚目のイエロー → 退場にアップグレード
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
        const shift = event.description.includes('攻勢') ? 0.15 : -0.15;
        agent.momentum = clamp(agent.momentum + shift, -1, 1);
        break;
    }
  }
}

// ===== Stamina & Momentum Tick =====

function tickAgentState(agent: TeamAgent): void {
  // Stamina depletion
  const pressureFactor = 1.0 + 0.5 * Math.abs(agent.momentum);
  const redCardFactor = 1.0 + 0.2 * agent.redCards;
  agent.stamina = clamp(
    agent.stamina - STAMINA_DEPLETION_RATE * pressureFactor * redCardFactor * agent.staminaMultiplier,
    0.1, 1.0
  );

  // Momentum natural decay toward zero
  agent.momentum *= MOMENTUM_DECAY;
}

// ===== PK Shootout =====

function simulatePenaltyShootout(
  home: TeamAgent,
  away: TeamAgent,
  rng: Rng
): { homeScore: number; awayScore: number; events: MatchEvent[] } {
  const events: MatchEvent[] = [];
  let hScore = 0;
  let aScore = 0;

  // PK基本成功率: チーム力差で微調整
  const strengthDiff = (home.attackPower - away.defensePower) - (away.attackPower - home.defensePower);
  const homeProb = clamp(0.75 + strengthDiff * 0.05, 0.65, 0.85);
  const awayProb = clamp(0.75 - strengthDiff * 0.05, 0.65, 0.85);

  // 5本ずつ
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

    // 5本中に既に追いつけない場合は早期決着 (ホーム蹴った後)
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

    // 5本中に既に追いつけない場合は早期決着 (アウェイ蹴った後)
    if (hScore > aScore + (5 - i) || aScore > hScore + (5 - i)) break;
  }

  // サドンデス
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

export interface SimulationOptions {
  isKnockout?: boolean;    // true = 延長・PK あり
  rng?: Rng;
  climate?: 'temperate' | 'hot_humid' | 'hot_dry' | 'high_altitude';
}

/**
 * エージェントベースのフルシミュレーションを実行し、MatchLog を返す。
 * 各分ごとにイベントを判定し、スタミナ・勢い・退場の影響を反映する。
 */
export function simulateMatchRich(
  homeAgent: TeamAgent,
  awayAgent: TeamAgent,
  options: SimulationOptions = {}
): MatchLog {
  const { isKnockout = false, rng = defaultRng } = options;

  const events: MatchEvent[] = [];
  const homeScore = { value: 0 };
  const awayScore = { value: 0 };

  // ---- 前半 (1〜45分) ----
  for (let min = 1; min <= 45; min++) {
    const minuteEvents = resolveMinute(homeAgent, awayAgent, min, rng);
    applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
    events.push(...minuteEvents);
    tickAgentState(homeAgent);
    tickAgentState(awayAgent);
  }

  // 前半アディショナルタイム（1〜3分）
  const ht1Stoppage = 1 + Math.floor(rng() * 3);
  for (let s = 1; s <= ht1Stoppage; s++) {
    const minuteEvents = resolveMinute(homeAgent, awayAgent, 45 + s, rng);
    applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
    events.push(...minuteEvents);
  }

  events.push({
    minute: 45,
    type: 'HALF_TIME',
    team: '',
    description: `ハーフタイム: ${getTeamName(homeAgent.code)} ${homeScore.value} - ${awayScore.value} ${getTeamName(awayAgent.code)}`,
  });

  // ハーフタイムで僅かにスタミナ回復
  homeAgent.stamina = clamp(homeAgent.stamina + 0.05, 0, 1);
  awayAgent.stamina = clamp(awayAgent.stamina + 0.05, 0, 1);
  // 勢いをリセット気味に
  homeAgent.momentum *= 0.5;
  awayAgent.momentum *= 0.5;

  // ---- 後半 (46〜90分) ----
  for (let min = 46; min <= 90; min++) {
    const minuteEvents = resolveMinute(homeAgent, awayAgent, min, rng);
    applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
    events.push(...minuteEvents);
    tickAgentState(homeAgent);
    tickAgentState(awayAgent);
  }

  // 後半アディショナルタイム（2〜6分）
  const ht2Stoppage = 2 + Math.floor(rng() * 5);
  for (let s = 1; s <= ht2Stoppage; s++) {
    const minuteEvents = resolveMinute(homeAgent, awayAgent, 90 + s, rng);
    applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
    events.push(...minuteEvents);
  }

  let isExtraTime = false;
  let isPenaltyShootout = false;
  let homePenScore: number | null = null;
  let awayPenScore: number | null = null;

  // ---- 延長戦 (knockout only) ----
  if (isKnockout && homeScore.value === awayScore.value) {
    isExtraTime = true;
    events.push({
      minute: 90,
      type: 'EXTRA_TIME',
      team: '',
      description: '同点のため延長戦に突入！',
    });

    // 延長前半 (91〜105分)
    for (let min = 91; min <= 105; min++) {
      const minuteEvents = resolveMinute(homeAgent, awayAgent, min, rng);
      applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
      events.push(...minuteEvents);
      tickAgentState(homeAgent);
      tickAgentState(awayAgent);
    }

    // 延長後半 (106〜120分)
    for (let min = 106; min <= 120; min++) {
      const minuteEvents = resolveMinute(homeAgent, awayAgent, min, rng);
      applyEvents(homeAgent, awayAgent, minuteEvents, homeScore, awayScore, rng);
      events.push(...minuteEvents);
      tickAgentState(homeAgent);
      tickAgentState(awayAgent);
    }
  }

  // ---- PK戦 (knockout, still tied after extra time) ----
  if (isKnockout && homeScore.value === awayScore.value) {
    isPenaltyShootout = true;
    const pk = simulatePenaltyShootout(homeAgent, awayAgent, rng);
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
  let homePoss = 50 + (homeQuality - awayQuality) * 15 + (rng() - 0.5) * 10;
  homePoss = clamp(homePoss, 25, 75);
  
  const hShots = homeScore.value + Math.floor(rng() * 10) + Math.floor(homeQuality * 3);
  const aShots = awayScore.value + Math.floor(rng() * 10) + Math.floor(awayQuality * 3);
  const hShotsOnTarget = homeScore.value + Math.floor(rng() * Math.max(0, hShots - homeScore.value) * 0.6);
  const aShotsOnTarget = awayScore.value + Math.floor(rng() * Math.max(0, aShots - awayScore.value) * 0.6);
  const hxG = homeScore.value * 0.6 + hShotsOnTarget * 0.12 + rng() * 0.5;
  const axG = awayScore.value * 0.6 + aShotsOnTarget * 0.12 + rng() * 0.5;
  const hFouls = homeAgent.yellowCards * 3 + homeAgent.redCards * 5 + Math.floor(rng() * 10) + 5;
  const aFouls = awayAgent.yellowCards * 3 + awayAgent.redCards * 5 + Math.floor(rng() * 10) + 5;

  const homeStats = {
    possession: Math.round(homePoss),
    shots: hShots,
    shotsOnTarget: hShotsOnTarget,
    expectedGoals: Number(hxG.toFixed(2)),
    fouls: hFouls,
    yellowCards: homeAgent.yellowCards,
    redCards: homeAgent.redCards,
  };
  const awayStats = {
    possession: 100 - Math.round(homePoss),
    shots: aShots,
    shotsOnTarget: aShotsOnTarget,
    expectedGoals: Number(axG.toFixed(2)),
    fouls: aFouls,
    yellowCards: awayAgent.yellowCards,
    redCards: awayAgent.redCards,
  };

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
    homeStats,
    awayStats,
  };
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
  return simulateMatchRich(home, away, options);
}

// ===== Description Generators =====

function getTeamName(code: string): string {
  return teams[code]?.name ?? code;
}

function generateGoalDescription(teamCode: string, minute: number, momentum: number): string {
  const name = getTeamName(teamCode);

  // 異なるバリエーションの実況テキスト
  const earlyGoals = [
    `${name}が電光石火の先制ゴール！`,
    `${name}が開始早々にネットを揺らす！`,
    `${name}が素早い展開から先制！`,
  ];
  const lateGoals = [
    `${name}が土壇場でゴール！劇的な展開！`,
    `${name}がアディショナルタイムに意地の一撃！`,
    `${name}が終了間際に値千金のゴール！`,
  ];
  const momentumGoals = [
    `${name}が怒涛の攻撃から追加点！勢いが止まらない！`,
    `${name}が流れに乗ってさらにゴール！`,
    `${name}が猛攻！ゴール！`,
  ];
  const normalGoals = [
    `${name}がゴール！`,
    `${name}が見事なシュートでゴール！`,
    `${name}がチャンスを確実に決めた！`,
    `${name}が得点！巧みな崩しから`,
    `${name}の美しいゴール！`,
  ];

  if (minute <= 10) {
    return earlyGoals[Math.floor(Math.random() * earlyGoals.length)];
  }
  if (minute >= 85) {
    return lateGoals[Math.floor(Math.random() * lateGoals.length)];
  }
  if (momentum > 0.5) {
    return momentumGoals[Math.floor(Math.random() * momentumGoals.length)];
  }
  return normalGoals[Math.floor(Math.random() * normalGoals.length)];
}
