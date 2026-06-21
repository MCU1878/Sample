import React, { useMemo } from 'react';
import type { MatchAccuracy } from '../utils/accuracy';
import { skillSummary, reliabilityBins, cumulativeAccuracy } from '../utils/skillMetrics';

interface Props {
  details: MatchAccuracy[];
}

const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

// 信頼度較正プロット（reliability diagram）
const ReliabilityChart: React.FC<{ bins: ReturnType<typeof reliabilityBins> }> = ({ bins }) => {
  const S = 200; // plot size
  const PAD = 28;
  const x = (v: number) => PAD + v * (S - PAD * 1.5);
  const y = (v: number) => S - PAD - v * (S - PAD * 1.5);
  const used = bins.filter((b) => b.count > 0);
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="skill-svg" role="img" aria-label="信頼度較正">
      {/* グリッド */}
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={x(0)} y1={y(g)} x2={x(1)} y2={y(g)} stroke="rgba(148,163,184,0.12)" />
          <line x1={x(g)} y1={y(0)} x2={x(g)} y2={y(1)} stroke="rgba(148,163,184,0.12)" />
        </g>
      ))}
      {/* 完全較正の対角線 */}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#64748b" strokeDasharray="4 3" />
      {/* ビンを結ぶ線 */}
      {used.length > 1 && (
        <polyline
          points={used.map((b) => `${x(b.meanConfidence)},${y(b.hitRate)}`).join(' ')}
          fill="none"
          stroke="#f5a623"
          strokeWidth={2}
        />
      )}
      {/* ビン点（大きさ＝件数） */}
      {used.map((b, i) => (
        <circle key={i} cx={x(b.meanConfidence)} cy={y(b.hitRate)} r={3 + Math.min(8, b.count)} fill="#fad278" fillOpacity={0.85} stroke="#0f172a" />
      ))}
      {/* 軸ラベル */}
      <text x={x(0.5)} y={S - 4} textAnchor="middle" className="skill-axis">予測した確信度 →</text>
      <text x={6} y={y(0.5)} textAnchor="middle" transform={`rotate(-90 6 ${y(0.5)})`} className="skill-axis">実際の的中率 →</text>
    </svg>
  );
};

// 的中率の推移（累積）
const TrendChart: React.FC<{ series: { n: number; rate: number }[]; random: number }> = ({ series, random }) => {
  const W = 360;
  const H = 200;
  const PAD = 28;
  const n = Math.max(1, series.length);
  const x = (i: number) => PAD + (i / Math.max(1, n - 1)) * (W - PAD * 1.3);
  const y = (v: number) => H - PAD - v * (H - PAD * 1.5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="skill-svg" role="img" aria-label="的中率の推移">
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={x(0)} y1={y(g)} x2={W - 8} y2={y(g)} stroke="rgba(148,163,184,0.12)" />
          <text x={x(0) - 4} y={y(g) + 3} textAnchor="end" className="skill-axis-sm">{Math.round(g * 100)}</text>
        </g>
      ))}
      {/* ランダム基準 */}
      <line x1={x(0)} y1={y(random)} x2={W - 8} y2={y(random)} stroke="#64748b" strokeDasharray="4 3" />
      <text x={W - 8} y={y(random) - 4} textAnchor="end" className="skill-axis-sm">ランダム {Math.round(random * 100)}%</text>
      {/* モデルの累積的中率 */}
      {series.length > 1 && (
        <polyline points={series.map((s, i) => `${x(i)},${y(s.rate)}`).join(' ')} fill="none" stroke="#4ade80" strokeWidth={2.5} />
      )}
      {series.length > 0 && (
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1].rate)} r={4} fill="#4ade80" />
      )}
      <text x={x(0)} y={H - 4} textAnchor="start" className="skill-axis">試合数 →</text>
    </svg>
  );
};

export const SkillDashboard: React.FC<Props> = ({ details }) => {
  const summary = useMemo(() => skillSummary(details), [details]);
  const bins = useMemo(() => reliabilityBins(details), [details]);
  const trend = useMemo(() => cumulativeAccuracy(details), [details]);

  if (details.length === 0) return null;

  return (
    <div className="skill-dash">
      {/* Brier 指標カード */}
      <div className="skill-cards">
        <div className="skill-card skill-card--main">
          <div className="skill-card__value">{(summary.skillScore * 100).toFixed(0)}%</div>
          <div className="skill-card__label">予測力スコア（BSS）</div>
          <div className="skill-card__sub">ランダム基準をどれだけ上回るか（正なら予測力あり）</div>
        </div>
        <div className="skill-card">
          <div className="skill-card__value">{summary.brier.toFixed(3)}</div>
          <div className="skill-card__label">Brierスコア（低いほど良い）</div>
          <div className="skill-card__sub">ランダム基準 {summary.uniformBrier.toFixed(3)}</div>
        </div>
      </div>

      <div className="skill-charts">
        <div className="skill-chart-box">
          <div className="skill-chart-title">信頼度較正（対角線に近いほど確率が正確）</div>
          <ReliabilityChart bins={bins} />
          <div className="skill-chart-note">点が対角線より上＝控えめ／下＝自信過剰。大きい点＝該当試合が多い。</div>
        </div>
        <div className="skill-chart-box">
          <div className="skill-chart-title">的中率の推移（累積・walk-forward）</div>
          <TrendChart series={trend} random={1 / 3} />
          <div className="skill-chart-note">緑＝モデルの累積的中率。試合が増えるほど安定。最新 {pct(trend.length ? trend[trend.length - 1].rate : 0)}。</div>
        </div>
      </div>

      {details.length < 12 && (
        <p className="skill-smallnote">
          ※ 現在 {details.length} 試合。較正の点は試合が増えるほど安定します（目安20試合〜）。
        </p>
      )}
    </div>
  );
};

export default SkillDashboard;
