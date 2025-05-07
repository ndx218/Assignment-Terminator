'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  Wallet,
  HelpCircle,
  User,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
    <>
      {/* 🔘 漢堡選單按鈕（小螢幕用） */}
      <button
        className="md:hidden p-4 text-white z-50 fixed"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* 📚 側邊欄主體 */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-[240px] bg-black text-white flex flex-col pt-4 z-40 transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0' // ⬅️ 桌面版永遠展開
        )}
      >
        {/* Logo */}
        <div className="px-6 mb-6">
          <h1 className="text-2xl font-bold leading-tight">
            📚 Assignment<br />Terminator
          </h1>
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
                  'flex items-center gap-3 px-4 py-2 rounded-md transition-colors hover:bg-gray-800',
                  isActive && 'bg-gray-800'
                )}
                onClick={() => setOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 分隔線 */}
        <hr className="my-4 border-gray-700 mx-4" />

        {/* 額外功能選單 */}
        <nav className="flex flex-col gap-1 px-2">
          {userMenu.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-2 rounded-md transition-colors hover:bg-gray-800"
                onClick={() => setOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto text-xs text-gray-500 px-4 py-3">
          © 2025 ChakFung
        </div>
      </aside>
    </>
  );
}
