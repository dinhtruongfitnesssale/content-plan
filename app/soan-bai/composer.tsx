"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyNote, ErrorNote, Eyebrow, Num, PageHeader } from "@/components/ui";
import { WritingIndicator } from "@/components/writing-indicator";
import {
  CtaPicker,
  FacebookPreview,
  LengthPicker,
  PostKindPicker,
  VoicePicker,
} from "@/components/writing-controls";
import { IllustrationPanel } from "./illustration";
import { buildCitations, splitCited, type CtaKind, type PostKind } from "@/lib/compose";
import { getStore } from "@/lib/store";
import { PILLARS } from "@/lib/brand";
import { TIER_LABEL, toTier } from "@/lib/research";
import { HANDOFF_KEY, type ComposerHandoff, type Paper } from "@/lib/types";
import { DEFAULT_VOICE_ID } from "@/lib/voices";
import { countWords, isWithinRange, wordRange } from "@/lib/words";

type Phase = "idle" | "writing" | "adjusting" | "done";

/** Trần số phát hiện `/api/compose` nhận — cắt ở client cho khớp, khỏi lĩnh 400. */
const MAX_FINDINGS = 20;

export function Composer() {
  const [handoff, setHandoff] = useState<ComposerHandoff | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [targetWords, setTargetWords] = useState(150);
  const [cta, setCta] = useState<CtaKind>("viec-nho");
  const [pillar, setPillar] = useState<string>(PILLARS[0].id);
  /** null = chưa chọn tay, để số phát hiện tự quyết. */
  const [kindPick, setKindPick] = useState<PostKind | null>(null);

  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      // sessionStorage chỉ đọc được ở trình duyệt nên phải đặt state sau khi
      // hydrate xong — đọc sớm hơn thì server và client dựng ra hai cây khác nhau.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setHandoff(JSON.parse(raw) as ComposerHandoff);
    } catch {
      /* dữ liệu hỏng thì coi như chưa có */
    }
    setLoaded(true);
  }, []);

  const findings = useMemo(
    () => handoff?.findings.slice(0, MAX_FINDINGS) ?? [],
    [handoff],
  );

  /**
   * Một phát hiện thì không có gì để gộp — bốn chặng của bài tổng hợp sẽ thành
   * bốn chặng nói vòng quanh một con số. Nên dạng bài mặc định đi theo số phát
   * hiện đã chọn ở trang Nghiên cứu, và người viết vẫn đổi tay được.
   */
  const canRoundup = findings.length >= 2;
  const kind: PostKind = kindPick ?? (canRoundup ? "tong-hop" : "compose");

  /**
   * Chia tập bài đã bàn giao thành hai nhóm cho danh mục trích dẫn.
   *
   * `cited` là bài đứng sau các phát hiện — thân bài dẫn số liệu của chúng.
   * `related` là bài người viết tích thêm ở trang Nghiên cứu, vào danh mục
   * dưới nhãn "đọc thêm". `splitCited` còn khử trùng lặp theo tiêu đề một lượt
   * nữa: tầng nghiên cứu khoá theo DOI → PMID → tiêu đề, nên cùng một bài mà
   * bản này có DOI bản kia không thì cả hai cùng sống sót, và danh mục kể một
   * nghiên cứu hai lần trông như đếm bằng chứng gian.
   */
  const split = useMemo(() => {
    if (!handoff) return { cited: [] as Paper[], related: [] as Paper[] };
    return splitCited(handoff.papers, findings);
  }, [handoff, findings]);

  const citations = buildCitations(split.cited, split.related);

  /** Đọc một luồng text và ghi dần vào draft. */
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
      setDraft(text);
    }

    return text;
  }

  async function write() {
    if (!handoff || phase === "writing" || phase === "adjusting") return;

    setPhase("writing");
    setError(null);
    setDraft("");
    setSaved(false);

    try {
      let text = await streamInto(
        kind === "tong-hop"
          ? {
              mode: "tong-hop",
              topic: handoff.topic,
              findings,
              // Con số DUY NHẤT ngoài phần dẫn chứng mà model được nêu trong
              // thân bài. Đếm từ đúng mảng dựng nên danh mục trích dẫn, nếu
              // không thì bài nói một đằng, danh mục cuối bài một nẻo.
              paperCount: split.cited.length,
              voiceId,
              targetWords,
              cta,
            }
          : {
              mode: "compose",
              topic: handoff.topic,
              findings,
              voiceId,
              targetWords,
              cta,
            },
      );

      // Lớp ràng buộc thứ hai: prompt đã nêu số từ, nhưng vẫn phải đếm lại.
      // Lệch quá biên thì chỉnh đúng MỘT lượt, không lặp vô hạn.
      const actual = countWords(text);
      if (!isWithinRange(actual, targetWords)) {
        setPhase("adjusting");
        text = await streamInto({
          mode: "refine",
          draft: text,
          instruction: refineInstruction(actual, targetWords, kind),
          voiceId,
        });
      }

      setPhase("done");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") {
        setPhase("idle");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Lỗi không rõ");
      setPhase("idle");
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const fullPost = draft + citations;
  const words = countWords(draft);
  const range = wordRange(targetWords);
  const busy = phase === "writing" || phase === "adjusting";

  async function copy() {
    await navigator.clipboard.writeText(fullPost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function markPosted() {
    if (!handoff || saved) return;
    setSaveError(null);

    try {
      const store = await getStore();
      await store.add({
        postedOn: new Date().toISOString().slice(0, 10),
        topic: handoff.topic,
        pillar,
        voiceId,
        targetWords,
        actualWords: countWords(draft),
        body: draft,
        // Lưu cả bài đã dẫn lẫn bài đọc thêm: danh mục trích dẫn của bài đăng
        // gồm cả hai, nên tra ngược lại cũng phải thấy đủ cả hai.
        papers: [...split.cited, ...split.related].map(toPaperRef),
        findings,
      });
      setSaved(true);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Không lưu được bài.");
    }
  }

  // Dữ liệu bàn giao nằm trong sessionStorage nên chỉ đọc được ở trình duyệt.
  // Vẫn dựng phần khung để trang không chớp trắng trước khi hydrate.
  if (!loaded) {
    return <PageHeader eyebrow="Soạn bài" title="Viết bài" />;
  }

  if (!handoff) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Soạn bài" title="Viết bài" />
        <EmptyNote>
          Chưa có dẫn chứng nào được chọn. Sang{" "}
          <Link
            href="/nghien-cuu"
            className="text-amber underline decoration-amber/35 underline-offset-2"
          >
            Nghiên cứu
          </Link>{" "}
          để tra cứu một chủ đề rồi tích những phát hiện và nghiên cứu muốn dùng.
        </EmptyNote>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Soạn bài"
        title={handoff.topic}
        lede={`${findings.length} dẫn chứng đã chọn · danh mục trích dẫn ${
          split.cited.length + split.related.length
        } nghiên cứu`}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <aside className="space-y-8">
          <PostKindPicker
            value={kind}
            onChange={setKindPick}
            disabled={busy}
            disabledRoundup={!canRoundup}
          />
          <VoicePicker value={voiceId} onChange={setVoiceId} disabled={busy} />
          <LengthPicker value={targetWords} onChange={setTargetWords} disabled={busy} />
          <CtaPicker value={cta} onChange={setCta} disabled={busy} />

          <div className="rule space-y-3 border-t pt-5">
            {busy ? (
              <Button variant="quiet" onClick={stop}>
                Dừng
              </Button>
            ) : (
              <Button onClick={write}>{draft ? "Viết lại" : "Viết bài"}</Button>
            )}
            {busy && (
              <WritingIndicator
                label={phase === "adjusting" ? "Đang chỉnh độ dài…" : "Đang viết…"}
              />
            )}
            {phase === "adjusting" && (
              <p className="text-xs text-slate">
                Bài lệch khỏi khoảng {range.min}–{range.max} từ. Đang chỉnh lại một lượt.
              </p>
            )}
            {!busy && targetWords >= 1200 && (
              <p className="text-xs leading-relaxed text-slate">
                Bài dài mất 3–5 phút để viết xong. Đừng rời trang giữa chừng.
              </p>
            )}
          </div>
        </aside>

        <section className="space-y-5">
          {error && <ErrorNote>{error}</ErrorNote>}

          {!draft && !busy && (
            <EmptyNote>
              Chọn dạng bài, giọng văn và độ dài bên trái, rồi bấm «Viết bài». Danh mục
              trích dẫn ở cuối được ghép sẵn từ dữ liệu thật — xem trước ngay bên dưới.
            </EmptyNote>
          )}

          {(draft || busy) && (
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
                streaming={busy}
                waiting={busy && !draft}
                waitingLabel={
                  kind === "tong-hop"
                    ? "Đang gộp các nghiên cứu và đặt câu mở…"
                    : "Đang đọc dẫn chứng và đặt câu mở…"
                }
              />

              {phase === "done" && (
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
            </>
          )}

          <CitedList cited={split.cited} related={split.related} />

          {phase === "done" && draft.trim().length > 0 && (
            <IllustrationPanel topic={handoff.topic} draft={draft} />
          )}
        </section>
      </div>
    </div>
  );
}

/** Chỉ giữ các trường đi vào danh mục trích dẫn và thư viện — bỏ abstract cho gọn. */
function toPaperRef(paper: Paper) {
  return {
    id: paper.id,
    title: paper.title,
    year: paper.year,
    journal: paper.journal,
    url: paper.url,
  };
}

/** Lượt chỉnh độ dài của bài gộp phải nhắc giữ đủ bốn chặng, bài một ý thì không. */
function refineInstruction(actual: number, target: number, kind: PostKind): string {
  const longer =
    kind === "tong-hop"
      ? "Viết thêm cho đủ — mở rộng phần ý nghĩa thực tế hoặc phần điều còn chưa rõ, không thêm số liệu mới."
      : "Viết thêm cho đủ — mở rộng phần giải thích hoặc thêm một ví dụ đời thường, không thêm số liệu mới.";
  const shorter =
    kind === "tong-hop"
      ? "Cắt bớt phần diễn giải thừa, giữ nguyên các con số, giữ đủ bốn chặng — nhất là chặng nói điều còn chưa rõ."
      : "Cắt bớt phần diễn giải thừa, giữ nguyên các con số và ý chính.";

  return `Bài đang ${actual} từ, cần ${target} từ. ${actual > target ? shorter : longer}`;
}

/**
 * Danh mục trích dẫn hiện dưới dạng link bấm được — phần chép sang Facebook là
 * text thuần trong khung xem trước, còn ở đây để kiểm lại nguồn trước khi đăng.
 *
 * Hiện cả khi chưa viết chữ nào: danh mục ghép bằng code từ dữ liệu đã chọn,
 * không đợi model, nên xem trước được ngay lúc còn đang cân nhắc độ dài.
 */
function CitedList({ cited, related }: { cited: Paper[]; related: Paper[] }) {
  if (cited.length + related.length === 0) return null;

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
