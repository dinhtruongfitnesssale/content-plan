/**
 * Bộ luật đăng bài thương hiệu cá nhân.
 *
 * Khung lấy từ mô hình "communications wheel" và ba chữ C (Clarity,
 * Consistency, Constancy) trong tài liệu personal branding — một lõi chuyên
 * môn ở trung tâm, các trụ cột nội dung xoay quanh nó, và nhịp đăng đều đặn
 * đủ để không bị quên.
 *
 * Tài liệu gốc viết cho nghề nghiệp công sở Mỹ và coi "các lát bánh xe" là
 * KÊNH truyền thông (blog, podcast, hội thảo). Ở đây chỉ có một kênh —
 * Facebook — nên các lát được diễn giải lại thành TRỤ CỘT NỘI DUNG.
 * Phần nhịp đăng và bộ trụ cột bên dưới không có trong tài liệu.
 *
 * ─────────────────────────────────────────────────────────────
 * File này là nơi chị chỉnh. Sửa ở đây, cả app đổi theo.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Lõi bánh xe. Ba trường đầu quyết định chất lượng gợi ý chủ đề nhiều hơn
 * tất cả phần còn lại của app cộng lại — chị nên viết lại bằng lời của mình.
 *
 * `notFor` là trường hay bị bỏ trống nhất và cũng là trường tạo khác biệt lớn
 * nhất: brand rõ ràng là brand dám nói mình KHÔNG dành cho ai. Bỏ trống thì
 * gợi ý sẽ nhạt và chung chung.
 */
export const BRAND_CORE = {
  expertise:
    "Dinh dưỡng và tập luyện cho phụ nữ Việt trưởng thành, dựa trên bằng chứng khoa học và mâm cơm thật của gia đình Việt",

  audience:
    "Phụ nữ Việt 30–50 tuổi, đi làm, có gia đình, muốn khoẻ và gọn hơn nhưng không có thời gian cho chế độ cầu kỳ. Phần lớn đã từng thử vài cách giảm cân và thất bại.",

  stand:
    "Ăn uống lành mạnh không cần từ bỏ cơm, nước mắm hay bữa cơm gia đình. Thay đổi bền vững đến từ vài điều chỉnh nhỏ giữ được lâu, không từ kỷ luật sắt trong ba tuần.",

  notFor:
    "Người tìm cách giảm 10kg trong một tháng, người muốn thực đơn eat-clean kiểu Âu Mỹ, và người muốn được hứa hẹn thay vì được giải thích.",
} as const;

export type PillarId =
  | "bang-chung"
  | "mam-com"
  | "go-hieu-lam"
  | "hanh-trinh"
  | "thuc-hanh"
  | "hau-truong";

export type Pillar = {
  id: PillarId;
  name: string;
  /** Trụ cột này trả lời câu hỏi gì trong đầu độc giả. */
  purpose: string;
  /** Tỉ lệ mong muốn trong tổng số bài. Cộng lại phải bằng 1. */
  share: number;
  /** Gợi ý cho model biết dạng bài nào thuộc trụ cột này. */
  examples: string[];
  /** Trụ cột này có cần tra cứu nghiên cứu trước khi viết không. */
  needsResearch: boolean;
};

