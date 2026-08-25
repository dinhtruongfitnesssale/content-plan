import { BRAND_CORE, NEVER } from "./brand";
import type { Finding } from "./findings";
import { AUTHOR_CONTEXT } from "./prompts";
import type { Paper } from "./research";
import { TIER_LABEL, toTier } from "./research";
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

/**
 * Dạng bài — quyết định dùng `composePrompt` hay `roundupPrompt`.
 *
 * Id trùng với `mode` của `/api/compose` để không phải dịch qua lại giữa hai
 * bảng tên; lệch tên ở đây là kiểu hỏng chỉ lộ ra khi bấm nút.
 */
export type PostKind = "compose" | "tong-hop";

export const POST_KINDS: { id: PostKind; label: string; note: string }[] = [
  {
    id: "compose",
    label: "Bài một ý",
    note: "Viết quanh một điều duy nhất. Hợp khi chỉ chọn vài phát hiện cùng nói một chuyện.",
  },
  {
    id: "tong-hop",
    label: "Bài tổng hợp",
    note: "Gộp cả tập bằng chứng: chỗ các nghiên cứu đồng thuận, chỗ còn vênh nhau, rồi ý nghĩa thực tế.",
  },
];

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
3. Không viết tên tác giả, tên tạp chí, hay năm nghiên cứu trong thân bài. Danh mục trích dẫn có đánh số được ghép tự động bên dưới, đầy đủ và có link.
4. Không tự đánh số dẫn chứng kiểu [1], [2] trong thân bài. Số thứ tự trong danh mục do code đánh theo dữ liệu thật; model đoán số là dẫn nguồn sai.
5. Viết thành đoạn ngắn 2–3 câu, cách nhau bằng dòng trống — bài dài liền mạch rất khó đọc trên điện thoại.
6. Không dùng markdown, không tiêu đề, không gạch đầu dòng, không in đậm. Facebook không hiển thị được.
7. Dùng emoji rất tiết chế hoặc không dùng.
8. Không mở đầu bằng "Bạn có biết", "Có bao giờ bạn", hay bất kỳ câu hỏi tu từ sáo mòn nào.

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


/** Đoạn đầu tiên là hook — tách bằng code để nút "đổi hook" sửa được riêng phần đó. */
export function splitHook(draft: string): { hook: string; rest: string } {
  const index = draft.indexOf("\n\n");
  if (index === -1) return { hook: draft.trim(), rest: "" };
  return { hook: draft.slice(0, index).trim(), rest: draft.slice(index + 2).trim() };
}

/* ─────────────────────────────────────────────────────────────
   Bài tổng hợp — gộp nhiều nghiên cứu của một chủ đề
   ───────────────────────────────────────────────────────────── */

export type RoundupInput = {
  topic: string;
  findings: Finding[];
  voice: Voice;
  targetWords: number;
  cta: CtaKind;
  /**
   * Số nghiên cứu đã đọc để viết bài. Đây là con số DUY NHẤT ngoài phần dẫn
   * chứng mà model được phép nêu trong thân bài — nó do code đếm từ dữ liệu
   * thật, không phải model nhớ ra.
   */
  paperCount: number;
};

/**
 * Khác `composePrompt` ở chỗ nào, và vì sao phải tách hẳn ra:
 *
 * `composePrompt` viết bài quanh MỘT ý — vài dẫn chứng đã chọn tay, bài chỉ
 * cần nói trúng một điều. Bài tổng hợp trả lời câu hỏi khác: "cả đống nghiên
 * cứu về chuyện này nói gì". Nên nó phải nêu được chỗ các nghiên cứu ĐỒNG Ý,
 * chỗ còn VÊNH nhau, và chỗ chưa ai biết — ba phần đó mới là giá trị của một
 * bài gộp. Nhét yêu cầu này vào prompt cũ thì bài ngắn cũng bị ép thành tổng
 * quan, còn bài tổng quan lại thiếu chỗ dựa để nói "bằng chứng tới đâu".
 */
