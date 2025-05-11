'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast'; // ✅ 加入 toast 提示
import ClientLayout from './ClientLayout';

export default function ClientRootProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} /> {/* ✅ 提示訊息 */}
      <ClientLayout>{children}</ClientLayout>
    </SessionProvider>
  );
}
