'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import SidebarWrapper from '@/components/SidebarWrapper';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [points, setPoints] = useState<number>(0);

  useEffect(() => {
    setPoints(session?.user?.credits ?? 2);
  }, [session]);

  const userName = session?.user?.name || '訪客';

  return (
    <>
      {/* ✅ Sidebar + 漢堡按鈕 */}
      <SidebarWrapper />

      {/* ✅ 主畫面：保留 Sidebar 寬度 */}
      <div className="md:pl-[240px] flex flex-col min-h-screen bg-gray-50">
        <header className="p-3 bg-white shadow flex justify-end items-center">
          <div className="text-sm text-gray-700">
            👤 {userName} ｜🪙 點數：{points}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </>
  );
}
