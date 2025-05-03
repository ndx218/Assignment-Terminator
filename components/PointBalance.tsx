// components/PointBalance.tsx
import { usePointStore } from '@/lib/usePointStore';

export default function PointBalance() {
  const { points } = usePointStore();

  return (
    <div className="fixed top-4 right-4 bg-yellow-100 text-yellow-800 px-4 py-2 rounded shadow">
      🪙 目前點數：<strong>{points}</strong>
    </div>
  );
}
