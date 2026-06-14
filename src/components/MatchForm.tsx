import type { Match } from '../types';
import { teams, getFlagUrl } from '../data';

interface MatchFormProps {
  matches: Match[];
  activeGroup: string;
  onScoreChange: (matchId: string, side: 'home' | 'away', score: number | null) => void;
  isSyncing?: boolean;
}

export const MatchForm: React.FC<MatchFormProps> = ({ matches, activeGroup, onScoreChange, isSyncing = false }) => {
  const groupMatches = matches.filter((match) => match.group === activeGroup);

  const handleScoreChange = (
    matchId: string,
    side: 'home' | 'away',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const raw = e.target.value;
    if (raw === '') {
      onScoreChange(matchId, side, null);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 99) {
      onScoreChange(matchId, side, parsed);
    }
  };

  const isMatchComplete = (match: Match): boolean =>
    match.homeScore !== null && match.awayScore !== null;

  return (
    <div className="match-form">
      {groupMatches.map((match) => {
        const home = teams[match.homeTeam];
        const away = teams[match.awayTeam];
        const complete = isMatchComplete(match);

        return (
          <div
            key={match.id}
            className={`match-row${complete ? ' match-row--played' : ''}`}
          >
            {/* 試合日時 */}
            <div className="match-row__meta">
              <span className="match-row__date">{match.date.slice(5)}</span>
              <span className="match-row__time">{match.time}</span>
            </div>

            {/* ホームチーム */}
            <div className="match-row__team match-row__team--home">
              <span className="match-row__team-name">
                {home?.name ?? match.homeTeam}
                <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '4px' }}>(#{home?.fifaRank})</span>
              </span>
              {home?.iso && (
                <img
                  src={getFlagUrl(home.iso)}
                  alt={home.name}
                  className="match-row__flag-img"
                  loading="lazy"
                />
              )}
            </div>

            {/* スコア入力 */}
            <input
              type="number"
              className={`match-row__score-input ${match.syncStatus ? 'is-live' : ''}`}
              min="0"
              max="99"
              value={match.homeScore ?? ''}
              onChange={(e) => handleScoreChange(match.id, 'home', e)}
              disabled={!!match.syncStatus || isSyncing}
              aria-label={`${home?.name ?? match.homeTeam} のスコア`}
            />
            <span className="match-row__vs">
              {match.syncStatus ? (
                <span className={`live-badge ${match.syncStatus === 'finished' ? 'live-badge--finished' : ''}`} title="API Synced">
                  {match.syncStatus === 'finished' ? 'FT' : 'LIVE'}
                </span>
              ) : 'VS'}
            </span>
            <input
              type="number"
              className={`match-row__score-input ${match.syncStatus ? 'is-live' : ''}`}
              min="0"
              max="99"
              value={match.awayScore ?? ''}
              onChange={(e) => handleScoreChange(match.id, 'away', e)}
              disabled={!!match.syncStatus || isSyncing}
              aria-label={`${away?.name ?? match.awayTeam} のスコア`}
            />

            {/* アウェイチーム */}
            <div className="match-row__team match-row__team--away">
              {away?.iso && (
                <img
                  src={getFlagUrl(away.iso)}
                  alt={away.name}
                  className="match-row__flag-img"
                  loading="lazy"
                />
              )}
              <span className="match-row__team-name">
                {away?.name ?? match.awayTeam}
                <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '4px' }}>(#{away?.fifaRank})</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
