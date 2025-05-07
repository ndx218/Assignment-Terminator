'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import Textarea from '@/components/ui/textarea'; // ✅ 正確用法：default import
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLang, toSimplified, toTraditional } from '@/lib/lang';

export default function EasyWorkUI() {
  const { lang, toggleLang } = useLang();

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

  const [outline, setOutline] = useState('');
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [rewrite, setRewrite] = useState('');
  const [final, setFinal] = useState('');
  const [loading, setLoading] = useState(false);
  const [hLoading, setHLoading] = useState(false);

  const [copiedOutline, setCopiedOutline] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [copiedRewrite, setCopiedRewrite] = useState(false);
  const [copiedFinal, setCopiedFinal] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const convertText = (text: string) => {
    return lang === 'zh-CN' ? toSimplified(text) : toTraditional(text);
  };

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchData = async (endpoint: string, setState: (text: string) => void, body: any = form) => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.outline) setState(data.outline);
      if (data.draft) setState(data.draft);
      if (data.result) setState(data.result);
      if (data.feedback) setState(data.feedback);
    } catch (err: any) {
      alert(`❌ 錯誤：${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="w-64 border-r p-4 bg-gray-50">
        <h2 className="font-bold text-lg mb-4">📚 功課設定</h2>
        {['name', 'school', 'title', 'wordCount', 'reference', 'rubric', 'paragraph'].map((field) => (
          <Input key={field} name={field} placeholder={field} onChange={handleChange} className="mb-2 w-full" />
        ))}
        <select name="language" onChange={handleChange} className="mb-2 w-full border rounded px-2 py-1">
          <option value="中文">中文</option>
          <option value="英文">英文</option>
        </select>
        <select name="tone" onChange={handleChange} className="mb-2 w-full border rounded px-2 py-1">
          <option value="正式">正式</option>
          <option value="半正式">半正式</option>
          <option value="輕鬆">輕鬆</option>
        </select>
        <Textarea name="detail" placeholder="內容細節" onChange={handleChange} className="mb-2 w-full" />

        <Button onClick={() => fetchData('/api/outline', setOutline)} isLoading={loading} className="w-full bg-blue-500 text-white mt-2">
          🧠 產生大綱
        </Button>
        <Button onClick={() => fetchData('/api/draft', setDraft, { ...form, outline })} isLoading={loading} className="w-full bg-blue-500 text-white mt-2">
          ✍️ 草稿產生
        </Button>
        <Button onClick={() => fetchData('/api/feedback', setFeedback, { text: draft })} isLoading={loading} className="w-full bg-yellow-500 text-black mt-2">
          🧑‍🏫 教師評論
        </Button>
        <Button onClick={() => fetchData('/api/rewrite', setRewrite, { text: draft })} isLoading={loading} className="w-full bg-green-600 text-white mt-2">
          📝 GPT-style 修訂
        </Button>
        <Button onClick={() => fetchData('/api/undetectable', setFinal, { text: rewrite })} isLoading={hLoading} className="w-full bg-gray-800 text-white mt-2">
          🤖 最終人性化優化
        </Button>

        <div className="mt-6">
          <Button onClick={toggleLang} className="w-full bg-yellow-400">
            🌐 切換語言：{lang === 'zh-TW' ? '繁體' : '簡體'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="outline">
          <TabsList>
            <TabsTrigger value="outline">📑 大綱產生器</TabsTrigger>
            <TabsTrigger value="draft">✍️ 初稿</TabsTrigger>
            <TabsTrigger value="feedback">🧑‍🏫 教師評論</TabsTrigger>
            <TabsTrigger value="rewrite">📝 修訂稿</TabsTrigger>
            <TabsTrigger value="final">🤖 最終版本</TabsTrigger>
          </TabsList>

          <TabsContent value="outline">
            <Card className="p-4 mt-4 bg-gray-50 relative">
              <h3 className="font-semibold mb-2">📑 段落大綱：</h3>
              <Textarea className="whitespace-pre-wrap mb-2 w-full" value={convertText(outline)} onChange={(e) => setOutline(e.target.value)} />
              {outline && (
                <Button variant="outline" size="sm" className="absolute bottom-2 right-4" onClick={() => handleCopy(convertText(outline), setCopiedOutline)}>
                  📋 複製
                </Button>
              )}
              {copiedOutline && <span className="absolute bottom-2 right-20 text-green-500 text-sm">✅ 已複製！</span>}
            </Card>
          </TabsContent>

          <TabsContent value="draft">
            <Card className="p-4 mt-4 bg-gray-100 relative">
              <h3 className="font-semibold mb-2">✍️ 初稿草稿：</h3>
              <Textarea className="whitespace-pre-wrap mb-2 w-full" value={convertText(draft)} onChange={(e) => setDraft(e.target.value)} />
              {draft && (
                <Button variant="outline" size="sm" className="absolute bottom-2 right-4" onClick={() => handleCopy(convertText(draft), setCopiedDraft)}>
                  📋 複製
                </Button>
              )}
              {copiedDraft && <span className="absolute bottom-2 right-20 text-green-500 text-sm">✅ 已複製！</span>}
            </Card>
          </TabsContent>

          <TabsContent value="feedback">
            <Card className="p-4 mt-4 bg-red-50 relative">
              <h3 className="font-semibold mb-2">🧑‍🏫 教師評論：</h3>
              <Textarea className="whitespace-pre-wrap mb-2 w-full" value={convertText(feedback)} onChange={(e) => setFeedback(e.target.value)} />
              {feedback && (
                <Button variant="outline" size="sm" className="absolute bottom-2 right-4" onClick={() => handleCopy(convertText(feedback), setCopiedFeedback)}>
                  📋 複製
                </Button>
              )}
              {copiedFeedback && <span className="absolute bottom-2 right-20 text-green-500 text-sm">✅ 已複製！</span>}
            </Card>
          </TabsContent>

          <TabsContent value="rewrite">
            <Card className="p-4 mt-4 bg-yellow-50 relative">
              <h3 className="font-semibold mb-2">📝 修訂稿：</h3>
              <Textarea className="whitespace-pre-wrap mb-2 w-full" value={convertText(rewrite)} onChange={(e) => setRewrite(e.target.value)} />
              {rewrite && (
                <Button variant="outline" size="sm" className="absolute bottom-2 right-4" onClick={() => handleCopy(convertText(rewrite), setCopiedRewrite)}>
                  📋 複製
                </Button>
              )}
              {copiedRewrite && <span className="absolute bottom-2 right-20 text-green-500 text-sm">✅ 已複製！</span>}
            </Card>
          </TabsContent>

          <TabsContent value="final">
            <Card className="p-4 mt-4 bg-green-50 relative">
              <h3 className="font-semibold mb-2">🤖 最終版本（自然語氣）：</h3>
              <Textarea className="whitespace-pre-wrap mb-2 w-full" value={convertText(final)} onChange={(e) => setFinal(e.target.value)} />
              {final && (
                <Button variant="outline" size="sm" className="absolute bottom-2 right-4" onClick={() => handleCopy(convertText(final), setCopiedFinal)}>
                  📋 複製
                </Button>
              )}
              {copiedFinal && <span className="absolute bottom-2 right-20 text-green-500 text-sm">✅ 已複製！</span>}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
