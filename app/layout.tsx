'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import SidebarWrapper from '@/components/SidebarWrapper';
import './globals.css'; // 若你有 global 樣式可以加這行

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [points, setPoints] = useState<number>(0);

  useEffect(() => {
    setPoints(session?.user?.credits ?? 2);
  }, [session]);

  const userName = session?.user?.name || '訪客';

  return (
    <html lang="zh-Hant">
      <body>
        <div className="flex min-h-screen">
          {/* 左側側欄與漢堡選單 */}
          <SidebarWrapper />

          {/* 主畫面內容（桌面預留 sidebar 寬度） */}
          <div className="flex flex-col flex-1 md:pl-[240px] bg-gray-50">
            {/* 頂部欄位 */}
            <header className="p-3 bg-white shadow flex justify-end items-center">
              <div className="text-sm text-gray-700">
                👤 {userName} ｜🪙 點數：{points}
              </div>
            </header>

            {/* 主內容區域 */}
            <main className="flex-1 overflow-auto p-4">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
