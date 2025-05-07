'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import { useSession } from 'next-auth/react';
import ReferralCodeForm from './ReferralCodeForm';

export default function Sidebar() {
  const router = useRouter();
  const { data: session } = useSession();
  const isActive = (path: string) => router.pathname === path;

  const user = session?.user;

  return (
    <aside className="w-64 min-h-screen bg-gray-100 p-4 flex flex-col justify-between">
      <div>
        <h1 className="text-xl font-bold mb-6">📚 Assignment Terminator</h1>
        <na className="space-y-3 mb-8">
          <Link href="/">
            <span
              className={`block px-4 py-2 rounded hover:bg-gray-200 cursor-pointer ${
                isActive('/') ? 'bg-gray-300 font-semibold' : ''
              }`}
            >
              📝 作業產生器
            </span>
          </Link>
          <Link href="/recharge">
            <span
              className={`block px-4 py-2 rounded hover:bg-gra-200 cursor-pointer ${
                isActive('/recharge') ? 'bg-gray-300 font-semibold' : ''
              }`}
            >
              💳 點數充值
            </span>
          </Link>
          <Link href="/help">
            <span
              className={`block px-4 py-2 rounded hover:bg-gray-200 cursor-pointer ${
                isActive('/help') ? 'bg-gray-300 font-semibold' : ''
              }`}
            >
              ❓ 常見問題
            </span>
          </Link>
          {user && (
            <Link href="/admin">
              <span
                className={`block px-4 py2 rounded hover:bg-gray-200 cursor-pointer ${
                  isActive('/admin') ? 'bg-gray-300 font-semibold' : ''
                }`}
              >
                👑 管理介面
              </span>
            </Link>
          )}
        </nav>

        {user && !user.referredBy && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-gray-700 mb-2">輸入推薦碼</h2>
            <ReferralCodeForm userId={user.id} referredBy={user.referredBy} />
          </div>
        )}
      </div>

      {user && (
        <div className="text-sm text-gray-500">
          登入帳戶：<span className="font-medium">{user.email || user.phone}</span>
        </div>
      )}
    </aside>
  );
}
