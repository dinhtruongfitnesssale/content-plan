import { XMLParser } from "fast-xml-parser";
import type { EvidenceTier, Paper, Provider, SearchOptions } from "./types";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

/**
 * PubMed là nguồn abstract chính. Ưu điểm quyết định so với các nguồn khác:
 * mỗi bài đều có <PublicationType> do người lập chỉ mục gán tay
 * (Randomized Controlled Trial, Meta-Analysis, Systematic Review...),
 * nên xếp bậc bằng chứng không phải đoán.
 *
 * Giới hạn nhịp: 3 req/s khi không có key, 10 req/s khi có NCBI_API_KEY.
 * Một lượt tìm tốn 2 request (esearch + efetch).
 */
export const pubmed: Provider = {
  id: "pubmed",
  label: "PubMed",
  async search(query, opts) {
    const ids = await esearch(query, opts);
    if (ids.length === 0) return [];
    return efetch(ids, opts.signal);
  },
};

/**
 * Mỗi bậc trong tháp EBM ứng với những tag tìm kiếm nào của PubMed.
 *
 * Hai loại tag, không thể thay cho nhau:
 * - `[pt]` PublicationType — meta-analysis, systematic review, RCT, case reports.
 * - `[mh]` MeSH heading — cohort / case-control / cross-sectional. PubMed KHÔNG
 *   có PublicationType cho ba thiết kế quan sát này; chúng chỉ tồn tại dưới
 *   dạng MeSH. Tra bằng `[pt]` sẽ luôn trả về rỗng.
 */
const TIER_PT: Record<EvidenceTier, string[]> = {
  "meta-analysis": ["meta-analysis[pt]"],
  "systematic-review": ["systematic review[pt]"],
  rct: ["randomized controlled trial[pt]", "controlled clinical trial[pt]"],
  cohort: ["cohort studies[mh]", "longitudinal studies[mh]"],
  "case-control": ["case-control studies[mh]"],
  "cross-sectional": ["cross-sectional studies[mh]"],
  "case-series": ["case reports[pt]"],
  "animal-lab": ["animals[mh:noexp]"],
  other: [],
};

function commonParams(): URLSearchParams {
  const params = new URLSearchParams({ db: "pubmed", tool: "ban-viet" });
  const key = process.env.NCBI_API_KEY;
  if (key) params.set("api_key", key);
  const email = process.env.NCBI_EMAIL;
  if (email) params.set("email", email);
  return params;
}

function buildTerm(query: string, opts: SearchOptions): string {
  const parts = [`(${query})`];

  const yearMin = opts.yearMin;
  const yearMax = opts.yearMax ?? new Date().getFullYear();
  if (yearMin) parts.push(`("${yearMin}"[dp] : "${yearMax}"[dp])`);

  // "other" nghĩa là không giới hạn thiết kế — lọc theo tag sẽ vô nghĩa.
  const tiers = opts.tiers;
  if (tiers?.length && !tiers.includes("other")) {
    const tags = tiers.flatMap((tier) => TIER_PT[tier]);
    if (tags.length > 0) parts.push(`(${tags.join(" OR ")})`);
  }

  return parts.join(" AND ");
}

async function esearch(query: string, opts: SearchOptions): Promise<string[]> {
  const params = commonParams();
  params.set("term", buildTerm(query, opts));
  params.set("retmode", "json");
  params.set("retmax", String(opts.limit ?? 12));
  params.set("sort", "relevance");

  const res = await fetch(`${EUTILS}/esearch.fcgi?${params}`, {
    signal: opts.signal,
    headers: { "user-agent": "ban-viet/1.0" },
  });
  if (!res.ok) throw new Error(`PubMed esearch ${res.status}`);

  // Khi vượt hạn mức, NCBI chuyển hướng 302 sang trang abuse — fetch đi theo
  // và trả về HTML với HTTP 200. Không bắt ở đây thì lỗi nổi lên dưới dạng
  // "Unexpected token '<'", vô nghĩa với người dùng.
  // Đây cũng chính là kiểu hỏng im lặng đã khiến Europe PMC bị loại.
  const body = await res.text();
  if (body.trimStart().startsWith("<")) {
    throw new Error(rateLimitMessage(res));
  }

  let json: { esearchresult?: { idlist?: string[] } };
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error("PubMed trả về dữ liệu không đọc được");
  }

  return json.esearchresult?.idlist ?? [];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  // Abstract và tiêu đề có thể chứa thẻ inline (<b>, <i>, <sub>). Giữ nguyên
  // chuỗi thô rồi bóc thẻ bằng tay, thay vì để parser băm thành cây con.
  stopNodes: ["*.AbstractText", "*.ArticleTitle"],
  processEntities: true,
});

