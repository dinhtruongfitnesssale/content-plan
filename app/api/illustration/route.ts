import { NextResponse } from "next/server";
import { z } from "zod";
import { llm } from "@/lib/llm";
import { IDEA_COUNT, IllustrationSchema, illustrationPrompt } from "@/lib/illustration";
import { DEFAULT_STYLE_ID, styleById } from "@/lib/image-styles";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({
  topic: z.string().min(2).max(300),
  draft: z.string().min(10).max(20000),
  styleId: z.string(),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const style = styleById(parsed.data.styleId) ?? styleById(DEFAULT_STYLE_ID)!;

  try {
    // Vai `writer`: đầu vào là bản nháp chưa đăng và chỗ đứng thương hiệu,
    // không phải abstract công khai. Xem bảng hai vai trong `lib/llm/types.ts`.
    const output = await llm("writer").generateStructured({
      role: "writer",
      prompt: illustrationPrompt({
        topic: parsed.data.topic,
        draft: parsed.data.draft,
        style,
      }),
      schema: IllustrationSchema,
      schemaName: "illustration_ideas",
    });

    if (!output) {
      return NextResponse.json(
        { error: "Model trả về dữ liệu không đọc được. Thử lại giúp chị." },
        { status: 502 },
      );
    }

    // Rào chắn: model có thể trả thừa hoặc trả ý tưởng rỗng.
    const ideas = output.ideas
      .filter((idea) => idea.prompt.trim().length > 0)
      .slice(0, IDEA_COUNT);

    if (ideas.length === 0) {
      return NextResponse.json(
        { error: "Không nghĩ được ý tưởng nào cho bài này. Thử đổi phong cách." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ideas });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Không sinh được prompt ảnh: ${
          error instanceof Error ? error.message : "lỗi không rõ"
        }`,
      },
      { status: 502 },
    );
  }
}
