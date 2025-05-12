'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RechargePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [skipLogin, setSkipLogin] = useState<boolean | null>(null);

  // ✅ 判斷是否 skipLogin
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const skip = localStorage.getItem('skipLogin') === 'true';
      setSkipLogin(skip);
    }
  }, []);

  // ✅ 若沒登入且沒 skip，導向登入
  useEffect(() => {
    if (skipLogin === false && status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router, skipLogin]);

  if (skipLogin === null || (!skipLogin && status === 'loading')) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        ⏳ 載入中...
      </div>
    );
  }

  // ✅ 表單邏輯
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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
    <div className="max-w-3xl mx-auto p-6 space-y-10">
      <h2 className="text-2xl font-bold">💳 點數充值</h2>

      {/* ✅ 套餐表格 */}
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-300 text-sm">
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
              <td className="border px-3 py-2 text-center">28</td>
              <td className="border px-3 py-2 text-center">$0.71</td>
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

      {/* ✅ 付款與上傳區域 */}
      <p>
        📱 <strong>Alipay（香港）</strong>：請使用 Alipay 掃描下方 QR Code 完成付款。
      </p>
      <img src="/alipay-qr.png" alt="Alipay QR Code" width={240} height={240} className="mx-auto" />
      <p>
        🌐 <strong>PayPal</strong>：請使用 PayPal：
        <a className="text-blue-600 underline ml-1" href="https://www.paypal.com/paypalme/TamChakFung" target="_blank" rel="noopener noreferrer">
          https://www.paypal.com/paypalme/TamChakFung
        </a>
      </p>

      <p className="text-sm text-muted-foreground">
        📤 付款後請上傳付款截圖與你的姓名，本人會於 24 小時內人工審核並開通點數。如遇週末或深夜可能略有延遲，敬請見諒 🙏。
      </p>

      {/* ✅ 表單欄位 */}
      <Input placeholder="你的姓名" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="聯絡方式（微信 / WhatsApp）" value={contact} onChange={(e) => setContact(e.target.value)} />
      <Input placeholder="推薦碼（可選）" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
      <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />

      {/* ✅ 圖片預覽（修正 crash） */}
      {file && typeof window !== 'undefined' && (
        <div className="flex justify-center">
          <img
            src={URL.createObjectURL(file)}
            alt="預覽圖"
            width={200}
            height={200}
            className="rounded-lg"
          />
        </div>
      )}

      <Button onClick={handleUpload} isLoading={isSubmitting} className="w-full">
        📤 提交付款資料
      </Button>

      {success && <p className="text-green-600 mt-4">✅ 上傳成功！請等待人工開通</p>}
    </div>
  );
}
