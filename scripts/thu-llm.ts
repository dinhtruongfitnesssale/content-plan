/**
 * Kiểm nhà cung cấp LLM đang cấu hình — cả hai thao tác app cần.
 *
 *   npx tsx --env-file=.env.local scripts/thu-llm.ts
 *
 * Đổi nhà cung cấp ngay trong lệnh để so sánh:
 *   LLM_PROVIDER=gemini npx tsx --env-file=.env.local scripts/thu-llm.ts
 *
 * Chạy cái này TRƯỚC KHI tin vào một nhà cung cấp mới — nhất là Gemini, phần
 * đó viết theo tài liệu và chưa từng chạy thật.
 */
import { z } from "zod";
import { describeSetup, llm } from "../lib/llm";

const DemoSchema = z.object({
  mon: z.string().describe("Tên một món ăn Việt"),
  kcalUocTinh: z.number().describe("Ước tính calo mỗi phần"),
  ghiChu: z.string().nullable().describe("Một lưu ý dinh dưỡng, hoặc null"),
});

async function main() {
  const setup = describeSetup();
  console.log(`\nĐọc:  ${setup.reader}`);
  console.log(`Viết: ${setup.writer}\n`);

  console.log("── 1. Structured output (vai đọc) ──");
  try {
    const started = Date.now();
    const result = await llm("reader").generateStructured({
      role: "reader",
      prompt:
        "Chọn một món ăn Việt bất kỳ và trả về thông tin theo schema. Trả lời bằng tiếng Việt.",
      schema: DemoSchema,
      schemaName: "mon_an",
    });

    if (result === null) {
      console.log("  HỎNG — không trả về dữ liệu khớp schema\n");
    } else {
      console.log(`  ok (${Date.now() - started}ms)`, JSON.stringify(result), "\n");
    }
  } catch (error) {
    console.log(`  HỎNG — ${error instanceof Error ? error.message : error}\n`);
  }

  console.log("── 2. Streaming (vai viết) ──");
  try {
    const started = Date.now();
    let first = 0;
    let text = "";

    for await (const chunk of llm("writer").streamText({
      role: "writer",
      prompt:
        "Viết đúng 2 câu tiếng Việt về lợi ích của việc ăn đủ rau trong bữa cơm gia đình. Giọng ấm, cụ thể, không sáo.",
    })) {
      if (!first) first = Date.now() - started;
      text += chunk;
      process.stdout.write(chunk);
    }

    if (text.trim().length === 0) {
      console.log("\n  HỎNG — luồng chạy nhưng không ra chữ nào\n");
    } else {
      console.log(`\n\n  ok — chữ đầu sau ${first}ms, tổng ${Date.now() - started}ms\n`);
    }
  } catch (error) {
    console.log(`\n  HỎNG — ${error instanceof Error ? error.message : error}\n`);
  }
}

main();
