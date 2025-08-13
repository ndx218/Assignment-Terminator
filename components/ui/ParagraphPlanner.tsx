// components/ui/ParagraphPlanner.tsx
"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ParagraphPlan = {
  intro?: number;               // 引言字數
  bodyCount: number;            // 主體段數
  body: number[];               // 各主體段字數
  conclusion?: number;          // 結論字數
  bodyTitles?: string[];        // （可選）各主體段標題
};

export default function ParagraphPlanner({
  totalWords,
  value,
  onChange,
  language = "中文",
}: {
  totalWords: number;
  value: ParagraphPlan;
  onChange: (v: ParagraphPlan) => void;
  language?: string;
}) {
  const isZH = /中|中文|zh/i.test(language);

  const sum = useMemo(
    () =>
      (value.intro || 0) +
      value.body.reduce((a, b) => a + (b || 0), 0) +
      (value.conclusion || 0),
    [value]
  );

  function setBodyCount(n: number) {
    const next = { ...value };
    next.bodyCount = Math.max(1, Math.min(8, Math.floor(n || 1)));
    // 調整 body & 標題長度
    while (next.body.length < next.bodyCount) next.body.push(0);
    next.body = next.body.slice(0, next.bodyCount);
    if (next.bodyTitles) {
      while (next.bodyTitles.length < next.bodyCount) next.bodyTitles.push("");
      next.bodyTitles = next.bodyTitles.slice(0, next.bodyCount);
    }
    onChange(next);
  }

  function autoDistribute() {
    const introW = Math.round(totalWords * 0.14 / 10) * 10;
    const conclW = Math.round(totalWords * 0.14 / 10) * 10;
    const remain = Math.max(0, totalWords - introW - conclW);
    const per = value.bodyCount > 0 ? Math.round(remain / value.bodyCount / 10) * 10 : 0;
    onChange({
      ...value,
      intro: Math.max(50, introW),
      body: Array.from({ length: value.bodyCount }, () => Math.max(50, per)),
      conclusion: Math.max(50, conclW),
    });
  }

  function balanceBodies() {
    const totalBody = value.body.reduce((a, b) => a + (b || 0), 0);
    const per = value.bodyCount > 0 ? Math.round(totalBody / value.bodyCount / 10) * 10 : 0;
    onChange({
      ...value,
      body: Array.from({ length: value.bodyCount }, () => Math.max(50, per)),
    });
  }

  return (
    <div className="mb-4 rounded border p-3 bg-white">
      <div className="text-sm font-semibold mb-2">
        {isZH ? "🧭 段落規劃器" : "Paragraph planner"}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="text-sm">
          {isZH ? "引言字數" : "Intro words"}
          <Input
            type="number"
            min={0}
            value={value.intro ?? 0}
            onChange={(e) =>
              onChange({ ...value, intro: Math.max(0, parseInt(e.target.value || "0", 10)) })
            }
          />
        </label>

        <label className="text-sm">
          {isZH ? "主體段數" : "Body count"}
          <Input
            type="number"
            min={1}
            max={8}
            value={value.bodyCount}
            onChange={(e) => setBodyCount(parseInt(e.target.value || "1", 10))}
          />
        </label>
      </div>

      <div className="space-y-2 mb-2">
        {Array.from({ length: value.bodyCount }).map((_, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              {(isZH ? "主體段" : "Body") + (i + 1) + (isZH ? " 標題（選填）" : " title (optional)")}
              <Input
                value={(value.bodyTitles?.[i] ?? "")}
                placeholder={isZH ? "例如：定義與範疇" : "e.g., Definitions & scope"}
                onChange={(e) => {
                  const titles = (value.bodyTitles ?? []).slice();
                  while (titles.length < value.bodyCount) titles.push("");
                  titles[i] = e.target.value;
                  onChange({ ...value, bodyTitles: titles });
                }}
              />
            </label>
            <label className="text-sm">
              {isZH ? "字數" : "Words"}
              <Input
                type="number"
                min={0}
                value={value.body[i] ?? 0}
                onChange={(e) => {
                  const body = value.body.slice();
                  while (body.length < value.bodyCount) body.push(0);
                  body[i] = Math.max(0, parseInt(e.target.value || "0", 10));
                  onChange({ ...value, body });
                }}
              />
            </label>
          </div>
        ))}
      </div>

      <label className="text-sm block mb-2">
        {isZH ? "結論字數" : "Conclusion words"}
        <Input
          type="number"
          min={0}
          value={value.conclusion ?? 0}
          onChange={(e) =>
            onChange({ ...value, conclusion: Math.max(0, parseInt(e.target.value || "0", 10)) })
          }
        />
      </label>

      <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
        <span>
          {isZH ? "目前合計：" : "Current sum:"} {sum} / {totalWords}
        </span>
        {sum !== totalWords && (
          <span className="text-amber-600">
            {isZH ? "建議：總字數與目標不一致" : "Tip: not matching target words"}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={autoDistribute}>
          {isZH ? "按比例自動分配" : "Auto distribute"}
        </Button>
        <Button type="button" variant="outline" onClick={balanceBodies}>
          {isZH ? "主體平均" : "Balance bodies"}
        </Button>
      </div>
    </div>
  );
}
