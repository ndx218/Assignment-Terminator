import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ✅ 未登入時導向 login 頁面
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        🔐 正在驗證登入狀態...
      </div>
    );
  }

  const userName = session?.user?.name || '訪客';
  const points = session?.user?.credits ?? 2;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">🎓 Assignment Terminator</h1>
        <div className="text-sm text-gray-600">
          👤 {userName} ｜🪙 點數：{points}
        </div>
      </div>

      <p className="text-gray-700">
        歡迎使用 Assignment Terminator！這是一個專為學生設計的 AI 寫作平台，
        幫你快速完成作業，節省時間、提升品質 ✨
      </p>

      <ul className="list-disc list-inside space-y-2 text-gray-800">
        <li>📑 輸入你的功課資料並自動生成初稿</li>
        <li>🧑‍🏫 模擬老師評語與修訂稿</li>
        <li>🧪 支援 AI 降重與 Undetectable 優化</li>
        <li>💳 點數充值與推薦碼功能</li>
      </ul>

      <p className="text-sm text-gray-500">
        👉 使用左側功能列開始操作！
      </p>
    </div>
  );
}
