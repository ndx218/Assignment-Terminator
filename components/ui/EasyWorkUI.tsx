// components/EasyWorkUI.tsx
"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import Textarea from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { MODE_COST, getCost, StepName } from "@/lib/points";
import { usePointStore } from "@/hooks/usePointStore";

/* --------------------- 常量 --------------------- */
const steps = [
  { key: "outline", label: "📑 大綱產生器" },
  { key: "draft", label: "✍️ 初稿" },
  { key: "feedback", label: "🧑‍🏫 教師評論" },
  { key: "rewrite", label: "📝 修訂稿" },
  { key: "final", label: "🤖 最終版本" },
] as const;

type ModeState = {
  outline: "free" | "flash";
  draft: "free" | "pro";
  feedback: "free" | "flash";
  rewrite: "free" | "pro";
  final: "free" | "undetectable";
};

/* ------------------ 主元件 ------------------ */
export default function EasyWorkUI() {
  const { data: session } = useSession();

  /* ----------- 表單資料 ----------- */
  const [form, setForm] = useState({
    name: "",
    school: "",
    title: "",
    wordCount: "",
    language: "中文",
    tone: "正式",
    detail: "",
    reference: "",
    rubric: "",
    paragraph: "",
  });

  /* ----------- 內容結果 ----------- */
  const [results, setResults] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  /* ----------- 載入狀態 ----------- */
  const [loading, setLoading] = useState<Record<StepName, boolean>>({
    outline: false,
    draft: false,
    feedback: false,
    rewrite: false,
    final: false,
  } as any);

  /* ----------- 點數 ----------- */
  const credits = usePointStore((s) => s.credits);
  const spend = usePointStore((s) => s.spend);

  /* ----------- 模式狀態 ----------- */
  const [mode, setMode] = useState<ModeState>({
    outline: "free",
    draft: "free",
    feedback: "free",
    rewrite: "free",
    final: "free",
  });

  /* ===================================================== */
  /*  送 API 之前：檢查點數、扣點、發送；成功後更新結果            */
  /* ===================================================== */
  async function callStep(
    step: StepName,
    endpoint: string,
    body: any
  ) {
    const cost = getCost(step, mode[step]);
    if (cost > 0 && credits < cost) return alert("點數不足，請先充值或切回免費模式");

    setLoading((l) => ({ ...l, [step]: true }));
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, mode: mode[step] }),
      });
      const data = await res.json();
      const text =
        data.outline ||
        data.draft ||
        data.feedback ||
        data.rewrite ||
        data.result ||
        "";

      if (!res.ok) throw new Error(data.error || "伺服器回傳錯誤");

      // 成功 → 扣點、寫結果
      if (cost > 0) spend(cost);
      setResults((r) => ({ ...r, [step]: text }));
    } catch (e: any) {
      alert("❌ " + e.message);
    } finally {
      setLoading((l) => ({ ...l, [step]: false }));
    }
  }

  /* ------------------ UI ------------------ */
  return (
    <div className="flex flex-col h-screen">
      {/* -------------- 頂欄 -------------- */}
      <div className="w-full bg-green-50 border-b border-green-200 px-4 py-2 text-sm flex justify-between items-center">
        <div>
          👤 <span className="font-medium">{session?.user?.email}</span> ｜
          目前剩餘 <span className="font-bold text-blue-600">{credits}</span> 點
        </div>
        <Button
          variant="ghost"
          className="text-red-600 hover:text-black px-2 py-1"
          onClick={() => {
            localStorage.removeItem("skipLogin");
            signOut({ callbackUrl: "/login" });
          }}
        >
          🚪 登出
        </Button>
      </div>

      {/* -------------- 主要畫面 -------------- */}
      <div className="flex flex-1">
        {/* --------- 左欄：設定 --------- */}
        <div className="w-72 border-r p-4 bg-gray-50 overflow-y-auto">
          <h2 className="font-bold text-lg mb-4">📚 功課設定</h2>
          {(
            [
              "name",
              "school",
              "title",
              "wordCount",
              "reference",
              "rubric",
              "paragraph",
            ] as const
          ).map((field) => (
            <Input
              key={field}
              name={field}
              placeholder={field}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="mb-2 w-full"
            />
          ))}

          {/* 語言 / Tone */}
          <select
            name="language"
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            className="mb-2 w-full border rounded px-2 py-1"
          >
            <option value="中文">中文</option>
            <option value="英文">英文</option>
          </select>
          <select
            name="tone"
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
            className="mb-2 w-full border rounded px-2 py-1"
          >
            <option value="正式">正式</option>
            <option value="半正式">半正式</option>
            <option value="輕鬆">輕鬆</option>
          </select>

          <Textarea
            name="detail"
            placeholder="內容細節"
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
            className="mb-4 w-full"
          />

          {/* ---------------- 每個步驟按鈕 ---------------- */}

          {/* ① 大綱產生 */}
          <ModeSelect
            step="outline"
            value={mode.outline}
            onChange={(v) => setMode((m) => ({ ...m, outline: v as any }))}
          />
          <Button
            isLoading={loading.outline}
            onClick={() => callStep("outline", "/api/outline", form)}
            className="w-full bg-blue-500 text-white mb-3"
          >
            🧠 產生大綱
          </Button>

          {/* ② 參考文獻整合 (可選) */}
          <ModeSelect
            step="feedback" // 借用 feedback cost (flash)
            value={mode.feedback}
            onChange={(v) => setMode((m) => ({ ...m, feedback: v as any }))}
            label="參考文獻模式"
          />

          {/* ③ 初稿產生 */}
          <ModeSelect
            step="draft"
            value={mode.draft}
            onChange={(v) => setMode((m) => ({ ...m, draft: v as any }))}
          />
          <Button
            isLoading={loading.draft}
            onClick={() =>
              callStep("draft", "/api/draft", { ...form, outline: results.outline })
            }
            className="w-full bg-blue-500 text-white mb-3"
          >
            ✍️ 草稿產生
          </Button>

          {/* ④ 教師評論 */}
          <ModeSelect
            step="feedback"
            value={mode.feedback}
            onChange={(v) => setMode((m) => ({ ...m, feedback: v as any }))}
          />
          <Button
            isLoading={loading.feedback}
            onClick={() =>
              callStep("feedback", "/api/feedback", { text: results.draft })
            }
            className="w-full bg-yellow-500 text-black mb-3"
          >
            🧑‍🏫 教師評論
          </Button>

          {/* ⑤ 修訂稿 */}
          <ModeSelect
            step="rewrite"
            value={mode.rewrite}
            onChange={(v) => setMode((m) => ({ ...m, rewrite: v as any }))}
          />
          <Button
            isLoading={loading.rewrite}
            onClick={() =>
              callStep("rewrite", "/api/rewrite", { text: results.draft })
            }
            className="w-full bg-green-600 text-white mb-3"
          >
            📝 GPT‑style 修訂
          </Button>

          {/* ⑥ 最終人性化 */}
          <ModeSelect
            step="final"
            value={mode.final}
            onChange={(v) => setMode((m) => ({ ...m, final: v as any }))}
          />
          <Button
            isLoading={loading.final}
            onClick={() =>
              callStep("final", "/api/undetectable", { text: results.rewrite })
            }
            className="w-full bg-gray-800 text-white"
          >
            🤖 最終人性化優化
          </Button>
        </div>

        {/* --------- 右欄：結果 --------- */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="outline">
            <TabsList>
              {steps.map((s) => (
                <TabsTrigger key={s.key} value={s.key as any}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {steps.map(({ key, label }) => (
              <TabsContent key={key} value={key as any}>
                <Card className="p-4 mt-4 bg-gray-50 relative">
                  <h3 className="font-semibold mb-2">{label}：</h3>
                  <Textarea
                    rows={1}
                    value={results[key] || ""}
                    onChange={(e) =>
                      setResults((r) => ({ ...r, [key]: e.target.value }))
                    }
                    className="whitespace-pre-wrap mb-2 w-full !h-[75vh] overflow-auto resize-none"
                  />
                  {results[key] && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute bottom-2 right-4"
                      onClick={() => {
                        navigator.clipboard.writeText(results[key]);
                        setCopied({ [key]: true });
                        setTimeout(() => setCopied({}), 2000);
                      }}
                    >
                      📋 複製
                    </Button>
                  )}
                  {copied[key] && (
                    <span className="absolute bottom-2 right-20 text-green-500 text-sm">
                      ✅ 已複製！
                    </span>
                  )}
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

/* ----------------- 子元件：模式下拉 ----------------- */
interface ModeSelectProps {
  step: StepName;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}
function ModeSelect({ step, value, onChange, label }: ModeSelectProps) {
  const credits = usePointStore((s) => s.credits);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mb-1 w-full border rounded px-2 py-1 text-sm"
    >
      {/* 列出該步驟所有可用模式 */}
      {Object.entries(MODE_COST[step]).map(([m, c]) => (
        <option key={m} value={m} disabled={c > 0 && credits < c}>
          {label ? label + "：" : ""}
          {m === "free" ? `GPT‑3.5 (0 點)` : modeLabel(m) + ` (+${c} 點)`}
          {c > 0 && credits < c ? " — 點數不足" : ""}
        </option>
      ))}
    </select>
  );
}
function modeLabel(m: string) {
  return m === "flash"
    ? "Gemini Flash"
    : m === "pro"
    ? "Gemini Pro"
    : m === "undetectable"
    ? "Undetectable"
    : m;
}
