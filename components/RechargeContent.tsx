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
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        ⏳ 載入中...
      </div>
    );
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
