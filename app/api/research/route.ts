import { NextResponse } from "next/server";
import { z } from "zod";
import { llm } from "@/lib/llm";
import { FindingsSchema, papersForReading, verifyFindings } from "@/lib/findings";
import { synthesisPrompt } from "@/lib/prompts";
import { EVIDENCE_TIERS, searchPapers } from "@/lib/research";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({
  query: z.string().min(2).max(200),
  yearMin: z.number().int().min(1900).max(2100).optional(),
  tiers: z.array(z.enum(EVIDENCE_TIERS)).optional(),
  limit: z.number().int().min(4).max(20).optional(),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Truy vấn không hợp lệ." }, { status: 400 });
  }

  const { query, yearMin, tiers, limit } = parsed.data;

  let search;
  try {
    search = await searchPapers(query, { yearMin, tiers, limit: limit ?? 12 });
  } catch (error) {
    return NextResponse.json(
      { error: `Không tra cứu được: ${message(error)}` },
      { status: 502 },
    );
  }

  const readable = papersForReading(search.papers);
  if (readable.length === 0) {
    return NextResponse.json({
      query,
      papers: search.papers,
      sources: search.sources,
      findings: [],
      note:
        search.papers.length > 0
          ? "Tìm được bài nhưng không bài nào có abstract để đọc. Thử diễn đạt lại truy vấn bằng thuật ngữ tiếng Anh cụ thể hơn."
          : "Không tìm thấy nghiên cứu nào khớp. Thử từ khoá tiếng Anh, hoặc nới bộ lọc năm và loại nghiên cứu.",
      droppedCount: 0,
    });
  }

  try {
    const output = await llm("reader").generateStructured({
      role: "reader",
      prompt: synthesisPrompt(query, readable),
      schema: FindingsSchema,
      schemaName: "findings",
    });

    if (!output) {
      return NextResponse.json(
        { error: "Model trả về dữ liệu không đọc được. Thử lại giúp chị." },
        { status: 502 },
      );
    }

    // Rào chắn: loại phát hiện nào tham chiếu bài không có trong tập đã cấp.
    const { kept, dropped } = verifyFindings(output.findings, readable);

    return NextResponse.json({
      query,
      papers: search.papers,
      sources: search.sources,
      findings: kept,
      note: output.note,
      droppedCount: dropped,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Không tổng hợp được: ${message(error)}` },
      { status: 502 },
    );
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "lỗi không rõ";
}
