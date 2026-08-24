# Bàn viết — app tổng hợp nghiên cứu & soạn bài Facebook

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Anthropic SDK.
Toàn bộ giao diện và nội dung bằng **tiếng Việt** — kể cả nhãn, thông báo lỗi, comment trong code.

## Hệ thiết kế — quy tắc 90/5/5

Đây là ràng buộc thương hiệu, không phải gợi ý. Vi phạm là hỏng brand.

- **90%** mỗi màn hình là `paper` + `ink` — nền be, chữ đen ấm.
- **5%** là `amber`, và **chỉ** ở 5 chỗ: đường kẻ mảnh, eyebrow label, link, dấu nháy `« »`, highlight cuối câu. **Không bao giờ fill khối bằng amber** — brand sẽ thành "cheap".
- **5%** còn lại cho `herb` / `slate` / `clay`, chỉ khi có vai trò ngữ nghĩa rõ ràng.

Thấy màn hình có 4+ màu sáng là sai. Quay lại 90/5/5.

| Token | Mã | Vai trò |
|---|---|---|
| `paper` | `#F6F2EA` | Nền của mọi thứ. **Không bao giờ dùng `#FFFFFF`** — mất chất ấm. |
| `ink` | `#14110E` | Chữ chính, đường kẻ editorial. Đen ấm, không phải `#000`. |
| `amber` | `#B5651E` | 5 chỗ kể trên. Dùng tiết kiệm. |
| `herb` | `#5C6E48` | "Tốt / đạt / tươi" — rau thơm Việt. Success, delta dương. Không phải xanh đèn tín hiệu. |
| `slate` | `#3A5567` | Ghi chú của coach, dữ liệu trung tính — khi không muốn cue tích cực hay tiêu cực. |
| `clay` | `#A33A2A` | Chỉ khi **thật sự sai**. Terracotta, không phải "fire truck red". |

Định nghĩa trong `app/globals.css` qua `@theme` → dùng như `bg-paper`, `text-ink`, `border-ink/12`.

### Chữ

| Font | Biến | Dùng cho |
|---|---|---|
| Source Serif 4 | `font-serif` | Headline, tiêu đề, pull quote, câu "claim" của phát hiện |
| Be Vietnam Pro | `font-sans` | Mọi UI và body text (thiết kế riêng cho tiếng Việt) |
| JetBrains Mono | `font-mono` | Số liệu, eyebrow, metadata — luôn kèm `tabular-nums` |

Số liệu (năm, lượt trích dẫn, số từ) bọc trong `<Num>` để cột không nhảy.
Nút chính là **nền ink, chữ paper** — không phải nền amber.

## Kiến trúc

- `lib/research/` — tầng nguồn nghiên cứu. Mỗi provider trả về `Paper` chuẩn hoá.
  `index.ts` gọi song song bằng `allSettled`, gộp trùng theo DOI → PMID → tiêu đề,
  xếp hạng theo **bậc bằng chứng trước, năm sau**.
  Bậc bằng chứng theo tháp EBM 8 mức, thứ tự mảng `EVIDENCE_TIERS` chính là thứ hạng.
  Hai hàm, đừng dùng lẫn: `toTier()` trả **một** bậc đại diện (bậc cao nhất) — dùng để
  hiển thị và xếp hạng; `toTiers()` trả **mọi** bậc bài khớp — dùng để lọc. Lọc bằng
  `toTier()` thì chọn "Systematic Review" ra rỗng, vì hầu hết tổng quan hệ thống đồng
  thời mang nhãn phân tích gộp và bị quy lên bậc trên.
- `lib/findings.ts` — `Finding` + `verifyFindings()`, rào chắn chống bịa số liệu.
- `lib/prompts.ts` — mọi prompt gửi model.
- `app/api/*/route.ts` — route handler. Key API chỉ tồn tại ở đây, không bao giờ ở client.

### Nguồn nghiên cứu

