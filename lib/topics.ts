import { z } from "zod";
import { BRAND_CORE, CADENCE, NEVER, PILLARS, pillarDeficits } from "./brand";

export const TopicSuggestionSchema = z.object({
  pillarId: z
    .enum(PILLARS.map((pillar) => pillar.id) as [string, ...string[]])
    .describe("Trụ cột nội dung mà chủ đề này thuộc về."),
  title: z.string().describe("Chủ đề, một cụm ngắn dưới 12 từ. Không phải tiêu đề bài."),
  angle: z
    .string()
    .describe("Góc nhìn cụ thể — cùng chủ đề nhưng viết theo hướng nào. Một câu."),
  hook: z
    .string()
    .describe(
      "Câu mở đầu bài đăng, viết sẵn để dùng luôn. Cụ thể, không hô khẩu hiệu, không hỏi tu từ sáo.",
    ),
  why: z
    .string()
    .describe("Vì sao nên viết chủ đề này lúc này. Nhắc tới nhịp trụ cột nếu có liên quan."),
  searchQuery: z
    .string()
    .nullable()
    .describe(
      "Truy vấn TIẾNG ANH để tra trên PubMed nếu chủ đề cần bằng chứng. Để null nếu không cần tra cứu.",
    ),
});

export const TopicsSchema = z.object({
  suggestions: z.array(TopicSuggestionSchema),
});

export type TopicSuggestion = z.infer<typeof TopicSuggestionSchema>;

/** Bài đã đăng gần đây — đầu vào để tính trụ cột đang thiếu và tránh lặp. */
export type RecentPost = {
  pillar: string;
  topic: string;
  /** ISO date, VD "2026-08-14". */
  date: string;
};

export function topicsPrompt(recent: RecentPost[], today: Date): string {
  const deficits = pillarDeficits(recent);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - CADENCE.repurposeAfterDays);

  const recentEnough = recent.filter((post) => new Date(post.date) >= cutoff);
  const streak = trailingStreak(recent);

  return `Bạn giúp một huấn luyện viên người Việt chọn chủ đề viết bài Facebook hôm nay.

# Lõi thương hiệu

Chuyên môn: ${BRAND_CORE.expertise}

Độc giả: ${BRAND_CORE.audience}

Chỗ đứng: ${BRAND_CORE.stand}

KHÔNG dành cho: ${BRAND_CORE.notFor}

# Các trụ cột nội dung

${PILLARS.map(
  (pillar) =>
    `- ${pillar.id} · ${pillar.name} (mục tiêu ${Math.round(pillar.share * 100)}% số bài)
  Vai trò: ${pillar.purpose}
  Dạng bài: ${pillar.examples.join(" / ")}`,
).join("\n")}

# Tình hình hiện tại

${
  recent.length === 0
    ? "Chưa có bài nào được ghi nhận. Hãy gợi ý mở đầu bằng những trụ cột chiếm tỉ trọng lớn nhất."
    : `Đã đăng ${recent.length} bài gần đây. Tỉ lệ thực tế so với mục tiêu:

${deficits
  .map(
    (item) =>
      `- ${item.pillar.name}: thực tế ${Math.round(item.actual * 100)}%, mục tiêu ${Math.round(
        item.target * 100,
      )}% → ${item.gap > 0.02 ? `ĐANG THIẾU ${Math.round(item.gap * 100)}%` : item.gap < -0.02 ? "đang thừa" : "cân"}`,
  )
  .join("\n")}

${streak ? `Đã ${streak.count} bài liên tiếp thuộc trụ cột "${streak.pillar}".` : ""}

Chủ đề đã viết trong ${CADENCE.repurposeAfterDays} ngày qua (KHÔNG được lặp lại):
${recentEnough.map((post) => `- ${post.topic}`).join("\n") || "- (không có)"}`
}

# Nhiệm vụ

Gợi ý ${CADENCE.suggestionsPerDay} chủ đề cho hôm nay.

Quy tắc:
1. Ưu tiên các trụ cột đang thiếu so với mục tiêu. Không được gợi ý quá ${CADENCE.maxSamePillarStreak} chủ đề cùng một trụ cột.
2. Mỗi gợi ý phải nối được với lõi chuyên môn ở trên. Chủ đề hay nhưng lệch chuyên môn thì bỏ.
3. Chủ đề đã viết trong danh sách trên là cấm — nhưng một chủ đề CŨ HƠN ${CADENCE.repurposeAfterDays} ngày được phép quay lại nếu có góc nhìn thật sự mới.
4. "hook" phải viết sẵn dùng được luôn, bằng tiếng Việt, giọng ấm và cụ thể. Không mở bằng câu hỏi tu từ kiểu "Bạn có biết...?".
5. Nếu chủ đề thuộc trụ cột cần bằng chứng, đặt "searchQuery" là truy vấn tiếng Anh sát nhất để tra PubMed. Nếu không cần, để null.

Tuyệt đối không gợi ý:
${NEVER.map((rule) => `- ${rule}`).join("\n")}`;
}

/** Đếm xem mấy bài gần nhất liên tiếp cùng một trụ cột. */
function trailingStreak(recent: RecentPost[]): { pillar: string; count: number } | null {
  if (recent.length === 0) return null;

  const sorted = [...recent].sort((a, b) => b.date.localeCompare(a.date));
  const pillar = sorted[0].pillar;
  let count = 0;
  for (const post of sorted) {
    if (post.pillar !== pillar) break;
    count += 1;
  }

  return count >= CADENCE.maxSamePillarStreak ? { pillar, count } : null;
}
