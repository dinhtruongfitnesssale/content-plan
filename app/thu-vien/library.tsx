"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, EmptyNote, ErrorNote, Eyebrow, Num, PageHeader } from "@/components/ui";
import { useToast } from "@/components/toast";
import { PILLARS, pillarById } from "@/lib/brand";
import { getStore, type Post, type PostEdit, type StoreMode } from "@/lib/store";
import { voiceById } from "@/lib/voices";
import { countWords } from "@/lib/words";

export function Library() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<StoreMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState<string | null>(null);

  const { toast, toastNode } = useToast();

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
      // Không toast ở đây: thẻ biến mất SAU khi tầng lưu trả về, nên bản thân
      // việc nó biến mất đã là lời báo xoá xong.
      await (await getStore()).remove(id);
      setPosts((current) => current.filter((post) => post.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xoá được.");
    }
  }

  /**
   * Lưu bản sửa rồi thay đúng một thẻ trong danh sách bằng bản vừa lưu — không
   * đọc lại cả thư viện. Đọc lại sẽ xếp lại danh sách ngay dưới tay người vừa
   * sửa, mà `actualWords` do tầng lưu đếm nên vẫn phải lấy bản nó trả về.
   */
  async function save(id: string, edit: PostEdit): Promise<void> {
    const updated = await (await getStore()).update(id, edit);
    setPosts((current) => current.map((post) => (post.id === id ? updated : post)));
    toast("Đã lưu bài viết.");
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Thư viện"
        title="Bài đã viết"
        lede="Mọi bài đã soạn, kèm nghiên cứu đã dẫn. Sửa lại câu chữ được ngay tại đây. Đây cũng là dữ liệu để gợi ý chủ đề tránh lặp."
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
              <PostCard
                post={post}
                onRemove={() => remove(post.id)}
                onSave={(edit) => save(post.id, edit)}
              />
            </li>
          ))}
          {filtered.length === 0 && (
            <li>
              <EmptyNote>Không có bài nào khớp.</EmptyNote>
            </li>
          )}
        </ul>
      )}

      {toastNode}
    </div>
  );
}

function PostCard({
  post,
  onRemove,
  onSave,
}: {
  post: Post;
  onRemove: () => void;
  onSave: (edit: PostEdit) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);

  const pillar = pillarById(post.pillar);
  const voice = voiceById(post.voiceId);

  async function copy() {
    await navigator.clipboard.writeText(post.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card selected={editing}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Eyebrow>{editing ? "Đang sửa" : (pillar?.name ?? post.pillar)}</Eyebrow>
          <span className="num text-xs text-ink/45">{post.postedOn}</span>
        </div>

        {editing ? (
          <PostEditor post={post} onSave={onSave} onDone={() => setEditing(false)} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="block w-full text-left"
            >
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

                  <Button
                    variant="quiet"
                    onClick={() => {
                      setEditing(true);
                      setConfirming(false);
                    }}
                  >
                    Sửa bài
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
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * Sửa bài ngay trong thẻ.
 *
 * Chỉ bốn trường — ngày đăng, chủ đề, trụ cột, thân bài — đúng bằng `PostEdit`.
 * Số từ hiện lên là đếm sống từ ô đang gõ, còn con số ĐƯỢC LƯU là con số tầng
 * lưu đếm lại; cả hai dùng chung `countWords()` nên không lệch nhau.
 *
 * Danh mục nghiên cứu không nằm trong ô sửa: bài đăng dẫn nghiên cứu nào là do
 * `verifyFindings()` chốt lúc soạn, mở cho sửa tay ở đây là đi vòng qua rào chắn.
 */
function PostEditor({
  post,
  onSave,
  onDone,
}: {
  post: Post;
  onSave: (edit: PostEdit) => Promise<void>;
  onDone: () => void;
}) {
  const [postedOn, setPostedOn] = useState(post.postedOn);
  const [topic, setTopic] = useState(post.topic);
  const [pillar, setPillar] = useState(post.pillar);
  const [body, setBody] = useState(post.body);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Ô nhập cao đúng bằng bài. Khung cố định thì bài dài phải cuộn trong một ô
  // nhỏ, mà sửa bài đăng là việc phải đọc lại cả bài mới sửa được.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const words = countWords(body);
  const valid = topic.trim().length > 0 && body.trim().length > 0;
  const dirty =
    postedOn !== post.postedOn ||
    topic.trim() !== post.topic ||
    pillar !== post.pillar ||
    body !== post.body;

  async function submit() {
    if (saving || !dirty || !valid) return;
    setSaving(true);
    setError(null);

    try {
      await onSave({ postedOn, topic: topic.trim(), pillar, body });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được bài.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
        placeholder="Chủ đề bài viết"
        aria-label="Chủ đề"
        className="rule w-full border-b bg-transparent pb-2 font-serif text-xl leading-snug outline-none placeholder:text-ink/25"
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={pillar}
          onChange={(event) => setPillar(event.target.value)}
          className="border border-ink/20 bg-transparent px-3 py-2 text-sm"
          aria-label="Trụ cột nội dung"
        >
          {PILLARS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
          {/* Bài cũ có thể mang trụ cột đã gỡ khỏi lib/brand.ts — vẫn phải chọn lại được. */}
          {!PILLARS.some((item) => item.id === pillar) && (
            <option value={pillar}>{pillar}</option>
          )}
        </select>

        <input
          type="date"
          value={postedOn}
          onChange={(event) => setPostedOn(event.target.value)}
          className="num border border-ink/20 bg-transparent px-3 py-2 text-sm"
          aria-label="Ngày đăng"
        />

        <span className="num text-xs text-ink/45">{words} từ</span>
      </div>

      <textarea
        ref={bodyRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label="Thân bài"
        className="rule w-full resize-none border-t bg-transparent pt-4 text-[0.9375rem] leading-[1.75] outline-none"
      />

      {post.papers.length > 0 && (
        <p className="text-xs leading-relaxed text-slate">
          <Num>{post.papers.length}</Num> nghiên cứu đã dẫn giữ nguyên — danh mục trích dẫn
          ghép bằng code từ dữ liệu thật, không sửa tay ở đây.
        </p>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={saving || !dirty || !valid}>
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
        </Button>
        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className="text-xs text-ink/50 transition-colors hover:text-ink disabled:text-ink/25"
        >
          Huỷ
        </button>
        {!valid && (
          <span className="text-xs text-clay">Chủ đề và thân bài không được để trống.</span>
        )}
      </div>
    </div>
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