- **PubMed** là nguồn abstract chính. `<PublicationType>` do người lập chỉ mục gán tay
  cho phép xếp bậc bằng chứng mà không phải đoán. Nhưng PubMed **không có**
  PublicationType cho cohort / case-control / cross-sectional — ba thiết kế này chỉ
  tồn tại dưới dạng MeSH, nên `TIER_PT` trộn cả `[pt]` lẫn `[mh]`, và `readDesignMesh()`
  phải đọc thêm `<MeshHeadingList>`. Thiếu vế sau thì lọc ra đúng bài nhưng dán nhãn
  "Other" — lệch giữa truy vấn và nhãn là kiểu hỏng khó thấy nhất ở tầng này.
- **OpenAlex** bù lượt trích dẫn + link đọc miễn phí + độ phủ ngoài y sinh.
  `abstract_inverted_index` hay null — đừng dựa vào nó để lấy abstract.
- **Consensus** chỉ chạy khi có `CONSENSUS_API_KEY`. $0.10/lượt gọi, mặc định tắt.
  Dùng `/v1/search` — `/v1/quick_search` đã deprecated, gỡ ngày 2027-02-07.
  Response **không có trường id**: khoá dựng từ DOI, không có DOI thì từ URL.
  Tên trường là `journal_name`, `publish_year`, `study_type` (chuỗi đơn, không phải mảng).
  Đây là nguồn duy nhất điền `takeaway` và `sampleSize`.
- **Europe PMC** đã bị loại: trả HTTP 200 với body rỗng cho mọi truy vấn.

Mọi nguồn đều bị coi là có thể chết bất kỳ lúc nào — không bao giờ dùng `Promise.all`.

**Đã kiểm bằng dữ liệu thật (19/08/2026):**
- Consensus dùng **dấu cách** ở CẢ HAI chiều: `study_type` trong response
  (`"literature review"`) lẫn tham số `study_types` khi gửi đi. Vẫn phải chuẩn hoá
  trước khi tra bảng nhãn, nếu không mọi loại đều rơi xuống bậc "khác".
  (Sửa 21/08/2026: trước đây ghi là request dùng gạch nối — sai. Gửi
  `"systematic-review"` thì cả lượt gọi trả **422** và Consensus rụng khỏi kết
  quả, chỉ lộ ra khi bật bộ lọc bậc bằng chứng. Thân lỗi 422 liệt kê đủ nhãn hợp lệ.)
- `sample_size` và `population_type` **có thể vắng hẳn** khỏi response (đã thấy
  với bài tổng quan tường thuật). Đừng coi là chắc có.
- `url` của Consensus trỏ về `consensus.app/papers/…`. Ưu tiên `https://doi.org/{doi}`
  vì link này đi vào phần Nguồn cuối bài đăng mà độc giả Facebook sẽ bấm.
- NCBI khi vượt hạn mức **chuyển hướng 302 sang trang abuse và trả HTTP 200 kèm HTML**.
  `pubmed.ts` phải kiểm tra thân phản hồi, không chỉ `res.ok` — đúng kiểu hỏng im
  lặng đã khiến Europe PMC bị loại.

### Bảng tin "Mới nhất" — `/moi-nhat`

Trả lời câu hỏi ngược với trang Nghiên cứu: không phải "tìm bằng chứng cho chủ đề
này" mà "mấy tuần nay có gì mới đáng đọc". `lib/watchlist.ts` khai sẵn các mảng
theo dõi thường trực; thêm một mục vào `WATCHLIST` là bảng tin có thêm một mảng.

**Cố ý không gọi model.** Mỗi lượt quét đi qua bảy mảng — cho model đọc hết thì
vừa lâu vừa tốn, mà rào chắn chống bịa số liệu lại phải dựng thêm một lần nữa.
Muốn có phát hiện tiếng Việt thì bấm "Tra cứu sâu", đường đó đi qua
`/api/research` nơi `verifyFindings()` đã đứng sẵn. Vì vậy tiêu đề bài trong
bảng tin để nguyên tiếng Anh — dịch bằng code thì sai nghĩa chuyên môn.

`searchPapers` nhận thêm `days` (cửa sổ ngày) và `sort`. `sort: "recent"` chỉ đổi
cách `rank()` xếp — **không** đổi cách các nguồn xếp, và đây là chỗ dễ làm sai nhất:

