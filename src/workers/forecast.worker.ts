/// <reference lib="webworker" />
// 優勝確率モンテカルロをバックグラウンドで実行する Web Worker。
// UIスレッドを止めずに数千〜1万回のシミュレートを回す。
import { runForecast, type ForecastResult } from '../utils/forecast';
import { rngFromKey } from '../utils/rng';
import type { Match } from '../types';

export interface ForecastRequest {
  matches: Match[];
  iterations: number;
}

self.onmessage = (e: MessageEvent<ForecastRequest>) => {
  const { matches, iterations } = e.data;
  // 入力済みの結果から決定論的なシードを作る。
  // → 同じ盤面なら何度実行しても完全に同じ確率になる（再現可能）。
  const key =
    'wc2026-forecast|' +
    matches
      .filter((m) => m.homeScore !== null && m.awayScore !== null)
      .map((m) => `${m.id}:${m.homeScore}-${m.awayScore}`)
      .join('|');
  const result: ForecastResult = runForecast(matches, { iterations, rng: rngFromKey(key) });
  (self as unknown as Worker).postMessage(result);
};
