import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function RedirectHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/editor'); // ⬅️ 將 '/editor' 改成你的作業產生器頁面路徑
  }, [router]);

  return null;
}
