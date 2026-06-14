import React, { useState, useEffect } from 'react';
import type { MatchLog, MatchEvent } from '../types';
import { teams } from '../data';
import playersDataRaw from '../data/players.json';
import type { Player } from '../types';

const playersData = playersDataRaw as Record<string, Player[]>;

interface Props {
  log: MatchLog;
  onClose: () => void;
}

const getFlagUrl = (iso?: string) => iso ? `https://flagcdn.com/w40/${iso.toLowerCase()}.png` : '';

export const MatchLogModal: React.FC<Props> = ({ log, onClose }) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'stats' | 'lineups'>('timeline');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const home = teams[log.homeTeam];
  const away = teams[log.awayTeam];

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getEventIcon = (type: MatchEvent['type']) => {
    switch (type) {
      case 'GOAL': return '⚽';
      case 'YELLOW_CARD': return '🟨';
      case 'RED_CARD': return '🟥';
      case 'MOMENTUM_SHIFT': return '🌊';
      case 'INJURY': return '🏥';
      case 'PENALTY_KICK': return '🥅';
      default: return '⏱️';
    }
  };

  const renderStatBar = (homeVal: number, awayVal: number, label: string, isPercent = false) => {
    const total = homeVal + awayVal;
    const hRatio = total === 0 ? 50 : (homeVal / total) * 100;
    const aRatio = total === 0 ? 50 : (awayVal / total) * 100;

    return (
      <div className="stat-row" key={label}>
        <div className="stat-values">
          <span className={`stat-val ${homeVal > awayVal ? 'stat-winner' : ''}`}>{homeVal}{isPercent ? '%' : ''}</span>
          <span className="stat-label">{label}</span>
          <span className={`stat-val ${awayVal > homeVal ? 'stat-winner' : ''}`}>{awayVal}{isPercent ? '%' : ''}</span>
        </div>
        <div className="stat-bar-container">
          <div className="stat-bar stat-bar--home" style={{ width: `${hRatio}%` }} />
          <div className="stat-bar stat-bar--away" style={{ width: `${aRatio}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="match-log-overlay" onClick={handleOverlayClick}>
      <div className="match-log-modal">
        <button className="match-log-close" onClick={onClose} aria-label="Close">×</button>
        
        {/* Header */}
        <div className="match-log-header">
          <div className="match-log-team match-log-team--home">
            <img src={getFlagUrl(home?.iso)} alt={home?.name} className="match-log-flag" />
            <span className="match-log-name">{home?.name}</span>
          </div>
          <div className="match-log-score">
            <div className="match-log-score-val">{log.homeScore} - {log.awayScore}</div>
            {log.isPenaltyShootout && (
              <div className="match-log-pk-score">PK: {log.homePenScore} - {log.awayPenScore}</div>
            )}
            <div className="match-log-status">
              {log.isExtraTime ? 'AET' : 'FT'}
            </div>
          </div>
          <div className="match-log-team match-log-team--away">
            <img src={getFlagUrl(away?.iso)} alt={away?.name} className="match-log-flag" />
            <span className="match-log-name">{away?.name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="match-log-tabs">
          <button 
            className={`match-log-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </button>
          <button 
            className={`match-log-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Match Stats
          </button>
          <button 
            className={`match-log-tab ${activeTab === 'lineups' ? 'active' : ''}`}
            onClick={() => setActiveTab('lineups')}
          >
            Lineups
          </button>
        </div>

        {/* Content */}
        <div className="match-log-content">
          {activeTab === 'timeline' && (
            <div className="timeline-container">
              <div className="timeline-line" />
              {log.events.map((ev, i) => {
                const isHome = ev.team === log.homeTeam;
                const isNeutral = !ev.team;
                return (
                  <div key={i} className={`timeline-item ${isNeutral ? 'neutral' : isHome ? 'home' : 'away'}`} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="timeline-minute">{ev.minute}'</div>
                    <div className="timeline-icon">{getEventIcon(ev.type)}</div>
                    <div className="timeline-desc">{ev.description}</div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'stats' && log.homeStats && log.awayStats && (
            <div className="stats-container">
              {renderStatBar(log.homeStats.possession, log.awayStats.possession, 'Possession', true)}
              {renderStatBar(log.homeStats.expectedGoals, log.awayStats.expectedGoals, 'Expected Goals (xG)')}
              {renderStatBar(log.homeStats.shots, log.awayStats.shots, 'Total Shots')}
              {renderStatBar(log.homeStats.shotsOnTarget, log.awayStats.shotsOnTarget, 'Shots on Target')}
              {renderStatBar(log.homeStats.fouls, log.awayStats.fouls, 'Fouls')}
              {renderStatBar(log.homeStats.yellowCards, log.awayStats.yellowCards, 'Yellow Cards')}
              {renderStatBar(log.homeStats.redCards, log.awayStats.redCards, 'Red Cards')}
              
              <div className="stamina-info">
                <div className="stamina-info-title">End of Match Stamina</div>
                {renderStatBar(Math.round(log.homeEndStamina * 100), Math.round(log.awayEndStamina * 100), 'Stamina Left', true)}
              </div>
            </div>
          )}

          {activeTab === 'lineups' && (
            <div className="lineups-container">
              <div className="lineup-team">
                <h3 className="lineup-team-name">{home?.name}</h3>
                <div className="lineup-list">
                  {(playersData[log.homeTeam] || []).map(p => (
                    <div key={p.id} className="lineup-player" onClick={() => setSelectedPlayer(p)}>
                      <span className={`player-pos pos-${p.position.toLowerCase()}`}>{p.position}</span>
                      <span className="player-name">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lineup-team">
                <h3 className="lineup-team-name">{away?.name}</h3>
                <div className="lineup-list">
                  {(playersData[log.awayTeam] || []).map(p => (
                    <div key={p.id} className="lineup-player" onClick={() => setSelectedPlayer(p)}>
                      <span className={`player-pos pos-${p.position.toLowerCase()}`}>{p.position}</span>
                      <span className="player-name">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedPlayer && (
          <div className="player-detail-overlay" onClick={() => setSelectedPlayer(null)}>
            <div className="player-detail-modal glass-panel" onClick={e => e.stopPropagation()}>
              <h3 className="player-detail-name">{selectedPlayer.name}</h3>
              <div className="player-detail-info">
                <div className="info-row"><span className="info-label">Position:</span> <span className={`player-pos pos-${selectedPlayer.position.toLowerCase()}`}>{selectedPlayer.position}</span></div>
                <div className="info-row"><span className="info-label">ID:</span> <span>{selectedPlayer.id}</span></div>
              </div>
              <button className="btn-primary mt-4" onClick={() => setSelectedPlayer(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
