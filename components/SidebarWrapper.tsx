'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function SidebarWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 📱/🖥️ 全裝置顯示漢堡按鈕 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white border shadow-md"
        aria-label="開啟選單"
      >
        <Menu className="w-5 h-5 text-black" />
      </button>

      {/* 📱/🖥️ 側欄浮出 */}
      {open && (
        <>
          {/* 黑色遮罩，點擊時關閉 */}
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
            onClick={() => setOpen(false)}
          />

          {/* 側欄本體，z-index 要比遮罩高 */}
          <div className="fixed top-0 left-0 z-50">
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
