import { consensus, isConsensusEnabled } from "./consensus";
import { openalex } from "./openalex";
import { pubmed } from "./pubmed";
import {
  type EvidenceTier,
  type Paper,
  type Provider,
  type ProviderId,
  type SearchOptions,
  type SortMode,
  tierRank,
  toTiers,
  toTier,
} from "./types";

export * from "./types";
export { isConsensusEnabled };

export type SearchResult = {
  papers: Paper[];
  /** Nguồn nào chạy được, nguồn nào chết — để hiện lên giao diện, không giấu. */
  sources: { id: ProviderId; label: string; count: number; error: string | null }[];
};

function activeProviders(): Provider[] {
  const providers: Provider[] = [pubmed, openalex];
  if (isConsensusEnabled()) providers.push(consensus);
  return providers;
}

/**
 * Gọi song song mọi nguồn đang bật, gộp kết quả rồi xếp hạng.
 *
 * Dùng allSettled chứ không dùng all: một nguồn chết không được phép làm hỏng
 * cả lượt tìm. Europe PMC từng là nguồn thứ ba ở đây và đã ngừng trả dữ liệu
 * mà vẫn báo HTTP 200 — nên mọi nguồn đều bị coi là có thể hỏng bất kỳ lúc nào.
 */
export async function searchPapers(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchResult> {
  const providers = activeProviders();
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.search(query, opts)),
  );

  const sources: SearchResult["sources"] = [];
  const collected: Paper[] = [];

  settled.forEach((outcome, i) => {
    const provider = providers[i];
    if (outcome.status === "fulfilled") {
      collected.push(...outcome.value);
      sources.push({
        id: provider.id,
        label: provider.label,
        count: outcome.value.length,
        error: null,
      });
    } else {
      sources.push({
        id: provider.id,
        label: provider.label,
        count: 0,
        error: outcome.reason instanceof Error ? outcome.reason.message : "lỗi không rõ",
      });
    }
  });

  const papers = rank(dedupe(collected), opts.tiers, opts.sort ?? "evidence", opts.days);
  return { papers, sources };
}

/** DOI → PMID → tiêu đề chuẩn hoá. Bài nào cũng phải có ít nhất một khoá. */
function keyOf(paper: Paper): string {
  if (paper.doi) return `doi:${paper.doi}`;
  if (paper.pmid) return `pmid:${paper.pmid}`;
  return `title:${normalizeTitle(paper.title)}`;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupe(papers: Paper[]): Paper[] {
  const byKey = new Map<string, Paper>();

  for (const paper of papers) {
    const key = keyOf(paper);
    const existing = byKey.get(key);
    byKey.set(key, existing ? merge(existing, paper) : paper);
  }

  return [...byKey.values()];
}

/**
 * Gộp hai bản ghi cùng một bài từ hai nguồn khác nhau.
 * Nguyên tắc: mỗi trường lấy từ nguồn đáng tin nhất cho trường đó.
 * - studyTypes: PubMed thắng tuyệt đối (nhãn người gán, không phải đoán từ tiêu đề).
 * - abstract: lấy bản dài hơn.
 * - citedByCount / isOpenAccess: PubMed không có, nên bên nào có thì lấy.
 */
function merge(a: Paper, b: Paper): Paper {
  const primary = a.source === "pubmed" ? a : b.source === "pubmed" ? b : a;
  const other = primary === a ? b : a;

  const pubmedTypes = [a, b].find((p) => p.source === "pubmed" && p.studyTypes.length > 0);
  const studyTypes = pubmedTypes
    ? pubmedTypes.studyTypes
    : [...new Set([...a.studyTypes, ...b.studyTypes])];

  return {
    ...primary,
    abstract: longest(primary.abstract, other.abstract),
    authors: primary.authors.length >= other.authors.length ? primary.authors : other.authors,
    year: primary.year ?? other.year,
    // Bên nào có ngày đầy đủ thì thắng, kể cả khi bên đó không phải nguồn
    // chính: PubMed rất hay chỉ có năm cho bài đăng trước bản in.
    publishedOn: primary.publishedOn ?? other.publishedOn,
    journal: primary.journal ?? other.journal,
    doi: primary.doi ?? other.doi,
    pmid: primary.pmid ?? other.pmid,
    citedByCount: primary.citedByCount ?? other.citedByCount,
    isOpenAccess: primary.isOpenAccess || other.isOpenAccess,
    // Chỉ Consensus cung cấp hai trường này — bên nào có thì lấy.
    takeaway: primary.takeaway ?? other.takeaway,
    sampleSize: primary.sampleSize ?? other.sampleSize,
    studyTypes,
  };
}

function longest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
}

