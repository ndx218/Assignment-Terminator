// /pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import SidebarWrapper from '@/components/SidebarWrapper';
import SessionCreditsHydrator from '@/components/SessionCreditsHydrator'; // ✅ 新增
import '@/styles/globals.css';

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <SessionCreditsHydrator /> {/* ✅ 一進來就同步 */}
      <div className="flex min-h-screen bg-gray-50">
        <SidebarWrapper />
        <main className="flex-1 md:pl-[240px] p-4">
          <Component {...pageProps} />
        </main>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </div>
    </SessionProvider>
  );
}
