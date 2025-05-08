'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">登入 Assignment Terminator</h1>
        <p className="mb-4 text-gray-600">請使用 GitHub 登入帳戶以繼續使用本平台。</p>
        <button
          onClick={() => signIn('github')}
          className="w-full bg-black text-white py-2 rounded hover:bg-gray-800"
        >
          使用 GitHub 登入
        </button>
      </div>
    </div>
  );
}
