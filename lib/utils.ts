// lib/utils.ts

/**
 * 合併 className 工具函式
 * 範例：cn("btn", isActive && "active", isDisabled && "opacity-50")
 */
export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
