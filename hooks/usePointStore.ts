import { create } from 'zustand';

/** 把 state 介面 export 出來，其他檔案就能拿來注解 */
export interface PointState {
  credits: number;
  set: (n: number) => void;
  has: (need: number) => boolean;
  spend: (cost: number) => void;
}

export const usePointStore = create<PointState>()((set, get) => ({
  credits: 0,
  set: (n) => set({ credits: n }),
  has: (need) => get().credits >= need,
  spend: (c) => set((s) => ({ credits: s.credits - c })),
}));
