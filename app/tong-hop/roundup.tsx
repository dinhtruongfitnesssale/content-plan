"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button, EmptyNote, ErrorNote, Eyebrow, Num, PageHeader } from "@/components/ui";
import { WritingIndicator } from "@/components/writing-indicator";
import { Chip, EvidencePyramidFilter, FilterGroup } from "@/components/evidence-filter";
import {
  CtaPicker,
  FacebookPreview,
  LengthPicker,
  VoicePicker,
} from "@/components/writing-controls";
import { IllustrationPanel } from "../soan-bai/illustration";
import { PILLARS } from "@/lib/brand";
import { buildCitations, pickRelated, splitCited, type CtaKind } from "@/lib/compose";
import { TIER_LABEL, toTier, type EvidenceTier } from "@/lib/research";
import { getStore } from "@/lib/store";
import { HANDOFF_KEY, type Paper, type ResearchResponse } from "@/lib/types";
import { DEFAULT_VOICE_ID } from "@/lib/voices";
import { countWords, isWithinRange, wordRange } from "@/lib/words";

const YEAR_CHOICES = [
  { value: 0, label: "Mọi năm" },
  { value: 2015, label: "Từ 2015" },
  { value: 2020, label: "Từ 2020" },
] as const;

/** Bao nhiêu bài kéo về. Càng nhiều thì danh mục trích dẫn càng dày, nhưng lâu hơn. */
const DEPTH_CHOICES = [
  { value: 8, label: "8 bài" },
  { value: 12, label: "12 bài" },
  { value: 16, label: "16 bài" },
  { value: 20, label: "20 bài" },
] as const;

type Phase = "idle" | "tra-cuu" | "viet" | "chinh" | "xong";

/**
 * Trang Tổng hợp — một chủ đề vào, một bài gộp ra.
 *
 * Khác trang Nghiên cứu ở chỗ không bắt chọn tay từng phát hiện: ở đây câu hỏi
 * là "cả tập bằng chứng về chuyện này nói gì", nên bài dùng HẾT các phát hiện
 * kiểm chứng được rồi liệt kê đầy đủ nghiên cứu ở cuối. Vẫn đi qua đúng
 * `/api/research` — tức là vẫn qua `verifyFindings()`, rào chắn không có
 * đường vòng.
 */
