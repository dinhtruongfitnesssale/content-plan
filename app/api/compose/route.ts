import { NextResponse } from "next/server";
import { z } from "zod";
import { llm } from "@/lib/llm";
import { composePrompt, refinePrompt, roundupPrompt, type CtaKind } from "@/lib/compose";
import { MAX_WORDS, MIN_WORDS } from "@/lib/words";
import { voiceById, DEFAULT_VOICE_ID, type Voice } from "@/lib/voices";

export const runtime = "nodejs";
// Trần cứng theo đồng hồ, streaming không cứu được. Bài 2.000 từ là ~12.000
// token, với tốc độ Opus 40–60 token/giây là 200–320 giây — sát mép 300 giây
// cũ, tức thỉnh thoảng đứt SAU KHI đã trả tiền cho lượt gọi. 600 giây cho đủ
// biên, kể cả lượt chỉnh lại độ dài (lượt đó viết lại cả bài, tốn ngang lượt đầu).
export const maxDuration = 600;

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
        for await (const chunk of writer.streamText({ role: "writer", prompt })) {
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
