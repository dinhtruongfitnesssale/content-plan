/**
 * Chạy thật tầng bảng tin, không mock.
 *
 *   npx tsx scripts/thu-moi-nhat.ts
 *   npx tsx scripts/thu-moi-nhat.ts thuc-pham-bo-sung 30
 *
 * Ba thứ cần nhìn ở đầu ra:
 * 1. Cột ngày — nếu toàn "?" hoặc toàn năm trơn thì `publishedOn` không về,
 *    và thứ tự "mới nhất" đang chạy bằng năm chứ không bằng ngày.
 * 2. Thứ tự — ngày phải giảm dần. Không giảm dần là `sort: "recent"` chưa
 *    tới được provider.
 * 3. Bài cũ hơn cửa sổ ngày — nghĩa là bộ lọc `days` bị nguồn bỏ qua.
 */

import { searchPapers, TIER_LABEL, toTier } from "../lib/research";
import { WATCHLIST, beatById, withWomenFocus } from "../lib/watchlist";

const [beatArg, daysArg] = process.argv.slice(2);
const days = Number(daysArg) || 90;
const beats = beatArg ? [beatById(beatArg)].filter((b) => b !== undefined) : WATCHLIST;

const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

async function main() {
  if (beats.length === 0) {
    console.error(
      `Không có mảng nào tên "${beatArg}". Có: ${WATCHLIST.map((b) => b.id).join(", ")}`,
    );
    process.exit(1);
  }

  for (const beat of beats) {
    console.log(`\n━━━ ${beat.name} — ${days} ngày gần đây ━━━`);

    const started = Date.now();
    const { papers, sources } = await searchPapers(beat.query, {
      days,
      limit: 8,
      sort: "recent",
    });

    console.log(
      `${sources.map((s) => `${s.label}: ${s.error ?? `${s.count} bài`}`).join("  ·  ")}  (${(
        (Date.now() - started) / 1000
      ).toFixed(1)}s)`,
    );

    if (papers.length === 0) {
      console.log("  (không có bài nào)");
      continue;
    }

    let previous = "9999-99-99";
    for (const paper of papers) {
      const date = paper.publishedOn ?? (paper.year ? `${paper.year}-??-??` : "?");
      const outOfOrder = paper.publishedOn && paper.publishedOn > previous ? " ⚠ sai thứ tự" : "";
      const tooOld = paper.publishedOn && paper.publishedOn < cutoff ? " ⚠ ngoài cửa sổ" : "";
      if (paper.publishedOn) previous = paper.publishedOn;

      console.log(
        `  ${date.padEnd(12)} ${TIER_LABEL[toTier(paper.studyTypes)].padEnd(28)} ${paper.title.slice(0, 64)}${outOfOrder}${tooOld}`,
      );
    }
  }

  // Kiểm công tắc "ưu tiên nữ" trên một mảng: nó phải thu hẹp kết quả chứ
  // không phải làm rỗng — rỗng nghĩa là câu AND đang chặn hết.
  const sample = beats[0];
  const narrowed = await searchPapers(withWomenFocus(sample.query), {
    days,
    limit: 8,
    sort: "recent",
  });
  console.log(`\n━━━ ${sample.name} + ưu tiên nữ ━━━\n  ${narrowed.papers.length} bài`);
}

void main();
