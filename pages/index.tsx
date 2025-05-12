import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [skipLogin, setSkipLogin] = useState<boolean | null>(null);

  // ✅ 讀取 localStorage 判斷是否跳過登入（只在 client 執行）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const skip = localStorage.getItem('skipLogin') === 'true';
      setSkipLogin(skip);
    }
  }, []);

  // ✅ 沒登入 + 沒 skip，導向 /login
  useEffect(() => {
    if (skipLogin === false && status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router, skipLogin]);

  // ✅ 尚未判斷完畢，不渲染畫面
  if (skipLogin === null || (!skipLogin && status === 'loading')) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        ⏳ 載入中...
      </div>
    );
  }

  const userName = session?.user?.name || '訪客';
  const points = session?.user?.credits ?? 2;

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-8">
      {/* 標題區 */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">🎓 Assignment Terminator</h1>
        <div className="text-sm text-gray-600">
          👤 {userName} ｜🪙 點數：{points}
        </div>
      </div>

      {/* 歡迎文字 */}
      <div className="text-gray-700 leading-relaxed">
        歡迎使用 Assignment Terminator！這是一個專為學生設計的 AI 寫作平台，幫你快速完成作業，節省時間、提升品質 ✨
      </div>

      {/* 功能清單 */}
      <ul className="list-disc list-inside space-y-2 text-gray-800">
        <li>📑 輸入你的功課資料並自動生成初稿</li>
        <li>🧑‍🏫 模擬老師評語與修訂稿</li>
        <li>🧪 支援 AI 降重與 Undetectable 優化</li>
        <li>💳 點數充值與推薦碼功能</li>
      </ul>

      {/* 導引提示 */}
      <p className="text-sm text-gray-500 text-center pt-8">
        👉 使用左側功能列開始操作！
      </p>
    </div>
  );
}
