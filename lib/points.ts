/* lib/points.ts */

/** 各步驟每種模式要花的點數 */
export const MODE_COST = {
  outline:  { free: 0, flash: 3 },
  draft:    { free: 0, pro: 6 },
  feedback: { free: 0, flash: 3 },
  rewrite:  { free: 0, pro: 6 },
  final:    { free: 0, undetectable: 6 },
} as const;

export type StepName = keyof typeof MODE_COST;
/** 若之後你要更嚴格，可用：export type ModeName<S extends StepName> = keyof typeof MODE_COST[S]; */

/** 這裡把 union map 強轉成 Record<string, number>，解決「Element implicitly has an 'any' type」的錯誤 */
export function getCost(step: StepName, mode: string): number {
  const map = MODE_COST[step] as Record<string, number>;
  return map[mode] ?? 0;
}
