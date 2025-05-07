'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ReferralCodeFormProps {
  userId: string;
  disabled?: boolean;
}

export default function ReferralCodeForm({ userId, disabled }: ReferralCodeFormProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) {
      toast.error('請輸入推薦碼');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/apply-referral-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, referralCode: code }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('推薦碼已成功綁定！');
      } else {
        toast.error(data.error || '綁定失敗');
      }
    } catch (err) {
      toast.error('系統錯誤，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="輸入推薦碼"
        disabled={disabled || isSubmitting}
        className="w-[180px]"
      />
      <Button onClick={handleApply} isLoading={isSubmitting} disabled={disabled}>
        使用推薦碼
      </Button>
    </div>
  );
}
