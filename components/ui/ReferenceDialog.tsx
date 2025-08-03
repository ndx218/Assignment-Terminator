"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export type RefItem = {
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

type Props = {
  outlineId: string;
  sectionKey: string;         // 例如「I」「II」
  bulletText: string;         // 該條目文字
  disabled?: boolean;
  onSaved: (saved: RefItem[], remainingCredits?: number) => void;
};

export function ReferenceDialog({
  outlineId,
  sectionKey,
  bulletText,
  disabled,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cands, setCands] = useState<RefItem[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({}); // url -> checked
  const pickedCount = Object.values(picked).filter(Boolean).length;

  async function suggest() {
    setBusy(true);
    try {
      const r = await fetch("/api/references/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlineId,
          sectionKey,
          text: bulletText,
          source: "web",
        }),
      }).then((x) => x.json());
      if (r?.error) throw new Error(r.error);
      const list: RefItem[] = (r?.candidates || []).map((it: any) => ({
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
      alert("❌ " + (e.message || "取得候選失敗"));
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
        body: JSON.stringify({ outlineId, items, mode: "web" }),
      }).then((x) => x.json());
      if (r?.error) throw new Error(r.error);
      onSaved(r.saved || [], r.remainingCredits);
      setOpen(false);
      alert(`🎉 已加入 ${items.length} 筆（扣除 ${r.spent ?? 1} 點）`);
    } catch (e: any) {
      alert("❌ " + (e.message || "儲存失敗"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs" disabled={disabled}>
          參考文獻
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>為此條目找參考文獻</DialogTitle>
        </DialogHeader>

        <div className="text-sm mb-3">
          <div className="font-medium">[{sectionKey}] {bulletText}</div>
        </div>

        <div className="flex gap-2 mb-2">
          <Button variant="outline" onClick={suggest} disabled={busy}>
            {busy ? "搜尋中…" : "找 3 筆候選"}
          </Button>
          <Button onClick={save} disabled={busy || pickedCount === 0 || pickedCount > 3}>
            加入已勾選（{pickedCount}）
          </Button>
        </div>

        {cands.length === 0 ? (
          <p className="text-sm text-gray-500">尚未有候選。請先「找 3 筆候選」。</p>
        ) : (
          <ul className="space-y-3 text-sm max-h-80 overflow-auto pr-2">
            {cands.map((c) => {
              const checked = !!picked[c.url];
              const disable =
                !checked && Object.values(picked).filter(Boolean).length >= 3;
              return (
                <li key={c.url} className="border rounded p-2">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disable}
                      onChange={(e) =>
                        setPicked((prev) => ({ ...prev, [c.url]: e.target.checked }))
                      }
                    />
                    <span className="break-all">
                      <b>{c.title}</b>
                      {c.authors ? ` · ${c.authors}` : ""} {c.source ? ` · ${c.source}` : ""}
                      {c.doi ? ` · DOI: ${c.doi}` : ""}
                      {typeof c.credibility === "number" ? (
                        <span className="ml-2 text-xs text-gray-500">
                          可信度 {c.credibility}/100
                        </span>
                      ) : null}
                      {c.summary ? (
                        <div className="mt-1 text-xs text-gray-600">摘要：{c.summary}</div>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
