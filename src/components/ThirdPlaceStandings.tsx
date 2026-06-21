import React from 'react';
import type { TeamStanding } from '../types';
import { teams, getFlagUrl } from '../data';
import { getAllThirdPlaceTeams } from '../utils/calculateStandings';

interface ThirdPlaceStandingsProps {
  allStandings: Record<string, TeamStanding[]>;
}

const COLUMN_HEADERS = ['#', 'Grp', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'] as const;

function getGdClass(gd: number): string {
  if (gd > 0) return 'standings-row__gd standings-row__gd--positive';
  if (gd < 0) return 'standings-row__gd standings-row__gd--negative';
  return 'standings-row__gd';
}

function formatGd(gd: number): string {
  if (gd > 0) return `+${gd}`;
  return `${gd}`;
}

function getRowClass(overallRank: number): string {
  const base = 'standings-row';
  if (overallRank <= 8) return `${base} standings-row--qualified`;
  return `${base} standings-row--eliminated`;
}

function getRankClass(overallRank: number): string {
  const base = 'standings-row__rank';
  if (overallRank <= 8) return `${base} standings-row__rank--1`;
  return base;
}

export const ThirdPlaceStandings: React.FC<ThirdPlaceStandingsProps> = ({ allStandings }) => {
  const thirdPlaceTeams = getAllThirdPlaceTeams(allStandings);

  if (thirdPlaceTeams.length === 0) return null;

  return (
    <div className="standings-group-card" style={{ marginTop: '20px' }}>
      <div className="group-badge" style={{ background: 'linear-gradient(135deg, #f5a623, #f8c063)', color: '#0f172a' }}>
        各グループ3位成績比較 (Best 3rd Place Teams)
      </div>
      <div style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
        ※ 全12グループの3位チームのうち、**上位8チーム**が決勝トーナメント（ベスト32）に進出します。
      </div>
      <table className="standings-table">
        <thead>
          <tr>
            {COLUMN_HEADERS.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {thirdPlaceTeams.map((standing, index) => {
            const overallRank = index + 1;
            const team = teams[standing.teamCode];
            return (
              <tr key={standing.teamCode} className={getRowClass(overallRank)}>
                <td data-label="#" className={getRankClass(overallRank)}>{overallRank}</td>
                <td data-label="Grp" style={{ fontWeight: 'bold', color: '#f5a623', textAlign: 'center' }}>
                  {standing.group}
                </td>
                <td data-label="Team" className="standings-row__team">
                  {team?.iso ? (
                    <img
                      src={getFlagUrl(team.iso)}
                      alt={team.name}
                      className="standings-row__team-flag-img"
                      loading="lazy"
                    />
                  ) : (
                    <span className="standings-row__team-flag">🏳️</span>
                  )}
                  <span className="standings-row__team-name">
                    {team?.name ?? standing.teamCode}
                    <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '4px' }}>(#{team?.fifaRank})</span>
                  </span>
                </td>
                <td data-label="P">{standing.played}</td>
                <td data-label="W">{standing.won}</td>
                <td data-label="D">{standing.drawn}</td>
                <td data-label="L">{standing.lost}</td>
                <td data-label="GF">{standing.goalsFor}</td>
                <td data-label="GA">{standing.goalsAgainst}</td>
                <td data-label="GD" className={getGdClass(standing.goalDifference)}>
                  {formatGd(standing.goalDifference)}
                </td>
                <td data-label="Pts" className="standings-row__points" style={{ color: overallRank <= 8 ? '#4ade80' : '#f87171' }}>
                  {standing.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ThirdPlaceStandings;
