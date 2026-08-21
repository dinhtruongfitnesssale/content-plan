import type { EvidenceTier, Paper, Provider, SearchOptions } from "./types";

const API = "https://api.consensus.app/v1/search";

/**
 * Adapter Consensus — chỉ chạy khi có CONSENSUS_API_KEY.
 *
 * Consensus tính tiền theo lượt gọi (khởi điểm $0.10 + phí nền tảng), đắt hơn
 * toàn bộ chi phí sinh một bài viết. Đổi lại nó cho ba thứ PubMed và OpenAlex
 * không có:
 *   - `sample_size` và `population_type` đã bóc tách sẵn → cân độ mạnh bằng
 *     chứng chính xác hơn nhiều so với đoán từ loại nghiên cứu. Lưu ý: hai
 *     trường này CÓ THỂ VẮNG hoàn toàn trong response (đã thấy với bài tổng
 *     quan tường thuật — không có cỡ mẫu duy nhất để bóc). Đừng coi là chắc có.
 *   - `takeaway` — câu kết luận một dòng do Consensus rút sẵn.
 *   - `semantic_score` — điểm liên quan ngữ nghĩa, không phải khớp từ khoá.
 *
 * Dùng endpoint /v1/search. Endpoint /v1/quick_search cũ đã deprecated và sẽ
 * bị gỡ ngày 2027-02-07 — đừng quay lại dùng nó.
 */
export const consensus: Provider = {
  id: "consensus",
  label: "Consensus",
  async search(query, opts) {
    const key = process.env.CONSENSUS_API_KEY;
    if (!key) return [];

    const params = new URLSearchParams({
      query,
      page_size: String(Math.min(opts.limit ?? 12, 20)),
      // Có trả tiền thì lấy đủ tín hiệu để xếp hạng.
      include_semantic_score: "true",
    });

    if (opts.yearMin) params.set("year_min", String(opts.yearMin));
    if (opts.yearMax) params.set("year_max", String(opts.yearMax));

    // Bộ lọc loại nghiên cứu ngay từ phía Consensus — đây là thứ đáng tiền
    // nhất ở đây, lọc trước thì không phải trả tiền cho bài không dùng được.
    const studyTypes = opts.tiers?.length
      ? [...new Set(opts.tiers.flatMap((tier) => TIER_STUDY_TYPES[tier]))]
      : [];
    for (const type of studyTypes) params.append("study_types", type);

    const res = await fetch(`${API}?${params}`, {
      signal: opts.signal,
      headers: { "x-api-key": key, "user-agent": "ban-viet/1.0" },
    });

    if (!res.ok) {
      // 401/403 nghĩa là key sai hoặc đơn chưa được duyệt — nói rõ ra thay vì
      // để nó lẫn vào lỗi mạng chung.
      if (res.status === 401 || res.status === 403) {
        throw new Error("Key Consensus bị từ chối (kiểm tra lại key hoặc trạng thái duyệt đơn)");
      }
      if (res.status === 429) throw new Error("Consensus báo vượt hạn mức");
      throw new Error(`Consensus ${res.status}`);
    }

    const json = (await res.json()) as SearchResponse;
    return (json.results ?? []).map(toPaper).filter((p): p is Paper => p !== null);
  },
};

export function isConsensusEnabled(): boolean {
  return Boolean(process.env.CONSENSUS_API_KEY);
}

/** Nhãn study_types của Consensus tương ứng với từng bậc bằng chứng. */
const TIER_STUDY_TYPES: Record<EvidenceTier, string[]> = {
  "tong-quan-he-thong": ["meta-analysis", "systematic-review", "literature-review"],
  "thu-nghiem-ngau-nhien": ["rct"],
  "quan-sat": ["case-study", "non-rct-experimental", "non-rct-observational-study"],
  khac: [],
};

type SearchResponse = {
  results?: QueryResult[];
  page?: number;
  page_size?: number;
  is_end?: boolean;
  next_page?: number | null;
};

