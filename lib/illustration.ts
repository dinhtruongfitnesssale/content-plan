import { z } from "zod";
import { BRAND_CORE } from "./brand";
import { styleBrief, type ImageStyle } from "./image-styles";
import { AUTHOR_CONTEXT } from "./prompts";

/** Số ý tưởng sinh mỗi lượt. Ba là đủ để chọn mà chưa mệt mắt. */
export const IDEA_COUNT = 3;

export const ASPECT_CHOICES = [
  {
    id: "4:5",
    label: "Dọc 4:5",
    note: "Chiếm nhiều màn hình điện thoại nhất. Mặc định cho ảnh trong bài.",
  },
  { id: "1:1", label: "Vuông 1:1", note: "An toàn ở mọi chỗ Facebook cắt ảnh." },
  { id: "16:9", label: "Ngang 16:9", note: "Ảnh bìa, hoặc khi cảnh cần bề ngang." },
] as const;

export type AspectId = (typeof ASPECT_CHOICES)[number]["id"];
export const DEFAULT_ASPECT: AspectId = "4:5";

export const IllustrationIdeaSchema = z.object({
  concept: z
    .string()
    .describe(
      "Ý tưởng ảnh nói bằng tiếng Việt, một câu, tả cảnh nhìn thấy. Để chị đọc lướt là biết ảnh sẽ ra sao mà không cần đọc prompt tiếng Anh.",
    ),
  irony: z
    .string()
    .describe(
      "Chi tiết châm biếm hoặc siêu thực nằm ở đâu trong khung, và nó bóc trần điều gì trong bài. Một câu tiếng Việt. Nếu phong cách không có yếu tố châm biếm, nói rõ ảnh này dựa vào khoảnh khắc gì.",
    ),
  prompt: z
    .string()
    .describe(
      "Prompt TIẾNG ANH đưa thẳng cho model sinh ảnh. Chỉ tả thứ nhìn thấy được. 40-80 từ.",
    ),
  negativeExtra: z
    .string()
    .nullable()
    .describe(
      "Thứ cần loại RIÊNG cho cảnh này, tiếng Anh, phân tách bằng dấu phẩy. Danh sách loại trừ chung đã được code thêm tự động — không lặp lại nó ở đây. Để null nếu cảnh này không cần gì thêm.",
    ),
  altText: z
    .string()
    .describe(
      "Mô tả ảnh bằng tiếng Việt để điền vào ô alt text của Facebook, dưới 25 từ, tả cho người không nhìn thấy ảnh.",
    ),
});

export const IllustrationSchema = z.object({
  ideas: z.array(IllustrationIdeaSchema),
});

export type IllustrationIdea = z.infer<typeof IllustrationIdeaSchema>;

/**
 * Loại trừ nền, ghép bằng CODE chứ không do model sinh — cùng lý do với
 * `buildSources()`: những thứ tuyệt đối không được có trong ảnh thì không thể
 * phụ thuộc vào việc model có nhớ viết ra hay không.
 *
 * Ba nhóm, ba lý do khác nhau:
 * - chữ và đồ thị: model sinh ảnh viết tiếng Việt có dấu ra chữ méo, và một
 *   biểu đồ bịa là một con số bịa lọt ra ngoài — đúng thứ cả app này chặn.
 * - áo blouse, phòng lab: ảnh không được ngụ ý người viết tự làm nghiên cứu.
 * - ảnh trước-sau, body: ranh giới thương hiệu, xem `NEVER` trong `brand.ts`.
 */
export const BASE_NEGATIVE = [
  "text, letters, words, captions, subtitles, numbers, signage, book covers",
  "charts, graphs, diagrams, infographic, data visualization, scale readout",
  "lab coat, white coat, doctor, clinic, hospital, test tubes, microscope",
  "before-and-after comparison, split-screen body comparison, weight loss advertisement",
  "obesity caricature, exaggerated body proportions, shaming, distressed expression",
  "logos, brand names, trademarks, recognizable celebrities, real public figures",
  "stock photo smile, model posing, studio lighting, glossy retouched skin, plastic CGI look",
  "oversaturated colors, HDR glow, lens flare, bokeh balls, heavy vignette",
  "deformed hands, extra fingers, extra limbs, distorted faces, watermark",
].join(", ");

/**
 * Ghép prompt hoàn chỉnh để chép. Phần dương do model viết, phần âm và tỉ lệ
 * do code gắn vào — nên không lượt sinh nào đi ra ngoài mà thiếu rào chắn.
 */
