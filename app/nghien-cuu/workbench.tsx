"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Chip, EvidencePyramidFilter, FilterGroup } from "@/components/evidence-filter";
import { pickRelated } from "@/lib/compose";
import { TIER_LABEL, toTier, type EvidenceTier } from "@/lib/research";
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

/**
 * Bao nhiêu bài kéo về mỗi nguồn. Càng nhiều thì càng có chỗ để chọn và danh
 * mục trích dẫn càng dày, nhưng lượt tra cứu cũng lâu hơn.
 */
const DEPTH_CHOICES = [
  { value: 8, label: "8 bài" },
  { value: 12, label: "12 bài" },
  { value: 16, label: "16 bài" },
  { value: 20, label: "20 bài" },
] as const;

/**
 * Trang Nghiên cứu — tra cứu, rồi tích chọn thứ muốn đẩy sang bên viết bài.
 *
 * Trước đây có hai trang: trang này bắt chọn tay từng phát hiện cho bài một ý,
 * còn trang Tổng hợp tự dùng hết phát hiện cho bài gộp. Hai trang tra cùng một
 * API, hỏi cùng một chủ đề, chỉ khác ở chỗ ai chọn dẫn chứng — nên đã gộp làm
 * một: tra một lượt, tích bao nhiêu tuỳ ý, chọn nhiều thì bên kia viết bài gộp.
 *
 * Ô tích có ở HAI chỗ và hai chỗ đó khác nhau:
 * - Tích một PHÁT HIỆN là đưa số liệu của nó vào thân bài. Bài nghiên cứu đứng
 *   sau phát hiện đó tự động vào danh mục trích dẫn.
 * - Tích một NGHIÊN CỨU là chỉ đưa bài đó vào danh mục, dưới mục "đọc thêm" —
 *   model không được dẫn số liệu từ nó, vì abstract của nó chưa qua
 *   `verifyFindings()` để rút thành phát hiện kiểm chứng được.
 */
