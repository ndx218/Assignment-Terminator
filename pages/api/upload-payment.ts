// ✅ /pages/api/upload-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false, // 禁用 Next.js 自帶 body parser，因為要用 formidable
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  const form = new formidable.IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[❌ 表單解析錯誤]', err);
      return res.status(500).json({ error: '表單解析失敗' });
    }

    const name = fields.name?.toString() || '';
    const phone = fields.phone?.toString() || '';
    const referralCode = fields.referralCode?.toString() || '';
    const screenshot = files.screenshot as File;

    if (!name || !phone || !screenshot) {
      return res.status(400).json({ error: '請填寫所有必填欄位' });
    }

    try {
      const uploadDir = path.join(process.cwd(), 'public/uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const timestamp = Date.now();
      const original = screenshot.originalFilename || 'screenshot.png';
      const filename = `${timestamp}_${original}`;
      const filepath = path.join(uploadDir, filename);

      // ✅ 儲存截圖
      fs.copyFileSync(screenshot.filepath, filepath);

      console.log('[📤 新付款上傳]', {
        name,
        phone,
        referralCode,
        filePath: `/uploads/${filename}`,
      });

      return res.status(200).json({ message: '上傳成功' });
    } catch (error) {
      console.error('[❌ 儲存錯誤]', error);
      return res.status(500).json({ error: '儲存失敗，請稍後再試' });
    }
  });
}
