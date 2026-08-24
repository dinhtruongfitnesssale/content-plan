import { EVIDENCE_TIERS, type EvidenceTier } from "@/lib/research";
import type { LatestResponse } from "@/lib/types";

/**
 * Giữ lượt quét bảng tin gần nhất ở máy người dùng.
 *
 * Một lượt quét đi qua bảy mảng chủ đề, mỗi mảng vài request — mất 15–30 giây
 * và ăn vào hạn mức NCBI. Mở lại trang trong ngày mà phải chờ từ đầu là vô lý,
 * vì nghiên cứu mới không ra theo giờ.
 *
 * Hạn 6 tiếng, dài hơn hẳn 10 phút của `lib/research-cache.ts`: hai bộ đệm
 * này canh hai thứ khác nhau. Bên kia giữ một lượt tra cứu đang làm dở, mất là
 * mất công đang làm. Bên này giữ một bảng tin đọc lướt, và nội dung của nó
 * thay đổi theo tuần chứ không theo phút.
 */

const KEY = "ban-viet:moi-nhat:v1";

export const LATEST_TTL_MS = 6 * 60 * 60 * 1000;

export type LatestCache = {
  beats: string[];
  days: number;
  tiers: EvidenceTier[];
  womenFocus: boolean;
  result: LatestResponse;
  savedAt: number;
};

export function readLatestCache(): LatestCache | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw) as LatestCache;
    if (!cached?.result?.beats || typeof cached.savedAt !== "number") return null;

    if (Date.now() - cached.savedAt > LATEST_TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }

    // Bậc lạ thì bỏ, đừng gửi lên API rồi lĩnh 400 vì một giá trị đã bị gỡ.
    const valid = new Set<string>(EVIDENCE_TIERS);
    return {
      ...cached,
      tiers: (cached.tiers ?? []).filter((tier) => valid.has(tier)),
      beats: cached.beats ?? [],
    };
  } catch {
    // Dữ liệu hỏng hoặc trình duyệt chặn localStorage — coi như chưa có.
    return null;
  }
}

export function writeLatestCache(cache: LatestCache): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Hết dung lượng thì thôi. Bảng tin vẫn hiện, chỉ là lần sau phải quét lại.
  }
}

export function clearLatestCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* không có gì để dọn */
  }
}

/**
 * "3 giờ trước", "hôm qua" — mốc tương đối dễ đọc hơn giờ tuyệt đối khi câu
 * hỏi trong đầu người dùng là "cái này còn mới không".
 */
export function timeAgo(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "hôm qua" : `${days} ngày trước`;
}
