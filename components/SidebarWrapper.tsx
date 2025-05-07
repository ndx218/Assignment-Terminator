'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';

export default function SidebarWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 📱 漢堡選單按鈕（僅手機顯示） */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white border shadow-md md:hidden"
        aria-label="開啟選單"
      >
        <Menu className="w-5 h-5 text-black" />
      </button>

      {/* 📱 浮出式側欄（手機） */}
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-40">
          <Sidebar onClose={() => setOpen(false)} />
        </div>
      )}

      {/* 🖥️ 桌面版固定側欄 */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
    </>
  );
}
