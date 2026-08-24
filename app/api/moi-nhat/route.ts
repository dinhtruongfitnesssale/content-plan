import { NextResponse } from "next/server";
import { z } from "zod";
import { EVIDENCE_TIERS, searchPapers, type SearchResult } from "@/lib/research";
import { WATCHLIST, beatById, withWomenFocus } from "@/lib/watchlist";
import type { BeatUpdate, LatestResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({
  beats: z.array(z.string()).min(1).max(WATCHLIST.length).optional(),
  days: z.number().int().min(7).max(730).optional(),
  tiers: z.array(z.enum(EVIDENCE_TIERS)).optional(),
  womenFocus: z.boolean().optional(),
  perBeat: z.number().int().min(3).max(20).optional(),
});

/**
 * Bảng tin "Mới nhất" — cố ý KHÔNG gọi model.
 *
 * Đây là chỗ để lướt xem tuần này có gì, không phải chỗ rút phát hiện. Mỗi
 * lượt mở bảng tin quét 7 mảng chủ đề; cho model đọc hết chỗ đó thì vừa lâu
 * vừa tốn, mà rào chắn chống bịa số liệu lại phải dựng thêm một lần nữa.
 * Muốn có phát hiện tiếng Việt thì bấm "Tra cứu sâu" ở từng mảng — đường đó
 * đi qua /api/research, nơi `verifyFindings()` đã đứng sẵn.
 */
export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }

  const { beats: ids, days = 90, tiers, womenFocus = false, perBeat = 8 } = parsed.data;

  const beats = (ids ?? WATCHLIST.map((beat) => beat.id))
    .map(beatById)
    .filter((beat) => beat !== undefined);

  if (beats.length === 0) {
    return NextResponse.json({ error: "Không có chủ đề nào để theo dõi." }, { status: 400 });
  }

  const updates: BeatUpdate[] = [];

  // Chạy lần lượt chứ không Promise.all: mỗi mảng tốn 2 request PubMed, mà
  // NCBI chỉ cho 3 request/giây khi không có key. Bắn 7 mảng cùng lúc là ăn
  // ngay trang chặn — và trang đó trả HTTP 200 kèm HTML, hỏng rất khó thấy.
  for (const beat of beats) {
    const query = womenFocus ? withWomenFocus(beat.query) : beat.query;

    let result: SearchResult;
    try {
      result = await cached(`${beat.id}|${days}|${perBeat}|${womenFocus}|${(tiers ?? []).join(",")}`, () =>
        searchPapers(query, { days, tiers, limit: perBeat, sort: "recent" }),
      );
    } catch (error) {
      updates.push({
        ...describe(beat),
        query,
        papers: [],
        sources: [],
        error: error instanceof Error ? error.message : "lỗi không rõ",
      });
      continue;
    }

    updates.push({
      ...describe(beat),
      query,
      papers: result.papers,
      sources: result.sources,
      error: null,
    });
  }

  const body: LatestResponse = {
    beats: updates,
    days,
    womenFocus,
    fetchedAt: Date.now(),
  };
  return NextResponse.json(body);
}

function describe(beat: (typeof WATCHLIST)[number]) {
  return { id: beat.id, name: beat.name, why: beat.why, pillar: beat.pillar };
}

/**
 * Bộ nhớ đệm trong RAM của tiến trình.
 *
 * Nghiên cứu mới không ra theo phút, nên tra lại cùng một mảng trong vòng nửa
 * tiếng là phí lượt gọi PubMed — mà hạn mức của NCBI mới là thứ dễ chạm nhất
 * ở đây. Trên Vercel mỗi instance có bộ nhớ riêng và instance ngủ thì mất
 * sạch; đó là chấp nhận được vì đây chỉ là lớp đệm, không phải nguồn dữ liệu.
 */
const TTL_MS = 30 * 60 * 1000;
const memo = new Map<string, { at: number; value: SearchResult }>();

async function cached(key: string, run: () => Promise<SearchResult>): Promise<SearchResult> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = await run();
  memo.set(key, { at: Date.now(), value });

  // Dọn mục hết hạn ngay tại đây thay vì hẹn giờ: route handler không có vòng
  // đời ổn định để giữ một setInterval.
  for (const [k, entry] of memo) {
    if (Date.now() - entry.at >= TTL_MS) memo.delete(k);
  }

  return value;
}
