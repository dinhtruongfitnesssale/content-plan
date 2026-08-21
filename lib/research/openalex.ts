import type { Paper, Provider, SearchOptions } from "./types";

const API = "https://api.openalex.org/works";

/**
 * OpenAlex bổ trợ cho PubMed: phủ cả các lĩnh vực ngoài y sinh, và cung cấp
 * hai thứ PubMed không có — lượt trích dẫn và link đọc miễn phí.
 *
 * Không dùng làm nguồn abstract chính: `abstract_inverted_index` rất hay bị
 * null (nhà xuất bản không cho phép), nên nhiều bài về không có abstract.
 */
export const openalex: Provider = {
  id: "openalex",
  label: "OpenAlex",
  async search(query, opts) {
    const params = new URLSearchParams({
      search: query,
      per_page: String(opts.limit ?? 12),
      select: SELECT.join(","),
    });

    // OpenAlex ưu tiên request có email ("polite pool") — nhanh và ổn định hơn.
    const email = process.env.OPENALEX_EMAIL ?? process.env.NCBI_EMAIL;
    if (email) params.set("mailto", email);

    const filters: string[] = [];
    if (opts.yearMin) filters.push(`from_publication_date:${opts.yearMin}-01-01`);
    if (opts.yearMax) filters.push(`to_publication_date:${opts.yearMax}-12-31`);
    if (filters.length > 0) params.set("filter", filters.join(","));

    const res = await fetch(`${API}?${params}`, {
      signal: opts.signal,
      headers: { "user-agent": "ban-viet/1.0" },
    });
    if (!res.ok) throw new Error(`OpenAlex ${res.status}`);

    const json = (await res.json()) as { results?: OpenAlexWork[] };
    return (json.results ?? []).map(toPaper).filter((p): p is Paper => p !== null);
  },
};

const SELECT = [
  "id",
  "doi",
  "title",
  "publication_year",
  "abstract_inverted_index",
  "cited_by_count",
  "type",
  "ids",
  "authorships",
  "primary_location",
  "open_access",
];

type OpenAlexWork = {
  id?: string;
  doi?: string | null;
  title?: string | null;
  publication_year?: number | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  cited_by_count?: number | null;
  type?: string | null;
  ids?: { pmid?: string | null };
  authorships?: { author?: { display_name?: string | null } | null }[];
  primary_location?: { source?: { display_name?: string | null } | null } | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null } | null;
};

function toPaper(work: OpenAlexWork): Paper | null {
  const title = work.title?.trim();
  const openAlexId = work.id?.split("/").pop();
  if (!title || !openAlexId) return null;

  const doi = work.doi ? work.doi.replace(/^https?:\/\/doi\.org\//, "").toLowerCase() : null;
  const pmid = work.ids?.pmid?.split("/").pop() ?? null;

  return {
    id: `openalex:${openAlexId}`,
    source: "openalex",
    title,
    abstract: rebuildAbstract(work.abstract_inverted_index),
    authors: (work.authorships ?? [])
      .map((a) => a.author?.display_name?.trim())
      .filter((name): name is string => Boolean(name)),
    year: work.publication_year ?? null,
    journal: work.primary_location?.source?.display_name ?? null,
    doi,
    pmid,
    url: work.open_access?.oa_url ?? (doi ? `https://doi.org/${doi}` : work.id!),
    citedByCount: work.cited_by_count ?? null,
    studyTypes: guessStudyTypes(work, title),
    isOpenAccess: work.open_access?.is_oa ?? false,
    takeaway: null,
    sampleSize: null,
  };
}

/**
 * OpenAlex lưu abstract dưới dạng chỉ mục đảo (từ → các vị trí xuất hiện),
 * di sản từ ràng buộc bản quyền của Microsoft Academic Graph. Dựng lại bằng
 * cách rải từng từ về đúng vị trí của nó.
 */
function rebuildAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;

  const slots: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) slots[position] = word;
  }

  const text = slots.join(" ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

/**
 * OpenAlex không có nhãn loại nghiên cứu do người lập chỉ mục gán như PubMed.
 * `type` chỉ phân biệt article/review/preprint, nên phần còn lại phải đoán từ
 * tiêu đề. Đây là suy đoán — bài nào cũng có mặt ở PubMed thì nhãn của PubMed
 * thắng khi gộp (xem `mergePapers` trong index.ts).
 */
function guessStudyTypes(work: OpenAlexWork, title: string): string[] {
  const types: string[] = [];
  const haystack = title.toLowerCase();

  if (haystack.includes("meta-analysis") || haystack.includes("meta analysis")) {
    types.push("Meta-Analysis");
  }
  if (haystack.includes("systematic review")) types.push("Systematic Review");
  if (haystack.includes("randomi") && haystack.includes("trial")) {
    types.push("Randomized Controlled Trial");
  }
  if (haystack.includes("cohort")) types.push("Cohort Study");
  if (haystack.includes("cross-sectional")) types.push("Cross-Sectional Study");

  if (types.length === 0 && work.type === "review") types.push("Review");

  return types;
}
