// hooks/usePointStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface PointState {
  credits: number;
  setCredits: (n: number) => void;
  addCredits: (n: number) => void;
  spend: (n: number) => void;
  has: (need: number) => boolean;
}

export const usePointStore = create<PointState>()(
  persist(
    (set, get) => ({
      credits: 0,

      setCredits: (n) => set({ credits: Math.max(0, n) }),
      addCredits: (n) => set((s) => ({ credits: Math.max(0, s.credits + n) })),
      spend: (n) => set((s) => ({ credits: Math.max(0, s.credits - n) })),
      has: (need) => get().credits >= need,
    }),
    {
      name: "user_points",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : undefined
      ),
    }
  )
);

/** selectors */
export const useCredits = () => usePointStore((s) => s.credits);
export const useSpend = () => usePointStore((s) => s.spend);
export const useHasCredits = () => usePointStore((s) => s.has);
export const useSetCredits = () => usePointStore((s) => s.setCredits);
export const useAddCredits = () => usePointStore((s) => s.addCredits);
