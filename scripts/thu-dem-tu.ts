import { countWords, wordRange, isWithinRange } from "../lib/words";

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
console.log("\nrange(150) =", JSON.stringify(wordRange(150)));
console.log("isWithinRange(140,150) =", isWithinRange(140, 150));
console.log("isWithinRange(200,150) =", isWithinRange(200, 150));
process.exit(fail > 0 ? 1 : 0);
