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
    // `days` là mốc hẹp hơn `yearMin` nên nó thắng — hai cái cùng gửi thì
    // OpenAlex nhận cả hai và lấy giao, tức là mốc năm trở thành thừa.
    if (opts.days) filters.push(`from_publication_date:${daysAgo(opts.days)}`);
    else if (opts.yearMin) filters.push(`from_publication_date:${opts.yearMin}-01-01`);
    if (opts.yearMax) filters.push(`to_publication_date:${opts.yearMax}-12-31`);
    if (filters.length > 0) params.set("filter", filters.join(","));

    // Cố ý KHÔNG đặt `sort=publication_date:desc` cho bảng tin: xếp theo ngày
    // ở phía nguồn là vứt bỏ thứ hạng liên quan, và một truy vấn rộng sẽ trả
    // về bài mới nhất thay vì bài đúng chủ đề. Cửa sổ ngày ở trên đã chặn đủ;
    // việc xếp theo ngày để `rank()` ở tầng trên làm, sau khi đã gộp nguồn.

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
  "publication_date",
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
  publication_date?: string | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  cited_by_count?: number | null;
  type?: string | null;
  ids?: { pmid?: string | null };
  authorships?: { author?: { display_name?: string | null } | null }[];
  primary_location?: { source?: { display_name?: string | null } | null } | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null } | null;
};

/**
 * OpenAlex trả tiêu đề và tên tạp chí còn nguyên thực thể HTML — thấy thật với
 * "Medicine &amp; Science in Sports &amp; Exercise". Trang web hiện ra thì
 * trình duyệt tự giải mã, nhưng chuỗi này còn đi vào danh mục trích dẫn cuối
 * bài đăng Facebook, nơi không có gì giải mã hộ — độc giả đọc đúng chữ
 * "&amp;" trong tên tạp chí.
 *
 * Chỉ giải mã đúng bộ thực thể thật sự gặp trong dữ liệu thư mục. Không viết
 * bộ giải mã HTML đầy đủ: đây là tên tạp chí, không phải trang HTML.
 */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string;
function decodeEntities(text: null | undefined): null;
function decodeEntities(text: string | null | undefined): string | null;
function decodeEntities(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (found) => ENTITIES[found] ?? found);
}

function toPaper(work: OpenAlexWork): Paper | null {
  const title = decodeEntities(work.title)?.trim();
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
    publishedOn: readDate(work.publication_date),
    journal: decodeEntities(work.primary_location?.source?.display_name)?.trim() ?? null,
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

/** Mốc "N ngày trước" dạng YYYY-MM-DD, đúng định dạng filter của OpenAlex. */
function daysAgo(days: number): string {
  const at = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return at.toISOString().slice(0, 10);
}

/**
 * OpenAlex trả `publication_date` đã đúng dạng ISO, nhưng vẫn kiểm lại hình
 * dạng: một chuỗi lệch định dạng lọt vào sẽ làm hỏng phép so sánh chuỗi mà
 * `rank()` dùng để xếp bài mới nhất, và hỏng im lặng — chỉ thấy thứ tự lạ.
 */
function readDate(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
