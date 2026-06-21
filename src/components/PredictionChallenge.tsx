import React, { useEffect, useMemo, useState } from 'react';
import type { Match, TeamStanding } from '../types';
import { evaluateAccuracy, evaluateAdvancement, actualOutcome, type Outcome } from '../utils/accuracy';
import { teams, getFlagUrl, groupTeams } from '../data';

interface Props {
  matches: Match[];
  standings: Record<string, TeamStanding[]>;
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const ADV_KEY = 'wc2026-my-advance-picks';
const MATCH_KEY = 'wc2026-my-match-picks';

function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return fallback;
  }
}

const pct = (p: number) => `${(p * 100).toFixed(0)}%`;

const Flag: React.FC<{ code: string }> = ({ code }) => {
  const t = teams[code];
  return t?.iso ? <img src={getFlagUrl(t.iso)} alt={t.name} className="chal-flag" loading="lazy" /> : <span>🏳️</span>;
};

const MiniList: React.FC<{ codes: string[] }> = ({ codes }) => (
  <span className="chal-mini-list">
    {codes.map((c) => (
      <span key={c} className="chal-mini"><Flag code={c} />{teams[c]?.name ?? c}</span>
    ))}
  </span>
);

// ===== スコアボード（あなた vs モデル） =====
const ScoreBoard: React.FC<{ userRate: number | null; modelRate: number | null; userText: string; modelText: string; lead: 'user' | 'model' | 'tie' | null }> = ({ userRate, modelRate, userText, modelText, lead }) => (
  <div className="chal-score">
    <div className={`chal-score__side ${lead === 'user' ? 'chal-score__side--win' : ''}`}>
      <div className="chal-score__rate">{userRate === null ? '—' : pct(userRate)}</div>
      <div className="chal-score__label">あなた</div>
      <div className="chal-score__sub">{userText}</div>
    </div>
    <div className="chal-score__vs">
      {lead === 'user' && <span className="chal-lead chal-lead--user">あなたがリード!</span>}
      {lead === 'model' && <span className="chal-lead chal-lead--model">モデルがリード</span>}
      {lead === 'tie' && <span className="chal-lead">互角</span>}
      {lead === null && <span className="chal-lead">VS</span>}
    </div>
    <div className={`chal-score__side ${lead === 'model' ? 'chal-score__side--win' : ''}`}>
      <div className="chal-score__rate">{modelRate === null ? '—' : pct(modelRate)}</div>
      <div className="chal-score__label">🤖 モデル</div>
      <div className="chal-score__sub">{modelText}</div>
    </div>
  </div>
);

