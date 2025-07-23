'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  usePointStore,
  type PointState,
} from '@/hooks/usePointStore';

export default function PointBalance() {
  const { data: session } = useSession();

  /* ---------------- 取出 credits / set ---------------- */
  const credits = usePointStore((s: PointState) => s.credits);
  const set     = usePointStore((s: PointState) => s.set);

  /* ---------------- 首次載入 & session 變動時同步點數 ---------------- */
  useEffect(() => {
    if (session?.user?.credits != null) {
      set(session.user.credits);     // 後端帶回的剩餘點數
    } else {
      set(3);                        // 新用戶預設 2 點
    }
  }, [session, set]);

  /* 未登入時不顯示 */
  if (!session?.user) return null;

  return (
    <div className="fixed top-4 right-4 bg-yellow-100 text-yellow-800 px-4 py-2 rounded shadow text-sm">
      👤 {session.user.name ?? '訪客'} ｜ 🪙 點數：<strong>{credits}</strong>
    </div>
  );
}
