'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Wallet, HelpCircle, LogOut, X } from 'lucide-react';
import { signOut } from 'next-auth/react';

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const mainMenu = [
    { label: '作業產生器', href: '/', icon: Home },
    { label: '點數充值', href: '/recharge', icon: Wallet },
    { label: '常見問題', href: '/help', icon: HelpCircle },
  ];

  const handleLogout = async () => {
    localStorage.removeItem('skipLogin'); // ✅ 清除跳過登入 flag
    await signOut({ redirect: false });   // ✅ 登出但不自動跳轉
    router.replace('/login');             // ✅ 手動跳轉
  };

  return (
    <aside
      className={cn(
        'h-screen w-[240px] bg-white text-black flex flex-col pt-4 shadow-md',
        onClose ? 'fixed top-0 left-0 z-50' : 'hidden md:flex md:fixed md:top-0 md:left-0 md:z-30'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-6 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold leading-tight">
          📚 Assignment<br />Terminator
        </h1>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black md:hidden"
            aria-label="關閉側欄"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1 px-2">
        {mainMenu.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-md transition-colors',
                isActive
                  ? 'bg-gray-100 font-semibold text-black'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
              onClick={onClose}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{label}</span>
            </Link>
          );
        })}
      </nav>

      <hr className="my-4 border-gray-200 mx-4" />

      <nav className="flex flex-col gap-1 px-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-gray-700 hover:bg-gray-100"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">登出</span>
        </button>
      </nav>

      <div className="mt-auto text-xs text-gray-400 px-4 py-3">
        © 2025 ChakFung
      </div>
    </aside>
  );
}
