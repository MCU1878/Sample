import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Match, KnockoutMatch } from './types';
import { createInitialMatches, groupTeams } from './data';
import { getAllGroupStandings } from './utils/calculateStandings';
import { initializeKnockoutMatches, updateKnockoutProgression, simulateKnockoutMatches } from './utils/knockoutLogic';
import { simulateMatchFromCodes } from './utils/matchEngine';
import { fetchLiveMatches } from './utils/apiSync';
import type { ForecastResult } from './utils/forecast';
import { MatchForm } from './components/MatchForm';
import StandingsTable from './components/StandingsTable';
import BracketDisplay from './components/BracketDisplay';
import ThirdPlaceStandings from './components/ThirdPlaceStandings';
import ForecastPanel from './components/ForecastPanel';

const FORECAST_ITERATIONS = 10000;

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

function App() {
  const [matches, setMatches] = useState<Match[]>(createInitialMatches);
  const [activeGroup, setActiveGroup] = useState<string>('A');
  const [activePhase, setActivePhase] = useState<'groups' | 'third' | 'knockout'>('groups');
  
  // ノックアウト用のユーザー入力スコア
  const [knockoutUserScores, setKnockoutUserScores] = useState<
    Record<string, { score1: number | null; score2: number | null; pen1: number | null; pen2: number | null }>
  >({});

  // 優勝確率シミュレーション（Web Worker でバックグラウンド実行）
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [forecasting, setForecasting] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('./workers/forecast.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ForecastResult>) => {
      setForecast(e.data);
      setForecasting(false);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const handleForecast = useCallback(() => {
    if (!workerRef.current) return;
    setForecasting(true);
    workerRef.current.postMessage({ matches, iterations: FORECAST_ITERATIONS });
  }, [matches]);

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
        if (match.syncStatus) return match; // 実際の試合結果は上書きしない
        const log = simulateMatchFromCodes(match.homeTeam, match.awayTeam, undefined, { climate: match.climate });
        return {
          ...match,
          homeScore: log.homeScore,
          awayScore: log.awayScore,
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
        if (match.syncStatus) return match; // 実際の試合結果は上書きしない
        const log = simulateMatchFromCodes(match.homeTeam, match.awayTeam, undefined, { climate: match.climate });
        return {
          ...match,
          homeScore: log.homeScore,
          awayScore: log.awayScore,
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

  // リアルタイムAPI同期
  const [syncing, setSyncing] = useState(true); // 初回ロード中はtrue
  const handleApiSync = useCallback(async (isBackground = false) => {
    if (!isBackground) setSyncing(true);
    try {
      const updater = await fetchLiveMatches();
      setMatches(updater);
    } catch (e) {
      console.error('API sync failed:', e);
    } finally {
      if (!isBackground) setSyncing(false);
    }
  }, []);

  // 初回＆定期同期 (60秒ごと)
  useEffect(() => {
    handleApiSync(); // 初回同期 (UIブロックあり)
    const interval = setInterval(() => {
      handleApiSync(true); // バックグラウンド同期
    }, 60000);
    return () => clearInterval(interval);
  }, [handleApiSync]);

  // 全リセット
  const handleReset = useCallback(async () => {
    setKnockoutUserScores({});
    setForecast(null);
    setSyncing(true);
    try {
      const initialMatches = createInitialMatches();
      const updater = await fetchLiveMatches();
      setMatches(updater(initialMatches));
    } catch (e) {
      console.error('API sync failed during reset:', e);
      setMatches(createInitialMatches());
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <div className="app">
      {/* フルスクリーンローディング */}
      {syncing && (
        <div className="sync-overlay">
          <div className="sync-overlay__content">
            <div className="css-spinner"></div>
            <p>Syncing Live Match Data...</p>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="header">
        <div className="header-container">
          <img src="/emblem.png" alt="FIFA World Cup 2026 Emblem" className="header__emblem" />
          <div>
            <span className="header__badge">FIFA World Cup 2026™ — USA / MEX / CAN</span>
            <h1 className="header__title">World Cup 2026 Simulator</h1>
            <p className="header__subtitle">Tournament Control Center</p>
          </div>
        </div>
      </header>

      {/* ステータスバー */}
      <div className="status-bar">
        <div className="status-bar__item">
          <span className={`status-bar__dot ${stats.playedMatches > 0 ? 'status-bar__dot--active' : 'status-bar__dot--inactive'}`} />
          <span>グループ戦: {stats.playedMatches} / {stats.totalMatches}</span>
        </div>
        <div className="status-bar__item">
          <span className={`status-bar__dot ${stats.totalGoals > 0 ? 'status-bar__dot--active' : 'status-bar__dot--inactive'}`} />
          <span>総ゴール: {stats.totalGoals}</span>
        </div>
        <div className="status-bar__item">
          <span className={`status-bar__dot ${stats.playedMatches === stats.totalMatches ? 'status-bar__dot--active' : 'status-bar__dot--pending'}`} />
          <span>{stats.playedMatches === stats.totalMatches ? 'グループ完了' : '進行中'}</span>
        </div>
      </div>

      {/* グローバル フェーズナビゲーション */}
      <div className="phase-nav">
        <button 
          className={`phase-tab ${activePhase === 'groups' ? 'phase-tab--active' : ''}`}
          onClick={() => setActivePhase('groups')}
        >
          <span className="phase-tab__icon">⚽</span> グループステージ
        </button>
        <button 
          className={`phase-tab ${activePhase === 'third' ? 'phase-tab--active' : ''}`}
          onClick={() => setActivePhase('third')}
        >
          <span className="phase-tab__icon">🏅</span> 3位サバイバル
        </button>
        <button 
          className={`phase-tab ${activePhase === 'knockout' ? 'phase-tab--active' : ''}`}
          onClick={() => setActivePhase('knockout')}
        >
          <span className="phase-tab__icon">🏆</span> 決勝トーナメント
        </button>
      </div>

      {/* メインフェーズ コンテンツ */}
      <div className="phase-content">
        {activePhase === 'groups' && (
          <div className="cockpit-grid animate-fade-in">
            {/* 左カラム: サイドバーナビゲーション */}
            <div className="cockpit-sidebar">
              <h3 className="cockpit-sidebar__title">SELECT GROUP</h3>
              <div className="cockpit-sidebar__list">
                {GROUPS.map((group) => (
                  <button
                    key={group}
                    className={`cockpit-group-btn ${activeGroup === group ? 'cockpit-group-btn--active' : ''}`}
                    onClick={() => setActiveGroup(group)}
                  >
                    Group {group}
                  </button>
                ))}
              </div>
            </div>

            {/* メインカラム: 順位表と試合入力の統合ビュー */}
            <div className="cockpit-main">
              <div className="card mb-xl">
                <div className="card__header">
                  <div className="card__icon card__icon--gold">🏆</div>
                  <h2 className="card__title">Group {activeGroup} Live Standings</h2>
                </div>
                <div className="card__body" style={{ padding: 0 }}>
                  <StandingsTable allStandings={allStandings} activeGroup={activeGroup} />
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <div className="card__icon card__icon--blue">⚽</div>
                  <h2 className="card__title">Match Results Input</h2>
                </div>
                <div className="card__body">
                  <MatchForm
                    matches={matches}
                    activeGroup={activeGroup}
                    onScoreChange={handleScoreChange}
                    isSyncing={syncing}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activePhase === 'third' && (
          <div className="card animate-fade-in third-place-view">
            <div className="card__header">
              <div className="card__icon card__icon--gold">🏅</div>
              <h2 className="card__title">3位チーム サバイバル（上位8チームが進出）</h2>
            </div>
            <div className="card__body">
              <div className="standings-legend mb-md">
                <span className="standings-legend__item standings-legend__item--qualified">● 決勝T進出ボーダーライン上</span>
                <span className="standings-legend__item standings-legend__item--eliminated">● 敗退圏内</span>
              </div>
              <ThirdPlaceStandings allStandings={allStandings} />
            </div>
          </div>
        )}

        {activePhase === 'knockout' && (
          <div className="knockout-view animate-fade-in">
            <ForecastPanel result={forecast} loading={forecasting} />
            <div className="card mt-xl full-width-card">
              <BracketDisplay
                knockoutMatches={knockoutMatches}
                onScoreChange={handleKnockoutScoreChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* フローティング アクションドック */}
      <div className="floating-dock">
        <div className="floating-dock__inner">
          <button className="btn btn--gold btn--glass" onClick={handleRandomFill}>
            ⚡ グループ予測
          </button>
          <button className="btn btn--primary btn--glass" onClick={handleKnockoutSimulate}>
            🏆 トーナメント予測
          </button>
          <button className="btn btn--cyan btn--glass" onClick={handleForecast} disabled={forecasting}>
            {forecasting ? '⏳ 計算中…' : '📊 確率予測'}
          </button>
          <button className="btn btn--danger btn--glass" onClick={handleReset}>
            🗑 リセット
          </button>
        </div>
      </div>

      <footer className="footer">
        <p>FIFA World Cup 2026™ Simulator — Tournament Control Center</p>
      </footer>
    </div>
  );
}

export default App;
