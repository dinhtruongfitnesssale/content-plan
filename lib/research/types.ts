/** Dạng chuẩn hoá mà mọi nguồn nghiên cứu phải trả về. */
export type Paper = {
  /** Khoá ổn định, dùng làm neo khi model tham chiếu. VD: "pubmed:42588107". */
  id: string;
  source: ProviderId;
  title: string;
  abstract: string | null;
  authors: string[];
  year: number | null;
  /**
   * Ngày xuất bản dạng ISO `YYYY-MM-DD`, khi nguồn cho đủ ngày tháng.
   * Chỉ có `year` thì không xếp được "mới nhất": một năm có hàng nghìn bài,
   * mà bảng tin cần biết bài nào vừa ra tuần này. Consensus chỉ trả năm nên
   * trường này của nó luôn null — khi gộp, bản ghi nào có ngày thì thắng.
   */
  publishedOn: string | null;
  journal: string | null;
  doi: string | null;
  pmid: string | null;
  url: string;
  citedByCount: number | null;
  /** Nhãn gốc từ nguồn, VD "Randomized Controlled Trial", "Meta-Analysis". */
  studyTypes: string[];
  isOpenAccess: boolean;

  /** Câu tóm tắt sẵn của nguồn, nếu có. Hiện chỉ Consensus cung cấp. */
  takeaway: string | null;
  /** Cỡ mẫu, nếu nguồn bóc tách được. Dùng để cân độ mạnh bằng chứng. */
  sampleSize: number | null;
};

export type ProviderId = "pubmed" | "openalex" | "consensus";

export type SearchOptions = {
  limit?: number;
  yearMin?: number;
  yearMax?: number;
  /** Chỉ lấy bài thuộc các bậc bằng chứng này. */
  tiers?: EvidenceTier[];
  /**
   * Chỉ lấy bài trong bao nhiêu ngày gần đây. Dùng cho bảng tin "Mới nhất",
   * nơi mốc thời gian tính bằng tuần chứ không phải bằng năm.
   */
  days?: number;
  /**
   * Xếp theo cái gì.
   * - `evidence` (mặc định): bậc bằng chứng trước, năm sau — dùng khi tra cứu
   *   để viết bài, vì bài đăng cần dẫn chứng mạnh chứ không cần bài mới.
   * - `recent`: ngày xuất bản trước — dùng cho bảng tin, nơi câu hỏi là
   *   "tuần này có gì mới", không phải "bằng chứng nào chắc nhất".
   */
  sort?: SortMode;
  signal?: AbortSignal;
};

export type SortMode = "evidence" | "recent";

export type Provider = {
  id: ProviderId;
  label: string;
  search(query: string, opts: SearchOptions): Promise<Paper[]>;
};

/**
 * Bậc bằng chứng theo tháp Evidence Hierarchy (EBM pyramid), xếp từ đỉnh
 * xuống đáy. Bài đăng cần bằng chứng mạnh chứ không cần nghiên cứu mới nhất —
 * nên đây là tiêu chí xếp hạng đầu tiên.
 *
 * Thứ tự trong mảng CHÍNH LÀ thứ hạng: đổi thứ tự là đổi cách xếp kết quả.
 * "other" luôn đứng cuối và mang nghĩa "không nhận ra thiết kế nghiên cứu".
 */
export const EVIDENCE_TIERS = [
  "meta-analysis",
  "systematic-review",
  "rct",
  "cohort",
  "case-control",
  "cross-sectional",
  "case-series",
  "animal-lab",
  "other",
] as const;

export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];

/** Nhãn tiếng Anh, đúng tên trong tháp EBM — đây là thuật ngữ chuẩn của ngành. */
export const TIER_LABEL: Record<EvidenceTier, string> = {
  "meta-analysis": "Meta-Analysis",
  "systematic-review": "Systematic Review",
  rct: "Randomized Controlled Trial",
  cohort: "Cohort Study",
  "case-control": "Case-Control Study",
  "cross-sectional": "Cross-Sectional Study",
  "case-series": "Case Series / Case Report",
  "animal-lab": "Animal / Laboratory Study",
  other: "Other",
};

/**
 * Ba tầng của tháp, đúng như ngoặc vuông bên trái hình EBM pyramid.
 * "other" không thuộc tầng nào nên không xuất hiện trong bộ lọc.
 */
export const TIER_GROUPS: { label: string; tiers: EvidenceTier[] }[] = [
  { label: "Synthesized evidence", tiers: ["meta-analysis", "systematic-review"] },
  { label: "Experimental", tiers: ["rct"] },
  {
    label: "Observational",
    tiers: ["cohort", "case-control", "cross-sectional", "case-series"],
  },
  { label: "Preclinical", tiers: ["animal-lab"] },
];

/**
 * Chuỗi con nhận diện từng bậc, trong nhãn thô của các nguồn.
 * PubMed dùng PublicationType + MeSH, OpenAlex/Consensus dùng nhãn tự do —
 * nên khớp bằng chuỗi con, không khớp tuyệt đối.
 *
 * Cố tình KHÔNG nhận "clinical trial" trơn cho bậc rct: thử nghiệm pha 1 một
 * nhánh cũng mang nhãn đó, gọi nó là RCT là thổi phồng bằng chứng.
 */
const TIER_NEEDLES: Record<EvidenceTier, string[]> = {
  "meta-analysis": ["meta-analysis", "meta analysis"],
  "systematic-review": ["systematic review"],
  rct: [
    "randomized controlled trial",
    "randomised controlled trial",
    "controlled clinical trial",
    "rct",
  ],
  cohort: ["cohort", "longitudinal"],
  "case-control": ["case-control", "case control"],
  "cross-sectional": ["cross-sectional", "cross sectional"],
  "case-series": ["case report", "case series", "case study"],
  "animal-lab": ["animal", "in vitro", "bench experiment", "laboratory"],
  other: [],
};

/**
 * MỌI bậc mà một bài khớp vào. Một bài thường mang nhiều nhãn cùng lúc —
 * tổng quan hệ thống kèm phân tích gộp là chuyện thường ngày ở PubMed.
 *
 * Đây là hàm dùng để LỌC. Lọc theo bậc cao nhất thôi thì hỏng: chọn
 * "Systematic Review" sẽ trả về rỗng, vì gần như bài nào cũng đồng thời mang
 * nhãn "Meta-Analysis" và bị quy về bậc trên.
 */
export function toTiers(studyTypes: string[]): EvidenceTier[] {
  const hay = studyTypes.join(" | ").toLowerCase();

  const matched = EVIDENCE_TIERS.filter((tier) =>
    TIER_NEEDLES[tier].some((needle) => hay.includes(needle)),
  );
  return matched.length > 0 ? matched : ["other"];
}

/**
 * Bậc ĐẠI DIỆN của một bài — bậc cao nhất trong tháp mà nó khớp.
 *
 * Đây là hàm dùng để HIỂN THỊ và XẾP HẠNG. Phân tích gộp các thử nghiệm ngẫu
 * nhiên phải đọc là "Meta-Analysis", không phải "Randomized Controlled Trial".
 */
export function toTier(studyTypes: string[]): EvidenceTier {
  return toTiers(studyTypes)[0];
}

export function tierRank(tier: EvidenceTier): number {
  const at = EVIDENCE_TIERS.indexOf(tier);
  return at === -1 ? EVIDENCE_TIERS.length : at;
}
