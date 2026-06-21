import React, { useMemo } from 'react';
import type { Match, KnockoutMatch, TeamStanding } from '../types';
import {
  evaluateAccuracy,
  evaluateAdvancement,
  evaluateKnockoutAccuracy,
  type Outcome,
} from '../utils/accuracy';
import { activeSources } from '../utils/powerRankings';
import { SkillDashboard } from './SkillDashboard';
import { teams, getFlagUrl } from '../data';

const SOURCES = activeSources();

interface AccuracyPanelProps {
  matches: Match[];
  standings: Record<string, TeamStanding[]>;
  knockoutMatches: KnockoutMatch[];
}

const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

// 勝敗ラベル（予測チーム名 or 引き分け）
const outcomeLabel = (o: Outcome, home: string, away: string): string => {
  if (o === 'DRAW') return '引き分け';
  const code = o === 'HOME' ? home : away;
  return `${teams[code]?.name ?? code} 勝利`;
};

const TeamSide: React.FC<{ code: string; side: 'home' | 'away' }> = ({ code, side }) => {
  const team = teams[code];
  const flag = team?.iso ? (
    <img src={getFlagUrl(team.iso)} alt={team.name} className="acc-team__flag" loading="lazy" />
  ) : (
    <span>🏳️</span>
  );
  const name = <span className="acc-team__name">{team?.name ?? code}</span>;
  return (
    <span className={`acc-side acc-side--${side}`}>
      {side === 'home' ? (<>{name}{flag}</>) : (<>{flag}{name}</>)}
    </span>
  );
};

const TeamMini: React.FC<{ code: string }> = ({ code }) => {
  const team = teams[code];
  return (
    <span className="acc-mini">
      {team?.iso ? (
        <img src={getFlagUrl(team.iso)} alt={team.name} className="acc-team__flag" loading="lazy" />
      ) : (
        <span>🏳️</span>
      )}
      <span className="acc-team__name">{team?.name ?? code}</span>
    </span>
  );
};

const SectionHeader: React.FC<{ n: string; title: string; sub?: string }> = ({ n, title, sub }) => (
  <div className="acc-section-head">
    <span className="acc-section-num">{n}</span>
    <span className="acc-section-title">{title}</span>
    {sub && <span className="acc-section-sub">{sub}</span>}
  </div>
);

