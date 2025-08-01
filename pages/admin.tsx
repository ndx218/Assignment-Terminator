// pages/admin.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

type Tx = {
  id: string;
  amount: number;
  createdAt: string | Date;
  type?: string | null;
  description?: string | null;
  isFirstTopUp?: boolean | null;
  user?: { email?: string | null; phone?: string | null } | null;
  userId?: string;
  performedBy?: string | null;
};

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [points, setPoints] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;

  // 授權檢查
  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user?.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [status, session, router]);

  // 正規化 API 回傳 → 一律轉成陣列
  function normalizeTx(payload: any): { list: Tx[]; hasMore: boolean } {
    if (!payload) return { list: [], hasMore: false };

    // 1) 你的 API 目前：{ page, pageSize, total, hasMore, data: [...] }
    if (Array.isArray(payload.data)) {
      return { list: payload.data as Tx[], hasMore: !!payload.hasMore };
    }
    // 2) 曾經寫成 { transactions: [...] }
    if (Array.isArray(payload.transactions)) {
      return { list: payload.transactions as Tx[], hasMore: false };
    }
    // 3) 直接給陣列
    if (Array.isArray(payload)) {
      return { list: payload as Tx[], hasMore: false };
    }
    return { list: [], hasMore: false };
  }

  async function fetchTransactions(nextPage = 1) {
    if (!email) {
      setMessage('請先輸入 Email 以查詢紀錄');
      setTransactions([]);
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const params = new URLSearchParams({
        email,
        page: String(nextPage),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/transactions?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        setTransactions([]);
        setHasMore(false);
        setMessage(`❌ 錯誤：${json?.error ?? '查詢失敗'}`);
      } else {
        const { list, hasMore } = normalizeTx(json);
        setTransactions(list);
        setHasMore(hasMore);
        setPage(nextPage);
        if (list.length === 0) setMessage(`沒有找到 ${email} 的交易紀錄。`);
      }
    } catch (err) {
      console.error('Fetch transactions failed:', err);
      setTransactions([]);
      setHasMore(false);
      setMessage('❌ 網路錯誤或伺服器無響應');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddPoints() {
    if (!email || !points) {
      setMessage('請輸入 Email 和 點數');
      return;
    }
    setBusy(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/add-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount: Number(points) }),
      });
      const json = await res.json();

      if (!res.ok) {
        setMessage(`❌ 錯誤：${json?.error ?? '未知錯誤'}`);
        return;
      }
      setMessage(`✅ ${json?.message ?? '加點成功'}`);
      setPoints('');
      // 重新拉當前頁
      fetchTransactions(page);
    } catch (err) {
      console.error('Add points failed:', err);
      setMessage('❌ 網路錯誤或伺服器無響應');
    } finally {
      setBusy(false);
    }
  }

  // 顯示統計
  const totalDelta = useMemo(
    () => transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [transactions]
  );

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        ⏳ 載入中...
      </div>
    );
  }
  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        🚫 無權訪問。
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">👑 管理員後台</h1>

      <nav className="mb-4 space-x-4 text-sm text-blue-600">
        <Link href="/admin">🏠 主控台</Link>
        <Link href="/admin/topup-submissions">📤 查看付款上傳</Link>
        <Link href="/admin/transactions">📊 所有交易紀錄</Link>
      </nav>

      {/* 加點工具 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">➕ 加點工具</h2>
        <Input
          placeholder="使用者 Email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          type="email"
        />
        <Input
          placeholder="加幾點？"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          type="number"
        />
        <div className="flex gap-2">
          <Button onClick={handleAddPoints} disabled={busy} className="flex-1">
            {busy ? '處理中...' : '➕ 加點'}
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchTransactions(1)}
            disabled={busy}
          >
            {busy ? '查詢中...' : '🔄 查詢紀錄'}
          </Button>
        </div>
      </section>

      {message && (
        <p
          className={`text-sm text-center ${
            message.startsWith('✅') ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message}
        </p>
      )}

      {/* 簡單統計 */}
      <div className="text-sm text-gray-600">
        本頁 {transactions.length} 筆，合計變動：{totalDelta} 點
      </div>

      {/* 交易清單 */}
      <section>
        <ul className="text-sm space-y-2">
          {transactions.map((tx) => {
            const emailShown =
              tx.user?.email ?? (email || '(未知 Email)');
            const created =
              typeof tx.createdAt === 'string'
                ? new Date(tx.createdAt)
                : tx.createdAt;
            return (
              <li key={tx.id} className="border rounded p-2 bg-gray-50">
                ✉️ {emailShown} — 💰 {tx.amount} 點 —{' '}
                {tx.type || (tx.isFirstTopUp ? '首充' : '加值')}{' '}
                {tx.description ? `(${tx.description})` : ''} —{' '}
                {created ? created.toLocaleString() : '-'}
              </li>
            );
          })}
          {transactions.length === 0 && (
            <li className="text-gray-400">尚無紀錄</li>
          )}
        </ul>

        {/* 分頁 */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            disabled={busy || page <= 1}
            onClick={() => fetchTransactions(page - 1)}
          >
            ◀︎ 上一頁
          </Button>
          <span className="text-sm text-gray-600">第 {page} 頁</span>
          <Button
            variant="outline"
            disabled={busy || !hasMore}
            onClick={() => fetchTransactions(page + 1)}
          >
            下一頁 ▶︎
          </Button>
        </div>
      </section>
    </div>
  );
}
