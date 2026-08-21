import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, SESSION_DAYS, constantTimeEqual, createSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

const RequestSchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    return NextResponse.json(
      { error: "Chưa đặt APP_PASSWORD trên server." },
      { status: 503 },
    );
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thiếu mật khẩu." }, { status: 400 });
  }

  if (!constantTimeEqual(parsed.data.password, secret)) {
    // Trễ nhẹ để việc dò mật khẩu bằng máy chậm lại đáng kể.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: "Mật khẩu không đúng." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, await createSessionToken(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });

  return response;
}

/** Đăng xuất — xoá cookie. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
