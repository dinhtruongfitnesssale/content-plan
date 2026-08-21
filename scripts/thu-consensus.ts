/**
 * Gọi Consensus ĐÚNG MỘT LẦN và in ra cấu trúc thô, để đối chiếu với adapter.
 *
 *   npx tsx --env-file=.env.local scripts/thu-consensus.ts "creatine women"
 *
 * Mỗi lần chạy tốn $0.10. Đừng chạy trong vòng lặp.
 */
const query = process.argv.slice(2).join(" ") || "creatine supplementation women";

async function main() {
  const key = process.env.CONSENSUS_API_KEY;
  if (!key) {
    console.error("Thiếu CONSENSUS_API_KEY. Chạy với: npx tsx --env-file=.env.local ...");
    process.exit(1);
  }

  const params = new URLSearchParams({
    query,
    page_size: "3",
    include_semantic_score: "true",
  });

  console.log(`Gọi /v1/search — «${query}» (tốn $0.10)\n`);

  const res = await fetch(`https://api.consensus.app/v1/search?${params}`, {
    headers: { "x-api-key": key, "user-agent": "ban-viet/1.0" },
  });

  console.log(`HTTP ${res.status}\n`);
  const text = await res.text();

  if (!res.ok) {
    console.log(text.slice(0, 600));
    return;
  }

  const json = JSON.parse(text);
  console.log("Trường cấp cao nhất:", Object.keys(json).join(", "));
  console.log("Số kết quả:", json.results?.length ?? 0, "\n");

  const first = json.results?.[0];
  if (!first) return;

  console.log("Trường có trong QueryResult đầu tiên:");
  for (const [k, v] of Object.entries(first)) {
    const shown =
      v === null || v === undefined
        ? "null"
        : typeof v === "string"
          ? `"${v.slice(0, 70)}${v.length > 70 ? "…" : ""}"`
          : Array.isArray(v)
            ? `[${v.length} phần tử]`
            : String(v);
    console.log(`  ${k.padEnd(28)} ${shown}`);
  }

  // Những trường adapter dựa vào — thiếu cái nào là mapping hỏng.
  const NEEDED = ["title", "abstract", "doi", "url", "journal_name", "publish_year", "study_type"];
  const BONUS = ["takeaway", "sample_size", "population_type", "citation_count", "semantic_score"];

  console.log("\nAdapter cần:");
  for (const f of NEEDED) console.log(`  ${f in first ? "có  " : "THIẾU"} ${f}`);
  console.log("\nTrường đáng tiền:");
  for (const f of BONUS) {
    const value = (first as Record<string, unknown>)[f];
    console.log(`  ${f in first ? (value === null ? "null" : "có  ") : "THIẾU"} ${f}`);
  }
}

main().catch((error) => console.error("LỖI:", error.message));
