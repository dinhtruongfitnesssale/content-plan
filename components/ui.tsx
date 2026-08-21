import type { ReactNode } from "react";

/**
 * Các mảnh giao diện dùng chung. Giữ nguyên quy tắc 90/5/5:
 * 90% paper + ink, 5% amber cho nét mảnh và nhãn nhỏ,
 * 5% còn lại cho herb / slate / clay và chỉ khi có vai trò rõ ràng.
 */

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="rule border-b pb-8">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight">{title}</h1>
      {lede && <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-ink/65">{lede}</p>}
    </header>
  );
}

/** Nút chính: nền mực, chữ giấy. Không bao giờ nền amber. */
export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet";
}) {
  const styles =
    variant === "primary"
      ? "bg-ink text-paper hover:bg-ink/85 disabled:bg-ink/25"
      : "border border-ink/20 text-ink hover:border-ink/50 disabled:text-ink/30 disabled:border-ink/10";

  return (
    <button
      {...props}
      className={`px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles}`}
    >
      {children}
    </button>
  );
}

/** Trích nguyên văn từ abstract — dấu « » amber, nội dung mực. */
export function Quoted({ children }: { children: ReactNode }) {
  return <span className="quoted italic">{children}</span>;
}

const STRENGTH_TONE = {
  mạnh: "text-herb border-herb/45",
  "trung bình": "text-slate border-slate/45",
  yếu: "text-clay border-clay/45",
} as const;

export function StrengthBadge({ strength }: { strength: keyof typeof STRENGTH_TONE }) {
  return (
    <span
      className={`border px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap ${STRENGTH_TONE[strength]}`}
    >
      bằng chứng {strength}
    </span>
  );
}

export function Num({ children }: { children: ReactNode }) {
  return <span className="num">{children}</span>;
}

export function Card({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return (
    <div
      className={`border p-5 transition-colors ${
        selected ? "border-ink/55 bg-ink/[0.025]" : "border-ink/12"
      }`}
    >
      {children}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-slate/35 py-1 pl-4 text-sm leading-relaxed text-slate">
      {children}
    </p>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-clay/50 py-1 pl-4 text-sm leading-relaxed text-clay">
      {children}
    </p>
  );
}