async function efetch(ids: string[], signal?: AbortSignal): Promise<Paper[]> {
  const params = commonParams();
  params.set("id", ids.join(","));
  params.set("retmode", "xml");

  const res = await fetch(`${EUTILS}/efetch.fcgi?${params}`, {
    signal,
    headers: { "user-agent": "ban-viet/1.0" },
  });
  if (!res.ok) throw new Error(`PubMed efetch ${res.status}`);

  const body = await res.text();
  // efetch trả XML nên không dùng được phép thử "<" như esearch — nhận diện
  // trang lỗi bằng việc thiếu hẳn thẻ gốc.
  if (!body.includes("<PubmedArticleSet")) {
    throw new Error(rateLimitMessage(res));
  }

  const parsed = parser.parse(body) as Record<string, unknown>;
  const set = parsed.PubmedArticleSet as Record<string, unknown> | undefined;
  const articles = asArray(set?.PubmedArticle);

  const papers: Paper[] = [];
  for (const article of articles) {
    const paper = toPaper(article as Record<string, unknown>);
    if (paper) papers.push(paper);
  }

  // efetch trả về theo thứ tự id, mà esearch đã xếp theo độ liên quan —
  // giữ nguyên thứ tự đó thay vì để nguyên thứ tự XML.
  const order = new Map(ids.map((id, i) => [id, i]));
  return papers.sort(
    (a, b) => (order.get(a.pmid ?? "") ?? 999) - (order.get(b.pmid ?? "") ?? 999),
  );
}

function toPaper(article: Record<string, unknown>): Paper | null {
  const citation = article.MedlineCitation as Record<string, unknown> | undefined;
  if (!citation) return null;

  const pmid = text(citation.PMID);
  if (!pmid) return null;

  const art = (citation.Article ?? {}) as Record<string, unknown>;
  const title = stripTags(text(art.ArticleTitle));
  if (!title) return null;

  const journalNode = (art.Journal ?? {}) as Record<string, unknown>;
  const issue = (journalNode.JournalIssue ?? {}) as Record<string, unknown>;
  const pubDate = (issue.PubDate ?? {}) as Record<string, unknown>;
  const yearRaw = text(pubDate.Year) || text(pubDate.MedlineDate).slice(0, 4);
  const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;

  return {
    id: `pubmed:${pmid}`,
    source: "pubmed",
    title,
    abstract: readAbstract(art.Abstract),
    authors: readAuthors(art.AuthorList),
    year,
    journal: text(journalNode.Title) || text(journalNode.ISOAbbreviation) || null,
    doi: readDoi(article, art),
    pmid,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    citedByCount: null, // PubMed không cung cấp — OpenAlex bù vào khi gộp.
    studyTypes: [
      ...readStudyTypes(art.PublicationTypeList),
      ...readDesignMesh(citation.MeshHeadingList),
    ],
    isOpenAccess: false, // không suy được từ PubMed; OpenAlex quyết định.
    takeaway: null,
    sampleSize: null,
  };
}

/**
 * Abstract có cấu trúc được chia thành nhiều <AbstractText Label="...">.
 * Giữ nhãn lại vì phần "Results" là chỗ chứa con số cần trích.
 */
function readAbstract(node: unknown): string | null {
  const blocks = asArray(
    (node as Record<string, unknown> | undefined)?.AbstractText,
  );
  if (blocks.length === 0) return null;

  const parts: string[] = [];
  for (const block of blocks) {
    const body = stripTags(text(block));
    if (!body) continue;
    const label =
      typeof block === "object" && block !== null
        ? String((block as Record<string, unknown>)["@_Label"] ?? "")
        : "";
    parts.push(label ? `${titleCase(label)}: ${body}` : body);
  }

  const joined = parts.join("\n\n").trim();
  return joined.length > 0 ? joined : null;
}

