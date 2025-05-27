'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button'; // 假设您有一个带有 isLoading 属性的 Button 组件
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router'; // 确保这里是 'next/router'

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

  // ✅ 管理员授权检查
  useEffect(() => {
    if (status === 'loading') {
      // 会话还在加载中，不执行任何操作
      return;
    }

    // 如果没有会话（未登录），或者会话存在但用户的角色不是 'ADMIN'，则重定向到主页
    // 确保您的 next-auth.d.ts 中扩展了 Session.user 包含 role
    if (!session || session.user?.role !== 'ADMIN') {
      console.warn('Attempted access to admin page without ADMIN role. Redirecting.');
      router.replace('/'); // 重定向到主页
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
        setEmail(''); // 清空邮箱输入框
        setPoints(''); // 清空点数输入框
        fetchTransactions(); // 重新查询记录
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
      setTransactions([]); // 清空之前的记录
      return;
    }
    setLoading(true); // 可以为查询也添加 loading 状态，或者单独一个
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
            setMessage(''); // 清除之前的消息
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

  // 如果会话正在加载中，或用户不是管理员，显示加载或访问拒绝状态
  if (status === 'loading' || (!session && status !== 'unauthenticated') || (session && session.user?.role !== 'ADMIN')) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        {status === 'loading' ? '⏳ 載入中...' : '🚫 無權訪問。'}
      </div>
    );
  }

  // 确保 session 和 role 存在且是 ADMIN 才能渲染页面
  if (!session || session.user?.role !== 'ADMIN') {
      return null; // 或者重定向，因为 useEffect 已经处理了重定向
  }


  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">👑 管理員加點工具</h1>

      <Input
        placeholder="使用者 Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email" // 确保邮箱格式
      />
      <Input
        placeholder="加幾點？"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        type="number"
      />
      <Button onClick={handleAddPoints} disabled={loading} className="w-full">
        {loading ? '處理中...' : '➕ 加點'}
      </Button>

      {message && <p className={`text-sm text-center mt-2 ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}

      <hr className="my-6" />

      <h2 className="text-lg font-semibold">📜 交易紀錄</h2>
      <Button variant="outline" onClick={fetchTransactions} disabled={loading} className="mb-2 text-sm">
        {loading ? '查詢中...' : '🔄 查詢紀錄'}
      </Button>

      <ul className="text-sm space-y-2">
        {transactions.map((tx) => (
          <li key={tx.id} className="border rounded p-2 bg-gray-50">
            💰 {tx.amount} 點 - {tx.isFirstTopUp ? '首充' : '加值'} - {new Date(tx.createdAt).toLocaleString()}
          </li>
        ))}
        {transactions.length === 0 && message.includes('沒有找到') ? (
            <li className="text-gray-400">沒有找到該用戶的交易紀錄。</li>
        ) : (
            transactions.length === 0 && <li className="text-gray-400">尚無紀錄</li>
        )}
      </ul>
    </div>
  );
}
