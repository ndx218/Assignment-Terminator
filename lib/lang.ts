'use client';

// ✅ 改用 CommonJS 方式匯入
import zhConvert from 'zh-convert';
import { useState } from 'react';

export type Lang = 'zh-TW' | 'zh-CN' | 'en';


/** 繁體 → 簡體 */
export function toSimplified(text: string): string {
  try {
    return zhConvert.t2s(text);
  } catch (e) {
    console.error('[繁轉簡錯誤]', e);
    return text;
  }
}

/** 簡體 → 繁體 */
export function toTraditional(text: string): string {
  try {
    return zhConvert.s2t(text);
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
