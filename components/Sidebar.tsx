'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Wallet, HelpCircle, LogOut, X } from 'lucide-react';

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  const mainMenu = [
    { label: '作業產生器', href: '/', icon: Home },
    { label: '點數充值', href: '/recharge', icon: Wallet },
    { label: '常見問題', href: '/help', icon: HelpCircle },
  ];

  return (
    <aside
      className="h-screen w-[240px] bg-white text-black flex flex-col pt-4 fixed md:static z-50 shadow-md"
      onClick={(e) => e.stopPropagation()} // 防止點擊遮罩也關閉
    >
      {/* Logo + 關閉（手機才顯示） */}
      <div className="px-6 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold leading-tight">
          📚 Assignment<br />Terminator
        </h1>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-gray-500 hover:text-black"
            aria-label="關閉側欄"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 主選單 */}
      <nav className="flex flex-col gap-1 px-2">
        {mainMenu.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-md transition-colors hover:bg-gray-100',
                isActive && 'bg-gray-100 font-semibold'
              )}
              onClick={onClose}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <hr className="my-4 border-gray-300 mx-4" />

      {/* 登出 */}
      <nav className="flex flex-col gap-1 px-2">
        <Link
          href="/logout"
          className="flex items-center gap-3 px-4 py-2 rounded-md transition-colors hover:bg-gray-100"
          onClick={onClose}
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">登出</span>
        </Link>
      </nav>

      {/* 底部版權文字 */}
      <div className="mt-auto text-xs text-gray-400 px-4 py-3">
        © 2025 ChakFung
      </div>
    </aside>
  );
}
