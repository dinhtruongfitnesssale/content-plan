import { NextResponse } from "next/server";
import { z } from "zod";
import { llm, type Effort } from "@/lib/llm";
import { composePrompt, refinePrompt, roundupPrompt, type CtaKind } from "@/lib/compose";
import { countWords, MAX_WORDS, MIN_WORDS } from "@/lib/words";
import { voiceById, DEFAULT_VOICE_ID, type Voice } from "@/lib/voices";

export const runtime = "nodejs";

/**
 * Trần cứng theo đồng hồ, streaming không cứu được.
 *
 * 300 giây là **trần của gói Hobby trên Vercel**, không phải con số ta chọn:
 * đặt cao hơn thì build đổ ngay với "maxDuration must be between 1 and 300 for
 * plan hobby". Đã thử 600 và nhận đúng lỗi đó (26/08/2026). Lên gói Pro thì
 * trần là 800 — chỉ khi đó mới nâng số này, và nâng xong thì `EFFORT_WORD_CAP`
 * bên dưới nới theo được.
 */
export const maxDuration = 300;

/**
 * Trên ngưỡng này thì hạ độ sâu suy nghĩ xuống "medium".
 *
 * Không phải để tiết kiệm tiền mà để lọt vào 300 giây. Ở effort "high" phần
 * token suy nghĩ nhiều gần bằng phần chữ: bài 2.000 từ là ~5.800 token chữ
 * cộng ~6.500 token nghĩ, ở tốc độ 40–60 token/giây thành 205–307 giây — vắt
 * ngang qua mép tường. Hạ xuống "medium" cắt gần nửa phần nghĩ, còn khoảng
 * 150–220 giây, tức có biên thật.
 *
 * Đứt ở đây không phải là hỏng nhẹ: lượt gọi đã trả tiền, mà người viết nhận
 * về một bài cụt giữa câu.
 *
 * Ngưỡng 1.200 vì đó là mốc "Bài dài" — dưới đó bài dài nhất cũng chỉ ~9.500
 * token, vẫn còn biên rộng ở effort "high".
 */
const EFFORT_WORD_CAP = 1200;

function effortFor(words: number): Effort {
  return words > EFFORT_WORD_CAP ? "medium" : "high";
}

const FindingSchema = z.object({
  claim: z.string(),
  evidence: z.string(),
  strength: z.enum(["mạnh", "trung bình", "yếu"]),
  caveat: z.string().nullable(),
  angle: z.string(),
  paperIds: z.array(z.string()),
});

const RequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("compose"),
    topic: z.string().min(2).max(300),
    // Cùng trần 20 với mode "tong-hop". Hai mode nay nhận dẫn chứng từ cùng
    // một lượt tích chọn ở trang Nghiên cứu, nên hai trần khác nhau chỉ tạo ra
    // một lỗi 400 đúng vào lúc người viết đổi dạng bài.
    findings: z.array(FindingSchema).min(1).max(20),
    voiceId: z.string(),
    targetWords: z.number().int().min(MIN_WORDS).max(MAX_WORDS),
    cta: z.enum(["khong", "cau-hoi", "viec-nho", "luu-bai"]),
  }),
  z.object({
    mode: z.literal("tong-hop"),
    topic: z.string().min(2).max(300),
    findings: z.array(FindingSchema).min(2).max(20),
    /** Số nghiên cứu đã đọc — client đếm từ tập bài thật, model được nêu lại. */
    paperCount: z.number().int().min(1).max(50),
    voiceId: z.string(),
    targetWords: z.number().int().min(MIN_WORDS).max(MAX_WORDS),
    cta: z.enum(["khong", "cau-hoi", "viec-nho", "luu-bai"]),
  }),
  z.object({
    mode: z.literal("refine"),
    draft: z.string().min(10).max(20000),
    instruction: z.string().min(3).max(1000),
    voiceId: z.string(),
  }),
]);

type ComposeRequest = z.infer<typeof RequestSchema>;

function promptFor(body: ComposeRequest, voice: Voice): string {
  switch (body.mode) {
    case "compose":
      return composePrompt({
        topic: body.topic,
        findings: body.findings,
        voice,
        targetWords: body.targetWords,
        cta: body.cta as CtaKind,
      });
    case "tong-hop":
      return roundupPrompt({
        topic: body.topic,
        findings: body.findings,
        voice,
        targetWords: body.targetWords,
        cta: body.cta as CtaKind,
        paperCount: body.paperCount,
      });
    case "refine":
      return refinePrompt(body.draft, body.instruction, voice);
  }
}

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const body = parsed.data;
  const voice = voiceById(body.voiceId) ?? voiceById(DEFAULT_VOICE_ID)!;

  const prompt = promptFor(body, voice);
  // Lượt chỉnh lại viết lại CẢ bài, nên nó cũng dài đúng bằng bài đang có —
  // đo từ bản nháp chứ không mặc định "chỉnh thì nhanh".
  const effort = effortFor(
    body.mode === "refine" ? countWords(body.draft) : body.targetWords,
  );

  let writer;
  try {
    writer = llm("writer");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Thiếu cấu hình." },
      { status: 500 },
    );
  }

  // Streaming: bài dài mất hàng chục giây, để chị nhìn chữ chạy ra thay vì
  // ngồi trước màn hình trắng. Cũng tránh timeout HTTP với max_tokens lớn.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of writer.streamText({ role: "writer", prompt, effort })) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `\n\n[Lỗi: ${error instanceof Error ? error.message : "không rõ"}]`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
