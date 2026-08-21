/**
 * Chạy thật tầng sinh prompt ảnh trên một bài mẫu — không mock.
 *
 *   npx tsx --env-file=.env.local scripts/thu-anh.ts
 *   npx tsx --env-file=.env.local scripts/thu-anh.ts tinh-vat-bep
 *
 * Việc cần nhìn khi đọc kết quả: prompt có tả được THỨ NHÌN THẤY không, có ghi
 * "Vietnamese" không, và chỉ có ĐÚNG MỘT chi tiết siêu thực hay đã thành lộn xộn.
 */
import { buildImagePrompt, illustrationPrompt, IllustrationSchema } from "../lib/illustration";
import { DEFAULT_STYLE_ID, IMAGE_STYLES, styleById } from "../lib/image-styles";
import { describeSetup, llm } from "../lib/llm";

const TOPIC = "Ăn cơm buổi tối có làm tăng cân không";

const DRAFT = `Chiều nào chị cũng đứng trước nồi cơm và phân vân. Người ta bảo tối đừng ăn cơm.

Cơm không biết mấy giờ. Cơ thể cũng vậy. Cái quyết định cân nặng là tổng lượng ăn cả ngày, không phải cái đồng hồ treo trên tường bếp.

Điều thật sự xảy ra khi bỏ cơm tối là chín giờ chị đói, rồi chị ăn bánh. Bát cơm lúc bảy giờ hiền lành hơn gói bánh lúc chín giờ nhiều.

Tối nay chị cứ ăn cơm. Xới một bát vừa, gắp thêm rau, ngồi ăn cùng nhà.`;

async function main() {
  const styleId = process.argv[2] ?? DEFAULT_STYLE_ID;
  const style = styleById(styleId);

  if (!style) {
    console.error(
      `Không có phong cách "${styleId}". Chọn: ${IMAGE_STYLES.map((s) => s.id).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`\nViết: ${describeSetup().writer}`);
  console.log(`Phong cách: ${style.name} — ${style.blurb}\n`);

  const started = Date.now();
  const output = await llm("writer").generateStructured({
    role: "writer",
    prompt: illustrationPrompt({ topic: TOPIC, draft: DRAFT, style }),
    schema: IllustrationSchema,
    schemaName: "illustration_ideas",
  });

  if (!output) {
    console.log("HỎNG — không trả về dữ liệu khớp schema\n");
    process.exit(1);
  }

  console.log(`${output.ideas.length} ý tưởng (${Date.now() - started}ms)\n`);

  for (const [index, idea] of output.ideas.entries()) {
    const prompt = buildImagePrompt(idea, "4:5");
    console.log(`── ${index + 1}. ${idea.concept}`);
    console.log(`   Châm biếm: ${idea.irony}`);
    console.log(`   Alt: ${idea.altText}`);
    console.log(`   Prompt (${idea.prompt.trim().split(/\s+/).length} từ):\n`);
    console.log(prompt.replace(/^/gm, "   "), "\n");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
