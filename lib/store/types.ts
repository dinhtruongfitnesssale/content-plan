import type { Finding } from "../findings";
import type { Paper } from "../research";

/** Một bài đã soạn. `pillar` và `postedOn` là đầu vào của bộ gợi ý chủ đề. */
export type Post = {
  id: string;
  /** ISO date "2026-08-19" — ngày đăng, không phải ngày soạn. */
  postedOn: string;
  createdAt: string;
  topic: string;
  pillar: string;
  voiceId: string;
  targetWords: number;
  actualWords: number;
  body: string;
  /** Nghiên cứu đã dẫn trong bài, lưu kèm để sau này còn tra lại được. */
  papers: Pick<Paper, "id" | "title" | "year" | "journal" | "url">[];
  findings: Finding[];
};

export type NewPost = Omit<Post, "id" | "createdAt">;

/**
 * Nơi lưu bài. Hai bản cài đặt: localStorage (chưa cấu hình Supabase) và
 * Supabase qua route handler. Giao diện không cần biết đang dùng bản nào.
 */
export type Store = {
  mode: StoreMode;
  list(): Promise<Post[]>;
  add(post: NewPost): Promise<Post>;
  remove(id: string): Promise<void>;
};

export type StoreMode = "local" | "supabase";
