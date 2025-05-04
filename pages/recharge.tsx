// /pages/recharge.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const plans = [
  { name: '💡 everyday 套餐', price: 20, points: 28, limit: '每日限用 3 次' },
  { name: '首充套餐', price: 10, points: 25, bonus: '＋推薦獎勵' },
  { name: '小資套餐', price: 30, points: 35 },
  { name: '標準套餐', price: 50, points: 60 },
  { name: '高級套餐', price: 100, points: 125 },
  { name: '超值套餐', price: 200, points: 260 },
  { name: '進階套餐', price: 300, points: 400 },
  { name: '終極套餐', price: 500, points: 700 },
];

export default function RechargePage() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ name: string; price: number } | null>(null);

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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold">💳 點數充值</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="border p-4 rounded-lg cursor-pointer hover:bg-gray-50"
            onClick={() => setSelectedPlan({ name: plan.name, price: plan.price })}
          >
            <h3 className="font-bold">{plan.name}</h3>
            <p>${plan.price} → {plan.points} 點</p>
            {plan.limit && <p className="text-sm text-gray-500">{plan.limit}</p>}
            {plan.bonus && <p className="text-green-600 text-sm">{plan.bonus}</p>}
          </div>
        ))}
      </div>

      {selectedPlan && (
        <div className="border p-4 rounded-lg mt-6">
          <p className="font-semibold mb-2">📦 你選擇的套餐：{selectedPlan.name} (${selectedPlan.price})</p>
          <p>請完成付款並上傳截圖：</p>

          <div className="flex flex-col md:flex-row gap-4 mt-3 items-center">
            <Image src="/alipay-qr.png" alt="Alipay QR" width={160} height={160} />
            <div className="text-sm">
              <p>📱 <strong>Alipay（香港）</strong>：掃碼付款</p>
              <p className="mt-2">🌐 <strong>PayPal</strong>：<br />
                <a className="text-blue-600 underline" href="https://www.paypal.com/paypalme/TamChakFung" target="_blank" rel="noopener noreferrer">
                  https://www.paypal.com/paypalme/TamChakFung
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

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
