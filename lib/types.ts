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
