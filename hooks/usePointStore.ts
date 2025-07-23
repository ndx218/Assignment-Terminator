/* hooks/usePointStore.ts */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ------------ state 介面 ------------ */
export interface PointState {
  credits: number;              // 當前點數
  set:   (n: number) => void;   // 直接設置
  add:   (n: number) => void;   // 增加
  spend: (n: number) => void;   // 扣除（自帶下限 0）
  has:   (need: number) => boolean; // 是否足夠
}

/* ------------ store 本體 ------------ */
export const usePointStore = create<PointState>()(
  persist(
    (set, get) => ({
      credits: 0,

      set: (n) => set({ credits: Math.max(0, n) }),

      add: (n) =>
        set((s) => ({ credits: Math.max(0, s.credits + n) })),

      spend: (n) =>
        set((s) => ({ credits: Math.max(0, s.credits - n) })),

      has: (need) => get().credits >= need,
    }),
    { name: 'user_points' } // <- localStorage key
  )
);

/* ------------ Selector helpers ------------ */
/** 直接取得點數 */
export const useCredits = () => usePointStore((s) => s.credits);
/** 扣點函式 */
export const useSpend   = () => usePointStore((s) => s.spend);
/** 判斷餘額是否足夠 */
export const useHasCredits = () => usePointStore((s) => s.has);
