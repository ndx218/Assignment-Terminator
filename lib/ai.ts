/* lib/ai.ts --------------------------------------------------------- */
/** Minimal chat message type so we don't depend on the OpenAI SDK */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type Provider = 'openai' | 'google' | 'undetectable';

interface LLMOptions {
  provider: Provider;
  model: string;
  maxTokens?: number;
}

/** Call LLM via OpenRouter (OpenAI-compatible), Gemini, or your Undetectable service */
export async function callLLM(
  messages: ChatMessage[],
  { provider, model, maxTokens = 1000 }: LLMOptions
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url = '';
  let body: any = {};

  switch (provider) {
    case 'openai': {
      // OpenRouter (OpenAI-compatible)
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY!}`;
      body = { model, messages, max_tokens: maxTokens };
      break;
    }

    case 'google': {
      // Gemini (generateContent)
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY!}`;
      body = {
        contents: messages.map(({ role, content }) => ({
          role,
          parts: [{ text: content }],
        })),
      };
      break;
    }

    case 'undetectable': {
      // Your own service – adapt payload as your API expects
      url = process.env.UNDETECTABLE_API_URL!;
      headers['x-api-key'] = process.env.UNDETECTABLE_API_KEY!;
      body = { text: messages.map((m) => `${m.role}: ${m.content}`).join('\n') };
      break;
    }
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`[LLM] ${res.status} ${await res.text()}`);
  const json = await res.json();

  // Normalize the text output
  if (provider === 'google') {
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: any) => p?.text ?? '').join('');
    return (text || '').trim();
  }
  // OpenRouter / Undetectable (if OpenAI-compatible)
  return (json?.choices?.[0]?.message?.content ?? '').trim();
}

/** Map UI mode -> provider & model */
export function mapMode(step: string, mode: string): LLMOptions {
  switch (mode) {
    case 'free':
      return { provider: 'openai',  model: 'openai/gpt-3.5-turbo' };
    case 'flash':
      return { provider: 'google',  model: 'gemini-1.5-flash-latest' };
    case 'pro':
      return { provider: 'google',  model: 'gemini-1.5-pro-latest' };
    case 'undetectable':
      return { provider: 'undetectable', model: step }; // adjust to your API if needed
    default:
      throw new Error('unsupported mode');
  }
}
