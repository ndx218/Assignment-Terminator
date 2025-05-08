'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import SidebarWrapper from '@/components/SidebarWrapper';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [points, setPoints] = useState<number>(0);

  useEffect(() => {
    if (session?.user?.credits != null) {
      setPoints(session.user.credits);
    } else {
      setPoints(2); // 預設新帳戶給 2 點
    }
  }, [session]);

  const userName = session?.user?.name || '訪客';

  return (
    <>
      {/* ✅ Sidebar 和漢堡按鈕，固定在畫面最上層 */}
      <SidebarWrapper />

      {/* 主畫面（保留空間） */}
      <div className="md:pl-[240px] flex flex-col min-h-screen bg-gray-50">
        {/* 頂部欄：包含用戶資料顯示 */}
        <header className="p-3 bg-white shadow flex justify-end items-center">
          <div className="text-sm text-gray-700">
            👤 {userName} ｜🪙 點數：{points}
          </div>
        </header>

        {/* 頁面內容 */}
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </>
  );
}
