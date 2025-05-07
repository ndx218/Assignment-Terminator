'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function SidebarWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 📱/🖥️ 顯示漢堡按鈕（全裝置） */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white border shadow-md"
        aria-label="開啟選單"
      >
        <Menu className="w-5 h-5 text-black" />
      </button>

      {/* 📱 側欄浮出樣式 */}
      {open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-40"
          onClick={() => setOpen(false)}
        >
          <Sidebar onClose={() => setOpen(false)} />
        </div>
      )}

      {/* 🖥️ 桌面固定展開版 */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
    </>
  );
}
