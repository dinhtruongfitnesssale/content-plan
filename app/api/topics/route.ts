import { NextResponse } from "next/server";
import { z } from "zod";
import { llm } from "@/lib/llm";
import { CADENCE, pillarById } from "@/lib/brand";
import { TopicsSchema, topicsPrompt } from "@/lib/topics";

export const runtime = "nodejs";
export const maxDuration = 90;

const RequestSchema = z.object({
  recent: z
    .array(
      z.object({
        pillar: z.string(),
        topic: z.string(),
        date: z.string(),
      }),
    )
    .max(200)
    .default([]),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu lịch sử không hợp lệ." }, { status: 400 });
  }

  try {
    const output = await llm("reader").generateStructured({
      role: "reader",
      prompt: topicsPrompt(parsed.data.recent, new Date()),
      schema: TopicsSchema,
      schemaName: "topic_suggestions",
    });

    if (!output) {
      return NextResponse.json(
        { error: "Model trả về dữ liệu không đọc được. Thử lại giúp chị." },
        { status: 502 },
      );
    }

    // Rào chắn: model có thể trả về trụ cột không tồn tại trong cấu hình.
    const suggestions = output.suggestions
      .filter((suggestion) => pillarById(suggestion.pillarId) !== undefined)
      .slice(0, CADENCE.suggestionsPerDay);

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Không sinh được gợi ý: ${
          error instanceof Error ? error.message : "lỗi không rõ"
        }`,
      },
      { status: 502 },
    );
  }
}