export function ResearchWorkbench() {
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState("");
  const [yearMin, setYearMin] = useState<number>(2015);
  const [depth, setDepth] = useState<number>(12);
  const [tiers, setTiers] = useState<EvidenceTier[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  /** Bài tích thêm cho mục "đọc thêm" — theo id, không theo chỉ số. */
  const [chosenPapers, setChosenPapers] = useState<Set<string>>(new Set());
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
      setChosenPapers(new Set(cached.chosenPapers));
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
      chosenPapers: [...chosenPapers],
      savedAt,
    });
  }, [result, chosen, chosenPapers, savedAt, yearMin, tiers]);

  /**
   * Chia tập bài thành hai nhóm theo lựa chọn hiện tại.
   *
   * `cited` là bài đứng sau phát hiện đã tích — chúng vào danh mục dù người
   * dùng có tự tay tích hay không, vì thân bài dẫn số liệu của chúng. `extra`
   * là phần tích thêm, và chỉ những bài KHÔNG nằm trong `cited` mới tính, để
   * cùng một nghiên cứu không hiện hai lần trong danh mục.
   */
  const selection = useMemo(() => {
    if (!result) {
      return { findings: [] as Finding[], cited: [] as Paper[], extra: [] as Paper[] };
    }

    const findings = [...chosen].sort((a, b) => a - b).map((index) => result.findings[index]);
    const citedIds = new Set(findings.flatMap((finding) => finding.paperIds));

    return {
      findings,
      cited: result.papers.filter((paper) => citedIds.has(paper.id)),
      extra: result.papers.filter(
        (paper) => !citedIds.has(paper.id) && chosenPapers.has(paper.id),
      ),
    };
  }, [result, chosen, chosenPapers]);

  function forget() {
    clearResearchCache();
    setResult(null);
    setChosen(new Set());
    setChosenPapers(new Set());
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
    setChosenPapers(new Set());
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
          limit: depth,
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

  function togglePaper(id: string) {
    setChosenPapers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Tích hết phát hiện — đúng cách bài tổng hợp cũ dựng dẫn chứng. */
  function chooseAllFindings() {
    if (!result) return;
    setChosen(new Set(result.findings.map((_, index) => index)));
  }

  /**
   * Tích thêm các bài CÙNG CHỦ ĐỀ vào mục đọc thêm — đi qua `pickRelated()`
   * chứ không quét sạch danh sách.
   *
   * Lý do: `searchPapers` không cắt tổng số sau khi gộp, mỗi nguồn trả về
   * `limit` bài nên đuôi tập gộp khớp rất lỏng. Tích tay từng bài thì người
   * dùng nhìn tiêu đề rồi tự quyết; bấm một nút quét sạch thì không ai đọc, và
   * bài lạc đề đi thẳng vào danh mục trích dẫn của bài đăng dưới nhãn "cùng
   * chủ đề" — mà đó là một lời khẳng định.
   */
  function chooseRelated() {
    if (!result) return;
    const citedIds = new Set(selection.findings.flatMap((finding) => finding.paperIds));
    const rest = result.papers.filter((paper) => !citedIds.has(paper.id));
    const onTopic = pickRelated(rest, result.query, rest.length);
    setChosenPapers(new Set(onTopic.map((paper) => paper.id)));
  }

  function handOff() {
    if (!result || selection.findings.length === 0) return;

    sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({
        topic: result.query,
        findings: selection.findings,
        papers: [...selection.cited, ...selection.extra],
      }),
    );
    router.push("/soan-bai");
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Nghiên cứu"
        title="Tra cứu & chọn dẫn chứng"
        lede="Tìm trên PubMed và OpenAlex, rồi rút thành những phát hiện dẫn thẳng được vào bài. Tích những gì muốn dùng rồi đẩy sang trang Soạn bài — chọn một phát hiện thì ra bài một ý, chọn nhiều thì ra bài gộp. Bài nào cũng có danh mục trích dẫn đánh số ở cuối."
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

          <FilterGroup label="Độ dày">
            {DEPTH_CHOICES.map((choice) => (
              <Chip
                key={choice.value}
                active={depth === choice.value}
                onClick={() => setDepth(choice.value)}
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
          chosenPapers={chosenPapers}
          citedIds={new Set(selection.cited.map((paper) => paper.id))}
          extraCount={selection.extra.length}
          onToggleFinding={toggleFinding}
          onTogglePaper={togglePaper}
          onChooseAllFindings={chooseAllFindings}
          onClearFindings={() => setChosen(new Set())}
          onChooseRelated={chooseRelated}
          onClearPapers={() => setChosenPapers(new Set())}
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
  chosenPapers,
  citedIds,
  extraCount,
  onToggleFinding,
  onTogglePaper,
  onChooseAllFindings,
  onClearFindings,
  onChooseRelated,
  onClearPapers,
  onCompose,
}: {
  result: ResearchResponse;
  chosen: Set<number>;
  chosenPapers: Set<string>;
  citedIds: Set<string>;
  extraCount: number;
  onToggleFinding: (index: number) => void;
  onTogglePaper: (id: string) => void;
  onChooseAllFindings: () => void;
  onClearFindings: () => void;
  onChooseRelated: () => void;
  onClearPapers: () => void;
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
          <div className="rule flex flex-wrap items-baseline justify-between gap-3 border-b pb-3">
            <Eyebrow>Phát hiện — tích để đưa số liệu vào bài</Eyebrow>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-ink/45">
                đã chọn <Num>{chosen.size}</Num>/<Num>{result.findings.length}</Num>
              </span>
              <TextAction onClick={onChooseAllFindings}>Chọn tất cả</TextAction>
              {chosen.size > 0 && <TextAction onClick={onClearFindings}>Bỏ chọn</TextAction>}
            </div>
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
                  onToggle={() => onToggleFinding(index)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <PaperList
        papers={result.papers}
        chosenPapers={chosenPapers}
        citedIds={citedIds}
        onToggle={onTogglePaper}
        onChooseRelated={onChooseRelated}
        onClear={onClearPapers}
      />

      <div className="rule flex flex-wrap items-center gap-4 border-t pt-5">
        <Button onClick={onCompose} disabled={chosen.size === 0}>
          Soạn bài với {chosen.size} phát hiện
        </Button>
        {chosen.size === 0 ? (
          <span className="text-xs text-ink/45">
            Tích ít nhất một phát hiện — bài phải có số liệu kiểm chứng được để dựa vào.
          </span>
        ) : (
          <span className="text-xs text-ink/45">
            Danh mục trích dẫn sẽ có <Num>{citedIds.size + extraCount}</Num> nghiên cứu:{" "}
            <Num>{citedIds.size}</Num> dẫn trong bài
            {extraCount > 0 && (
              <>
                , <Num>{extraCount}</Num> đọc thêm
              </>
            )}
            .
          </span>
        )}
      </div>
    </div>
  );
}

/** Nút chữ nhỏ cho các thao tác phụ — không tranh chỗ với nút chính nền mực. */
function TextAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-ink/45 underline decoration-ink/20 underline-offset-2 transition-colors hover:text-ink"
    >
      {children}
    </button>
  );
}

/** Ô tích vuông dùng chung cho phát hiện và nghiên cứu. */
function TickBox({
  checked,
  locked,
  onToggle,
  label,
}: {
  checked: boolean;
  locked?: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={locked ? undefined : onToggle}
      disabled={locked}
      aria-pressed={checked}
      aria-label={label}
      className={`mt-1 size-4 shrink-0 border transition-colors ${
        checked ? "border-ink bg-ink" : "border-ink/35 hover:border-ink/70"
      } ${locked ? "cursor-not-allowed opacity-45" : ""}`}
    />
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
        <TickBox
          checked={selected}
          onToggle={onToggle}
          label={selected ? "Bỏ chọn phát hiện" : "Chọn phát hiện"}
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

/**
 * Toàn bộ bài tìm được, mỗi bài một ô tích.
 *
 * Bài đã đứng sau một phát hiện được chọn thì hiện ô tích đã đánh dấu và khoá
 * lại: nó vào danh mục dù có tích hay không, và cho bỏ tích ở đây thì bài đăng
 * dẫn số liệu của một nghiên cứu không có trong danh mục — đúng kiểu dẫn nguồn
 * hỏng mà app này không cho phép xảy ra.
 */
function PaperList({
  papers,
  chosenPapers,
  citedIds,
  onToggle,
  onChooseRelated,
  onClear,
}: {
  papers: Paper[];
  chosenPapers: Set<string>;
  citedIds: Set<string>;
  onToggle: (id: string) => void;
  onChooseRelated: () => void;
  onClear: () => void;
}) {
  if (papers.length === 0) return null;

  const extraCount = papers.filter(
    (paper) => !citedIds.has(paper.id) && chosenPapers.has(paper.id),
  ).length;

  return (
    <section className="space-y-5">
      <div className="rule flex flex-wrap items-baseline justify-between gap-3 border-b pb-3">
        <Eyebrow>Nghiên cứu tìm được — tích để thêm vào danh mục</Eyebrow>
        <div className="flex items-baseline gap-4">
          <span className="text-xs text-ink/45">
            <Num>{citedIds.size}</Num> dẫn trong bài · <Num>{extraCount}</Num> đọc thêm
          </span>
          <TextAction onClick={onChooseRelated}>Chọn bài cùng chủ đề</TextAction>
          {extraCount > 0 && <TextAction onClick={onClear}>Bỏ chọn</TextAction>}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-ink/45">
        Tích ở đây chỉ đưa bài vào danh mục cuối bài dưới mục «đọc thêm». Số liệu trong
        thân bài vẫn chỉ lấy từ phát hiện đã tích ở trên — abstract chưa rút thành phát
        hiện thì chưa qua rào chắn kiểm chứng.
      </p>

      <ul className="space-y-4">
        {papers.map((paper) => {
          const cited = citedIds.has(paper.id);
          const checked = cited || chosenPapers.has(paper.id);

          return (
            <li key={paper.id} className="rule flex gap-4 border-b pb-4 last:border-0">
              <TickBox
                checked={checked}
                locked={cited}
                onToggle={() => onToggle(paper.id)}
                label={checked ? "Bỏ chọn nghiên cứu" : "Chọn nghiên cứu"}
              />

              <div className="min-w-0 flex-1">
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
                  {cited && <span className="text-ink/55">đã kèm theo phát hiện</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
