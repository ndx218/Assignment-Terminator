import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable'; // ✅ 指定 File 型別
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
    const screenshot = files.screenshot as File;

    if (!name || !phone || !screenshot) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }

    try {
      const uploadDir = path.join(process.cwd(), 'public/uploads'); // ✅ 移除前導斜線更安全
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const filename = `${Date.now()}_${screenshot.originalFilename}`;
      const filepath = path.join(uploadDir, filename);

      fs.copyFileSync(screenshot.filepath, filepath);

      console.log('[🔐 Payment Upload]', {
        name,
        phone,
        referralCode,
        file: `/uploads/${filename}`,
      });

      return res.status(200).json({ message: '上傳成功' });
    } catch (error) {
      console.error('[Upload Save Error]', error);
      return res.status(500).json({ error: '儲存失敗' });
    }
  });
}
