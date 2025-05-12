// ✅ pages/editor.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import EasyWorkUI from '@/components/EasyWorkUI';

export default function EditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [skipLogin, setSkipLogin] = useState<boolean | null>(null);

  // ✅ 判斷是否跳過登入（client only）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const skip = localStorage.getItem('skipLogin') === 'true';
      setSkipLogin(skip);
    }
  }, []);

  // ✅ 若沒登入且沒 skipLogin，導向 /login
  useEffect(() => {
    if (skipLogin === false && status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router, skipLogin]);

  // ✅ 尚未判斷完成，暫不 render
  if (skipLogin === null || (!skipLogin && status === 'loading')) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        ⏳ 載入中...
      </div>
    );
  }

  return <EasyWorkUI />;
}
