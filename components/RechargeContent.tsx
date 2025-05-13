'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RechargeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [skipLogin, setSkipLogin] = useState<boolean | null>(null);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const skip = localStorage.getItem('skipLogin') === 'true';
      setSkipLogin(skip);
    }
  }, []);

  useEffect(() => {
    if (skipLogin === false && status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router, skipLogin]);

  if (skipLogin === null || (!skipLogin && status === 'loading')) {
    return <div className="h-screen flex items-center justify-center text-gray-500">⏳ 載入中...</div>;
  }

  const handleUpload = async () => {
    if (!name || !contact || !file) {
      alert('請填寫所有欄位並選擇截圖');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', contact);
    formData.append('screenshot', file);
    formData.append('referralCode', referralCode);

    setIsSubmitting(true);
    const res = await fetch('/api/upload-payment', {
      method: 'POST',
      body: formData,
    });
    setIsSubmitting(false);
    setSuccess(res.ok);

    if (res.ok) {
      setName('');
      setContact('');
      setReferralCode('');
      setFile(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert('上傳失敗，請稍後重試');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold">💳 點數充值</h2>

      {/* 📦 套餐方案表格 */}
      <div className="overflow-x-auto text-sm border border-gray-200 rounded-md">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">套餐名稱</th>
              <th className="border px-3 py-2 text-center">金額</th>
              <th className="border px-3 py-2 text-center">點數</th>
              <th className="border px-3 py-2 text-center">每點成本</th>
              <th className="border px-3 py-2">備註</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-3 py-2">🎁 首充套餐</td>
              <td className="border px-3 py-2 text-center">$10</td>
              <td className="border px-3 py-2 text-center">25 + 推薦點</td>
              <td className="border px-3 py-2 text-center">$0.40</td>
              <td className="border px-3 py-2">推薦有獎</td>
            </tr>
            <tr>
              <td className="border px-3 py-2">💡 入門套餐</td>
              <td className="border px-3 py-2 text-center">$20</td>
              <td className="border px-3 py-2 text-center">20</td>
              <td className="border px-3 py-2 text-center">$1</td>
              <td className="border px-3 py-2">一般小額使用者</td>
            </tr>
            <tr>
              <td className="border px-3 py-2">💼 小資套餐</td>
              <td className="border px-3 py-2 text-center">$30</td>
              <td className="border px-3 py-2 text-center">35</td>
              <td className="border px-3 py-2 text-center">$0.86</td>
              <td className="border px-3 py-2">穩定銷售款</td>
            </tr>
            <tr>
              <td className="border px-3 py-2">📘 標準套餐</td>
              <td className="border px-3 py-2 text-center">$50</td>
              <td className="border px-3 py-2 text-center">60</td>
              <td className="border px-3 py-2 text-center">$0.83</td>
              <td className="border px-3 py-2">高頻使用者</td>
            </tr>
            <tr>
              <td className="border px-3 py-2">💎 高級套餐</td>
              <td className="border px-3 py-2 text-center">$100</td>
              <td className="border px-3 py-2 text-center">125</td>
              <td className="border px-3 py-2 text-center">$0.80</td>
              <td className="border px-3 py-2">送 25 點</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 📌 付款說明區塊 */}
      <div className="text-sm text-gray-700 leading-relaxed bg-yellow-50 border border-yellow-300 p-3 rounded">
        <p>📌 <strong>付款說明：</strong></p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>請使用 Alipay（香港）或 PayPal 付款。</li>
          <li>上傳付款截圖時，請務必填寫你的<strong>姓名</strong>與<strong>聯絡方式</strong>。</li>
          <li>本人將於 <strong>24 小時內</strong>開通點數，如遇週末或深夜略有延遲 🙏。</li>
          <li>若有推薦碼，請填寫以獲得額外點數。</li>
        </ul>
      </div>

      {/* 表單區塊 */}
      <Input placeholder="你的姓名" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="聯絡方式（微信 / WhatsApp）" value={contact} onChange={(e) => setContact(e.target.value)} />
      <Input placeholder="推薦碼（可選）" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
      <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />

      {file && typeof window !== 'undefined' && (
        <div className="flex justify-center">
          <img src={URL.createObjectURL(file)} alt="預覽圖" width={200} height={200} className="rounded-lg" />
        </div>
      )}

      <Button onClick={handleUpload} isLoading={isSubmitting} className="w-full">
        📤 提交付款資料
      </Button>

      {success && <p className="text-green-600 mt-4">✅ 上傳成功！請等待人工開通</p>}
    </div>
  );
}