function readAuthors(node: unknown): string[] {
  const list = asArray((node as Record<string, unknown> | undefined)?.Author);
  const names: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const author = entry as Record<string, unknown>;
    const last = text(author.LastName);
    const initials = text(author.Initials);
    const collective = text(author.CollectiveName);
    if (last) names.push(initials ? `${last} ${initials}` : last);
    else if (collective) names.push(collective);
  }
  return names;
}

function readStudyTypes(node: unknown): string[] {
  const list = asArray(
    (node as Record<string, unknown> | undefined)?.PublicationType,
  );
  return list
    .map((entry) => text(entry))
    .filter((value) => value.length > 0 && value !== "Journal Article");
}

/**
 * Những MeSH descriptor mô tả THIẾT KẾ nghiên cứu, không phải chủ đề.
 *
 * Cần cái này vì PubMed không có PublicationType cho cohort / case-control /
 * cross-sectional — thiếu MeSH thì mọi nghiên cứu quan sát đều rơi xuống bậc
 * "Other", trong khi bộ lọc lại tra được chúng qua `[mh]`. Lệch nhau như vậy
 * là kiểu hỏng khó thấy nhất: lọc ra đúng bài nhưng dán sai nhãn.
 *
 * Cố tình dùng danh sách trắng hẹp. Đổ hết MeSH vào `studyTypes` sẽ kéo theo
 * hàng chục nhãn chủ đề và làm `toTier()` khớp nhầm.
 */
const DESIGN_MESH = new Set([
  "cohort studies",
  "longitudinal studies",
  "case-control studies",
  "cross-sectional studies",
  "animals",
]);

function readDesignMesh(node: unknown): string[] {
  const headings = asArray((node as Record<string, unknown> | undefined)?.MeshHeading);

  const found: string[] = [];
  for (const heading of headings) {
    if (typeof heading !== "object" || heading === null) continue;
    const name = text((heading as Record<string, unknown>).DescriptorName);
    if (name && DESIGN_MESH.has(name.toLowerCase())) found.push(name);
  }
  return found;
}

function readDoi(
  article: Record<string, unknown>,
  art: Record<string, unknown>,
): string | null {
  const pubmedData = article.PubmedData as Record<string, unknown> | undefined;
  const idList = pubmedData?.ArticleIdList as Record<string, unknown> | undefined;

  for (const entry of asArray(idList?.ArticleId)) {
    if (typeof entry !== "object" || entry === null) continue;
    const id = entry as Record<string, unknown>;
    if (id["@_IdType"] === "doi") {
      const value = text(id);
      if (value) return value.toLowerCase();
    }
  }

  for (const entry of asArray(art.ELocationID)) {
    if (typeof entry !== "object" || entry === null) continue;
    const id = entry as Record<string, unknown>;
    if (id["@_EIdType"] === "doi") {
      const value = text(id);
      if (value) return value.toLowerCase();
    }
  }

  return null;
}

/**
 * Phân biệt hai lý do NCBI trả về HTML: bị chặn vì vượt hạn mức, hay sự cố
 * khác. Chặn vì hạn mức thì `fetch` kết thúc ở misuse.ncbi.nlm.nih.gov —
 * và cách chữa là thêm NCBI_API_KEY (3 → 10 request/giây), không phải chờ.
 */
function rateLimitMessage(res: Response): string {
  const blocked = res.url.includes("misuse.ncbi.nlm.nih.gov");
  if (!blocked) {
    return "NCBI trả về trang lỗi thay vì dữ liệu — thử lại sau ít phút";
  }
  return process.env.NCBI_API_KEY
    ? "NCBI tạm chặn vì vượt hạn mức — chờ vài phút rồi thử lại"
    : "NCBI tạm chặn vì gọi quá nhanh. Thêm NCBI_API_KEY (miễn phí, từ tài khoản NCBI) để nâng từ 3 lên 10 request/giây";
}

/* --- tiện ích parse --- */

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Node của fast-xml-parser có thể là chuỗi, số, hoặc object có "#text". */
function text(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node.trim();
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    const inner = (node as Record<string, unknown>)["#text"];
    if (inner !== undefined) return text(inner);
  }
  return "";
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}
