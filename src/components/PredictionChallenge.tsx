import React, { useEffect, useMemo, useState } from 'react';
import type { TeamStanding } from '../types';
import { evaluateAdvancement } from '../utils/accuracy';
import { teams, getFlagUrl, groupTeams } from '../data';

interface Props {
  standings: Record<string, TeamStanding[]>;
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const STORAGE_KEY = 'wc2026-my-advance-picks';

function loadPicks(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

const pct = (p: number) => `${(p * 100).toFixed(0)}%`;

const Flag: React.FC<{ code: string }> = ({ code }) => {
  const t = teams[code];
  return t?.iso ? (
    <img src={getFlagUrl(t.iso)} alt={t.name} className="chal-flag" loading="lazy" />
  ) : (
    <span>🏳️</span>
  );
};

const MiniList: React.FC<{ codes: string[] }> = ({ codes }) => (
  <span className="chal-mini-list">
    {codes.map((c) => (
      <span key={c} className="chal-mini">
        <Flag code={c} />
        {teams[c]?.name ?? c}
      </span>
    ))}
  </span>
);

export const PredictionChallenge: React.FC<Props> = ({ standings }) => {
  const [picks, setPicks] = useState<Record<string, string[]>>(loadPicks);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  }, [picks]);

  const adv = useMemo(() => evaluateAdvancement(standings), [standings]);
  const advByGroup = useMemo(
    () => Object.fromEntries(adv.groups.map((g) => [g.group, g])),
    [adv]
  );

  const toggle = (group: string, code: string) => {
    setPicks((prev) => {
      const cur = prev[group] || [];
      if (cur.includes(code)) return { ...prev, [group]: cur.filter((c) => c !== code) };
      if (cur.length >= 2) return prev; // 上位2のみ
      return { ...prev, [group]: [...cur, code] };
    });
  };

  const copyModel = () => {
    const next: Record<string, string[]> = {};
    for (const g of adv.groups) next[g.group] = [...g.predictedTop2];
    setPicks(next);
  };
  const clearAll = () => setPicks({});

  // 採点（確定グループのみ）
  let userHits = 0;
  let modelHits = 0;
  let scoredGroups = 0;
  for (const g of adv.groups) {
    if (!g.complete || !g.actualTop2) continue;
    scoredGroups++;
    const up = picks[g.group] || [];
    userHits += up.filter((c) => g.actualTop2!.includes(c)).length;
    modelHits += g.hits;
  }
  const denom = scoredGroups * 2;
  const userRate = denom ? userHits / denom : 0;
  const modelRate = denom ? modelHits / denom : 0;
  const filledGroups = GROUPS.filter((g) => (picks[g]?.length ?? 0) === 2).length;

  const lead =
    denom === 0 ? null : userHits > modelHits ? 'user' : userHits < modelHits ? 'model' : 'tie';

  return (
    <div className="card animate-fade-in challenge-view">
      <div className="card__header">
        <div className="card__icon card__icon--gold">🎲</div>
        <h2 className="card__title">予想チャレンジ — あなた vs モデル vs 現実</h2>
      </div>
      <div className="card__body">
        <p className="chal-intro">
          各グループで<strong>決勝トーナメントに進出する2チーム</strong>を予想して選んでください
          （全{GROUPS.length}組・各2チーム）。試合が確定するごとに、
          <strong>あなた</strong>と<strong>6指標モデル</strong>の的中を比べます。予想は自動保存されます。
        </p>

        {/* スコアボード */}
        <div className="chal-score">
          <div className={`chal-score__side ${lead === 'user' ? 'chal-score__side--win' : ''}`}>
            <div className="chal-score__rate">{denom ? pct(userRate) : '—'}</div>
            <div className="chal-score__label">あなた</div>
            <div className="chal-score__sub">{denom ? `${userHits} / ${denom} 枠` : '採点待ち'}</div>
          </div>
          <div className="chal-score__vs">
            {lead === 'user' && <span className="chal-lead chal-lead--user">あなたがリード!</span>}
            {lead === 'model' && <span className="chal-lead chal-lead--model">モデルがリード</span>}
            {lead === 'tie' && <span className="chal-lead">互角</span>}
            {lead === null && <span className="chal-lead">VS</span>}
          </div>
          <div className={`chal-score__side ${lead === 'model' ? 'chal-score__side--win' : ''}`}>
            <div className="chal-score__rate">{denom ? pct(modelRate) : '—'}</div>
            <div className="chal-score__label">🤖 モデル</div>
            <div className="chal-score__sub">{denom ? `${modelHits} / ${denom} 枠` : '採点待ち'}</div>
          </div>
        </div>

        <div className="chal-toolbar">
          <span className="chal-progress">予想入力: {filledGroups} / {GROUPS.length} 組</span>
          <button className="btn btn--cyan btn--glass btn--sm" onClick={copyModel}>🤖 モデル予想をコピー</button>
          <button className="btn btn--danger btn--glass btn--sm" onClick={clearAll}>クリア</button>
        </div>

        {/* グループ別の予想カード */}
        <div className="chal-grid">
          {GROUPS.map((group) => {
            const g = advByGroup[group];
            const myPicks = picks[group] || [];
            const codes = groupTeams[group] ?? [];
            const complete = g?.complete;
            const actual = g?.actualTop2 ?? null;
            const myHits = actual ? myPicks.filter((c) => actual.includes(c)).length : null;
            return (
              <div key={group} className="chal-card">
                <div className="chal-card__head">
                  <span className="chal-card__group">Group {group}</span>
                  {complete && myHits !== null && (
                    <span className={`chal-card__score chal-card__score--${myHits === 2 ? 'full' : myHits === 1 ? 'half' : 'zero'}`}>
                      あなた {myHits}/2 ・ モデル {g!.hits}/2
                    </span>
                  )}
                </div>
                <div className="chal-chips">
                  {codes.map((code) => {
                    const selected = myPicks.includes(code);
                    const disabled = !selected && myPicks.length >= 2;
                    const isActual = actual?.includes(code);
                    return (
                      <button
                        key={code}
                        className={`chal-chip ${selected ? 'chal-chip--on' : ''} ${disabled ? 'chal-chip--off' : ''} ${complete ? (isActual ? 'chal-chip--correct' : 'chal-chip--out') : ''}`}
                        onClick={() => toggle(group, code)}
                        disabled={disabled}
                      >
                        <Flag code={code} />
                        <span className="chal-chip__name">{teams[code]?.name ?? code}</span>
                        {complete && isActual && <span className="chal-chip__mark">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="chal-card__foot">
                  <span className="chal-card__model">🤖 {g ? <MiniList codes={g.predictedTop2} /> : '—'}</span>
                  {complete && actual && (
                    <span className="chal-card__actual">✅ <MiniList codes={actual} /></span>
                  )}
                  {!complete && <span className="chal-card__pending">進行中…</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PredictionChallenge;
