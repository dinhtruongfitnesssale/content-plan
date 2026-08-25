import { EVIDENCE_TIERS, type EvidenceTier } from "@/lib/research";
import type { ResearchResponse } from "@/lib/types";

/**
 * Giữ lại lượt tra cứu gần nhất để tải lại trang không mất kết quả.
 *
 * Vì sao cần: một lượt tra cứu mất 20–40 giây và tốn lượt gọi model. Lỡ tay
 * F5 hay bấm nhầm nút quay lại mà mất sạch thì phải trả giá đó lần nữa.
 *
 * Vì sao có hạn 10 phút: nghiên cứu để lâu thì người dùng đã sang chủ đề khác,
 * mở lại thấy kết quả cũ dễ tưởng là kết quả mới. Hết hạn thì bắt đầu sạch.
 *
 * Dùng localStorage chứ không phải sessionStorage: đóng tab rồi mở lại trong
 * 10 phút vẫn còn. Đây là bộ nhớ đệm tạm của riêng máy, không liên quan tới
 * `lib/store/` (nơi lưu bài đã soạn, có thể là Supabase).
 */

/**
 * Có đánh số phiên bản: tên các bậc bằng chứng đã đổi sang thang EBM, nên
 * bản lưu cũ mang id không còn tồn tại. Đổi khoá là bỏ hẳn bản cũ, chắc chắn
 * hơn cố đọc rồi vá.
 */
const KEY = "ban-viet:tra-cuu-gan-nhat:v3";

export const CACHE_TTL_MS = 10 * 60 * 1000;

export type ResearchCache = {
  query: string;
  yearMin: number;
  tiers: EvidenceTier[];
  result: ResearchResponse;
  /** Chỉ số các phát hiện đang được chọn — chọn xong tải lại trang vẫn còn. */
  chosen: number[];
  /**
   * Id các bài được tích thêm ngoài phần bài đứng sau phát hiện đã chọn.
   *
   * Lưu theo id chứ không theo chỉ số như `chosen`: mảng phát hiện chỉ tồn tại
   * trong đúng lượt tra cứu đó, còn id bài là khoá thật của tầng nghiên cứu.
   */
  chosenPapers: string[];
  /** Mốc của lượt TRA CỨU, không phải lượt ghi. Chọn thêm không gia hạn. */
  savedAt: number;
};

export function readResearchCache(): ResearchCache | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw) as ResearchCache;
    if (!cached?.result || typeof cached.savedAt !== "number") return null;

    if (Date.now() - cached.savedAt > CACHE_TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }

    // Bậc lạ thì bỏ, đừng gửi lên API rồi lĩnh 400 vì một giá trị đã bị gỡ.
    const valid = new Set<string>(EVIDENCE_TIERS);
    return {
      ...cached,
      tiers: (cached.tiers ?? []).filter((tier) => valid.has(tier)),
      chosen: cached.chosen ?? [],
      chosenPapers: cached.chosenPapers ?? [],
    };
  } catch {
    // Dữ liệu hỏng hoặc trình duyệt chặn localStorage — coi như chưa có.
    return null;
  }
}

export function writeResearchCache(cache: ResearchCache): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Hết dung lượng thì thôi, không lưu — không được làm hỏng lượt tra cứu.
  }
}

export function clearResearchCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* không có gì để dọn */
  }
}

/** Số phút còn giữ, làm tròn lên. Trả 0 khi đã hết hạn. */
export function minutesLeft(savedAt: number): number {
  return Math.max(0, Math.ceil((savedAt + CACHE_TTL_MS - Date.now()) / 60_000));
}
