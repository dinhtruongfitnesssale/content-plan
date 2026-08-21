import { consensus, isConsensusEnabled } from "./consensus";
import { openalex } from "./openalex";
import { pubmed } from "./pubmed";
import {
  type EvidenceTier,
  type Paper,
  type Provider,
  type ProviderId,
  type SearchOptions,
  tierRank,
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

  const papers = rank(dedupe(collected), opts.tiers);
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
 * Xếp hạng theo bậc bằng chứng trước, rồi mới đến năm và lượt trích dẫn.
 * Bài đăng cần dẫn chứng mạnh chứ không cần nghiên cứu mới nhất — một
 * phân tích gộp năm 2019 đáng tin hơn một nghiên cứu quan sát năm 2025.
 */
function rank(papers: Paper[], tiers?: EvidenceTier[]): Paper[] {
  const wanted = tiers?.length && !tiers.includes("khac") ? new Set(tiers) : null;

  const filtered = wanted
    ? papers.filter((paper) => wanted.has(toTier(paper.studyTypes)))
    : papers;

  return filtered.sort((a, b) => {
    const byTier = tierRank(toTier(a.studyTypes)) - tierRank(toTier(b.studyTypes));
    if (byTier !== 0) return byTier;

    const byAbstract = Number(Boolean(b.abstract)) - Number(Boolean(a.abstract));
    if (byAbstract !== 0) return byAbstract;

    const byYear = (b.year ?? 0) - (a.year ?? 0);
    if (byYear !== 0) return byYear;

    return (b.citedByCount ?? 0) - (a.citedByCount ?? 0);
  });
}
