"use client";

import { Card, Eyebrow } from "@/components/ui";
import { WritingIndicator } from "@/components/writing-indicator";
import { CTA_CHOICES, type CtaKind } from "@/lib/compose";
import { VOICES, voiceById } from "@/lib/voices";
import { LENGTH_PRESETS, MAX_WORDS, MIN_WORDS } from "@/lib/words";

/**
 * Các bộ chọn dùng chung cho mọi trang có sinh bài: giọng văn, độ dài, cách kết,
 * và khung xem trước Facebook.
 *
 * Dùng chung chứ không nhân bản vì đây là chỗ người viết học thói quen: nếu
 * trang Soạn bài và trang Tổng hợp có hai thanh trượt độ dài trông khác nhau
 * thì cùng một con số lại cho cảm giác là hai thứ khác nhau.
 */

export function VoicePicker({
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

export function LengthPicker({
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

export function CtaPicker({
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

/**
 * Khung xem trước mô phỏng cách Facebook hiển thị — dòng thưa, đoạn ngắn.
 *
 * `waiting` là quãng đã bấm nút nhưng chữ đầu tiên chưa về (model còn suy nghĩ).
 * Quãng này có thể dài hàng chục giây nên phải có bút chạy, không để trang câm.
 */
export function FacebookPreview({
  text,
  streaming,
  waiting,
  waitingLabel = "Đang đọc dẫn chứng và đặt câu mở…",
}: {
  text: string;
  streaming: boolean;
  waiting: boolean;
  waitingLabel?: string;
}) {
  if (waiting) {
    return (
      <Card>
        <WritingIndicator size="lg" label={waitingLabel} />
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
