'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSetCredits, usePointStore } from '@/hooks/usePointStore';

/** 將 session.user.credits 同步到 Zustand，並處理登出/換帳號 */
export default function SessionCreditsHydrator() {
  const { data: session, status } = useSession();
  const setCredits = useSetCredits();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      const userId = String(session?.user?.id ?? '');
      const raw = (session as any)?.user?.credits;

      // 換帳號時清除上一位使用者的持久化資料，避免殘留
      if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
        usePointStore.persist?.clearStorage?.();
      }
      lastUserIdRef.current = userId;

      // 僅在是數字時才覆寫 Store，避免不完整的 session 將值降為 0
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        setCredits(raw);
      }
      return;
    }

    if (status === 'unauthenticated') {
      // 登出時歸零並清掉持久化，避免下位使用者看到殘值
      setCredits(0);
      usePointStore.persist?.clearStorage?.();
      lastUserIdRef.current = null;
    }
  }, [status, session?.user?.id, session?.user?.credits, setCredits]);

  return null;
}
