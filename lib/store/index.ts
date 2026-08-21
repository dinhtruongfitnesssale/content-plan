"use client";

import type { NewPost, Post, Store, StoreMode } from "./types";

export type { NewPost, Post, StoreMode };

const LOCAL_KEY = "ban-viet:bai-viet";

/**
 * Chọn nơi lưu bằng cách DÒ LÚC CHẠY, không bằng biến build-time.
 *
 * Lý do: chị sẽ thêm Supabase sau. Nếu quyết định bằng `NEXT_PUBLIC_*` thì mỗi
 * lần thêm biến môi trường lại phải build lại. Ở đây client hỏi thẳng server
 * một lần đầu tiên; server chưa cấu hình Supabase thì trả 501 và client dùng
 * localStorage cho suốt phiên.
 */
let cachedMode: StoreMode | null = null;

async function detectMode(): Promise<StoreMode> {
  if (cachedMode) return cachedMode;

  try {
    const res = await fetch("/api/posts", { method: "HEAD" });
    cachedMode = res.status === 501 ? "local" : "supabase";
  } catch {
    cachedMode = "local";
  }

  return cachedMode;
}

export async function getStore(): Promise<Store> {
  return (await detectMode()) === "supabase" ? remoteStore : localStore;
}

/* --- localStorage --- */

const localStore: Store = {
  mode: "local",

  async list() {
    return readLocal();
  },

  async add(post) {
    const saved: Post = {
      ...post,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    writeLocal([saved, ...readLocal()]);
    return saved;
  },

  async remove(id) {
    writeLocal(readLocal().filter((post) => post.id !== id));
  },
};

function readLocal(): Post[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Post[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(posts: Post[]): void {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(posts.slice(0, 500)));
}

/* --- Supabase qua route handler --- */

const remoteStore: Store = {
  mode: "supabase",

  async list() {
    const res = await fetch("/api/posts");
    if (!res.ok) throw new Error(await errorText(res));
    const json = await res.json();
    return json.posts as Post[];
  },

  async add(post) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(post),
    });
    if (!res.ok) throw new Error(await errorText(res));
    const json = await res.json();
    return json.post as Post;
  },

  async remove(id) {
    const res = await fetch(`/api/posts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await errorText(res));
  },
};

async function errorText(res: Response): Promise<string> {
  const json = await res.json().catch(() => null);
  return json?.error ?? `Lỗi ${res.status}`;
}

/**
 * Chuyển bài đã lưu về dạng bộ gợi ý chủ đề cần.
 * Giữ tách bạch để đổi nơi lưu không phải sửa `lib/topics.ts`.
 */
export function toRecentPosts(posts: Post[]): { pillar: string; topic: string; date: string }[] {
  return posts.map((post) => ({
    pillar: post.pillar,
    topic: post.topic,
    date: post.postedOn,
  }));
}

export function daysSinceLastPost(posts: Post[]): number | null {
  if (posts.length === 0) return null;

  const latest = posts
    .map((post) => new Date(post.postedOn).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => b - a)[0];

  if (latest === undefined) return null;
  return Math.floor((Date.now() - latest) / 86_400_000);
}
