// pages/admin/recharges.tsx

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function AdminRechargesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (session?.user?.email !== '44444death@gmail.com') {
      router.push('/');
    }
  }, [session, status]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/recharges');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Error loading recharges:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-4">🔄 載入中...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🧾 充值申請紀錄（後台）</h1>
      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2">姓名</th>
            <th className="border px-3 py-2">聯絡方式</th>
            <th className="border px-3 py-2">上傳時間</th>
            <th className="border px-3 py-2">截圖</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.id}>
              <td className="border px-3 py-2">{entry.name}</td>
              <td className="border px-3 py-2">{entry.phone}</td>
              <td className="border px-3 py-2">{new Date(entry.createdAt).toLocaleString()}</td>
              <td className="border px-3 py-2">
                <img src={entry.screenshotUrl} alt="截圖" className="w-32 rounded" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
