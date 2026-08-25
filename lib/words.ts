/**
 * Đếm từ tiếng Việt.
 *
 * Tiếng Việt viết rời từng âm tiết, nên "từ" mà người viết cảm nhận và "từ"
 * mà máy đếm không trùng nhau: "bánh mì" là một từ nhưng hai âm tiết. Ở đây
 * đếm theo âm tiết (tách bằng khoảng trắng) vì đó là con số nhất quán và
 * kiểm chứng được. Giao diện ghi rõ "từ (âm tiết)" để không gây hiểu nhầm.
 */
export function countWords(text: string): number {
  const cleaned = text
    // Bỏ emoji và ký hiệu đứng một mình để chúng không bị tính là từ.
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) return 0;
  return cleaned.split(" ").filter((token) => /\p{L}|\p{N}/u.test(token)).length;
}

/** Biên độ chấp nhận được quanh số từ mục tiêu. */
export const TOLERANCE = 0.1;

/**
 * Bài dài được nới biên.
 *
 * Lệch biên nghĩa là gọi model thêm MỘT lượt nữa để viết lại CẢ bài — ở bài
 * 300 từ lượt đó rẻ, ở bài 2.000 từ nó tốn đúng bằng lượt viết đầu tiên. Mà
 * càng viết dài model càng bám số từ kém, nên giữ ±10% ở đây là tự chuốc lấy
 * một lượt viết lại gần như mỗi lần, chỉ để dịch bài từ 1.750 về 1.800 từ.
 * Bài ngắn giữ nguyên ±10%: mốc "Ngắn" 80 từ hứa hiện trọn không cần bấm
 * "Xem thêm", nới biên ở đó là phá lời hứa đó.
 */
export const LONG_FORM_WORDS = 600;
export const LONG_FORM_TOLERANCE = 0.15;

export function toleranceFor(target: number): number {
  return target > LONG_FORM_WORDS ? LONG_FORM_TOLERANCE : TOLERANCE;
}

export function wordRange(target: number): { min: number; max: number } {
  const tolerance = toleranceFor(target);
  return {
    min: Math.round(target * (1 - tolerance)),
    max: Math.round(target * (1 + tolerance)),
  };
}

export function isWithinRange(count: number, target: number): boolean {
  const { min, max } = wordRange(target);
  return count >= min && count <= max;
}

/**
 * Mốc độ dài theo thực tế bài đăng Facebook.
 * Facebook cắt bài ở khoảng 400–500 ký tự với nút "Xem thêm", nên bài dưới
 * ~80 từ hiện trọn vẹn không cần bấm — đó là lý do mốc đầu tiên nằm ở đó.
 */
export const LENGTH_PRESETS = [
  { words: 80, label: "Ngắn", note: "Một ý duy nhất. Hiện trọn không cần bấm 'Xem thêm'." },
  { words: 150, label: "Chuẩn", note: "Độ dài quen thuộc của bài feed." },
  { words: 300, label: "Kể chuyện", note: "Đủ chỗ cho một câu chuyện có mở và kết." },
  { words: 600, label: "Chuyên sâu", note: "Bài dài, nhiều dẫn chứng. Đăng thưa thôi." },
  { words: 1200, label: "Bài dài", note: "Gần một bài blog. Viết mất vài phút, đọc hết cũng vậy." },
] as const;

export const MIN_WORDS = 60;
export const MAX_WORDS = 2000;
