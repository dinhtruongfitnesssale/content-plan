"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyNote, ErrorNote, Eyebrow, Num, PageHeader } from "@/components/ui";
import { CADENCE, PILLARS, pillarById, pillarDeficits } from "@/lib/brand";
import { daysSinceLastPost, getStore, toRecentPosts, type Post } from "@/lib/store";
import type { TopicSuggestion } from "@/lib/topics";

export function Today() {
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setPosts(await (await getStore()).list());
      } catch {
        /* thư viện đọc lỗi thì vẫn gợi ý được, chỉ kém chính xác hơn */
      }
    })();
  }, []);

  const suggest = useCallback(async () => {
    setPending(true);
    setError(null);
    setSuggestions(null);

    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recent: toRecentPosts(posts) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Lỗi ${res.status}`);
      setSuggestions(json.suggestions as TopicSuggestion[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lỗi không rõ");
    } finally {
      setPending(false);
    }
  }, [posts]);

  function accept(suggestion: TopicSuggestion) {
    const query = suggestion.searchQuery ?? suggestion.title;
    router.push(`/nghien-cuu?chu-de=${encodeURIComponent(query)}`);
  }

  const quiet = daysSinceLastPost(posts);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Hôm nay"
        title="Hôm nay nên viết gì"
        lede="Gợi ý dựa trên các trụ cột nội dung và những gì đã đăng gần đây — ưu tiên trụ cột đang thiếu, tránh lặp chủ đề cũ."
      />

      {quiet !== null && quiet >= CADENCE.quietDaysWarning && (
        <ErrorNote>
          Đã <Num>{quiet}</Num> ngày chưa đăng bài. Đăng đều quan trọng hơn đăng hay —
          độc giả quên nhanh hơn ta tưởng.
        </ErrorNote>
      )}

      <PillarBalance posts={posts} />

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={suggest} disabled={pending}>
          {pending ? "Đang nghĩ…" : suggestions ? "Gợi ý khác" : "Gợi ý chủ đề hôm nay"}
        </Button>
        {posts.length === 0 && (
          <span className="text-xs text-ink/45">
            Chưa có lịch sử bài đăng — gợi ý đầu tiên sẽ dựa hoàn toàn vào tỉ lệ trụ cột.
          </span>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {suggestions && suggestions.length > 0 && (
        <section className="space-y-4">
          <div className="rule border-b pb-3">
            <Eyebrow>Gợi ý</Eyebrow>
          </div>
          <ul className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <SuggestionCard suggestion={suggestion} onAccept={() => accept(suggestion)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggestions && suggestions.length === 0 && (
        <EmptyNote>Không sinh được gợi ý nào hợp lệ. Thử lại giúp chị.</EmptyNote>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onAccept,
}: {
  suggestion: TopicSuggestion;
  onAccept: () => void;
}) {
  const pillar = pillarById(suggestion.pillarId);

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow">{pillar?.name ?? suggestion.pillarId}</p>
          {suggestion.searchQuery && (
            <span className="text-xs text-ink/40">cần tra bằng chứng</span>
          )}
        </div>

        <h3 className="font-serif text-xl leading-snug">{suggestion.title}</h3>
        <p className="text-sm leading-relaxed text-ink/70">{suggestion.angle}</p>

        <blockquote className="border-l-2 border-amber/40 py-1 pl-4 font-serif text-[0.9375rem] leading-relaxed italic">
          {suggestion.hook}
        </blockquote>

        <p className="border-l-2 border-slate/35 py-0.5 pl-3 text-xs leading-relaxed text-slate">
          {suggestion.why}
        </p>

        <div className="flex items-center gap-3 pt-1">
          <Button variant="quiet" onClick={onAccept}>
            {suggestion.searchQuery ? "Tra bằng chứng" : "Bắt đầu viết"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Thanh cân đối trụ cột — thấy ngay mảng nào đang bỏ trống. */
function PillarBalance({ posts }: { posts: Post[] }) {
  const deficits = pillarDeficits(toRecentPosts(posts));
  const byId = new Map(deficits.map((item) => [item.pillar.id, item]));

  return (
    <section className="space-y-3">
      <div className="rule flex items-baseline justify-between border-b pb-3">
        <Eyebrow>Cân đối trụ cột</Eyebrow>
        <span className="text-xs text-ink/45">
          <Num>{posts.length}</Num> bài đã ghi nhận
        </span>
      </div>

      <ul className="space-y-2.5">
        {PILLARS.map((pillar) => {
          const item = byId.get(pillar.id);
          const actual = item?.actual ?? 0;
          const short = (item?.gap ?? 0) > 0.02 && posts.length > 0;

          return (
            <li key={pillar.id} className="flex items-center gap-4 text-sm">
              <span className="w-40 shrink-0 truncate">{pillar.name}</span>

              <span className="relative h-px flex-1 bg-ink/12">
                {/* Vạch mục tiêu — nét mảnh, một trong các chỗ được dùng amber. */}
                <span
                  className="absolute -top-1 h-2 w-px bg-amber"
                  style={{ left: `${pillar.share * 100}%` }}
                  aria-hidden
                />
                <span
                  className="absolute top-0 left-0 h-px bg-ink"
                  style={{ width: `${Math.min(actual * 100, 100)}%` }}
                />
              </span>

              <span className={`num w-24 shrink-0 text-right text-xs ${short ? "text-slate" : "text-ink/45"}`}>
                {Math.round(actual * 100)}% / {Math.round(pillar.share * 100)}%
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink/40">
        Vạch dọc là tỉ lệ mục tiêu. Đường đậm là tỉ lệ thực tế.
      </p>
    </section>
  );
}
