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
} from 'lucide-react';

export default function Sidebar() {
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
    <aside className="h-screen w-[240px] bg-black text-white flex flex-col pt-4">
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
  );
}
