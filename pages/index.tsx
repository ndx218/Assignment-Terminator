import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function RedirectHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin'); // ✅ 自動導向到作業產生器頁
  }, [router]);

  return null;
}