export const AccuracyPanel: React.FC<AccuracyPanelProps> = ({ matches, standings, knockoutMatches }) => {
  // 試合的中（グループ）は「実際に終了した本物の結果（API同期 = finished）」だけを対象にする。
  const finishedGroup = useMemo(() => matches.filter((m) => m.syncStatus === 'finished'), [matches]);
  const report = useMemo(() => evaluateAccuracy(finishedGroup), [finishedGroup]);
  const adv = useMemo(() => evaluateAdvancement(standings), [standings]);

  // 決勝Tはグループが全試合（実結果）で完了してから集計（シミュレーション結果の混入を防ぐ）
  const groupAllFinished = matches.length > 0 && matches.every((m) => m.syncStatus === 'finished');
  const ko = useMemo(
    () => (groupAllFinished ? evaluateKnockoutAccuracy(knockoutMatches) : { total: 0, hits: 0, rate: 0, details: [] }),
    [groupAllFinished, knockoutMatches]
  );

  const hasAny = report.total > 0;

  return (
    <div className="card animate-fade-in">
      <div className="card__header">
        <div className="card__icon card__icon--gold">🎯</div>
        <h2 className="card__title">答え合わせ — 事前予測の的中率</h2>
      </div>
      <div className="card__body">
        {!hasAny ? (
          <div className="acc-empty">
            <p className="acc-empty__lead">まだ確定した（終了した）試合がありません。</p>
            <p>
              ライブ同期で試合が<strong>終了</strong>すると、ここに
              <strong>試合の的中率</strong>・<strong>進出（突破）の的中率</strong>・
              <strong>決勝トーナメントの的中率</strong>が自動で集計されます。
            </p>
          </div>
        ) : (
          <>
            {/* 使用したランキング（透明性・発表用） */}
            <div className="acc-sources">
              <span className="acc-sources__label">統合した強さ指標（{SOURCES.length}系統）:</span>
              {SOURCES.map((s) => (
                <span key={s.key} className="acc-source-chip">{s.label}</span>
              ))}
            </div>
            {/* 信頼性の注記（発表用） */}
            <div className="acc-note">
              <span className="acc-note__icon">🔒</span>
              <span>
                予測は<strong>{SOURCES.length}つの独立パワーランキングの統合</strong>＋
                <strong>直前までの試合結果での学習</strong>から決定論的に算出（乱数なし）。
                各試合は<strong>その試合自身の結果は使わない</strong>（リークなし）ので、
                <strong>何度実行しても同じ数字</strong>です。
              </span>
            </div>

            {/* ===== ⓪ 予測力の証明（較正・Brier・推移） ===== */}
            <SectionHeader n="★" title="予測力の証明" sub="当てるだけでなく確率まで正確か（較正・Brierスコア・推移）" />
            <SkillDashboard details={report.details} />

            {/* ===== ① グループステージ 試合的中 ===== */}
            <SectionHeader n="①" title="グループステージ 試合的中" sub="勝 / 分 / 負 の3択（引き分け含む）" />
            <div className="acc-hero">
              <div className="acc-hero__main">
                <div className="acc-hero__rate">{pct(report.rate)}</div>
                <div className="acc-hero__label">試合的中率（3択）</div>
                <div className="acc-hero__count">
                  {report.total} 試合中 <strong>{report.hits}</strong> 試合的中
                </div>
              </div>
              <div className="acc-hero__sub">
                <div className="acc-hero__sub-rate">{pct(report.decisiveRate)}</div>
                <div className="acc-hero__sub-label">決着戦のみ（引分除く）</div>
                <div className="acc-hero__sub-count">
                  {report.decisiveTotal} 試合中 {report.decisiveHits} 試合
                </div>
              </div>
              <div className="acc-hero__sub">
                <div className="acc-hero__sub-rate">{pct(report.exactRate)}</div>
                <div className="acc-hero__sub-label">完全スコア的中</div>
                <div className="acc-hero__sub-count">
                  {report.total} 試合中 {report.exactHits} 試合
                </div>
              </div>
            </div>

            {/* ベースライン比較（予測力の証明） */}
            <div className="acc-skill">
              <span className="acc-skill__title">予測力の比較:</span>
              <span className="acc-skill__item acc-skill__item--weak">ランダム3択 {pct(report.baselineRandomRate)}</span>
              <span className="acc-skill__arrow">›</span>
              <span className="acc-skill__item acc-skill__item--weak">常にホーム {pct(report.baselineHomeRate)}</span>
              <span className="acc-skill__arrow">›</span>
              <span className="acc-skill__item acc-skill__item--model">本モデル {pct(report.rate)}</span>
              <span className="acc-skill__note">
                ※サッカーの3択予測はブックメーカーでも約53〜56%が上限（引き分け約26%が構造的な壁）。ランダムや単純法を上回れば「予測力あり」。
              </span>
            </div>

            <div className="acc-table-wrap">
              <table className="standings-table acc-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>対戦カード</th>
                    <th>結果</th>
                    <th>事前予測</th>
                    <th>判定</th>
                  </tr>
                </thead>
                <tbody>
                  {report.details.map((d) => (
                    <tr key={d.matchId} className={d.hit ? 'acc-row--hit' : 'acc-row--miss'}>
                      <td className="acc-fixture">
                        <TeamSide code={d.homeTeam} side="home" />
                        <span className="acc-vs">{d.homeScore} - {d.awayScore}</span>
                        <TeamSide code={d.awayTeam} side="away" />
                      </td>
                      <td className="acc-actual">
                        {outcomeLabel(d.actual, d.homeTeam, d.awayTeam)}
                        <span className="acc-actual-score">{d.homeScore}-{d.awayScore}</span>
                      </td>
                      <td className="acc-pred">
                        <span>
                          {outcomeLabel(d.predicted, d.homeTeam, d.awayTeam)}
                          <span className="acc-conf">（{pct(d.confidence)}）</span>
                        </span>
                        <span className={`acc-pred-score ${d.exactHit ? 'acc-pred-score--hit' : ''}`}>
                          最有力スコア {d.predictedScore[0]}-{d.predictedScore[1]}
                        </span>
                      </td>
                      <td className="acc-judge">
                        {d.hit ? (
                          <span className="acc-mark acc-mark--hit">◯</span>
                        ) : (
                          <span className="acc-mark acc-mark--miss">✕</span>
                        )}
                        {d.exactHit && <span className="acc-exact" title="完全スコア的中">★</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ===== ② 進出的中（グループ突破） ===== */}
            <SectionHeader n="②" title="進出的中（グループ突破）" sub="各グループ上位2＝決勝トーナメント進出" />
            {adv.completedGroups === 0 ? (
              <p className="acc-subnote">
                グループが1つ完了すると、突破チームの的中が集計されます（現在 完了 0 / 12 グループ）。
              </p>
            ) : (
              <>
                <div className="acc-hero">
                  <div className="acc-hero__main">
                    <div className="acc-hero__rate">{pct(adv.advRate)}</div>
                    <div className="acc-hero__label">突破的中率（上位2）</div>
                    <div className="acc-hero__count">
                      {adv.advTotal} 枠中 <strong>{adv.advHits}</strong> 枠的中・完了 {adv.completedGroups}/12 グループ
                    </div>
                  </div>
                  <div className="acc-hero__sub">
                    <div className="acc-hero__sub-rate">{pct(adv.winnerRate)}</div>
                    <div className="acc-hero__sub-label">首位（1位）的中</div>
                    <div className="acc-hero__sub-count">
                      {adv.completedGroups} グループ中 {adv.winnerHits}
                    </div>
                  </div>
                </div>

                <div className="acc-table-wrap">
                  <table className="standings-table acc-table">
                    <thead>
                      <tr>
                        <th>組</th>
                        <th style={{ textAlign: 'left' }}>事前予測の突破2</th>
                        <th style={{ textAlign: 'left' }}>実際の突破2</th>
                        <th>的中</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adv.groups.map((g) => (
                        <tr
                          key={g.group}
                          className={!g.complete ? '' : g.hits === 2 ? 'acc-row--hit' : g.hits === 0 ? 'acc-row--miss' : ''}
                        >
                          <td className="acc-group">{g.group}</td>
                          <td className="acc-adv-cell">
                            {g.predictedTop2.map((c) => <TeamMini key={c} code={c} />)}
                          </td>
                          <td className="acc-adv-cell">
                            {g.complete && g.actualTop2
                              ? g.actualTop2.map((c) => <TeamMini key={c} code={c} />)
                              : <span className="acc-pending">進行中…</span>}
                          </td>
                          <td className="acc-judge">
                            {!g.complete ? (
                              <span className="acc-pending">—</span>
                            ) : (
                              <span className={`acc-frac ${g.hits === 2 ? 'acc-frac--full' : g.hits === 1 ? 'acc-frac--half' : 'acc-frac--zero'}`}>
                                {g.hits} / 2
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ===== ③ 決勝トーナメント 試合的中 ===== */}
            <SectionHeader n="③" title="決勝トーナメント 試合的中" sub="勝敗のみ（PK決着を含む・引き分けなし）" />
            {ko.total === 0 ? (
              <p className="acc-subnote">
                {groupAllFinished
                  ? '決勝トーナメントの試合結果が入ると、勝敗の的中が集計されます。'
                  : 'グループステージ完了後・決勝トーナメント開催後に集計されます（現在はグループ進行中）。'}
              </p>
            ) : (
              <>
                <div className="acc-hero">
                  <div className="acc-hero__main">
                    <div className="acc-hero__rate">{pct(ko.rate)}</div>
                    <div className="acc-hero__label">勝敗的中率（KO）</div>
                    <div className="acc-hero__count">
                      {ko.total} 試合中 <strong>{ko.hits}</strong> 試合的中
                    </div>
                  </div>
                </div>
                <div className="acc-table-wrap">
                  <table className="standings-table acc-table">
                    <thead>
                      <tr>
                        <th>ラウンド</th>
                        <th style={{ textAlign: 'left' }}>対戦</th>
                        <th>事前予測の勝者</th>
                        <th>実際の勝者</th>
                        <th>判定</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ko.details.map((d) => (
                        <tr key={d.id} className={d.hit ? 'acc-row--hit' : 'acc-row--miss'}>
                          <td className="acc-group">{d.round}</td>
                          <td className="acc-adv-cell">
                            <TeamMini code={d.team1} /><span className="acc-vs">vs</span><TeamMini code={d.team2} />
                          </td>
                          <td><TeamMini code={d.predictedWinner} /></td>
                          <td><TeamMini code={d.actualWinner} /></td>
                          <td className="acc-judge">
                            {d.hit ? <span className="acc-mark acc-mark--hit">◯</span> : <span className="acc-mark acc-mark--miss">✕</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AccuracyPanel;
