// /pages/recharge.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RechargePage() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpload = async () => {
    if (!name || !contact || !file) return alert('請填寫所有欄位並選擇截圖');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', contact);
    formData.append('screenshot', file);

    setIsSubmitting(true);
    const res = await fetch('/api/upload-payment', {
      method: 'POST',
      body: formData,
    });
    setIsSubmitting(false);
    setSuccess(res.ok);
    if (!res.ok) alert('上傳失敗，請稍後重試');
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold">💳 點數充值</h2>
      <p>
        💡 請選擇其中一種付款方式：<br />
        📱 <strong>Alipay（香港）</strong>：請使用 Alipay 掃描下方 QR Code 完成付款。
      </p>
      <Image src="/alipay-qr.png" alt="Alipay QR Code" width={240} height={240} className="mx-auto" />
      <p>
        🌐 <strong>PayPal</strong>：請使用 PayPal 付款連結（支援信用卡）：<br />
        👉 <a className="text-blue-600 underline" href="https://www.paypal.com/paypalme/TamChakFung" target="_blank" rel="noopener noreferrer">
          https://www.paypal.com/paypalme/TamChakFung
        </a>
      </p>
      <p className="text-sm text-muted-foreground">
        📤 付款後請上傳付款截圖與你的姓名，本人會於 24 小時內人工審核並開通點數。如遇週末或深夜可能略有延遲，敬請見諒 🙏。
      </p>

      <Input placeholder="你的姓名" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="聯絡方式（微信 / WhatsApp）" value={contact} onChange={(e) => setContact(e.target.value)} />
      <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />

      <Button onClick={handleUpload} isLoading={isSubmitting} className="w-full">
        📤 提交付款資料
      </Button>
      {success && <p className="text-green-600 mt-4">✅ 上傳成功！請等待人工開通</p>}
    </div>
  );
}
