"use client";
import { Button } from "@/components/ui/button";
import type { ReferenceItem } from "./EasyWorkUI"; // 或移到單獨 types 檔再引入
import { formatCitationAPA7 } from "./EasyWorkUI"; // 若它不是 export，請把它改成 export

export type ReferencesPanelProps = {
  outlineId: string;
  loading: boolean;
  references: ReferenceItem[];
  onGenerate: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onExport: () => void;
};

export function ReferencesPanel({
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
