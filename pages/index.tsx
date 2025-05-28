// pages/index.tsx
'use client';

import { useSession, signOut } from 'next-auth/react';
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
      // 您可以在这里或者在渲染部分访问 session.user.credits
      console.log('用户积分:', session?.user?.credits);
    }
  }, [status, session]);

  if (skipLogin === null || (!skipLogin && status === 'loading')) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        ⏳ 載入中...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {status === 'authenticated' && (
        <div className="w-full bg-green-50 border-b border-green-200 p-4 flex justify-between items-center text-sm text-green-800">
          <div>
            👤 已登入：<span className="font-medium">{session.user?.email}</span>（ID: {session.user?.id}）
            {/* ✅ 显示用户积分 */}
            {session.user?.credits !== undefined && (
              <span className="ml-4">✨ 積分：<span className="font-medium">{session.user.credits}</span> 點</span>
            )}
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('skipLogin');
              signOut({ callbackUrl: '/login' });
            }}
            className="text-red-500 hover:text-black font-medium"
          >
            🚪 登出
          </button>
        </div>
      )}

      {/* 主功能区域 */}
      <div className="flex-1">
        <EasyWorkUI />
      </div>
    </div>
  );
}
