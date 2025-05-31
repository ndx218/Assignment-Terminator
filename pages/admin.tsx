// pages/admin.tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface Transaction {
  id: string;
  amount: number;
  isFirstTopUp: boolean;
  createdAt: string;
  type?: string;
  description?: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [points, setPoints] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // ✅ 管理员授权检查
  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user?.role !== 'ADMIN') {
      console.warn('Unauthorized access to admin page. Redirecting.');
      router.replace('/');
    }
  }, [status, session, router]);

  const handleAddPoints = async () => {
    if (!email || !points) {
      setMessage('請輸入 Email 和 點數');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/add-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount: Number(points) }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        setEmail('');
        setPoints('');
        fetchTransactions();
      } else {
        setMessage(`❌ 錯誤：${data.error || '未知錯誤'}`);
      }
    } catch (error) {
      setLoading(false);
      setMessage(`❌ 網路錯誤或伺服器無響應`);
      console.error('Add points API call failed:', error);
    }
  };

  const fetchTransactions = async () => {
    if (!email) {
      setMessage('請先輸入 Email 以查詢紀錄');
      setTransactions([]);
      return;
    }
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch(`/api/admin/transactions?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setTransactions(data.transactions);
        if (data.transactions.length === 0) {
          setMessage(`沒有找到 ${email} 的交易紀錄。`);
        } else {
          setMessage('');
        }
      } else {
        setMessage(`❌ 錯誤：${data.error || '查詢失敗'}`);
        setTransactions([]);
      }
    } catch (error) {
      setLoading(false);
      setMessage(`❌ 網路錯誤或伺服器無響應`);
      console.error('Fetch transactions API call failed:', error);
    }
  };

  if (status === 'loading') {
    return <div className="h-screen flex items-center justify-center text-gray-500">⏳ 載入中...</div>;
  }

  if (!session || session.user?.role !== 'ADMIN') {
    return <div className="h-screen flex items-center justify-center text-gray-500">🚫 無權訪問。</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">👑 管理員後台</h1>

      <nav className="mb-4 space-x-4 text-sm text-blue-600">
        <Link href="/admin">🏠 主控台</Link>
        <Link href="/admin/topup-submissions">📤 查看付款上傳</Link>
        <Link href="/admin/transactions">📊 所有交易紀錄</Link>
      </nav>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">➕ 加點工具</h2>
        <Input placeholder="使用者 Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        <Input placeholder="加幾點？" value={points} onChange={(e) => setPoints(e.target.value)} type="number" />
        <Button onClick={handleAddPoints} disabled={loading} className="w-full">
          {loading ? '處理中...' : '➕ 加點'}
        </Button>
      </section>

      {message && <p className={`text-sm text-center ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}

      <hr className="my-6" />

      <section>
        <h2 className="text-lg font-semibold">📜 使用者交易紀錄查詢</h2>
        <Button variant="outline" onClick={fetchTransactions} disabled={loading} className="mb-2 text-sm">
          {loading ? '查詢中...' : '🔄 查詢紀錄'}
        </Button>

        <ul className="text-sm space-y-2">
          {transactions.map((tx) => (
            <li key={tx.id} className="border rounded p-2 bg-gray-50">
              ✉️ {email} - 💰 {tx.amount} 點 - {tx.type || (tx.isFirstTopUp ? '首充' : '加值')} {tx.description ? `(${tx.description})` : ''} - {new Date(tx.createdAt).toLocaleString()}
            </li>
          ))}
          {transactions.length === 0 && message.includes('沒有找到') ? (
            <li className="text-gray-400">沒有找到該用戶的交易紀錄。</li>
          ) : (
            transactions.length === 0 && <li className="text-gray-400">尚無紀錄</li>
          )}
        </ul>
      </section>
    </div>
  );
}
