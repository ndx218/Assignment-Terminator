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

  if (skipLogin === null || (!skipLogin && status === 'loading')) {
    return <div className="h-screen flex items-center justify-center text-gray-500">⏳ 載入中...</div>;
  }

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);

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

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold">💳 點數充值</h2>

      <div className="text-sm text-gray-600">
        請填寫正確資料，本人將於 24 小時內開通點數。如遇週末／深夜略有延遲 🙏
      </div>

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

      <Button onClick={handleUpload} isLoading={isSubmitting} className="w-full">📤 提交付款資料</Button>

      {success === true && <p className="text-green-600">✅ 上傳成功！請等待人工開通</p>}
      {success === false && <p className="text-red-500">❌ 上傳失敗，請稍後再試</p>}
    </div>
  );
}