export const PredictionChallenge: React.FC<Props> = ({ matches, standings }) => {
  const [mode, setMode] = useState<'matches' | 'advance'>('matches');
  const [matchPicks, setMatchPicks] = useState<Record<string, Outcome>>(() => load(MATCH_KEY, {}));
  const [advPicks, setAdvPicks] = useState<Record<string, string[]>>(() => load(ADV_KEY, {}));

  useEffect(() => { localStorage.setItem(MATCH_KEY, JSON.stringify(matchPicks)); }, [matchPicks]);
  useEffect(() => { localStorage.setItem(ADV_KEY, JSON.stringify(advPicks)); }, [advPicks]);

  // ---- 共通: 確定済み試合とモデルの walk-forward 予測 ----
  const finished = useMemo(() => matches.filter((m) => m.syncStatus === 'finished'), [matches]);
  const report = useMemo(() => evaluateAccuracy(finished), [finished]);
  const modelByMatch = useMemo(() => Object.fromEntries(report.details.map((d) => [d.matchId, d])), [report]);

  const groupMatches = useMemo(() => matches.filter((m) => m.group), [matches]);

  // ===== 試合予想モードの採点（予想済み∩確定 で公平に比較） =====
  const matchScore = useMemo(() => {
    let uHits = 0, mHits = 0, scored = 0;
    for (const m of finished) {
      const up = matchPicks[m.id];
      if (!up) continue;
      scored++;
      if (up === actualOutcome(m.homeScore!, m.awayScore!)) uHits++;
      if (modelByMatch[m.id]?.hit) mHits++;
    }
    const predictedCount = groupMatches.filter((m) => matchPicks[m.id]).length;
    return { uHits, mHits, scored, predictedCount };
  }, [finished, matchPicks, modelByMatch, groupMatches]);

  const setMatchPick = (id: string, o: Outcome) => {
    // 終了済み、または進行中（LIVE）の試合は予想変更不可
    if (!!matches.find((x) => x.id === id)?.syncStatus) return;
    setMatchPicks((prev) => (prev[id] === o ? prev : { ...prev, [id]: o }));
  };

  // ===== 突破予想モード（既存） =====
  const adv = useMemo(() => evaluateAdvancement(standings), [standings]);
  const advByGroup = useMemo(() => Object.fromEntries(adv.groups.map((g) => [g.group, g])), [adv]);
  const toggleAdv = (group: string, code: string) => {
    // グループ内の試合が1つでも開始（live または finished）していたらロック
    const groupLocked = matches.filter((m) => m.group === group).some((m) => !!m.syncStatus);
    if (groupLocked) return;

    setAdvPicks((prev) => {
      const cur = prev[group] || [];
      if (cur.includes(code)) return { ...prev, [group]: cur.filter((c) => c !== code) };
      if (cur.length >= 2) return prev;
      return { ...prev, [group]: [...cur, code] };
    });
  };
  const advScore = useMemo(() => {
    let u = 0, m = 0, s = 0;
    for (const g of adv.groups) {
      if (!g.complete || !g.actualTop2) continue;
      s++;
      u += (advPicks[g.group] || []).filter((c) => g.actualTop2!.includes(c)).length;
      m += g.hits;
    }
    return { u, m, denom: s * 2 };
  }, [adv, advPicks]);

  const leadOf = (u: number, m: number, scored: number): 'user' | 'model' | 'tie' | null =>
    scored === 0 ? null : u > m ? 'user' : u < m ? 'model' : 'tie';

  const clearMatches = () => setMatchPicks({});
  const clearAdv = () => setAdvPicks({});

  return (
    <div className="card animate-fade-in challenge-view">
      <div className="card__header">
        <div className="card__icon card__icon--gold">🎲</div>
        <h2 className="card__title">予想チャレンジ — あなた vs モデル vs 現実</h2>
      </div>
      <div className="card__body">
        {/* モード切替 */}
        <div className="chal-modes">
          <button className={`chal-mode ${mode === 'matches' ? 'chal-mode--on' : ''}`} onClick={() => setMode('matches')}>⚽ 試合予想（全{groupMatches.length}試合）</button>
          <button className={`chal-mode ${mode === 'advance' ? 'chal-mode--on' : ''}`} onClick={() => setMode('advance')}>🏅 突破予想（各組 上位2）</button>
        </div>

        {mode === 'matches' && (
          <>
            <p className="chal-intro">
              各試合の<strong>勝ち / 分け / 負け</strong>を予想してください。確定した試合で
              <strong>あなた</strong>と<strong>6指標モデル</strong>の的中を比べます（予想済みの試合だけで公平に採点）。自動保存。
            </p>
            <ScoreBoard
              userRate={matchScore.scored ? matchScore.uHits / matchScore.scored : null}
              modelRate={matchScore.scored ? matchScore.mHits / matchScore.scored : null}
              userText={matchScore.scored ? `${matchScore.uHits} / ${matchScore.scored} 的中` : '採点待ち'}
              modelText={matchScore.scored ? `${matchScore.mHits} / ${matchScore.scored} 的中` : '採点待ち'}
              lead={leadOf(matchScore.uHits, matchScore.mHits, matchScore.scored)}
            />
            <div className="chal-toolbar">
              <span className="chal-progress">予想入力: {matchScore.predictedCount} / {groupMatches.length} 試合</span>
              <button className="btn btn--danger btn--glass btn--sm" onClick={clearMatches}>クリア</button>
            </div>

            {GROUPS.map((group) => {
              const gms = groupMatches
                .filter((m) => m.group === group)
                .sort((a, b) => (a.matchDay ?? 0) - (b.matchDay ?? 0) || (a.date < b.date ? -1 : 1));
              return (
                <div key={group} className="mp-group">
                  <div className="mp-group__head">Group {group}</div>
                  {gms.map((m) => {
                    const isLocked = !!m.syncStatus; // live or finished
                    const fin = m.syncStatus === 'finished';
                    const actual = fin ? actualOutcome(m.homeScore!, m.awayScore!) : null;
                    const modelPick = fin ? modelByMatch[m.id]?.predicted : undefined;
                    const pick = matchPicks[m.id];
                    const seg = (o: Outcome, label: string) => (
                      <button
                        className={[
                          'mp-seg__btn',
                          pick === o ? 'mp-seg__btn--on' : '',
                          fin && actual === o ? 'mp-seg__btn--actual' : '',
                          fin && modelPick === o ? 'mp-seg__btn--model' : '',
                        ].join(' ')}
                        onClick={() => setMatchPick(m.id, o)}
                        disabled={isLocked}
                        title={fin && modelPick === o ? 'モデルもこの予想' : undefined}
                      >
                        {label}
                      </button>
                    );
                    return (
                      <div key={m.id} className={`mp-row ${fin ? (pick ? (pick === actual ? 'mp-row--hit' : 'mp-row--miss') : '') : ''}`}>
                        <span className="mp-team mp-team--home"><span className="mp-name">{teams[m.homeTeam]?.name}</span><Flag code={m.homeTeam} /></span>
                        <div className="mp-seg">
                          {seg('HOME', '勝')}
                          {seg('DRAW', '分')}
                          {seg('AWAY', '勝')}
                        </div>
                        <span className="mp-team mp-team--away"><Flag code={m.awayTeam} /><span className="mp-name">{teams[m.awayTeam]?.name}</span></span>
                        <span className="mp-result">
                          {isLocked ? (
                            <>
                              <span className="mp-score">{fin ? `${m.homeScore}-${m.awayScore}` : '試合中'}</span>
                              {pick ? (
                                fin ? <span className={pick === actual ? 'mp-ok' : 'mp-ng'}>{pick === actual ? '◯' : '✕'}</span> : <span className="mp-locked">🔒</span>
                              ) : (
                                <span className="mp-locked" title="開始時にすでに終了（予想対象外）">🔒</span>
                              )}
                            </>
                          ) : (
                            <span className="mp-date">{m.date.slice(5)} {m.time}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <p className="chal-legend">左の「勝」＝左チーム勝利 / 「分」＝引き分け / 右の「勝」＝右チーム勝利。<strong>🔒終了済みの試合は予想できません</strong>（結果のみ表示）。確定後、🤖＝モデルの予想・緑枠＝実際の結果。</p>
          </>
        )}

        {mode === 'advance' && (
          <>
            <p className="chal-intro">
              各グループで<strong>決勝トーナメントに進出する2チーム</strong>を予想（全{GROUPS.length}組・各2）。
            </p>
            <ScoreBoard
              userRate={advScore.denom ? advScore.u / advScore.denom : null}
              modelRate={advScore.denom ? advScore.m / advScore.denom : null}
              userText={advScore.denom ? `${advScore.u} / ${advScore.denom} 枠` : '採点待ち'}
              modelText={advScore.denom ? `${advScore.m} / ${advScore.denom} 枠` : '採点待ち'}
              lead={leadOf(advScore.u, advScore.m, advScore.denom)}
            />
            <div className="chal-toolbar">
              <span className="chal-progress">予想入力: {GROUPS.filter((g) => (advPicks[g]?.length ?? 0) === 2).length} / {GROUPS.length} 組</span>
              <button className="btn btn--cyan btn--glass btn--sm" onClick={() => { const n: Record<string, string[]> = {}; for (const g of adv.groups) n[g.group] = [...g.predictedTop2]; setAdvPicks(n); }}>🤖 モデル予想をコピー</button>
              <button className="btn btn--danger btn--glass btn--sm" onClick={clearAdv}>クリア</button>
            </div>
            <div className="chal-grid">
              {GROUPS.map((group) => {
                const g = advByGroup[group];
                const myPicks = advPicks[group] || [];
                const codes = groupTeams[group] ?? [];
                const complete = g?.complete;
                const groupLocked = matches.filter((m) => m.group === group).some((m) => !!m.syncStatus);
                const actual = g?.actualTop2 ?? null;
                const myHits = actual ? myPicks.filter((c) => actual.includes(c)).length : null;
                return (
                  <div key={group} className="chal-card">
                    <div className="chal-card__head">
                      <span className="chal-card__group">Group {group}</span>
                      {complete && myHits !== null && (
                        <span className={`chal-card__score chal-card__score--${myHits === 2 ? 'full' : myHits === 1 ? 'half' : 'zero'}`}>あなた {myHits}/2 ・ モデル {g!.hits}/2</span>
                      )}
                      {!complete && groupLocked && <span className="chal-card__score chal-card__score--locked">🔒 ロック済み</span>}
                    </div>
                    <div className="chal-chips">
                      {codes.map((code) => {
                        const selected = myPicks.includes(code);
                        const disabled = (!selected && myPicks.length >= 2) || groupLocked;
                        const isActual = actual?.includes(code);
                        return (
                          <button key={code} className={`chal-chip ${selected ? 'chal-chip--on' : ''} ${disabled ? 'chal-chip--off' : ''} ${complete ? (isActual ? 'chal-chip--correct' : 'chal-chip--out') : ''}`} onClick={() => toggleAdv(group, code)} disabled={disabled}>
                            <Flag code={code} /><span className="chal-chip__name">{teams[code]?.name ?? code}</span>{complete && isActual && <span className="chal-chip__mark">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="chal-card__foot">
                      <span className="chal-card__model">🤖 {g ? <MiniList codes={g.predictedTop2} /> : '—'}</span>
                      {complete && actual && <span className="chal-card__actual">✅ <MiniList codes={actual} /></span>}
                      {!complete && <span className="chal-card__pending">進行中…</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PredictionChallenge;
