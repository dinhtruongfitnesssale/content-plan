/**
 * Preset giọng văn.
 *
 * Chỉ để tên tác giả rồi nhờ model tự đoán cho ra kết quả trôi nổi và na ná
 * nhau — model dựa vào ấn tượng chung về tác giả thay vì vào kỹ thuật cụ thể.
 * Nên mỗi preset ở đây mô tả KỸ THUẬT văn phong: độ dài câu, nhịp, cách dùng
 * hình ảnh, cách vào bài và kết bài, và điều cần tránh.
 *
 * Mô phỏng kỹ thuật viết, không sao chép văn bản của tác giả nào.
 *
 * Trộn cả tác giả quốc tế và Việt Nam vì bài viết bằng tiếng Việt — một vài
 * kỹ thuật (nhịp câu, cách dùng từ láy) chỉ có nguồn tham chiếu Việt.
 */
export type Voice = {
  id: string;
  name: string;
  /** Một dòng hiện trên giao diện để chị chọn. */
  blurb: string;
  sentenceRhythm: string;
  diction: string;
  imagery: string;
  opening: string;
  closing: string;
  avoid: string;
};

export const VOICES: Voice[] = [
  {
    id: "hemingway",
    name: "Hemingway",
    blurb: "Câu ngắn, danh từ cụ thể, không tô vẽ. Sự thật đặt trần.",
    sentenceRhythm:
      "Câu ngắn, phần lớn dưới 12 từ. Chủ ngữ – động từ – tân ngữ. Nối bằng 'và' thay vì mệnh đề phụ. Thỉnh thoảng một câu dài để đổi nhịp, rồi lại ngắn.",
    diction:
      "Từ thông dụng, cụ thể, gốc thuần Việt hơn là Hán Việt. Gần như không dùng tính từ. Không dùng trạng từ chỉ mức độ ('rất', 'vô cùng', 'cực kỳ').",
    imagery:
      "Chỉ tả cái nhìn thấy, nghe thấy, cầm được. Cảm xúc suy ra từ hành động và vật thể, không gọi tên trực tiếp.",
    opening: "Vào thẳng bằng một sự việc hoặc một vật cụ thể. Không dạo đầu.",
    closing: "Dừng đột ngột ở một hình ảnh. Không tổng kết, không rút ra bài học.",
    avoid: "Mọi câu giải thích cảm xúc. Mọi tính từ trang trí.",
  },
  {
    id: "nguyen-ngoc-tu",
    name: "Nguyễn Ngọc Tư",
    blurb: "Giọng miền Tây, thương mà không sến. Buồn nhẹ dưới lớp bình thản.",
    sentenceRhythm:
      "Câu dài vừa, nhịp chậm, hay ngắt bằng dấu phẩy nhiều hơn dấu chấm. Đôi khi một câu cụt ngủn đặt sau câu dài để nhói lên.",
    diction:
      "Từ đời thường, có màu Nam Bộ nhưng không lạm dụng phương ngữ. Dùng từ láy tiết chế. Tránh Hán Việt trang trọng.",
    imagery:
      "Hình ảnh từ sông nước, chợ, gian bếp, chiều muộn. Vật nhỏ mang cả tâm trạng — cái nón, nồi cơm nguội, con đường đất.",
    opening: "Mở bằng một cảnh hoặc một người, như đang kể tiếp câu chuyện dở dang.",
    closing: "Kết bằng một câu nhẹ, hơi lửng, để lại dư vị chứ không chốt.",
    avoid: "Kể lể thương cảm. Gọi tên nỗi buồn. Lên giọng dạy đời.",
  },
  {
    id: "nguyen-nhat-anh",
    name: "Nguyễn Nhật Ánh",
    blurb: "Ấm, gần gũi, hài nhẹ. Như người quen ngồi kể chuyện.",
    sentenceRhythm:
      "Câu vừa phải, trôi chảy, có nhịp trò chuyện. Hay dùng câu hỏi tự vấn rồi tự trả lời. Đoạn ngắn.",
    diction:
      "Giản dị, trong sáng, hơi hóm. Dùng đại từ thân mật. Không thuật ngữ.",
    imagery:
      "Chi tiết đời thường của tuổi thơ và gia đình — bữa cơm, sân nhà, con hẻm. Hình ảnh làm người đọc mỉm cười trước khi thấm.",
    opening: "Mở bằng một quan sát nhỏ đáng yêu hoặc một câu nhận xét hóm hỉnh.",
    closing: "Kết ấm, có chút nhắn nhủ nhưng nhẹ, không giáo huấn.",
    avoid: "Mỉa mai. Giọng người lớn dạy dỗ. Câu quá dài.",
  },
  {
    id: "thach-lam",
    name: "Thạch Lam",
    blurb: "Tĩnh, tinh tế. Tả cảm giác hơn là tả sự việc.",
    sentenceRhythm:
      "Câu dài vừa, êm, nhiều mệnh đề nối bằng dấu phẩy. Nhịp đều, không gấp.",
    diction:
      "Trong trẻo, chọn lọc, có chút cổ điển. Dùng từ chỉ cảm giác — mùi, ánh sáng, hơi lạnh, tiếng động xa.",
    imagery:
      "Ánh sáng và mùi là hai giác quan chủ đạo. Cảnh vật mang tâm trạng mà không nói ra.",
    opening: "Mở bằng một ấn tượng giác quan — mùi, ánh sáng, thời khắc trong ngày.",
    closing: "Kết lắng, mở, để lại một cảm giác chứ không một kết luận.",
    avoid: "Câu ngắn cộc. Từ hiện đại, thuật ngữ. Nhịp gấp gáp.",
  },
  {
    id: "murakami",
    name: "Murakami",
    blurb: "Đời thường tỉ mỉ, hơi lạ. Bình thản trước điều khác thường.",
    sentenceRhythm:
      "Câu vừa, đều, hơi phẳng. Ít cảm thán. Xen câu ngắn mang tính khẳng định lạ.",
    diction:
      "Chính xác, thản nhiên, gần như báo cáo. Nêu con số và chi tiết cụ thể — giờ giấc, số lượng, nhãn hiệu.",
    imagery:
      "Chi tiết vụn của đời sống được tả kỹ hơn mức cần thiết, tạo cảm giác hơi siêu thực.",
    opening: "Mở bằng một sự việc thường ngày, kể bằng giọng như không có gì đặc biệt.",
    closing: "Kết lửng, hơi mơ hồ, không giải thích.",
    avoid: "Kịch tính hoá. Giải nghĩa ẩn dụ. Kết luận rành mạch.",
  },
  {
    id: "didion",
    name: "Joan Didion",
    blurb: "Lạnh, chính xác, tự soi. Nhìn thẳng không chớp mắt.",
    sentenceRhythm:
      "Xen câu rất dài với câu rất ngắn. Câu dài chồng mệnh đề; câu ngắn chốt lại như đóng cửa. Lặp một cụm từ để tạo nhịp.",
    diction:
      "Chính xác đến khắt khe. Danh từ cụ thể, chi tiết xác thực — ngày tháng, địa danh, con số.",
    imagery:
      "Chi tiết được chọn để phơi bày, không để trang trí. Hình ảnh mang tính chứng cứ.",
    opening: "Mở bằng một khẳng định thẳng hoặc một chi tiết cụ thể đến lạnh người.",
    closing: "Kết bằng câu ngắn, dứt khoát, hơi bất an.",
    avoid: "Sự ấm áp giả. An ủi người đọc. Kết có hậu.",
  },
  {
    id: "chekhov",
    name: "Chekhov",
    blurb: "Quan sát, không phán xét. Để người đọc tự kết luận.",
    sentenceRhythm:
      "Câu vừa, tự nhiên, không cầu kỳ. Nhịp kể đều, không nhấn.",
    diction:
      "Giản dị, chính xác, trung tính. Không dùng từ gợi cảm xúc thay cho người đọc.",
    imagery:
      "Một hai chi tiết được chọn kỹ nói thay cả đoạn miêu tả. Con người hiện ra qua hành vi nhỏ.",
    opening: "Mở bằng một tình huống hoặc một con người, không bình luận.",
    closing: "Kết mở, không phán xét. Người đọc tự thấy điều cần thấy.",
    avoid: "Rút ra bài học. Phê phán nhân vật. Nhấn mạnh ý nghĩa.",
  },
  {
    id: "marquez",
    name: "García Márquez",
    blurb: "Kể như huyền thoại. Chuyện thường được kể bằng giọng trang trọng.",
    sentenceRhythm:
      "Câu dài, cuộn, nhiều mệnh đề nối tiếp. Nhịp như kể sử. Thỉnh thoảng một câu ngắn trang nghiêm.",
    diction:
      "Trang trọng nhưng ấm. Dùng số đếm và mốc thời gian như trong truyền thuyết ('nhiều năm sau', 'suốt ba mùa').",
    imagery:
      "Phóng đại nhẹ và cụ thể hoá cái trừu tượng. Chi tiết thường ngày được nâng lên thành sự kiện.",
    opening:
      "Mở bằng một câu bao trùm cả thời gian — gợi cả quá khứ lẫn tương lai trong một dòng.",
    closing: "Kết vòng lại hình ảnh mở đầu, ở tầm rộng hơn.",
    avoid: "Giọng đời thường. Câu cụt. Sự khiêm tốn quá mức.",
  },
  {
    id: "calvino",
    name: "Italo Calvino",
    blurb: "Nhẹ, sáng, cấu trúc lạ. Ý tưởng được sắp như kiến trúc.",
    sentenceRhythm:
      "Câu sạch, sáng, cân đối. Hay dùng cấu trúc liệt kê hoặc song hành.",
    diction: "Chính xác, nhẹ nhàng, hơi trò chơi. Không nặng nề.",
    imagery:
      "Hình ảnh mang tính hình học và khái niệm — đặt cạnh nhau để bật ra ý, không để tả.",
    opening: "Mở bằng một mệnh đề lạ hoặc một cách phân loại bất ngờ.",
    closing: "Kết bằng một đảo chiều nhỏ khiến người đọc nhìn lại từ đầu.",
    avoid: "Nặng nề, u ám, dài dòng cảm xúc.",
  },
  {
    id: "coach",
    name: "Giọng coach",
    blurb: "Giọng gốc của chị — ấm, rõ, thực tế. Không mượn của ai.",
    sentenceRhythm:
      "Câu vừa, dễ đọc trên điện thoại. Đoạn ngắn 2–3 câu. Nhịp trò chuyện.",
    diction:
      "Đời thường, ấm, cụ thể. Xưng hô gần gũi. Thuật ngữ nào cũng giải thích ngay bằng lời thường.",
    imagery: "Lấy từ mâm cơm, chợ, bếp, sinh hoạt gia đình Việt.",
    opening: "Mở bằng một tình huống độc giả nhận ra mình trong đó.",
    closing: "Kết bằng một việc nhỏ làm được ngay hôm nay.",
    avoid: "Hù doạ. Hứa hẹn thần kỳ. Giọng chuyên gia bề trên.",
  },
];

export const DEFAULT_VOICE_ID = "coach";

export function voiceById(id: string): Voice | undefined {
  return VOICES.find((voice) => voice.id === id);
}

/** Dựng khối mô tả giọng để chèn vào prompt. */
export function voiceBrief(voice: Voice): string {
  return `Giọng văn: ${voice.name}

- Nhịp câu: ${voice.sentenceRhythm}
- Từ ngữ: ${voice.diction}
- Hình ảnh: ${voice.imagery}
- Cách mở: ${voice.opening}
- Cách kết: ${voice.closing}
- Tránh: ${voice.avoid}

Đây là mô phỏng KỸ THUẬT viết, không phải bắt chước nội dung hay sao chép câu chữ của tác giả. Bài viết vẫn phải là bài của người huấn luyện viên, viết về chủ đề của chị.`;
}
