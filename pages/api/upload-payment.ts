// ✅ /pages/api/upload-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const form = new formidable.IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[Upload Error]', err);
      return res.status(500).json({ error: '表單解析失敗' });
    }

    const name = fields.name?.toString();
    const phone = fields.phone?.toString();
    const referralCode = fields.referralCode?.toString();
    const screenshot = files.screenshot as formidable.File;

    if (!name || !phone || !screenshot) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }

    try {
      const uploadDir = path.join(process.cwd(), '/public/uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

      const filename = `${Date.now()}_${screenshot.originalFilename}`;
      const filepath = path.join(uploadDir, filename);

      fs.copyFileSync(screenshot.filepath, filepath);

      // ✅ 模擬儲存記錄（實際應存入資料庫）
      console.log('[🔐 Payment Upload]', {
        name,
        phone,
        referralCode,
        file: `/uploads/${filename}`,
      });

      // 🚧 若有 referralCode，可加入邏輯：查找推薦人、記錄推薦事件、分發點數等等

      return res.status(200).json({ message: '上傳成功' });
    } catch (error: any) {
      console.error('[Upload Save Error]', error);
      return res.status(500).json({ error: '儲存失敗' });
    }
  });
}
