import { countWords, wordRange, isWithinRange, MAX_WORDS } from "../lib/words";

const cases: [string, number][] = [
  ["Bánh mì kẹp thịt", 4],
  ["Ăn cơm không làm bạn tăng cân.", 7],
  ["Chào chị 👋 hôm nay ăn gì?", 6],
  ["", 0],
  ["   \n\n  ", 0],
  ["Protein 1,6 g/kg mỗi ngày", 5],
];

let fail = 0;
for (const [text, expected] of cases) {
  const got = countWords(text);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${got}/${expected}  «${text.replace(/\n/g, "\n")}»`);
}
// Biên: ±10% tới 600 từ, ±15% từ 601 trở lên. Chỗ dễ hỏng nhất là cái mốc
// chuyển — sửa `toleranceFor()` mà lệch một đơn vị thì không ai thấy.
const ranges: [number, number, number][] = [
  [150, 135, 165],
  [600, 540, 660],
  [601, 511, 691],
  [1200, 1020, 1380],
  [MAX_WORDS, 1700, 2300],
];

console.log("");
for (const [target, min, max] of ranges) {
  const got = wordRange(target);
  const ok = got.min === min && got.max === max;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"}  range(${target}) = ${got.min}–${got.max}${ok ? "" : `, cần ${min}–${max}`}`);
}

// 1.750 từ trên mục tiêu 2.000: biên ±10% cũ sẽ bắt viết lại CẢ bài, ±15% thì không.
const checks: [number, number, boolean][] = [
  [140, 150, true],
  [200, 150, false],
  [1750, 2000, true],
  [1500, 2000, false],
];

console.log("");
for (const [count, target, expected] of checks) {
  const got = isWithinRange(count, target);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"}  isWithinRange(${count},${target}) = ${got}`);
}

process.exit(fail > 0 ? 1 : 0);
