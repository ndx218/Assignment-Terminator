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
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetch('/api/admin/topup-submissions')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`❌ ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then(setRecords)
      .catch((err) => {
        console.error('[前端錯誤]', err);
        setError('無法載入資料，請確認您有管理員權限');
      });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📤 付款上傳紀錄</h1>

      {error && <p className="text-red-600">{error}</p>}

      <div className="grid gap-4">
        {records.map((r) => (
          <div key={r.id} className="border rounded p-4 shadow bg-white">
            <p><strong>👤 姓名：</strong>{r.name}</p>
            <p><strong>📞 電話：</strong>{r.phone}</p>
            {r.referralCode && <p><strong>🎟️ 推薦碼：</strong>{r.referralCode}</p>}
            <p><strong>🕒 上傳時間：</strong>{new Date(r.createdAt).toLocaleString()}</p>
            <img src={r.imageUrl} alt="付款截圖" className="mt-2 max-w-xs rounded shadow" />
          </div>
        ))}
      </div>
    </div>
  );
}
