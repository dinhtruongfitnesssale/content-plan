import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { countWords } from "@/lib/words";
import type { Post } from "@/lib/store/types";

export const runtime = "nodejs";

const TABLE = "posts";

/**
 * HEAD dùng để client dò xem có Supabase hay không.
 * 501 = chưa cấu hình → client tự chuyển sang localStorage.
 */
export async function HEAD() {
  return new Response(null, { status: isSupabaseConfigured() ? 200 : 501 });
}

const NewPostSchema = z.object({
  postedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  topic: z.string().min(1).max(300),
  pillar: z.string().min(1).max(50),
  voiceId: z.string().min(1).max(50),
  targetWords: z.number().int().min(0).max(5000),
  actualWords: z.number().int().min(0).max(5000),
  body: z.string().min(1).max(50000),
  papers: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        year: z.number().nullable(),
        journal: z.string().nullable(),
        url: z.string(),
      }),
    )
    .max(30),
  findings: z.array(z.unknown()).max(20),
});

/**
 * Sửa lại bài đã lưu. Chỉ bốn trường — `PostEdit` trong lib/store/types.ts giải
 * thích vì sao số từ, danh mục nghiên cứu và các phát hiện không sửa được.
 */
const PostEditSchema = NewPostSchema.pick({
  postedOn: true,
  topic: true,
  pillar: true,
  body: true,
});

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 501 });
  }

  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .order("posted_on", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: `Không đọc được thư viện: ${error.message}` }, { status: 502 });
  }

  return NextResponse.json({ posts: (data ?? []).map(fromRow) });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 501 });
  }

  const parsed = NewPostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu bài viết không hợp lệ." }, { status: 400 });
  }

  const input = parsed.data;
  const { data, error } = await supabase()
    .from(TABLE)
    .insert({
      posted_on: input.postedOn,
      topic: input.topic,
      pillar: input.pillar,
      voice_id: input.voiceId,
      target_words: input.targetWords,
      actual_words: input.actualWords,
      body: input.body,
      papers: input.papers,
      findings: input.findings,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: `Không lưu được: ${error.message}` }, { status: 502 });
  }

  return NextResponse.json({ post: fromRow(data) });
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 501 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  }

  const parsed = PostEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu bài viết không hợp lệ." }, { status: 400 });
  }

  const input = parsed.data;
  const { data, error } = await supabase()
    .from(TABLE)
    .update({
      posted_on: input.postedOn,
      topic: input.topic,
      pillar: input.pillar,
      body: input.body,
      // Đếm lại ở server, không nhận số từ do client gửi: con số này đi vào bộ
      // gợi ý chủ đề, mà thân bài mới là sự thật.
      actual_words: countWords(input.body),
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Không lưu được: ${error.message}` }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy bài này." }, { status: 404 });
  }

  return NextResponse.json({ post: fromRow(data) });
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 501 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  }

  const { error } = await supabase().from(TABLE).delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: `Không xoá được: ${error.message}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

/** Postgres dùng snake_case, TypeScript dùng camelCase. Quy đổi ở đúng một chỗ. */
function fromRow(row: Record<string, unknown>): Post {
  return {
    id: String(row.id),
    postedOn: String(row.posted_on),
    createdAt: String(row.created_at),
    topic: String(row.topic),
    pillar: String(row.pillar),
    voiceId: String(row.voice_id),
    targetWords: Number(row.target_words),
    actualWords: Number(row.actual_words),
    body: String(row.body),
    papers: (row.papers ?? []) as Post["papers"],
    findings: (row.findings ?? []) as Post["findings"],
  };
}
