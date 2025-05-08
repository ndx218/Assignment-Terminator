'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import SidebarWrapper from '@/components/SidebarWrapper';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [points, setPoints] = useState<number>(0);

  useEffect(() => {
    setPoints(session?.user?.credits ?? 2);
  }, [session]);

  const userName = session?.user?.name || '訪客';

  return (
    <div className="flex min-h-screen">
      <SidebarWrapper />
      <div className="flex flex-col flex-1 md:pl-[240px] bg-gray-50">
        <header className="p-3 bg-white shadow flex justify-end items-center">
          <div className="text-sm text-gray-700">
            👤 {userName} ｜🪙 點數：{points}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
