// pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import SidebarWrapper from '@/components/SidebarWrapper';
import SessionCreditsHydrator from '@/components/SessionCreditsHydrator';
import { TopBar } from '@/components/TopBar';  // <- 單獨引入
import '@/styles/globals.css';

export default function MyApp({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <SessionCreditsHydrator />

      {/* 頂部導覽列只渲染一次 */}
      <TopBar />

      <div className="flex min-h-screen bg-gray-50">
        {/* 側欄 */}
        <SidebarWrapper />

        {/* 主內容，md 以上預留 240px 給 sidebar */}
        <main className="flex-1 md:pl-[240px] p-4">
          <Component {...pageProps} />
        </main>
      </div>

      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </SessionProvider>
  );
}
