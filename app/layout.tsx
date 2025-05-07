// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Assignment Terminator',
  description: 'AI 作業產生器平台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className={`${inter.className} bg-black text-white`}>
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <Sidebar />

          {/* 主要內容區：加上左邊留空寬度 */}
          <main className="flex-1 ml-0 md:ml-[240px] p-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
