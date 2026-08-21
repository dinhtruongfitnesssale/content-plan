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

  async *streamText({ role, prompt, signal }) {
    const stream = anthropic().beta.messages.stream(
      {
        model: MODELS[role],
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: { effort: role === "writer" ? "high" : "medium" },
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
  },
};
