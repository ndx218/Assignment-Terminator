// pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import SidebarWrapper from '@/components/SidebarWrapper';
import '@/styles/globals.css';

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <div className="flex min-h-screen">
        <SidebarWrapper />
        <div className="flex-1 md:pl-[240px] bg-gray-50">
          <Component {...pageProps} />
        </div>
      </div>
    </SessionProvider>
  );
}
