// ✅ /pages/admin.tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

interface Transaction {
  id: string;
  amount: number;
  isFirstTopUp: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [points, setPoints] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // ✅ 僅限管理員使用
  useEffect(() => {
    if (status !== 'loading' && session?.user?.email !== 'ndx218@gmail.com') {
      router.replace('/');
    }
  }, [status, session, router]);

  const handleAddPoints = async () => {
    if (!email || !points) {
      alert('請輸入 Email 和 點數');
      return;
    }

    setLoading(true);
    setMessage('');

    const res = await fetch('/api/admin/add-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount: Number(points) }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMessage(`✅ ${data.message}`);
      fetchTransactions();
    } else {
      setMessage(`❌ 錯誤：${data.error}`);
    }
  };

  const fetchTransactions = async () => {
    if (!email) {
      alert('請先輸入 Email');
      return;
    }
    const res = await fetch(`/api/admin/transactions?email=${email}`);
    const data = await res.json();
    if (res.ok) setTransactions(data.transactions);
    else alert(data.error || '查詢失敗');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">👑 管理員加點工具</h1>

      <Input placeholder="使用者 Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="加幾點？" value={points} onChange={(e) => setPoints(e.target.value)} type="number" />
      <Button onClick={handleAddPoints} isLoading={loading} className="w-full">
        ➕ 加點
      </Button>

      {message && <p className="text-sm text-center mt-2">{message}</p>}

      <hr className="my-6" />

      <h2 className="text-lg font-semibold">📜 交易紀錄</h2>
      <Button variant="outline" onClick={fetchTransactions} className="mb-2 text-sm">
        🔄 查詢紀錄
      </Button>

      <ul className="text-sm space-y-2">
        {transactions.map((tx) => (
          <li key={tx.id} className="border rounded p-2">
            💰 {tx.amount} 點 - {tx.isFirstTopUp ? '首充' : '加值'} - {new Date(tx.createdAt).toLocaleString()}
          </li>
        ))}
        {transactions.length === 0 && <li className="text-gray-400">尚無紀錄</li>}
      </ul>
    </div>
  );
}
