import type { Paper } from "./research";
import { TIER_LABEL, toTier } from "./research";

/** Ngữ cảnh chung về người viết — mọi prompt đều dùng chung khối này. */
export const AUTHOR_CONTEXT = `Người viết là huấn luyện viên thể hình và dinh dưỡng người Việt, viết cho độc giả Việt Nam trên Facebook — phần lớn là phụ nữ trưởng thành đang muốn khoẻ hơn, không phải người trong ngành.

Giọng chung của thương hiệu: ấm, cụ thể, không hù doạ, không hứa hẹn thần kỳ. Lấy hình ảnh từ đời sống Việt — mâm cơm, chợ, bữa tối gia đình — chứ không phải từ phòng gym Mỹ.`;

const SYNTHESIS_RULES = `Quy tắc bắt buộc:

1. Mọi con số trong "evidence" phải có mặt trong abstract được cấp. Không được suy ra, không được làm tròn, không được lấy từ kiến thức nền của bạn. Nếu abstract không nêu con số, mô tả kết quả bằng lời của chính abstract đó.
2. Mỗi phát hiện phải ghi đúng id của (các) bài mà nó dựa vào. Tuyệt đối không bịa id.
3. Không gộp kết quả của nhiều bài thành một con số chung.
4. Viết "claim" như đang nói chuyện với người tập: không dùng "đối tượng nghiên cứu", "có ý nghĩa thống kê", "p < 0.05".
5. Nếu một nghiên cứu chỉ làm trên nam giới, trên chuột, hoặc trên vận động viên chuyên nghiệp — bắt buộc ghi vào "caveat", vì độc giả chủ yếu là phụ nữ bình thường.
6. Trả về 4–8 phát hiện. Chọn cái đáng viết thành bài, bỏ cái vụn vặt.
7. Nếu các bài được cấp không trả lời được truy vấn, nói thẳng ở trường "note" thay vì cố nặn ra phát hiện.`;

export function synthesisPrompt(query: string, papers: Paper[]): string {
  return `${AUTHOR_CONTEXT}

Nhiệm vụ: đọc các abstract dưới đây và rút ra những phát hiện có thể dùng làm dẫn chứng cho bài đăng về: «${query}»

${SYNTHESIS_RULES}

---

${papers.map(renderPaper).join("\n\n---\n\n")}`;
}

function renderPaper(paper: Paper): string {
  const lines = [
    `id: ${paper.id}`,
    `Tiêu đề: ${paper.title}`,
    `Loại: ${TIER_LABEL[toTier(paper.studyTypes)]}${
      paper.studyTypes.length > 0 ? ` (${paper.studyTypes.join(", ")})` : ""
    }`,
    `Năm: ${paper.year ?? "không rõ"}${paper.journal ? ` · ${paper.journal}` : ""}`,
  ];

  if (paper.citedByCount !== null) {
    lines.push(`Lượt trích dẫn: ${paper.citedByCount}`);
  }

  // Cỡ mẫu quyết định độ mạnh nhiều hơn loại nghiên cứu — 20 người và 2000
  // người cùng là RCT nhưng nói được những điều rất khác nhau.
  if (paper.sampleSize !== null) {
    lines.push(`Cỡ mẫu: ${paper.sampleSize}`);
  }
  if (paper.takeaway) {
    lines.push(`Kết luận nguồn rút sẵn: ${paper.takeaway}`);
  }

  lines.push("", paper.abstract ?? "(không có abstract)");
  return lines.join("\n");
}
