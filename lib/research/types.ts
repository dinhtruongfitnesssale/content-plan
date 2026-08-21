/** Dạng chuẩn hoá mà mọi nguồn nghiên cứu phải trả về. */
export type Paper = {
  /** Khoá ổn định, dùng làm neo khi model tham chiếu. VD: "pubmed:42588107". */
  id: string;
  source: ProviderId;
  title: string;
  abstract: string | null;
  authors: string[];
  year: number | null;
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
  signal?: AbortSignal;
};

export type Provider = {
  id: ProviderId;
  label: string;
  search(query: string, opts: SearchOptions): Promise<Paper[]>;
};

/**
 * Bậc bằng chứng, xếp từ mạnh xuống yếu. Bài đăng cần bằng chứng mạnh
 * chứ không cần nghiên cứu mới nhất — nên đây là tiêu chí xếp hạng đầu tiên.
 */
export const EVIDENCE_TIERS = [
  "tong-quan-he-thong",
  "thu-nghiem-ngau-nhien",
  "quan-sat",
  "khac",
] as const;

export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];

export const TIER_LABEL: Record<EvidenceTier, string> = {
  "tong-quan-he-thong": "Tổng quan hệ thống / phân tích gộp",
  "thu-nghiem-ngau-nhien": "Thử nghiệm ngẫu nhiên có đối chứng",
  "quan-sat": "Nghiên cứu quan sát",
  khac: "Khác",
};

const TIER_RANK: Record<EvidenceTier, number> = {
  "tong-quan-he-thong": 0,
  "thu-nghiem-ngau-nhien": 1,
  "quan-sat": 2,
  khac: 3,
};

/**
 * Quy nhãn thô của từng nguồn về một bậc bằng chứng.
 * PubMed dùng PublicationType (MeSH), OpenAlex/Consensus dùng nhãn tự do —
 * nên khớp bằng chuỗi con, không khớp tuyệt đối.
 */
export function toTier(studyTypes: string[]): EvidenceTier {
  const haystack = studyTypes.join(" | ").toLowerCase();

  if (
    haystack.includes("meta-analysis") ||
    haystack.includes("meta analysis") ||
    haystack.includes("systematic review") ||
    haystack.includes("practice guideline") ||
    haystack.includes("guideline")
  ) {
    return "tong-quan-he-thong";
  }
  if (
    haystack.includes("randomized controlled trial") ||
    haystack.includes("randomised controlled trial") ||
    haystack.includes("clinical trial") ||
    haystack.includes("rct")
  ) {
    return "thu-nghiem-ngau-nhien";
  }
  if (
    haystack.includes("cohort") ||
    haystack.includes("observational") ||
    haystack.includes("case-control") ||
    haystack.includes("cross-sectional") ||
    haystack.includes("longitudinal")
  ) {
    return "quan-sat";
  }
  return "khac";
}

export function tierRank(tier: EvidenceTier): number {
  return TIER_RANK[tier];
}
