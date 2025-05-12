// ✅ /pages/admin.tsx
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

    const res = await fetch('/api/admin/add-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount: Number(points) }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMessage(`✅ 已成功加點：${data.message}`);
    } else {
      setMessage(`❌ 錯誤：${data.error}`);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">👑 管理員加點工具</h1>
      <Input placeholder="使用者 Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="加幾點？" value={points} onChange={(e) => setPoints(e.target.value)} type="number" />
      <Button onClick={handleAddPoints} isLoading={loading} className="w-full">
        ➕ 加點
      </Button>
      {message && <p className="mt-2 text-sm text-center">{message}</p>}
    </div>
  );
}
