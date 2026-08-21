"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Hôm nay" },
  { href: "/nghien-cuu", label: "Nghiên cứu" },
  { href: "/soan-bai", label: "Soạn bài" },
  { href: "/thu-vien", label: "Thư viện" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  // Trang đăng nhập không có gì để điều hướng tới.
  if (pathname === "/dang-nhap") return null;

  return (
    <header className="rule border-b">
      <nav className="mx-auto flex max-w-5xl items-baseline gap-8 px-6 py-5">
        <Link href="/" className="font-serif text-lg tracking-tight">
          Bàn viết
        </Link>
        <ul className="flex items-baseline gap-6 text-sm">
          {LINKS.slice(1).map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={
                    active
                      ? "border-b border-amber pb-0.5 text-ink"
                      : "text-ink/55 transition-colors hover:text-ink"
                  }
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
