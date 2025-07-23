/* components/ui/EasyWorkUI.tsx
   完整可編譯版本（TS 5.x + Next 13.4） */

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

import { MODE_COST, getCost, type StepName } from "@/lib/points";
import {
  usePointStore,
  type PointState,
} from "@/hooks/usePointStore";

/* ---------------- 常量 ---------------- */
const steps = [
  { key: "outline",   label: "📑 大綱產生器" },
  { key: "draft",     label: "✍️ 初稿" },
  { key: "feedback",  label: "🧑‍🏫 教師評論" },
  { key: "rewrite",   label: "📝 修訂稿" },
  { key: "final",     label: "🤖 最終版本" },
] as const satisfies readonly { key: StepName; label: string }[];

type ModeState = {
  outline: "free" | "flash";
  draft: "free" | "pro";
  feedback: "free" | "flash";
  rewrite: "free" | "pro";
  final: "free" | "undetectable";
};

/* ---------------- 主元件 ---------------- */
export default function EasyWorkUI() {
  const { data: session } = useSession();

  /* ----------- 表單 ----------- */
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

  /* ----------- 結果 / 複製指示 ----------- */
  const [results, setResults] = useState<Record<string, string>>({});
  const [copied, setCopied]   = useState<Record<string, boolean>>({});

  /* ----------- Loading ----------- */
  const [loading, setLoading] = useState<Record<StepName, boolean>>({
    outline: false,
    draft: false,
    feedback: false,
    rewrite: false,
    final: false,
  });

  /* ----------- 點數 ----------- */
  const credits = usePointStore<PointState>((s) => s.credits);
  const spend   = usePointStore<PointState>((s) => s.spend);

  /* ----------- 模式 ----------- */
  const [mode, setMode] = useState<ModeState>({
    outline: "free",
    draft: "free",
    feedback: "free",
    rewrite: "free",
    final: "free",
  });

  /* ======================================================= */
  /* 送 API 之前：檢查點數、扣點、發送；成功後更新結果              */
  /* ======================================================= */
  async function callStep(step: StepName, endpoint: string, body: unknown) {
    const cost = getCost(step, mode[step]);
    if (cost > 0 && credits < cost) {
      alert("點數不足，請先充值或切回免費模式");
      return;
    }

    setLoading((l) => ({ ...l, [step]: true }));
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, mode: mode[step] }),
      });

      const data  = await res.json();
      if (!res.ok) throw new Error(data.error || "伺服器回傳錯誤");

      const text: string =
        data.outline   ||
        data.draft     ||
        data.feedback  ||
        data.rewrite   ||
        data.result    ||
        "";

      if (cost > 0) spend(cost);
      setResults((r) => ({ ...r, [step]: text }));
    } catch (e: unknown) {
      alert("❌ " + (e as Error).message);
    } finally {
      setLoading((l) => ({ ...l, [step]: false }));
    }
  }

  /* ---------------- Render ---------------- */
  return (
    <div className="flex flex-col h-screen">
      {/* --------- 頂欄 --------- */}
      <div className="w-full bg-green-50 border-b border-green-200 px-4 py-2 text-sm flex justify-between items-center">
        <div>
          👤 <span className="font-medium">{session?.user?.email}</span> ｜ 目前剩餘{" "}
          <span className="font-bold text-blue-600">{credits}</span> 點
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

      <div className="flex flex-1">
        {/* ================= 左欄 ================= */}
        <div className="w-72 border-r p-4 bg-gray-50 overflow-y-auto">
          <h2 className="font-bold text-lg mb-4">📚 功課設定</h2>

          {(
            ["name","school","title","wordCount","reference","rubric","paragraph"] as const
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
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            className="mb-2 w-full border rounded px-2 py-1"
          >
            <option value="中文">中文</option>
            <option value="英文">英文</option>
          </select>
          <select
            name="tone"
            value={form.tone}
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
            className="mb-4 w-full border rounded px-2 py-1"
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

          {/* --------- 各步驟按鈕 + 切換 --------- */}
          <StepBlock
            step="outline"
            mode={mode.outline}
            setMode={(v) => setMode((m) => ({ ...m, outline: v }))}
            loading={loading.outline}
            btnText="🧠 產生大綱"
            onClick={() => callStep("outline", "/api/outline", form)}
          />

          <StepBlock
            step="draft"
            mode={mode.draft}
            setMode={(v) => setMode((m) => ({ ...m, draft: v }))}
            loading={loading.draft}
            btnText="✍️ 草稿產生"
            onClick={() => callStep("draft", "/api/draft", { ...form, outline: results.outline })}
          />

          <StepBlock
            step="feedback"
            mode={mode.feedback}
            setMode={(v) => setMode((m) => ({ ...m, feedback: v }))}
            loading={loading.feedback}
            btnText="🧑‍🏫 教師評論"
            onClick={() => callStep("feedback", "/api/feedback", { text: results.draft })}
          />

          <StepBlock
            step="rewrite"
            mode={mode.rewrite}
            setMode={(v) => setMode((m) => ({ ...m, rewrite: v }))}
            loading={loading.rewrite}
            btnText="📝 GPT‑style 修訂"
            onClick={() => callStep("rewrite", "/api/rewrite", { text: results.draft })}
          />

          <StepBlock
            step="final"
            mode={mode.final}
            setMode={(v) => setMode((m) => ({ ...m, final: v }))}
            loading={loading.final}
            btnText="🤖 最終人性化優化"
            onClick={() => callStep("final", "/api/undetectable", { text: results.rewrite })}
          />
        </div>

        {/* ================= 右欄 ================= */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="outline">
            <TabsList>
              {steps.map(({ key, label }) => (
                <TabsTrigger key={key} value={key}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {steps.map(({ key, label }) => (
              <TabsContent key={key} value={key}>
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
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute bottom-2 right-4"
                        onClick={() => {
                          navigator.clipboard.writeText(results[key]);
                          setCopied({ [key]: true });
                          setTimeout(() => setCopied({}), 1800);
                        }}
                      >
                        📋 複製
                      </Button>
                      {copied[key] && (
                        <span className="absolute bottom-2 right-20 text-green-600 text-sm">
                          ✅ 已複製！
                        </span>
                      )}
                    </>
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

/* ------------- ⬇️ 抽出的小元件 ------------- */
interface StepBlockProps {
  step: StepName;
  mode: string;
  setMode: (v: ModeState[keyof ModeState]) => void;
  loading: boolean;
  btnText: string;
  onClick: () => void;
}
function StepBlock({
  step,
  mode,
  setMode,
  loading,
  btnText,
  onClick,
}: StepBlockProps) {
  return (
    <>
      <ModeSelect step={step} value={mode} onChange={(v) => setMode(v as any)} />
      <Button
        isLoading={loading}
        onClick={onClick}
        className="w-full bg-blue-500 text-white mb-3"
      >
        {btnText}
      </Button>
    </>
  );
}

/* --------- 下拉選單 (共用) --------- */
interface ModeSelectProps {
  step: StepName;
  value: string;
  onChange: (v: string) => void;
}
function ModeSelect({ step, value, onChange }: ModeSelectProps) {
  const credits = usePointStore<PointState>((s) => s.credits);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mb-1 w-full border rounded px-2 py-1 text-sm"
    >
      {Object.entries(MODE_COST[step]).map(([m, c]) => (
        <option key={m} value={m} disabled={c > 0 && credits < c}>
          {modeLabel(m)} {c > 0 ? `(+${c} 點)` : "(0 點)"}
          {c > 0 && credits < c ? " — 點數不足" : ""}
        </option>
      ))}
    </select>
  );
}
function modeLabel(m: string) {
  return (
    {
      free: "GPT‑3.5",
      flash: "Gemini Flash",
      pro: "Gemini Pro",
      undetectable: "Undetectable",
    } as Record<string, string>
  )[m] ?? m;
}
