/**
 * Kiểm phần GHÉP BẰNG CODE của bài tổng hợp, chạy thật tầng nghiên cứu:
 *   npx tsx scripts/thu-tong-hop.ts "creatine women" 16
 *
 * Cố ý KHÔNG gọi model. Chỗ dễ hỏng ở tính năng này không nằm ở câu chữ model
 * viết ra mà nằm ở danh mục trích dẫn: đánh số có liên tục qua hai nhóm không,
 * bài nào bị xếp nhầm sang nhóm "đã dẫn", link có thật không. Muốn xem câu chữ
 * thì mở /tong-hop — ở đó `verifyFindings()` đã đứng sẵn trên đường đi.
 *
 * Vì không gọi model nên script tự dựng "phát hiện giả": mỗi phát hiện dẫn một
 * bài có abstract. Đủ để kiểm cách chia nhóm và cách đánh số.
 */
import { buildCitations, pickRelated, splitCited } from "../lib/compose";
import type { Finding } from "../lib/findings";
import { searchPapers, TIER_LABEL, toTier } from "../lib/research";

const args = process.argv.slice(2);
const last = args[args.length - 1];
const limit = Number.isFinite(Number(last)) && args.length > 1 ? Number(args.pop()) : 12;
const query = args.join(" ") || "creatine supplementation women";

async function main() {
  const { papers, sources } = await searchPapers(query, { limit, yearMin: 2015 });

  console.log(`\nTruy vấn: ${query} · lấy tối đa ${limit} bài\n`);
  for (const source of sources) {
    console.log(
      `  ${source.label.padEnd(10)} ${source.error ? `LỖI: ${source.error}` : `${source.count} bài`}`,
    );
  }
  console.log(`\nSau khi gộp: ${papers.length} bài\n`);

  // Giả lập tầng đọc: nửa số bài có abstract được coi là đã dẫn trong thân bài.
  const readable = papers.filter((paper) => paper.abstract !== null);
  const pretend = readable.slice(0, Math.max(2, Math.ceil(readable.length / 2)));
  const findings: Finding[] = pretend.map((paper) => ({
    claim: `(giả lập) phát hiện từ ${paper.title.slice(0, 40)}…`,
    evidence: "(giả lập)",
    strength: "trung bình",
    caveat: null,
    angle: "(giả lập)",
    paperIds: [paper.id],
  }));

  const { cited, related } = splitCited(papers, findings);
  const kept = pickRelated(related, query);
  const keptIds = new Set(kept.map((paper) => paper.id));

  console.log(
    `Dẫn trong bài: ${cited.length} · đọc thêm: ${kept.length} ` +
      `(bỏ ${related.length - kept.length} bài lạc đề)\n`,
  );
  for (const paper of cited) {
    console.log(`  [dẫn]      ${TIER_LABEL[toTier(paper.studyTypes)].padEnd(28)} ${paper.title.slice(0, 60)}`);
  }
  for (const paper of kept) {
    console.log(`  [đọc thêm] ${TIER_LABEL[toTier(paper.studyTypes)].padEnd(28)} ${paper.title.slice(0, 60)}`);
  }
  // In cả bài bị loại: cửa chắn quá tay cũng là hỏng, phải nhìn thấy mới biết.
  for (const paper of related.filter((paper) => !keptIds.has(paper.id))) {
    console.log(`  [BỎ]       ${TIER_LABEL[toTier(paper.studyTypes)].padEnd(28)} ${paper.title.slice(0, 60)}`);
  }

  const block = buildCitations(cited, kept);
  console.log(`\n─── danh mục trích dẫn như sẽ dán lên Facebook ───${block}\n`);

  // Kiểm bằng máy chứ không bằng mắt: số thứ tự phải chạy liền 1..n.
  const numbers = [...block.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
  const expected = Array.from({ length: cited.length + kept.length }, (_, i) => i + 1);
  const ok = numbers.length === expected.length && numbers.every((n, i) => n === expected[i]);
  console.log(ok ? "✓ Đánh số liên tục, không trùng không nhảy." : `✗ Số thứ tự sai: ${numbers.join(", ")}`);

  // Cùng một nghiên cứu kể hai lần trong danh mục trông như đếm bằng chứng gian.
  const titles = [...cited, ...kept].map((paper) => paper.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  const twice = titles.filter((title, i) => titles.indexOf(title) !== i);
  console.log(
    twice.length === 0
      ? "✓ Không nghiên cứu nào lặp lại trong danh mục."
      : `✗ Lặp: ${[...new Set(twice)].join(" | ")}`,
  );

  // Con số model được phép nêu trong thân bài phải khớp con số ở đầu danh mục.
  const header = block.match(/Nguồn dẫn trong bài \((\d+) nghiên cứu\)/);
  const match = header !== null && Number(header[1]) === cited.length;
  console.log(match ? "✓ Số nghiên cứu ở danh mục khớp số truyền cho prompt." : "✗ Lệch số nghiên cứu.");
}

main();
