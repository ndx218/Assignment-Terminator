// /lib/ai.ts

// 訊息型別（OpenAI/OR 相容）
export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

// 可選：給外部用的步驟型別
export type StepName = 'outline' | 'draft' | 'review' | 'revise' | 'final';

// 呼叫選項
export type LlmOpts = {
  model: string;                // OpenRouter 的 model slug
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  referer?: string;             // 會塞進 HTTP-Referer（OpenRouter 建議）
  title?: string;               // 會塞進 X-Title（OpenRouter 建議）
};

/** 內部預設（可用環境變數覆蓋） */
const GEMINI_DEFAULT =
  process.env.OPENROUTER_GEMINI_MODEL ?? 'google/gemini-2.5-flash';
const GPT35_DEFAULT =
  process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo';
const FALLBACK_DEFAULT =
  process.env.OPENROUTER_FALLBACK_MODEL ?? GPT35_DEFAULT;

/**
 * 把 UI 的 mode 正規化並映射到 OpenRouter 模型。
 * - 'gemini' / 'gemini-flash' / 'flash' → google/gemini-2.5-flash
 * - 'gpt-3.5' / 'openai' → openai/gpt-3.5-turbo
 * - 'free' / 空字串 / 其他 → 預設走 3.5，保證可用
 */
export function mapMode(_step: string | StepName, mode: string): LlmOpts {
  const norm = normalizeMode(mode);
  const base = { temperature: 0.7, timeoutMs: 45_000 };

  if (norm.includes('gemini') || norm.includes('flash')) {
    return { ...base, model: GEMINI_DEFAULT };
  }

  if (
    norm.includes('gpt35') ||
    norm.includes('gpt3.5') ||
    norm.includes('gpt3') ||
    norm.includes('openai')
  ) {
    return { ...base, model: GPT35_DEFAULT };
  }

  // free / 預設：確保可用就走 3.5
  if (!norm || norm === 'free' || norm === 'default') {
    return { ...base, model: GPT35_DEFAULT };
  }

  // 其他未知字串 → fallback
  return { ...base, model: FALLBACK_DEFAULT };
}

/** 將 UI 傳入的 mode 正規化（去空白、去裝飾字、統一大小寫與符號） */
export function normalizeMode(mode?: string): string {
  return String(mode ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）【】\[\]＋+點]/g, '')
    .replace(/-/g, ''); // gpt-3.5 -> gpt35
}

/** 單一路徑呼叫 OpenRouter（OpenAI/Gemini 都走這裡） */
export async function callLLM(messages: Msg[], opts: LlmOpts): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('MISCONFIG_OPENROUTER: missing OPENROUTER_API_KEY');
  if (!opts?.model) throw new Error('MISCONFIG_OPENROUTER: missing model');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer':
          opts.referer ?? process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL ?? '',
        'X-Title': opts.title ?? process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        messages,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      let body = '';
      try { body = await resp.text(); } catch {}
      console.error('[openrouter error]', {
        status: resp.status,
        model: opts.model,
        body: body.slice(0, 800),
      });
      throw new Error(`OPENROUTER_HTTP_${resp.status}: ${body.slice(0, 500)}`);
    }

    const data: any = await resp.json();
    const out = data?.choices?.[0]?.message?.content ?? '';
    return String(out).trim();
  } finally {
    clearTimeout(timeout);
  }
}