export function Roundup() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [yearMin, setYearMin] = useState<number>(2015);
  const [depth, setDepth] = useState<number>(16);
  const [tiers, setTiers] = useState<EvidenceTier[]>([]);

  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [targetWords, setTargetWords] = useState(300);
  const [cta, setCta] = useState<CtaKind>("cau-hoi");
  const [pillar, setPillar] = useState<string>(PILLARS[0].id);
  const [includeRelated, setIncludeRelated] = useState(true);

  const [research, setResearch] = useState<ResearchResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  /** Bao nhiêu chữ đã kịp về — đọc được ngay cả trong nhánh catch của lượt bị huỷ. */
  const streamedRef = useRef("");

  const busy = phase === "tra-cuu" || phase === "viet" || phase === "chinh";
  const range = wordRange(targetWords);
  const words = countWords(draft);

  // Chia một lần, dùng cho cả prompt lẫn danh mục cuối bài — hai chỗ phải đếm
  // ra cùng một con số, nếu không thì thân bài nói một đằng, danh mục một nẻo.
  // Nhóm "đọc thêm" còn qua `pickRelated`: tập gộp có cả bài khớp rất lỏng, mà
  // dán nhãn "cùng chủ đề" cho một bài lạc đề cũng là một lời khẳng định sai.
  const split = useMemo(() => {
    if (!research) return { cited: [] as Paper[], related: [] as Paper[], dropped: 0 };
    const { cited, related } = splitCited(research.papers, research.findings);
    const kept = pickRelated(related, research.query);
    return { cited, related: kept, dropped: related.length - kept.length };
  }, [research]);

  const citations = buildCitations(split.cited, includeRelated ? split.related : []);
  const fullPost = draft + citations;

  async function streamInto(body: unknown): Promise<string> {
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch("/api/compose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error ?? `Lỗi ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      streamedRef.current = text;
      setDraft(text);
    }

    return text;
  }

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2 || busy) return;

    setPhase("tra-cuu");
    setError(null);
    setDraft("");
    streamedRef.current = "";
    setResearch(null);
    setSaved(false);
    setSaveError(null);

    const topic = query.trim();

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: topic,
          yearMin: yearMin || undefined,
          tiers: tiers.length > 0 ? tiers : undefined,
          limit: depth,
        }),
      });

      const found = (await res.json()) as ResearchResponse & { error?: string };
      if (!res.ok) throw new Error(found.error ?? `Lỗi ${res.status}`);
      setResearch(found);

      // Một phát hiện thì không có gì để gộp. Dừng ở đây và để người viết
      // quyết định — bài một ý vẫn viết được, chỉ là ở trang Soạn bài.
      if (found.findings.length < 2) {
        setPhase("idle");
        return;
      }

      const { cited } = splitCited(found.papers, found.findings);

      setPhase("viet");
      let text = await streamInto({
        mode: "tong-hop",
        topic,
        findings: found.findings.slice(0, 20),
        paperCount: cited.length,
        voiceId,
        targetWords,
        cta,
      });

      // Lớp ràng buộc thứ hai về độ dài — prompt đã nêu, vẫn phải đếm lại.
      // Lệch quá biên thì chỉnh đúng MỘT lượt, không lặp vô hạn.
      const actual = countWords(text);
      if (!isWithinRange(actual, targetWords)) {
        setPhase("chinh");
        text = await streamInto({
          mode: "refine",
          draft: text,
          instruction: `Bài đang ${actual} từ, cần ${targetWords} từ. ${
            actual > targetWords
              ? "Cắt bớt phần diễn giải thừa, giữ nguyên các con số, giữ đủ bốn chặng — nhất là chặng nói điều còn chưa rõ."
              : "Viết thêm cho đủ — mở rộng phần ý nghĩa thực tế hoặc phần điều còn chưa rõ, không thêm số liệu mới."
          }`,
          voiceId,
        });
      }

      setPhase("xong");
    } catch (cause) {
      // Bấm "Dừng" giữa chừng: giữ nguyên phần đã viết được thay vì xoá trắng —
      // đoạn dở vẫn dùng được, và tra cứu lại một lượt nữa thì tốn thật.
      if (cause instanceof Error && cause.name === "AbortError") {
        setPhase(streamedRef.current ? "xong" : "idle");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Lỗi không rõ");
      setPhase("idle");
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function copy() {
    await navigator.clipboard.writeText(fullPost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** Không đủ để gộp thì chuyển thẳng sang trang Soạn bài, khỏi tra lại lần nữa. */
  function handOffToComposer() {
    if (!research) return;
    sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({
        topic: research.query,
        findings: research.findings,
        papers: split.cited,
      }),
    );
    router.push("/soan-bai");
  }

  async function markPosted() {
    if (!research || saved) return;
    setSaveError(null);

    try {
      const store = await getStore();
      await store.add({
        postedOn: new Date().toISOString().slice(0, 10),
        topic: research.query,
        pillar,
        voiceId,
        targetWords,
        actualWords: countWords(draft),
        body: draft,
        // Lưu cả bài đã dẫn lẫn bài đọc thêm: danh mục trích dẫn của bài đăng
        // gồm cả hai, nên tra ngược lại cũng phải thấy đủ cả hai.
        papers: [...split.cited, ...(includeRelated ? split.related : [])].map((paper) => ({
          id: paper.id,
          title: paper.title,
          year: paper.year,
          journal: paper.journal,
          url: paper.url,
        })),
        findings: research.findings,
      });
      setSaved(true);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Không lưu được bài.");
    }
  }

  function toggleTier(tier: EvidenceTier) {
    setTiers((current) =>
      current.includes(tier) ? current.filter((t) => t !== tier) : [...current, tier],
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Tổng hợp"
        title="Bài gộp nhiều nghiên cứu"
        lede="Một chủ đề, nhiều nghiên cứu, một bài. App tra cứu rồi đọc hết abstract tìm được, viết thành bài nói rõ chỗ nào bằng chứng đã chắc và chỗ nào còn vênh — cuối bài là danh mục trích dẫn đầy đủ, ghép từ dữ liệu thật."
      />

      <form onSubmit={run} className="space-y-5">
        <div className="rule flex items-baseline gap-4 border-b pb-3">
          <label htmlFor="chu-de" className="eyebrow shrink-0">
            Chủ đề
          </label>
          <input
            id="chu-de"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="protein intake older women muscle"
            className="w-full bg-transparent font-serif text-2xl outline-none placeholder:text-ink/25"
            autoComplete="off"
            disabled={busy}
          />
        </div>

        <p className="text-xs text-ink/45">
          Nguồn dữ liệu là tiếng Anh — gõ từ khoá tiếng Anh cho kết quả sát hơn. Bài viết
          ra vẫn bằng tiếng Việt.
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

        <EvidencePyramidFilter
          selected={tiers}
          onToggle={toggleTier}
          onClear={() => setTiers([])}
          hint="Không chọn gì thì lấy tất cả. Chọn hai bậc trên cùng là bài chỉ gộp bằng chứng mạnh nhất — ít bài hơn nhưng chắc hơn."
        />
      </form>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <aside className="space-y-8">
          <VoicePicker value={voiceId} onChange={setVoiceId} disabled={busy} />
          <LengthPicker value={targetWords} onChange={setTargetWords} disabled={busy} />
          <CtaPicker value={cta} onChange={setCta} disabled={busy} />

          <div className="space-y-3">
            <Eyebrow>Danh mục trích dẫn</Eyebrow>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={includeRelated}
                onChange={(event) => setIncludeRelated(event.target.checked)}
                className="mt-1 accent-ink"
              />
              <span className="leading-relaxed text-ink/75">
                Kèm cả nghiên cứu cùng chủ đề không dẫn trực tiếp trong bài
              </span>
            </label>
            <p className="text-xs leading-relaxed text-ink/45">
              Danh mục luôn tách hai phần và nói rõ phần nào được dẫn trong bài — gộp
              chung thì độc giả tưởng câu chữ nào cũng có nghiên cứu đứng sau.
            </p>
          </div>

          <div className="rule space-y-3 border-t pt-5">
            {busy ? (
              <Button variant="quiet" onClick={stop} type="button">
                Dừng
              </Button>
            ) : (
              <Button type="button" onClick={run} disabled={query.trim().length < 2}>
                {draft ? "Viết lại" : "Tra cứu & viết bài"}
              </Button>
            )}

            {busy && <WritingIndicator label={PHASE_LABEL[phase]} />}

            {phase === "tra-cuu" && (
              <p className="text-xs leading-relaxed text-slate">
                Đang tìm trên PubMed và OpenAlex rồi đọc abstract. Mất khoảng 20–40 giây,
                sau đó mới bắt đầu viết.
              </p>
            )}
            {phase === "chinh" && (
              <p className="text-xs text-slate">
                Bài lệch khỏi khoảng {range.min}–{range.max} từ. Đang chỉnh lại một lượt.
              </p>
            )}
          </div>
        </aside>

        <section className="space-y-5">
          {error && <ErrorNote>{error}</ErrorNote>}

          {research && (
            <ResearchSummary
              result={research}
              cited={split.cited.length}
              offTopic={split.dropped}
            />
          )}

          {research && research.findings.length < 2 && (
            <div className="space-y-4">
              <EmptyNote>
                {research.note ??
                  "Chỉ rút được một phát hiện kiểm chứng được từ chủ đề này — chưa đủ để gộp thành bài tổng hợp. Thử nới bộ lọc năm, bỏ lọc bậc bằng chứng, hoặc diễn đạt lại truy vấn bằng thuật ngữ tiếng Anh khác."}
              </EmptyNote>
              {research.findings.length === 1 && (
                <Button variant="quiet" onClick={handOffToComposer}>
                  Viết bài một ý với phát hiện này
                </Button>
              )}
            </div>
          )}

          {!draft && !busy && !research && (
            <EmptyNote>
              Gõ chủ đề ở trên, chọn giọng văn và độ dài bên trái, rồi bấm «Tra cứu &
              viết bài». App làm cả hai chặng liền một mạch.
            </EmptyNote>
          )}

          {(draft || phase === "viet" || phase === "chinh") && (
            <>
              <div className="rule flex items-baseline justify-between border-b pb-3">
                <Eyebrow>Xem trước</Eyebrow>
                <span
                  className={`num text-xs ${
                    words === 0
                      ? "text-ink/40"
                      : isWithinRange(words, targetWords)
                        ? "text-herb"
                        : "text-slate"
                  }`}
                >
                  {words} từ · mục tiêu {range.min}–{range.max}
                </span>
              </div>

              <FacebookPreview
                text={fullPost}
                streaming={phase === "viet" || phase === "chinh"}
                waiting={(phase === "viet" || phase === "chinh") && !draft}
                waitingLabel="Đang gộp các nghiên cứu và đặt câu mở…"
              />

              {phase === "xong" && (
                <div className="rule flex flex-wrap items-center gap-3 border-t pt-5">
                  <Button onClick={copy}>{copied ? "Đã chép" : "Chép bài"}</Button>

                  <select
                    value={pillar}
                    onChange={(event) => setPillar(event.target.value)}
                    className="border border-ink/20 bg-transparent px-3 py-2.5 text-sm"
                    aria-label="Trụ cột nội dung"
                  >
                    {PILLARS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <Button variant="quiet" onClick={markPosted} disabled={saved}>
                    {saved ? "Đã ghi nhận" : "Đánh dấu đã đăng"}
                  </Button>
                </div>
              )}

              {saveError && <ErrorNote>{saveError}</ErrorNote>}
              {saved && (
                <p className="text-xs text-herb">
                  Đã lưu vào thư viện cùng <Num>{split.cited.length}</Num> nghiên cứu đã
                  dẫn. Gợi ý chủ đề lần sau sẽ tính cả bài này.
                </p>
              )}

              {phase === "xong" && split.cited.length > 0 && (
                <CitedList cited={split.cited} related={includeRelated ? split.related : []} />
              )}

              {phase === "xong" && draft.trim().length > 0 && (
                <IllustrationPanel topic={research?.query ?? query} draft={draft} />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  "tra-cuu": "Đang tra cứu và đọc abstract…",
  viet: "Đang viết bài tổng hợp…",
  chinh: "Đang chỉnh độ dài…",
  xong: "",
};

/** Nguồn nào chạy, tìm được bao nhiêu, bao nhiêu bài thật sự vào bài viết. */
function ResearchSummary({
  result,
  cited,
  offTopic,
}: {
  result: ResearchResponse;
  cited: number;
  offTopic: number;
}) {
  return (
    <div className="space-y-3">
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
          · gộp lại <Num>{result.papers.length}</Num> bài · rút được{" "}
          <Num>{result.findings.length}</Num> phát hiện · dẫn <Num>{cited}</Num> nghiên cứu
        </span>
      </p>

      {result.droppedCount > 0 && (
        <ErrorNote>
          Đã loại <Num>{result.droppedCount}</Num> phát hiện vì dẫn tới nghiên cứu không có
          trong kết quả tìm được. Bài chỉ viết từ những phát hiện kiểm chứng được.
        </ErrorNote>
      )}

      {offTopic > 0 && (
        <p className="text-xs text-ink/45">
          Đã bỏ <Num>{offTopic}</Num> bài khỏi mục «đọc thêm» vì tiêu đề không nhắc tới
          từ khoá của chủ đề — nguồn trả về cả những bài khớp rất lỏng, mà mục đó là lời
          hứa với độc giả rằng bài nào trong đấy cũng đáng đọc.
        </p>
      )}

      {result.note && result.findings.length >= 2 && <EmptyNote>{result.note}</EmptyNote>}
    </div>
  );
}

/**
 * Danh mục trích dẫn hiện dưới dạng link bấm được — phần chép sang Facebook là
 * text thuần trong khung xem trước, còn ở đây để kiểm lại nguồn trước khi đăng.
 */
function CitedList({ cited, related }: { cited: Paper[]; related: Paper[] }) {
  return (
    <details className="group" open>
      <summary className="rule cursor-pointer border-t pt-5 text-sm text-ink/55 hover:text-ink">
        Kiểm lại <Num>{cited.length + related.length}</Num> nghiên cứu trong danh mục
      </summary>

      <div className="mt-5 space-y-6">
        <PaperGroup label="Dẫn trong bài" papers={cited} start={1} />
        {related.length > 0 && (
          <PaperGroup label="Cùng chủ đề, đọc thêm" papers={related} start={cited.length + 1} />
        )}
      </div>
    </details>
  );
}

function PaperGroup({
  label,
  papers,
  start,
}: {
  label: string;
  papers: Paper[];
  start: number;
}) {
  if (papers.length === 0) return null;

  return (
    <div className="space-y-3">
      <Eyebrow>{label}</Eyebrow>
      <ol className="space-y-4">
        {papers.map((paper, index) => (
          <li key={paper.id} className="rule flex gap-3 border-b pb-4 last:border-0">
            <span className="num shrink-0 text-xs text-ink/35">{start + index}.</span>
            <div className="min-w-0">
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
                {paper.isOpenAccess && <span className="text-herb">đọc miễn phí</span>}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
