'use client';

import { useEffect, useState } from 'react';

interface RechargeRecord {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  screenshotUrl: string;
}

export default function AdminRechargePage() {
  const [data, setData] = useState<RechargeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/admin/recharges'); // 對應 API 路由
      const json = await res.json();
      setData(json.recharges); // ✅ API 要回傳 recharges: []
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-6">載入中...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🧑‍💻 充值申請記錄</h1>
      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">姓名</th>
            <th className="border px-2 py-1">聯絡方式</th>
            <th className="border px-2 py-1">時間</th>
            <th className="border px-2 py-1">截圖</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.id}>
              <td className="border px-2 py-1">{entry.name}</td>
              <td className="border px-2 py-1">{entry.phone}</td>
              <td className="border px-2 py-1">{new Date(entry.createdAt).toLocaleString()}</td>
              <td className="border px-2 py-1">
                <a href={entry.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  查看圖片
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
