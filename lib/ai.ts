// /lib/ai.ts
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export type StepName = 'outline' | 'draft' | 'review' | 'revise' | 'final';

export type LlmOpts = {
  model: string;                // OpenRouter model slug
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  referer?: string;             // optional: HTTP-Referer for OpenRouter
  title?: string;               // optional: X-Title for OpenRouter
};

export function mapMode(step: StepName, mode: string): LlmOpts {
  switch (mode) {
    // Gemini
    case 'gemini':
    case 'gemini-flash':
    case 'flash':
      return { model: 'google/gemini-1.5-flash', temperature: 0.7, timeoutMs: 45000 };

    // OpenAI
    case 'gpt-3.5':
    case 'openai':
      return { model: 'openai/gpt-3.5-turbo', temperature: 0.7, timeoutMs: 45000 };

    // You can add more here when you need (e.g., openai/gpt-4o-mini, google/gemini-1.5-pro)
    default:
      return { model: 'google/gemini-1.5-flash', temperature: 0.7, timeoutMs: 45000 };
  }
}

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
        model: opts.model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        messages,
      }),
      signal: controller.signal,
    });

    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`OPENROUTER_HTTP_${r.status}: ${body.slice(0, 500)}`);
    }

    const data: any = await r.json();
    const out = data?.choices?.[0]?.message?.content ?? '';
    return String(out).trim();
  } finally {
    clearTimeout(timeout);
  }
}