- Đặt `sort=date` cho PubMed hay `sort=publication_date:desc` cho OpenAlex nghe
  có vẻ đúng nhưng hỏng nặng: nó vứt bỏ hoàn toàn thứ hạng liên quan, nên với
  truy vấn rộng ta nhận về N bài MỚI NHẤT trong hàng nghìn bài khớp lỏng lẻo.
  Đã thấy tận mắt: mảng thực phẩm bổ sung trả về di truyền học nấm men và dẫn
  xuất quinoline. Cách đúng là để cửa sổ ngày chặn phạm vi, nguồn chọn bài sát
  nhất trong đó, rồi `rank()` xếp lại theo ngày.
- `rank()` chặn lại cửa sổ ngày **một lần nữa** sau khi gộp nguồn. Không thừa:
  PubMed lọc theo ngày số tạp chí, nhưng ngày ta hiện ra là `<ArticleDate>` (ngày
  lên mạng) — bài điện tử ra trước bản in cả năm là chuyện thường, nên bài ghi
  07/2025 lọt vào bảng tin "90 ngày gần đây". Cái hiện ra phải khớp cái vừa hỏi.

`Paper.publishedOn` là ngày ISO `YYYY-MM-DD`, chỉ nhận khi đủ ngày-tháng-năm;
thiếu thì null chứ không độn `-01`, vì ngày bịa sẽ lẫn vào ngày thật khi xếp hạng.
Bài chỉ có năm được `dateKey()` quy về **cuối năm**, không phải đầu năm.

Bài rất mới hay mang nhãn "Other": PubMed gán PublicationType/MeSH sau khi bài ra
vài tuần. Đây là giới hạn thật của dữ liệu, giao diện nói thẳng ra chứ không giấu.
Bật bộ lọc bậc là chỉ còn bài đã được gán nhãn — đo thật ngày 24/08/2026: cửa sổ
90 ngày, bảy mảng, không lọc ra 84 bài (60 "Other"), lọc RCT ra 33 bài (0 "Other").

### Tầng LLM — `lib/llm/`

Mọi lượt gọi model đi qua `llm(role)`. Route handler **không bao giờ** import SDK
trực tiếp — đó là điều làm việc đổi nhà cung cấp thành sửa một biến môi trường
thay vì sửa ba file.

Hai vai, hai đòi hỏi:

| Vai | Mặc định | Việc | Dữ liệu đi qua |
|---|---|---|---|
| `writer` | `claude-opus-5` | Viết bài | Giọng văn, chỗ đứng thương hiệu, bản nháp chưa đăng |
| `reader` | `claude-sonnet-5` | Đọc abstract → `Finding`, gợi ý chủ đề | Abstract nghiên cứu **công khai** |

Chọn nhà cung cấp: `LLM_PROVIDER`, hoặc `LLM_PROVIDER_READER` / `LLM_PROVIDER_WRITER`
để tách vai. Cột "dữ liệu đi qua" là lý do việc tách vai có ý nghĩa — free tier
Gemini dùng dữ liệu để huấn luyện, mà abstract công khai thì không có gì để mất.

Anthropic: `thinking: { type: "adaptive" }` (không dùng `budget_tokens` — đã bị gỡ),
độ sâu chỉnh bằng `output_config.effort`, streaming cho mọi lượt sinh dài.

**`lib/llm/gemini.ts` chưa từng chạy thật** — viết theo tài liệu Interactions API,
không có key để kiểm chứng. Hình dạng `step.delta` khi streaming là chỗ đáng ngờ
nhất; `readDelta()` dò vài đường dẫn thay vì cắm cứng một cái. Chạy
`scripts/thu-llm.ts` trước khi tin. Gemini cũng không bảo đảm khớp schema chặt
như Anthropic nên adapter tự `safeParse` lại thay vì tin lời.

### Bộ luật thương hiệu

