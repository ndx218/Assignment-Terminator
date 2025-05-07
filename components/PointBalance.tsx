'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePointStore } from '@/lib/usePointStore';

export default function PointBalance() {
  const { data: session } = useSession();
  const { points, setPoints } = usePointStore();

  useEffect(() => {
    if (session?.user?.credits != null) {
      setPoints(session.user.credits);
    } else {
      setPoints(2); // 預設新帳戶 2 點
    }
  }, [session, setPoints]);

  if (!session?.user) return null;

  return (
    <div className="fixed top-4 right-4 bg-yellow-100 text-yellow-800 px-4 py-2 rounded shadow text-sm">
      👤 {session.user.name ?? '訪客'}｜🪙 點數：<strong>{points}</strong>
    </div>
  );
}
