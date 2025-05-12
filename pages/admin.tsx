'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [points, setPoints] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddPoints = async () => {
    if (!email || !points) {
      alert('請輸入 Email 和 點數');
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
        setMessage(`✅ 成功：已為 ${email} 加 ${points} 點`);
      } else {
        setMessage(`❌ 錯誤：${data.error}`);
      }
    } catch (err) {
      setLoading(false);
      setMessage('❌ 系統錯誤，請稍後再試');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">👑 管理員加點工具</h1>

      <Input
        placeholder="使用者 Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full"
      />

      <Input
        placeholder="加幾點？"
        type="number"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        className="w-full"
      />

      <Button onClick={handleAddPoints} isLoading={loading} className="w-full">
        ➕ 確認加點
      </Button>

      {message && (
        <p className="mt-2 text-sm text-center text-gray-700">{message}</p>
      )}
    </div>
  );
}
