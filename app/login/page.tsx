'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ 登入成功後自動導向首頁
  useEffect(() => {
    if (session?.user) {
      router.push('/');
    }
  }, [session, router]);

  const handleEmailSignIn = async () => {
    setLoading(true);
    await signIn('email', { email });
    setLoading(false);
  };

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
