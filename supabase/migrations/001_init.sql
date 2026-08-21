-- Bàn viết — lược đồ ban đầu.
-- Chạy trong Supabase SQL Editor, hoặc: supabase db push
--
-- App một người dùng: mọi truy cập đi qua route handler bằng service-role key.
-- Vì vậy các bảng bật RLS mà KHÔNG có policy nào — nghĩa là chặn sạch mọi
-- truy cập từ anon/authenticated key. Service-role key bỏ qua RLS nên server
-- vẫn đọc ghi được. Đây là cách khoá chặt nhất cho app cá nhân.

create extension if not exists "pgcrypto";

-- ─── Bài đã soạn ────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Ngày ĐĂNG, không phải ngày soạn. Bộ gợi ý chủ đề tính nhịp theo cột này.
  posted_on     date        not null,

  topic         text        not null,
  pillar        text        not null,
  voice_id      text        not null,
  target_words  integer     not null default 0,
  actual_words  integer     not null default 0,
  body          text        not null,

  -- Nghiên cứu đã dẫn và các phát hiện đã chọn, lưu nguyên để sau còn tra lại.
  papers        jsonb       not null default '[]'::jsonb,
  findings      jsonb       not null default '[]'::jsonb
);

create index if not exists posts_posted_on_idx on public.posts (posted_on desc);
create index if not exists posts_pillar_idx    on public.posts (pillar);

-- ─── Nghiên cứu đã lưu để dùng lại ──────────────────────────────────────────
create table if not exists public.saved_papers (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Khoá tự nhiên của một bài nghiên cứu. DOI ưu tiên, PMID dự phòng.
  doi           text,
  pmid          text,

  title         text        not null,
  abstract      text,
  year          integer,
  journal       text,
  url           text        not null,
  study_types   text[]      not null default '{}',
  cited_by      integer,

  -- Ghi chú của chị về bài này — vì sao đáng nhớ, dùng cho chủ đề nào.
  note          text,
  topic_tag     text
);

-- Không lưu trùng một nghiên cứu hai lần. DOI và PMID có thể null nên dùng
-- unique index riêng cho từng cột thay vì unique constraint gộp.
create unique index if not exists saved_papers_doi_idx
  on public.saved_papers (doi) where doi is not null;
create unique index if not exists saved_papers_pmid_idx
  on public.saved_papers (pmid) where pmid is not null;

-- ─── Lịch sử gợi ý chủ đề ───────────────────────────────────────────────────
-- Ghi cả gợi ý bị bỏ qua, để lượt sau không gợi lại thứ chị đã từ chối.
create table if not exists public.topic_suggestions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  suggested_on  date        not null default current_date,

  pillar        text        not null,
  title         text        not null,
  angle         text,
  hook          text,
  search_query  text,

  status        text        not null default 'goi-y'
                check (status in ('goi-y', 'nhan', 'bo-qua')),

  -- Trỏ tới bài đã viết ra từ gợi ý này, nếu có.
  post_id       uuid references public.posts (id) on delete set null
);

create index if not exists topic_suggestions_date_idx
  on public.topic_suggestions (suggested_on desc);

-- ─── Cấu hình thương hiệu ───────────────────────────────────────────────────
-- Một dòng duy nhất. Mặc định lấy từ lib/brand.ts; bảng này để sau chỉnh được
-- từ giao diện mà không phải sửa code và deploy lại.
create table if not exists public.settings (
  id            boolean primary key default true check (id),
  updated_at    timestamptz not null default now(),

  expertise     text,
  audience      text,
  stand         text,
  not_for       text,

  -- Ghi đè tỉ lệ trụ cột: {"bang-chung": 0.25, ...}
  pillar_shares jsonb not null default '{}'::jsonb,
  posts_per_week integer not null default 4
);

-- ─── Khoá ───────────────────────────────────────────────────────────────────
-- Bật RLS, không tạo policy nào → anon/authenticated key không đọc ghi được gì.
-- Chỉ service-role key (dùng trong route handler phía server) đi qua được.
alter table public.posts             enable row level security;
alter table public.saved_papers      enable row level security;
alter table public.topic_suggestions enable row level security;
alter table public.settings          enable row level security;
