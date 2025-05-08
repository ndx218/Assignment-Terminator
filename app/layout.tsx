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
    <div className="flex min-h-screen">
      {/* ✅ 左側 Sidebar，包含漢堡按鈕 */}
      <SidebarWrapper />

      {/* ✅ 主畫面，留出左側 sidebar 寬度（桌面） */}
      <div className="flex flex-col flex-1 md:pl-[240px] bg-gray-50">
        {/* 頂部欄 */}
        <header className="p-3 bg-white shadow flex justify-end items-center">
          <div className="text-sm text-gray-700">
            👤 {userName} ｜🪙 點數：{points}
          </div>
        </header>

        {/* 主內容區域 */}
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
