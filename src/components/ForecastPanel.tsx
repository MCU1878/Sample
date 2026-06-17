import React, { useMemo } from 'react';
import type { ForecastResult } from '../utils/forecast';
import { teams, getFlagUrl } from '../data';

interface ForecastPanelProps {
  result: ForecastResult | null;
  loading: boolean;
}

const pct = (p: number) => (p * 100 >= 9.95 ? `${Math.round(p * 100)}%` : `${(p * 100).toFixed(1)}%`);

export const ForecastPanel: React.FC<ForecastPanelProps> = ({ result, loading }) => {
  // 優勝確率の降順で並べる
  const rows = useMemo(() => {
    if (!result) return [];
    return Object.keys(result.champion)
      .map((code) => ({
        code,
        champion: result.champion[code],
        final: result.final[code],
        semifinal: result.semifinal[code],
        quarterfinal: result.quarterfinal[code],
        roundOf32: result.roundOf32[code],
      }))
      .sort((a, b) => b.champion - a.champion || b.roundOf32 - a.roundOf32);
  }, [result]);

  if (!result && !loading) return null;

  return (
    <div className="card animate-fade-in" style={{ marginTop: '4px' }}>
      <div className="card__header">
        <div className="card__icon card__icon--gold">📊</div>
        <h2 className="card__title">優勝確率シミュレーション</h2>
        {result && (
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#94a3b8' }}>
            {result.iterations.toLocaleString()} 回試行・固定シード / 6指標統合レーティング
          </span>
        )}
      </div>
      <div className="card__body">
        {loading && (
          <div className="forecast-loading">
            <span className="forecast-spinner" /> モンテカルロ計算中…
          </div>
        )}

        {result && (
          <div className="forecast-table-wrap">
            <table className="standings-table forecast-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ textAlign: 'left' }}>チーム</th>
                  <th>優勝</th>
                  <th>決勝</th>
                  <th>ベスト4</th>
                  <th>ベスト8</th>
                  <th>突破</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const team = teams[r.code];
                  return (
                    <tr key={r.code}>
                      <td className="standings-row__rank">{i + 1}</td>
                      <td className="standings-row__team">
                        {team?.iso ? (
                          <img src={getFlagUrl(team.iso)} alt={team.name} className="standings-row__team-flag-img" loading="lazy" />
                        ) : (
                          <span className="standings-row__team-flag">🏳️</span>
                        )}
                        <span className="standings-row__team-name">{team?.name ?? r.code}</span>
                      </td>
                      <td className="forecast-champ-cell">
                        <div className="prob-bar">
                          <div className="prob-bar__fill" style={{ width: `${Math.min(100, r.champion * 100)}%` }} />
                          <span className="prob-bar__label">{pct(r.champion)}</span>
                        </div>
                      </td>
                      <td>{pct(r.final)}</td>
                      <td>{pct(r.semifinal)}</td>
                      <td>{pct(r.quarterfinal)}</td>
                      <td style={{ color: r.roundOf32 >= 0.5 ? '#4ade80' : '#94a3b8' }}>{pct(r.roundOf32)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForecastPanel;
