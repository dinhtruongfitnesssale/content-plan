import { z } from "zod";
import type { Paper } from "./research";

/**
 * Một "phát hiện" — đơn vị nhỏ nhất mà chị chọn để đưa vào bài viết.
 * Khác với một bài nghiên cứu: một bài có thể cho ra nhiều phát hiện,
 * và một phát hiện có thể tựa trên nhiều bài.
 */
export const FindingSchema = z.object({
  claim: z
    .string()
    .describe(
      "Một câu tiếng Việt đời thường, không thuật ngữ, nói rõ nghiên cứu tìm ra điều gì. Viết như đang nói với người tập, không phải với đồng nghiệp.",
    ),
  evidence: z
    .string()
    .describe(
      "Con số hoặc kết quả cụ thể, trích thẳng từ abstract được cấp. Giữ nguyên đơn vị và độ chính xác của bản gốc. Không làm tròn, không suy diễn.",
    ),
  strength: z
    .enum(["mạnh", "trung bình", "yếu"])
    .describe(
      "Độ mạnh bằng chứng, suy từ loại nghiên cứu và cỡ mẫu. mạnh = phân tích gộp hoặc RCT cỡ lớn; trung bình = RCT nhỏ hoặc nghiên cứu quan sát tốt; yếu = bài tổng quan tường thuật, nghiên cứu nhỏ, hoặc trên động vật.",
    ),
  caveat: z
    .string()
    .nullable()
    .describe(
      "Giới hạn cần nói rõ khi đăng lên mạng xã hội — cỡ mẫu nhỏ, chỉ trên nam giới, chỉ trên chuột, thời gian ngắn... Để null nếu không có gì đáng lưu ý.",
    ),
  angle: z
    .string()
    .describe("Một góc viết bài gợi mở từ phát hiện này, ngắn gọn dưới 15 từ."),
  paperIds: z
    .array(z.string())
    .describe("Các id bài nghiên cứu đã được cấp mà phát hiện này dựa vào."),
});

export const FindingsSchema = z.object({
  findings: z.array(FindingSchema),
  /** Model nói thẳng nếu tập bài tìm được không trả lời được câu hỏi. */
  note: z
    .string()
    .nullable()
    .describe(
      "Nếu các bài tìm được không đủ để trả lời truy vấn, nói rõ ở đây bằng tiếng Việt. Để null nếu tập bài đã đủ.",
    ),
});

export type Finding = z.infer<typeof FindingSchema>;

/**
 * Rào chắn chống bịa số liệu.
 *
 * Model có thể tham chiếu một id không tồn tại, hoặc gộp nhầm số liệu của bài
 * này sang bài khác. Bài đăng dẫn nghiên cứu sai còn tệ hơn bài không dẫn gì —
 * nên phát hiện nào tham chiếu id lạ thì loại bỏ, không hiển thị.
 */
export function verifyFindings(
  findings: Finding[],
  papers: Paper[],
): { kept: Finding[]; dropped: number } {
  const known = new Set(papers.map((paper) => paper.id));
  const kept: Finding[] = [];
  let dropped = 0;

  for (const finding of findings) {
    const valid = finding.paperIds.filter((id) => known.has(id));
    if (valid.length === 0) {
      dropped += 1;
      continue;
    }
    kept.push({ ...finding, paperIds: valid });
  }

  return { kept, dropped };
}

/** Chỉ đưa vào prompt những bài thật sự có abstract để đọc. */
export function papersForReading(papers: Paper[], max = 12): Paper[] {
  return papers.filter((paper) => paper.abstract !== null).slice(0, max);
}
