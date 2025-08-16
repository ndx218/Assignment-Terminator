import fetch from "node-fetch";

// === Regex：標題判斷器 ===
const isHeader = (s: string) =>
  /^((\d+\.|[一二三四五六七八九十百千]+\、|[IVXLCDM]+\.)|(附錄\s?[A-Z]|Appendix\s?[A-Z]))/.test(
    s.trim()
  );

// === 從大綱段落抽取文字 ===
export function extractSectionText(outline: string): string[] {
  const lines = outline.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: string[] = [];
  let current = "";

  for (const line of lines) {
    if (isHeader(line)) {
      if (current) sections.push(current.trim());
      current = line.replace(/^(\d+\.|[一二三四五六七八九十百千]+\、|[IVXLCDM]+\.)/, "").trim();
    } else {
      current += " " + line;
    }
  }
  if (current) sections.push(current.trim());
  return sections;
}

// === 建立查詢關鍵詞 ===
export async function buildQuery(section: string): Promise<string> {
  // 嘗試讓 LLM 幫忙（你可以接上 OpenAI API）
  try {
    const response = await fetch("http://localhost:3000/api/llm/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `請從以下段落抽取 3-5 個關鍵詞，用來查詢學術文獻：\n\n${section}`,
      }),
    });
    const data = await response.json();
    return data.keywords?.join(" ") || section.slice(0, 100);
  } catch {
    return section.slice(0, 100); // fallback
  }
}

// === 向 Crossref 查詢 ===
async function fetchCrossref(query: string) {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(
    query
  )}&rows=3`;
  const res = await fetch(url);
  const data = await res.json();
  return (
    data.message?.items?.map((item: any) => ({
      title: item.title?.[0],
      authors: item.author?.map((a: any) => `${a.given} ${a.family}`) || [],
      year: item.created?.["date-parts"]?.[0]?.[0],
      doi: item.DOI,
      source: "Crossref",
    })) || []
  );
}

// === 向 Semantic Scholar 查詢 ===
async function fetchS2(query: string) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
    query
  )}&limit=3&fields=title,authors,year,url`;
  const res = await fetch(url);
  const data = await res.json();
  return (
    data.data?.map((p: any) => ({
      title: p.title,
      authors: p.authors?.map((a: any) => a.name) || [],
      year: p.year,
      doi: p.url,
      source: "SemanticScholar",
    })) || []
  );
}

// === 主函數：取得建議文獻 ===
export async function suggestReferences(outline: string) {
  const sections = extractSectionText(outline);
  const results = [];

  for (const section of sections) {
    const query = await buildQuery(section);

    // 並行查詢
    const [crossref, s2] = await Promise.all([
      fetchCrossref(query),
      fetchS2(query),
    ]);

    let refs = [...crossref, ...s2];

    // fallback：若沒有查到 → 產生建議關鍵詞
    if (refs.length === 0) {
      refs.push({
        title: `建議研究方向：${query}`,
        authors: [],
        year: null,
        doi: null,
        source: "LLM (suggested)",
      });
    }

    results.push({
      section,
      query,
      references: refs,
    });
  }

  return results;
}
