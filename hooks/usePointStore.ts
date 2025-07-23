// hooks/usePointStore.ts
import { create } from 'zustand';

interface PointState {
  credits: number;
  set   : (n: number) => void;
  has   : (need: number) => boolean;   // NEW
  spend : (cost: number) => void;      // NEW
}
export const usePointStore = create<PointState>()((set, get) => ({
  credits: 0,
  set : (n) => set({ credits: n }),
  has : (need) => get().credits >= need,
  spend: (c)  => set(s => ({ credits: s.credits - c }))
}));
