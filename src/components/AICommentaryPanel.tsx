import React, { useMemo, useState } from 'react';
import type { Match, TeamStanding } from '../types';
import { evaluateAccuracy, evaluateAdvancement } from '../utils/accuracy';
import { skillSummary } from '../utils/skillMetrics';
import { powerQuality } from '../utils/powerRankings';
import { teams, groupTeams } from '../data';
import { generateText, getApiKey, setApiKey, getModel, setModel, AI_MODELS } from '../utils/aiClient';

interface Props {
  matches: Match[];
  standings: Record<string, TeamStanding[]>;
}

const outcomeJa = (predicted: 'HOME' | 'DRAW' | 'AWAY', home: string, away: string) => {
  if (predicted === 'DRAW') return '引き分け';
  const c = predicted === 'HOME' ? home : away;
  return `${teams[c]?.name ?? c}勝利`;
};

// Claude に渡す「事実」ダイジェストを組み立てる（結果・順位・数値のみ）
function buildDigest(matches: Match[], standings: Record<string, TeamStanding[]>): string {
  const finished = matches.filter((m) => m.syncStatus === 'finished');
  const report = evaluateAccuracy(finished);
  evaluateAdvancement(standings); // （将来用・現状は順位から直接生成）
  const totalGoals = finished.reduce((s, m) => s + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0);

  const leaders = Object.keys(standings)
    .sort()
    .map((g) => {
      const t = [...(standings[g] ?? [])].sort((a, b) => a.rank - b.rank);
      if (!t[0]) return null;
      const p2 = t[1];
      return `${g}組: 首位 ${teams[t[0].teamCode]?.name}(${t[0].points}pt) / 2位 ${p2 ? teams[p2.teamCode]?.name + '(' + p2.points + 'pt)' : '-'}`;
    })
    .filter(Boolean);

  const upsets = report.details
    .filter((d) => !d.hit && d.confidence >= 0.5)
    .slice(0, 6)
    .map(
      (d) =>
        `${teams[d.homeTeam]?.name} ${d.homeScore}-${d.awayScore} ${teams[d.awayTeam]?.name}（モデルは${outcomeJa(d.predicted, d.homeTeam, d.awayTeam)}を${Math.round(d.confidence * 100)}%で予想していた）`
    );

  const allCodes = Object.values(groupTeams).flat();
  const favs = [...allCodes].sort((a, b) => powerQuality(b) - powerQuality(a)).slice(0, 5).map((c) => teams[c]?.name);
  const skill = skillSummary(report.details);

  return [
    `【消化状況】${finished.length} 試合終了 / 総ゴール ${totalGoals}`,
    `【グループ順位（現時点の上位2）】\n${leaders.join('\n')}`,
    upsets.length ? `【番狂わせ（モデル予想が外れた試合）】\n${upsets.join('\n')}` : '【番狂わせ】目立った波乱はまだない',
    `【モデルの優勝候補（6指標ランキング上位5）】${favs.join('、')}`,
    `【予測精度】試合的中率 ${(report.rate * 100).toFixed(0)}%、予測力スコア(BSS) ${(skill.skillScore * 100).toFixed(0)}%`,
  ].join('\n\n');
}

const SYSTEM_PROMPT =
  'あなたはFIFAワールドカップを専門とする日本語のスポーツ解説者です。' +
  '以下の【事実】だけを根拠に、2026年W杯の現状を視聴者向けに魅力的かつ簡潔に解説してください。' +
  '事実に書かれていない試合結果・順位・数字を創作してはいけません。' +
  '約300〜400字、自然な解説文で（見出しや箇条書きは不要）。';

export const AICommentaryPanel: React.FC<Props> = ({ matches, standings }) => {
  const [keyInput, setKeyInput] = useState('');
  const [keySet, setKeySet] = useState(() => !!getApiKey());
  const [model, setModelState] = useState(getModel());
  const [showKey, setShowKey] = useState(false);
  const [showFacts, setShowFacts] = useState(false);

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const digest = useMemo(() => buildDigest(matches, standings), [matches, standings]);
  const hasData = matches.some((m) => m.syncStatus === 'finished');

  const saveKey = () => {
    setApiKey(keyInput.trim());
    setKeySet(!!keyInput.trim());
    setKeyInput('');
  };
  const clearKey = () => {
    setApiKey('');
    setKeySet(false);
  };
  const changeModel = (m: string) => {
    setModel(m);
    setModelState(m);
  };

  const generate = async () => {
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const text = await generateText({
        system: SYSTEM_PROMPT,
        prompt: `以下が現在の大会の事実です。これだけを根拠に解説してください。\n\n${digest}`,
        maxTokens: 800,
      });
      setOutput(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card animate-fade-in challenge-view">
      <div className="card__header">
        <div className="card__icon card__icon--gold">🤖</div>
        <h2 className="card__title">AI解説（Claude）— 大会ダイジェスト</h2>
      </div>
      <div className="card__body">
        {/* APIキー設定 */}
        <div className="ai-settings">
          <div className="ai-settings__row">
            <span className={`ai-key-status ${keySet ? 'ai-key-status--ok' : ''}`}>
              {keySet ? '🔑 APIキー設定済み' : '🔒 APIキー未設定'}
            </span>
            <select className="ai-model-select" value={model} onChange={(e) => changeModel(e.target.value)}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="ai-settings__row">
            <input
              className="ai-key-input"
              type={showKey ? 'text' : 'password'}
              placeholder="Anthropic APIキー（sk-ant-...）"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <button className="btn btn--cyan btn--glass btn--sm" onClick={() => setShowKey((v) => !v)}>{showKey ? '隠す' : '表示'}</button>
            <button className="btn btn--primary btn--glass btn--sm" onClick={saveKey} disabled={!keyInput.trim()}>保存</button>
            {keySet && <button className="btn btn--danger btn--glass btn--sm" onClick={clearKey}>削除</button>}
          </div>
          <p className="ai-settings__note">
            キーは<strong>このブラウザ（localStorage）にのみ保存</strong>され、送信先は Anthropic API のみです。
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"> キーの取得はこちら</a>
          </p>
        </div>

        {/* 生成 */}
        <div className="ai-generate">
          <button className="btn btn--gold" onClick={generate} disabled={!keySet || loading || !hasData}>
            {loading ? '⏳ 生成中…' : '✨ 大会ダイジェストを生成'}
          </button>
          <button className="btn-link" onClick={() => setShowFacts((v) => !v)}>
            {showFacts ? '送信内容を隠す' : '🤖に送る事実を見る'}
          </button>
        </div>
        {!hasData && <p className="ai-hint">※ 確定した試合がまだありません。試合が終了するとダイジェストを生成できます。</p>}

        {showFacts && <pre className="ai-facts">{digest}</pre>}

        {error && <div className="ai-error">⚠️ {error}</div>}

        {output && (
          <div className="ai-output">
            <div className="ai-output__head">📝 Claude による解説</div>
            <div className="ai-output__body">{output}</div>
            <div className="ai-output__foot">※ 上記の事実のみを根拠に生成。創作した結果は含みません。</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AICommentaryPanel;
