"use client";

import { useState } from "react";
import { Button, Card, EmptyNote, ErrorNote, Eyebrow } from "@/components/ui";
import {
  ASPECT_CHOICES,
  DEFAULT_ASPECT,
  buildImagePrompt,
  type AspectId,
  type IllustrationIdea,
} from "@/lib/illustration";
import { DEFAULT_STYLE_ID, IMAGE_STYLES, styleById } from "@/lib/image-styles";

/**
 * Sinh prompt cho model sinh ảnh từ bản nháp đã viết xong.
 *
 * Prompt ra bằng tiếng Anh dù cả app là tiếng Việt: model sinh ảnh hiểu tiếng
 * Anh tốt hơn hẳn. Phần chị đọc — ý tưởng, chi tiết châm biếm, alt text —
 * vẫn tiếng Việt, nên chị chọn được ý tưởng mà không phải đọc prompt.
 */
export function IllustrationPanel({ topic, draft }: { topic: string; draft: string }) {
  const [styleId, setStyleId] = useState<string>(DEFAULT_STYLE_ID);
  const [aspect, setAspect] = useState<AspectId>(DEFAULT_ASPECT);
  const [ideas, setIdeas] = useState<IllustrationIdea[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const style = styleById(styleId);
  const aspectNote = ASPECT_CHOICES.find((item) => item.id === aspect)?.note;

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/illustration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, draft, styleId }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `Lỗi ${res.status}`);

      setIdeas(json.ideas as IllustrationIdea[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lỗi không rõ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rule space-y-6 border-t pt-8">
      <div className="space-y-2">
        <Eyebrow>Ảnh minh hoạ</Eyebrow>
        <p className="max-w-2xl text-sm leading-relaxed text-ink/60">
          Đọc bài đã viết rồi nghĩ ý tưởng ảnh, trả về prompt tiếng Anh để chép sang
          Midjourney, Flux, hay bất kỳ công cụ sinh ảnh nào.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <Eyebrow>Phong cách</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {IMAGE_STYLES.map((item) => (
              <Chip
                key={item.id}
                active={item.id === styleId}
                disabled={busy}
                onClick={() => setStyleId(item.id)}
              >
                {item.name}
              </Chip>
            ))}
          </div>
          {style && <p className="text-xs leading-relaxed text-ink/45">{style.blurb}</p>}
        </div>

        <div className="space-y-3">
          <Eyebrow>Khung hình</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {ASPECT_CHOICES.map((item) => (
              <Chip
                key={item.id}
                active={item.id === aspect}
                disabled={busy}
                onClick={() => setAspect(item.id)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
          {aspectNote && <p className="text-xs leading-relaxed text-ink/45">{aspectNote}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="quiet" onClick={generate} disabled={busy}>
          {busy ? "Đang nghĩ…" : ideas.length > 0 ? "Nghĩ lại" : "Nghĩ ý tưởng ảnh"}
        </Button>
        {ideas.length > 0 && !busy && (
          <span className="text-xs text-ink/45">
            Đổi khung hình rồi chép lại — không cần sinh lại từ đầu.
          </span>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {ideas.length === 0 && !busy && !error && (
        <EmptyNote>
          Chọn phong cách rồi bấm «Nghĩ ý tưởng ảnh». Ảnh sẽ bám theo bài vừa viết, không
          phải theo chủ đề chung chung.
        </EmptyNote>
      )}

      {ideas.length > 0 && (
        <ul className="space-y-4">
          {ideas.map((idea, index) => (
            <li key={index}>
              <IdeaCard idea={idea} index={index} aspect={aspect} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IdeaCard({
  idea,
  index,
  aspect,
}: {
  idea: IllustrationIdea;
  index: number;
  aspect: AspectId;
}) {
  const [copied, setCopied] = useState<"prompt" | "alt" | null>(null);
  const fullPrompt = buildImagePrompt(idea, aspect);

  async function copy(what: "prompt" | "alt") {
    await navigator.clipboard.writeText(what === "prompt" ? fullPrompt : idea.altText);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="num text-xs text-ink/40">{String(index + 1).padStart(2, "0")}</span>
          <p className="font-serif text-lg leading-snug">{idea.concept}</p>
        </div>

        <p className="border-l-2 border-amber/40 py-0.5 pl-3 text-sm leading-relaxed text-ink/70">
          {idea.irony}
        </p>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>Prompt</Eyebrow>
            <span className="num text-[0.6875rem] text-ink/40">tiếng Anh · {aspect}</span>
          </div>
          <pre className="overflow-x-auto border border-ink/12 bg-ink/[0.025] p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink/75">
            {fullPrompt}
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="quiet" onClick={() => copy("prompt")}>
            {copied === "prompt" ? "Đã chép" : "Chép prompt"}
          </Button>
          <button
            type="button"
            onClick={() => copy("alt")}
            className="text-left text-xs leading-relaxed text-ink/50 underline decoration-ink/20 underline-offset-2 transition-colors hover:text-ink"
          >
            {copied === "alt" ? "Đã chép alt text" : `Alt text: ${idea.altText}`}
          </button>
        </div>
      </div>
    </Card>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
        active ? "border-ink text-ink" : "border-ink/15 text-ink/55 hover:border-ink/40"
      }`}
    >
      {children}
    </button>
  );
}
