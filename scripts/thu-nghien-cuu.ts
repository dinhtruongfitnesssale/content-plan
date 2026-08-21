/**
 * Chạy thật tầng nghiên cứu, không mock. Dùng để kiểm tra nhanh:
 *   npx tsx scripts/thu-nghien-cuu.ts "creatine women"
 */
import { searchPapers, toTier, TIER_LABEL } from "../lib/research";

const query = process.argv.slice(2).join(" ") || "creatine supplementation women";

async function main() {
  const { papers, sources } = await searchPapers(query, { limit: 8, yearMin: 2010 });

  console.log(`\nTruy vấn: ${query}\n`);
  for (const source of sources) {
    console.log(`  ${source.label.padEnd(10)} ${source.error ? `LỖI: ${source.error}` : `${source.count} bài`}`);
  }
  console.log(`\nSau khi gộp & khử trùng lặp: ${papers.length} bài\n`);

  for (const paper of papers) {
    console.log(`— ${paper.title}`);
    console.log(
      `  ${TIER_LABEL[toTier(paper.studyTypes)]} · ${paper.year ?? "?"} · ` +
        `${paper.citedByCount ?? "?"} trích dẫn · ${paper.source}`,
    );
    console.log(`  loại: ${paper.studyTypes.join(", ") || "(không có nhãn)"}`);
    console.log(`  abstract: ${paper.abstract ? `${paper.abstract.length} ký tự` : "KHÔNG CÓ"}`);
    console.log(`  ${paper.url}\n`);
  }
}

main();
