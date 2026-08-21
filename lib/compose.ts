import { BRAND_CORE, NEVER } from "./brand";
import type { Finding } from "./findings";
import { AUTHOR_CONTEXT } from "./prompts";
import type { Paper } from "./research";
import { voiceBrief, type Voice } from "./voices";
import { wordRange } from "./words";

export type ComposeInput = {
  topic: string;
  findings: Finding[];
  voice: Voice;
  targetWords: number;
  cta: CtaKind;
};

export type CtaKind = "khong" | "cau-hoi" | "viec-nho" | "luu-bai";

export const CTA_CHOICES: { id: CtaKind; label: string; instruction: string }[] = [
  { id: "khong", label: "Không có", instruction: "Không thêm lời kêu gọi nào. Kết thúc tự nhiên." },
  {
    id: "cau-hoi",
    label: "Câu hỏi mở",
    instruction:
      "Kết bằng một câu hỏi thật, cụ thể, mà độc giả có thể trả lời bằng kinh nghiệm của họ. Không hỏi tu từ, không hỏi kiểu 'bạn nghĩ sao?'.",
  },
  {
    id: "viec-nho",
    label: "Một việc nhỏ",
    instruction:
      "Kết bằng một việc cụ thể độc giả làm được trong hôm nay hoặc bữa ăn tới. Nhỏ đến mức khó từ chối.",
  },
  {
    id: "luu-bai",
    label: "Nhắc lưu bài",
    instruction:
      "Kết bằng lời nhắc lưu bài lại để dùng khi cần, gắn với một tình huống cụ thể sẽ cần tới nó.",
  },
];

export function ctaInstruction(kind: CtaKind): string {
  return CTA_CHOICES.find((choice) => choice.id === kind)?.instruction ?? CTA_CHOICES[0].instruction;
}

export function composePrompt(input: ComposeInput): string {
  const { min, max } = wordRange(input.targetWords);

  return `${AUTHOR_CONTEXT}

Chỗ đứng của thương hiệu: ${BRAND_CORE.stand}

KHÔNG viết cho: ${BRAND_CORE.notFor}

# Nhiệm vụ

Viết một bài đăng Facebook về: «${input.topic}»

# Dẫn chứng được phép dùng

${input.findings.map(renderFinding).join("\n\n")}

# ${voiceBrief(input.voice)}

# Độ dài

Mục tiêu ${input.targetWords} từ, chấp nhận trong khoảng ${min}–${max} từ.
Tiếng Việt đếm theo âm tiết tách bằng khoảng trắng — "bánh mì" tính là 2.
Đây là ràng buộc thật, không phải gợi ý. Viết đủ ý trong khuôn đó.

# Cách kết

${ctaInstruction(input.cta)}

# Quy tắc

1. Mọi con số trong bài phải trích từ phần dẫn chứng ở trên. Không thêm số liệu từ kiến thức nền của bạn.
2. Nếu một dẫn chứng có phần "Cần nói rõ", phải phản ánh giới hạn đó trong bài — không được lờ đi để bài nghe chắc chắn hơn thực tế.
3. Không viết tên tác giả, tên tạp chí, hay năm nghiên cứu trong thân bài. Phần nguồn được ghép tự động bên dưới.
4. Viết thành đoạn ngắn 2–3 câu, cách nhau bằng dòng trống — bài dài liền mạch rất khó đọc trên điện thoại.
5. Không dùng markdown, không tiêu đề, không gạch đầu dòng, không in đậm. Facebook không hiển thị được.
6. Dùng emoji rất tiết chế hoặc không dùng.
7. Không mở đầu bằng "Bạn có biết", "Có bao giờ bạn", hay bất kỳ câu hỏi tu từ sáo mòn nào.

Tuyệt đối không:
${NEVER.map((rule) => `- ${rule}`).join("\n")}

Chỉ trả về nội dung bài đăng. Không lời dẫn, không giải thích, không tiêu đề.`;
}

function renderFinding(finding: Finding, index: number): string {
  const lines = [
    `${index + 1}. ${finding.claim}`,
    `   Số liệu: ${finding.evidence}`,
    `   Độ mạnh bằng chứng: ${finding.strength}`,
  ];
  if (finding.caveat) lines.push(`   Cần nói rõ: ${finding.caveat}`);
  return lines.join("\n");
}

export function refinePrompt(draft: string, instruction: string, voice: Voice): string {
  return `Dưới đây là một bài đăng Facebook đã viết. Sửa lại theo yêu cầu, giữ nguyên giọng văn và mọi con số.

# Yêu cầu sửa

${instruction}

# ${voiceBrief(voice)}

# Ràng buộc

- Không thêm, bớt, hay thay đổi bất kỳ con số nào.
- Không dùng markdown. Giữ cách chia đoạn ngắn.
- Chỉ trả về bài đã sửa, không lời dẫn.

# Bài hiện tại

${draft}`;
}

/**
 * Phần nguồn được ghép bằng code từ dữ liệu Paper thật, KHÔNG do model sinh.
 * Đây là lý do bài đăng không bao giờ dẫn tới một nghiên cứu không tồn tại.
 */
export function buildSources(papers: Paper[]): string {
  if (papers.length === 0) return "";

  const lines = papers.map((paper) => {
    const year = paper.year ? ` (${paper.year})` : "";
    const journal = paper.journal ? `, ${paper.journal}` : "";
    return `• ${paper.title}${year}${journal}\n  ${paper.url}`;
  });

  return `\n\n—\nNguồn:\n${lines.join("\n")}`;
}

/** Đoạn đầu tiên là hook — tách bằng code để nút "đổi hook" sửa được riêng phần đó. */
export function splitHook(draft: string): { hook: string; rest: string } {
  const index = draft.indexOf("\n\n");
  if (index === -1) return { hook: draft.trim(), rest: "" };
  return { hook: draft.slice(0, index).trim(), rest: draft.slice(index + 2).trim() };
}
