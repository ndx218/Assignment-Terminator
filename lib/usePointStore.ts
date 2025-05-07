// lib/usePointStore.ts
import { useEffect, useState } from 'react';

export function usePointStore() {
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('user_points');
    if (stored) setPoints(Number(stored));
  }, []);

  const updatePoints = (value: number) => {
    const newPoints = Math.max(value, 0);
    setPoints(newPoints);
    localStorage.setItem('user_points', String(newPoints));
  };

  const hasEnough = (cost: number) => points >= cost;

  const deduct = (cost: number) => {
    if (!hasEnough(cost)) return false;
    updatePoints(points - cost);
    return true;
  };

  const add = (amount: number) => updatePoints(points + amount);

  return {
    points,
    hasEnough,
    deduct,
    add,
    setPoints: updatePoints, // ✅ 額外暴露出來
  };
}
