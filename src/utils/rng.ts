// =============================================================================
// 決定論的乱数（再現可能シミュレーションの基盤）
// -----------------------------------------------------------------------------
// シード固定の擬似乱数 mulberry32 と、文字列からシードを作る seedFromString。
// これらを使うと「同じ入力 → 同じシード → 同じ結果」になり、
// ボタンを押すたびに結果が変わることがなくなる（＝再現可能）。
// =============================================================================

export type Rng = () => number;

/** seed 固定の擬似乱数生成器（mulberry32） */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 文字列を 32bit シードへ変換（FNV-1a）。同じ文字列 → 必ず同じシード。 */
export function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 文字列キーから直接 seed 済み Rng を作る便利関数 */
export function rngFromKey(key: string): Rng {
  return mulberry32(seedFromString(key));
}
