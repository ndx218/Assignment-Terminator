'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function SidebarWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 📱/🖥️ 全裝置顯示漢堡按鈕（僅控制手機浮出） */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white border shadow-md md:hidden"
        aria-label="開啟選單"
      >
        <Menu className="w-5 h-5 text-black" />
      </button>

      {/* 📱 漢堡開啟時：浮出側欄 + 遮罩 */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-0 left-0 z-50 md:hidden">
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </>
      )}

      {/* 🖥️ 桌面版固定側欄：永遠顯示 */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
    </>
  );
}
