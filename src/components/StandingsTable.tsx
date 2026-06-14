import React from 'react';
import type { TeamStanding } from '../types';
import { teams, getFlagUrl } from '../data';

interface StandingsTableProps {
  allStandings: Record<string, TeamStanding[]>;
  activeGroup: string;
}

const COLUMN_HEADERS = ['#', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'] as const;

function getGdClass(gd: number): string {
  if (gd > 0) return 'standings-row__gd standings-row__gd--positive';
  if (gd < 0) return 'standings-row__gd standings-row__gd--negative';
  return 'standings-row__gd';
}

function formatGd(gd: number): string {
  if (gd > 0) return `+${gd}`;
  return `${gd}`;
}

function getRowClass(rank: number): string {
  const base = 'standings-row';
  if (rank <= 2) return `${base} standings-row--qualified`;
  if (rank === 3) return `${base} standings-row--third`;
  return `${base} standings-row--eliminated`;
}

function getRankClass(rank: number): string {
  const base = 'standings-row__rank';
  if (rank === 1) return `${base} standings-row__rank--1`;
  if (rank === 2) return `${base} standings-row__rank--2`;
  return base;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ allStandings, activeGroup }) => {
  const standings = allStandings[activeGroup] || [];
  
  if (standings.length === 0) return null;

  return (
    <div className="standings-group-card animate-fade-in" style={{ border: 'none', background: 'transparent', padding: 0 }}>
      <table className="standings-table">
        <thead>
          <tr>
            {COLUMN_HEADERS.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => {
            const team = teams[standing.teamCode];
            return (
              <tr key={standing.teamCode} className={getRowClass(standing.rank)}>
                <td className={getRankClass(standing.rank)}>{standing.rank}</td>
                <td className="standings-row__team">
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
                <td>{standing.played}</td>
                <td>{standing.won}</td>
                <td>{standing.drawn}</td>
                <td>{standing.lost}</td>
                <td>{standing.goalsFor}</td>
                <td>{standing.goalsAgainst}</td>
                <td className={getGdClass(standing.goalDifference)}>
                  {formatGd(standing.goalDifference)}
                </td>
                <td className="standings-row__points">{standing.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default StandingsTable;

