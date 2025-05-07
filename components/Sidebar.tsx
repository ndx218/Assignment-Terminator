'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  Wallet,
  HelpCircle,
  User,
  Settings,
  LogOut,
  X,
  Menu,
} from 'lucide-react';
import { useState } from 'react';

export default function SidebarWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 漢堡選單按鈕 */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white border shadow-md md:hidden"
        aria-label="開啟選單"
      >
        <Menu className="w-5 h-5 text-black" />
      </button>

      {/* 側邊欄 */}
      {open && (
        <Sidebar onClose={() => setOpen(false)} />
      )}

      {/* 桌面版固定顯示 */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
    </>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  const mainMenu = [
    { label: '作業產生器', href: '/', icon: Home },
    { label: '點數充值', href: '/recharge', icon: Wallet },
    { label: '常見問題', href: '/help', icon: HelpCircle },
  ];

  const userMenu = [
    { label: '個人中心', href: '/profile', icon: User },
    { label: '設定', href: '/settings', icon: Settings },
    { label: '登出', href: '/logout', icon: LogOut },
  ];

  return (
    <aside className="h-screen w-[240px] bg-white text-black flex flex-col pt-4 fixed z-40 md:relative shadow-md">
      {/* Logo & Close */}
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

      <nav className="flex flex-col gap-1 px-2">
        {userMenu.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2 rounded-md transition-colors hover:bg-gray-100"
              onClick={onClose}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto text-xs text-gray-400 px-4 py-3">
        © 2025 ChakFung
      </div>
    </aside>
  );
}
