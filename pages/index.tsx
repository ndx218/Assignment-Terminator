import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function RedirectHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/editor'); // ✅ 改為你真正的產生器頁面
  }, [router]);

  return null;
}