export function buildImagePrompt(idea: IllustrationIdea, aspect: AspectId): string {
  const negative = idea.negativeExtra?.trim()
    ? `${BASE_NEGATIVE}, ${idea.negativeExtra.trim()}`
    : BASE_NEGATIVE;

  return `${idea.prompt.trim()}

Negative prompt: ${negative}

Aspect ratio: ${aspect}`;
}

export type IllustrationInput = {
  topic: string;
  draft: string;
  style: ImageStyle;
};

export function illustrationPrompt(input: IllustrationInput): string {
  return `${AUTHOR_CONTEXT}

Người sẽ nhìn thấy ảnh này: ${BRAND_CORE.audience}

# Nhiệm vụ

Nghĩ ${IDEA_COUNT} ý tưởng ảnh minh hoạ cho bài đăng Facebook dưới đây, rồi viết prompt tiếng Anh để đưa cho model sinh ảnh.

Ảnh ở đây không phải để trang trí cho đẹp. Nó phải làm một trong hai việc:

- dựng lại đúng tình huống đời thường mà bài đang nói tới, cụ thể đến mức độc giả nhận ra bếp nhà mình; hoặc
- bóc trần cái vô lý mà bài đang gỡ, bằng một hình ảnh khiến người ta khựng lại nửa giây rồi bật cười.

${IDEA_COUNT} ý tưởng phải khác nhau về cách tiếp cận, không phải ba biến thể của cùng một cảnh. Nếu bài có một chi tiết đời thường rất riêng, ưu tiên dùng nó — cụ thể luôn thắng khái quát.

# ${styleBrief(input.style)}

# Bài đăng

Chủ đề: «${input.topic}»

---
${input.draft.trim()}
---

# Quy tắc viết prompt

1. Prompt viết bằng TIẾNG ANH. Model sinh ảnh hiểu tiếng Anh tốt hơn tiếng Việt nhiều lần. Phần "concept", "irony", "altText" thì viết tiếng Việt.
2. Chỉ tả thứ NHÌN THẤY ĐƯỢC: chủ thể, hành động, bối cảnh, ánh sáng, góc máy, ống kính, chất liệu bề mặt. Không viết ý niệm trừu tượng — "sự cân bằng", "hành trình sức khoẻ", "cảm giác nhẹ nhõm" không vẽ ra được thành ảnh.
3. Bối cảnh là Việt Nam và phải cụ thể: gian bếp có bếp gas và rổ rau úp, sạp rau chợ sớm, bàn ăn inox, hộp cơm mang đi làm, ghế nhựa đỏ. Ghi rõ "Vietnamese" khi tả người và nơi chốn — bỏ trống thì model mặc định vẽ người phương Tây trong bếp Mỹ.
4. Người trong ảnh là người bình thường: quần áo mặc ở nhà, tóc buộc vội, không trang điểm kiểu quảng cáo, không nhìn vào ống kính.
5. Cái siêu thực chỉ được có MỘT trong mỗi ảnh, và phải tả rõ ràng như thể nó hoàn toàn có thật. Toàn bộ phần còn lại của khung hình tả thực tuyệt đối. Hai điểm lạ trở lên thì ảnh thành lộn xộn chứ không thành châm biếm.
6. Châm biếm nhắm vào THÓI QUEN, LỜI ĐỒN, hoặc MÓN ĐỒ — không bao giờ nhắm vào cơ thể một con người. Không ảnh trước–sau, không so sánh dáng người, không đặt ai vào thế đáng chê. Độc giả của bài này phần lớn đã từng thất bại vài lần với việc giảm cân; ảnh cười vào họ là hỏng cả bài viết tử tế phía trên.
7. Không chữ, không số, không biển hiệu, không đồ thị trong ảnh.
8. Không áo blouse trắng, không phòng thí nghiệm, không ống nghiệm. Bài dẫn nghiên cứu của người khác chứ người viết không tự làm nghiên cứu — ảnh không được ngụ ý ngược lại.
9. Prompt dài 40–80 từ. Ngắn quá thì model tự bịa phần thiếu, dài quá thì model bỏ sót phần giữa.
10. Không cần viết phần loại trừ chung (chữ, logo, tay thừa ngón, ảnh trước–sau) vào "negativeExtra" — code đã tự thêm.`;
}
