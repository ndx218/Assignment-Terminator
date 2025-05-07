import { Textarea } from '@/components/ui/textarea';

export default function OutlineSection({
  outline,
  setOutline,
}: {
  outline: string;
  setOutline: (value: string) => void;
}) {
  return (
    <div className="border rounded-lg p-4">
      <label className="font-bold flex items-center gap-2 mb-2 text-lg">
        📝 段落大綱：
      </label>
      <Textarea
        rows={6} // 預設顯示較高輸入區
        placeholder="請輸入段落大綱"
        value={outline}
        onChange={(e) => setOutline(e.target.value)}
        className="w-full"
      />
    </div>
  );
}
