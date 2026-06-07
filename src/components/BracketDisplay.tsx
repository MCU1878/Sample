import React from 'react';
import type { KnockoutMatch } from '../types';
import { teams, getFlagUrl } from '../data';

interface BracketDisplayProps {
  knockoutMatches: KnockoutMatch[];
  onScoreChange: (
    matchId: string,
    updates: Partial<Pick<KnockoutMatch, 'score1' | 'score2' | 'pen1' | 'pen2'>>
  ) => void;
}

// 勝ち上がりツリーに沿った試合の表示順序
const R32_ORDER = [
  'R32-1', 'R32-3',   // Match 73 & 75 -> R16-1
  'R32-2', 'R32-5',   // Match 74 & 77 -> R16-2
  'R32-4', 'R32-6',   // Match 76 & 78 -> R16-3
  'R32-7', 'R32-8',   // Match 79 & 80 -> R16-4
  'R32-11', 'R32-12', // Match 83 & 84 -> R16-5
  'R32-9', 'R32-10',  // Match 81 & 82 -> R16-6
  'R32-14', 'R32-16', // Match 86 & 88 -> R16-7
  'R32-13', 'R32-15'  // Match 85 & 87 -> R16-8
];

const R16_ORDER = [
  'R16-1', 'R16-2',   // Match 89 & 90 -> QF-1
  'R16-3', 'R16-4',   // Match 91 & 92 -> QF-2
  'R16-5', 'R16-6',   // Match 93 & 94 -> QF-3
  'R16-7', 'R16-8'    // Match 95 & 96 -> QF-4
];

const QF_ORDER = [
  'QF-1', 'QF-2',     // Match 97 & 98 -> SF-1
  'QF-3', 'QF-4'      // Match 99 & 100 -> SF-2
];

const SF_ORDER = [
  'SF-1', 'SF-2'      // Match 101 & 102 -> FINAL
];

