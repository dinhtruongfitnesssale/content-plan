import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { LlmConfigError, type LlmProvider, type LlmRole } from "./types";

export * from "./types";

const PROVIDERS: Record<string, LlmProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
};

/**
 * Chọn nhà cung cấp theo biến môi trường. Mặc định Anthropic.
 *
 * Đặt riêng cho từng vai được — ví dụ để Gemini đọc abstract (dữ liệu công
 * khai, rẻ) còn Opus viết bài (chất lượng tiếng Việt, dữ liệu riêng tư):
 *
 *   LLM_PROVIDER=anthropic
 *   LLM_PROVIDER_READER=gemini
 *
 * `LLM_PROVIDER_READER` và `LLM_PROVIDER_WRITER` đè lên `LLM_PROVIDER`.
 */
export function llm(role: LlmRole): LlmProvider {
  const name = (
    (role === "reader" ? process.env.LLM_PROVIDER_READER : process.env.LLM_PROVIDER_WRITER) ??
    process.env.LLM_PROVIDER ??
    "anthropic"
  )
    .trim()
    .toLowerCase();

  const provider = PROVIDERS[name];
  if (!provider) {
    throw new LlmConfigError(
      `Không biết nhà cung cấp "${name}". Chọn một trong: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }

  return provider;
}

/** Cho giao diện và log biết ai đang viết — hữu ích khi chị so sánh hai model. */
export function describeSetup(): { reader: string; writer: string } {
  const reader = llm("reader");
  const writer = llm("writer");
  return {
    reader: `${reader.label} · ${reader.modelFor("reader")}`,
    writer: `${writer.label} · ${writer.modelFor("writer")}`,
  };
}
