// pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import SidebarWrapper from '@/components/SidebarWrapper';
import '@/styles/globals.css';

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen">
        {/* 📚 左側側欄 + 漢堡選單控制（全裝置支援） */}
        <SidebarWrapper />

        {/* 🖥️ 主畫面區（要留 sidebar 寬度） */}
        <div className="flex-1 md:pl-[240px]">
          <Component {...pageProps} />
        </div>
      </div>
    </SessionProvider>
  );
}
