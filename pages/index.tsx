'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import EasyWorkUI from '@/components/ui/EasyWorkUI';

export default function HomePage() {
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
      router.replace('/login');
    }
  }, [status, router, skipLogin]);

  useEffect(() => {
    if (status === 'authenticated') {
      console.log('✅ 已登入:', session?.user?.email);
    }
  }, [status, session]);

  if (skipLogin === null || (!skipLogin && status === 'loading')) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        ⏳ 載入中...
      </div>
    );
  }

  return <EasyWorkUI />;
}
