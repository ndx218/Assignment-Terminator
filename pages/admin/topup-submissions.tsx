// pages/admin/topup-submissions.tsx
import { useEffect, useState } from 'react';

type TopUpSubmission = {
  id: string;
  name: string;
  phone: string;
  referralCode?: string;
  imageUrl: string;
  createdAt: string;
};

export default function TopUpSubmissionsPage() {
  const [records, setRecords] = useState<TopUpSubmission[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/topup-submissions')
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || '無法載入資料');
        }
        return res.json();
      })
      .then(setRecords)
      .catch((err) => {
        console.error(err);
        setError(err.message || '無法載入資料，請確認您的權限');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">📤 付款上傳紀錄</h1>

      {loading && <p className="text-gray-500">載入中...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && records.length === 0 && <p className="text-gray-400">尚無資料</p>}

      <ul className="space-y-4">
        {records.map((r) => (
          <li key={r.id} className="p-4 border rounded bg-white shadow">
            <p><strong>👤 姓名：</strong>{r.name}</p>
            <p><strong>📞 電話：</strong>{r.phone}</p>
            {r.referralCode && <p><strong>🎟️ 推薦碼：</strong>{r.referralCode}</p>}
            <p><strong>🕒 上傳時間：</strong>{new Date(r.createdAt).toLocaleString()}</p>
            <img src={r.imageUrl} alt="付款截圖" className="mt-2 max-w-xs rounded" />
          </li>
        ))}
      </ul>
    </div>
  );
}
