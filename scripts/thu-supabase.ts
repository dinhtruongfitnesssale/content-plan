/**
 * Kiểm tra thật kết nối Supabase: hình dạng biến môi trường, bảng đã tạo chưa,
 * và một vòng ghi → đọc → xoá.
 *   npx tsx --env-file=.env.local <file này>
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let hong = false;
const dat = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) hong = true;
};

console.log("\n── Hình dạng biến môi trường ──");
dat(Boolean(url), "SUPABASE_URL có giá trị");
dat(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url),
  `SUPABASE_URL là Project URL (đang thấy: ${url})`);
dat(Boolean(key), "SUPABASE_SERVICE_ROLE_KEY có giá trị");
const laSecret = key.startsWith("sb_secret_");
const laLegacy = key.startsWith("eyJ");
dat(laSecret || laLegacy,
  `khoá là secret hoặc legacy service_role (tiền tố: ${key.slice(0, 15)}…)`);
if (laLegacy) console.log("    ! khoá legacy — Supabase gỡ cuối 2026, nên đổi sang sb_secret_");
if (key.startsWith("sb_publishable_")) console.log("    ! đây là khoá publishable, sẽ bị RLS chặn");

if (hong) { console.log("\nDừng ở đây — sửa .env.local trước.\n"); process.exit(1); }


async function main() {
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

console.log("\n── Bảng ──");
for (const bang of ["posts", "saved_papers", "topic_suggestions", "settings"]) {
  const { count, error } = await sb.from(bang).select("id", { count: "exact" }).limit(1);
  dat(!error, error ? `${bang}: ${error.message}` : `${bang}: có, ${count} bản ghi`);
}

if (hong) { console.log("\nBảng chưa có? Chạy supabase/migrations/001_init.sql trong SQL Editor.\n"); process.exit(1); }

console.log("\n── Vòng ghi → đọc → xoá ──");
const { data: them, error: loiThem } = await sb.from("posts").insert({
  posted_on: new Date().toISOString().slice(0, 10),
  topic: "KIỂM TRA KẾT NỐI — xoá ngay",
  pillar: "test", voice_id: "test",
  target_words: 0, actual_words: 0, body: "bản ghi thử",
}).select("id").single();
dat(!loiThem, loiThem ? `ghi: ${loiThem.message}` : `ghi: ok (id ${them?.id.slice(0, 8)}…)`);

if (them) {
  const { data: doc, error: loiDoc } = await sb.from("posts").select("topic").eq("id", them.id).single();
  dat(!loiDoc && Boolean(doc?.topic.startsWith("KIỂM TRA")), loiDoc ? `đọc: ${loiDoc.message}` : "đọc: ok");
  const { error: loiXoa } = await sb.from("posts").delete().eq("id", them.id);
  dat(!loiXoa, loiXoa ? `xoá: ${loiXoa.message}` : "xoá: ok, không để lại rác");
}

console.log(hong ? "\nCÓ LỖI — xem ở trên.\n" : "\nXong. Supabase chạy được, app sẽ lưu bài lên đây.\n");
process.exit(hong ? 1 : 0);
}

main();
