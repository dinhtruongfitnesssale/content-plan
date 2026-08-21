import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  LlmConfigError,
  type LlmProvider,
  type LlmRole,
  type StreamRequest,
  type StructuredRequest,
} from "./types";

/**
 * Nhà cung cấp Gemini — tuỳ chọn, bật bằng LLM_PROVIDER=gemini.
 *
 * ⚠ CHƯA CHẠY THẬT LẦN NÀO. Viết theo tài liệu Interactions API, không có key
 * để kiểm chứng. Lần đầu chị bật lên, hãy chạy `scripts/thu-llm.ts` trước khi
 * tin vào nó.
 *
 * ⚠ FREE TIER DÙNG DỮ LIỆU CỦA CHỊ ĐỂ HUẤN LUYỆN. Theo điều khoản Google,
 * nội dung gửi qua bậc miễn phí được dùng để "cung cấp, cải thiện và phát
 * triển sản phẩm Google", và người rà soát có thể đọc. Bậc trả phí thì không.
 * Với vai `writer` — nơi bản nháp chưa đăng và chỗ đứng thương hiệu đi qua —
 * cân nhắc kỹ. Vai `reader` chỉ xử lý abstract công khai nên rủi ro thấp hơn nhiều.
 *
 * Dùng Interactions API (`/v1beta/interactions`), là primitive Google khuyến
 * nghị hiện nay. `models:generateContent` cũ đã bị gắn nhãn Legacy.
 */
const MODELS: Record<LlmRole, string> = {
  writer: process.env.GEMINI_WRITER_MODEL ?? "gemini-3.7-flash",
  reader: process.env.GEMINI_READER_MODEL ?? "gemini-3.7-flash",
};

let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new LlmConfigError(
        "Thiếu GEMINI_API_KEY. Lấy ở aistudio.google.com rồi thêm vào .env.local",
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const geminiProvider: LlmProvider = {
  id: "gemini",
  label: "Gemini",

  modelFor(role) {
    return MODELS[role];
  },

  async generateStructured({ role, prompt, schema, schemaName }) {
    const response = await gemini().interactions.create({
      model: MODELS[role],
      input: prompt,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: z.toJSONSchema(schema, { target: "draft-7" }),
      },
    });

    const text = readText(response);
    if (!text) return null;

    // Model có thể bọc JSON trong ```json … ``` dù đã yêu cầu mime_type.
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFence(text));
    } catch {
      return null;
    }

    // Gemini không bảo đảm khớp schema chặt như structured output của Anthropic,
    // nên phải tự xác thực lại thay vì tin lời.
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  },

  async *streamText({ role, prompt, signal }) {
    const stream = await gemini().interactions.create({
      model: MODELS[role],
      input: prompt,
      stream: true,
    });

    for await (const event of stream as AsyncIterable<unknown>) {
      if (signal?.aborted) return;
      const chunk = readDelta(event);
      if (chunk) yield chunk;
    }
  },
};

/**
 * `output_text` là trường tiện lợi do SDK ghép sẵn. Nếu vắng thì tự gom từ
 * `steps[].content[].text`, là nơi dữ liệu thật nằm.
 */
function readText(response: unknown): string | null {
  const record = response as Record<string, unknown>;

  const direct = record.output_text;
  if (typeof direct === "string" && direct.length > 0) return direct;

  const steps = Array.isArray(record.steps) ? record.steps : [];
  const parts: string[] = [];
  for (const step of steps) {
    const content = (step as Record<string, unknown>)?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      const text = (block as Record<string, unknown>)?.text;
      if (typeof text === "string") parts.push(text);
    }
  }

  const joined = parts.join("");
  return joined.length > 0 ? joined : null;
}

/**
 * Sự kiện `step.delta` mang nội dung sinh dần. Hình dạng chính xác của TextDelta
 * chưa được kiểm chứng bằng dữ liệu thật, nên dò vài chỗ hợp lý thay vì cắm
 * cứng một đường dẫn — thà chịu thêm vài dòng còn hơn im lặng không ra chữ nào.
 */
function readDelta(event: unknown): string | null {
  if (typeof event === "string") return event;
  if (typeof event !== "object" || event === null) return null;

  const record = event as Record<string, unknown>;

  if (typeof record.output_text === "string") return record.output_text;

  const delta = record.delta;
  if (typeof delta === "string") return delta;
  if (typeof delta === "object" && delta !== null) {
    const text = (delta as Record<string, unknown>).text;
    if (typeof text === "string") return text;
  }

  const content = record.content;
  if (typeof content === "object" && content !== null) {
    const text = (content as Record<string, unknown>).text;
    if (typeof text === "string") return text;
  }

  return null;
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}
