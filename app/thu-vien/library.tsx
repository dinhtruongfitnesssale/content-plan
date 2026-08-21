"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyNote, ErrorNote, Eyebrow, Num, PageHeader } from "@/components/ui";
import { PILLARS, pillarById } from "@/lib/brand";
import { getStore, type Post, type StoreMode } from "@/lib/store";
import { voiceById } from "@/lib/voices";

export function Library() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<StoreMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const store = await getStore();
        setMode(store.mode);
        setPosts(await store.list());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Không đọc được thư viện.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (pillar && post.pillar !== pillar) return false;
      if (!needle) return true;
      return (
        post.topic.toLowerCase().includes(needle) || post.body.toLowerCase().includes(needle)
      );
    });
  }, [posts, query, pillar]);

  async function remove(id: string) {
    try {
      await (await getStore()).remove(id);
      setPosts((current) => current.filter((post) => post.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xoá được.");
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Thư viện"
        title="Bài đã viết"
        lede="Mọi bài đã soạn, kèm nghiên cứu đã dẫn. Đây cũng là dữ liệu để gợi ý chủ đề tránh lặp."
      />

      {mode === "local" && (
        <EmptyNote>
          Đang lưu trong trình duyệt này. Thêm <code className="num">SUPABASE_URL</code> và{" "}
          <code className="num">SUPABASE_SERVICE_ROLE_KEY</code> vào biến môi trường thì app tự
          chuyển sang lưu trên Supabase — dùng được ở mọi máy, không mất khi xoá cache.
        </EmptyNote>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      {!loading && posts.length > 0 && (
        <div className="space-y-4">
          <div className="rule border-b pb-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm trong bài đã viết"
              className="w-full bg-transparent text-lg outline-none placeholder:text-ink/25"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Trụ cột</span>
            <Chip active={pillar === null} onClick={() => setPillar(null)}>
              Tất cả
            </Chip>
            {PILLARS.map((item) => {
              const count = posts.filter((post) => post.pillar === item.id).length;
              if (count === 0) return null;
              return (
                <Chip
                  key={item.id}
                  active={pillar === item.id}
                  onClick={() => setPillar(pillar === item.id ? null : item.id)}
                >
                  {item.name} <span className="num opacity-55">{count}</span>
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-ink/50">Đang mở thư viện…</p>}

      {!loading && posts.length === 0 && !error && (
        <EmptyNote>
          Chưa có bài nào. Sang{" "}
          <Link
            href="/nghien-cuu"
            className="text-amber underline decoration-amber/35 underline-offset-2"
          >
            Nghiên cứu
          </Link>{" "}
          để bắt đầu bài đầu tiên.
        </EmptyNote>
      )}

      {!loading && posts.length > 0 && (
        <ul className="space-y-4">
          {filtered.map((post) => (
            <li key={post.id}>
              <PostCard post={post} onRemove={() => remove(post.id)} />
            </li>
          ))}
          {filtered.length === 0 && (
            <li>
              <EmptyNote>Không có bài nào khớp.</EmptyNote>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function PostCard({ post, onRemove }: { post: Post; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const pillar = pillarById(post.pillar);
  const voice = voiceById(post.voiceId);

  async function copy() {
    await navigator.clipboard.writeText(post.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Eyebrow>{pillar?.name ?? post.pillar}</Eyebrow>
          <span className="num text-xs text-ink/45">{post.postedOn}</span>
        </div>

        <button type="button" onClick={() => setOpen(!open)} className="block w-full text-left">
          <h3 className="font-serif text-xl leading-snug">{post.topic}</h3>
        </button>

        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/45">
          <span>{voice?.name ?? post.voiceId}</span>
          <span>
            <Num>{post.actualWords}</Num> từ
          </span>
          {post.papers.length > 0 && (
            <span>
              <Num>{post.papers.length}</Num> nghiên cứu
            </span>
          )}
        </p>

        {!open && (
          <p className="line-clamp-2 text-sm leading-relaxed text-ink/65">{post.body}</p>
        )}

        {open && (
          <>
            <div className="rule border-t pt-4 text-[0.9375rem] leading-[1.75] whitespace-pre-wrap">
              {post.body}
            </div>

            {post.papers.length > 0 && (
              <div className="rule space-y-1.5 border-t pt-4">
                <Eyebrow>Nguồn</Eyebrow>
                <ul className="space-y-1">
                  {post.papers.map((paper) => (
                    <li key={paper.id} className="text-xs leading-relaxed">
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber underline decoration-amber/35 underline-offset-2"
                      >
                        {paper.title}
                      </a>
                      {paper.year && (
                        <span className="text-ink/40">
                          {" "}
                          <Num>{paper.year}</Num>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button variant="quiet" onClick={copy}>
                {copied ? "Đã chép" : "Chép bài"}
              </Button>

              {confirming ? (
                <>
                  <button
                    type="button"
                    onClick={onRemove}
                    className="border border-clay/50 px-3 py-1 text-xs text-clay transition-colors hover:border-clay"
                  >
                    Xoá thật
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="text-xs text-ink/50 hover:text-ink"
                  >
                    Thôi
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="text-xs text-ink/40 transition-colors hover:text-clay"
                >
                  Xoá
                </button>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-ink/45 hover:text-ink"
        >
          {open ? "Thu lại" : "Xem cả bài"}
        </button>
      </div>
    </Card>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-ink text-ink"
          : "border-ink/15 text-ink/55 hover:border-ink/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