const BracketDisplay: React.FC<BracketDisplayProps> = ({ knockoutMatches, onScoreChange }) => {
  // 各ラウンドごとに試合をツリー順にソート
  const r32 = knockoutMatches
    .filter((m) => m.round === 'R32')
    .sort((a, b) => R32_ORDER.indexOf(a.id) - R32_ORDER.indexOf(b.id));
  const r16 = knockoutMatches
    .filter((m) => m.round === 'R16')
    .sort((a, b) => R16_ORDER.indexOf(a.id) - R16_ORDER.indexOf(b.id));
  const qf = knockoutMatches
    .filter((m) => m.round === 'QF')
    .sort((a, b) => QF_ORDER.indexOf(a.id) - QF_ORDER.indexOf(b.id));
  const sf = knockoutMatches
    .filter((m) => m.round === 'SF')
    .sort((a, b) => SF_ORDER.indexOf(a.id) - SF_ORDER.indexOf(b.id));
  const finalMatch = knockoutMatches.find((m) => m.round === 'FINAL');
  const thirdMatch = knockoutMatches.find((m) => m.round === 'THIRD');


  // スコア入力ハンドラ
  const handleScoreInput = (
    matchId: string,
    field: 'score1' | 'score2' | 'pen1' | 'pen2',
    val: string
  ) => {
    if (val === '') {
      onScoreChange(matchId, { [field]: null });
      return;
    }
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onScoreChange(matchId, { [field]: parsed });
    }
  };

  // 優勝国の判定
  const getChampion = () => {
    if (!finalMatch || finalMatch.score1 === null || finalMatch.score2 === null) return null;
    if (finalMatch.score1 > finalMatch.score2) return finalMatch.team1;
    if (finalMatch.score1 < finalMatch.score2) return finalMatch.team2;
    // PK
    if (finalMatch.pen1 !== null && finalMatch.pen2 !== null) {
      return finalMatch.pen1 > finalMatch.pen2 ? finalMatch.team1 : finalMatch.team2;
    }
    return null;
  };

  const championCode = getChampion();
  const championTeam = championCode ? teams[championCode] : null;

  const renderMatchCard = (match: KnockoutMatch) => {
    const t1 = match.team1 ? teams[match.team1] : null;
    const t2 = match.team2 ? teams[match.team2] : null;

    const isComplete = match.score1 !== null && match.score2 !== null;
    const isDraw = isComplete && match.score1 === match.score2;

    // 勝敗によるクラス割り当て
    let t1Class = 'knockout-card__team';
    let t2Class = 'knockout-card__team';

    if (isComplete) {
      if (match.score1! > match.score2!) {
        t1Class += ' knockout-card__team--winner';
        t2Class += ' knockout-card__team--loser';
      } else if (match.score1! < match.score2!) {
        t2Class += ' knockout-card__team--winner';
        t1Class += ' knockout-card__team--loser';
      } else if (match.pen1 !== null && match.pen2 !== null) {
        if (match.pen1 > match.pen2) {
          t1Class += ' knockout-card__team--winner';
          t2Class += ' knockout-card__team--loser';
        } else {
          t2Class += ' knockout-card__team--winner';
          t1Class += ' knockout-card__team--loser';
        }
      }
    }

    const isActive = match.team1 !== null && match.team2 !== null;

    return (
      <div
        key={match.id}
        id={match.id}
        className={`knockout-card ${isActive ? 'knockout-card--active' : ''}`}
      >
        <div className="knockout-card__header">
          <span>{match.label}</span>
          <span>{match.date.slice(5)}</span>
        </div>

        {/* Team 1 */}
        <div className={t1Class}>
          <div className="knockout-card__team-info">
            {t1?.iso ? (
              <img
                src={getFlagUrl(t1.iso)}
                alt={t1.name}
                className="knockout-card__flag-img"
              />
            ) : (
              <span className="knockout-card__flag-placeholder">🏳️</span>
            )}
            <span>
              {t1 ? `${t1.name} (#${t1.fifaRank})` : (match.team1 ? match.team1 : configLabelToText(match.team1Source))}
            </span>
          </div>
          {isActive && (
            <div className="knockout-card__score-area">
              {isDraw && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span className="knockout-card__pk-label">PK</span>
                  <input
                    type="number"
                    className="knockout-card__pk-input"
                    value={match.pen1 ?? ''}
                    min={0}
                    onChange={(e) => handleScoreInput(match.id, 'pen1', e.target.value)}
                  />
                </div>
              )}
              <input
                type="number"
                className="knockout-card__score-input"
                value={match.score1 ?? ''}
                min={0}
                onChange={(e) => handleScoreInput(match.id, 'score1', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className={t2Class}>
          <div className="knockout-card__team-info">
            {t2?.iso ? (
              <img
                src={getFlagUrl(t2.iso)}
                alt={t2.name}
                className="knockout-card__flag-img"
              />
            ) : (
              <span className="knockout-card__flag-placeholder">🏳️</span>
            )}
            <span>
              {t2 ? `${t2.name} (#${t2.fifaRank})` : (match.team2 ? match.team2 : configLabelToText(match.team2Source))}
            </span>
          </div>
          {isActive && (
            <div className="knockout-card__score-area">
              {isDraw && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span className="knockout-card__pk-label">PK</span>
                  <input
                    type="number"
                    className="knockout-card__pk-input"
                    value={match.pen2 ?? ''}
                    min={0}
                    onChange={(e) => handleScoreInput(match.id, 'pen2', e.target.value)}
                  />
                </div>
              )}
              <input
                type="number"
                className="knockout-card__score-input"
                value={match.score2 ?? ''}
                min={0}
                onChange={(e) => handleScoreInput(match.id, 'score2', e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // ソーステキストを日本語のフレンドリーな形式に変換
  const configLabelToText = (src: string) => {
    if (src.startsWith('1')) return `${src[1]}組 1位`;
    if (src.startsWith('2')) return `${src[1]}組 2位`;
    if (src === '3rd-A') return '3CEFHI';
    if (src === '3rd-B') return '3EFGIJ';
    if (src === '3rd-D') return '3BEFIJ';
    if (src === '3rd-E') return '3ABCDF';
    if (src === '3rd-G') return '3AEHIJ';
    if (src === '3rd-I') return '3CDFGH';
    if (src === '3rd-K') return '3DEIJL';
    if (src === '3rd-L') return '3EHIJK';
    if (src.startsWith('3rd')) return `3位グループ`;
    
    if (src.startsWith('W-') || src.startsWith('L-')) {
      const isWinner = src.startsWith('W-');
      const targetId = src.substring(2);
      const targetMatch = knockoutMatches.find((m) => m.id === targetId);
      if (targetMatch) {
        return `Match ${targetMatch.matchNumber} ${isWinner ? '勝者' : '敗者'}`;
      }
    }
    return 'TBD';
  };

  // 2試合ずつペアにしてレンダリングするヘルパー関数
  const renderRoundPairs = (matches: KnockoutMatch[]) => {
    const pairs = [];
    for (let i = 0; i < matches.length; i += 2) {
      const m1 = matches[i];
      const m2 = matches[i + 1];
      pairs.push(
        <div key={`pair-${m1.id}-${m2 ? m2.id : 'none'}`} className="knockout-match-pair">
          {renderMatchCard(m1)}
          {m2 && renderMatchCard(m2)}
        </div>
      );
    }
    return pairs;
  };

  return (
    <section className="knockout-container">
      <div className="knockout-header">
        <h2 className="knockout-header__title">ノックアウトステージ (Knockout Stage)</h2>
        <p className="knockout-header__desc">
          ベスト32から決勝戦まで。各試合のスコアを入力してリアルタイムで次のラウンドに勝ち進みます。
        </p>
      </div>

      <div className="knockout-bracket-scroll">
        <div className="knockout-bracket-tree">
          {/* Round of 32 */}
          <div className="knockout-round-col knockout-round-col--r32">
            <div className="knockout-round-col__title">ベスト32 (Round of 32)</div>
            {renderRoundPairs(r32)}
          </div>

          {/* Round of 16 */}
          <div className="knockout-round-col knockout-round-col--r16">
            <div className="knockout-round-col__title">ベスト16 (Round of 16)</div>
            {renderRoundPairs(r16)}
          </div>

          {/* Quarterfinals */}
          <div className="knockout-round-col knockout-round-col--qf">
            <div className="knockout-round-col__title">準々決勝 (QF)</div>
            {renderRoundPairs(qf)}
          </div>

          {/* Semifinals */}
          <div className="knockout-round-col knockout-round-col--sf">
            <div className="knockout-round-col__title">準決勝 (SF)</div>
            {renderRoundPairs(sf)}
          </div>

          {/* Final & 3rd Place */}
          <div className="knockout-round-col knockout-round-col--final" style={{ justifyContent: 'center', gap: '30px' }}>
            <div>
              <div className="knockout-round-col__title" style={{ borderColor: varCss('--gold-500'), color: varCss('--gold-300') }}>
                🏆 決勝戦 (Final)
              </div>
              {finalMatch && renderMatchCard(finalMatch)}
            </div>

            <div>
              <div className="knockout-round-col__title" style={{ borderColor: '#64748b', color: '#94a3b8' }}>
                🥉 3位決定戦
              </div>
              {thirdMatch && renderMatchCard(thirdMatch)}
            </div>
          </div>
        </div>
      </div>

      {/* 優勝国の祝福表示 */}
      {championTeam && (
        <div className="champion-podium animate-fade-in">
          <div className="champion-crown">👑</div>
          <div>FIFA WORLD CUP 2026™ CHAMPION</div>
          <img
            src={getFlagUrl(championTeam.iso, 160)}
            alt={championTeam.name}
            className="champion-flag"
          />
          <div className="champion-name">{championTeam.name}</div>
        </div>
      )}
    </section>
  );
};

// ヘルパー: CSS変数または代わりの色を返す
function varCss(name: string): string {
  if (name === '--gold-500') return '#f5a623';
  if (name === '--gold-300') return '#fad278';
  return '#ccc';
}

export default BracketDisplay;