`lib/brand.ts` là nơi chỉnh trụ cột nội dung, nhịp đăng, và chỗ đứng thương hiệu.
Khung lấy từ mô hình communications wheel + ba chữ C (Clarity / Consistency / Constancy):
một lõi chuyên môn ở giữa, các trụ cột xoay quanh, đăng đều để không bị quên.
Trường `notFor` (brand KHÔNG dành cho ai) là thứ tạo khác biệt lớn nhất trong chất
lượng gợi ý — bỏ trống thì gợi ý nhạt.

`lib/voices.ts` mô tả KỸ THUẬT văn phong (nhịp câu, từ ngữ, hình ảnh, cách mở/kết),
không phải chỉ tên tác giả — để tên không thôi thì model cho ra kết quả na ná nhau.

### Độ dài bài

Ràng buộc hai lớp: prompt nêu số từ mục tiêu, rồi `countWords()` đếm lại sau khi sinh.
Lệch quá ±10% thì chỉnh đúng MỘT lượt refine, không lặp vô hạn.
Tiếng Việt đếm theo âm tiết tách bằng khoảng trắng — giao diện ghi rõ để không hiểu nhầm.

### Lưu trữ

`lib/store/` chọn nơi lưu bằng cách **dò lúc chạy**, không bằng biến build-time:
client gửi `HEAD /api/posts`, gặp 501 thì dùng localStorage cho suốt phiên.
Lý do: thêm `SUPABASE_URL` sau này không phải build lại. Đừng đổi sang
`NEXT_PUBLIC_*` — sẽ mất tính chất đó.

Route handler dùng service-role key nên bỏ qua RLS. Các bảng bật RLS mà
**không có policy nào** — khoá sạch với mọi key khác. Không bao giờ import
`lib/supabase.ts` từ component client.

### Cổng mật khẩu

Next 16 đổi tên quy ước `middleware` thành `proxy` — file là `proxy.ts` ở gốc dự án,
hàm export tên `proxy`. Chức năng không đổi. Đừng đổi ngược lại: `middleware.ts` vẫn
chạy nhưng in cảnh báo deprecate mỗi lần khởi động.

`proxy.ts` chạy trên **Edge runtime** — không có `node:crypto`. Vì vậy
`lib/auth.ts` dùng Web Crypto và tự viết hàm so sánh constant-time.

Hai nhánh cần giữ nguyên:
- Không có `APP_PASSWORD` + dev → cho qua (tiện ở máy nhà).
- Không có `APP_PASSWORD` + production → **503 mọi đường dẫn**. Fail-closed cố ý:
  app chạy không khoá trên URL công khai nghĩa là API key bị phơi ra.
- `/api/*` chưa đăng nhập trả **401**, không redirect — nếu redirect thì người ta
  bỏ qua giao diện và gọi thẳng API để đốt key.

## Ranh giới không thoả hiệp

**Không bao giờ để một con số chưa kiểm chứng lọt ra giao diện.** Bài đăng dẫn nghiên
cứu sai còn tệ hơn bài không dẫn gì. Prompt buộc trích nguyên văn từ abstract được cấp;
`verifyFindings()` loại mọi phát hiện tham chiếu id không có trong tập đã gửi; giao diện
báo rõ số phát hiện bị loại thay vì giấu.

Phần **Nguồn** cuối bài đăng được ghép bằng code từ dữ liệu `Paper` thật (`buildSources()`),
KHÔNG do model sinh — nên bài đăng không bao giờ dẫn tới một nghiên cứu không tồn tại.
Prompt cấm model viết tên tạp chí hay năm nghiên cứu vào thân bài vì lý do đó.

## Kiểm thử

```bash
npx tsx scripts/thu-nghien-cuu.ts "creatine women"   # chạy thật tầng nghiên cứu, không mock
npx tsx scripts/thu-moi-nhat.ts thuc-pham-bo-sung 30 # bảng tin: ngày, thứ tự, cửa sổ
npx tsx scripts/thu-dem-tu.ts                        # kiểm bộ đếm từ tiếng Việt
npm run build                                         # bắt lỗi Suspense / server-client boundary
```

Client component dùng `useSearchParams` **phải** được bọc trong `<Suspense>`, nếu không build sẽ fail khi prerender.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
