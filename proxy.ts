import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const LOGIN_PATH = "/dang-nhap";

export async function proxy(request: NextRequest) {
  const secret = process.env.APP_PASSWORD;
  const { pathname } = request.nextUrl;

  // Chưa đặt mật khẩu: ở máy nhà thì cho qua cho tiện, nhưng khi đã deploy thì
  // CHẶN SẠCH. Quên đặt biến môi trường trên Vercel mà app vẫn chạy nghĩa là
  // API key của chị phơi ra cho cả internet — thà app không chạy còn hơn.
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse(
      "Chưa đặt APP_PASSWORD. Thêm biến môi trường này trên Vercel rồi deploy lại.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const authorized = await verifySessionToken(request.cookies.get(COOKIE_NAME)?.value, secret);

  if (pathname === LOGIN_PATH) {
    return authorized
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (authorized) return NextResponse.next();

  // Gọi thẳng API mà không qua giao diện thì trả 401, không chuyển hướng —
  // nếu không người ta bỏ qua trang đăng nhập và gọi /api/compose để đốt key.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const target = new URL(LOGIN_PATH, request.url);
  if (pathname !== "/") target.searchParams.set("tiep", pathname);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: [
    /*
     * Chặn mọi thứ trừ:
     * - /api/dang-nhap  (nếu chặn thì không đăng nhập được)
     * - tài nguyên tĩnh của Next và favicon
     */
    "/((?!api/dang-nhap|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
