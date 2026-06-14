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
          redCards: 0
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
    });

    return Array.from(playerStats.values());
  }, [logs]);

  const topScorers = [...stats].sort((a, b) => b.goals - a.goals).slice(0, 10);
  const topAssists = [...stats].sort((a, b) => b.assists - a.assists).slice(0, 10);
  
  // MVP estimation: Goals * 2 + Assists
  const mvpList = [...stats].sort((a, b) => (b.goals * 2 + b.assists) - (a.goals * 2 + a.assists)).slice(0, 10);

  const getFlagUrl = (iso?: string) => iso ? `https://flagcdn.com/w40/${iso.toLowerCase()}.png` : '';

  return (
    <div className="match-log-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="match-log-modal glass-panel" style={{ width: '900px' }}>
        <button className="match-log-close" onClick={onClose}>×</button>
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--cyan-300)' }}>🏆 Tournament Leaderboard</h2>
        
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'space-between' }}>
          
          <div style={{ flex: 1 }}>
            <h3 className="text-xl mb-4 text-center">⚽ Top Scorers</h3>
            <div className="flex flex-col gap-2">
              {topScorers.filter(p => p.goals > 0).map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-2" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ opacity: 0.5, width: '20px' }}>{i + 1}</span>
                    <img src={getFlagUrl(teams[p.teamCode]?.iso)} alt={p.teamCode} style={{ width: '20px' }} />
                    <span>{p.name}</span>
                  </div>
                  <span className="font-bold text-lg">{p.goals}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <h3 className="text-xl mb-4 text-center">👟 Top Assists</h3>
            <div className="flex flex-col gap-2">
              {topAssists.filter(p => p.assists > 0).map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-2" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ opacity: 0.5, width: '20px' }}>{i + 1}</span>
                    <img src={getFlagUrl(teams[p.teamCode]?.iso)} alt={p.teamCode} style={{ width: '20px' }} />
                    <span>{p.name}</span>
                  </div>
                  <span className="font-bold text-lg">{p.assists}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <h3 className="text-xl mb-4 text-center">⭐ MVP Race</h3>
            <div className="flex flex-col gap-2">
              {mvpList.filter(p => p.goals > 0 || p.assists > 0).map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-2" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ opacity: 0.5, width: '20px' }}>{i + 1}</span>
                    <img src={getFlagUrl(teams[p.teamCode]?.iso)} alt={p.teamCode} style={{ width: '20px' }} />
                    <span>{p.name}</span>
                  </div>
                  <span className="font-bold text-lg" style={{ color: 'var(--yellow-400)' }}>{(p.goals * 2 + p.assists)} pts</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
