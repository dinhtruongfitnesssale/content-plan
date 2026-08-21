/**
 * Cây bút đang viết — dấu hiệu «máy đang chạy» cho lúc chưa có chữ nào hiện ra.
 *
 * Vì sao cần: bài được stream về, nên khi chữ đã chạy thì tự nó là dấu hiệu.
 * Nhưng từ lúc bấm nút tới lúc chữ đầu tiên về có thể mất hàng chục giây
 * (model còn suy nghĩ) — khoảng lặng đó trước đây không có gì báo, dễ tưởng treo.
 *
 * Giữ 90/5/5: bút màu mực, chỉ nét gạch chân là amber — đúng vai «đường kẻ mảnh».
 * Không fill khối bằng amber.
 */
export function WritingIndicator({
  label,
  size = "sm",
}: {
  label: string;
  /** "lg" cho lúc trang còn trống, "sm" khi đã có chữ và chỉ cần nhắc nhẹ. */
  size?: "sm" | "lg";
}) {
  const big = size === "lg";

  return (
    <div
      className={big ? "flex flex-col items-center gap-3 py-10" : "flex items-center gap-3"}
      role="status"
      aria-live="polite"
    >
      <span className={`pen-track ${big ? "pen-track-lg" : ""}`} aria-hidden="true">
        <span className="pen-ink" />
        <svg
          className="pen-glide"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Thân bút chếch lên, ngòi chúc xuống trái — dáng bút máy. */}
          <path d="M3.4 12.6 4.6 9.7l6.9-6.9a1.45 1.45 0 0 1 2.05 2.05l-6.9 6.9z" />
          <path d="M3.4 12.6 2.6 14.4l1.8-.8" />
          <path d="M9.9 4.4l1.9 1.9" />
        </svg>
      </span>

      <span className={`text-slate ${big ? "text-sm" : "text-xs"}`}>{label}</span>
    </div>
  );
}