/**
 * Lọc theo bậc bằng chứng rồi xếp hạng theo chế độ đang chọn.
 *
 * `evidence` (mặc định): bậc bằng chứng trước, rồi mới đến năm và lượt trích
 * dẫn. Bài đăng cần dẫn chứng mạnh chứ không cần nghiên cứu mới nhất — một
 * phân tích gộp năm 2019 đáng tin hơn một nghiên cứu quan sát năm 2025.
 *
 * `recent`: ngày xuất bản trước. Bảng tin trả lời câu hỏi khác hẳn — "tuần
 * này có gì mới" — nên xếp theo bậc ở đây sẽ chôn đúng thứ người ta vào xem.
 * Bậc bằng chứng vẫn là tiêu chí phụ, và bộ lọc tháp vẫn chạy y như cũ.
 */
function rank(
  papers: Paper[],
  tiers?: EvidenceTier[],
  sort: SortMode = "evidence",
  days?: number,
): Paper[] {
  const wanted = tiers?.length && !tiers.includes("other") ? new Set(tiers) : null;

  // Lọc theo MỌI bậc bài khớp, không chỉ bậc đại diện — nếu không thì chọn
  // "Systematic Review" sẽ ra rỗng, vì phần lớn tổng quan hệ thống đồng thời
  // mang nhãn phân tích gộp và bị quy lên bậc trên.
  let filtered = wanted
    ? papers.filter((paper) => toTiers(paper.studyTypes).some((tier) => wanted.has(tier)))
    : papers;

  // Chặn lại cửa sổ ngày một lần nữa ở tầng này, sau khi đã gộp nguồn.
  //
  // Không thừa: hai nguồn hiểu "ngày xuất bản" khác nhau. PubMed lọc theo ngày
  // của số tạp chí, nhưng ngày ta HIỆN ra là ngày lên mạng — mà bài điện tử ra
  // trước bản in cả năm là chuyện thường. Kết quả là bài ghi 07/2025 lọt vào
  // bảng tin "90 ngày gần đây" và trông như lỗi. Ai thấy cũng nghĩ app sai,
  // và họ đúng: cái hiện ra phải khớp với cái vừa hỏi.
  if (days) {
    const cutoff = dayNumber(new Date(Date.now() - days * 86_400_000));
    filtered = filtered.filter((paper) => dateKey(paper) >= cutoff);
  }

  return filtered.sort((a, b) => {
    if (sort === "recent") {
      const byDate = dateKey(b) - dateKey(a);
      if (byDate !== 0) return byDate;
    } else {
      const byTier = tierRank(toTier(a.studyTypes)) - tierRank(toTier(b.studyTypes));
      if (byTier !== 0) return byTier;
    }

    const byAbstract = Number(Boolean(b.abstract)) - Number(Boolean(a.abstract));
    if (byAbstract !== 0) return byAbstract;

    if (sort === "recent") {
      const byTier = tierRank(toTier(a.studyTypes)) - tierRank(toTier(b.studyTypes));
      if (byTier !== 0) return byTier;
    } else {
      const byYear = (b.year ?? 0) - (a.year ?? 0);
      if (byYear !== 0) return byYear;
    }

    return (b.citedByCount ?? 0) - (a.citedByCount ?? 0);
  });
}

/**
 * Mốc thời gian để so sánh, dạng số YYYYMMDD.
 *
 * Bài chỉ có năm được quy về **cuối năm** chứ không phải đầu năm: một bài ghi
 * "2026" mà đang ở giữa năm 2026 thì nhiều khả năng vừa ra, đẩy nó xuống dưới
 * mọi bài tháng 1 có ngày đầy đủ là xếp sai. Không có gì cả thì về 0 — xuống
 * cuối danh sách, đúng chỗ của một bài không rõ ngày trong bảng tin.
 */
function dateKey(paper: Paper): number {
  if (paper.publishedOn) return Number(paper.publishedOn.replace(/-/g, ""));
  return paper.year ? paper.year * 10000 + 1231 : 0;
}

/** Cùng dạng số YYYYMMDD như `dateKey`, để so sánh được với nhau. */
function dayNumber(at: Date): number {
  return at.getFullYear() * 10000 + (at.getMonth() + 1) * 100 + at.getDate();
}
