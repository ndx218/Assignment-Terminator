'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const sections = [
  { key: 'outline', label: '📑 大綱產生器' },
  { key: 'draft', label: '✍️ 初稿' },
  { key: 'feedback', label: '🧑‍🏫 教師評論' },
  { key: 'rewrite', label: '📝 修訂稿' },
  { key: 'final', label: '🤖 最終版本' }
];

export default function EasyWorkUI() {
  const { data: session } = useSession();
  const [form, setForm] = useState({
    name: '',
    school: '',
    title: '',
    wordCount: '',
    language: '中文',
    tone: '正式',
    detail: '',
    reference: '',
    rubric: '',
    paragraph: ''
  });
  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [hLoading, setHLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(results[key] || '');
    setCopied((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
  };

  const fetchData = async (endpoint: string, key: string, body: any = form) => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      // 假設 API 回傳的 JSON 裡面有 outline / draft / feedback / result 等欄位
      const text = data.outline || data.draft || data.feedback || data.result || '';
      setResults((r) => ({ ...r, [key]: text }));
    } catch (err: any) {
      alert(`❌ 錯誤：${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* 登入資訊區塊 */}
      <div className="w-full bg-green-50 border-b border-green-200 px-4 py-2 text-sm flex justify-between items-center">
        <div>
          👤 <span className="font-medium">{session?.user?.email}</span> 🆔{' '}
          {session?.user?.id}
        </div>
        <Button
          variant="ghost"
          className="text-red-600 hover:text-black px-2 py-1"
          onClick={() => {
            localStorage.removeItem('skipLogin');
            signOut({ callbackUrl: '/login' });
          }}
        >
          🚪 登出
        </Button>
      </div>

      {/* 主畫面區域 */}
      <div className="flex flex-1">
        {/* 左側功能設定欄 */}
        <div className="w-64 border-r p-4 bg-gray-50 overflow-y-auto">
          <h2 className="font-bold text-lg mb-4">📚 功課設定</h2>
          {['name', 'school', 'title', 'wordCount', 'reference', 'rubric', 'paragraph'].map(
            (field) => (
              <Input
                key={field}
                name={field}
                placeholder={field}
                onChange={handleChange}
                className="mb-2 w-full"
              />
            )
          )}

          <select
            name="language"
            onChange={handleChange}
            className="mb-2 w-full border rounded px-2 py-1"
          >
            <option value="中文">中文</option>
            <option value="英文">英文</option>
          </select>
          <select
            name="tone"
            onChange={handleChange}
            className="mb-2 w-full border rounded px-2 py-1"
          >
            <option value="正式">正式</option>
            <option value="半正式">半正式</option>
            <option value="輕鬆">輕鬆</option>
          </select>
          <Textarea
            name="detail"
            placeholder="內容細節"
            onChange={handleChange}
            className="mb-2 w-full"
          />

          <Button
            onClick={() => fetchData('/api/outline', 'outline')}
            isLoading={loading}
            className="w-full bg-blue-500 text-white mt-2"
          >
            🧠 產生大綱
          </Button>
          <Button
            onClick={() => fetchData('/api/draft', 'draft', { ...form, outline: results.outline })}
            isLoading={loading}
            className="w-full bg-blue-500 text-white mt-2"
          >
            ✍️ 草稿產生
          </Button>
          <Button
            onClick={() => fetchData('/api/feedback', 'feedback', { text: results.draft })}
            isLoading={loading}
            className="w-full bg-yellow-500 text-black mt-2"
          >
            🧑‍🏫 教師評論
          </Button>
          <Button
            onClick={() => fetchData('/api/rewrite', 'rewrite', { text: results.draft })}
            isLoading={loading}
            className="w-full bg-green-600 text-white mt-2"
          >
            📝 GPT-style 修訂
          </Button>
          <Button
            onClick={() => fetchData('/api/undetectable', 'final', { text: results.rewrite })}
            isLoading={hLoading}
            className="w-full bg-gray-800 text-white mt-2"
          >
            🤖 最終人性化優化
          </Button>
        </div>

        {/* 右側結果顯示區（Tabs + Textarea） */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="outline">
            <TabsList>
              {sections.map((s) => (
                <TabsTrigger key={s.key} value={s.key}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {sections.map(({ key, label }) => (
              <TabsContent key={key} value={key}>
                <Card className="p-4 mt-4 bg-gray-50 relative">
                  <h3 className="font-semibold mb-2">{label}：</h3>
                  <Textarea
                    rows={1}
                    value={results[key] || ''}
                    onChange={(e) =>
                      setResults((r) => ({ ...r, [key]: e.target.value }))
                    }
                    className="
                      whitespace-pre-wrap 
                      mb-2 w-full 
                      !h-[75vh]      /* 固定 75vh 高度 */
                      overflow-auto   /* 內容超過時顯示滾動條 */
                      resize-none     /* 禁用使用者拉伸 */
                    "
                  />
                  {results[key] && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute bottom-2 right-4"
                      onClick={() => handleCopy(key)}
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
