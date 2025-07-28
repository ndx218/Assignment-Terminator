
import { ChatCompletionMessageParam } from 'openai/resources/chat';

type Provider = 'openai' | 'google' | 'undetectable';
interface LLMOptions {
  provider: Provider;
  model: string;
  maxTokens?: number;
}

export async function callLLM(
  messages: ChatCompletionMessageParam[],
  { provider, model, maxTokens = 1000 }: LLMOptions,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const body: any = { model, messages, max_tokens: maxTokens };

  let url = '';
  switch (provider) {
    case 'openai':
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY!}`;
      break;

    case 'google':
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:chat?key=${process.env.GEMINI_API_KEY!}`;
      // Gemini Chat API 格式稍不同
      body.contents = messages.map(({ role, content }) => ({
        role,
        parts: [{ text: content }],
      }));
      delete body.messages;
      delete body.max_tokens; // Gemini 用 temperature / topP…
      break;

    case 'undetectable':
      url = process.env.UNDETECTABLE_API_URL!;
      headers['x-api-key'] = process.env.UNDETECTABLE_API_KEY!;
      break;
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`[LLM] ${res.status} ${await res.text()}`);

  const json = await res.json();

  // 把三種 provider 統一抽出 text
  if (provider === 'google') {
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  }
  return json.choices?.[0]?.message?.content?.trim() ?? '';
}

/** 把前端傳來的 mode 轉成 provider / model */
export function mapMode(step: string, mode: string): LLMOptions {
  switch (mode) {
    case 'free':
      return { provider: 'openai', model: 'openai/gpt-3.5-turbo' };

    case 'flash':
      return { provider: 'google', model: 'gemini-1.5-flash-latest' };

    case 'pro':
      return { provider: 'google', model: 'gemini-1.5-pro-latest' };

    case 'undetectable':
      return { provider: 'undetectable', model: step /* or any field you need */ };

    default:
      throw new Error('unsupported mode');
  }
}
