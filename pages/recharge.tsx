import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RechargePage() {
  const { status } = useSession();
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
  }, [status, router, skipLogin]);

  if (skipLogin === null || (!skipLogin && status === 'loading')) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        ⏳ 載入中...
      </div>
    );
  }

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold">💳 點數充值</h2>

      <Input placeholder="你的姓名" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="聯絡方式" value={contact} onChange={(e) => setContact(e.target.value)} />
      <Input placeholder="推薦碼（可選）" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
      <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />

      <Button isLoading={isSubmitting} className="w-full">📤 提交付款資料</Button>
    </div>
  );
}
