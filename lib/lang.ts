'use client';

// @ts-ignore 忽略沒有型別定義的套件
import { t2s, s2t } from 'zh-convert';
import { useState } from 'react';

export type Lang = 'zh-TW' | 'zh-CN';

/** 繁體 → 簡體 */
export function toSimplified(text: string): string {
  try {
    return t2s(text); // zh-convert 無型別但功能正常
  } catch (e) {
    console.error('[繁轉簡錯誤]', e);
    return text;
  }
}

/** 簡體 → 繁體 */
export function toTraditional(text: string): string {
  try {
    return s2t(text);
  } catch (e) {
    console.error('[簡轉繁錯誤]', e);
    return text;
  }
}

/** 語言切換 Hook */
export function useLang() {
  const [lang, setLang] = useState<Lang>('zh-TW');
  const toggleLang = () =>
    setLang((prev) => (prev === 'zh-TW' ? 'zh-CN' : 'zh-TW'));
  return { lang, toggleLang };
}
