'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function SidebarWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 📱 手機版漢堡按鈕 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 rounded-full bg-white border shadow-md md:hidden"
        aria-label="開啟選單"
      >
        <Menu className="w-5 h-5 text-black" />
      </button>

      {/* 📱 手機版浮出側欄 + 遮罩 */}
      {open && (
        <>
          {/* 黑色遮罩 */}
          <div
            className="fixed inset-0 z-30 bg-black bg-opacity-30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* 側欄浮出 */}
          <div className="fixed top-0 left-0 z-40 w-[240px] h-full bg-white shadow-md">
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </>
      )}

      {/* 🖥️ 桌面版固定側欄 */}
      <div className="hidden md:block w-[240px] fixed top-0 left-0 h-full z-30 border-r bg-white">
        <Sidebar />
      </div>
    </>
  );
}
