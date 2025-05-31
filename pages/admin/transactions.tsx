// pages/admin/transactions.tsx
import { useEffect, useState } from 'react';

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description?: string;
  createdAt: string;
  user: {
    email: string;
  };
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/all-transactions')
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || '未知錯誤');
        }
        return res.json();
      })
      .then(setTransactions)
      .catch((e) => {
        console.error('[🚨 錯誤]', e);
        setError(e.message || '❌ 無法載入交易紀錄');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">📊 所有用戶交易紀錄</h1>

      {loading && <p className="text-gray-500">⏳ 載入中...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && transactions.length === 0 && !error && (
        <p className="text-gray-400">目前沒有任何交易紀錄。</p>
      )}

      <ul className="space-y-2 text-sm">
        {transactions.map((tx) => (
          <li key={tx.id} className="border rounded p-3 bg-gray-50 shadow-sm">
            ✉️ <strong>{tx.user.email}</strong><br />
            💰 {tx.amount} 點<br />
            🏷 {tx.type}{tx.description ? ` (${tx.description})` : ''}<br />
            🕒 {new Date(tx.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
