/// <reference lib="webworker" />
// 優勝確率モンテカルロをバックグラウンドで実行する Web Worker。
// UIスレッドを止めずに数千〜1万回のシミュレートを回す。
import { runForecast, type ForecastResult } from '../utils/forecast';
import type { Match } from '../types';

export interface ForecastRequest {
  matches: Match[];
  iterations: number;
}

self.onmessage = (e: MessageEvent<ForecastRequest>) => {
  const { matches, iterations } = e.data;
  const result: ForecastResult = runForecast(matches, { iterations });
  (self as unknown as Worker).postMessage(result);
};
