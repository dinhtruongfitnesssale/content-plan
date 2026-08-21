"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  EmptyNote,
  ErrorNote,
  Eyebrow,
  Num,
  PageHeader,
  Quoted,
  StrengthBadge,
} from "@/components/ui";
import { TIER_GROUPS, TIER_LABEL, toTier, type EvidenceTier } from "@/lib/research";
import {
  clearResearchCache,
  minutesLeft,
  readResearchCache,
  writeResearchCache,
} from "@/lib/research-cache";
import { HANDOFF_KEY, type Finding, type Paper, type ResearchResponse } from "@/lib/types";

const YEAR_CHOICES = [
  { value: 0, label: "Mọi năm" },
  { value: 2015, label: "Từ 2015" },
  { value: 2020, label: "Từ 2020" },
] as const;

export function ResearchWorkbench() {
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState("");
  const [yearMin, setYearMin] = useState<number>(2015);
  const [tiers, setTiers] = useState<EvidenceTier[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  /** Mốc lượt tra cứu đang hiển thị — null nghĩa là chưa có gì để giữ. */
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const didInit = useRef(false);

  /**
   * Lượt dựng đầu tiên: khôi phục kết quả cũ nếu còn hạn.
   * Trang "Hôm nay" chuyển chủ đề sang đây qua ?chu-de= — chủ đề đó là ý định
   * mới của người dùng nên thắng kết quả cũ, trừ khi trùng đúng chủ đề đã tra.
   */
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const seeded = params.get("chu-de");
    const cached = readResearchCache();

    if (cached && (!seeded || seeded === cached.query)) {
      // localStorage chỉ đọc được ở trình duyệt nên phải đặt state sau khi
      // hydrate xong — đọc sớm hơn thì server và client dựng ra hai cây khác nhau.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(cached.query);
      setYearMin(cached.yearMin);
      setTiers(cached.tiers);
      setResult(cached.result);
      setChosen(new Set(cached.chosen));
      setSavedAt(cached.savedAt);
      return;
    }

    if (seeded) {
      setQuery(seeded);
      // Chủ đề khác hẳn — kết quả cũ không còn liên quan, dọn luôn.
      if (cached) clearResearchCache();
    }
  }, [params]);

  /**
   * Ghi lại mỗi khi kết quả hoặc lựa chọn đổi. Mốc hết hạn vẫn tính từ lượt
   * tra cứu, nên bấm chọn thêm phát hiện không kéo dài thêm 10 phút.
   */
  useEffect(() => {
    if (!result || savedAt === null) return;
    writeResearchCache({
      query: result.query,
      yearMin,
      tiers,
      result,
      chosen: [...chosen],
      savedAt,
    });
  }, [result, chosen, savedAt, yearMin, tiers]);

  function forget() {
    clearResearchCache();
    setResult(null);
    setChosen(new Set());
    setSavedAt(null);
    setError(null);
  }

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2 || pending) return;

    setPending(true);
    setError(null);
    setResult(null);
    setChosen(new Set());
    // Tra cứu chủ đề mới thì kết quả cũ hết giá trị — dọn ngay, đừng để lỡ
    // tải lại trang giữa chừng lại thấy kết quả của chủ đề trước.
    setSavedAt(null);
    clearResearchCache();

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          yearMin: yearMin || undefined,
          tiers: tiers.length > 0 ? tiers : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Lỗi ${res.status}`);
      setResult(json as ResearchResponse);
      setSavedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lỗi không rõ");
    } finally {
      setPending(false);
    }
  }

  function toggleTier(tier: EvidenceTier) {
    setTiers((current) =>
      current.includes(tier) ? current.filter((t) => t !== tier) : [...current, tier],
    );
  }

  function toggleFinding(index: number) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handOff() {
    if (!result || chosen.size === 0) return;

    const findings = [...chosen].sort((a, b) => a - b).map((i) => result.findings[i]);
    const usedIds = new Set(findings.flatMap((finding) => finding.paperIds));

    sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({
        topic: result.query,
        findings,
        papers: result.papers.filter((paper) => usedIds.has(paper.id)),
      }),
    );
    router.push("/soan-bai");
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Nghiên cứu"
        title="Tra cứu bằng chứng"
        lede="Tìm trên PubMed và OpenAlex, rồi rút thành những phát hiện có thể dẫn thẳng vào bài. Mọi con số đều trích từ abstract gốc — bấm vào nguồn để đọc lại trước khi đăng."
      />

      <form onSubmit={run} className="space-y-5">
        <div className="rule flex items-baseline gap-4 border-b pb-3">
          <label htmlFor="q" className="eyebrow shrink-0">
            Chủ đề
          </label>
          <input
            id="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="creatine cho phụ nữ tuổi trung niên"
            className="w-full bg-transparent font-serif text-2xl outline-none placeholder:text-ink/25"
            autoComplete="off"
          />
        </div>

        <p className="text-xs text-ink/45">
          Nguồn dữ liệu là tiếng Anh — gõ từ khoá tiếng Anh cho kết quả sát hơn. Phát
          hiện trả về vẫn bằng tiếng Việt.
        </p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <FilterGroup label="Năm">
            {YEAR_CHOICES.map((choice) => (
              <Chip
                key={choice.value}
                active={yearMin === choice.value}
                onClick={() => setYearMin(choice.value)}
              >
                {choice.label}
              </Chip>
            ))}
          </FilterGroup>

        </div>

        <EvidencePyramidFilter selected={tiers} onToggle={toggleTier} onClear={() => setTiers([])} />

        <Button type="submit" disabled={pending || query.trim().length < 2}>
          {pending ? "Đang đọc nghiên cứu…" : "Tra cứu"}
        </Button>
      </form>

      {error && <ErrorNote>{error}</ErrorNote>}

      {pending && (
        <p className="text-sm text-ink/50">
          Đang tìm trên PubMed và OpenAlex, rồi đọc abstract. Mất khoảng 20–40 giây.
        </p>
      )}

      {result && savedAt !== null && <KeptNote savedAt={savedAt} onForget={forget} />}

      {result && (
        <Results
          result={result}
          chosen={chosen}
          onToggle={toggleFinding}
          onCompose={handOff}
        />
      )}
    </div>
  );
}

/**
 * Cho biết kết quả đang được giữ và giữ tới bao giờ.
 *
 * Nói rõ số phút còn lại thay vì im lặng: người dùng cần biết cái mình đang
 * nhìn là kết quả vừa tra hay kết quả khôi phục từ lượt trước.
 */
function KeptNote({ savedAt, onForget }: { savedAt: number; onForget: () => void }) {
  const left = minutesLeft(savedAt);

  return (
    <div className="rule flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-xs text-ink/45">
        Kết quả được giữ lại — tải lại trang vẫn còn, tự xoá sau{" "}
        <Num>{left}</Num> phút nữa. Tra chủ đề khác là thay luôn.
      </p>
      <button
        type="button"
        onClick={onForget}
        className="text-xs text-ink/45 underline decoration-ink/20 underline-offset-2 transition-colors hover:text-ink"
      >
        Xoá kết quả
      </button>
    </div>
  );
}

function Results({
  result,
  chosen,
  onToggle,
  onCompose,
}: {
  result: ResearchResponse;
  chosen: Set<number>;
  onToggle: (index: number) => void;
  onCompose: () => void;
}) {
  const papersById = new Map(result.papers.map((paper) => [paper.id, paper]));

  return (
    <div className="space-y-10">
      <SourceLine result={result} />

      {result.note && <EmptyNote>{result.note}</EmptyNote>}

      {result.droppedCount > 0 && (
        <ErrorNote>
          Đã loại <Num>{result.droppedCount}</Num> phát hiện vì dẫn tới nghiên cứu không có
          trong kết quả tìm được. Chỉ những phát hiện kiểm chứng được mới hiện ở đây.
        </ErrorNote>
      )}

      {result.findings.length > 0 && (
        <section className="space-y-5">
          <div className="rule flex items-baseline justify-between border-b pb-3">
            <Eyebrow>Phát hiện</Eyebrow>
            <span className="text-xs text-ink/45">
              đã chọn <Num>{chosen.size}</Num>/<Num>{result.findings.length}</Num>
            </span>
          </div>

          <ul className="space-y-4">
            {result.findings.map((finding, index) => (
              <li key={index}>
                <FindingCard
                  finding={finding}
                  papers={finding.paperIds
                    .map((id) => papersById.get(id))
                    .filter((paper): paper is Paper => paper !== undefined)}
                  selected={chosen.has(index)}
                  onToggle={() => onToggle(index)}
                />
              </li>
            ))}
          </ul>

          <div className="rule flex items-center gap-4 border-t pt-5">
            <Button onClick={onCompose} disabled={chosen.size === 0}>
              Soạn bài với {chosen.size} phát hiện
            </Button>
            {chosen.size === 0 && (
              <span className="text-xs text-ink/45">Chọn ít nhất một phát hiện.</span>
            )}
          </div>
        </section>
      )}

      <PaperList papers={result.papers} />
    </div>
  );
}

function SourceLine({ result }: { result: ResearchResponse }) {
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink/50">
      {result.sources.map((source) => (
        <span key={source.id}>
          {source.label}{" "}
          {source.error ? (
            <span className="text-clay">không phản hồi</span>
          ) : (
            <>
              <Num>{source.count}</Num> bài
            </>
          )}
        </span>
      ))}
      <span>
        · sau khi gộp: <Num>{result.papers.length}</Num> bài
      </span>
    </p>
  );
}

function FindingCard({
  finding,
  papers,
  selected,
  onToggle,
}: {
  finding: Finding;
  papers: Paper[];
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card selected={selected}>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={selected}
          aria-label={selected ? "Bỏ chọn phát hiện" : "Chọn phát hiện"}
          className={`mt-1 size-4 shrink-0 border transition-colors ${
            selected ? "border-ink bg-ink" : "border-ink/35 hover:border-ink/70"
          }`}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <button type="button" onClick={onToggle} className="block w-full text-left">
            <p className="font-serif text-lg leading-snug">{finding.claim}</p>
          </button>

          <p className="text-sm leading-relaxed text-ink/75">
            <Quoted>{finding.evidence}</Quoted>
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <StrengthBadge strength={finding.strength} />
            <span className="text-xs text-ink/50">Góc viết: {finding.angle}</span>
          </div>

          {finding.caveat && (
            <p className="border-l-2 border-slate/35 py-0.5 pl-3 text-xs leading-relaxed text-slate">
              Cần nói rõ khi đăng: {finding.caveat}
            </p>
          )}

          <ul className="space-y-1 pt-1">
            {papers.map((paper) => (
              <li key={paper.id} className="text-xs leading-relaxed">
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber underline decoration-amber/35 underline-offset-2 hover:decoration-amber"
                >
                  {paper.title}
                </a>{" "}
                <span className="text-ink/40">
                  <Num>{paper.year ?? "?"}</Num>
                  {paper.journal ? ` · ${paper.journal}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function PaperList({ papers }: { papers: Paper[] }) {
  if (papers.length === 0) return null;

  return (
    <details className="group">
      <summary className="rule cursor-pointer border-t pt-5 text-sm text-ink/55 hover:text-ink">
        Xem toàn bộ <Num>{papers.length}</Num> bài tìm được
      </summary>

      <ul className="mt-5 space-y-4">
        {papers.map((paper) => (
          <li key={paper.id} className="rule border-b pb-4 last:border-0">
            <a
              href={paper.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm leading-snug hover:text-amber"
            >
              {paper.title}
            </a>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-ink/45">
              <span>{TIER_LABEL[toTier(paper.studyTypes)]}</span>
              <span>
                <Num>{paper.year ?? "?"}</Num>
              </span>
              {paper.journal && <span>{paper.journal}</span>}
              {paper.citedByCount !== null && (
                <span>
                  <Num>{paper.citedByCount}</Num> trích dẫn
                </span>
              )}
              {paper.isOpenAccess && <span className="text-herb">đọc miễn phí</span>}
              {!paper.abstract && <span className="text-ink/30">không có abstract</span>}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Bộ lọc theo tháp Evidence Hierarchy (EBM pyramid).
 *
 * Xếp từ đỉnh xuống đáy đúng thứ tự tháp, chia theo ba tầng của hình gốc:
 * Synthesized → Experimental → Observational → Preclinical. Chiều rộng chip
 * thu dần theo bậc để nhìn ra dáng tháp mà không phải vẽ hình.
 *
 * Nhãn để nguyên tiếng Anh: đây là thuật ngữ chuẩn của ngành, dịch ra tiếng
 * Việt thì mỗi sách một kiểu và khó đối chiếu với chính abstract đang đọc.
 */
function EvidencePyramidFilter({
  selected,
  onToggle,
  onClear,
}: {
  selected: EvidenceTier[];
  onToggle: (tier: EvidenceTier) => void;
  onClear: () => void;
}) {
  // Đỉnh tháp rộng nhất, xuống đáy hẹp dần — ngược chiều hình vẽ, vì ở đây
  // thứ mạnh nhất mới đáng chiếm chỗ.
  const widths = ["96%", "88%", "80%", "72%", "64%", "56%", "48%", "40%"];
  let row = 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="eyebrow">Evidence hierarchy</span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-ink/45 underline decoration-ink/20 underline-offset-2 transition-colors hover:text-ink"
          >
            Bỏ lọc
          </button>
        )}
      </div>

      <div className="space-y-3">
        {TIER_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.625rem] tracking-wide text-ink/35 uppercase">
              {group.label}
            </span>
            {group.tiers.map((tier) => {
              const active = selected.includes(tier);
              const width = widths[Math.min(row++, widths.length - 1)];

              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => onToggle(tier)}
                  style={{ maxWidth: width }}
                  aria-pressed={active}
                  className={`border px-3 py-1.5 text-left text-xs transition-colors ${
                    active
                      ? "border-ink bg-ink/[0.04] text-ink"
                      : "border-ink/15 text-ink/55 hover:border-ink/40 hover:text-ink"
                  }`}
                >
                  {TIER_LABEL[tier]}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="text-xs text-ink/45">
        Không chọn gì thì lấy tất cả — kết quả vẫn luôn xếp theo tháp, mạnh trước.
      </p>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow mr-1">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-ink text-ink"
          : "border-ink/15 text-ink/55 hover:border-ink/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
