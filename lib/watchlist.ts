/**
 * Danh sách chủ đề theo dõi thường trực — nguồn dữ liệu của bảng tin "Mới nhất".
 *
 * Khác với trang Nghiên cứu (chị gõ một câu hỏi cụ thể rồi app đi tìm), bảng
 * tin trả lời câu hỏi ngược lại: "mấy tuần nay có gì mới đáng đọc không".
 * Nên chủ đề ở đây phải được khai sẵn và giữ nguyên qua từng tuần, mới so
 * được tuần này với tuần trước.
 *
 * ─────────────────────────────────────────────────────────────
 * File này là nơi chị chỉnh. Thêm một mục vào WATCHLIST là bảng tin có thêm
 * một mảng theo dõi, không phải sửa gì khác.
 * ─────────────────────────────────────────────────────────────
 *
 * `query` để tiếng Anh và cố ý viết mộc — chỉ dấu nháy kép và OR, không dùng
 * cú pháp riêng của PubMed như `[tiab]` hay `[mh]`. Lý do: cùng một chuỗi này
 * được gửi cho cả PubMed lẫn OpenAlex, mà OpenAlex sẽ coi các tag của PubMed
 * là chữ thường và trả về rác. Phần lọc theo thiết kế nghiên cứu đã có bộ lọc
 * tháp bằng chứng lo, không cần nhét vào đây.
 */

import type { PillarId } from "./brand";

export type Beat = {
  id: string;
  /** Tên hiện trên giao diện. */
  name: string;
  /** Một dòng nói vì sao mảng này đáng theo dõi — hiện dưới tên. */
  why: string;
  /** Truy vấn tiếng Anh gửi cho các nguồn nghiên cứu. */
  query: string;
  /** Trụ cột nội dung mà mảng này thường sinh ra bài. */
  pillar: PillarId;
};

export const WATCHLIST: Beat[] = [
  {
    id: "tang-co",
    name: "Tăng cơ",
    why: "Khối lượng tập, tần suất, và cách sắp buổi tập để cơ thật sự lớn lên.",
    query:
      '"resistance training" AND (hypertrophy OR "muscle growth" OR "lean mass" OR "muscle thickness")',
    pillar: "bang-chung",
  },
  {
    id: "giam-mo",
    name: "Giảm mỡ",
    why: "Cách giảm mỡ mà vẫn giữ được cơ — phần quyết định vóc dáng sau giảm cân.",
    query:
      '("fat loss" OR "body composition" OR "visceral fat") AND (exercise OR training OR "energy deficit")',
    pillar: "bang-chung",
  },
  {
    id: "suc-manh",
    name: "Tăng sức mạnh",
    why: "Sức mạnh là thứ giữ được độc lập khi có tuổi, không chỉ là thành tích phòng gym.",
    query:
      '("strength training" OR "resistance exercise") AND ("muscle strength" OR "one repetition maximum" OR "functional capacity")',
    pillar: "thuc-hanh",
  },
  {
    id: "dinh-duong-giam-can",
    name: "Dinh dưỡng giảm cân",
    why: "Chế độ ăn nào giữ được lâu, và điều gì làm người ta bỏ cuộc giữa chừng.",
    query:
      '("weight loss" OR "weight management") AND (diet OR "dietary intervention" OR "protein intake" OR adherence)',
    pillar: "mam-com",
  },
  {
    id: "suc-khoe",
    name: "Sức khoẻ & chuyển hoá",
    why: "Đường huyết, mỡ máu, huyết áp, giấc ngủ — thứ không nhìn thấy trên gương.",
    query:
      '(exercise OR "physical activity" OR nutrition) AND ("metabolic health" OR "insulin sensitivity" OR "blood pressure" OR "sleep quality")',
    pillar: "bang-chung",
  },
  {
    id: "thuc-pham-bo-sung",
    name: "Thực phẩm bổ sung",
    why: "Cái nào có bằng chứng thật, cái nào chỉ có quảng cáo — mảng thay đổi nhanh nhất.",
    query:
      '(creatine OR "whey protein" OR "vitamin D" OR omega-3 OR caffeine OR collagen) AND (supplementation OR supplement)',
    pillar: "go-hieu-lam",
  },
  {
    id: "phu-nu-noi-tiet",
    name: "Phụ nữ & nội tiết",
    why: "Chu kỳ, tiền mãn kinh, mãn kinh — nơi lời khuyên chung chung sai nhiều nhất.",
    query:
      '(menopause OR perimenopause OR "menstrual cycle" OR "hormonal contraception") AND (exercise OR training OR nutrition OR "body composition")',
    pillar: "go-hieu-lam",
  },
];

export function beatById(id: string): Beat | undefined {
  return WATCHLIST.find((beat) => beat.id === id);
}

/**
 * Thu hẹp truy vấn về đối tượng nữ.
 *
 * Không gắn cứng vào từng `query` mà để thành công tắc bật/tắt: phần lớn
 * nghiên cứu thể hình vẫn làm trên nam giới trẻ, nên bật lên thì kết quả sát
 * độc giả hơn nhiều, nhưng có tuần bật lên là chẳng còn bài nào. Người dùng
 * cần thấy được cả hai, và cần biết mình đang xem cái nào.
 */
export function withWomenFocus(query: string): string {
  return `(${query}) AND (women OR female OR premenopausal OR postmenopausal)`;
}
