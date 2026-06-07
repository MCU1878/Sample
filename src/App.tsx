import { useState, useMemo, useCallback } from 'react';
import type { Match, KnockoutMatch } from './types';
import { createInitialMatches, groupTeams, simulateMatchScore } from './data';
import { getAllGroupStandings } from './utils/calculateStandings';
import { initializeKnockoutMatches, updateKnockoutProgression, simulateKnockoutMatches } from './utils/knockoutLogic';
import { MatchForm } from './components/MatchForm';
import StandingsTable from './components/StandingsTable';
import BracketDisplay from './components/BracketDisplay';
import ThirdPlaceStandings from './components/ThirdPlaceStandings';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

function App() {
  const [matches, setMatches] = useState<Match[]>(createInitialMatches);
  const [activeGroup, setActiveGroup] = useState<string>('A');
  
  // ノックアウト用のユーザー入力スコア
  const [knockoutUserScores, setKnockoutUserScores] = useState<
    Record<string, { score1: number | null; score2: number | null; pen1: number | null; pen2: number | null }>
  >({});

  // グループステージスコア変更ハンドラ
  const handleScoreChange = useCallback(
    (matchId: string, side: 'home' | 'away', score: number | null) => {
      setMatches((prev) =>
        prev.map((match) => {
          if (match.id !== matchId) return match;
          return {
            ...match,
            [side === 'home' ? 'homeScore' : 'awayScore']: score,
          };
        })
      );
    },
    []
  );

  // リアルタイム順位計算
  const allStandings = useMemo(
    () => getAllGroupStandings(matches, groupTeams),
    [matches]
  );

  // ノックアウトステージの全試合を算出（グループ順位 ＋ ユーザー入力スコア ＋ 勝ち上がり伝播）
  const knockoutMatches = useMemo(() => {
    // 1. グループ順位から進出枠(R32)を初期決定
    const initialKo = initializeKnockoutMatches(allStandings);
    
    // 2. ユーザーが入力したスコアをマージ
    let merged = initialKo.map((fresh) => {
      const saved = knockoutUserScores[fresh.id];
      if (saved) {
        return {
          ...fresh,
          score1: saved.score1,
          score2: saved.score2,
          pen1: saved.pen1,
          pen2: saved.pen2,
        };
      }
      return fresh;
    });

    // 3. Match 73 (R32-1) から Match 104 (FINAL) までのトポロジカル伝播を適用
    // 依存順に並べることで、順次勝ち上がりを解決していく
    const sortedIds = [
      // Round of 32
      'R32-1', 'R32-2', 'R32-3', 'R32-4', 'R32-5', 'R32-6', 'R32-7', 'R32-8',
      'R32-9', 'R32-10', 'R32-11', 'R32-12', 'R32-13', 'R32-14', 'R32-15', 'R32-16',
      // Round of 16
      'R16-1', 'R16-2', 'R16-3', 'R16-4', 'R16-5', 'R16-6', 'R16-7', 'R16-8',
      // Quarterfinals
      'QF-1', 'QF-2', 'QF-3', 'QF-4',
      // Semifinals
      'SF-1', 'SF-2',
      // Final & Third Place
      'THIRD', 'FINAL'
    ];

    for (const matchId of sortedIds) {
      const match = merged.find((x) => x.id === matchId);
      if (match && (match.score1 !== null && match.score2 !== null)) {
        merged = updateKnockoutProgression(merged, matchId, {
          score1: match.score1,
          score2: match.score2,
          pen1: match.pen1,
          pen2: match.pen2,
        });
      }
    }

    return merged;
  }, [allStandings, knockoutUserScores]);

  // ノックアウトのスコア変更ハンドラ
  const handleKnockoutScoreChange = useCallback(
    (
      matchId: string,
      updates: Partial<Pick<KnockoutMatch, 'score1' | 'score2' | 'pen1' | 'pen2'>>
    ) => {
      setKnockoutUserScores((prev) => {
        const current = prev[matchId] || { score1: null, score2: null, pen1: null, pen2: null };
        return {
          ...prev,
          [matchId]: {
            ...current,
            ...updates,
          },
        };
      });
    },
    []
  );

  // 統計情報
  const stats = useMemo(() => {
    const totalMatches = matches.length;
    const playedMatches = matches.filter(
      (m) => m.homeScore !== null && m.awayScore !== null
    ).length;
    const totalGoals = matches.reduce((sum, m) => {
      if (m.homeScore !== null && m.awayScore !== null) {
        return sum + m.homeScore + m.awayScore;
      }
      return sum;
    }, 0);
    return { totalMatches, playedMatches, totalGoals };
  }, [matches]);

  // 強さを加味した結果入力（グループステージ）
  const handleRandomFill = useCallback(() => {
    setMatches((prev) =>
      prev.map((match) => {
        const { homeScore, awayScore } = simulateMatchScore(match.homeTeam, match.awayTeam);
        return {
          ...match,
          homeScore,
          awayScore,
        };
      })
    );
  }, []);

  // ノックアウト全自動シミュレート
  const handleKnockoutSimulate = useCallback(() => {
    // 1. グループステージが完了していなければ、先にグループステージを強さベースで埋める
    let currentMatches = matches;
    const isGroupComplete = matches.every((m) => m.homeScore !== null && m.awayScore !== null);
    if (!isGroupComplete) {
      currentMatches = matches.map((match) => {
        const { homeScore, awayScore } = simulateMatchScore(match.homeTeam, match.awayTeam);
        return {
          ...match,
          homeScore,
          awayScore,
        };
      });
      setMatches(currentMatches);
    }

    // 最新の順位計算とノックアウト初期化
    const latestStandings = getAllGroupStandings(currentMatches, groupTeams);
    const initialKo = initializeKnockoutMatches(latestStandings);
    
    // 全シミュレート実行
    const simulated = simulateKnockoutMatches(initialKo);

    // シミュレートしたスコアを保存用ステートにマッピングして上書き
    const nextScores: Record<string, { score1: number | null; score2: number | null; pen1: number | null; pen2: number | null }> = {};
    for (const m of simulated) {
      nextScores[m.id] = {
        score1: m.score1,
        score2: m.score2,
        pen1: m.pen1,
        pen2: m.pen2,
      };
    }
    setKnockoutUserScores(nextScores);
  }, [matches]);

  // 全リセット
  const handleReset = useCallback(() => {
    setMatches(createInitialMatches());
    setKnockoutUserScores({});
  }, []);

  return (
    <div className="app">
      {/* ヘッダー */}
      <header className="header">
        <div className="header-container">
          <img src="/emblem.png" alt="FIFA World Cup 2026 Emblem" className="header__emblem" />
          <div>
            <span className="header__badge">FIFA World Cup 2026™ — USA / MEX / CAN</span>
            <h1 className="header__title">
              World Cup 2026 Simulator
            </h1>
            <p className="header__subtitle">
              グループステージから決勝トーナメントまで、全104試合の結果をリアルタイムに予測・シミュレート
            </p>
          </div>
        </div>
      </header>

      {/* ステータスバー */}
      <div className="status-bar">
        <div className="status-bar__item">
          <span
            className={`status-bar__dot ${
              stats.playedMatches > 0
                ? 'status-bar__dot--active'
                : 'status-bar__dot--inactive'
            }`}
          />
          <span>
            グループ戦: {stats.playedMatches} / {stats.totalMatches}
          </span>
        </div>
        <div className="status-bar__item">
          <span
            className={`status-bar__dot ${
              stats.totalGoals > 0
                ? 'status-bar__dot--active'
                : 'status-bar__dot--inactive'
            }`}
          />
          <span>グループ総ゴール: {stats.totalGoals}</span>
        </div>
        <div className="status-bar__item">
          <span
            className={`status-bar__dot ${
              stats.playedMatches === stats.totalMatches
                ? 'status-bar__dot--active'
                : 'status-bar__dot--pending'
            }`}
          />
          <span>
            {stats.playedMatches === stats.totalMatches
              ? 'グループステージ完了'
              : '進行中'}
          </span>
        </div>
      </div>

      {/* アクションバー */}
      <div className="action-bar">
        <button className="btn btn--gold" onClick={handleRandomFill}>
          ⚡ グループステージ予測シミュレート
        </button>
        <button className="btn btn--primary" onClick={handleKnockoutSimulate}>
          ⚡ 決勝トーナメント予測シミュレート
        </button>
        <button className="btn btn--danger" onClick={handleReset}>
          🔄 全てリセット
        </button>
      </div>

      {/* メインコンテンツ */}
      <div className="main-grid">
        {/* 左カラム: 試合入力フォーム */}
        <div className="card animate-fade-in">
          <div className="card__header">
            <div className="card__icon card__icon--blue">⚽</div>
            <h2 className="card__title">試合結果入力</h2>
          </div>
          <div className="card__body">
            {/* グループタブ */}
            <div className="group-tabs">
              {GROUPS.map((group) => (
                <button
                  key={group}
                  className={`group-tab ${
                    activeGroup === group ? 'group-tab--active' : ''
                  }`}
                  onClick={() => setActiveGroup(group)}
                >
                  {group}
                </button>
              ))}
            </div>

            {/* 試合フォーム */}
            <MatchForm
              matches={matches}
              activeGroup={activeGroup}
              onScoreChange={handleScoreChange}
            />
          </div>
        </div>

        {/* 右カラム: 順位表 */}
        <div className="card animate-fade-in stagger-2">
          <div className="card__header">
            <div className="card__icon card__icon--gold">🏆</div>
            <h2 className="card__title">グループ順位表（全12グループ）</h2>
          </div>
          <div className="card__body">
            <div className="standings-legend">
              <span className="standings-legend__item standings-legend__item--qualified">● 自動進出（1位・2位）</span>
              <span className="standings-legend__item standings-legend__item--third">● 3位（上位8チーム進出）</span>
              <span className="standings-legend__item standings-legend__item--eliminated">● 敗退</span>
            </div>
            <StandingsTable allStandings={allStandings} />
            
            {/* 各グループ3位チームの成績比較順位表 */}
            <ThirdPlaceStandings allStandings={allStandings} />
          </div>
        </div>
      </div>

      {/* ベスト32以上のトーナメントブラケット */}
      <BracketDisplay
        knockoutMatches={knockoutMatches}
        onScoreChange={handleKnockoutScoreChange}
      />

      {/* フッター */}
      <footer className="footer">
        <p>FIFA World Cup 2026™ Simulator — Built with React + TypeScript</p>
      </footer>
    </div>
  );
}

export default App;
