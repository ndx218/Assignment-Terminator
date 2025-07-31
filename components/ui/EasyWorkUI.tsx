/* components/ui/EasyWorkUI.tsx – TS 5.x + Next 13.4 */
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
  useCredits,
  useSpend,
  useSetCredits,
} from "@/hooks/usePointStore";

/* ---------------- 常量 ---------------- */
const steps: Array<{ key: StepName; label: string }> = [
  { key: "outline", label: "📑 大綱產生器" },
  { key: "draft", label: "✍️ 初稿" },
  { key: "feedback", label: "🧑‍🏫 教師評論" },
  { key: "rewrite", label: "📝 修訂稿" },
  { key: "final", label: "🤖 最終版本" },
];

type ModeState = {
  outline: "free" | "flash";
  draft: "free" | "pro";
  feedback: "free" | "flash";
  rewrite: "free" | "pro";
  final: "free" | "undetectable";
};

type Payload = Record<string, unknown>;

/* ==================================================================== */
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

  /* ----------- 結果 / 其他 state ----------- */
  const [results, setResults] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [references, setReferences] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(false);

  /* ----------- Loading ----------- */
  const [loading, setLoading] = useState<Record<StepName, boolean>>({
    outline: false,
    draft: false,
    feedback: false,
    rewrite: false,
    final: false,
  });

  /* ----------- 點數 ----------- */
  const credits = useCredits();
  const spend = useSpend();
  const setCredits = useSetCredits();

  /* ----------- 模式 ----------- */
  const [mode, setMode] = useState<ModeState>({
    outline: "free",
    draft: "free",
    feedback: "free",
    rewrite: "free",
    final: "free",
  });

  /* 送 API 前後流程 ---------------------------------------------------- */
  async function callStep(
    step: StepName,
    endpoint: string,
    body: Payload = {}
  ) {
    const cost = getCost(step, mode[step]);
    if (cost > 0 && credits < cost) {
      alert("點數不足，請先充值或切回免費模式");
      return;
    }

    setLoading((l) => ({ ...l, [step]: true }));
    try {
      const payload: Payload = { ...body, mode: mode[step] };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || "伺服器回傳錯誤");

      /* ---------- 解析回傳 ---------- */
      const text: string =
        data.outline ??
        data.draft ??
        data.feedback ??
        data.rewrite ??
        data.result ??
        "";

      /* 若是大綱，記錄 outlineId & 清 refs */
      if (step === "outline" && data.outlineId) {
        setOutlineId(data.outlineId);
        setReferences([]);
      }

      /* 扣點 */
      if (cost > 0) spend(cost);

      setResults((r) => ({ ...r, [step]: text }));
    } catch (e) {
      alert("❌ " + (e as Error).message);
    } finally {
      setLoading((l) => ({ ...l, [step]: false }));
    }
  }

  /* ---------- 產生引用 ---------- */
  async function generateReferences() {
    if (!outlineId) return;
    setRefLoading(true);
    try {
      const r = await fetch("/api/references/gather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlineId }),
      }).then((x) => x.json());

      if (r.error) throw new Error(r.error);
      if (typeof r.remainingCredits === "number") setCredits(r.remainingCredits);
      setReferences(r.saved || []);
      alert(`🎉 已新增 ${r.spent} 筆引用！`);
    } catch (e: any) {
      alert("❌ " + e.message);
    } finally {
      setRefLoading(false);
    }
  }

  /* ========================== 畫面 ========================== */
  return (
    <div className="flex flex-col h-screen">
      {/* --------- 頂欄 --------- */}
      <div className="w-full bg-green-50 border-b border-green-200 px-4 py-2 text-sm flex justify-between items-center">
        <div>
          👤 <span className="font-medium">{session?.user?.email}</span>
          {" ｜ 目前剩餘 "}
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
        {/* -------- 左：設定 + 按鈕 -------- */}
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
          ).map((f) => (
            <Input
              key={f}
              placeholder={f}
              className="mb-2 w-full"
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
            />
          ))}

          {/* 語言 / Tone */}
          <select
            value={form.language}
            className="mb-2 w-full border rounded px-2 py-1"
            onChange={(e) => setForm({ ...form, language: e.target.value })}
          >
            <option value="中文">中文</option>
            <option value="英文">英文</option>
          </select>
          <select
            value={form.tone}
            className="mb-4 w-full border rounded px-2 py-1"
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
          >
            <option value="正式">正式</option>
            <option value="半正式">半正式</option>
            <option value="輕鬆">輕鬆</option>
          </select>

          <Textarea
            placeholder="內容細節"
            className="mb-4 w-full"
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
          />

          {/* -------- 各步驟 -------- */}
          <StepBlock
            step="outline"
            mode={mode.outline}
            loading={loading.outline}
            btnText="🧠 產生大綱"
            setMode={(v) =>
              setMode((m) => ({ ...m, outline: v as ModeState["outline"] }))
            }
            onClick={() => callStep("outline", "/api/outline", form)}
          />

          <StepBlock
            step="draft"
            mode={mode.draft}
            loading={loading.draft}
            btnText="✍️ 草稿產生"
            setMode={(v) =>
              setMode((m) => ({ ...m, draft: v as ModeState["draft"] }))
            }
            onClick={() =>
              callStep("draft", "/api/draft", {
                ...form,
                outline: results.outline,
              })
            }
          />

          <StepBlock
            step="feedback"
            mode={mode.feedback}
            loading={loading.feedback}
            btnText="🧑‍🏫 教師評論"
            setMode={(v) =>
              setMode((m) => ({ ...m, feedback: v as ModeState["feedback"] }))
            }
            onClick={() =>
              callStep("feedback", "/api/feedback", { text: results.draft })
            }
          />

          <StepBlock
            step="rewrite"
            mode={mode.rewrite}
            loading={loading.rewrite}
            btnText="📝 GPT-style 修訂"
            setMode={(v) =>
              setMode((m) => ({ ...m, rewrite: v as ModeState["rewrite"] }))
            }
            onClick={() =>
              callStep("rewrite", "/api/rewrite", { text: results.draft })
            }
          />

          <StepBlock
            step="final"
            mode={mode.final}
            loading={loading.final}
            btnText="🤖 最終人性化優化"
            setMode={(v) =>
              setMode((m) => ({ ...m, final: v as ModeState["final"] }))
            }
            onClick={() =>
              callStep("final", "/api/undetectable", { text: results.rewrite })
            }
          />
        </div>

        {/* -------- 右：結果 -------- */}
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
                    className="whitespace-pre-wrap mb-2 w-full !h-[75vh] overflow-auto resize-none"
                    value={results[key] || ""}
                    onChange={(e) =>
                      setResults((r) => ({ ...r, [key]: e.target.value }))
                    }
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

                  {/* -------- Outline 面板：產生參考文獻 -------- */}
                  {key === "outline" && outlineId && (
                    <div className="mt-4">
                      <Button
                        isLoading={refLoading}
                        className="bg-purple-600 text-white"
                        onClick={generateReferences}
                      >
                        🔗 產生參考文獻
                      </Button>

                      {references.length > 0 && (
                        <ul className="mt-3 space-y-1 text-sm">
                          {references.map((ref, i) => (
                            <li key={i} className="break-all">
                              <span className="font-medium">
                                {ref.sectionKey}
                              </span>{" "}
                              · {ref.title}{" "}
                              <a
                                href={ref.url}
                                target="_blank"
                                className="text-blue-600 underline"
                              >
                                link
                              </a>
                              {ref.source ? ` · ${ref.source}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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

/* =============================================================== */
interface StepBlockProps {
  step: StepName;
  mode: string;
  loading: boolean;
  btnText: string;
  setMode: (v: string) => void;
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
      <ModeSelect step={step} value={mode} onChange={(v) => setMode(v)} />
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

interface ModeSelectProps {
  step: StepName;
  value: string;
  onChange: (v: string) => void;
}
function ModeSelect({ step, value, onChange }: ModeSelectProps) {
  const credits = useCredits();
  const costMap = MODE_COST[step] as Record<string, number>;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mb-1 w-full border rounded px-2 py-1 text-sm"
    >
      {Object.entries(costMap).map(([m, c]) => (
        <option key={m} value={m} disabled={c > 0 && credits < c}>
          {modeLabel(m)} {c > 0 ? `(+${c} 點)` : "(0 點)"}
          {c > 0 && credits < c ? " — 點數不足" : ""}
        </option>
      ))}
    </select>
  );
}

const modeLabel = (m: string) =>
  ({
    free: "GPT-3.5",
    flash: "Gemini Flash",
    pro: "Gemini Pro",
    undetectable: "Undetectable",
  } as Record<string, string>)[m] ?? m;
