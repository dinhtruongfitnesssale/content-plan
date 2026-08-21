/**
 * Preset phong cách ảnh minh hoạ.
 *
 * Cùng lý do với `voices.ts`: đưa mỗi tên phong cách ("siêu thực", "tối giản")
 * cho model sinh ảnh thì mỗi lần ra một kiểu, vì tên gọi là ấn tượng chung chứ
 * không phải chỉ dẫn. Nên mỗi preset ở đây mô tả KỸ THUẬT chụp: chất liệu và
 * ống kính, ánh sáng, bố cục, bảng màu — và quan trọng nhất là `device`:
 * cái làm nên chất châm biếm, đặt ở đâu trong khung hình.
 */
export type ImageStyle = {
  id: string;
  name: string;
  /** Một dòng hiện trên giao diện để chọn. */
  blurb: string;
  medium: string;
  light: string;
  composition: string;
  /** Thủ pháp tạo cái "khựng lại nửa giây" — linh hồn của preset. */
  device: string;
  palette: string;
  avoid: string;
};

export const IMAGE_STYLES: ImageStyle[] = [
  {
    id: "ta-thuc-cham-biem",
    name: "Tả thực châm biếm",
    blurb: "Ảnh chụp thật đến từng sợi tóc, trừ đúng một chi tiết vô lý.",
    medium:
      "Ảnh chụp máy full-frame, ống 50mm hoặc 85mm, khẩu vừa nên hậu cảnh mờ nhẹ chứ không tan. Da và vải giữ nguyên kết cấu thật, có lỗ chân lông, có nếp nhăn áo.",
    light:
      "Ánh sáng tự nhiên một nguồn — cửa sổ bếp, cửa ra vào, đèn tuýp trần nhà. Bóng đổ rõ và thật. Không đèn studio, không hắt sáng đều.",
    composition:
      "Góc ngang tầm mắt, khung hình tĩnh, chủ thể hơi lệch tâm. Bố cục bình thản như ảnh chụp lúc không ai để ý.",
    device:
      "Đúng MỘT chi tiết sai quy luật, được tả tỉ mỉ như thể nó hoàn toàn có thật, và không ai trong ảnh phản ứng gì cả. Sự vô lý nằm ở tỉ lệ, số lượng, hoặc chỗ đặt của một món đồ đời thường. Chính vẻ thản nhiên của mọi người xung quanh mới tạo ra tiếng cười.",
    palette:
      "Màu thật, hơi ngả ấm, độ bão hoà thấp. Xanh rau, nâu gỗ, trắng ngà của bát đĩa men.",
    avoid:
      "Hai điểm lạ trở lên trong một khung. Nhân vật làm mặt hài. Hiệu ứng phát sáng, khói màu, tia sáng thần thánh. Mọi thứ khiến ảnh trông như tranh vẽ kỹ thuật số.",
  },
  {
    id: "tinh-vat-bep",
    name: "Tĩnh vật bếp",
    blurb: "Đồ vật trên mặt bàn, sắp như ảnh tạp chí, sai tỉ lệ một chỗ.",
    medium:
      "Ảnh tĩnh vật chụp từ trên xuống hoặc ngang mặt bàn, ống macro, nét sâu. Thấy rõ vết xước thớt, hạt nước trên rau, men rạn của bát.",
    light:
      "Một vệt nắng chéo qua mặt bàn, phần còn lại chìm trong bóng dịu. Kiểu ánh sáng cửa sổ buổi sáng, không phải đèn chụp món ăn.",
    composition:
      "Đồ vật xếp có chủ ý trên nền gỗ, nền gạch men, hoặc mâm nhôm. Nhiều khoảng trống. Vật chính nhỏ hơn ta tưởng.",
    device:
      "Sự châm biếm nằm ở TƯƠNG QUAN giữa các món đồ: cái đáng lẽ nhỏ thì to bằng cả mâm, cái đáng lẽ nhiều thì còn một mẩu, thứ đắt tiền đặt cạnh thứ rẻ tiền làm cùng một việc. Không có người trong khung.",
    palette:
      "Nâu, be, xanh rau tươi, ánh kim của nồi nhôm. Một điểm màu duy nhất được phép nổi.",
    avoid:
      "Phong cách bàn ăn kiểu Bắc Âu. Khăn lanh xám, dao gỗ, hũ thuỷ tinh — đó không phải bếp Việt. Đồ ăn bóng nhẫy kiểu quảng cáo.",
  },
  {
    id: "phong-su",
    name: "Phóng sự",
    blurb: "Chụp thẳng, không dàn dựng, không đùa. Cho bài nghiêm túc.",
    medium:
      "Ảnh phóng sự, ống 35mm, chụp cầm tay. Chấp nhận hơi rung, hơi nhiễu, khung hơi nghiêng. Không hậu kỳ.",
    light:
      "Ánh sáng có sẵn tại chỗ, kể cả khi nó không đẹp — đèn compact vàng, nắng gắt trưa, ánh xanh của trời chiều.",
    composition:
      "Bắt được khoảnh khắc giữa chừng một việc đang làm. Chủ thể không nhìn máy. Có thể có người khác lọt vào rìa khung.",
    device:
      "Không có thủ pháp nào cả. Sức nặng đến từ việc chọn đúng khoảnh khắc thật — bàn tay đang làm dở, cái nhìn xuống, tư thế mỏi. Dùng cho bài nói về điều khó, nơi một câu đùa sẽ hỏng chuyện.",
    palette: "Màu tự nhiên không chỉnh, kể cả khi ám vàng hoặc ám xanh.",
    avoid:
      "Bố cục quá gọn gàng. Người mẫu. Nụ cười hướng về ống kính. Mọi dấu vết của sự sắp đặt.",
  },
  {
    id: "phim-nhua-cu",
    name: "Phim nhựa cũ",
    blurb: "Như ảnh trong album gia đình những năm 90. Ấm và có ký ức.",
    medium:
      "Phim màu 35mm, hạt thấy rõ, độ nét vừa phải, mép ảnh hơi tối. Màu sắc lệch nhẹ kiểu phim quá hạn.",
    light:
      "Đèn flash gắn máy trong nhà, hoặc nắng chiều muộn ngoài sân. Bóng đổ cứng sau lưng chủ thể.",
    composition:
      "Chụp chính diện, hơi vụng, chủ thể ở giữa. Kiểu ảnh do người nhà chụp chứ không phải thợ ảnh.",
    device:
      "Cái vô lý được cài vào như thể nó vốn nằm trong ký ức và không ai từng thắc mắc. Sự châm biếm ở đây dịu, mang màu hoài niệm chứ không sắc.",
    palette:
      "Ám vàng và ám đỏ của phim cũ. Xanh ngả lục. Trắng không bao giờ trắng hẳn.",
    avoid:
      "Bộ lọc hoài niệm giả trên ảnh số. Chữ ghi ngày tháng ở góc. Sự hoàn hảo — ảnh phim cũ luôn có khuyết điểm.",
  },
];

export const DEFAULT_STYLE_ID = "ta-thuc-cham-biem";

export function styleById(id: string): ImageStyle | undefined {
  return IMAGE_STYLES.find((style) => style.id === id);
}

/** Dựng khối mô tả phong cách để chèn vào prompt. */
export function styleBrief(style: ImageStyle): string {
  return `Phong cách ảnh: ${style.name}

- Chất liệu và ống kính: ${style.medium}
- Ánh sáng: ${style.light}
- Bố cục: ${style.composition}
- Thủ pháp: ${style.device}
- Bảng màu: ${style.palette}
- Tránh: ${style.avoid}

Những đặc điểm này phải được dịch thành chi tiết cụ thể TRONG prompt tiếng Anh, không phải nhắc lại bằng tên gọi. Viết "shot on 50mm, natural window light from the left, visible skin texture" chứ không viết "photorealistic style".`;
}
