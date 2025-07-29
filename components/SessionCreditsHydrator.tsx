'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useSetCredits } from '@/hooks/usePointStore';

/** 將 session.user.credits 同步到 Zustand（僅在登入後執行） */
export default function SessionCreditsHydrator() {
  const { data: session, status } = useSession();
  const setCredits = useSetCredits();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const value =
      typeof session?.user?.credits === 'number' ? session.user.credits : 0;
    setCredits(value);
  }, [status, session?.user?.credits, setCredits]);

  return null; // 不渲染任何東西
}
