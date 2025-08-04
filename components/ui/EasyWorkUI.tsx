/* components/ui/EasyWorkUI.tsx – TS 5.x + Next 13.4 */
"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import Textarea from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReferencesPanel } from "@/components/ui/ReferencesPanel";
import { MODE_COST, getCost, type StepName } from "@/lib/points";
import { useCredits, useSpend, useSetCredits } from "@/hooks/usePointStore";

import {
  Dialog, DialogTrigger, DialogContent,
  DialogHeader, DialogTitle, DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";


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
  refs: "free";
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
  summary?: string | null;
};

/* ---------- APA7 簡化格式（底部顯示/匯出用） ---------- */
type Citation = {
  authors?: string | null;
  publishedAt?: string | Date | null;
  title?: string;
  source?: string | null;
  doi?: string | null;
  url?: string | null;
};

export function formatCitationAPA7(r: Citation) {
  const year = r.publishedAt
    ? (typeof r.publishedAt === "string"
        ? r.publishedAt.slice(0, 4) // 第66行
        : String((r.publishedAt as Date).getFullYear())) // 第67行
    : "n.d.";  // 如果 `publishedAt` 沒有提供，就顯示 "n.d."
  
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
type OutlineSection = { key: string; title: string; text: string };

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
      const key = line.replace(/[、.].*$/, "").trim(); // 「一」或「1」
      const title = line.replace(/^([一二三四五六七八九十]+、|[0-9]+\.)\s*/, "").trim();
      if (current) sections.push(current);
      current = { key, title: title || key, text: "" };
    } else if (current) {
      current.text += (current.text ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) {
    sections.push({ key: "I", title: "大綱", text: outline });
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

  /* ----------- Loading（含 refs） ----------- */
  const [loading, setLoading] = useState<Record<StepName, boolean>>({
    outline: false,
    draft: false,
    feedback: false,
    rewrite: false,
    final: false,
    refs: false,
  });

  /* ----------- 點數 ----------- */
  const credits = useCredits();
  const spend = useSpend();
  const setCredits = useSetCredits();

  /* ----------- 模式（含 refs） ----------- */
  const [mode, setMode] = useState<ModeState>({
    outline: "free",
    draft: "free",
    feedback: "free",
    rewrite: "free",
    final: "free",
    refs: "free",
  });

  /* 大綱分頁：編輯 / 檢視 切換 */
  const [outlineViewMode, setOutlineViewMode] = useState<"edit" | "view">("edit");

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
        console.log("✅ outlineId 設定成功", data.outlineId); 
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

                  {/* --- 大綱頁：可切換「編輯 / 檢視＋參考文獻」 --- */}
                  {key === "outline" ? (
                    <>
                      <div className="mb-2 flex items-center gap-2">
                        
                       <Button
  variant={outlineViewMode === "edit" ? "default" : "outline"}
  size="sm"
  onClick={() => setOutlineViewMode("edit")}
>
  ✏️ 編輯模式
</Button>

<Button
  variant={outlineViewMode === "view" ? "default" : "outline"}
  size="sm"
  onClick={() => {
    if (!outlineId || !(results.outline?.trim())) {
      alert("⚠️ 系統尚未產生大綱資料，請先點擊上方產生參考文獻的大綱模式");
      return;
    }
    setOutlineViewMode("view");
  }}
>
  🔍 檢視模式 + 參考文獻
</Button>

                      </div>

                      {outlineViewMode === "edit" ? (
                        <Textarea
                          rows={1}
                          className="whitespace-pre-wrap mb-2 w-full !h-[60vh] overflow-auto resize-none"
                          value={results[key] || ""}
                          onChange={(e) =>
                            setResults((r) => ({ ...r, [key]: e.target.value }))
                          }
                        />
                      ) : (
                        <OutlineViewerWithRefs
                          outlineId={outlineId!}
                          outlineText={results.outline || ""}
                          disabled={refLoading}
                          onSaved={(saved, remain) => {
                            setReferences((prev) => [...saved, ...prev]);
                            if (typeof remain === "number") setCredits(remain);
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <Textarea
                      rows={1}
                      className="whitespace-pre-wrap mb-2 w-full !h-[75vh] overflow-auto resize-none"
                      value={results[key] || ""}
                      onChange={(e) =>
                        setResults((r) => ({ ...r, [key]: e.target.value }))
                      }
                    />
                  )}

                  {/* 複製按鈕（非空時顯示；編輯/檢視皆可用） */}
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

                  {/* 底部「參考文獻」總表（APA7 顯示／匯出） */}
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

/* ======================= 逐條目檢視 + 參考按鈕 ======================= */
/** 逐段（I/II/III…），每段再以行切子彈（- 或 • 開頭；沒有就整段當一條） */
function OutlineViewerWithRefs({
  outlineId,
  outlineText,
  disabled,
  onSaved,
}: {
  outlineId: string;
  outlineText: string;
  disabled?: boolean;
  onSaved: (saved: ReferenceItem[], remainingCredits?: number) => void;
}) {
  const sections = parseOutlineToSections(outlineText);
  if (!sections.length) return null;

  const bulletsOf = (text: string): string[] => {
    const lines = (text || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const bullets = lines
      .filter((l) => /^[-•]/.test(l))
      .map((l) => l.replace(/^[-•]\s*/, ""));
    return bullets.length ? bullets : [text.trim()];
  };

  return (
    <div className="mt-2 border rounded p-3 bg-white">
      {sections.map((sec) => (
        <div key={sec.key} className="mb-4">
          <div className="font-semibold mb-1">
            {sec.key}. {sec.title}
          </div>
          <ul className="space-y-1">
            {bulletsOf(sec.text).map((b, i) => (
              <li key={`${sec.key}-${i}`} className="flex items-start gap-2">
                <span className="flex-1 break-all">- {b}</span>
                <ReferenceDialog
                  outlineId={outlineId}
                  sectionKey={sec.key}
                  bulletText={b}
                  disabled={disabled}
                  onSaved={onSaved}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
/* ======================= 參考文獻「內嵌面板」樣式 ======================= */
/* ======================= 參考文獻「行內面板」的封裝：ReferenceDialog ======================= */
function ReferenceDialog({
  outlineId,
  sectionKey,
  bulletText,
  disabled,
  onSaved,
}: {
  outlineId: string;
  sectionKey: string;
  bulletText: string;
  disabled?: boolean;
  onSaved: (saved: ReferenceItem[], remainingCredits?: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [cands, setCands] = useState<ReferenceItem[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({}); // url -> checked

async function suggest() {
  console.log("📦 API 參數確認", { outlineId, sectionKey, text: bulletText });

  // ✅ 二次防呆，避免 race condition 導致 outlineId 為空
  if (!outlineId || outlineId.length < 6 || !sectionKey || !bulletText?.trim()) {
    alert("⚠️ 系統資料尚未準備好，請稍後再嘗試加入參考文獻");
    return;
  }

  setBusy(true);
  try {
    const r = await fetch("/api/references/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outlineId, sectionKey, text: bulletText, source: "web" }),
    }).then((x) => x.json());

    if (r?.error) throw new Error(r.error);

    const list: ReferenceItem[] = (r?.candidates || []).map((it: any) => ({
      sectionKey,
      title: it.title,
      url: it.url,
      doi: it.doi ?? null,
      source: it.source ?? null,
      authors: it.authors ?? null,
      publishedAt: it.publishedAt ?? null,
      type: it.type ?? "OTHER",
      credibility: it.credibility ?? null,
      summary: it.summary ?? null,
    }));

    setCands(list);
    setPicked({});
  } catch (e: any) {
    alert("❌ 無法取得參考文獻：" + (e.message || "未知錯誤"));
  } finally {
    setBusy(false);
  }
}

  async function save() {
    const items = cands.filter((c) => picked[c.url]);

    if (items.length === 0 || items.length > 3) {
      alert("請勾選 1–3 筆參考文獻");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/references/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlineId,
          items,
          mode: "web",
        }),
      }).then((res) => res.json());

      if (r?.error) throw new Error(r.error);

      onSaved(r.saved || [], r.remainingCredits);
      alert(`🎉 已成功加入 ${items.length} 筆文獻（扣除 ${r.spent ?? 1} 點）`);
    } catch (e: any) {
      alert("❌ 儲存失敗：" + (e.message || "未知錯誤"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ReferenceInlinePanel
      label="參考文獻"
      disabled={!!disabled}
      busy={busy}
      onSuggest={suggest}
      onSave={save}
      candidates={cands}
      chosen={picked}
      onToggleCheck={(url, checked) => setPicked((prev) => ({ ...prev, [url]: checked }))}
    />
  );
}

/* ======================= 參考文獻「內嵌面板」樣式（唯一保留版本） ======================= */
function ReferenceInlinePanel({
  label = "參考文獻",
  disabled = false,
  busy = false,
  onSuggest,
  onSave,
  candidates = [],
  chosen = {},
  onToggleCheck,
}: {
  label?: string;
  disabled?: boolean;
  busy?: boolean;
  onSuggest: () => void;
  onSave: () => void;
  candidates: ReferenceItem[];
  chosen: Record<string, boolean>; // url -> checked
  onToggleCheck: (url: string, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <Button
        variant="outline"
        size="sm"                 // shadcn 允許的 size
        className="h-7 px-2 text-xs"  // 視覺縮小
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "隱藏參考文獻" : label}
      </Button>

      {open && (
        <div className="mt-3 rounded border bg-white p-3 space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" disabled={disabled || busy} onClick={onSuggest}>
              {busy ? "搜尋中…" : "找 3 筆候選"}
            </Button>
            <Button
              className="bg-purple-600 text-white"
              disabled={disabled || busy || !candidates.length}
              onClick={onSave}
            >
              加入已勾選（1–3）
            </Button>
          </div>

          {!candidates.length ? (
            <p className="text-sm text-gray-400">尚未搜尋候選文獻。</p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => {
                const checked = !!chosen[c.url];
                const count = Object.values(chosen).filter(Boolean).length;
                const disableCheck = !checked && count >= 3;
                return (
                  <li key={c.url} className="text-sm">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disableCheck}
                        onChange={(e) => onToggleCheck(c.url, e.target.checked)}
                      />
                      <span className="break-all">
                        <b>{c.title}</b>
                        {c.authors ? ` · ${c.authors}` : ""}{" "}
                        {c.source ? ` · ${c.source}` : ""}{" "}
                        {c.doi ? ` · DOI: ${c.doi}` : ""}
                        {typeof c.credibility === "number" ? (
                          <span className="ml-2 text-xs text-gray-500">可信度 {c.credibility}/100</span>
                        ) : null}
                        <div>
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
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
      )}
    </div>
  );
}



/* ======================= 小工具：存文字成檔案（頂層宣告，外部可呼叫） ======================= */
function downloadTextFile(filename: string, text: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
