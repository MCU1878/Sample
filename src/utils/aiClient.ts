// =============================================================================
// Claude (Anthropic) クライアント — ブラウザ直叩き
// -----------------------------------------------------------------------------
// APIキーはユーザーが画面で入力し localStorage に保存。クライアントから直接
// Messages API を呼ぶ（anthropic-dangerous-direct-browser-access: true）。
// ※キーは手元のブラウザにのみ保存され、外部に送られるのは Anthropic API だけ。
// =============================================================================

const KEY_LS = 'wc2026-anthropic-key';
const MODEL_LS = 'wc2026-anthropic-model';

export const AI_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5（高速・低コスト）' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6（バランス・推奨）' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8（最高品質）' },
];

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_LS) || '';
  } catch {
    return '';
  }
}
export function setApiKey(k: string): void {
  try {
    if (k) localStorage.setItem(KEY_LS, k);
    else localStorage.removeItem(KEY_LS);
  } catch {
    /* ignore */
  }
}
export function getModel(): string {
  try {
    return localStorage.getItem(MODEL_LS) || 'claude-sonnet-4-6';
  } catch {
    return 'claude-sonnet-4-6';
  }
}
export function setModel(m: string): void {
  try {
    localStorage.setItem(MODEL_LS, m);
  } catch {
    /* ignore */
  }
}

export interface GenerateOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
}

/** Claude Messages API を呼んでテキストを生成する */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('APIキーが設定されていません。設定欄に入力してください。');

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content: opts.prompt }],
      }),
    });
  } catch (e) {
    throw new Error(`ネットワークエラー: ${(e as Error).message}`);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j).slice(0, 200);
    } catch {
      detail = await res.text().catch(() => '');
    }
    if (res.status === 401) throw new Error('APIキーが無効です（401）。キーを確認してください。');
    throw new Error(`APIエラー (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n')
    : '';
  if (!text) throw new Error('生成結果が空でした。');
  return text;
}
