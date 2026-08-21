"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Card, EmptyNote, ErrorNote, Eyebrow, Num, PageHeader } from "@/components/ui";
import { WritingIndicator } from "@/components/writing-indicator";
import { IllustrationPanel } from "./illustration";
import { CTA_CHOICES, buildSources, type CtaKind } from "@/lib/compose";
import { getStore } from "@/lib/store";
import { PILLARS } from "@/lib/brand";
import { HANDOFF_KEY, type ComposerHandoff } from "@/lib/types";
import { DEFAULT_VOICE_ID, VOICES, voiceById } from "@/lib/voices";
import {
  LENGTH_PRESETS,
  MAX_WORDS,
  MIN_WORDS,
  countWords,
  isWithinRange,
  wordRange,
} from "@/lib/words";

type Phase = "idle" | "writing" | "adjusting" | "done";

export function Composer() {
  const [handoff, setHandoff] = useState<ComposerHandoff | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [targetWords, setTargetWords] = useState(150);
  const [cta, setCta] = useState<CtaKind>("viec-nho");
  const [pillar, setPillar] = useState<string>(PILLARS[0].id);

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
      if (raw) setHandoff(JSON.parse(raw) as ComposerHandoff);
    } catch {
      /* dữ liệu hỏng thì coi như chưa có */
    }
    setLoaded(true);
  }, []);

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
      let text = await streamInto({
        mode: "compose",
        topic: handoff.topic,
        findings: handoff.findings,
        papers: handoff.papers.map((paper) => ({
          id: paper.id,
          title: paper.title,
          year: paper.year,
          journal: paper.journal,
          url: paper.url,
        })),
        voiceId,
        targetWords,
        cta,
      });

      // Lớp ràng buộc thứ hai: prompt đã nêu số từ, nhưng vẫn phải đếm lại.
      // Lệch quá biên thì chỉnh đúng MỘT lượt, không lặp vô hạn.
      if (!isWithinRange(countWords(text), targetWords)) {
        const current = countWords(text);
        setPhase("adjusting");
        text = await streamInto({
          mode: "refine",
          draft: text,
          instruction: `Bài đang ${current} từ, cần ${targetWords} từ. ${
            current > targetWords
              ? "Cắt bớt phần diễn giải thừa, giữ nguyên các con số và ý chính."
              : "Viết thêm cho đủ — mở rộng phần giải thích hoặc thêm một ví dụ đời thường, không thêm số liệu mới."
          }`,
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

  const fullPost = handoff ? draft + buildSources(handoff.papers) : draft;
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
        papers: handoff.papers.map((paper) => ({
          id: paper.id,
          title: paper.title,
          year: paper.year,
          journal: paper.journal,
          url: paper.url,
        })),
        findings: handoff.findings,
      });
      setSaved(true);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Không lưu được bài.');
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
          để tra cứu một chủ đề và chọn các phát hiện muốn dùng.
        </EmptyNote>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Soạn bài"
        title={handoff.topic}
        lede={`${handoff.findings.length} dẫn chứng đã chọn · ${handoff.papers.length} nghiên cứu`}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <aside className="space-y-8">
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
          </div>
        </aside>

        <section className="space-y-5">
          {error && <ErrorNote>{error}</ErrorNote>}

          {!draft && !busy && (
            <EmptyNote>
              Chọn giọng văn và độ dài bên trái, rồi bấm «Viết bài».
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

              <FacebookPreview text={fullPost} streaming={busy} waiting={busy && !draft} />

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
                  Đã lưu vào thư viện. Gợi ý chủ đề lần sau sẽ tính cả bài này.
                </p>
              )}

              {phase === "done" && draft.trim().length > 0 && (
                <IllustrationPanel topic={handoff.topic} draft={draft} />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Khung xem trước mô phỏng cách Facebook hiển thị — dòng thưa, đoạn ngắn.
 *
 * `waiting` là quãng đã bấm nút nhưng chữ đầu tiên chưa về (model còn suy nghĩ).
 * Quãng này có thể dài hàng chục giây nên phải có bút chạy, không để trang câm.
 */
function FacebookPreview({
  text,
  streaming,
  waiting,
}: {
  text: string;
  streaming: boolean;
  waiting: boolean;
}) {
  if (waiting) {
    return (
      <Card>
        <WritingIndicator size="lg" label="Đang đọc dẫn chứng và đặt câu mở…" />
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4 text-[0.9375rem] leading-[1.75] whitespace-pre-wrap">
        {text || <span className="text-ink/30">…</span>}
        {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-amber" />}
      </div>
    </Card>
  );
}

function VoicePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const voice = voiceById(value);

  return (
    <div className="space-y-3">
      <Eyebrow>Giọng văn</Eyebrow>
      <ul className="space-y-1">
        {VOICES.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(item.id)}
              className={`w-full border-l-2 py-1.5 pl-3 text-left text-sm transition-colors disabled:opacity-40 ${
                item.id === value
                  ? "border-amber text-ink"
                  : "border-transparent text-ink/55 hover:text-ink"
              }`}
            >
              {item.name}
            </button>
          </li>
        ))}
      </ul>
      {voice && <p className="pl-3 text-xs leading-relaxed text-ink/50">{voice.blurb}</p>}
    </div>
  );
}

function LengthPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (words: number) => void;
  disabled: boolean;
}) {
  const preset = LENGTH_PRESETS.find((item) => item.words === value);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Độ dài</Eyebrow>
        <span className="num text-sm">{value} từ</span>
      </div>

      <input
        type="range"
        min={MIN_WORDS}
        max={MAX_WORDS}
        step={10}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full disabled:opacity-40"
        aria-label="Số từ mục tiêu"
      />

      <div className="flex flex-wrap gap-2">
        {LENGTH_PRESETS.map((item) => (
          <button
            key={item.words}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item.words)}
            className={`border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
              item.words === value
                ? "border-ink text-ink"
                : "border-ink/15 text-ink/55 hover:border-ink/40"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-ink/45">
        {preset?.note ?? "Đếm theo âm tiết tách bằng khoảng trắng."}
      </p>
    </div>
  );
}

function CtaPicker({
  value,
  onChange,
  disabled,
}: {
  value: CtaKind;
  onChange: (kind: CtaKind) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <Eyebrow>Cách kết</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {CTA_CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(choice.id)}
            className={`border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
              choice.id === value
                ? "border-ink text-ink"
                : "border-ink/15 text-ink/55 hover:border-ink/40"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}
