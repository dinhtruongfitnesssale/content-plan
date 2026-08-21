"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote, Eyebrow } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || password.length === 0) return;

    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/dang-nhap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `Lỗi ${res.status}`);
      }

      // Middleware đọc cookie ở phía server nên phải nạp lại, không đủ với router.push.
      const next = params.get("tiep");
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lỗi không rõ");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <Eyebrow>Bàn viết</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl tracking-tight">Nhập mật khẩu</h1>
      </div>

      <div className="rule border-b pb-3">
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          autoFocus
          autoComplete="current-password"
          className="w-full bg-transparent font-serif text-2xl outline-none placeholder:text-ink/20"
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Button type="submit" disabled={pending || password.length === 0}>
        {pending ? "Đang kiểm tra…" : "Vào"}
      </Button>

      <p className="text-xs leading-relaxed text-ink/45">
        Nhớ trong 30 ngày trên máy này.
      </p>
    </form>
  );
}
