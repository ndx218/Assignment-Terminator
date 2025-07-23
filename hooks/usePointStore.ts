/* hooks/usePointStore.ts */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ------------ state 介面 ------------ */
export interface PointState {
  credits: number;                    // 目前點數
  set:   (n: number) => void;         // 直接設置
  add:   (n: number) => void;         // 加點
  spend: (n: number) => void;         // 扣點（下限 0）
  has:   (need: number) => boolean;   // 判斷是否足夠
}

/* ------------ store 本體 ------------ */
export const usePointStore = create<PointState>()(
  persist(
    (set, get) => ({
      credits: 0,

      set: (n) => set({ credits: Math.max(0, n) }),

      add: (n) => set((s) => ({ credits: Math.max(0, s.credits + n) })),

      spend: (n) => set((s) => ({ credits: Math.max(0, s.credits - n) })),

      has: (need) => get().credits >= need,
    }),
    { name: "user_points" }   // ← localStorage key
  )
);

/* ------------ Selector helpers ------------ */
export const useCredits      = () => usePointStore((s) => s.credits);
export const useSpend        = () => usePointStore((s) => s.spend);
export const useHasCredits   = () => usePointStore((s) => s.has);
