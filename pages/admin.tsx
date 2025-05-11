// ✅ /pages/admin.tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddPoints = async () => {
    if (!email || !amount) return alert('請填寫 Email 和 點數');

    setLoading(true);
    setMessage('');
    const res = await fetch('/api/admin/add-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount: Number(amount) }),
    });

    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMessage(`✅ ${data.message}`);
    } else {
      setMessage(`❌ 錯誤：${data.error}`);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">👑 管理員加點工具</h1>
      <Input placeholder="使用者 Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="要加幾點？" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
      <Button onClick={handleAddPoints} isLoading={loading} className="w-full">
        ➕ 加點
      </Button>
      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}
