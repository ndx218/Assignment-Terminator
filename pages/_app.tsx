// /pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import SidebarWrapper from '@/components/SidebarWrapper';
import '@/styles/globals.css';

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen bg-gray-50">
        {/* 📚 左側固定側欄（含手機版浮出） */}
        <SidebarWrapper />

        {/* 🧾 主內容區域 */}
        <main className="flex-1 md:pl-[240px] p-4">
          <Component {...pageProps} />
        </main>

        {/* 🔔 toast 通知 */}
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </div>
    </SessionProvider>
  );
}
