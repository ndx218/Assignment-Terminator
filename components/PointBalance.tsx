'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useCredits, useSetCredits } from '@/hooks/usePointStore';

export default function PointBalance() {
  const { data: session } = useSession();

  /* 直接用 selector 取得 */
  const credits     = useCredits();
  const setCredits  = useSetCredits();

  /* session 變動 → 同步點數 */
  useEffect(() => {
    if (session?.user?.credits != null) {
      setCredits(session.user.credits);   // 後端帶回的餘額
    } else {
      setCredits(5);                      // 來賓 / 新用戶預設 3 點
    }
  }, [session, setCredits]);

  /* 未登入時不顯示 */
  if (!session?.user) return null;

  return (
    <div className="fixed top-4 right-4 bg-yellow-100 text-yellow-800
                    px-4 py-2 rounded shadow text-sm">
      👤 {session.user.name ?? '訪客'} ｜ 🪙 點數：
      <strong>{credits}</strong>
    </div>
  );
}