export function roundupPrompt(input: RoundupInput): string {
  const { min, max } = wordRange(input.targetWords);
  const strengths = countStrengths(input.findings);

  return `${AUTHOR_CONTEXT}

Chỗ đứng của thương hiệu: ${BRAND_CORE.stand}

KHÔNG viết cho: ${BRAND_CORE.notFor}

# Nhiệm vụ

Viết một bài đăng Facebook TỔNG HỢP về: «${input.topic}»

Không phải bài kể về một nghiên cứu. Đây là bài gộp: đọc ${input.paperCount} nghiên cứu về chủ đề này rồi nói cho độc giả biết cả tập bằng chứng đang chỉ về đâu.

# Dẫn chứng được phép dùng

Rút từ ${input.paperCount} nghiên cứu. Độ mạnh: ${strengths}.

${input.findings.map(renderFinding).join("\n\n")}

# Bố cục bắt buộc

Bài phải đi qua đủ bốn chặng, viết liền mạch thành các đoạn ngắn — KHÔNG đặt tiêu đề cho từng chặng:

1. Mở bằng câu hỏi thật mà độc giả đang có trong đầu về chủ đề này, hoặc bằng lời đồn phổ biến quanh nó. Một đến hai câu.
2. Điều các nghiên cứu ĐỒNG THUẬN — phần chắc nhất, dẫn số liệu cụ thể.
3. Điều còn VÊNH nhau hoặc CHƯA rõ. Bắt buộc phải có phần này. Bài gộp mà chỗ nào cũng chắc nịch là bài không trung thực.
4. Ý nghĩa thực tế cho mâm cơm hoặc buổi tập của độc giả — cụ thể, làm được ngay.

# ${voiceBrief(input.voice)}

# Độ dài

Mục tiêu ${input.targetWords} từ, chấp nhận trong khoảng ${min}–${max} từ.
Tiếng Việt đếm theo âm tiết tách bằng khoảng trắng — "bánh mì" tính là 2.
Đây là ràng buộc thật, không phải gợi ý. Bốn chặng trên phải nằm gọn trong khuôn đó.

# Cách kết

${ctaInstruction(input.cta)}

# Quy tắc

1. Mọi con số trong bài phải trích từ phần dẫn chứng ở trên. Không thêm số liệu từ kiến thức nền của bạn.
2. Ngoại lệ duy nhất: được nói bài này đọc ${input.paperCount} nghiên cứu. Con số đó do hệ thống đếm, đúng.
3. Nói rõ bằng chứng mạnh tới đâu bằng lời đời thường — "nhiều thử nghiệm cỡ lớn cùng cho kết quả này" hay "mới có vài nghiên cứu nhỏ". Không dùng "meta-analysis", "RCT", "có ý nghĩa thống kê".
4. Nếu một dẫn chứng có phần "Cần nói rõ", phải phản ánh giới hạn đó — không được lờ đi để bài nghe chắc chắn hơn thực tế.
5. Không viết tên tác giả, tên tạp chí, hay năm nghiên cứu trong thân bài. Danh mục trích dẫn được ghép tự động bên dưới, đầy đủ và có link.
6. Không tự đánh số dẫn chứng kiểu [1], [2] trong bài. Danh mục bên dưới có đánh số, nhưng số đó do code đánh theo dữ liệu thật — model tự gán số là gán sai, và số sai thì thành dẫn nguồn sai.
7. Viết thành đoạn ngắn 2–3 câu, cách nhau bằng dòng trống — bài dài liền mạch rất khó đọc trên điện thoại.
8. Không dùng markdown, không tiêu đề, không gạch đầu dòng, không in đậm. Facebook không hiển thị được.
9. Dùng emoji rất tiết chế hoặc không dùng.
10. Không mở đầu bằng "Bạn có biết", "Có bao giờ bạn", hay bất kỳ câu hỏi tu từ sáo mòn nào.

Tuyệt đối không:
${NEVER.map((rule) => `- ${rule}`).join("\n")}

Chỉ trả về nội dung bài đăng. Không lời dẫn, không giải thích, không tiêu đề.`;
}

/** VD: "3 mạnh · 2 trung bình · 1 yếu" — bỏ qua bậc không có phát hiện nào. */
function countStrengths(findings: Finding[]): string {
  const order = ["mạnh", "trung bình", "yếu"] as const;
  const tally = new Map<string, number>();
  for (const finding of findings) {
    tally.set(finding.strength, (tally.get(finding.strength) ?? 0) + 1);
  }
  const parts = order
    .filter((strength) => tally.has(strength))
    .map((strength) => `${tally.get(strength)} phát hiện bằng chứng ${strength}`);
  return parts.join(" · ") || "chưa xếp được";
}

