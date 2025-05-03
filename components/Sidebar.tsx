import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import { useSession } from 'next-auth/react';

export default function Sidebar() {
  const router = useRouter();
  const { data: session } = useSession();
  const isActive = (path: string) => router.pathname === path;

  return (
    <aside className="w-64 min-h-screen bg-gray-100 p-4">
      <h1 className="text-xl font-bold mb-6">📚 Assignment Terminator</h1>
      <nav className="space-y-3">
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
            className={`block px-4 py-2 rounded hover:bg-gray-200 cursor-pointer ${
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

        {session && (
          <Link href="/admin">
            <span
              className={`block px-4 py-2 rounded hover:bg-gray-200 cursor-pointer ${
                isActive('/admin') ? 'bg-gray-300 font-semibold' : ''
              }`}
            >
              👑 管理介面
            </span>
          </Link>
        )}
      </nav>
    </aside>
  );
}
