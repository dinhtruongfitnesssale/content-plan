import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  LlmConfigError,
  type LlmProvider,
  type LlmRole,
  type StreamRequest,
  type StructuredRequest,
} from "./types";

const MODELS: Record<LlmRole, string> = {
  writer: "claude-opus-5",
  reader: "claude-sonnet-5",
};

/**
 * Opus 5 có thể từ chối một lượt sinh (stop_reason: "refusal"). Với nội dung
 * sức khoẻ chuyện này thỉnh thoảng xảy ra oan — bật fallback phía server để
 * lượt đó được định tuyến sang model khác thay vì trả về màn hình lỗi.
 */
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
} satisfies { betas: string[]; fallbacks: "default" };

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new LlmConfigError(
        "Thiếu ANTHROPIC_API_KEY. Tạo key ở console.anthropic.com rồi thêm vào .env.local",
      );
    }
    client = new Anthropic();
  }
  return client;
}

export const anthropicProvider: LlmProvider = {
  id: "anthropic",
  label: "Anthropic",

  modelFor(role) {
    return MODELS[role];
  },

  async generateStructured({ role, prompt, schema }) {
    const response = await anthropic().messages.parse({
      model: MODELS[role],
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: role === "writer" ? "high" : "medium",
        format: zodOutputFormat(schema),
      },
      messages: [{ role: "user", content: prompt }],
    });

    return response.parsed_output ?? null;
  },

  async *streamText({ role, prompt, signal, effort }) {
    const stream = anthropic().beta.messages.stream(
      {
        model: MODELS[role],
        // `max_tokens` tính CẢ token suy nghĩ, không chỉ chữ viết ra — và ở
        // effort "high" phần suy nghĩ mới là phần tốn. Đo thật ngày
        // 25/08/2026 với một bài tổng hợp 300 từ: 4.748 token nghĩ, 5.622
        // token tổng. Trần 8.000 cũ đủ cho bài ngắn nhưng hết chỗ ở bài dài,
        // và khi hết chỗ thì model dừng TRƯỚC KHI viết được chữ nào: route
        // trả HTTP 200 với thân rỗng, giao diện đứng im không báo gì.
        //
        // Nâng lên 32.000 khi trần độ dài lên 2.000 từ (26/08/2026): một âm
        // tiết tiếng Việt tốn ~2,9 token, nên bài 2.000 từ là ~5.800 token chữ
        // cộng ~6.500 token nghĩ. Nâng trần KHÔNG tốn thêm tiền — chỉ token
        // thực sự sinh ra mới bị tính — nên để dư là đúng, chặt mới là dại.
        max_tokens: 32000,
        thinking: { type: "adaptive" },
        // Route quyết định độ sâu khi nó biết mình có bao nhiêu giây; không
        // nói gì thì rơi về mặc định theo vai.
        output_config: { effort: effort ?? (role === "writer" ? "high" : "medium") },
        messages: [{ role: "user", content: prompt }],
        ...FALLBACK,
      },
      { signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield "\n\n[Lượt viết này bị từ chối. Thử diễn đạt lại chủ đề hoặc bỏ bớt một dẫn chứng.]";
    }
    // Đụng trần thì nói ra. Im lặng ở đây nghĩa là người dùng nhìn một bài cụt
    // giữa câu — hoặc một khung trắng — mà tưởng model viết được có thế.
    if (final.stop_reason === "max_tokens") {
      yield "\n\n[Bài bị cắt vì chạm trần token. Giảm độ dài mục tiêu hoặc bớt dẫn chứng rồi viết lại.]";
    }
  },
};