export const PILLARS: Pillar[] = [
  {
    id: "bang-chung",
    name: "Bằng chứng nói gì",
    purpose: "Cho độc giả biết khoa học thật sự tìm ra điều gì, thay vì tin đồn.",
    share: 0.25,
    examples: [
      "Một nghiên cứu mới và ý nghĩa thực tế của nó với bữa ăn hằng ngày",
      "So sánh hai cách làm phổ biến, xem bằng chứng nghiêng về bên nào",
      "Giải thích vì sao một lời khuyên quen thuộc lại yếu hơn ta tưởng",
    ],
    needsResearch: true,
  },
  {
    id: "mam-com",
    name: "Mâm cơm Việt",
    purpose: "Biến kiến thức dinh dưỡng thành món ăn thật, mua được ngoài chợ.",
    share: 0.2,
    examples: [
      "Đọc lại một món quen dưới góc dinh dưỡng",
      "Cách chỉnh một bữa cơm gia đình mà cả nhà vẫn ăn ngon",
      "Đi chợ chọn gì cho một tuần",
    ],
    needsResearch: false,
  },
  {
    id: "go-hieu-lam",
    name: "Gỡ hiểu lầm",
    purpose: "Tháo những niềm tin sai đang cản độc giả, một cách nhẹ nhàng.",
    share: 0.2,
    examples: [
      "Một điều nhiều người tin nhưng bằng chứng không ủng hộ",
      "Vì sao lời khuyên đúng với vận động viên lại sai với người bình thường",
      "Chuyện gì thật sự xảy ra khi bỏ hẳn tinh bột",
    ],
    needsResearch: true,
  },
  {
    id: "hanh-trinh",
    name: "Hành trình",
    purpose: "Cho thấy thay đổi bền vững trông như thế nào ở người thật.",
    share: 0.15,
    examples: [
      "Một học viên và điều chỉnh nhỏ đã tạo khác biệt",
      "Giai đoạn chững lại và cách đi qua nó",
      "Điều người ta thường hiểu sai về chính tiến bộ của mình",
    ],
    needsResearch: false,
  },
  {
    id: "thuc-hanh",
    name: "Làm thế nào",
    purpose: "Đưa một việc cụ thể độc giả làm được ngay hôm nay.",
    share: 0.15,
    examples: [
      "Một bài tập và cách làm đúng",
      "Cách sắp bữa cho tuần bận rộn",
      "Việc nhỏ làm mỗi sáng",
    ],
    needsResearch: false,
  },
  {
    id: "hau-truong",
    name: "Hậu trường",
    purpose:
      "Cho thấy chị đứng ở đâu và nghĩ gì — phần tạo ra sự tin cậy, không phải phần tạo ra lượt thích.",
    share: 0.05,
    examples: [
      "Vì sao chị không đồng ý với một xu hướng đang thịnh",
      "Chị đọc gì, học gì tuần này",
      "Một lần chị từng sai và đã đổi ý",
    ],
    needsResearch: false,
  },
];

/**
 * Nhịp đăng. Ba chữ C dịch thành số:
 * - Constancy → postsPerWeek: đăng đều, không biến mất.
 * - Consistency → maxSamePillarStreak: không dồn cùng một trụ cột.
 * - "Be lazy" (một ý dùng nhiều lần) → repurposeAfterDays.
 */
export const CADENCE = {
  postsPerWeek: 4,
  /** Số bài liên tiếp tối đa được phép cùng một trụ cột. */
  maxSamePillarStreak: 2,
  /** Sau bao nhiêu ngày thì một chủ đề cũ được phép quay lại với góc mới. */
  repurposeAfterDays: 45,
  /** Nghỉ quá số ngày này là brand bắt đầu nguội — app sẽ nhắc. */
  quietDaysWarning: 6,
  /** Số gợi ý sinh ra mỗi lần. */
  suggestionsPerDay: 3,
} as const;

/**
 * Ràng buộc phủ định. Rút từ chương "những cách tự dìm brand của mình":
 * để brand cũ mòn, thiếu nhất quán, và nói trước khi nghĩ.
 * Đây là những thứ model KHÔNG được gợi ý.
 */
export const NEVER = [
  "Hứa kết quả theo mốc thời gian cụ thể (giảm N kg trong N tuần).",
  "Doạ dẫm hoặc khiến độc giả thấy có lỗi về cơ thể mình.",
  "Gợi ý chủ đề chỉ để câu tương tác mà không liên quan tới lõi chuyên môn.",
  "Nói về một thực phẩm như thể nó độc hại hoặc thần kỳ.",
  "Đưa lời khuyên y tế cho bệnh lý cụ thể — chuyển sang khuyên đi khám.",
  "Bắt chước giọng của một xu hướng đang thịnh nếu nó lệch với chỗ đứng của brand.",
];

export function pillarById(id: string): Pillar | undefined {
  return PILLARS.find((pillar) => pillar.id === id);
}

/**
 * So tỉ lệ thực tế với tỉ lệ mong muốn, trả về các trụ cột đang thiếu,
 * thiếu nhiều nhất xếp trước. Đây là đầu vào chính của bộ gợi ý chủ đề.
 */
export function pillarDeficits(
  recent: { pillar: string }[],
): { pillar: Pillar; actual: number; target: number; gap: number }[] {
  const total = recent.length;

  return PILLARS.map((pillar) => {
    const count = recent.filter((post) => post.pillar === pillar.id).length;
    const actual = total > 0 ? count / total : 0;
    return { pillar, actual, target: pillar.share, gap: pillar.share - actual };
  }).sort((a, b) => b.gap - a.gap);
}

if (process.env.NODE_ENV !== "production") {
  const sum = PILLARS.reduce((acc, pillar) => acc + pillar.share, 0);
  if (Math.abs(sum - 1) > 0.001) {
    console.warn(`[brand] Tổng tỉ lệ các trụ cột là ${sum}, đáng lẽ phải bằng 1.`);
  }
}
