// /lib/ai.ts
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export type LlmOpts = {
  model: string;                // OpenRouter 的 model slug
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  referer?: string;             // 可選：HTTP-Referer（OpenRouter 建議）
  title?: string;               // 可選：X-Title
};

/**
 * 把 UI 的 mode 字串正規化並映射到 OpenRouter 模型
 * 與你的 outline.ts 簽名相容：mapMode(step, mode)
 * - 'free' 先對應到 gpt-3.5（最穩、成本低）
 * - 'gemini-flash'/'gemini' 走 google/gemini-1.5-flash
 * - 'gpt-3.5'/'openai' 走 openai/gpt-3.5-turbo
 */
export function mapMode(_step: string, mode: string): LlmOpts {
  const raw = String(mode ?? '');
  const m = raw
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）【】\[\]＋+點]/g, '') // 移除 UI 裝飾字
    .replace(/-/g, '');                   // gpt-3.5 -> gpt35

  // Gemini（Flash）
  if (m.includes('gemini') || m.includes('flash')) {
    return { model: 'google/gemini-1.5-flash', temperature: 0.7, timeoutMs: 45000 };
  }

  // OpenAI GPT‑3.5
  if (m.includes('gpt35') || m.includes('gpt3.5') || m.includes('gpt3') || m.includes('openai')) {
    return { model: 'openai/gpt-3.5-turbo', temperature: 0.7, timeoutMs: 45000 };
  }

  // 預設：free → gpt‑3.5（保證可用）
  if (m === '' || m.includes('free') || m === 'default') {
    return { model: 'openai/gpt-3.5-turbo', temperature: 0.7, timeoutMs: 45000 };
  }

  // fallback 仍給 3.5
  return { model: 'openai/gpt-3.5-turbo', temperature: 0.7, timeoutMs: 45000 };
}

/** 以 OpenRouter 單一路徑呼叫（OpenAI & Gemini 都走這裡） */
export async function callLLM(messages: Msg[], opts: LlmOpts): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('MISCONFIG_OPENROUTER: missing OPENROUTER_API_KEY');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45000);

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': opts.referer ?? process.env.NEXT_PUBLIC_APP_URL ?? '',
        'X-Title': opts.title ?? 'Assignment Terminator',
      },
      body: JSON.stringify({
        model: opts.model,                    // ⚠️ 確認你的帳號能用的實際 slug
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        messages,                             // OpenAI 相容格式
      }),
      signal: controller.signal,
    });

    if (!r.ok) {
      const body = await r.text().catch(() => '');
      // 把可診斷訊息寫 server log（/api/outline 會 catch 成 500）
      console.error('[openrouter error]', r.status, body.slice(0, 800));
      throw new Error(`OPENROUTER_HTTP_${r.status}`);
    }

    const data: any = await r.json();
    const out = data?.choices?.[0]?.message?.content ?? '';
    return String(out).trim();
  } finally {
    clearTimeout(timeout);
  }
}
