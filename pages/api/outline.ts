// pages/api/outline.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode, type StepName } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

type Ok   = { outline: string; outlineId: string };
type Err  = { error: string };
type ResBody = Ok | Err;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST' });
  }

  // 认证
  const session = await getAuthSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: '未登入' });
  }

  // 解构参数
  const {
    title,
    wordCount,
    language,
    tone,
    detail = '',
    reference = '',
    rubric = '',
    paragraph = '',
    mode = 'gemini-flash',
  } = req.body as Record<string, any>;

  const wc = Number(wordCount);
  if (
    typeof title !== 'string' ||
    typeof language !== 'string' ||
    typeof tone !== 'string' ||
    !Number.isFinite(wc)
  ) {
    return res.status(400).json({ error: '缺少或无效的必要字段' });
  }

  // 构造 Prompt：中英文指令 + 强制换行
  const prompt = `
請根據以下資料產生段落式大綱，並且**每段以換行分隔**（中文版請用「一、」「二、」標號，英文版請用 "1." "2."）：
題目：${title}
字數：約 ${wc}
語言：${language}（語氣：${tone}）
細節：${detail}
引用：${reference}
評分準則：${rubric}
段落要求：${paragraph || '依內容合理規劃'} 段

－－－

Please output each section on its own line, numbered in the appropriate style.
`;

  let outline = '';
  let modelUsed = '';

  // 先尝试用户选择的 model，失败再回退 GPT-3.5
  for (const m of [mode, 'gpt-3.5'] as const) {
    try {
      const opt = mapMode('outline' as StepName, m);
      modelUsed = opt.model;
      outline = await callLLM(
        [{ role: 'user', content: prompt }],
        {
          ...opt,
          title: 'Assignment Terminator',
          referer: process.env.NEXT_PUBLIC_APP_URL,
        }
      );
      break;
    } catch (e: any) {
      const msg = String(e);
      // 仅在 model-not-found / 4xx 错误时回退，否则直接报错
      if (!/not a valid model|model.*not.*found|OPENROUTER_HTTP_4\d\d/i.test(msg)) {
        console.error('[outline:error]', msg);
        return res.status(500).json({ error: 'AI 服務錯誤，請稍後再試' });
      }
    }
  }

  // 清洗、限制行数
  const finalOutline = outline
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)      // 最多 12 段
    .join('\n');

  // 写入数据库
  try {
    const rec = await prisma.outline.create({
      data: {
        userId: session.user.id,
        title: title.slice(0, 512),
        content: finalOutline,
      },
      select: { id: true },
    });

    return res.status(200).json({
      outline: finalOutline,
      outlineId: rec.id,
    });
  } catch (dbErr: any) {
    console.error('[outline:db]', dbErr);
    return res.status(500).json({ error: '資料庫錯誤，請稍後再試' });
  }
}
