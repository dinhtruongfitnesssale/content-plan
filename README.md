# Bàn viết

App tổng hợp nghiên cứu và soạn bài đăng Facebook cho thương hiệu cá nhân.

Luồng: **gợi ý chủ đề → tra bằng chứng → chọn dẫn chứng → soạn bài theo giọng văn và độ dài → lưu thư viện**.

---

## Chạy ở máy nhà

```bash
npm install
cp .env.example .env.local     # rồi mở ra điền ANTHROPIC_API_KEY
npm run dev
```

Mở http://localhost:3000

Ở máy nhà, để trống `APP_PASSWORD` thì app chạy luôn không cần đăng nhập.

### Cần tối thiểu những gì

| Biến | Bắt buộc | Không có thì sao |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Tra cứu và soạn bài đều không chạy |
| `APP_PASSWORD` | Chỉ khi deploy | Ở máy nhà: bỏ qua đăng nhập. Khi deploy: app tự chặn sạch |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Bài lưu trong trình duyệt thay vì trên Supabase |
| `NCBI_API_KEY` | ❌ | PubMed giới hạn 3 request/giây thay vì 10 |
| `CONSENSUS_API_KEY` | ❌ | Dùng PubMed + OpenAlex miễn phí |

---

## Deploy lên Vercel

```bash
npx vercel
```

Rồi vào **Vercel → Project → Settings → Environment Variables**, thêm ít nhất:

- `ANTHROPIC_API_KEY`
- `APP_PASSWORD` — mật khẩu tự đặt, để vào app

**Quên `APP_PASSWORD` thì app trả 503 cho mọi đường dẫn.** Đây là cố ý: URL Vercel công khai, app chạy mà không khoá nghĩa là ai biết link cũng bấm sinh bài bằng API key của chị. Thà app không chạy còn hơn.

### Bật Supabase (tuỳ chọn)

Chưa cấu hình thì bài lưu trong trình duyệt — mất khi đổi máy hoặc xoá cache.

1. Tạo project ở [supabase.com](https://supabase.com)
2. **SQL Editor** → dán toàn bộ `supabase/migrations/001_init.sql` → Run
3. **Settings → API** → copy `Project URL` và `service_role` key
4. Thêm `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` vào biến môi trường Vercel

App tự dò lúc chạy, không phải sửa code. Trang Thư viện sẽ thôi hiện dòng nhắc.

> `service_role` key bỏ qua mọi Row Level Security. Chỉ để trong biến môi trường server, không bao giờ đưa ra client. Các bảng đều bật RLS mà không có policy nào — nghĩa là khoá sạch với mọi key khác.

---

## Chi phí

| Việc | Model | Ước tính |
|---|---|---|
| Một lượt tra + tổng hợp nghiên cứu | Sonnet 5 | ~$0.04 |
| Sinh một bài | Opus 5 | ~$0.06 |
| Gợi ý chủ đề | Sonnet 5 | ~$0.01 |
| **Một bài hoàn chỉnh** | | **~$0.10** |

Mỗi ngày một bài ≈ **$3/tháng**. PubMed, OpenAlex, Vercel và Supabase đều đủ dùng ở mức miễn phí.

Bật Consensus thì mỗi lượt tra cộng thêm $0.10 — chi phí một bài tăng gấp đôi.

---

## Chỉnh cho hợp với chị

`lib/brand.ts` là file đáng sửa đầu tiên:

- `BRAND_CORE` — chuyên môn, độc giả, chỗ đứng, và **`notFor`** (thương hiệu KHÔNG dành cho ai). Trường cuối quyết định gợi ý chủ đề sắc hay nhạt hơn mọi thứ khác.
- `PILLARS` — trụ cột nội dung và tỉ lệ giữa chúng. Tổng phải bằng 1.
- `CADENCE` — nhịp đăng.
- `NEVER` — những thứ không bao giờ được gợi ý.

`lib/voices.ts` để thêm hoặc sửa giọng văn.

---

## Kiểm thử

```bash
npx tsx scripts/thu-nghien-cuu.ts "creatine women"   # chạy thật, gọi PubMed + OpenAlex
npx tsx scripts/thu-dem-tu.ts                        # bộ đếm từ tiếng Việt
npm run build                                        # bắt lỗi prerender / ranh giới client-server
```
