'use client';

import { useEffect, useState } from 'react';
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [records, setRecords] = useState<any[]>([]);

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
  }, [skipLogin, status]);

  useEffect(() => {
    // Mock: 後台載入充值紀錄
    setRecords([
      {
        name: '小明',
        contact: 'WeChat123',
        time: '2025-05-13 17:30',
        img: '/sample-payment.png',
      },
    ]);
  }, []);

  const handleUpload = async () => {
    if (!name || !contact || !file) {
      alert('⚠️ 請填寫所有欄位並選擇截圖');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', contact);
    formData.append('screenshot', file);
    formData.append('referralCode', referralCode);

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/upload-payment', {
        method: 'POST',
        body: formData,
      });
      const ok = res.ok;
      setSuccess(ok);
      if (ok) {
        setName('');
        setContact('');
        setReferralCode('');
        setFile(null);
        setPreviewUrl(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error(err);
      setSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (skipLogin === null || (!skipLogin && status === 'loading')) {
    return <div className="h-screen flex items-center justify-center text-gray-500">⏳ 載入中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h2 className="text-2xl font-bold">💳 點數充值</h2>

      {/* 套餐表格 */}
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

      {/* 付款說明 */}
      <div className="bg-yellow-50 border border-yellow-300 text-sm text-yellow-800 rounded-md p-4">
        <p className="font-semibold mb-2">📌 付款說明：</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>請使用 Alipay（香港） 或 PayPal 付款。</li>
          <li>上傳付款截圖時，請務必填寫你的姓名與聯絡方式。</li>
          <li>本人將於 <strong>24 小時內</strong> 開通點數，如遇週末或深夜略有延遲 🙏。</li>
          <li>若有推薦碼，請填寫以獲得額外點數。</li>
        </ul>
      </div>

      {/* 付款方式 */}
      <div className="text-sm space-y-2">
        <div>
          <strong>📱 Alipay（香港）：</strong>
          <img src="/alipay-qr.png" alt="Alipay QR" width={180} height={180} className="mt-2" />
        </div>
        <div>
          <strong>🌐 PayPal：</strong>
          <a href="https://www.paypal.com/paypalme/TamChakFung" target="_blank" className="text-blue-600 underline ml-1">https://www.paypal.com/paypalme/TamChakFung</a>
        </div>
      </div>

      {/* 表單輸入區域 */}
      <Input placeholder="你的姓名" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="聯絡方式（微信 / WhatsApp）" value={contact} onChange={(e) => setContact(e.target.value)} />
      <Input placeholder="推薦碼（可選）" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
      <Input type="file" accept="image/*" onChange={(e) => {
        const file = e.target.files?.[0] || null;
        setFile(file);
        setPreviewUrl(file ? URL.createObjectURL(file) : null);
      }} />

      {previewUrl && (
        <div className="flex justify-center">
          <img src={previewUrl} alt="預覽圖" className="rounded-lg mt-2 max-w-[200px]" />
        </div>
      )}

      <Button onClick={handleUpload} isLoading={isSubmitting} className="w-full">
        📤 提交付款資料
      </Button>

      {success === true && <p className="text-green-600">✅ 上傳成功！請等待人工開通</p>}
      {success === false && <p className="text-red-500">❌ 上傳失敗，請稍後再試</p>}

      {/* 查看充值紀錄區塊 */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold mb-2">🧑‍💻 充值申請紀錄（模擬）</h3>
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">姓名</th>
              <th className="border px-2 py-1">聯絡方式</th>
              <th className="border px-2 py-1">時間</th>
              <th className="border px-2 py-1">截圖</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">{r.name}</td>
                <td className="border px-2 py-1">{r.contact}</td>
                <td className="border px-2 py-1">{r.time}</td>
                <td className="border px-2 py-1">
                  <img src={r.img} alt="截圖" className="w-20 h-auto rounded" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
