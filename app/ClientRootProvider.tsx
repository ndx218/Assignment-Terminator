'use client';

import { SessionProvider } from 'next-auth/react';
import ClientLayout from './ClientLayout';

export default function ClientRootProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ClientLayout>{children}</ClientLayout>
    </SessionProvider>
  );
}