/**
 * Chia tập bài tìm được thành hai nhóm: bài đã đi vào thân bài (qua các phát
 * hiện được dùng) và bài cùng chủ đề nhưng không được dẫn.
 *
 * Phải chia bằng `paperIds` của phát hiện chứ không đoán: dán nhãn "đã dẫn"
 * cho một bài không hề được dẫn cũng là một kiểu dẫn nguồn sai.
 *
 * Có thêm một lượt khử trùng lặp theo TIÊU ĐỀ, dù `lib/research` đã khử một
 * lượt rồi. Không thừa: tầng đó khoá theo DOI → PMID → tiêu đề, nên cùng một
 * bài mà bản này có DOI còn bản kia không thì ra hai khoá khác nhau và cả hai
 * cùng sống sót. Đo thật ngày 25/08/2026, truy vấn "protein intake older
 * women": "Dietary protein intake in sarcopenic obese older women" hiện hai
 * lần liền nhau trong danh mục. Ở trang Nghiên cứu chuyện đó chỉ hơi rối mắt;
 * ở đây nó nằm trong bài đăng, và danh mục trích dẫn kể cùng một nghiên cứu
 * hai lần trông như đếm bằng chứng gian.
 *
 * Khi trùng thì giữ bản ĐƯỢC DẪN, không giữ bản đứng trước: giữ nhầm bản kia
 * là đẩy một nghiên cứu có phát hiện đứng sau xuống mục "đọc thêm".
 */
export function splitCited(
  papers: Paper[],
  findings: Finding[],
): { cited: Paper[]; related: Paper[] } {
  const used = new Set(findings.flatMap((finding) => finding.paperIds));

  const byTitle = new Map<string, Paper>();
  for (const paper of papers) {
    const key = normalizeWords(paper.title);
    const kept = byTitle.get(key);
    if (!kept || (!used.has(kept.id) && used.has(paper.id))) byTitle.set(key, paper);
  }

  const unique = [...byTitle.values()];
  return {
    cited: unique.filter((paper) => used.has(paper.id)),
    related: unique.filter((paper) => !used.has(paper.id)),
  };
}

/**
 * Chọn bài cho mục "cùng chủ đề, đọc thêm" — và loại bài lạc đề.
 *
 * Vì sao phải có cửa chắn này: `searchPapers` KHÔNG cắt tổng số sau khi gộp,
 * mỗi nguồn trả về `limit` bài nên tập gộp có thể gấp đôi. Đuôi của tập đó
 * khớp rất lỏng — đo thật ngày 25/08/2026 với truy vấn "creatine women muscle":
 * trong 12 bài không được dẫn có "Statin Safety and Associated Adverse Events",
 * "Congenital Titinopathy", "Sarcopenia: revised European consensus".
 *
 * Ở trang Nghiên cứu chúng nằm trong mục "xem toàn bộ", vô hại. Ở đây chúng đi
 * thẳng vào bài đăng dưới nhãn "cùng chủ đề" — mà đó là một lời khẳng định, và
 * app này không đăng lời khẳng định chưa kiểm chứng. Nên: chỉ giữ bài mà TIÊU
 * ĐỀ thật sự nhắc tới từ khoá của truy vấn.
 *
 * Đếm trên tiêu đề chứ không trên abstract: abstract dài, gần như bài nào cũng
 * có chữ "muscle" ở đâu đó, cửa chắn sẽ thành hình thức. Ngưỡng là hai từ khoá
 * khác nhau (hoặc toàn bộ, nếu truy vấn chỉ có một từ) — một từ trùng thì quá
 * dễ, "muscle fatigue" không phải bài về creatine.
 *
 * Bài được DẪN trong thân bài không đi qua đây: chúng đã có phát hiện đứng sau
 * và đã qua `verifyFindings()`.
 */
