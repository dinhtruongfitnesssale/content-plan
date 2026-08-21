import { NextResponse } from "next/server";
import { z } from "zod";
import { llm } from "@/lib/llm";
import { composePrompt, refinePrompt, type CtaKind } from "@/lib/compose";
import { MAX_WORDS, MIN_WORDS } from "@/lib/words";
import { voiceById, DEFAULT_VOICE_ID } from "@/lib/voices";

export const runtime = "nodejs";
export const maxDuration = 300;

const FindingSchema = z.object({
  claim: z.string(),
  evidence: z.string(),
  strength: z.enum(["mạnh", "trung bình", "yếu"]),
  caveat: z.string().nullable(),
  angle: z.string(),
  paperIds: z.array(z.string()),
});

const PaperSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number().nullable(),
  journal: z.string().nullable(),
  url: z.string(),
});

const RequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("compose"),
    topic: z.string().min(2).max(300),
    findings: z.array(FindingSchema).min(1).max(12),
    papers: z.array(PaperSchema).max(30),
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

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const body = parsed.data;
  const voice = voiceById(body.voiceId) ?? voiceById(DEFAULT_VOICE_ID)!;

  const prompt =
    body.mode === "compose"
      ? composePrompt({
          topic: body.topic,
          findings: body.findings,
          voice,
          targetWords: body.targetWords,
          cta: body.cta as CtaKind,
        })
      : refinePrompt(body.draft, body.instruction, voice);

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
