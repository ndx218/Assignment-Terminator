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

  useEffect(() => {
    fetch('/api/admin/all-transactions')
      .then((res) => res.json())
      .then(setTransactions)
      .catch((e) => setError('❌ 無法載入交易紀錄'));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">📊 所有用戶交易紀錄</h1>
      {error && <p className="text-red-600">{error}</p>}
      <ul className="space-y-2 text-sm">
        {transactions.map((tx) => (
          <li key={tx.id} className="border rounded p-2 bg-gray-50">
            ✉️ {tx.user.email} - 💰 {tx.amount} 點 - 🏷 {tx.type}
            {tx.description && ` (${tx.description})`} - 🕒{' '}
            {new Date(tx.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
