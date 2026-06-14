import React, { useMemo } from 'react';
import type { MatchLog, Player } from '../types';
import playersDataRaw from '../data/players.json';
import { teams } from '../data';

const playersData = playersDataRaw as Record<string, Player[]>;

interface Props {
  logs: MatchLog[];
  onClose: () => void;
}

interface PlayerStats {
  id: string;
  name: string;
  teamCode: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ratingsSum: number;
  ratingsCount: number;
}

export const Leaderboard: React.FC<Props> = ({ logs, onClose }) => {
  const stats = useMemo(() => {
    const playerStats = new Map<string, PlayerStats>();

    const getPlayer = (id: string, teamCode: string) => {
      if (!playerStats.has(id)) {
        const teamRoster = playersData[teamCode] || [];
        const player = teamRoster.find(p => p.id === id);
        playerStats.set(id, {
          id,
          name: player?.name || 'Unknown',
          teamCode,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          ratingsSum: 0,
          ratingsCount: 0
        });
      }
      return playerStats.get(id)!;
    };

    logs.forEach(log => {
      log.events.forEach(ev => {
        if (!ev.playerId) return;
        
        const p = getPlayer(ev.playerId, ev.team);
        if (ev.type === 'GOAL') {
          p.goals += 1;
        } else if (ev.type === 'YELLOW_CARD') {
          p.yellowCards += 1;
        } else if (ev.type === 'RED_CARD') {
          p.redCards += 1;
        }

        if (ev.assistId) {
          const a = getPlayer(ev.assistId, ev.team);
          a.assists += 1;
        }
      });

      if (log.playerRatings) {
        log.playerRatings.forEach(pr => {
          const isHome = playersData[log.homeTeam]?.some(p => p.id === pr.playerId);
          const teamCode = isHome ? log.homeTeam : log.awayTeam;
          const p = getPlayer(pr.playerId, teamCode);
          p.ratingsSum += pr.rating;
          p.ratingsCount += 1;
        });
      }
    });

    return Array.from(playerStats.values());
  }, [logs]);

  const topScorers = [...stats].sort((a, b) => b.goals - a.goals).slice(0, 10);
  const topAssists = [...stats].sort((a, b) => b.assists - a.assists).slice(0, 10);
  
  // MVP estimation: Average Rating
  const mvpList = [...stats]
    .filter(p => p.ratingsCount > 0)
    .sort((a, b) => (b.ratingsSum / b.ratingsCount) - (a.ratingsSum / a.ratingsCount))
    .slice(0, 10);

  const getFlagUrl = (iso?: string) => iso ? `https://flagcdn.com/w40/${iso.toLowerCase()}.png` : '';

  const renderRank = (index: number) => {
    if (index === 0) return <span className="rank-badge rank-1">1</span>;
    if (index === 1) return <span className="rank-badge rank-2">2</span>;
    if (index === 2) return <span className="rank-badge rank-3">3</span>;
    return <span className="rank-badge">{index + 1}</span>;
  };

  return (
    <div className="match-log-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="match-log-modal glass-panel leaderboard-modal">
        <button className="match-log-close" onClick={onClose}>×</button>
        <h2 className="leaderboard-title">🏆 Tournament Leaderboard</h2>
        
        <div className="leaderboard-grid">
          
          <div className="leaderboard-column">
            <h3 className="leaderboard-col-title">⚽ Top Scorers</h3>
            <div className="leaderboard-list">
              {topScorers.filter(p => p.goals > 0).map((p, i) => (
                <div key={p.id} className="leaderboard-row">
                  <div className="leaderboard-player-info">
                    {renderRank(i)}
                    <div className="avatar-wrapper">
                      <img src={getFlagUrl(teams[p.teamCode]?.iso)} alt={p.teamCode} className="player-flag-main" />
                    </div>
                    <span className="player-name">{p.name}</span>
                  </div>
                  <span className="player-stat stat-goals">{p.goals}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="leaderboard-column">
            <h3 className="leaderboard-col-title">👟 Top Assists</h3>
            <div className="leaderboard-list">
              {topAssists.filter(p => p.assists > 0).map((p, i) => (
                <div key={p.id} className="leaderboard-row">
                  <div className="leaderboard-player-info">
                    {renderRank(i)}
                    <div className="avatar-wrapper">
                      <img src={getFlagUrl(teams[p.teamCode]?.iso)} alt={p.teamCode} className="player-flag-main" />
                    </div>
                    <span className="player-name">{p.name}</span>
                  </div>
                  <span className="player-stat stat-assists">{p.assists}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="leaderboard-column">
            <h3 className="leaderboard-col-title">⭐ MVP Race</h3>
            <div className="leaderboard-list">
              {mvpList.map((p, i) => (
                <div key={p.id} className="leaderboard-row">
                  <div className="leaderboard-player-info">
                    {renderRank(i)}
                    <div className="avatar-wrapper">
                      <img src={getFlagUrl(teams[p.teamCode]?.iso)} alt={p.teamCode} className="player-flag-main" />
                    </div>
                    <span className="player-name">{p.name}</span>
                  </div>
                  <span className="player-stat stat-mvp">{(p.ratingsSum / p.ratingsCount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