/** Đúng theo schema QueryResult của /v1/search. */
type QueryResult = {
  title?: string | null;
  abstract?: string | null;
  authors?: string[] | null;
  doi?: string | null;
  url?: string | null;
  journal_name?: string | null;
  publisher_name?: string | null;
  publish_year?: number | null;
  publish_date?: string | null;
  volume?: string | null;
  pages?: string | null;
  citation_count?: number | null;
  influential_citation_count?: number | null;
  semantic_score?: number | null;
  study_type?: string | null;
  takeaway?: string | null;
  sample_size?: number | null;
  study_count?: number | null;
  population_type?: string | null;
  is_preprint?: boolean | null;
  sjr_best_quartile?: number | null;
  countries_of_study?: string[] | null;
  study_duration_days?: number | null;
  institutions?: string[] | null;
};

function toPaper(result: QueryResult): Paper | null {
  const title = result.title?.trim();
  if (!title) return null;

  // Consensus KHÔNG trả về id. Dựng khoá ổn định từ DOI, hoặc URL nếu không có
  // DOI — cần một khoá cố định vì model tham chiếu phát hiện theo id này.
  const doi = result.doi ? result.doi.trim().toLowerCase() : null;
  const anchor = doi ?? result.url;
  if (!anchor) return null;

  return {
    id: `consensus:${anchor}`,
    source: "consensus",
    title,
    abstract: result.abstract?.trim() || null,
    authors: result.authors ?? [],
    year: result.publish_year ?? yearFromDate(result.publish_date),
    journal: result.journal_name ?? result.publisher_name ?? null,
    doi,
    pmid: null,
    // Ưu tiên doi.org: `url` của Consensus trỏ về consensus.app/papers/…, mà
    // link đó đi vào phần Nguồn cuối bài đăng của độc giả. Người đọc Facebook
    // cần link tới nhà xuất bản, không phải tới một công cụ họ chưa từng nghe.
    url: doi ? `https://doi.org/${doi}` : (result.url ?? "#"),
    citedByCount: result.citation_count ?? null,
    studyTypes: readStudyTypes(result),
    // Không có trường open access; preprint thì luôn đọc được miễn phí.
    isOpenAccess: result.is_preprint === true,
    takeaway: result.takeaway?.trim() || null,
    sampleSize: result.sample_size ?? null,
  };
}

/**
 * `study_type` là một chuỗi đơn kiểu "rct" / "meta-analysis". Đổi về nhãn dài
 * để `toTier()` trong types.ts khớp được — hàm đó dò theo chuỗi con tiếng Anh
 * đầy đủ, dùng chung cho cả ba nguồn.
 */
function readStudyTypes(result: QueryResult): string[] {
  // Tham số REQUEST dùng gạch nối ("literature-review") nhưng RESPONSE trả về
  // dấu cách ("literature review"). Chuẩn hoá về một dạng trước khi tra bảng,
  // nếu không mọi nhãn đều trượt và rơi hết xuống bậc "khác".
  const raw = result.study_type?.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const types: string[] = [];

  if (raw) types.push(STUDY_TYPE_LABEL[raw] ?? result.study_type!.trim());

  // population_type cho biết nghiên cứu làm trên người hay động vật — thông tin
  // này phải nổi lên tới bài viết, vì "chuột" và "phụ nữ 40 tuổi" khác hẳn nhau.
  const population = result.population_type?.trim();
  if (population) types.push(population);

  if (result.is_preprint) types.push("Preprint");

  return types;
}

const STUDY_TYPE_LABEL: Record<string, string> = {
  rct: "Randomized Controlled Trial",
  "meta-analysis": "Meta-Analysis",
  "systematic-review": "Systematic Review",
  "literature-review": "Review",
  "case-study": "Case Study",
  "non-rct-experimental": "Non-Randomized Experimental Study",
  "non-rct-observational-study": "Observational Study",
  "in-vitro-trial": "In Vitro Study",
  "animal-trial": "Animal Study",
};

function yearFromDate(date: string | null | undefined): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}
