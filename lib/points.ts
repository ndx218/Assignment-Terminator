// lib/points.ts
export const MODE_COST = {
  outline : { free: 0, flash: 3 },
  draft   : { free: 0, pro  : 6 },
  feedback: { free: 0, flash: 3 },
  rewrite : { free: 0, pro  : 6 },
  final   : { free: 0, undetectable: 6 }
} as const;
export type StepName = keyof typeof MODE_COST;
export type ModeName<S extends StepName> = keyof typeof MODE_COST[S];
export function getCost(step: StepName, mode: string) {
  return MODE_COST[step as StepName][mode as any] ?? 0;
}
