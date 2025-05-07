import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import PointBalance from '@/components/PointBalance';
import { Toaster } from 'sonner'; // ✅ 加入 toast 彈窗

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 relative">
          <Component {...pageProps} />
          <PointBalance />
        </main>
      </div>
      <Toaster position="top-center" richColors /> {/* ✅ 彈出提示容器放在根層 */}
    </SessionProvider>
  );
}
