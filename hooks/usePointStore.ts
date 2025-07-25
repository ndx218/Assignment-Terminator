"use client";

import { create } from "zustand";
import {
  persist,
  createJSONStorage,
  StateStorage,
} from "zustand/middleware";

/* ------------ state 介面 ------------ */
export interface PointState {
  credits: number;                    // 目前點數
  set:   (n: number) => void;         // 直接設置
  add:   (n: number) => void;         // 加點
  spend: (n: number) => void;         // 扣點（下限 0）
  has:   (need: number) => boolean;   // 判斷是否足夠
}

/** 在沒有 window（SSR / build）時用的假 storage，避免型別報錯 */
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

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
    {
      name: "user_points",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage
      ),
      // 可選：避免 hydration 警告
      // skipHydration: true,
    }
  )
);

/* ------------ Selector helpers（記得也 export set） ------------ */
export const useCredits      = () => usePointStore((s) => s.credits);
export const useSpend        = () => usePointStore((s) => s.spend);
export const useHasCredits   = () => usePointStore((s) => s.has);
export const useSetCredits   = () => usePointStore((s) => s.set);
