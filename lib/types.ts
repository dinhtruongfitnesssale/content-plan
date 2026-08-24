import type { Finding } from "./findings";
import type { Paper, ProviderId } from "./research";

export type { Finding, Paper };

export type ResearchResponse = {
  query: string;
  papers: Paper[];
  sources: { id: ProviderId; label: string; count: number; error: string | null }[];
  findings: Finding[];
  note: string | null;
  /** Số phát hiện bị rào chắn loại vì tham chiếu bài không có thật. */
  droppedCount: number;
};

/** Gói dữ liệu chuyển từ trang Nghiên cứu sang trang Soạn bài. */
export type ComposerHandoff = {
  topic: string;
  findings: Finding[];
  papers: Paper[];
};

export const HANDOFF_KEY = "ban-viet:handoff";

/** Một mảng chủ đề trong bảng tin "Mới nhất", kèm những gì vừa tìm được. */
export type BeatUpdate = {
  id: string;
  name: string;
  why: string;
  pillar: string;
  /** Truy vấn thật đã gửi đi — đổi theo công tắc "ưu tiên phụ nữ". */
  query: string;
  papers: Paper[];
  sources: { id: ProviderId; label: string; count: number; error: string | null }[];
  /** Cả mảng này hỏng, không phải từng nguồn lẻ. */
  error: string | null;
};

export type LatestResponse = {
  beats: BeatUpdate[];
  days: number;
  womenFocus: boolean;
  fetchedAt: number;
};
