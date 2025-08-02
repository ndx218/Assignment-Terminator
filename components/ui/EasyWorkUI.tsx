/* components/ui/EasyWorkUI.tsx – TS 5.x + Next 13.4 */
"use client";

import { useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import Textarea from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { MODE_COST, getCost, type StepName } from "@/lib/points";
import { useCredits, useSpend, useSetCredits } from "@/hooks/usePointStore";

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

/** 參考文獻型別（對應 /api/references/... 回傳） */
export type ReferenceItem = {
  id?: string;
  sectionKey: string;
  title: string;
  url: string;
  doi?: string | null;
  source?: string | null;
  authors?: string | null;
  publishedAt?: string | Date | null;
  type?: string | null;
  credibility?: number | null;
};

/* ---------- APA7 簡化格式（底部顯示/匯出用） ---------- */
function formatCitationAPA7(r: {
  authors?: string | null;
  publishedAt?: string | Date | null;
  title?: string;
  source?: string | null;
  doi?: string | null;
  url?: string | null;
}) {
  const year = r.publishedAt
    ? typeof r.publishedAt === "string"
      ? r.publishedAt.slice(0, 4)
      : String((r.publishedAt as Date).getFullYear())
    : "n.d.";
  const authors = r.authors ? r.authors + ". " : "";
  const title = r.title ? `${r.title}.` : "";
  const source = r.source ? ` ${r.source}.` : "";
  const tail = r.doi
    ? ` https://doi.org/${r.doi.replace(/^https?:\/\/(doi\.org\/)?/, "")}`
    : r.url
    ? ` ${r.url}`
    : "";
  return `${authors}(${year}). ${title}${source}${tail}`.replace(/\s+/g, " ").trim();
}

/* ---------- 把大綱字串切成「段落陣列」 ---------- */
type OutlineSection = { key: string; title: string; text: string; label: string };

function parseOutlineToSections(outline: string): OutlineSection[] {
  if (!outline) return [];
  const lines = outline.split(/\r?\n/).map((l) => l.trim());
  const sections: OutlineSection[] = [];

  const isHeader = (s: string) =>
    /^([一二三四五六七八九十]+、|[0-9]+\.)/.test(s);

  let current: OutlineSection | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (isHeader(line)) {
      const keyOnly = line.replace(/[、.].*$/, "").trim(); // 「一」或「1」
      const title = line.replace(/^([一二三四五六七八九十]+、|[0-9]+\.)\s*/, "").trim();
      if (current) sections.push(current);
      current = { key: keyOnly || String(sections.length + 1), title: title || keyOnly, text: "", label: line };
    } else if (current) {
      current.text += (current.text ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) {
    sections.push({ key: "I", title: "大綱", text: outline, label: "大綱" });
  }
  return sections.slice(0, 12);
}

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
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [refLoading, setRefLoading] = useState(false);

  /* ----------- Loading（僅對 StepName） ----------- */
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
  async function callStep(step: StepName, endpoint: string, body: Payload = {}) {
    const cost = getCost(step, (mode as any)[step]);
    if (cost > 0 && credits < cost) {
      alert("點數不足，請先充值或切回免費模式");
      return;
    }

    setLoading((l) => ({ ...l, [step]: true }));
    try {
      const payload: Payload = { ...body, mode: (mode as any)[step] };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || "伺服器回傳錯誤");

      const text: string =
        data.outline ??
        data.draft ??
        data.feedback ??
        data.rewrite ??
        data.result ??
        "";

      if (step === "outline" && data.outlineId) {
        setOutlineId(data.outlineId);
        setReferences([]);
      }

      if (cost > 0) spend(cost);

      setResults((r) => ({ ...r, [step]: text }));
    } catch (e) {
      alert("❌ " + (e as Error).message);
    } finally {
      setLoading((l) => ({ ...l, [step]: false }));
    }
  }

  /* ---------- 產生（整體）引用：舊功能保留 ---------- */
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
      setReferences((r.saved || []) as ReferenceItem[]);
      alert(`🎉 已新增 ${r.spent} 筆引用！`);
    } catch (e: any) {
      alert("❌ " + e.message);
    } finally {
      setRefLoading(false);
    }
  }

  const outlineSections = useMemo(
    () => parseOutlineToSections(results.outline || ""),
    [results.outline]
  );

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

                  {/* ← 每段落的參考文獻 Tabs（候選＋儲存 1–3） */}
                  {key === "outline" && outlineId && outlineSections.length > 0 && (
                    <SectionReferenceTabs
                      outlineId={outlineId}
                      sections={outlineSections}
                      onSaved={(saved, remain, spentLocal) => {
                        if (saved?.length) {
                          setReferences((prev) => [...saved, ...prev]);
                        }
                        if (typeof remain === "number") {
                          setCredits(remain);
                        } else if (spentLocal > 0) {
                          spend(spentLocal);
                        }
                      }}
                    />
                  )}

                  {/* 保留底部總表（APA7 顯示／匯出） */}
                  {key === "outline" && outlineId && (
                    <ReferencesPanel
                      outlineId={outlineId}
                      loading={refLoading}
                      references={references}
                      onGenerate={generateReferences}
                      onRefresh={async () => {
                        await generateReferences();
                      }}
                      onExport={() => {
                        const text = references
                          .map((r) => `【${r.sectionKey}】 ${formatCitationAPA7(r)}`)
                          .join("\n");
                        downloadTextFile("references.txt", text || "（無資料）");
                      }}
                    />
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
      <Button disabled={!!loading} onClick={onClick} className="w-full bg-blue-500 text-white mb-3">
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
  const entries = Object.entries(costMap) as Array<[string, number]>;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mb-1 w-full border rounded px-2 py-1 text-sm"
    >
      {(entries.length ? entries : [["free", 0]]).map(([mRaw, cRaw]) => {
        const m = String(mRaw);
        const c = Number(cRaw);
        const disabled = c > 0 && credits < c;
        return (
          <option key={m} value={m} disabled={disabled}>
            {modeLabel(m)} {c > 0 ? `(+${c} 點)` : "(0 點)"}{disabled ? " — 點數不足" : ""}
          </option>
        );
      })}
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

/* ======================= 每段落參考文獻 Tabs ======================= */
type SectionReferenceTabsProps = {
  outlineId: string;
  sections: OutlineSection[];
  onSaved: (saved: ReferenceItem[], remainingCredits?: number, spentLocal?: number) => void;
};

function SectionReferenceTabs({
  outlineId,
  sections,
  onSaved,
}: SectionReferenceTabsProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Record<string, ReferenceItem[]>>({});
  const [chosen, setChosen] = useState<Record<string, Record<string, boolean>>>({}); // key -> url -> checked

  async function suggest(sec: OutlineSection) {
    setBusyKey(sec.key);
    try {
      const r = await fetch("/api/references/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlineId,
          sectionKey: sec.key,
          text: sec.text,
          source: "web",
        }),
      }).then((x) => x.json());

      if (r?.error) throw new Error(r.error);
      const list: ReferenceItem[] = (r?.candidates || []).map((it: any) => ({
        sectionKey: sec.key,
        title: it.title,
        url: it.url,
        doi: it.doi ?? null,
        source: it.source ?? null,
        authors: it.authors ?? null,
        publishedAt: it.publishedAt ?? null,
        type: it.type ?? "OTHER",
        credibility: it.credibility ?? null,
      }));
      setCandidates((prev) => ({ ...prev, [sec.key]: list }));
      setChosen((prev) => ({ ...prev, [sec.key]: {} }));
    } catch (e: any) {
      alert("❌ " + (e.message || "取得候選失敗"));
    } finally {
      setBusyKey(null);
    }
  }

  async function save(sec: OutlineSection) {
    const picked = (candidates[sec.key] || []).filter(
      (c) => chosen[sec.key]?.[c.url]
    );
    if (picked.length === 0 || picked.length > 3) {
      alert("請勾選 1~3 筆參考文獻");
      return;
    }

    setBusyKey(sec.key);
    try {
      const r = await fetch("/api/references/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlineId,
          items: picked,
          mode: "web", // 你的後端可視此為每次 1 點
        }),
      }).then((x) => x.json());

      if (r?.error) throw new Error(r.error);
      onSaved(r.saved || [], r.remainingCredits, r.remainingCredits ? 0 : 1);

      // reset current section selections
      setCandidates((prev) => ({ ...prev, [sec.key]: [] }));
      setChosen((prev) => ({ ...prev, [sec.key]: {} }));
      alert(`🎉 已加入 ${picked.length} 筆${typeof r.spent === "number" ? `（扣 ${r.spent} 點）` : ""}`);
    } catch (e: any) {
      alert("❌ " + (e.message || "儲存失敗"));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-2 text-sm text-gray-600">
        為每個段落挑選參考文獻（每次 1 點，可選 1–3 筆）
      </div>

      {/* 非受控 Tabs：不傳 value/onValueChange，避免型別衝突 */}
      <Tabs defaultValue={sections[0]?.key ?? ""}>
        {/* 用外層 div 排版，不把 className 放 TabsList 上（與你的 tabs.tsx 型別對齊） */}
        <div className="flex flex-wrap">
          <TabsList>
            {sections.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {sections.map((s) => (
          <TabsContent key={s.key} value={s.key}>
            <div className="mt-3">
              <div className="text-xs text-gray-600 whitespace-pre-wrap mb-2">
                {s.text || "（此段無內文）"}
              </div>

              <div className="flex gap-2 mb-2">
                <Button
                  variant="outline"
                  disabled={!!busyKey}
                  onClick={() => suggest(s)}
                >
                  {busyKey === s.key ? "搜尋中…" : "找 3 筆候選"}
                </Button>
                <Button
                  className="bg-purple-600 text-white"
                  disabled={!!busyKey || !(candidates[s.key]?.length)}
                  onClick={() => save(s)}
                >
                  加入已勾選（1–3）
                </Button>
              </div>

              {(candidates[s.key] || []).length === 0 ? (
                <p className="text-sm text-gray-400">尚未搜尋候選文獻。</p>
              ) : (
                <ul className="space-y-2">
                  {candidates[s.key].map((c) => {
                    const checked = !!chosen[s.key]?.[c.url];
                    const count = Object.values(chosen[s.key] || {}).filter(Boolean).length;
                    const disableCheck = !checked && count >= 3;
                    return (
                      <li key={c.url} className="text-sm">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disableCheck}
                            onChange={(e) =>
                              setChosen((prev) => ({
                                ...prev,
                                [s.key]: { ...(prev[s.key] || {}), [c.url]: e.target.checked },
                              }))
                            }
                          />
                          <span className="break-all">
                            <b>{c.title}</b>
                            {c.authors ? ` · ${c.authors}` : ""}{" "}
                            {c.source ? ` · ${c.source}` : ""}{" "}
                            {c.doi ? ` · DOI: ${c.doi}` : ""}
                            {typeof c.credibility === "number" ? (
                              <span className="ml-2 text-xs text-gray-500">
                                可信度 {c.credibility}/100
                              </span>
                            ) : null}
                            <div>
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 underline"
                              >
                                連結
                              </a>
                            </div>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ======================= 底部參考文獻面板（總表） ======================= */
type ReferencesPanelProps = {
  outlineId: string;
  loading: boolean;
  references: ReferenceItem[];
  onGenerate: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onExport: () => void;
};

function ReferencesPanel({
  outlineId,
  loading,
  references,
  onGenerate,
  onRefresh,
  onExport,
}: ReferencesPanelProps) {
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">🔗 參考文獻</h4>
        <div className="flex gap-2">
          <Button variant="outline" disabled={loading} onClick={() => onRefresh()}>
            重新整理
          </Button>
          <Button className="bg-purple-600 text-white" disabled={loading} onClick={() => onGenerate()}>
            {loading ? "產生中…" : "產生參考文獻"}
          </Button>
          <Button variant="outline" onClick={onExport}>
            匯出 TXT
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-1">
        Outline ID：<span className="font-mono">{outlineId}</span>
      </p>

      {references.length === 0 ? (
        <p className="text-sm text-gray-500 mt-3">尚未有參考文獻。</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {references.map((r) => (
            <li key={`${r.sectionKey}-${r.url}`} className="break-all">
              <span className="font-medium">{r.sectionKey}</span> · {formatCitationAPA7(r)}{" "}
              <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                link
              </a>
              {typeof r.credibility === "number" ? (
                <span className="ml-2 text-xs text-gray-500">可信度 {r.credibility}/100</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ======================= 小工具 ======================= */
function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