export function pickRelated(related: Paper[], topic: string, max = 8): Paper[] {
  const keywords = keywordsOf(topic);
  if (keywords.length === 0) return related.slice(0, max);

  const needed = Math.min(2, keywords.length);

  return related
    .map((paper) => {
      const title = normalizeWords(paper.title);
      const hits = keywords.filter((word) => title.includes(word)).length;
      return { paper, hits };
    })
    .filter((scored) => scored.hits >= needed)
    // Trùng nhiều từ khoá hơn thì lên trước; bằng nhau thì giữ thứ tự cũ, tức
    // là giữ nguyên thứ hạng theo bậc bằng chứng của tầng nghiên cứu.
    .sort((a, b) => b.hits - a.hits)
    .slice(0, max)
    .map((scored) => scored.paper);
}

/** Từ khoá của truy vấn: bỏ dấu, bỏ từ dưới 3 ký tự, bỏ trùng. */
function keywordsOf(topic: string): string[] {
  return [...new Set(normalizeWords(topic).split(" ").filter((word) => word.length >= 3))];
}

/** Về chữ thường, bỏ dấu tiếng Việt, mọi thứ không phải chữ/số thành khoảng trắng. */
function normalizeWords(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/**
 * Danh mục trích dẫn cuối bài — đánh số liên tục qua cả hai nhóm.
 *
 * Đây là khuôn trích dẫn DUY NHẤT của app: bài dựng từ một nghiên cứu cũng đi
 * qua đây và ra đúng một mục mang số 1. Trước đây bài một ý dùng một hàm riêng
 * ghép danh sách gạch đầu dòng không đánh số — hai khuôn cho cùng một việc chỉ
 * làm độc giả gặp hai kiểu dẫn nguồn tuỳ bài, mà kiểu không số thì không đếm
 * được và không tra ngược được.
 *
 * Phần này ghép bằng code từ dữ liệu `Paper` thật, KHÔNG do model sinh. Đánh
 * số để độc giả đếm được "bài này dựa trên bao nhiêu nghiên cứu" — con số đó
 * phải khớp với con số model nêu trong thân bài, và cả hai đều đếm từ cùng một
 * mảng.
 *
 * Nhóm "đọc thêm" nói thẳng là KHÔNG được dẫn trong bài. Gộp chung một danh
 * mục thì độc giả tưởng mọi bài trong đó đều đứng sau câu chữ phía trên.
 */
export function buildCitations(cited: Paper[], related: Paper[] = []): string {
  if (cited.length === 0 && related.length === 0) return "";

  const blocks: string[] = [];
  let index = 0;

  if (cited.length > 0) {
    const entries = cited.map((paper) => citation(paper, ++index));
    // Tiêu đề nhóm chỉ có nghĩa khi CÓ nhóm thứ hai để phân biệt. Không có
    // bài đọc thêm mà vẫn in nó thì thành hai dòng tiêu đề chồng nhau ngay
    // đầu danh mục, chẳng nói thêm điều gì.
    const heading =
      related.length > 0 ? `Dẫn trong bài (${cited.length} nghiên cứu):\n\n` : "";
    blocks.push(`${heading}${entries.join("\n\n")}`);
  }

  if (related.length > 0) {
    const entries = related.map((paper) => citation(paper, ++index));
    blocks.push(
      `Cùng chủ đề, không dẫn trực tiếp trong bài nhưng đáng đọc:\n\n${entries.join("\n\n")}`,
    );
  }

  return `\n\n—\n${CITATION_HEADING}\n\n${blocks.join("\n\n")}`;
}

/**
 * Mốc mở đầu danh mục.
 *
 * Giữ cả chữ tiếng Anh vì đó là mốc độc giả quen mắt ở bài khoa học — nhìn
 * thấy nó là biết bên dưới có nguồn tra được, kể cả khi đang lướt nhanh.
 */
const CITATION_HEADING = "Nguồn tham khảo (References)";

/** Một mục trích dẫn: số thứ tự, tiêu đề gốc, rồi dòng metadata, rồi link. */
function citation(paper: Paper, index: number): string {
  const meta = [
    TIER_LABEL[toTier(paper.studyTypes)],
    paper.year !== null ? String(paper.year) : null,
    paper.journal,
  ].filter((part): part is string => Boolean(part));

  return `${index}. ${paper.title}\n   ${meta.join(" · ")}\n   ${paper.url}`;
}
