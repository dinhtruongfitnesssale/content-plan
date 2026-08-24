"use client";

import { TIER_GROUPS, TIER_LABEL, type EvidenceTier } from "@/lib/research";

/**
 * Bộ lọc theo tháp Evidence Hierarchy (EBM pyramid).
 *
 * Xếp từ đỉnh xuống đáy đúng thứ tự tháp, chia theo ba tầng của hình gốc:
 * Synthesized → Experimental → Observational → Preclinical. Chiều rộng chip
 * thu dần theo bậc để nhìn ra dáng tháp mà không phải vẽ hình.
 *
 * Nhãn để nguyên tiếng Anh: đây là thuật ngữ chuẩn của ngành, dịch ra tiếng
 * Việt thì mỗi sách một kiểu và khó đối chiếu với chính abstract đang đọc.
 *
 * Dùng chung cho trang Nghiên cứu và bảng tin Mới nhất — hai trang phải lọc
 * bằng cùng một bộ bậc, nếu không thì cùng một nhãn lại ra hai tập bài khác nhau.
 */
export function EvidencePyramidFilter({
  selected,
  onToggle,
  onClear,
  hint = "Không chọn gì thì lấy tất cả — kết quả vẫn luôn xếp theo tháp, mạnh trước.",
}: {
  selected: EvidenceTier[];
  onToggle: (tier: EvidenceTier) => void;
  onClear: () => void;
  hint?: string;
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

      <p className="text-xs text-ink/45">{hint}</p>
    </div>
  );
}

export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow mr-1">{label}</span>
      {children}
    </div>
  );
}

export function Chip({
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
