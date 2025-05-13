'use client';

import { useState } from 'react';

export type Lang = 'zh-TW' | 'zh-CN' | 'en';

/** 暫時停用繁簡轉換，原樣返回 */
export function toSimplified(text: string): string {
  return text;
}

export function toTraditional(text: string): string {
  return text;
}

/** 中文翻譯英文 */
export async function toEnglish(text: string): Promise<string> {
  try {
    const res = await fetch(
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' +
        encodeURIComponent(text)
    );
    const data = await res.json();
    return data[0]?.map((t: any) => t[0]).join('') ?? text;
  } catch (e) {
    console.error('[翻譯英文失敗]', e);
    return text;
  }
}

/** 語言切換 Hook */
export function useLang() {
  const [lang, setLang] = useState<Lang>('zh-TW');
  const toggleLang = () => {
    if (lang === 'zh-TW') return setLang('zh-CN');
    if (lang === 'zh-CN') return setLang('en');
    return setLang('zh-TW');
  };
  return { lang, toggleLang };
}
