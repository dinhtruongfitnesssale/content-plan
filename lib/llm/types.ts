import type { z } from "zod";

/**
 * Hai vai, hai đòi hỏi khác nhau — đây là lý do tầng này tồn tại.
 *
 * - `reader` đọc abstract nghiên cứu rồi rút thành phát hiện. Việc cơ học,
 *   dữ liệu vào là abstract CÔNG KHAI, không có gì riêng tư. Model rẻ đủ dùng.
 * - `writer` viết bài. Chạm vào giọng văn, chỗ đứng thương hiệu, và bản nháp
 *   chưa đăng. Đây là chỗ chất lượng tiếng Việt quyết định, và cũng là chỗ
 *   dữ liệu nhạy cảm nhất.
 *
 * Tách hai vai cho hai nhà cung cấp là hợp lý; ghép chung cũng được.
 */
export type LlmRole = "reader" | "writer";

export type StructuredRequest<T> = {
  role: LlmRole;
  prompt: string;
  schema: z.ZodType<T>;
  /** Tên schema — vài nhà cung cấp bắt buộc có. */
  schemaName: string;
};

export type StreamRequest = {
  role: LlmRole;
  prompt: string;
  signal?: AbortSignal;
};

export type LlmProvider = {
  id: string;
  label: string;
  /** Model dùng cho vai này — hiện lên giao diện và ghi log để biết ai viết. */
  modelFor(role: LlmRole): string;
  /** Trả về null nếu model không cho ra dữ liệu khớp schema. */
  generateStructured<T>(request: StructuredRequest<T>): Promise<T | null>;
  streamText(request: StreamRequest): AsyncIterable<string>;
};

export class LlmConfigError extends Error {}
