// pages/login.tsx
import { signIn, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { showSuccess, showError } from '@/lib/toast';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (session?.user) {
      showSuccess('login');
      router.replace('/');
    }
  }, [session, status]);

  const handleEmailSignIn = async () => {
    setLoading(true);
    const res = await signIn('email', { email, redirect: false });
    res?.ok ? showSuccess('email') : showError('email');
    setLoading(false);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        正在驗證登入狀態...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 space-y-6">
        <h1 className="text-2xl font-bold text-center">登入 Assignment Terminator</h1>

        <button
          onClick={() => signIn('google')}
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-xl transition"
        >
          使用 Google 登入
        </button>

        <div className="text-center text-sm text-gray-400">或使用 Email</div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="輸入你的 Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleEmailSignIn}
            disabled={loading || !email}
            className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800 disabled:opacity-50"
          >
            發送登入連結
          </button>
        </div>
      </div>
    </div>
  );
}
