'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function RechargePage() {
  const { status } = useSession(); // ⚠️ 暫不使用 router.push
  const [skipLogin, setSkipLogin] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const skip = localStorage.getItem('skipLogin') === 'true';
      setSkipLogin(skip);
    }
  }, []);

  return (
    <div className="p-10 text-center">
      <p>🔐 Auth Status: {status}</p>
      <p>🧭 skipLogin: {String(skipLogin)}</p>
    </div>
  );
}
